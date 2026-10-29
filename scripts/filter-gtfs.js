import fs from "fs";
import { parse } from "csv-parse";
import { parse as parseSync } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

// Example box around central Delhi. Change it to the area you want.
const BOX = { minLat: 28.58, maxLat: 28.68, minLon: 77.15, maxLon: 77.28 };
const IN = "./gtfs-raw", OUT = "./gtfs";
fs.mkdirSync(OUT, { recursive: true });

const readAll = (f) =>
  parseSync(fs.readFileSync(`${IN}/${f}`), { columns: true, skip_empty_lines: true, bom: true });
const write = (f, rows) =>
  fs.writeFileSync(`${OUT}/${f}`, stringify(rows, { header: true }));

// 1. stops inside the box
const stops = readAll("stops.txt").filter((s) => {
  const lat = +s.stop_lat, lon = +s.stop_lon;
  return lat >= BOX.minLat && lat <= BOX.maxLat && lon >= BOX.minLon && lon <= BOX.maxLon;
});
const stopIds = new Set(stops.map((s) => s.stop_id));
write("stops.txt", stops);

// 2. stop_times is huge, so stream it
const stopTimes = [];
const tripIds = new Set();
const parser = fs.createReadStream(`${IN}/stop_times.txt`).pipe(
  parse({ columns: true, skip_empty_lines: true, bom: true })
);
for await (const row of parser) {
  if (stopIds.has(row.stop_id)) {
    stopTimes.push(row);
    tripIds.add(row.trip_id);
  }
}
write("stop_times.txt", stopTimes);

// 3. trips and routes that survived
const trips = readAll("trips.txt").filter((t) => tripIds.has(t.trip_id));
const routeIds = new Set(trips.map((t) => t.route_id));
write("trips.txt", trips);
write("routes.txt", readAll("routes.txt").filter((r) => routeIds.has(r.route_id)));

console.log({ stops: stops.length, stopTimes: stopTimes.length, trips: trips.length, routes: routeIds.size });