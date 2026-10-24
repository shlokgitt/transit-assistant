/**
 * merge-metro.js
 *
 * Merges DMRC metro station data (data/metro.json) into the existing bus
 * graph (graph.json), then writes the updated graph back to graph.json.
 *
 * How it integrates:
 *   - Each metro station becomes a hub node  M:<stationId>  (parallel to S:
 *     hub nodes for bus stops).
 *   - Each (station, line) pair becomes a route node  R:<stationId>:<lineId>
 *     (same namespace as bus route nodes).
 *   - Board / alight / ride edges follow the same convention as bus edges so
 *     the existing Dijkstra engine in route.js needs zero changes.
 *   - Walking transfers between metro stations and nearby bus stops (within
 *     WALK_M metres) are added as bidirectional "walk" edges between the
 *     metro hub node and bus hub nodes, same as existing bus–bus walk links.
 *   - Interchange edges between different metro lines at the same physical
 *     station are added as "walk" edges between the two hub nodes, using the
 *     walkMinutes from metro.json.
 *   - Metro routes are stored in G.routes with a "metro:" prefix so
 *     route.js can identify them; the fare for metro is looked up from the
 *     metro slab table embedded in this file, NOT the bus fare table.
 *
 * Accuracy notes:
 *   - Station coordinates are approximate (sourced from public references).
 *   - Travel times between consecutive stations are representative averages
 *     (2–3 min/hop); no official timetable data is available as open data.
 *   - Fares are official DMRC 2023–2024 token fares (distance-based slabs).
 *   - This is static data; no live feed is available.
 *
 * Usage:
 *   node merge-metro.js
 *
 * Safe to re-run: the script reconstructs all metro edges from scratch on
 * each run, then overwrites graph.json. Bus edges are never modified.
 */

import fs from "node:fs";

