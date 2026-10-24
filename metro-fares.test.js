import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  calculateAirportExpressFare,
  calculateMetroFare,
  calculateNoidaFare,
  loadMetroFareData,
  metroFareClass,
} from "./metro-fares.js";

const data = loadMetroFareData();

function fixtureDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "metro-fares-"));
  fs.cpSync(path.join(".", "data", "metro-fares"), directory, {
    recursive: true,
  });
  return directory;
}

describe("metro fare data", () => {
  it("loads and validates all fare tables", () => {
    assert.ok(data.dmrcStandard.length > 0);
    assert.ok(data.airportExpress.size > 0);
    assert.ok(data.noidaMetro.length > 0);
    assert.equal(data.rapid.production_status, "verify_before_use");
  });

  it("classifies supported metro operators", () => {
    assert.equal(metroFareClass("metro:DelhiAirport"), "airport_express");
    assert.equal(metroFareClass("metro:NoidaAqua"), "noida_metro");
    assert.equal(metroFareClass("metro:Gurgaon1"), "rapid_metro");
    assert.equal(metroFareClass("metro:Delhi2"), "dmrc_standard");
    assert.equal(metroFareClass("metro:Delhi10"), "unknown");
    assert.equal(metroFareClass("metro:Unknown"), "unknown");
  });

  it("looks up Airport Express fares in both directions", () => {
    assert.equal(calculateAirportExpressFare("New Delhi", "IGI Airport", data), 64);
    assert.equal(calculateAirportExpressFare("IGI Airport", "New Delhi", data), 64);
    assert.equal(
      calculateAirportExpressFare("Dwarka Sector - 21", "New Delhi", data),
      64
    );
  });

  it("counts Noida fare bands by ridden station edges", () => {
    assert.equal(calculateNoidaFare(1, "weekday", data), 10);
    assert.equal(calculateNoidaFare(2, "weekday", data), 15);
    assert.equal(calculateNoidaFare(6, "sunday_holiday", data), 15);
    assert.equal(calculateNoidaFare(17, "weekday", data), 50);
    assert.equal(calculateNoidaFare(0, "weekday", data), null);
    assert.throws(
      () => calculateNoidaFare(1, "holiday", data),
      /Invalid Noida day type/
    );
    assert.throws(
      () => calculateNoidaFare(1, "SUNDAY_HOLIDAY", data),
      /Invalid Noida day type/
    );
  });

  it("leaves DMRC and Rapid Metro fares unavailable", () => {
    assert.deepEqual(
      calculateMetroFare("metro:Delhi2", { stationCount: 3 }, data),
      { amount: null, available: false }
    );
    assert.deepEqual(
      calculateMetroFare("metro:Gurgaon1", { stationCount: 3 }, data),
      { amount: null, available: false }
    );
  });

  it("rejects malformed CSV columns and numeric values", () => {
    const directory = fixtureDirectory();
    const dmrc = path.join(directory, "dmrc_standard_fares.csv");
    fs.writeFileSync(
      dmrc,
      "min_km_inclusive,max_km_exclusive,weekday_fare_inr\n0,2,11\n"
    );
    assert.throws(() => loadMetroFareData(directory), /Invalid columns/);

    const directoryWithBadNumber = fixtureDirectory();
    fs.writeFileSync(
      path.join(directoryWithBadNumber, "noida_metro_fares.csv"),
      [
        "stations_min,stations_max,weekday_fare_inr,sunday_holiday_fare_inr",
        "1,1,not-a-number,10",
        "2,2,15,10",
        "3,6,20,15",
        "7,9,30,20",
        "10,16,40,30",
        "17,,50,40",
        "",
      ].join("\n")
    );
    assert.throws(() => loadMetroFareData(directoryWithBadNumber), /Invalid/);
  });

  it("rejects missing and overlapping fare ranges", () => {
    const missingRange = fixtureDirectory();
    fs.writeFileSync(
      path.join(missingRange, "noida_metro_fares.csv"),
      [
        "stations_min,stations_max,weekday_fare_inr,sunday_holiday_fare_inr",
        "1,1,10,10",
        "3,6,20,15",
        "7,9,30,20",
        "10,16,40,30",
        "17,,50,40",
        "",
      ].join("\n")
    );
    assert.throws(() => loadMetroFareData(missingRange), /missing or overlapping/);

    const overlappingMatrix = fixtureDirectory();
    const matrix = fs.readFileSync(
      path.join(overlappingMatrix, "airport_express_qr_fares.csv"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(overlappingMatrix, "airport_express_qr_fares.csv"),
      matrix.replace("Shivaji Stadium,21,11", "Shivaji Stadium,22,11")
    );
    assert.throws(() => loadMetroFareData(overlappingMatrix), /not symmetric/);
  });

  it("rejects an incomplete Airport Express matrix", () => {
    const directory = fixtureDirectory();
    const file = path.join(directory, "airport_express_qr_fares.csv");
    const rows = fs.readFileSync(file, "utf8").trim().split("\n");
    rows[1] = rows[1].replace(",75", "");
    fs.writeFileSync(file, `${rows.join("\n")}\n`);
    assert.throws(
      () => loadMetroFareData(directory),
      /Invalid columns|Invalid Airport Express|Invalid Record Length/
    );
  });

  it("returns null for unknown Airport Express station pairs", () => {
    assert.equal(
      calculateAirportExpressFare("Not A Station", "New Delhi", data),
      null
    );
    assert.equal(
      calculateMetroFare(
        "metro:DelhiAirport",
        { fromName: "New Delhi", toName: "Not A Station" },
        data
      ).amount,
      null
    );
  });
});
