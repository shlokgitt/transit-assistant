import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { buildMetroData, parseCsv } from "./scripts/build-metro-data.js";

test("GTFS CSV parsing preserves quoted commas and escaped quotes", () => {
  const rows = parseCsv(
    'stop_id,stop_name,stop_desc\n1,"Central, Gate","He said ""hello"""'
  );
  assert.deepEqual(rows[0], {
    stop_id: "1",
    stop_name: "Central, Gate",
    stop_desc: 'He said "hello"',
  });
});

test("parent stations canonicalize platform stop records", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "metro-gtfs-"));
  const write = (name, content) => fs.writeFileSync(path.join(directory, name), content);

  write("agency.txt", "agency_id,agency_name\nDMRC,DMRC\n");
  write("calendar.txt", "service_id,monday\nweekday,1\n");
  write("routes.txt", "route_id,route_short_name,route_long_name,route_color\nR1,1,Line 1,FF0000\n");
  write(
    "stops.txt",
    [
      "stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station",
      "P,Parent Station,28.6,77.2,1,",
      "Q,Second Station,28.61,77.21,1,",
      "A,Platform A,28.6001,77.2001,0,P",
      "B,Platform B,28.6101,77.2101,0,Q",
    ].join("\n")
  );
  write(
    "trips.txt",
    "route_id,service_id,trip_id\nR1,weekday,T1\n"
  );
  write(
    "stop_times.txt",
    [
      "trip_id,arrival_time,departure_time,stop_id,stop_sequence",
      "T1,08:00:00,08:00:00,A,0",
      "T1,08:02:00,08:02:00,B,1",
    ].join("\n")
  );

  const data = buildMetroData(directory);
  assert.deepEqual(Object.keys(data.stations), ["GTFS:P", "GTFS:Q"]);
  assert.deepEqual(data.lines[0].connections, [["GTFS:P", "GTFS:Q", 2]]);
});

test("actual DMRC feed produces route-specific adjacent connections", () => {
  const data = buildMetroData("./metro");
  assert.equal(Object.keys(data.stations).length, 262);
  assert.equal(data.lines.length, 12);
  assert.ok(data.lines.every((line) => line.connections.length > 0));
  assert.ok(
    data.lines
      .find((line) => line.id === "Delhi2")
      .connections.some(([from, to]) => from !== to)
  );
  assert.equal(data.fareSlabs.length, 0);
});

test("malformed coordinates and stop times are skipped safely", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "metro-gtfs-invalid-"));
  const write = (name, content) => fs.writeFileSync(path.join(directory, name), content);

  write("agency.txt", "agency_id,agency_name\nDMRC,DMRC\n");
  write("routes.txt", "route_id,route_short_name,route_long_name\nR1,1,Line 1\n");
  write(
    "stops.txt",
    [
      "stop_id,stop_name,stop_lat,stop_lon",
      "A,Valid,28.6,77.2",
      "B,Bad coordinate,not-a-number,77.2",
      "C,Valid two,28.61,77.21",
    ].join("\n")
  );
  write("trips.txt", "route_id,service_id,trip_id\nR1,weekday,T1\n");
  write(
    "stop_times.txt",
    [
      "trip_id,arrival_time,departure_time,stop_id,stop_sequence",
      "T1,not-a-time,08:00:00,A,0",
      "T1,08:02:00,08:02:00,B,1",
      "T1,08:04:00,08:04:00,C,2",
    ].join("\n")
  );

  const data = buildMetroData(directory);
  assert.deepEqual(Object.keys(data.stations), ["GTFS:A", "GTFS:C"]);
  assert.deepEqual(data.lines[0].connections, []);
});
