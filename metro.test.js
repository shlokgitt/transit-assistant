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
    edge(graph, "R:B-KRB:Blue", ([to, , type]) => type === "ride"),
    ["R:B-RJP:Blue", 2, "ride", "metro:Blue"]
  );
  assert.ok(
    edge(graph, "R:B-RJP:Blue", ([to, , type]) => type === "ride") &&
      edge(graph, "R:B-RJP:Blue", ([to, , type]) => type === "ride")[0] === "R:B-KRB:Blue"
  );
  assert.equal(
    edge(graph, "R:V-KSG:Violet", ([, , type]) => type === "ride"),
    undefined,
    "incomplete Violet station data must not create a false direct ride"
  );
});

test("preserves metro interchanges and bus walking transfers", () => {
  const { graph } = mergeMetroGraph(baseGraph, metro);

  assert.ok(edge(graph, "M:Y-RJC", ([to, , type]) => to === "M:B-RJC" && type === "walk"));
  assert.ok(edge(graph, "M:B-RJC", ([to, , type]) => to === "M:Y-RJC" && type === "walk"));

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

  assert.deepEqual(busEdges(second), busEdges(first));
});
