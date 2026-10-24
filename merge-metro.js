/**
 * Merge generated GTFS metro data into the bus graph.
 *
 * Usage:
 *   node merge-metro.js
 *
 * The candidate graph is validated before graph.json is replaced. A timestamped
 * backup is created immediately before replacement.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const GRAPH_FILE = "./graph.json";
const METRO_FILE = "./data/metro.json";
const WALK_M = 200;
const WALK_SPEED = 80;

function haversineM(a, b) {
  const R = 6_371_000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const r2 = (n) => Math.round(n * 100) / 100;
const isFiniteCoordinate = (value, min, max) =>
  Number.isFinite(value) && value >= min && value <= max;

function addEdge(adj, from, to, cost, type, route = null) {
  const edge = [to, r2(cost), type, route];
  const edges = (adj[from] ||= []);
  if (!edges.some((item) => JSON.stringify(item) === JSON.stringify(edge))) {
    edges.push(edge);
  }
}

function metroRouteIds(graph, metro) {
  const ids = new Set(
    Object.keys(graph.routes)
      .filter((id) => String(graph.routes[id]).startsWith("metro:"))
      .map((id) => id.slice("metro:".length))
  );
  for (const line of metro.lines) ids.add(line.id);
  return ids;
}

function removeMetro(graph, metro) {
  const oldAndNewLineIds = metroRouteIds(graph, metro);
  const stationIds = new Set(Object.keys(metro.stations));
  for (const node of Object.keys(graph.adj)) {
    if (node.startsWith("M:")) stationIds.add(node.slice(2));
  }

  for (const [routeId, routeName] of Object.entries(graph.routes)) {
    if (typeof routeName === "string" && routeName.startsWith("metro:")) {
      delete graph.routes[routeId];
    }
  }

  for (const node of Object.keys(graph.adj)) {
    if (node.startsWith("M:")) {
      delete graph.adj[node];
      continue;
    }

    if (
      node.startsWith("R:") &&
      [...oldAndNewLineIds].some((lineId) => node.endsWith(`:${lineId}`))
    ) {
      delete graph.adj[node];
    }
  }

  for (const [node, edges] of Object.entries(graph.adj)) {
    if (node.startsWith("S:")) {
      graph.adj[node] = edges.filter(
        ([to, , type]) => !(type === "walk" && to.startsWith("M:"))
      );
    }
  }

  for (const stationId of stationIds) delete graph.stops[stationId];
}

function validateMetroData(metro) {
  const errors = [];
  const stationIds = new Set(Object.keys(metro.stations || {}));
  const lineIds = new Set();

  if (!Number.isFinite(metro.boardingMinutes) || metro.boardingMinutes < 0) {
    errors.push("boardingMinutes must be a non-negative number");
  }

  for (const [id, station] of Object.entries(metro.stations || {})) {
    if (!station.name) errors.push(`station ${id} has no name`);
    if (!isFiniteCoordinate(station.lat, -90, 90)) {
      errors.push(`station ${id} has invalid latitude`);
    }
    if (!isFiniteCoordinate(station.lon, -180, 180)) {
      errors.push(`station ${id} has invalid longitude`);
    }
  }

  for (const line of metro.lines || []) {
    if (!line.id || lineIds.has(line.id)) {
      errors.push(`line id is missing or duplicated: ${line.id}`);
    }
    lineIds.add(line.id);
    for (const connection of line.connections || []) {
      const [from, to, minutes] = connection;
      if (!stationIds.has(from) || !stationIds.has(to)) {
        errors.push(`line ${line.id} references an unknown station`);
      }
      if (from === to || !Number.isFinite(minutes) || minutes <= 0) {
        errors.push(`line ${line.id} has an invalid connection`);
      }
    }
  }

  for (const interchange of metro.interchanges || []) {
    const [from, to] = interchange.stations || [];
    if (!stationIds.has(from) || !stationIds.has(to)) {
      errors.push("interchange references an unknown station");
    }
    if (!Number.isFinite(interchange.walkMinutes) || interchange.walkMinutes < 0) {
      errors.push("interchange has invalid walkMinutes");
    }
  }

  return errors;
}

export function mergeMetroGraph(inputGraph, metro) {
  const dataErrors = validateMetroData(metro);
  if (dataErrors.length) {
    throw new Error(`Invalid metro data:\n- ${dataErrors.join("\n- ")}`);
  }

  const graph = structuredClone(inputGraph);
  removeMetro(graph, metro);

  for (const [id, station] of Object.entries(metro.stations)) {
    graph.stops[id] = {
      name: `${station.name} Metro`,
      lat: station.lat,
      lon: station.lon,
    };
  }

  const lineRouteId = {};
  for (const line of metro.lines) {
    const routeId = `metro:${line.id}`;
    graph.routes[routeId] = `metro:${line.name}`;
    lineRouteId[line.id] = routeId;
  }

  for (const line of metro.lines) {
    const routeId = lineRouteId[line.id];
    const stationIds = new Set();

    for (const [from, to, minutes] of line.connections || []) {
      stationIds.add(from);
      stationIds.add(to);
      addEdge(
        graph.adj,
        `R:${from}:${line.id}`,
        `R:${to}:${line.id}`,
        minutes,
        "ride",
        routeId
      );
      addEdge(
        graph.adj,
        `R:${to}:${line.id}`,
        `R:${from}:${line.id}`,
        minutes,
        "ride",
        routeId
      );
    }

    for (const stationId of stationIds) {
      const hub = `M:${stationId}`;
      const routeNode = `R:${stationId}:${line.id}`;
      addEdge(graph.adj, hub, routeNode, metro.boardingMinutes, "board", routeId);
      addEdge(graph.adj, routeNode, hub, 0, "alight", routeId);
    }
  }

  for (const interchange of metro.interchanges || []) {
    const [from, to] = interchange.stations;
    addEdge(graph.adj, `M:${from}`, `M:${to}`, interchange.walkMinutes, "walk");
    addEdge(graph.adj, `M:${to}`, `M:${from}`, interchange.walkMinutes, "walk");
  }

  const busStopIds = new Set(
    Object.keys(graph.adj)
      .filter((node) => node.startsWith("S:"))
      .map((node) => node.slice(2))
  );
  let metroWalkLinks = 0;

  for (const [stationId, station] of Object.entries(metro.stations)) {
    const metroHub = `M:${stationId}`;
    for (const busStopId of busStopIds) {
      const busStop = graph.stops[busStopId];
      if (
        !busStop ||
        !isFiniteCoordinate(busStop.lat, -90, 90) ||
        !isFiniteCoordinate(busStop.lon, -180, 180)
      ) {
        continue;
      }

      const distance = haversineM(station, busStop);
      if (distance > WALK_M) continue;

      const minutes = r2(distance / WALK_SPEED);
      addEdge(graph.adj, metroHub, `S:${busStopId}`, minutes, "walk");
      addEdge(graph.adj, `S:${busStopId}`, metroHub, minutes, "walk");
      metroWalkLinks++;
    }
  }

  return {
    graph,
    stats: {
      metroStations: Object.keys(metro.stations).length,
      metroLines: metro.lines.length,
      metroConnections: metro.lines.reduce(
        (count, line) => count + (line.connections || []).length,
        0
      ),
      metroInterchanges: (metro.interchanges || []).length,
      metroWalkLinks,
      totalStops: Object.keys(graph.stops).length,
      totalAdjacencyNodes: Object.keys(graph.adj).length,
    },
  };
}

export function validateMergedGraph(graph, metro) {
  const errors = validateMetroData(metro);
  const metroRouteIds = new Set(metro.lines.map((line) => `metro:${line.id}`));

  for (const [id, station] of Object.entries(metro.stations)) {
    const stop = graph.stops[id];
    if (!stop) errors.push(`merged station is missing from graph: ${id}`);
    if (!graph.adj[`M:${id}`]) errors.push(`merged station has no hub: ${id}`);
    if (
      stop &&
      (!isFiniteCoordinate(stop.lat, -90, 90) ||
        !isFiniteCoordinate(stop.lon, -180, 180))
    ) {
      errors.push(`merged station has invalid coordinates: ${id}`);
    }
  }

  for (const [from, edges] of Object.entries(graph.adj)) {
    for (const edge of edges) {
      const [to, minutes, type, routeId] = edge;
      if (!to || !Number.isFinite(minutes) || minutes < 0) {
        errors.push(`invalid graph edge from ${from}`);
      }
      if (type !== "walk" && type !== "ride" && type !== "board" && type !== "alight") {
        errors.push(`unknown edge type from ${from}`);
      }
      if (metroRouteIds.has(routeId) && !graph.routes[routeId]) {
        errors.push(`metro edge references missing route: ${routeId}`);
      }
      if (type === "walk" && from.startsWith("S:") && to.startsWith("M:")) {
        const busId = from.slice(2);
        if (!Object.prototype.hasOwnProperty.call(graph.stops, busId)) {
          errors.push(`metro walking edge references missing bus stop: ${from}`);
        }
      }
    }
  }

  return errors;
}

function writeCandidateGraph(graph, metro) {
  const candidateFile = `${GRAPH_FILE}.candidate`;
  fs.writeFileSync(candidateFile, JSON.stringify(graph));
  const candidate = JSON.parse(fs.readFileSync(candidateFile, "utf8"));
  const errors = validateMergedGraph(candidate, metro);
  if (errors.length) {
    fs.rmSync(candidateFile, { force: true });
    throw new Error(`Candidate graph validation failed:\n- ${errors.join("\n- ")}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = `${GRAPH_FILE}.backup-${stamp}`;
  fs.copyFileSync(GRAPH_FILE, backupFile);
  fs.renameSync(candidateFile, GRAPH_FILE);
  return backupFile;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  const graph = JSON.parse(fs.readFileSync(GRAPH_FILE, "utf8"));
  const metro = JSON.parse(fs.readFileSync(METRO_FILE, "utf8"));
  const result = mergeMetroGraph(graph, metro);
  const backupFile = writeCandidateGraph(result.graph, metro);
  console.log("Metro integration complete.");
  console.log({ ...result.stats, backupFile, graphFile: GRAPH_FILE });
}
