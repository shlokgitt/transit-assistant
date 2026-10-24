/**
 * Merge the explicit, partial metro topology in data/metro.json into graph.json.
 *
 * Metro ride connections are deliberately supplied as explicit triples:
 * [fromStationId, toStationId, travelMinutes]. This prevents omitted
 * intermediate stations from becoming false direct links.
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

function addEdge(adj, from, to, cost, type, route = null) {
  const edge = [to, r2(cost), type, route];
  const edges = (adj[from] ||= []);
  if (!edges.some((item) => JSON.stringify(item) === JSON.stringify(edge))) {
    edges.push(edge);
  }
}

function removeMetro(graph, metro) {
  const lineIds = new Set(metro.lines.map((line) => line.id));
  const stationIds = new Set(Object.keys(metro.stations));

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

    if (node.startsWith("R:")) {
      const [, , lineId] = node.split(":");
      if (lineIds.has(lineId)) delete graph.adj[node];
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

export function mergeMetroGraph(inputGraph, metro) {
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
      if (!metro.stations[from] || !metro.stations[to]) {
        throw new Error(`Metro connection references an unknown station: ${from} -> ${to}`);
      }
      if (!Number.isFinite(minutes) || minutes <= 0) {
        throw new Error(`Metro connection has invalid travel time: ${from} -> ${to}`);
      }

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
    if (!metro.stations[from] || !metro.stations[to]) {
      throw new Error(`Metro interchange references an unknown station: ${from} <-> ${to}`);
    }
    addEdge(graph.adj, `M:${from}`, `M:${to}`, interchange.walkMinutes, "walk");
    addEdge(graph.adj, `M:${to}`, `M:${from}`, interchange.walkMinutes, "walk");
  }

  let metroWalkLinks = 0;
  for (const [stationId, station] of Object.entries(metro.stations)) {
    const metroHub = `M:${stationId}`;
    for (const [busStopId, busStop] of Object.entries(graph.stops)) {
      if (Object.prototype.hasOwnProperty.call(metro.stations, busStopId)) continue;

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
      metroWalkLinks,
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1]).replaceAll("\\", "/")).href) {
  const graph = JSON.parse(fs.readFileSync(GRAPH_FILE, "utf8"));
  const metro = JSON.parse(fs.readFileSync(METRO_FILE, "utf8"));
  const result = mergeMetroGraph(graph, metro);
  fs.writeFileSync(GRAPH_FILE, JSON.stringify(result.graph));
  console.log("Metro integration complete.");
  console.log(result.stats);
  console.log(`Total stops in graph: ${Object.keys(result.graph.stops).length}`);
  console.log(`Total adjacency nodes: ${Object.keys(result.graph.adj).length}`);
  console.log(`Graph written to: ${GRAPH_FILE}`);
  console.log("Metro fares and travel times are approximate historical/static estimates.");
}
