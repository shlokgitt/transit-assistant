import fs from "fs";

const G = JSON.parse(fs.readFileSync("./graph.json"));
const load = (f, fallback) => {
  try { return JSON.parse(fs.readFileSync(f)); } catch { return fallback; }
};
// Placeholder fare until data/fares.json (Shriyam) has real values.
const FARES = load("./data/fares.json", { bus: { boarding: 10 } });
const DELAYS = load("./data/delays.json", {});

const CROWD_PENALTY = 10; // extra "cost" minutes for boarding a crowded route when avoidCrowded is on

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

// "peak" = 8 to 11 and 17 to 20, otherwise "offpeak"
export function periodFor(date = new Date()) {
  const h = date.getHours();
  return (h >= 8 && h < 11) || (h >= 17 && h < 20) ? "peak" : "offpeak";
}

const r1 = (n) => Math.round(n * 10) / 10;
const stopOf = (node) => node.split(":")[1];
const nameOf = (id) => G.stops[id].name;

/**
 * fromIds / toIds: arrays of stop ids (one place name can match several stops)
 * opts.preference: "fastest" (default) or "cheapest"
 * opts.period: "peak" or "offpeak" (default: from the current time)
 * opts.avoidCrowded: steer away from routes marked crowded
 */
export function plan(fromIds, toIds, opts = {}) {
  const { preference = "fastest", period = periodFor(), avoidCrowded = false } = opts;
  const delays = DELAYS[period] || {};

  // Cost of one edge. "minutes" is real time shown to the user.
  // "w" is what Dijkstra minimises, which can differ (fare first, or a crowd penalty).
  const edgeCost = (type, base, route) => {
    const name = route ? G.routes[route] : null;
    const d = name ? delays[name] : null;
    let minutes = base, fare = 0, penalty = 0;
    if (type === "board") {
      fare = FARES.bus.boarding;
      if (d) {
        minutes += d.delayMin || 0;
        if (avoidCrowded && d.crowd === "high") penalty = CROWD_PENALTY;
      }
    }
    const w = (preference === "cheapest" ? fare * 1000 : 0) + minutes + penalty;
    return { w, minutes, fare };
  };

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
    for (const [v, base, type, route] of G.adj[u] || []) {
      const c = edgeCost(type, base, route);
      const nd = d + c.w;
      if (nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd);
        prev.set(v, [u, type, route, c.minutes, c.fare]);
        heap.push([nd, v]);
      }
    }
  }
  if (!end) return null;

  const edges = [];
  for (let cur = end; prev.has(cur); ) {
    const [u, type, route, minutes, fare] = prev.get(cur);
    edges.push({ from: u, to: cur, type, route, minutes, fare });
    cur = u;
  }
  edges.reverse();

  const legs = [];
  let leg = null, totalMinutes = 0, totalFare = 0;
  for (const e of edges) {
    totalMinutes += e.minutes;
    totalFare += e.fare;
    if (e.type === "walk") {
      legs.push({ mode: "walk", from: nameOf(stopOf(e.from)), to: nameOf(stopOf(e.to)), minutes: r1(e.minutes) });
    } else if (e.type === "board") {
      const name = G.routes[e.route];
      const d = delays[name];
      leg = {
        mode: "bus", route: name, from: nameOf(stopOf(e.from)), stops: 0,
        minutes: e.minutes, fare: e.fare,
        delayMin: d?.delayMin || 0, crowd: d?.crowd || "unknown",
      };
    } else if (e.type === "ride") {
      leg.stops++;
      leg.minutes += e.minutes;
    } else if (e.type === "alight") {
      leg.to = nameOf(stopOf(e.to));
      leg.minutes = r1(leg.minutes);
      legs.push(leg);
    }
  }
  return { preference, period, totalMinutes: r1(totalMinutes), totalFare, legs };
}

// Convenience wrapper for the API and the chat agent: takes place names, not ids.
export function planByName(fromName, toName, opts = {}) {
  const from = findStops(fromName), to = findStops(toName);
  if (!from.length) return { error: `No stop matches "${fromName}"` };
  if (!to.length) return { error: `No stop matches "${toName}"` };
  const route = plan(from.map((s) => s.id), to.map((s) => s.id), opts);
  if (!route) return { error: "No route found between those stops in the covered area" };
  return { fromMatches: from.length, toMatches: to.length, ...route };
}