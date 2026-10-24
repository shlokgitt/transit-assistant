import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { mergeMetroGraph } from "./merge-metro.js";

const baseGraph = JSON.parse(fs.readFileSync("./graph.json", "utf8"));
const metro = JSON.parse(fs.readFileSync("./data/metro.json", "utf8"));

const edge = (graph, from, predicate) =>
  (graph.adj[from] || []).find(predicate);

test("builds only explicit metro ride connections", () => {
  const { graph } = mergeMetroGraph(baseGraph, metro);

  assert.deepEqual(
    edge(graph, "R:GTFS:96:Delhi3", ([to, , type]) => type === "ride"),
    ["R:GTFS:95:Delhi3", 1.97, "ride", "metro:Delhi3"]
  );
  assert.ok(
    (graph.adj["R:GTFS:95:Delhi3"] || []).some(
      ([to, , type]) => to === "R:GTFS:96:Delhi3" && type === "ride"
    )
  );
  assert.equal(
    edge(graph, "R:GTFS:8:Delhi6", ([to, , type]) => type === "ride")[0],
    "R:GTFS:160:Delhi6"
  );
});

test("preserves shared-station interchanges and bus walking transfers", () => {
  const { graph } = mergeMetroGraph(baseGraph, metro);

  const sharedHub = graph.adj["M:GTFS:50"] || [];
  assert.ok(sharedHub.some(([to, , type]) => to === "R:GTFS:50:Delhi2" && type === "board"));
  assert.ok(sharedHub.some(([to, , type]) => to === "R:GTFS:50:Delhi3" && type === "board"));

  const busWalk = Object.entries(graph.adj)
    .filter(([node]) => node.startsWith("S:"))
    .flatMap(([, edges]) => edges)
    .some(([to, , type]) => type === "walk" && to.startsWith("M:"));
  assert.ok(busWalk, "metro stations should retain bus walking transfers");
});

test("does not duplicate or damage bus edges when merged repeatedly", () => {
  const first = mergeMetroGraph(baseGraph, metro).graph;
  const second = mergeMetroGraph(first, metro).graph;

  assert.deepEqual(second, first);

  const busEdges = (graph) =>
    Object.entries(graph.adj).flatMap(([from, edges]) =>
      edges
        .filter(([to, , , route]) =>
          !from.startsWith("M:") &&
          !from.match(/^R:.*:(Yellow|Blue|Violet)$/) &&
          !to.startsWith("M:") &&
          !to.match(/^R:.*:(Yellow|Blue|Violet)$/) &&
          !String(route || "").startsWith("metro:")
        )
        .map((edge) => `${from}|${JSON.stringify(edge)}`)
    );

  assert.deepEqual(busEdges(first), busEdges(baseGraph));
  assert.deepEqual(busEdges(second), busEdges(first));
});
