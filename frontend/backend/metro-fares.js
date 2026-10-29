import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const METRO_FARES_DIR = path.join(ROOT_DIR, "data", "metro-fares");

const DMRC_COLUMNS = [
  "min_km_inclusive",
  "max_km_exclusive",
  "weekday_fare_inr",
  "sunday_holiday_fare_inr",
  "time_limit_minutes",
];
const NOIDA_COLUMNS = [
  "stations_min",
  "stations_max",
  "weekday_fare_inr",
  "sunday_holiday_fare_inr",
];
const DAY_TYPES = new Set(["weekday", "sunday_holiday"]);
const DMRC_ROUTE_IDS = new Set(
  Array.from({ length: 9 }, (_, index) => `Delhi${index + 1}`)
);
const AIRPORT_ROUTE_ID = "DelhiAirport";
const NOIDA_ROUTE_ID = "NoidaAqua";
const RAPID_ROUTE_ID = "Gurgaon1";

function readCsv(file, expectedColumns) {
  const text = fs.readFileSync(file, "utf8");
  const header = parse(text, {
    bom: true,
    to_line: 1,
    relax_column_count: false,
  })[0] || [];
  if (
    header.length !== expectedColumns.length ||
    header.some((column, index) => column !== expectedColumns[index])
  ) {
    throw new Error(
      `Invalid columns in ${file}; expected ${expectedColumns.join(",")}`
    );
  }
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: false,
  });
}

function readCsvHeader(file) {
  return parse(fs.readFileSync(file, "utf8"), {
    bom: true,
    to_line: 1,
    relax_column_count: false,
  })[0] || [];
}

function finiteNumber(value, field) {
  if (value === "") {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return number;
}

function fareAmount(value, field) {
  const number = finiteNumber(value, field);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return number;
}

function boundedInteger(value, field, { allowBlank = false } = {}) {
  if (allowBlank && value === "") return null;
  const number = finiteNumber(value, field);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return number;
}

function fareTable(rows, label) {
  return rows.map((row) => ({
    min: boundedInteger(row.stations_min, `${label} stations_min`),
    max: boundedInteger(row.stations_max, `${label} stations_max`, {
      allowBlank: true,
    }),
    weekday: fareAmount(row.weekday_fare_inr, `${label} weekday fare`),
    holiday: fareAmount(row.sunday_holiday_fare_inr, `${label} holiday fare`),
  }));
}

function stationKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\s+metro\b/g, "")
    .replace(/sector\s*-\s*/g, "sector ")
    .replace(/[^a-z0-9]/g, "");
}

