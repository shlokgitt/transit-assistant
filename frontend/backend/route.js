import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculateMetroFare } from "./metro-fares.js";

function findAssetDir(filename) {
  const candidates = [
    path.join(process.cwd(), 'backend'),
    path.join(process.cwd(), 'frontend', 'backend'),
    path.dirname(fileURLToPath(import.meta.url)),
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'backend'),
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'backend'),
    process.cwd(),
    path.join(process.cwd(), '..'),
    path.join(process.cwd(), '..', 'backend'),
    path.join(process.cwd(), '..', 'frontend', 'backend'),
  ];
  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, filename))) return dir;
    } catch {}
  }
  for (const base of [process.cwd(), path.dirname(fileURLToPath(import.meta.url))]) {
    try {
      const entries = fs.readdirSync(base, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const sub = path.join(base, entry.name);
          if (fs.existsSync(path.join(sub, filename))) return sub;
        }
      }
    } catch {}
  }
  return path.dirname(fileURLToPath(import.meta.url));
}

const ROOT_DIR = findAssetDir('graph.json');
const resolveRoot = (file) => path.join(ROOT_DIR, file);
const G = JSON.parse(fs.readFileSync(resolveRoot("graph.json"), "utf8"));

const load = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(resolveRoot(file), "utf8"));
  } catch {
    return fallback;
  }
};

const FARES = load("./data/fares.json", {
  bus: {
    ordinary: [
      { maxKm: 4, fare: 5 },
      { maxKm: 10, fare: 10 },
      { maxKm: null, fare: 15 },
    ],
    ac: [
      { maxKm: 4, fare: 10 },
      { maxKm: 8, fare: 15 },
      { maxKm: 12, fare: 20 },
      { maxKm: null, fare: 25 },
    ],
  },
});

const DELAYS = load("./data/delays.json", {});
const PLACES = load("./data/ncr-places.json", []);

// Driving-road distances between consecutive GTFS stops, keyed "fromId>toId"
// (directional). Built by build-road-cache.js. Entries that failed to fetch
// are stored without a finite distanceKm and must be treated as missing.
const ROAD_DISTANCES = load("./data/road-distances.json", {});
// A cached road distance is trusted only if it is not meaningfully shorter
// than the straight-line distance AND either the extra distance is small in absolute terms or the
// ratio is modest. Road detours (one-ways, divided roads, U-turns) add a
// roughly fixed overhead, so a pure ratio cap wrongly rejects short hops.
// In the cache, ~96% of hops add <= 2.5 km; the rest (up to 16 km extra,
// up to 130x straight-line) are routing/snapping artifacts.
// A road path can be marginally shorter than the straight line (stops snapped
// to the road, 3-decimal rounding); only values well below it are rejected.
const ROAD_MIN_RATIO = 0.95;
const ROAD_MAX_EXCESS_KM = 2.5;
const ROAD_MAX_RATIO = 2;
// Metro fare distance cap for the bucketing state space.
// The highest metro slab boundary in the covered area is 21 km (well above
// any journey within the bounding box), but we cap at 32 to be safe.
const MAX_METRO_FARE_KM = 32.1;
const CROWD_PENALTY = 10;
const FARE_PRIORITY = 1000;
const UNKNOWN_FARE_PENALTY = 1_000_000_000;
const DISTANCE_BUCKET_KM = 0.1;
const MAX_FARE_DISTANCE_KM = 12.1;
// Walking routes do not have pedestrian geometry in the GTFS graph. Apply a
// conservative detour factor instead of presenting the straight-line distance
// as the distance a person will walk.
const WALKING_DETOUR_FACTOR = 1.25;

class Heap {
  constructor() {
    this.a = [];
  }

  get size() {
    return this.a.length;
  }

  push(item) {
    const a = this.a;
    a.push(item);
    let i = a.length - 1;

    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }

  pop() {
    const a = this.a;
    if (!a.length) return null;

    const top = a[0];
    const last = a.pop();

    if (a.length) {
      a[0] = last;
      let i = 0;

      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
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

const r1 = (n) => Math.round(n * 10) / 10;
const stopOf = (node) => {
  if (node.startsWith("R:")) {
    const body = node.slice(2);
    return body.slice(0, body.lastIndexOf(":"));
  }
  return node.slice(2);
};
const placeOf = (id) =>
  id?.startsWith("PLACE:") ? PLACES[Number(id.slice(6))] : null;
const nameOf = (id) => G.stops[id]?.name ?? placeOf(id)?.name ?? `Stop ${id}`;
const hubOf = (id) => (G.adj[`M:${id}`] ? `M:${id}` : `S:${id}`);

function distanceKm(a, b) {
  const from = G.stops[a] || placeOf(a);
  const to = G.stops[b] || placeOf(b);

  if (!from || !to) return 0;

  const rad = (deg) => (deg * Math.PI) / 180;
  const lat1 = rad(from.lat);
  const lat2 = rad(to.lat);
  const dLat = lat2 - lat1;
  const dLon = rad(to.lon - from.lon);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

/**
 * Distance for one bus hop between consecutive GTFS stops.
 * Uses the cached driving-road distance when it exists, is finite and passes
 * the plausibility guard; otherwise falls back to straight-line distance.
 * `source` is "road", "straight-line", or null for a zero-length same-stop hop.
 * Metro edges must not use this: metro stops are not in the road cache.
 */
export function busHopDistance(a, b, table = ROAD_DISTANCES) {
  if (a === b) return { km: 0, source: null };

  const straight = distanceKm(a, b);
  const road = table[`${a}>${b}`]?.distanceKm;

  if (
    Number.isFinite(road) &&
    road >= straight * ROAD_MIN_RATIO &&
    (road - straight <= ROAD_MAX_EXCESS_KM || road <= straight * ROAD_MAX_RATIO)
  ) {
    return { km: road, source: "road" };
  }

  return { km: straight, source: "straight-line" };
}

function combineSources(sources) {
  const s = new Set([...sources].filter(Boolean));
  if (s.size === 0) return null;
  return s.size === 1 ? [...s][0] : "mixed";
}

function metroFareClass(route) {
  if (route === "metro:NoidaAqua") return "noida_metro";
  if (route?.includes("Airport")) return "airport_express";
  if (route?.includes("Rapid")) return "rapid_metro";
  return "dmrc_standard";
}

function consolidateMetroFares(
  legs,
  totalFare,
  fareAvailable,
  fareEstimated,
  dayType
) {
  let adjustedFare = totalFare;
  let adjustedAvailable = fareAvailable;
  let adjustedEstimated = fareEstimated;

  for (let index = 0; index < legs.length; ) {
    if (legs[index].mode !== "metro") {
      index++;
      continue;
    }

    const fareClass = metroFareClass(legs[index].route);
    const group = [];
    let cursor = index;
    while (
      cursor < legs.length &&
      legs[cursor].mode === "metro" &&
      metroFareClass(legs[cursor].route) === fareClass
    ) {
      group.push(legs[cursor]);
      cursor++;
    }

    if (group.length > 1 && fareClass !== "rapid_metro") {
      const combinedDistance = group.reduce(
        (sum, leg) => sum + leg.distanceKm,
        0
      );
      const combinedStations = group.reduce(
        (sum, leg) => sum + leg.stops,
        0
      );
      const fare = calculateMetroFare(group[0].route, {
        fromName: group[0].from,
        toName: group.at(-1).to,
        stationCount: combinedStations,
        distanceKm: combinedDistance,
        dayType,
      });
      const previousFare = group.reduce((sum, leg) => sum + (leg.fare || 0), 0);

      if (fare.amount === null) {
        adjustedAvailable = false;
      } else {
        adjustedFare += fare.amount - previousFare;
        adjustedEstimated ||= fare.estimated;
        group.forEach((leg, groupIndex) => {
          leg.fare = groupIndex === 0 ? fare.amount : 0;
        });
      }
    }

    index = cursor;
  }

  return {
    totalFare: adjustedAvailable ? adjustedFare : null,
    fareAvailable: adjustedAvailable,
    fareEstimated: adjustedEstimated,
  };
}

function isMetroRoute(routeName) {
  return typeof routeName === "string" && routeName.startsWith("metro:");
}

function busType(routeName) {
  // Route-name classification is provisional; verify against operator data.
  if (isMetroRoute(routeName)) return "metro";
  return /AC/i.test(routeName || "") ? "ac" : "ordinary";
}

function fareForDistance(km, routeName) {
  const type = busType(routeName);
  const slabs = FARES.bus?.[type] ?? [];
  for (const slab of slabs) {
    if (slab.maxKm === null || km <= slab.maxKm) return slab.fare;
  }
  return null;
}

function distanceBucket(km, routeName) {
  // Bound the search state space. Metro fares change up to 32 km;
  // bus fares up to 12 km.
  const cap = isMetroRoute(routeName)
    ? Math.ceil(MAX_METRO_FARE_KM / DISTANCE_BUCKET_KM)
    : Math.ceil(MAX_FARE_DISTANCE_KM / DISTANCE_BUCKET_KM);
  return Math.min(Math.ceil(km / DISTANCE_BUCKET_KM), cap);
}

function stateKey(node, activeBus) {
  if (!activeBus) {
    return `${node}|walk`;
  }

  const bucket = distanceBucket(
    activeBus.distanceKm,
    activeBus.routeName
  );

  const stationCount =
    activeBus.routeId === "metro:NoidaAqua" ? activeBus.stationCount : 0;
  return `${node}|${activeBus.routeId}|${bucket}|${stationCount}`;
}

function normalizeQuery(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[-_./,()]/g, " ")
    .replace(/\bsectors?\b/g, "sec")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_ALIASES = {
  cp: ["GTFS:50"],
  "c.p.": ["GTFS:50"],
  "c p": ["GTFS:50"],
  "connaught place": ["GTFS:50"],
  connaught: ["GTFS:50"],
  "rajiv chowk": ["GTFS:50"],
  "noida sector 18": ["GTFS:82"],
  "noida sec 18": ["GTFS:82"],
  "sector 18 noida": ["GTFS:82"],
  "sec 18 noida": ["GTFS:82"],
  "sector 18": ["GTFS:82"],
  "sec 18": ["GTFS:82"],
  "noida sector 16": ["GTFS:83"],
  "noida sec 16": ["GTFS:83"],
  "sector 16 noida": ["GTFS:83"],
  "sec 16 noida": ["GTFS:83"],
  "noida sector 15": ["GTFS:84"],
  "noida sec 15": ["GTFS:84"],
  "sector 15 noida": ["GTFS:84"],
  "sec 15 noida": ["GTFS:84"],
  "noida sector 34": ["GTFS:233"],
  "noida sec 34": ["GTFS:233"],
  "sector 34 noida": ["GTFS:233"],
  "noida sector 52": ["GTFS:234"],
  "noida sec 52": ["GTFS:234"],
  "sector 52 noida": ["GTFS:234"],
  "noida sector 61": ["GTFS:235"],
  "noida sec 61": ["GTFS:235"],
  "sector 61 noida": ["GTFS:235"],
  "noida sector 59": ["GTFS:236"],
  "noida sec 59": ["GTFS:236"],
  "sector 59 noida": ["GTFS:236"],
  "noida sector 62": ["GTFS:237"],
  "noida sec 62": ["GTFS:237"],
  "sector 62 noida": ["GTFS:237"],
  ndls: ["GTFS:49"],
  "new delhi railway station": ["GTFS:49"],
  dli: ["GTFS:47"],
  "old delhi railway station": ["GTFS:47"],
  "huda city centre": ["GTFS:206"],
  "igi airport": ["GTFS:6"],
  "t3 airport": ["GTFS:6"],
  aiims: ["GTFS:183"],
  iit: ["GTFS:414"],
  "iit delhi": ["GTFS:414"],
};

export function findStops(query) {
  if (typeof query !== "string" || !query.trim()) return [];

  const qRaw = query.trim().toLowerCase();
  const qNorm = normalizeQuery(query);
  const qTokens = qNorm.split(" ").filter(Boolean);

  const results = [];
  const seen = new Set();

  const aliasIds = STOP_ALIASES[qRaw] || STOP_ALIASES[qNorm];
  if (aliasIds) {
    for (const id of aliasIds) {
      if (G.stops[id] && !seen.has(id)) {
        results.push({ id, ...G.stops[id] });
        seen.add(id);
      }
    }
  }

  const scoredTransit = [];
  for (const [id, stop] of Object.entries(G.stops)) {
    if (seen.has(id)) continue;
    const nameRaw = stop.name.toLowerCase();
    const nameNorm = normalizeQuery(stop.name);

    let score = 0;
    if (nameRaw === qRaw || nameNorm === qNorm) {
      score = 100;
    } else if (nameNorm.startsWith(qNorm) || nameRaw.startsWith(qRaw)) {
      score = 80;
    } else if (nameNorm.includes(qNorm)) {
      score = 60;
    } else if (qTokens.length > 1 && qTokens.every((t) => nameNorm.includes(t))) {
      score = 40;
    } else if (
      nameRaw.includes(qRaw) &&
      (qRaw.length > 3 || new RegExp(`\\b${qRaw}\\b`, "i").test(nameRaw))
    ) {
      score = 20;
    }

    if (score > 0) {
      if (id.startsWith("GTFS:") && stop.name.includes("Metro")) score += 5;
      scoredTransit.push({ score, stop: { id, ...stop } });
    }
  }

  const scoredPlaces = [];
  PLACES.forEach((place, index) => {
    const id = `PLACE:${index}`;
    const candidates = [place.name, ...(place.aliases || [])];
    let bestScore = 0;
    for (const name of candidates) {
      const nRaw = name.toLowerCase();
      const nNorm = normalizeQuery(name);
      let s = 0;
      if (nRaw === qRaw || nNorm === qNorm) s = 100;
      else if (nNorm.startsWith(qNorm) || nRaw.startsWith(qRaw)) s = 85;
      else if (nNorm.split(" ").some((w) => w.startsWith(qNorm) || (qTokens.length === 1 && w.startsWith(qTokens[0])))) s = 75;
      else if (qTokens.length > 1 && qTokens.every((t) => nNorm.includes(t) || nNorm.split(" ").some((w) => w.startsWith(t)))) s = 65;
      else if (nNorm.includes(qNorm) || nRaw.includes(qRaw)) s = 50;

      if (s > bestScore) bestScore = s;
    }
    if (bestScore > 0) {
      scoredPlaces.push({ score: bestScore, stop: { id, name: place.name, ...place, type: "place" } });
    }
  });

  const allScored = [...scoredTransit, ...scoredPlaces];
  allScored.sort((a, b) => b.score - a.score);
  for (const item of allScored) {
    if (!seen.has(item.stop.id)) {
      results.push(item.stop);
      seen.add(item.stop.id);
    }
  }

  if (results.length === 0) {
    const cleaned = query
      .replace(/,\s*(?:delhi ncr|new delhi|delhi|noida|gurugram|gurgaon|ghaziabad|faridabad|india)\b/gi, "")
      .replace(/\b(?:metro station|subway station|bus station|bus stand|bus stop|bus terminal|metro|station|terminal|isbt)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned && cleaned.toLowerCase() !== qRaw) {
      return findStops(cleaned);
    }
  }

  return results;
}

export function stopCoordinates(id) {
  const stop = G.stops[id] || placeOf(id);
  return stop ? { lat: stop.lat, lon: stop.lon } : null;
}

export function stopName(id) {
  return nameOf(id);
}

export function stopDetails(id) {
  const stop = G.stops[id] || placeOf(id);
  if (!stop) return null;

  const metroLines = new Set();
  if (placeOf(id)) {
    return {
      id,
      name: stop.name,
      type: "place",
      city: "delhi",
      lat: stop.lat,
      lng: stop.lon,
      lines: [],
    };
  }

  for (const edge of G.adj[`M:${id}`] || []) {
    if (edge[2] === "board" && G.routes[edge[3]]) {
      metroLines.add(G.routes[edge[3]].replace(/^metro:/, ""));
    }
  }

  return {
    id,
    name: stop.name,
    type: G.adj[`M:${id}`] ? "metro" : "bus",
    city: "delhi",
    lat: stop.lat,
    lng: stop.lon,
    lines: [...metroLines],
  };
}

function nearestTransitStop(place) {
  return Object.entries(G.stops).reduce((nearest, [id, stop]) => {
    const distance = distanceKm(place.id, id);
    return !nearest || distance < nearest.distance
      ? { id, stop, distance }
      : nearest;
  }, null);
}

function resolveEndpoint(matches) {
  const transitStop = matches.find((match) => G.stops[match.id]);
  if (transitStop) {
    return {
      match: transitStop,
      transitIds: matches
        .filter((match) => G.stops[match.id])
        .map((match) => match.id),
    };
  }

  const place = matches.find((match) => placeOf(match.id));
  const nearest = place ? nearestTransitStop(place) : null;
  return nearest
    ? { match: place, transitIds: [nearest.id], accessStop: nearest }
    : null;
}

function placeAccessLeg(place, accessStop, reverse = false) {
  const distance = r1(distanceKm(place.id, accessStop.id) * WALKING_DETOUR_FACTOR);
  const minutes = r1(distance * 12);
  return {
    mode: "walk",
    fromId: reverse ? accessStop.id : place.id,
    toId: reverse ? place.id : accessStop.id,
    from: reverse ? nameOf(accessStop.id) : place.name,
    to: reverse ? place.name : nameOf(accessStop.id),
    minutes,
    distanceKm: distance,
    distanceSource: "straight-line",
    fare: 0,
    stopIds: reverse ? [accessStop.id, place.id] : [place.id, accessStop.id],
    stops: 0,
  };
}

export function planWalkingByName(fromName, toName) {
  const fromMatches = findStops(fromName);
  const toMatches = findStops(toName);

  if (!fromMatches.length) {
    return { error: `No stop matches "${fromName}"` };
  }

  if (!toMatches.length) {
    return { error: `No stop matches "${toName}"` };
  }

  let best = null;

  for (const from of fromMatches) {
    for (const to of toMatches) {
      const km = distanceKm(from.id, to.id);
      if (!best || km < best.distanceKm) {
        best = { from, to, distanceKm: km };
      }
    }
  }

  if (!best) {
    return { error: "No walkable route found between those stops" };
  }

  const distance = r1(best.distanceKm * WALKING_DETOUR_FACTOR);
  const minutes = r1(distance * 12);

  return {
    fromMatches: fromMatches.length,
    toMatches: toMatches.length,
    totalMinutes: minutes,
    totalFare: 0,
    totalDistanceKm: distance,
    distanceSource: "straight-line",
    fareEstimate: false,
    fareAvailable: true,
    fareStatus: "verified",
    cheapestConfirmed: true,
    legs: [
      {
        mode: "walk",
        fromId: best.from.id,
        toId: best.to.id,
        from: best.from.name,
        to: best.to.name,
        minutes,
        distanceKm: distance,
        distanceSource: "straight-line",
        fare: 0,
        stopIds: [best.from.id, best.to.id],
        stops: 0,
      },
    ],
  };
}

export function planMetroByName(fromName, toName) {
  const fromMatches = findStops(fromName);
  const toMatches = findStops(toName);

  if (!fromMatches.length) return { error: `No stop matches "${fromName}"` };
  if (!toMatches.length) return { error: `No stop matches "${toName}"` };

  const metroStops = Object.entries(G.stops)
    .filter(([id]) => Boolean(G.adj[`M:${id}`]))
    .map(([id, stop]) => ({ id, ...stop }));

  const nearest = (matches) =>
    metroStops.reduce((best, metro) => {
      const candidate = matches.reduce((closest, stop) =>
        distanceKm(stop.id, metro.id) < distanceKm(stop.id, closest.id)
          ? stop
          : closest
      );
      if (!best || distanceKm(candidate.id, metro.id) < best.distance) {
        return { metro, distance: distanceKm(candidate.id, metro.id), stop: candidate };
      }
      return best;
    }, null);

  const origin = nearest(fromMatches);
  const destination = nearest(toMatches);
  if (!origin || !destination) {
    return { error: "No metro stations found near these stops" };
  }

  const transit = plan([origin.metro.id], [destination.metro.id], {
    preference: "fastest",
    period: "offpeak",
  });
  if (!transit || transit.legs.some((leg) => leg.mode === "bus")) {
    return { error: "No metro-only route found between those stops" };
  }

  const legs = [];
  if (origin.distance > 0) {
    legs.push({
      mode: "walk",
      fromId: origin.stop.id,
      toId: origin.metro.id,
      from: origin.stop.name,
      to: nameOf(origin.metro.id),
      minutes: r1(origin.distance * 12),
      distanceKm: r1(origin.distance),
      distanceSource: "straight-line",
      fare: 0,
      stopIds: [origin.stop.id, origin.metro.id],
      stops: 0,
    });
  }
  legs.push(...transit.legs);
  if (destination.distance > 0) {
    legs.push({
      mode: "walk",
      fromId: destination.metro.id,
      toId: destination.stop.id,
      from: nameOf(destination.metro.id),
      to: destination.stop.name,
      minutes: r1(destination.distance * 12),
      distanceKm: r1(destination.distance),
      distanceSource: "straight-line",
      fare: 0,
      stopIds: [destination.metro.id, destination.stop.id],
      stops: 0,
    });
  }

  return {
    totalMinutes: r1(legs.reduce((total, leg) => total + leg.minutes, 0)),
    totalFare: transit.totalFare,
    totalDistanceKm: r1(
      legs.reduce((total, leg) => total + (leg.distanceKm || 0), 0)
    ),
    distanceSource: legs.some((leg) => leg.distanceSource === "straight-line")
      ? "mixed"
      : transit.distanceSource,
    legs,
  };
}

export function periodFor(date = new Date()) {
  const hour = date.getHours();

  return (hour >= 8 && hour < 11) || (hour >= 17 && hour < 20)
    ? "peak"
    : "offpeak";
}

export function plan(fromIds, toIds, opts = {}) {
  const {
    preference = "fastest",
    period = periodFor(),
    avoidCrowded = false,
    dayType = "weekday",
  } = opts;

  if (!["fastest", "cheapest"].includes(preference)) {
    throw new Error('preference must be "fastest" or "cheapest"');
  }

  if (!["peak", "offpeak"].includes(period)) {
    throw new Error('period must be "peak" or "offpeak"');
  }

  const validFrom = fromIds.filter((id) => G.stops[id]);
  const validTo = toIds.filter((id) => G.stops[id]);

  if (!validFrom.length || !validTo.length) return null;

  const delays = DELAYS[period] || {};
  const targets = new Set(validTo.map(hubOf));

  const dist = new Map();
  const states = new Map();
  const prev = new Map();
  const heap = new Heap();

  function addState(node, activeBus, score, previousKey, edge) {
    const key = stateKey(node, activeBus);
    const old = dist.get(key);

    if (old !== undefined && old <= score) return;

    dist.set(key, score);
    states.set(key, { node, activeBus });
    prev.set(key, previousKey === null ? null : { key: previousKey, edge });
    heap.push([score, key]);
  }

  for (const id of validFrom) {
    addState(hubOf(id), null, 0, null, null);
  }

  let endKey = null;

  while (heap.size) {
    const [score, key] = heap.pop();

    if (score !== dist.get(key)) continue;

    const state = states.get(key);
    const { node, activeBus } = state;

    if (targets.has(node) && !activeBus) {
      endKey = key;
      break;
    }

    for (const edge of G.adj[node] || []) {
      const [nextNode, baseMinutes, type, routeId] = edge;

      let nextActive = activeBus;
      let minutes = baseMinutes;
      let fare = null;
      let fareEstimated = false;
      let legDistanceKm = 0;
      let distanceSource = null;
      let penalty = 0;
      // boardDelayMin is stored directly so the leg builder does not need to
      // back-compute it from (edge.minutes - BOARD), which would break if the
      // BOARD constant in build-graph.js ever changes.
      let boardDelayMin = 0;

      if (type === "board") {
        const routeName = G.routes[routeId];
        const delay = routeName ? delays[routeName] : null;

        boardDelayMin = delay?.delayMin || 0;
        minutes += boardDelayMin;

        if (avoidCrowded && delay?.crowd === "high") {
          penalty = CROWD_PENALTY;
        }

        nextActive = {
          routeId,
          routeName,
          boardStop: stopOf(node),
          distanceKm: 0,
          stationCount: 0,
        };
      } else if (type === "ride") {
        const fromStop = stopOf(node);
        const toStop = stopOf(nextNode);

        if (isMetroRoute(G.routes[routeId])) {
          legDistanceKm = distanceKm(fromStop, toStop);
          distanceSource = "straight-line";
        } else {
          ({ km: legDistanceKm, source: distanceSource } = busHopDistance(
            fromStop,
            toStop
          ));
        }

        if (activeBus) {
          nextActive = {
            ...activeBus,
            distanceKm: activeBus.distanceKm + legDistanceKm,
            stationCount:
              activeBus.routeId === "metro:NoidaAqua"
                ? activeBus.stationCount + 1
                : activeBus.stationCount,
          };
        }
      } else if (type === "alight") {
        if (activeBus) {
          if (isMetroRoute(activeBus.routeName)) {
            const metroFare = calculateMetroFare(
              activeBus.routeId,
              {
                fromName: nameOf(activeBus.boardStop),
                toName: nameOf(stopOf(nextNode)),
                stationCount: activeBus.stationCount,
                distanceKm: activeBus.distanceKm,
                dayType,
              }
            );
            fare = metroFare.amount;
            fareEstimated = metroFare.estimated;
          } else {
            fare = fareForDistance(activeBus.distanceKm, activeBus.routeName);
            fareEstimated = fare !== null;
          }
        }

        nextActive = null;
      } else if (type === "walk") {
        nextActive = null;
      }

      // Fare is charged when alighting, based on the distance ridden.
      // Cheapest prioritizes total fare, then travel time.
      const fareWeight =
        preference === "cheapest" && type === "alight"
          ? fare === null
            ? UNKNOWN_FARE_PENALTY
            : fare * FARE_PRIORITY
          : 0;
      const weight = minutes + penalty + fareWeight;

      const nextScore = score + weight;

      addState(
        nextNode,
        nextActive,
        nextScore,
        key,
        {
          from: node,
          to: nextNode,
          type,
          routeId,
          minutes,
          fare,
          fareEstimated,
          legDistanceKm,
          distanceSource,
          busDistanceKm:
            type === "alight" && activeBus
              ? activeBus.distanceKm
              : undefined,
          routeName: activeBus?.routeName,
          boardDelayMin,
          penalty,
        }
      );
    }
  }

  if (endKey === null) return null;

  const edges = [];

  for (let key = endKey; prev.get(key); ) {
    const previous = prev.get(key);
    edges.push(previous.edge);
    key = previous.key;
  }

  edges.reverse();

  const legs = [];
  let currentTransit = null;
  let currentSources = new Set();
  const routeSources = new Set();
  let totalMinutes = 0;
  let totalFare = 0;
  let totalDistanceKm = 0;
  let fareAvailable = true;
  let fareEstimated = false;

  for (const edge of edges) {
    totalMinutes += edge.minutes;

    if (edge.type === "walk") {
      legs.push({
        mode: "walk",
        fromId: stopOf(edge.from),
        toId: stopOf(edge.to),
        from: nameOf(stopOf(edge.from)),
        to: nameOf(stopOf(edge.to)),
        minutes: r1(edge.minutes),
      });
    } else if (edge.type === "board") {
      const routeName = G.routes[edge.routeId];
      const metro = isMetroRoute(routeName);
      currentSources = new Set();
      currentTransit = {
        mode: metro ? "metro" : "bus",
        route: G.routes[edge.routeId],
        fromId: stopOf(edge.from),
        toId: null,
        stopIds: [stopOf(edge.from)],
        from: nameOf(stopOf(edge.from)),
        to: null,
        stops: 0,
        minutes: edge.minutes,
        fare: 0,
        distanceKm: 0,
        delayMin: edge.boardDelayMin ?? Math.max(0, edge.minutes - 5),
        crowd: metro ? "unknown" : delays[routeName]?.crowd || "unknown",
        ...(metro ? {} : { busType: busType(routeName) }),
      };
    } else if (edge.type === "ride" && currentTransit) {
      currentTransit.stops++;
      currentTransit.minutes += edge.minutes;
      currentTransit.distanceKm += edge.legDistanceKm;
      currentTransit.stopIds.push(stopOf(edge.to));
      if (edge.distanceSource) currentSources.add(edge.distanceSource);
    } else if (edge.type === "alight" && currentTransit) {
      currentTransit.toId = stopOf(edge.to);
      currentTransit.to = nameOf(stopOf(edge.to));
      currentTransit.fare = edge.fare;
      if (edge.fare === null) fareAvailable = false;
      if (edge.fare !== null && edge.fareEstimated) fareEstimated = true;
      currentTransit.distanceKm = r1(currentTransit.distanceKm);
      currentTransit.distanceSource = combineSources(currentSources);
      if (currentTransit.distanceSource) {
        routeSources.add(currentTransit.distanceSource);
      }

      if (edge.fare !== null) totalFare += edge.fare;
      totalDistanceKm += currentTransit.distanceKm;

      currentTransit.minutes = r1(currentTransit.minutes);
      legs.push(currentTransit);
      currentTransit = null;
    }
  }

  const consolidatedFares = consolidateMetroFares(
    legs,
    totalFare,
    fareAvailable,
    fareEstimated,
    dayType
  );

  return {
    preference,
    period,
    totalMinutes: r1(totalMinutes),
    totalFare: consolidatedFares.totalFare,
    totalDistanceKm: r1(totalDistanceKm),
    distanceSource: combineSources(routeSources),
    fareEstimate:
      consolidatedFares.fareAvailable && consolidatedFares.fareEstimated,
    fareAvailable: consolidatedFares.fareAvailable,
    fareStatus: !consolidatedFares.fareAvailable
      ? "unavailable"
      : consolidatedFares.fareEstimated
        ? "estimated"
        : "verified",
    fareNote:
      "Bus fares are estimates. Metro fares are available only for supported fare tables and reliable route calculations. Cheapest mode excludes unknown fares from confirmed cost comparisons.",
    cheapestConfirmed:
      preference !== "cheapest" ||
      (consolidatedFares.fareAvailable && !consolidatedFares.fareEstimated),
    legs,
  };
}

export function planByName(fromName, toName, opts = {}) {
  const from = findStops(fromName);
  const to = findStops(toName);

  if (!from.length) {
    return { error: `No stop matches "${fromName}"` };
  }

  if (!to.length) {
    return { error: `No stop matches "${toName}"` };
  }

  const resolvedFrom = resolveEndpoint(from);
  const resolvedTo = resolveEndpoint(to);
  if (!resolvedFrom || !resolvedTo) {
    return { error: "No usable transit points found for those places" };
  }

  const route = plan(resolvedFrom.transitIds, resolvedTo.transitIds, opts);

  if (!route) {
    return {
      error: "No route found between those stops in the covered area",
    };
  }

  const legs = [...route.legs];
  if (resolvedFrom.accessStop) {
    legs.unshift(
      placeAccessLeg(
        resolvedFrom.match,
        resolvedFrom.accessStop
      )
    );
  }
  if (resolvedTo.accessStop) {
    legs.push(
      placeAccessLeg(
        resolvedTo.match,
        resolvedTo.accessStop,
        true
      )
    );
  }

  const accessMinutes = legs.reduce((total, leg) => total + leg.minutes, 0);
  const accessDistance = legs.reduce(
    (total, leg) => total + (leg.distanceKm || 0),
    0
  );

  return {
    fromMatches: from.length,
    toMatches: to.length,
    ...route,
    totalMinutes: r1(accessMinutes),
    totalDistanceKm: r1(accessDistance),
    distanceSource: combineSources(
      legs.map((leg) => leg.distanceSource)
    ),
    legs,
  };
}

export function evaluateRouteConstraints(route, constraints = {}, defaultDeparture = "08:15") {
  if (!route || !constraints || typeof constraints !== "object") {
    return {
      satisfied: true,
      satisfiesAll: true,
      violations: [],
      budgetSatisfied: null,
      walkingSatisfied: null,
      transfersSatisfied: null,
      deadlineSatisfied: null,
    };
  }

  const violations = [];
  let budgetSatisfied = null;
  let walkingSatisfied = null;
  let transfersSatisfied = null;
  let deadlineSatisfied = null;

  if (constraints.maxBudget !== undefined && constraints.maxBudget !== null && !isNaN(Number(constraints.maxBudget))) {
    const maxB = Number(constraints.maxBudget);
    const fare = route.totalFare ?? 0;
    if (fare > maxB) {
      budgetSatisfied = false;
      violations.push(`Fare of ₹${fare} exceeds maximum budget of ₹${maxB}`);
    } else {
      budgetSatisfied = true;
    }
  }

  if (constraints.maxWalkingDistanceMeters !== undefined && constraints.maxWalkingDistanceMeters !== null && !isNaN(Number(constraints.maxWalkingDistanceMeters))) {
    const maxWalk = Number(constraints.maxWalkingDistanceMeters);
    let totalWalkMeters = 0;
    for (const leg of (route.legs || [])) {
      if (leg.mode === "walk") {
        const km = Number(leg.distanceKm) || ((Number(leg.minutes) || 0) * 0.072);
        totalWalkMeters += Math.round(km * 1000);
      }
    }
    if (totalWalkMeters > maxWalk) {
      walkingSatisfied = false;
      violations.push(`Walking distance (${totalWalkMeters}m) exceeds limit of ${maxWalk}m`);
    } else {
      walkingSatisfied = true;
    }
  }

  if (constraints.maxTransfers !== undefined && constraints.maxTransfers !== null && !isNaN(Number(constraints.maxTransfers))) {
    const maxT = Number(constraints.maxTransfers);
    const vehicleLegs = (route.legs || []).filter(l => l.mode === "metro" || l.mode === "bus" || l.mode === "auto");
    const transfers = Math.max(0, vehicleLegs.length - 1);
    if (transfers > maxT) {
      transfersSatisfied = false;
      violations.push(`Transfers (${transfers}) exceeds allowed maximum of ${maxT}`);
    } else {
      transfersSatisfied = true;
    }
  }

  if (constraints.requiredArrivalTime && typeof constraints.requiredArrivalTime === "string") {
    const reqMatch = /^(\d{1,2}):(\d{2})$/.exec(constraints.requiredArrivalTime.trim());
    if (reqMatch) {
      const reqMins = Number(reqMatch[1]) * 60 + Number(reqMatch[2]);
      const depStr = constraints.departureTime || defaultDeparture;
      const depMatch = /^(\d{1,2}):(\d{2})$/.exec(String(depStr).trim());
      const depMins = depMatch ? Number(depMatch[1]) * 60 + Number(depMatch[2]) : 8 * 60 + 15;
      const arrivalMins = depMins + Math.ceil(route.totalMinutes || 0);

      const arrHour = Math.floor(arrivalMins / 60) % 24;
      const arrMin = arrivalMins % 60;
      const arrStr = `${String(arrHour).padStart(2, "0")}:${String(arrMin).padStart(2, "0")}`;

      if (arrivalMins > reqMins) {
        deadlineSatisfied = false;
        const diff = arrivalMins - reqMins;
        violations.push(`Estimated arrival (${arrStr}) misses deadline (${constraints.requiredArrivalTime}) by ${diff} min`);
      } else {
        deadlineSatisfied = true;
      }
    }
  }

  if (constraints.avoidCrowded) {
    const hasCrowdedLeg = (route.legs || []).some(l => l.crowd === "high");
    if (hasCrowdedLeg) {
      violations.push("Route passes through crowded sections during peak period");
    }
  }

  return {
    satisfied: violations.length === 0,
    satisfiesAll: violations.length === 0,
    violations,
    budgetSatisfied,
    walkingSatisfied,
    transfersSatisfied,
    deadlineSatisfied,
  };
}

export function calculateRouteReliability(route, scenario = null) {
  if (!route) return null;

  const legs = route.legs || [];
  const vehicleLegs = legs.filter(l => l.mode === "metro" || l.mode === "bus" || l.mode === "auto");
  const transferCount = Math.max(0, vehicleLegs.length - 1);

  let potentialDelayImpactMinutes = 0;
  for (const leg of legs) {
    if (leg.delayMin && Number(leg.delayMin) > 0) {
      potentialDelayImpactMinutes += Number(leg.delayMin);
    }
  }

  const transferBufferMinutes = transferCount === 0 ? 0 : 5;
  const scheduledDurationMinutes = Math.max(1, Math.round((route.totalMinutes || 0) - potentialDelayImpactMinutes));
  const estimatedTotalDurationMinutes = Math.round(route.totalMinutes || 0);

  let score = 98;
  if (transferCount === 0) {
    score += 1;
  } else if (transferCount === 1) {
    score -= 6;
  } else {
    score -= 14;
  }

  if (potentialDelayImpactMinutes > 0) {
    score -= Math.min(30, Math.round(potentialDelayImpactMinutes * 1.5));
  }

  if (legs.some(l => l.crowd === "high")) {
    score -= 8;
  }

  score = Math.max(35, Math.min(98, score));

  let reliabilityBand = "High";
  if (score < 70) reliabilityBand = "Low";
  else if (score < 85) reliabilityBand = "Moderate";

  const confidenceLevel = scenario ? "simulated" : (route.fareStatus === "verified" ? "high" : "medium");

  return {
    scheduledDurationMinutes,
    estimatedTotalDurationMinutes,
    transferBufferMinutes,
    potentialDelayImpactMinutes,
    delayExposureScore: potentialDelayImpactMinutes,
    confidenceLevel,
    reliabilityPercentage: score,
    reliabilityBand,
    transferCount,
    isSimulated: confidenceLevel === "simulated",
  };
}

export function generateRouteExplanation(route, constraints = {}, scenario = null, isAlternative = false, baselineRoute = null) {
  if (!route) return "";

  const rel = route.reliabilityDetails || calculateRouteReliability(route, scenario);
  const evalResult = route.constraintsEvaluation || evaluateRouteConstraints(route, constraints);
  const hasConstraints = constraints && Object.keys(constraints).some(k => constraints[k] !== undefined && constraints[k] !== null && constraints[k] !== false);

  if (isAlternative && baselineRoute && scenario) {
    const diff = Math.round(baselineRoute.totalMinutes - route.totalMinutes);
    if (diff > 0) {
      return `Simulated Disruption Recovery: Bypasses the delayed service, saving ~${diff} min compared to the disrupted route.`;
    }
    return `Disruption Alternative: Uses alternate lines to avoid the simulated disruption on ${baselineRoute.title || "the primary route"}.`;
  }

  if (hasConstraints && evalResult.satisfied) {
    const parts = [];
    if (constraints.requiredArrivalTime) parts.push(`arrives before ${constraints.requiredArrivalTime}`);
    if (constraints.maxBudget) parts.push(`within ₹${constraints.maxBudget} budget`);
    if (constraints.maxWalkingDistanceMeters) parts.push("low walking");
    return `Recommended: Meets all constraints (${parts.join(", ")}) with ${rel.reliabilityBand.toLowerCase()} reliability (${rel.reliabilityPercentage}%).`;
  }

  if (hasConstraints && !evalResult.satisfied) {
    const topViolation = evalResult.violations[0];
    return `Closest match: ${topViolation}, but provides optimal travel time (~${route.totalMinutes} min).`;
  }

  if (rel.transferCount === 0) {
    return `Recommended for reliability: Direct route (~${route.totalMinutes} min) with no transfers, eliminating missed connection risks.`;
  }
  if (route.tag === "FASTEST") {
    return `Fastest option: Reaches destination in ~${route.totalMinutes} min with ${rel.reliabilityPercentage}% reliability.`;
  }
  if (route.tag === "CHEAPEST") {
    return `Most economical option: Total fare ₹${route.totalFare ?? 0} with ~${route.totalMinutes} min journey time.`;
  }
  return `Balanced journey: ~${route.totalMinutes} min travel time, ${rel.transferCount} transfer, and ${rel.reliabilityPercentage}% reliability score.`;
}
