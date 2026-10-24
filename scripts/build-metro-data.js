import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "csv-parse/sync";

const DEFAULT_INPUT = "./metro";
const DEFAULT_OUTPUT = "./data/metro.json";
const MINUTES_PER_DAY = 24 * 60;

export function parseCsv(text) {
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
  });
}

function readCsv(inputDir, fileName, required = true) {
  const file = path.join(inputDir, fileName);
  if (!fs.existsSync(file)) {
    if (required) throw new Error(`Missing required GTFS file: ${file}`);
    return [];
  }
  return parseCsv(fs.readFileSync(file, "utf8"));
}

function finiteCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

function parseTime(value) {
  if (typeof value !== "string" || !/^\d{1,3}:\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [hours, minutes, seconds] = value.split(":").map(Number);
  if (minutes > 59 || seconds > 59) return null;
  return hours * 60 + minutes + seconds / 60;
}

function elapsedMinutes(from, to) {
  const start = parseTime(from);
  const end = parseTime(to);
  if (start === null || end === null) return null;
  return end >= start ? end - start : end + MINUTES_PER_DAY - start;
}

function stationId(stopId) {
  return `GTFS:${stopId}`;
}

function routeId(route) {
  return `gtfs:${route.route_id}`;
}

function rounded(value) {
  return Math.round(value * 100) / 100;
}

function buildConnections(route, tripsById, stopById) {
  const pairStats = new Map();
  const routeTrips = route.tripIds
    .map((tripId) => tripsById.get(tripId))
    .filter(Boolean);

  for (const trip of routeTrips) {
    const rows = [...trip.stopTimes].sort(
      (a, b) => Number(a.stop_sequence) - Number(b.stop_sequence)
    );

    for (let i = 0; i < rows.length - 1; i++) {
      const from = rows[i];
      const to = rows[i + 1];
      const fromStop = stopById.get(from.stop_id);
      const toStop = stopById.get(to.stop_id);
      if (!fromStop || !toStop) continue;
      if (fromStop.canonicalId === toStop.canonicalId) continue;

      const minutes = elapsedMinutes(
        from.departure_time || from.arrival_time,
        to.arrival_time || to.departure_time
      );
      if (minutes === null || minutes <= 0 || minutes > 180) continue;

      const key = `${fromStop.canonicalId}>${toStop.canonicalId}`;
      const stats = pairStats.get(key) || {
        from: fromStop.canonicalId,
        to: toStop.canonicalId,
        sum: 0,
        count: 0,
      };
      stats.sum += minutes;
      stats.count++;
      pairStats.set(key, stats);
    }
  }

  return [...pairStats.values()].map((connection) => [
    stationId(connection.from),
    stationId(connection.to),
    rounded(connection.sum / connection.count),
  ]);
}

export function buildMetroData(inputDir = DEFAULT_INPUT) {
  const agencies = readCsv(inputDir, "agency.txt", false);
  const routes = readCsv(inputDir, "routes.txt");
  const stops = readCsv(inputDir, "stops.txt");
  const trips = readCsv(inputDir, "trips.txt");
  const stopTimes = readCsv(inputDir, "stop_times.txt");
  const calendar = readCsv(inputDir, "calendar.txt", false);

  const validStops = stops.filter((stop) =>
    finiteCoordinate(stop.stop_lat, -90, 90) &&
    finiteCoordinate(stop.stop_lon, -180, 180)
  );
  const rawStopById = new Map(validStops.map((stop) => [stop.stop_id, stop]));
  const canonicalStops = new Map();
  const stopById = new Map();

  for (const stop of validStops) {
    const parentId =
      stop.parent_station && rawStopById.has(stop.parent_station)
        ? stop.parent_station
        : stop.stop_id;
    const parent = rawStopById.get(parentId) || stop;
    if (!canonicalStops.has(parentId)) canonicalStops.set(parentId, parent);
    stopById.set(stop.stop_id, {
      canonicalId: parentId,
      stop: parent,
    });
  }
  const stopTimesByTrip = new Map();

  for (const row of stopTimes) {
    if (!stopTimesByTrip.has(row.trip_id)) stopTimesByTrip.set(row.trip_id, []);
    stopTimesByTrip.get(row.trip_id).push(row);
  }

  const tripsById = new Map(
    trips.map((trip) => [
      trip.trip_id,
      { ...trip, stopTimes: stopTimesByTrip.get(trip.trip_id) || [] },
    ])
  );
  const routeRecords = routes.map((route) => ({
    ...route,
    tripIds: trips
      .filter((trip) => trip.route_id === route.route_id)
      .map((trip) => trip.trip_id),
  }));

  const stationRoutes = new Map();
  for (const route of routeRecords) {
    for (const tripId of route.tripIds) {
      for (const row of tripsById.get(tripId)?.stopTimes || []) {
        const canonical = stopById.get(row.stop_id)?.canonicalId;
        if (!canonical) continue;
        if (!stationRoutes.has(canonical)) stationRoutes.set(canonical, new Set());
        stationRoutes.get(canonical).add(route.route_id);
      }
    }
  }

  const stations = Object.fromEntries(
    [...canonicalStops.entries()].map(([canonicalId, stop]) => [
      stationId(canonicalId),
      {
        name: stop.stop_name,
        lat: Number(stop.stop_lat),
        lon: Number(stop.stop_lon),
        gtfsStopId: canonicalId,
        routeIds: [...(stationRoutes.get(canonicalId) || [])],
      },
    ])
  );

  const lines = routeRecords.map((route) => ({
    id: route.route_id,
    name: route.route_long_name || route.route_short_name || route.route_id,
    shortName: route.route_short_name || route.route_id,
    color: route.route_color ? `#${route.route_color}` : null,
    connections: buildConnections(route, tripsById, stopById),
  }));

  const usedStopIds = new Set(
    lines.flatMap((line) =>
      line.connections.flatMap(([from, to]) => [from.slice(5), to.slice(5)])
    )
  );
  const unusedStops = Object.keys(stations).filter(
    (id) => !usedStopIds.has(id.slice(5))
  );

  return {
    note:
      "Generated from the extracted DMRC GTFS feed in metro/. " +
      "Coverage and schedules are historical; calendar data ends 2025-12-31. " +
      "GTFS does not provide fare data in this feed. Shared GTFS stop IDs " +
      "share a hub and act as conservative interchanges.",
    source: {
      agency: agencies[0]?.agency_name || "Unknown",
      agencyUrl: agencies[0]?.agency_url || null,
      timezone: agencies[0]?.agency_timezone || null,
      calendar,
      inputDirectory: inputDir,
    },
    fareSlabs: [],
    fareNote: "No fare data is provided by this GTFS feed.",
    boardingMinutes: 3,
    stations,
    lines,
    interchanges: [],
    stats: {
      sourceStops: stops.length,
      validStops: validStops.length,
      routes: routes.length,
      trips: trips.length,
      stopTimes: stopTimes.length,
      unusedStops: unusedStops.length,
    },
  };
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  const inputDir = process.argv[2] || DEFAULT_INPUT;
  const outputFile = process.argv[3] || DEFAULT_OUTPUT;
  const data = buildMetroData(inputDir);
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
  console.log({
    inputDir,
    outputFile,
    stations: Object.keys(data.stations).length,
    lines: data.lines.length,
    connections: data.lines.reduce((sum, line) => sum + line.connections.length, 0),
    ...data.stats,
  });
}
