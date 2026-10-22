import fs from "fs";

const G = JSON.parse(fs.readFileSync("./graph.json"));

// Min-heap so Dijkstra always takes the cheapest node next
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(x) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

export function findStops(query) {
  const q = query.toLowerCase();
  return Object.entries(G.stops)
    .filter(([, s]) => s.name.toLowerCase().includes(q))
    .map(([id, s]) => ({ id, ...s }));
}

const r1 = (n) => Math.round(n * 10) / 10;
const stopOf = (node) => node.split(":")[1];
const nameOf = (id) => G.stops[id].name;

// fromIds / toIds are arrays, because one place name can match several stops
export function plan(fromIds, toIds) {
  const dist = new Map(), prev = new Map(), heap = new Heap();
  const targets = new Set(toIds.map((i) => `S:${i}`));
  for (const i of fromIds) {
    dist.set(`S:${i}`, 0);
    heap.push([0, `S:${i}`]);
  }

  let end = null;
  while (heap.size) {
    const [d, u] = heap.pop();
    if (d > dist.get(u)) continue;
    if (targets.has(u)) { end = u; break; }
    for (const [v, cost, type, route] of G.adj[u] || []) {
      const nd = d + cost;
      if (nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd);
        prev.set(v, [u, type, route]);
        heap.push([nd, v]);
      }
    }
  }
  if (!end) return null;

  // walk back from the destination to rebuild the path
  const edges = [];
  for (let cur = end; prev.has(cur); ) {
    const [u, type, route] = prev.get(cur);
    edges.push({ from: u, to: cur, type, route });
    cur = u;
  }
  edges.reverse();

  // merge raw edges into readable legs
  const legs = [];
  let leg = null;
  for (const e of edges) {
    if (e.type === "walk") {
      legs.push({
        mode: "walk",
        from: nameOf(stopOf(e.from)),
        to: nameOf(stopOf(e.to)),
        minutes: r1(dist.get(e.to) - dist.get(e.from)),
      });
    } else if (e.type === "board") {
      leg = { mode: "bus", route: G.routes[e.route], from: nameOf(stopOf(e.from)), start: dist.get(e.from), stops: 0 };
    } else if (e.type === "ride") {
      leg.stops++;
    } else if (e.type === "alight") {
      leg.to = nameOf(stopOf(e.to));
      leg.minutes = r1(dist.get(e.to) - leg.start);
      delete leg.start;
      legs.push(leg);
    }
  }
  return { totalMinutes: r1(dist.get(end)), legs };
}