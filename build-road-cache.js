
import fs from "node:fs";
import path from "node:path";

const GTFS_DIR = "./gtfs";
const OUTPUT_FILE = "./data/road-distances.json";
const API_URL =
  "https://api.heigit.org/openrouteservice/v2/matrix/driving-car";

const API_KEY = process.env.ORS_API_KEY;
const MAX_DESTINATIONS = 10;
const DELAY_MS = 3000;
const MAX_RETRIES = 5;

if (!API_KEY) {
  console.error('Missing API key. Run: $env:ORS_API_KEY = "YOUR_KEY"');
  process.exit(1);
}

// CSV parser supporting quoted fields and commas inside quotes.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field.length === 0) {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some((v) => v.trim())) rows.push(row);
  }

  if (!rows.length) throw new Error("CSV is empty.");

  const headers = rows.shift().map((v) => v.trim());

  return rows.map((values) =>
    Object.fromEntries(
      headers.map((header, i) => [header, values[i] ?? ""])
    )
  );
}

function readCSV(file) {
  return parseCSV(fs.readFileSync(file, "utf8"));
}

const stopRows = readCSV(path.join(GTFS_DIR, "stops.txt"));
const stopTimes = readCSV(path.join(GTFS_DIR, "stop_times.txt"));

const stops = new Map(
  stopRows.map((s) => [
    s.stop_id,
    {
      lat: Number(s.stop_lat),
      lon: Number(s.stop_lon),
      name: s.stop_name,
    },
  ])
);

const byTrip = new Map();

for (const row of stopTimes) {
  if (!byTrip.has(row.trip_id)) byTrip.set(row.trip_id, []);

  byTrip.get(row.trip_id).push({
    stopId: row.stop_id,
    sequence: Number(row.stop_sequence),
  });
}

// Collect unique consecutive stop pairs, grouped by origin.
const pairsBySource = new Map();

for (const rows of byTrip.values()) {
  rows.sort((a, b) => a.sequence - b.sequence);

  for (let i = 1; i < rows.length; i++) {
    const from = rows[i - 1].stopId;
    const to = rows[i].stopId;

    if (from === to || !stops.has(from) || !stops.has(to)) continue;

    const a = stops.get(from);
    const b = stops.get(to);

    if (
      !Number.isFinite(a.lat) ||
      !Number.isFinite(a.lon) ||
      !Number.isFinite(b.lat) ||
      !Number.isFinite(b.lon)
    ) {
      continue;
    }

    if (!pairsBySource.has(from)) pairsBySource.set(from, new Set());
    pairsBySource.get(from).add(to);
  }
}

const allPairs = new Map();

for (const [from, destinations] of pairsBySource) {
  for (const to of destinations) {
    allPairs.set(`${from}>${to}`, { from, to });
  }
}

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

let cache = {};

if (fs.existsSync(OUTPUT_FILE)) {
  try {
    cache = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf8"));
  } catch {
    throw new Error(
      `Cannot read ${OUTPUT_FILE}. Restore your backup before continuing.`
    );
  }
}

const isCached = (key) =>
  Number.isFinite(cache[key]?.distanceKm) &&
  Number.isFinite(cache[key]?.durationMin);

// Failed entries are retried; valid entries are preserved.
const pendingBySource = new Map();

for (const [key, pair] of allPairs) {
  if (isCached(key)) continue;

  if (!pendingBySource.has(pair.from)) {
    pendingBySource.set(pair.from, []);
  }

  pendingBySource.get(pair.from).push(pair);
}

// One source per request: the matrix returns only requested
// origin-to-destination combinations, without unrelated cross-products.
const batches = [];

for (const [from, pairs] of pendingBySource) {
  for (let i = 0; i < pairs.length; i += MAX_DESTINATIONS) {
    batches.push({
      from,
      pairs: pairs.slice(i, i + MAX_DESTINATIONS),
    });
  }
}

const pendingCount = batches.reduce(
  (total, batch) => total + batch.pairs.length,
  0
);

console.log("Unique GTFS stop pairs:", allPairs.size);
console.log(
  "Already cached successfully:",
  [...allPairs.keys()].filter(isCached).length
);
console.log("Pairs to process:", pendingCount);
console.log("Matrix requests planned:", batches.length);
console.log("Maximum destinations per request:", MAX_DESTINATIONS);
console.log("Press Ctrl+C to stop; saved progress will be retained.");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let newlySuccessful = 0;
let newlyFailed = 0;
let stopRun = false;