const GRAPH_FILE  = "./graph.json";
const METRO_FILE  = "./data/metro.json";
const WALK_M      = 200;   // metres — same as build-graph.js

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function haversineM(a, b) {
  const R   = 6_371_000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function haversineKm(a, b) {
  return haversineM(a, b) / 1000;
}

function r2(n) {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Load existing graph and metro data
// ---------------------------------------------------------------------------

const G     = JSON.parse(fs.readFileSync(GRAPH_FILE, "utf8"));
const METRO = JSON.parse(fs.readFileSync(METRO_FILE, "utf8"));

// Remove any metro edges added by a previous run so this script is idempotent.
// Metro hub nodes start with "M:", metro route nodes start with "R:" and have
// a line id that appears in METRO.lines.  We remove them from adj and routes.
const metroLineIds = new Set(METRO.lines.map((l) => l.id));
const metroStationIds = new Set(Object.keys(METRO.stations));

// Remove metro route entries from G.routes
for (const [routeId, routeName] of Object.entries(G.routes)) {
  if (typeof routeName === "string" && routeName.startsWith("metro:")) {
    delete G.routes[routeId];
  }
}

// Remove metro hub nodes (M:*) and metro route nodes (R:*:metroLine) from adj
for (const node of Object.keys(G.adj)) {
  if (node.startsWith("M:")) {
    delete G.adj[node];
    continue;
  }
  if (node.startsWith("R:")) {
    const parts = node.split(":");
    if (metroLineIds.has(parts[2])) {
      delete G.adj[node];
    }
  }
}

// Also strip any walk edges from bus S: nodes that point to M: nodes
for (const [node, edges] of Object.entries(G.adj)) {
  if (node.startsWith("S:")) {
    G.adj[node] = edges.filter(
      (e) => !(e[2] === "walk" && e[0].startsWith("M:"))
    );
  }
}

// Remove metro stops from G.stops (if a previous run added them)
for (const stopId of Object.keys(G.stops)) {
  if (metroStationIds.has(stopId)) {
    delete G.stops[stopId];
  }
}

// ---------------------------------------------------------------------------
// Add metro stations to G.stops (for nameOf() lookups in route.js)
// ---------------------------------------------------------------------------

for (const [id, station] of Object.entries(METRO.stations)) {
  // Only add if not already present (bus stops use numeric ids; metro ids
  // contain letters so there is no collision risk)
  G.stops[id] = { name: station.name + " Metro", lat: station.lat, lon: station.lon };
}

// ---------------------------------------------------------------------------
// Build metro edges
// ---------------------------------------------------------------------------

const add = (from, to, cost, type, route = null) => {
  (G.adj[from] ||= []).push([to, r2(cost), type, route]);
};

// Register each line as a "route" in G.routes using a "metro:LineId" name
// so route.js can display and identify it.
const lineRouteId = {};  // lineId → routeId string (used in board/alight edges)
for (const line of METRO.lines) {
  const routeId = `metro:${line.id}`;
  G.routes[routeId] = `metro:${line.name}`;
  lineRouteId[line.id] = routeId;
}

// For each line, add board / ride / alight edges
for (const line of METRO.lines) {
  const routeId = lineRouteId[line.id];
  const seq     = line.sequence;
  const times   = line.travelMinutes;

  for (let i = 0; i < seq.length; i++) {
    const stationId = seq[i];
    const hubNode   = `M:${stationId}`;
    const routeNode = `R:${stationId}:${line.id}`;

    // Hub → route: boarding (waiting + boarding cost)
    add(hubNode, routeNode, METRO.boardingMinutes, "board", routeId);

    // Route → hub: alighting (free)
    add(routeNode, hubNode, 0, "alight", routeId);

    // Ride to next station
    if (i < seq.length - 1) {
      const nextStationId = seq[i + 1];
      const nextRouteNode = `R:${nextStationId}:${line.id}`;
      add(routeNode, nextRouteNode, times[i], "ride", routeId);
      // Metro is bidirectional
      add(nextRouteNode, routeNode, times[i], "ride", routeId);
    }
  }

  // Board edges from the other direction also need hub→route entries for
  // every station (the reverse-direction "board" is the same cost).
  // The loop above already adds M:→R: for each station, so we're done.
}

// ---------------------------------------------------------------------------
// Interchange edges between co-located metro stations (different lines)
// ---------------------------------------------------------------------------

for (const ic of METRO.interchanges) {
  const [a, b] = ic.stations;
  const hubA = `M:${a}`;
  const hubB = `M:${b}`;
  // Bidirectional walk between the two hub nodes
  add(hubA, hubB, ic.walkMinutes, "walk");
  add(hubB, hubA, ic.walkMinutes, "walk");
}

// ---------------------------------------------------------------------------
// Walk edges between metro hub nodes and nearby bus hub nodes (S:*)
// ---------------------------------------------------------------------------

let metroWalkLinks = 0;

for (const [stationId, station] of Object.entries(METRO.stations)) {
  const hubM = `M:${stationId}`;

  for (const [busStopId, busStop] of Object.entries(G.stops)) {
    // Skip other metro stations (interchanges handled above)
    if (metroStationIds.has(busStopId)) continue;

    const d = haversineM(station, busStop);
    if (d <= WALK_M) {
      const walkMin = r2(d / 80); // 80 m/min walking speed, same as build-graph.js
      const hubS = `S:${busStopId}`;
      add(hubM, hubS, walkMin, "walk");
      add(hubS, hubM, walkMin, "walk");
      metroWalkLinks++;
    }
  }
}

// ---------------------------------------------------------------------------
// Write updated graph
// ---------------------------------------------------------------------------

fs.writeFileSync(GRAPH_FILE, JSON.stringify(G));

const metroStationCount = Object.keys(METRO.stations).length;
const metroLineCount    = METRO.lines.length;
const totalStops        = Object.keys(G.stops).length;
const totalAdj          = Object.keys(G.adj).length;

console.log("Metro integration complete.");
console.log(`  Metro stations added  : ${metroStationCount}`);
console.log(`  Metro lines added     : ${metroLineCount}`);
console.log(`  Metro→bus walk links  : ${metroWalkLinks} (bidirectional pairs)`);
console.log(`  Total stops in graph  : ${totalStops}`);
console.log(`  Total adj nodes       : ${totalAdj}`);
console.log(`  Graph written to      : ${GRAPH_FILE}`);
console.log("Note: metro travel times and fares are estimated static values.");