export function validateMetroFareData(data) {
  if (!Array.isArray(data.dmrcStandard) || !data.dmrcStandard.length) {
    throw new Error("DMRC standard fare table is empty");
  }
  if (!Array.isArray(data.noidaMetro) || !data.noidaMetro.length) {
    throw new Error("Noida Metro fare table is empty");
  }
  if (!(data.airportExpress instanceof Map) || !data.airportExpress.size) {
    throw new Error("Airport Express fare matrix is empty");
  }

  let previousDmrcMax = null;
  let dmrcOpenEnded = false;
  for (const [index, row] of data.dmrcStandard.entries()) {
    if (
      !Number.isFinite(row.min) ||
      (row.max !== null && !Number.isFinite(row.max)) ||
      row.min < 0 ||
      (row.max !== null && row.max <= row.min)
    ) {
      throw new Error(`Invalid DMRC fare range at row ${index + 1}`);
    }
    if (index === 0 && row.min !== 0) {
      throw new Error("DMRC fare ranges must start at 0 km");
    }
    if (dmrcOpenEnded) {
      throw new Error("DMRC fare ranges continue after an open-ended range");
    }
    if (previousDmrcMax !== null && row.min !== previousDmrcMax) {
      throw new Error("DMRC fare ranges are missing or overlapping");
    }
    previousDmrcMax = row.max;
    dmrcOpenEnded = row.max === null;
    for (const [name, amount] of [
      ["weekday", row.weekday],
      ["holiday", row.holiday],
    ]) {
      fareAmount(amount, `DMRC ${name} fare`);
    }
    if (row.timeLimit !== null) {
      boundedInteger(row.timeLimit, "DMRC time limit");
    }
  }
  if (!dmrcOpenEnded) {
    throw new Error("DMRC fare ranges must include an open-ended final range");
  }

  let previousNoidaMax = null;
  let noidaOpenEnded = false;
  for (const [index, row] of data.noidaMetro.entries()) {
    if (
      !Number.isInteger(row.min) ||
      row.min < 1 ||
      (row.max !== null &&
        (!Number.isInteger(row.max) || row.max < row.min))
    ) {
      throw new Error(`Invalid Noida fare range at row ${index + 1}`);
    }
    if (index === 0 && row.min !== 1) {
      throw new Error("Noida fare ranges must start at 1 station");
    }
    if (noidaOpenEnded) {
      throw new Error("Noida fare ranges continue after an open-ended range");
    }
    if (
      previousNoidaMax !== null &&
      row.min !== previousNoidaMax + 1
    ) {
      throw new Error("Noida fare ranges are missing or overlapping");
    }
    previousNoidaMax = row.max;
    noidaOpenEnded = row.max === null;
    fareAmount(row.weekday, "Noida weekday fare");
    fareAmount(row.holiday, "Noida holiday fare");
  }
  if (!noidaOpenEnded) {
    throw new Error("Noida fare ranges must include an open-ended final range");
  }

  if (
    !(data.airportStations instanceof Set) ||
    data.airportStations.size === 0 ||
    data.airportExpress.size !== data.airportStations.size ** 2
  ) {
    throw new Error("Airport Express fare matrix is incomplete");
  }
  for (const from of data.airportStations) {
    for (const to of data.airportStations) {
      const forward = data.airportExpress.get(`${from}\u0000${to}`);
      const reverse = data.airportExpress.get(`${to}\u0000${from}`);
      if (forward === undefined || reverse === undefined) {
        throw new Error("Airport Express fare matrix is missing an entry");
      }
      fareAmount(forward, `Airport Express fare ${from} -> ${to}`);
      fareAmount(reverse, `Airport Express fare ${to} -> ${from}`);
      if (forward !== reverse) {
        throw new Error("Airport Express fare matrix is not symmetric");
      }
    }
  }
}

export function loadMetroFareData(directory = METRO_FARES_DIR) {
  const dmrcRows = readCsv(
    path.join(directory, "dmrc_standard_fares.csv"),
    DMRC_COLUMNS
  );
  const airportFile = path.join(directory, "airport_express_qr_fares.csv");
  const airportHeader = readCsvHeader(airportFile);
  if (airportHeader.length < 2 || airportHeader[0] !== "origin_station") {
    throw new Error("Invalid Airport Express matrix header");
  }
  const airportRows = readCsv(airportFile, airportHeader);
  const noidaRows = readCsv(
    path.join(directory, "noida_metro_fares.csv"),
    NOIDA_COLUMNS
  );
  const rapid = JSON.parse(
    fs.readFileSync(path.join(directory, "rapid_metro_fare_note.json"), "utf8")
  );
  const metadata = JSON.parse(
    fs.readFileSync(path.join(directory, "metadata.json"), "utf8")
  );

  const airportStations = airportRows.length
    ? Object.keys(airportRows[0]).filter((key) => key !== "origin_station")
    : [];
  const stationKeys = airportStations.map(stationKey);
  if (
    new Set(stationKeys).size !== stationKeys.length ||
    airportRows.some((row) => !row.origin_station)
  ) {
    throw new Error("Airport Express station keys must be unique and non-empty");
  }
  if (
    new Set(airportRows.map((row) => stationKey(row.origin_station))).size !==
    airportRows.length
  ) {
    throw new Error("Airport Express origin stations must be unique");
  }
  const airportExpress = new Map();
  for (const row of airportRows) {
    const rowKey = stationKey(row.origin_station);
    if (!stationKeys.includes(rowKey)) {
      throw new Error(`Airport origin is not a matrix column: ${row.origin_station}`);
    }
    for (const destination of airportStations) {
      const fare = fareAmount(
        row[destination],
        `Airport Express fare ${row.origin_station} -> ${destination}`
      );
      airportExpress.set(`${rowKey}\u0000${stationKey(destination)}`, fare);
    }
  }

  const data = {
    dmrcStandard: dmrcRows.map((row) => ({
      min: boundedInteger(row.min_km_inclusive, "DMRC minimum km"),
      max: boundedInteger(row.max_km_exclusive, "DMRC maximum km", {
        allowBlank: true,
      }),
      weekday: fareAmount(row.weekday_fare_inr, "DMRC weekday fare"),
      holiday: fareAmount(row.sunday_holiday_fare_inr, "DMRC holiday fare"),
      timeLimit:
        row.time_limit_minutes === ""
          ? null
          : boundedInteger(row.time_limit_minutes, "DMRC time limit"),
    })),
    airportExpress,
    airportStations: new Set(airportStations.map(stationKey)),
    noidaMetro: fareTable(noidaRows, "Noida"),
    rapid,
    metadata,
  };
  validateMetroFareData(data);
  return data;
}

