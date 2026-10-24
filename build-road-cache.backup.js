
import fs from "node:fs";
import path from "node:path";

const GTFS_DIR = "./gtfs";
const OUTPUT_FILE = "./data/road-distances.json";

// Example local OSRM server. Change this if your server uses another URL.
// The server must have a driving road network loaded.
const OSRM_URL = process.env.OSRM_URL || "http://localhost:5000";

const readCsv = (file) => {
  const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  const headers = lines.shift().split(",");

  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(
      headers.map((header, i) => [header, values[i] ?? ""])
    );
  });
};

const stops = new Map(
  readCsv(path.join(GTFS_DIR, "stops.txt")).map((s) => [
    s.stop_id,
    {
      lat: Number(s.stop_lat),
      lon: Number(s.stop_lon),
      name: s.stop_name,
    },
  ])
);

const trips = readCsv(path.join(GTFS_DIR, "trips.txt"));
const stopTimes = readCsv(path.join(GTFS_DIR, "stop_times.txt"));

const tripToRoute = new Map(
  trips.map((trip) => [trip.trip_id, trip.route_id])
);

const byTrip = new Map();

for (const row of stopTimes) {
  if (!byTrip.has(row.trip_id)) byTrip.set(row.trip_id, []);
  byTrip.get(row.trip_id).push({
    stopId: row.stop_id,
    sequence: Number(row.stop_sequence),
  });
}

const pairs = new Map();

for (const rows of byTrip.values()) {
  rows.sort((a, b) => a.sequence - b.sequence);

  for (let i = 1; i < rows.length; i++) {
    const from = rows[i - 1].stopId;
    const to = rows[i].stopId;

    if (!stops.has(from) || !stops.has(to) || from === to) continue;

    const key = `${from}>${to}`;
    if (!pairs.has(key)) pairs.set(key, { from, to });
  }
}

fs.mkdirSync("./data", { recursive: true });

let cache = {};
if (fs.existsSync(OUTPUT_FILE)) {
  cache = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf8"));
}

const pending = [...pairs.entries()].filter(([key]) => !cache[key]);

console.log(`Unique consecutive stop pairs: ${pairs.size}`);
console.log(`Already cached: ${pairs.size - pending.length}`);
console.log(`Remaining: ${pending.length}`);

async function routeDistance(fromId, toId) {
  const from = stops.get(fromId);
  const to = stops.get(toId);

  const coordinates = `${from.lon},${from.lat};${to.lon},${to.lat}`;
  const url =
    `${OSRM_URL.replace(/\/$/, "")}/route/v1/driving/${coordinates}` +
    "?overview=false&steps=false";

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`OSRM HTTP ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(`No road route found (${data.code || "unknown"})`);
  }

  return {
    distanceKm: Math.round((data.routes[0].distance / 1000) * 1000) / 1000,
    durationMin: Math.round((data.routes[0].duration / 60) * 10) / 10,
    method: "OSRM driving route between stops",
    fromName: from.name,
    toName: to.name,
  };
}

let completed = 0;
let failed = 0;

// Keep concurrency modest. Use a permitted routing service for bulk work.
const CONCURRENCY = 4;
let nextIndex = 0;

async function worker() {
  while (nextIndex < pending.length) {
    const index = nextIndex++;
    const [key, pair] = pending[index];

    try {
      cache[key] = await routeDistance(pair.from, pair.to);
      completed++;
    } catch (error) {
      failed++;
      cache[key] = {
        error: error.message,
        from: pair.from,
        to: pair.to,
      };
    }

    if ((completed + failed) % 25 === 0) {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cache, null, 2));
      console.log(
        `Processed ${completed + failed}/${pending.length}; ` +
        `success ${completed}; failed ${failed}`
      );
    }
  }
}

await Promise.all(
  Array.from(
    { length: Math.min(CONCURRENCY, pending.length) },
    () => worker()
  )
);

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cache, null, 2));

console.log("\nRoad-distance cache saved:", OUTPUT_FILE);
console.log("Successful distances:", completed);
console.log("Failed distances:", failed);
console.log("Failed entries are retained so they can be retried later.");