async function saveCache() {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cache, null, 2));
}

async function processBatch(batch) {
  const destinationIds = [...new Set(batch.pairs.map((p) => p.to))];
  const origin = stops.get(batch.from);

  const locationIds = [batch.from, ...destinationIds];
  const index = new Map(locationIds.map((id, i) => [id, i]));

  const body = {
    locations: locationIds.map((id) => {
      const stop = stops.get(id);
      return [stop.lon, stop.lat];
    }),
    sources: [index.get(batch.from)],
    destinations: destinationIds.map((id) => index.get(id)),
    metrics: ["distance", "duration"],
    units: "m",
  };

  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          data.error?.message || data.message || JSON.stringify(data);

        const error = new Error(`HTTP ${response.status}: ${message}`);

        // Stop on authentication, quota, or invalid-request errors.
        if ([400, 401, 403, 404, 413, 429].includes(response.status)) {
          error.stopRun = true;
        }

        throw error;
      }

      if (!Array.isArray(data.distances?.[0]) ||
          !Array.isArray(data.durations?.[0])) {
        throw new Error("Matrix response is missing distance/duration arrays.");
      }

      for (const pair of batch.pairs) {
        const destinationIndex = destinationIds.indexOf(pair.to);
        const meters = data.distances[0][destinationIndex];
        const seconds = data.durations[0][destinationIndex];
        const key = `${pair.from}>${pair.to}`;

        if (
          !Number.isFinite(meters) ||
          !Number.isFinite(seconds) ||
          meters < 0 ||
          seconds < 0
        ) {
          cache[key] = {
            error: "No driving route returned by Matrix API",
            from: pair.from,
            to: pair.to,
          };
          newlyFailed++;
          continue;
        }

        cache[key] = {
          from: pair.from,
          to: pair.to,
          distanceKm: Math.round((meters / 1000) * 1000) / 1000,
          durationMin: Math.round((seconds / 60) * 100) / 100,
          method: "heigit-matrix-driving-car",
          fromName: origin.name,
          toName: stops.get(pair.to).name,
        };

        newlySuccessful++;
      }

      await saveCache();
      return;
    } catch (error) {
      lastError = error;

      if (error.stopRun) {
        stopRun = true;
        break;
      }

      if (attempt < MAX_RETRIES) {
        console.warn(`Retry ${attempt}/${MAX_RETRIES - 1}: ${error.message}`);
        await sleep(2000 * attempt);
      }
    }
  }

  for (const pair of batch.pairs) {
    const key = `${pair.from}>${pair.to}`;

    // Do not overwrite an already successful entry.
    if (!isCached(key)) {
      cache[key] = {
        error: lastError?.message || "Unknown Matrix API error",
        from: pair.from,
        to: pair.to,
      };
      newlyFailed++;
    }
  }

  await saveCache();
  console.error("Request failed:", lastError?.message);
}

for (let i = 0; i < batches.length; i++) {
  if (stopRun) break;

  const batch = batches[i];

  console.log(
    `Request ${i + 1}/${batches.length}: ` +
    `${batch.from} -> ${batch.pairs.length} destinations`
  );

  await processBatch(batch);

  const successfulTotal = [...allPairs.keys()].filter(isCached).length;

  console.log(
    `Saved successful pairs: ${successfulTotal}/${allPairs.size}; ` +
    `new failures: ${newlyFailed}`
  );

  if (stopRun) {
    console.error("Stopping because the API returned a non-retryable error.");
    break;
  }

  if (i < batches.length - 1) await sleep(DELAY_MS);
}

await saveCache();

const successfulTotal = [...allPairs.keys()].filter(isCached).length;
const missingTotal = allPairs.size - successfulTotal;

console.log("\nCache saved:", OUTPUT_FILE);
console.log("Successful pairs:", successfulTotal);
console.log("Missing or failed pairs:", missingTotal);
console.log("New successes this run:", newlySuccessful);
console.log("New failures this run:", newlyFailed);
console.log(
  "Note: driving-road distances are not verified distances along actual bus paths."
);