export const METRO_FARE_DATA = loadMetroFareData();

export function metroFareClass(routeId) {
  const id = String(routeId || "").replace(/^metro:/, "");
  if (id === AIRPORT_ROUTE_ID) return "airport_express";
  if (id === NOIDA_ROUTE_ID) return "noida_metro";
  if (id === RAPID_ROUTE_ID) return "rapid_metro";
  if (DMRC_ROUTE_IDS.has(id)) return "dmrc_standard";
  if (
    /^(Red|Yellow|Blue|Green|Violet|Pink|Magenta|Grey) Line(?:\s|\(|$)/.test(id)
  ) {
    return "dmrc_standard";
  }
  return "unknown";
}

export function calculateNoidaFare(stationCount, dayType = "weekday", data = METRO_FARE_DATA) {
  if (!DAY_TYPES.has(dayType)) {
    throw new Error(`Invalid Noida day type: ${dayType}`);
  }
  const count = boundedInteger(stationCount, "Noida station count");
  if (count < 1) return null;
  const slab = data.noidaMetro.find(
    (row) => count >= row.min && (row.max === null || count <= row.max)
  );
  if (!slab) return null;
  return dayType === "sunday_holiday" ? slab.holiday : slab.weekday;
}

export function calculateAirportExpressFare(fromName, toName, data = METRO_FARE_DATA) {
  const from = stationKey(fromName);
  const to = stationKey(toName);
  if (!data.airportStations.has(from) || !data.airportStations.has(to)) {
    return null;
  }
  return data.airportExpress.get(`${from}\u0000${to}`) ?? null;
}

export function calculateMetroFare(
  routeId,
  { fromName, toName, stationCount, distanceKm, dayType = "weekday" } = {},
  data = METRO_FARE_DATA
) {
  switch (metroFareClass(routeId)) {
    case "airport_express": {
      const amount = calculateAirportExpressFare(fromName, toName, data);
      return { amount, available: amount !== null, estimated: amount !== null };
    }
    case "noida_metro": {
      const amount = calculateNoidaFare(stationCount, dayType, data);
      return { amount, available: amount !== null, estimated: amount !== null };
    }
    case "dmrc_standard": {
      if (!Number.isFinite(distanceKm) || distanceKm < 0) {
        return { amount: null, available: false, estimated: false };
      }
      const slab = data.dmrcStandard.find(
        (row) =>
          distanceKm >= row.min &&
          (row.max === null || distanceKm < row.max)
      );
      const amount = slab
        ? dayType === "sunday_holiday"
          ? slab.holiday
          : slab.weekday
        : null;
      return { amount, available: amount !== null, estimated: amount !== null };
    }
    case "rapid_metro":
    default:
      return { amount: null, available: false, estimated: false };
  }
}
