import fs from "node:fs";
import path from "node:path";

type RouteMeta = {
  id: string;
  name: string;
  shortName?: string;
};

type StopTime = {
  stopId: string;
  arrival: string;
  departure: string;
  sequence: number;
};

type Trip = {
  routeId: string;
  tripId: string;
  stops: StopTime[];
};

export type ScheduledBusTiming = {
  source: "static_gtfs";
  routeId: string;
  routeName: string;
  fromStop: string;
  toStop: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  note: string;
};

let scheduleCache: {
  routes: Map<string, RouteMeta>;
  trips: Trip[];
} | null = null;

function dataPath(filename: string): string {
  const candidates = [
    path.join(process.cwd(), "..", "gtfs"),
    path.join(process.cwd(), "gtfs"),
    path.join(process.cwd(), "..", "gtfs-raw"),
  ];
  const directory = candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, filename))
  );
  if (!directory) {
    throw new Error(`Static GTFS file not found: ${filename}`);
  }
  return path.join(directory, filename);
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function loadSchedule() {
  if (scheduleCache) return scheduleCache;

  const routeLines = fs.readFileSync(dataPath("routes.txt"), "utf8").split(/\r?\n/);
  const routeHeader = parseCsvLine(routeLines.shift() || "");
  const routeIndex = Object.fromEntries(routeHeader.map((key, index) => [key, index]));
  const routes = new Map<string, RouteMeta>();
  for (const line of routeLines) {
    if (!line.trim()) continue;
    const row = parseCsvLine(line);
    const id = row[routeIndex.route_id];
    if (!id) continue;
    routes.set(id, {
      id,
      name: row[routeIndex.route_long_name] || row[routeIndex.route_short_name] || id,
      shortName: row[routeIndex.route_short_name] || undefined,
    });
  }

  const tripLines = fs.readFileSync(dataPath("trips.txt"), "utf8").split(/\r?\n/);
  const tripHeader = parseCsvLine(tripLines.shift() || "");
  const tripIndex = Object.fromEntries(tripHeader.map((key, index) => [key, index]));
  const tripsById = new Map<string, Trip>();
  const routeTrips = new Map<string, Trip[]>();
  for (const line of tripLines) {
    if (!line.trim()) continue;
    const row = parseCsvLine(line);
    const routeId = row[tripIndex.route_id];
    const tripId = row[tripIndex.trip_id];
    if (!routeId || !tripId) continue;
    const trip = { routeId, tripId, stops: [] };
    tripsById.set(tripId, trip);
    const trips = routeTrips.get(routeId) || [];
    trips.push(trip);
    routeTrips.set(routeId, trips);
  }

  const stopLines = fs.readFileSync(dataPath("stop_times.txt"), "utf8").split(/\r?\n/);
  const stopHeader = parseCsvLine(stopLines.shift() || "");
  const stopIndex = Object.fromEntries(stopHeader.map((key, index) => [key, index]));
  for (const line of stopLines) {
    if (!line.trim()) continue;
    const row = parseCsvLine(line);
    const trip = tripsById.get(row[stopIndex.trip_id]);
    if (!trip) continue;
    trip.stops.push({
      stopId: row[stopIndex.stop_id],
      arrival: row[stopIndex.arrival_time],
      departure: row[stopIndex.departure_time],
      sequence: Number(row[stopIndex.stop_sequence]),
    });
  }

  scheduleCache = { routes, trips: [...routeTrips.values()].flat() };
  return scheduleCache;
}

function minutesSinceMidnight(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function currentIndiaMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  return Number(parts.find((part) => part.type === "hour")?.value || 0) * 60 +
    Number(parts.find((part) => part.type === "minute")?.value || 0);
}

function normalizeRouteId(routeId: string): string {
  return routeId.replace(/^bus:/i, "").replace(/^B/i, "");
}

export function getScheduledBusTiming(
  routeId: string,
  fromStopId: string,
  toStopId: string
): ScheduledBusTiming | null {
  const schedule = loadSchedule();
  const requestedRoute = normalizeRouteId(routeId);
  const matchingRoute = [...schedule.routes.values()].find(
    (route) =>
      route.id === requestedRoute ||
      route.name.toLowerCase() === requestedRoute.toLowerCase() ||
      route.shortName?.toLowerCase() === requestedRoute.toLowerCase()
  );
  const normalizedRouteId = matchingRoute?.id || requestedRoute;
  const candidates = schedule.trips
    .filter((trip) => trip.routeId === normalizedRouteId)
    .map((trip) => {
      const from = trip.stops.find((stop) => stop.stopId === fromStopId);
      const to = trip.stops.find(
        (stop) => stop.stopId === toStopId && (!from || stop.sequence > from.sequence)
      );
      if (!from || !to) return null;
      return { trip, from, to };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
  if (!candidates.length) return null;

  const now = currentIndiaMinutes();
  const upcoming = candidates
    .filter((candidate) => minutesSinceMidnight(candidate.from.departure) >= now)
    .sort(
      (a, b) =>
        minutesSinceMidnight(a.from.departure) -
        minutesSinceMidnight(b.from.departure)
    )[0] || candidates.sort(
      (a, b) =>
        minutesSinceMidnight(a.from.departure) -
        minutesSinceMidnight(b.from.departure)
    )[0];
  if (!upcoming) return null;

  const departureMinutes = minutesSinceMidnight(upcoming.from.departure);
  const arrivalMinutes = minutesSinceMidnight(upcoming.to.arrival);
  return {
    source: "static_gtfs",
    routeId: normalizedRouteId,
    routeName:
      matchingRoute?.name ||
      schedule.routes.get(normalizedRouteId)?.name ||
      requestedRoute,
    fromStop: fromStopId,
    toStop: toStopId,
    departureTime: upcoming.from.departure,
    arrivalTime: upcoming.to.arrival,
    durationMinutes: Math.max(0, arrivalMinutes - departureMinutes),
    note:
      departureMinutes >= now
        ? "Scheduled GTFS time; live delays may change this."
        : "Next scheduled trip is tomorrow; live delays may change this.",
  };
}
