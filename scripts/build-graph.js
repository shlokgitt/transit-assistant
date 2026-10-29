import fs from "fs";
import { parse } from "csv-parse/sync";

const read = (f) =>
  parse(fs.readFileSync(`./gtfs/${f}`), { columns: true, skip_empty_lines: true, bom: true });
const toMin = (t) => {
  const [h, m, s] = t.split(":").map(Number);
  return h * 60 + m + s / 60;
};

const BOARD = 5;       // minutes: waiting + boarding
const WALK_M = 200;    // max walking transfer distance, meters
const WALK_SPEED = 80; // meters per minute

const stops = Object.fromEntries(
  read("stops.txt").map((s) => [s.stop_id, { name: s.stop_name, lat: +s.stop_lat, lon: +s.stop_lon }])
);
const tripRoute = Object.fromEntries(read("trips.txt").map((t) => [t.trip_id, t.route_id]));
const routes = Object.fromEntries(
  read("routes.txt").map((r) => [r.route_id, r.route_short_name || r.route_long_name])
);

// group stop_times by trip
const byTrip = new Map();
for (const r of read("stop_times.txt")) {
  if (!byTrip.has(r.trip_id)) byTrip.set(r.trip_id, []);
  byTrip.get(r.trip_id).push(r);
}

// average ride time per (route, from, to)
const ride = new Map();
for (const [tripId, rows] of byTrip) {
  rows.sort((a, b) => +a.stop_sequence - +b.stop_sequence);
  const route = tripRoute[tripId];
  for (let i = 0; i < rows.length - 1; i++) {
    const dt = toMin(rows[i + 1].arrival_time) - toMin(rows[i].departure_time);
    if (dt < 0 || dt > 60) continue; // skip bad data
    const key = `${route}|${rows[i].stop_id}|${rows[i + 1].stop_id}`;
    const e = ride.get(key) || { sum: 0, n: 0 };
    e.sum += dt;
    e.n++;
    ride.set(key, e);
  }
}

const adj = {};
const add = (a, b, cost, type, route = null) =>
  (adj[a] ||= []).push([b, +cost.toFixed(2), type, route]);

const routeNodes = new Set();
for (const [key, e] of ride) {
  const [route, a, b] = key.split("|");
  add(`R:${a}:${route}`, `R:${b}:${route}`, Math.max(e.sum / e.n, 0.5), "ride", route);
  routeNodes.add(`${a}|${route}`);
  routeNodes.add(`${b}|${route}`);
}

// boarding and alighting between hub and route nodes
for (const k of routeNodes) {
  const [stop, route] = k.split("|");
  add(`S:${stop}`, `R:${stop}:${route}`, BOARD, "board", route);
  add(`R:${stop}:${route}`, `S:${stop}`, 0, "alight", route);
}

// walking transfers between nearby stops
const dist = (a, b) => {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const ids = Object.keys(stops);
let walks = 0;
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const d = dist(stops[ids[i]], stops[ids[j]]);
    if (d <= WALK_M) {
      add(`S:${ids[i]}`, `S:${ids[j]}`, d / WALK_SPEED, "walk");
      add(`S:${ids[j]}`, `S:${ids[i]}`, d / WALK_SPEED, "walk");
      walks++;
    }
  }
}

fs.writeFileSync("graph.json", JSON.stringify({ stops, routes, adj }));
console.log({
  stops: ids.length,
  routeNodes: routeNodes.size,
  rideEdges: ride.size,
  walkLinks: walks,
});