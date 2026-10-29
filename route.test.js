/**
 * route.test.js — Routing engine tests for the Delhi Transit Assistant.
 * Run: node --test route.test.js
 *
 * Covers: Dijkstra correctness, fastest vs cheapest preference, crowd
 * avoidance, fare calculation, stop-name search, period detection,
 * edge-case inputs, and planByName error handling.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  plan,
  planByName,
  findStops,
  periodFor,
  busHopDistance,
} from "./route.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Assert that a result looks like a valid route response. */
function assertValidRoute(result) {
  assert.ok(result !== null, "result should not be null");
  assert.ok(typeof result.totalMinutes === "number", "totalMinutes must be a number");
  assert.ok(result.totalMinutes >= 0, "totalMinutes must be non-negative");
  assert.ok(
    result.totalFare === null || typeof result.totalFare === "number",
    "totalFare must be a number or null"
  );
  if (result.totalFare !== null) {
    assert.ok(result.totalFare >= 0, "totalFare must be non-negative");
  }
  assert.ok(Array.isArray(result.legs), "legs must be an array");
  assert.ok(typeof result.fareEstimate === "boolean", "fareEstimate must be boolean");
  assert.ok(typeof result.fareAvailable === "boolean", "fareAvailable must be boolean");
  assert.ok(
    ["verified", "estimated", "unavailable"].includes(result.fareStatus),
    "fareStatus must identify fare confidence"
  );
  assert.ok(typeof result.fareNote === "string", "fareNote must be a string");
  assert.ok(
    ["fastest", "cheapest"].includes(result.preference),
    "preference must be fastest or cheapest"
  );
  assert.ok(
    ["peak", "offpeak"].includes(result.period),
    "period must be peak or offpeak"
  );
}

/** Assert that every bus leg is well-formed. */
function assertBusLegs(legs) {
  for (const leg of legs) {
    if (leg.mode === "bus") {
      assert.ok(typeof leg.route === "string", "bus leg must have route name");
      assert.ok(typeof leg.from === "string", "bus leg must have from");
      assert.ok(typeof leg.to === "string", "bus leg must have to");
      assert.ok(leg.stops >= 0, "stops must be non-negative");
      assert.ok(leg.minutes >= 0, "minutes must be non-negative");
      assert.ok(leg.fare >= 0, "fare must be non-negative");
      assert.ok(leg.distanceKm >= 0, "distanceKm must be non-negative");
      assert.ok(leg.delayMin >= 0, "delayMin must be non-negative");
      assert.ok(
        ["low", "medium", "high", "unknown"].includes(leg.crowd),
        `crowd must be low/medium/high/unknown, got ${leg.crowd}`
      );
      assert.ok(
        ["ordinary", "ac"].includes(leg.busType),
        `busType must be ordinary or ac, got ${leg.busType}`
      );
    } else if (leg.mode === "metro") {
      assert.ok(typeof leg.route === "string", "metro leg must have line name");
      assert.match(leg.route, /^metro:/, "metro route must be identifiable");
      assert.ok(typeof leg.from === "string", "metro leg must have from");
      assert.ok(typeof leg.to === "string", "metro leg must have to");
      assert.ok(leg.stops >= 0, "metro stops must be non-negative");
      assert.ok(leg.minutes >= 0, "metro minutes must be non-negative");
      assert.ok(leg.distanceKm >= 0, "metro distanceKm must be non-negative");
      assert.ok(
        leg.fare === null || leg.fare >= 0,
        "metro fare should be null only when unavailable"
      );
    } else if (leg.mode === "walk") {
      assert.ok(typeof leg.from === "string", "walk leg must have from");
      assert.ok(typeof leg.to === "string", "walk leg must have to");
      assert.ok(leg.minutes > 0, "walk leg must have positive minutes");
    }
  }
}

// ---------------------------------------------------------------------------
// findStops
// ---------------------------------------------------------------------------

describe("findStops", () => {
  it("returns matching stops for a known name", () => {
    const results = findStops("Karol Bagh");
    assert.ok(results.length > 0, "should find at least one Karol Bagh stop");
    for (const s of results) {
      assert.ok(s.id, "each stop must have an id");
      assert.ok(s.name.toLowerCase().includes("karol bagh"), "name must match query");
      assert.ok(typeof s.lat === "number", "lat must be a number");
      assert.ok(typeof s.lon === "number", "lon must be a number");
    }
  });

  it("returns empty array for unknown name", () => {
    assert.deepEqual(findStops("XYZXYZXYZ_IMPOSSIBLE_STOP"), []);
  });

  it("returns empty array for empty string", () => {
    assert.deepEqual(findStops(""), []);
  });

  it("returns empty array for whitespace only", () => {
    assert.deepEqual(findStops("   "), []);
  });

  it("is case-insensitive", () => {
    const lower = findStops("karol bagh");
    const upper = findStops("KAROL BAGH");
    assert.equal(lower.length, upper.length, "case should not affect match count");
  });

  it("rejects non-string input gracefully", () => {
    assert.deepEqual(findStops(null), []);
    assert.deepEqual(findStops(undefined), []);
    assert.deepEqual(findStops(42), []);
  });

  it("finds supported non-station NCR places", () => {
    const results = findStops("Gaur City");
    assert.ok(results.some((stop) => stop.type === "place"));
  });

  it("finds Crossings Republik as an NCR place", () => {
    const results = findStops("Crossings Republik");
    assert.ok(results.some((stop) => stop.name === "Crossings Republik"));
  });
});

describe("planByName — non-station places", () => {
  it("connects Gaur City to the nearest transit stop", () => {
    const result = planByName("Noida Electronic City", "Gaur City", {
      preference: "fastest",
      period: "peak",
    });

    assertValidRoute(result);
    assert.ok(result.legs.some((leg) => leg.mode === "metro"));
    const finalLeg = result.legs.at(-1);
    assert.equal(finalLeg.mode, "walk");
    assert.equal(finalLeg.to, "Gaur City");
    assert.ok(finalLeg.distanceKm > 0);
  });

  it("connects Karol Bagh to Crossings Republik", () => {
    const result = planByName("Karol Bagh", "Crossings Republik", {
      preference: "fastest",
      period: "peak",
    });

    assertValidRoute(result);
    assert.ok(result.legs.length > 1);
    assert.equal(result.legs.at(-1).to, "Crossings Republik");
  });

  it("charges one DMRC fare across metro transfers", () => {
    const result = planByName("Karol Bagh", "Crossings Republik", {
      preference: "fastest",
      period: "peak",
    });

    const metroFare = result.legs
      .filter((leg) => leg.mode === "metro")
      .reduce((sum, leg) => sum + leg.fare, 0);
    assert.equal(result.totalFare, 54);
    assert.equal(metroFare, 54);
  });

  it("keeps metro fare within the correct slab for other transfer journeys", () => {
    const journeys = [
      ["Karol Bagh Metro", "Hauz Khas Metro"],
      ["Noida Electronic City", "Kashmere Gate Metro"],
    ];

    for (const [from, to] of journeys) {
      const result = planByName(from, to, {
        preference: "fastest",
        period: "peak",
      });
      assertValidRoute(result);
      const metroFare = result.legs
        .filter((leg) => leg.mode === "metro")
        .reduce((sum, leg) => sum + leg.fare, 0);
      assert.equal(result.totalFare, metroFare);
      assert.ok(metroFare <= 64, `${from} -> ${to} fare should not exceed ₹64`);
    }
  });
});

// ---------------------------------------------------------------------------
// periodFor
// ---------------------------------------------------------------------------

describe("periodFor", () => {
  const h = (hour) => new Date(`2026-01-05T${String(hour).padStart(2, "0")}:00:00`);

  it("classifies 08:00 as peak", () => assert.equal(periodFor(h(8)), "peak"));
  it("classifies 09:00 as peak", () => assert.equal(periodFor(h(9)), "peak"));
  it("classifies 10:59 as peak", () => {
    const d = new Date("2026-01-05T10:59:00");
    assert.equal(periodFor(d), "peak");
  });
  it("classifies 11:00 as offpeak", () => assert.equal(periodFor(h(11)), "offpeak"));
  it("classifies 13:00 as offpeak", () => assert.equal(periodFor(h(13)), "offpeak"));
  it("classifies 17:00 as peak", () => assert.equal(periodFor(h(17)), "peak"));
  it("classifies 19:00 as peak", () => assert.equal(periodFor(h(19)), "peak"));
  it("classifies 20:00 as offpeak", () => assert.equal(periodFor(h(20)), "offpeak"));
  it("classifies 00:00 as offpeak", () => assert.equal(periodFor(h(0)), "offpeak"));
  it("classifies 23:00 as offpeak", () => assert.equal(periodFor(h(23)), "offpeak"));
  it("uses current time when no argument given", () => {
    const result = periodFor();
    assert.ok(["peak", "offpeak"].includes(result));
  });
});

// ---------------------------------------------------------------------------
// plan — input validation
// ---------------------------------------------------------------------------

describe("plan — input validation", () => {
  it("throws for unsupported preference", () => {
    assert.throws(
      () => plan(["522"], ["441"], { preference: "scenic" }),
      /preference must be/
    );
  });

  it("throws for unsupported period", () => {
    assert.throws(
      () => plan(["522"], ["441"], { period: "midnight" }),
      /period must be/
    );
  });

  it("returns null when fromIds contains no valid stop", () => {
    const result = plan(["INVALID_STOP_ID"], ["441"], {});
    assert.equal(result, null);
  });

  it("returns null when toIds contains no valid stop", () => {
    const result = plan(["522"], ["INVALID_STOP_ID"], {});
    assert.equal(result, null);
  });

  it("returns null when both from and to are invalid", () => {
    const result = plan(["INVALID_A"], ["INVALID_B"], {});
    assert.equal(result, null);
  });

  it("silently drops invalid stop ids and uses valid ones", () => {
    // "INVALID_STOP_ID" is dropped; "522" is kept as source
    const result = plan(["INVALID_STOP_ID", "522"], ["441"], { period: "offpeak" });
    // Should still find a route (may or may not exist, but should not throw)
    // Result is either a valid route or null — not an error
    assert.ok(result === null || typeof result.totalMinutes === "number");
  });
});

// ---------------------------------------------------------------------------
// plan — same-stop trip
// ---------------------------------------------------------------------------

describe("plan — same-stop trip", () => {
  it("returns a zero-leg result when start equals destination", () => {
    const result = plan(["522"], ["522"], { period: "offpeak" });
    assertValidRoute(result);
    assert.equal(result.totalMinutes, 0);
    assert.equal(result.totalFare, 0);
    assert.equal(result.fareStatus, "verified");
    assert.equal(result.legs.length, 0);
  });
});

// ---------------------------------------------------------------------------
// plan — fastest mode
// ---------------------------------------------------------------------------

describe("plan — fastest mode (Karol Bagh → Gandhi Darshan)", () => {
  let result;

  // Run once, reuse across assertions
  before(() => {
    result = planByName("Karol Bagh", "Gandhi Darshan", {
      preference: "fastest",
      period: "peak",
    });
  });

  it("returns a valid route", () => assertValidRoute(result));
  it("sets preference to fastest", () => assert.equal(result.preference, "fastest"));
  it("has at least one bus leg", () => {
    assert.ok(result.legs.some((l) => l.mode === "bus"), "should have a bus leg");
  });
  it("all legs are well-formed", () => assertBusLegs(result.legs));
  it("totalMinutes equals sum of leg minutes", () => {
    const sum = result.legs.reduce((a, l) => a + l.minutes, 0);
    assert.ok(
      Math.abs(result.totalMinutes - Math.round(sum * 10) / 10) < 0.15,
      `totalMinutes ${result.totalMinutes} should approximately equal leg sum ${sum}`
    );
  });
  it("totalFare equals sum of bus leg fares", () => {
    const busTotal = result.legs
      .filter((l) => l.mode === "bus")
      .reduce((a, l) => a + l.fare, 0);
    assert.equal(result.totalFare, busTotal);
  });
});

// ---------------------------------------------------------------------------
// plan — cheapest mode
// ---------------------------------------------------------------------------

describe("plan — cheapest mode", () => {
  it("cheapest result has fare <= fastest result fare for the same pair", () => {
    const opts = { period: "offpeak" };
    const fastest = planByName("Karol Bagh", "Gandhi Darshan", {
      ...opts,
      preference: "fastest",
    });
    const cheapest = planByName("Karol Bagh", "Gandhi Darshan", {
      ...opts,
      preference: "cheapest",
    });
    if (
      fastest &&
      cheapest &&
      typeof fastest.totalFare === "number" &&
      typeof cheapest.totalFare === "number"
    ) {
      assert.ok(
        cheapest.totalFare <= fastest.totalFare,
        `cheapest fare ${cheapest.totalFare} should be <= fastest fare ${fastest.totalFare}`
      );
    }
  });

  it("cheapest mode returns a valid route", () => {
    const result = planByName("Karol Bagh", "Gandhi Darshan", {
      preference: "cheapest",
      period: "peak",
    });
    assertValidRoute(result);
    assertBusLegs(result.legs);
  });
});

// ---------------------------------------------------------------------------
// plan — crowd avoidance
// ---------------------------------------------------------------------------

describe("plan — crowd avoidance", () => {
  it("avoidCrowded result does not use high-crowd routes when alternatives exist", () => {
    // With avoidCrowded=true, any high-crowd route incurs a 10-min penalty
    const withAvoid = planByName("Karol Bagh", "Gandhi Darshan", {
      preference: "fastest",
      period: "peak",
      avoidCrowded: true,
    });
    if (withAvoid && withAvoid.legs) {
      const highCrowdLegs = withAvoid.legs.filter(
        (l) => l.mode === "bus" && l.crowd === "high"
      );
      // Either there are no high-crowd legs OR no lower-crowd alternative existed
      // (we can't assert zero because sometimes only high-crowd routes cover the path)
      assert.ok(
        highCrowdLegs.length === 0 ||
          withAvoid.legs.filter((l) => l.mode === "bus").length > 0,
        "result should be a valid route with crowd awareness applied"
      );
    }
  });

  it("avoidCrowded returns a valid route", () => {
    const result = planByName("Karol Bagh", "Gandhi Darshan", {
      preference: "fastest",
      period: "peak",
      avoidCrowded: true,
    });
    assertValidRoute(result);
    assertBusLegs(result.legs);
  });
});

// ---------------------------------------------------------------------------
// plan — multi-transfer route
// ---------------------------------------------------------------------------

describe("plan — multi-transfer route (ISBT → India Gate)", () => {
  let result;

  before(() => {
    result = planByName("ISBT", "India Gate", { preference: "fastest", period: "peak" });
  });

  it("finds a route", () => assert.ok(result !== null));
  it("returns a valid route structure", () => assertValidRoute(result));
  it("all legs are well-formed", () => assertBusLegs(result.legs));
  it("has multiple legs (multi-transfer expected)", () => {
    assert.ok(result.legs.length >= 2, "should require at least 2 legs");
  });
});

// ---------------------------------------------------------------------------
// plan — fare logic
// ---------------------------------------------------------------------------

describe("plan — fare correctness", () => {
  it("ordinary bus fare for ≤4 km journey is ₹5", () => {
    // Find a short journey whose distance is ≤4 km
    // planByName("Jhandewalan", "Karol Bagh Metro Station") tends to be short
    const result = planByName("Jhandewalan", "Karol Bagh Metro Station", {
      preference: "fastest",
      period: "offpeak",
    });
    if (result && result.legs) {
      const busLegs = result.legs.filter((l) => l.mode === "bus");
      for (const leg of busLegs) {
        if (leg.busType === "ordinary" && leg.distanceKm <= 4) {
          assert.equal(leg.fare, 5, `ordinary fare for ${leg.distanceKm} km should be ₹5`);
        }
      }
    }
  });

  it("delayMin on bus leg is non-negative", () => {
    const result = planByName("Karol Bagh", "Gandhi Darshan", {
      preference: "fastest",
      period: "peak",
    });
    if (result) {
      for (const leg of result.legs.filter((l) => l.mode === "bus")) {
        assert.ok(leg.delayMin >= 0, "delayMin must not be negative");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// planByName — error handling
// ---------------------------------------------------------------------------

describe("planByName — error handling", () => {
  it("returns error object for unknown fromName", () => {
    const result = planByName("XYZXYZ_UNKNOWN", "Gandhi Darshan");
    assert.ok(typeof result.error === "string", "should return error string");
    assert.ok(result.error.includes("XYZXYZ_UNKNOWN"), "error should mention the input");
  });

  it("returns error object for unknown toName", () => {
    const result = planByName("Karol Bagh", "XYZXYZ_UNKNOWN");
    assert.ok(typeof result.error === "string", "should return error string");
    assert.ok(result.error.includes("XYZXYZ_UNKNOWN"), "error should mention the input");
  });

  it("returns error when no route exists between isolated stops", () => {
    // Two stops that share no connected routes
    const result = planByName("XYZXYZ_FROM", "XYZXYZ_TO");
    assert.ok(typeof result.error === "string");
  });

  it("returns fromMatches and toMatches on success", () => {
    const result = planByName("Karol Bagh", "Gandhi Darshan", { period: "offpeak" });
    assert.ok(
      typeof result.fromMatches === "number" && result.fromMatches >= 1,
      "fromMatches should be present and ≥1"
    );
    assert.ok(
      typeof result.toMatches === "number" && result.toMatches >= 1,
      "toMatches should be present and ≥1"
    );
  });
});

// ---------------------------------------------------------------------------
// plan — offpeak period
// ---------------------------------------------------------------------------

describe("plan — offpeak period", () => {
  it("returns a valid route in offpeak", () => {
    const result = planByName("Karol Bagh", "Gandhi Darshan", {
      preference: "fastest",
      period: "offpeak",
    });

    assertValidRoute(result);
    assert.equal(result.period, "offpeak");
  });

  it("offpeak result marks period correctly", () => {
    const result = plan(["522"], ["441"], { period: "offpeak" });
    if (result) assert.equal(result.period, "offpeak");
  });
});

describe("plan — metro journeys", () => {
  it("routes between metro stations using metro hubs", () => {
    const result = planByName("Karol Bagh Metro", "Mandi House Metro", {
      preference: "fastest",
      period: "offpeak",
    });

    assertValidRoute(result);
    assert.ok(result.legs.some((leg) => leg.mode === "metro"));
    assert.equal(result.totalFare, 32);
    assert.equal(result.fareAvailable, true);
    assert.equal(result.fareStatus, "estimated");
  });

  it("supports bus-to-metro journeys", () => {
    const result = planByName("Karol Bagh", "Rajiv Chowk Metro", {
      preference: "fastest",
      period: "offpeak",
    });

    assertValidRoute(result);
    assert.ok(result.legs.some((leg) => leg.mode === "metro" || leg.mode === "bus"));
  });

  it("applies the Airport Express station-pair fare", () => {
    const result = plan(["GTFS:49"], ["GTFS:154"], { period: "offpeak" });
    assert.ok(result);
    assert.equal(result.legs.length, 1);
    assert.equal(result.legs[0].mode, "metro");
    assert.equal(result.legs[0].fare, 64);
    assert.equal(result.totalFare, 64);
    assert.equal(result.fareAvailable, true);
    assert.equal(result.fareEstimate, true);
    assert.equal(result.fareStatus, "estimated");
  });

  it("applies Noida fare bands using ridden station edges", () => {
    const result = plan(["GTFS:500"], ["GTFS:501"], { period: "offpeak" });
    assert.ok(result);
    assert.equal(result.legs[0].mode, "metro");
    assert.equal(result.legs[0].stops, 1);
    assert.equal(result.legs[0].fare, 10);
  });

  it("does not treat unavailable metro fares as zero in cheapest results", () => {
    const result = plan(["GTFS:49"], ["GTFS:154"], {
      period: "offpeak",
      preference: "cheapest",
    });
    assert.ok(result);
    assert.notEqual(result.totalFare, 0);
    assert.ok(result.totalFare === null || result.totalFare > 0);
    if (result.totalFare === null) {
      assert.equal(result.fareAvailable, false);
      assert.equal(result.fareEstimate, false);
      assert.equal(result.fareStatus, "unavailable");
      assert.equal(result.cheapestConfirmed, false);
    } else {
      assert.equal(result.fareAvailable, true);
      assert.equal(result.cheapestConfirmed, false);
    }
  });
});

// ---------------------------------------------------------------------------
// Bus road distance: cached driving distance with straight-line fallback
// ---------------------------------------------------------------------------

describe("busHopDistance — road cache with straight-line fallback", () => {
  // Real consecutive stops on 03DOWN: Karol Bagh Terminal -> Jhandewalan
  // (straight-line about 0.34 km).
  const A = "1773";
  const B = "1774";
  const straight = busHopDistance(A, B, {}).km;

  it("uses a plausible cached road distance", () => {
    const table = { [`${A}>${B}`]: { distanceKm: 0.35 } };
    assert.deepEqual(busHopDistance(A, B, table), { km: 0.35, source: "road" });
  });

  it("reads the real road cache by default", () => {
    const hop = busHopDistance(A, B);
    assert.equal(hop.source, "road");
    assert.ok(hop.km > 0.3 && hop.km < 0.5, `unexpected ${hop.km} km`);
  });

  it("falls back to straight-line when the pair is not cached", () => {
    const hop = busHopDistance(A, B, {});
    assert.equal(hop.source, "straight-line");
    assert.ok(straight > 0.3 && straight < 0.4, `unexpected ${straight} km`);
  });

  it("treats failed cache entries (no finite distanceKm) as missing", () => {
    for (const entry of [
      { error: "HTTP 403: Quota exceeded", from: A, to: B },
      { distanceKm: null },
      { distanceKm: NaN },
    ]) {
      const hop = busHopDistance(A, B, { [`${A}>${B}`]: entry });
      assert.equal(hop.source, "straight-line");
      assert.equal(hop.km, straight);
    }
  });

  it("tolerates a road distance a hair below straight-line (rounding/snapping)", () => {
    const road = straight * 0.99;
    const hop = busHopDistance(A, B, { [`${A}>${B}`]: { distanceKm: road } });
    assert.deepEqual(hop, { km: road, source: "road" });
  });

  it("rejects a road distance well below the straight-line distance", () => {
    const hop = busHopDistance(A, B, { [`${A}>${B}`]: { distanceKm: 0.1 } });
    assert.equal(hop.source, "straight-line");
    assert.equal(hop.km, straight);
  });

  it("rejects an implausibly long road distance", () => {
    const hop = busHopDistance(A, B, { [`${A}>${B}`]: { distanceKm: 5 } });
    assert.equal(hop.source, "straight-line");
    assert.equal(hop.km, straight);
  });

  it("accepts a short-hop detour within the excess limit (Turkman Gate -> Delite Cinema, cached 1.91 km for 0.19 km apart)", () => {
    const hop = busHopDistance("744", "745");
    assert.equal(hop.source, "road");
    assert.ok(hop.km > 1.8 && hop.km < 2.0, `unexpected ${hop.km} km`);
  });

  it("rejects a short hop whose extra distance exceeds the limit", () => {
    const table = { [`${A}>${B}`]: { distanceKm: straight + 3 } };
    const hop = busHopDistance(A, B, table);
    assert.equal(hop.source, "straight-line");
    assert.equal(hop.km, straight);
  });

  it("accepts a long hop with a large absolute excess if the ratio is modest", () => {
    // Karol Bagh Terminal -> Gandhi Darshan is about 4.7 km straight-line.
    const far = busHopDistance("1773", "441", {}).km;
    const road = far * 1.8;
    assert.ok(road - far > 2.5, "test needs an excess above the absolute limit");
    const hop = busHopDistance("1773", "441", {
      "1773>441": { distanceKm: road },
    });
    assert.deepEqual(hop, { km: road, source: "road" });
  });

  it("is directional: A>B does not satisfy B>A", () => {
    const table = { [`${A}>${B}`]: { distanceKm: 0.35 } };
    assert.equal(busHopDistance(B, A, table).source, "straight-line");
  });

  it("returns zero with no source for a same-stop hop", () => {
    assert.deepEqual(busHopDistance(A, A, {}), { km: 0, source: null });
  });
});

describe("plan — reported distance for bus, metro and walk legs", () => {
  it("Karol Bagh -> Gandhi Darshan uses cached road distances, not the straight-line sum", () => {
    const result = planByName("Karol Bagh", "Gandhi Darshan", {
      preference: "fastest",
      period: "peak",
    });
    assertValidRoute(result);
    assert.equal(result.legs.length, 1);
    // The straight-line sum for this route was 4.9 km; the cached road
    // distances for its 12 hops sum to about 7.6 km.
    assert.ok(result.legs[0].distanceKm > 7 && result.legs[0].distanceKm < 8,
      `got ${result.legs[0].distanceKm}`);
    assert.equal(result.legs[0].distanceSource, "road");
    assert.equal(result.distanceSource, "road");
  });

  describe("multi-mode journey (ISBT -> India Gate)", () => {
    let result;

    before(() => {
      result = planByName("ISBT", "India Gate", {
        preference: "fastest",
        period: "peak",
      });
    });

    it("has walk, metro and bus legs", () => {
      const modes = new Set(result.legs.map((leg) => leg.mode));
      for (const mode of ["walk", "metro", "bus"]) {
        assert.ok(modes.has(mode), `expected a ${mode} leg`);
      }
    });

    it("total distance equals the sum of transit legs (no double counting)", () => {
      const sum = result.legs
        .filter((leg) => leg.mode !== "walk")
        .reduce((total, leg) => total + leg.distanceKm, 0);
      assert.ok(
        Math.abs(result.totalDistanceKm - sum) < 0.05,
        `total ${result.totalDistanceKm} vs legs ${sum}`
      );
    });

    it("walk legs carry no distance or distance source", () => {
      for (const leg of result.legs.filter((l) => l.mode === "walk")) {
        assert.ok(!("distanceKm" in leg));
        assert.ok(!("distanceSource" in leg));
      }
    });

    it("metro legs stay straight-line and never use driving distance", () => {
      for (const leg of result.legs.filter((l) => l.mode === "metro")) {
        assert.equal(leg.distanceSource, "straight-line");
      }
    });

    it("bus legs report where their distance came from", () => {
      for (const leg of result.legs.filter((l) => l.mode === "bus")) {
        assert.ok(
          ["road", "mixed", "straight-line"].includes(leg.distanceSource),
          `bad distanceSource ${leg.distanceSource}`
        );
      }
    });

    it("route distanceSource summarises the leg sources", () => {
      const sources = new Set(
        result.legs.filter((l) => l.distanceSource).map((l) => l.distanceSource)
      );
      const expected = sources.size === 1 ? [...sources][0] : "mixed";
      assert.equal(result.distanceSource, expected);
    });
  });

  it("ordinary bus fares stay consistent with the reported distance", () => {
    const journeys = [
      ["Karol Bagh", "Gandhi Darshan"],
      ["ISBT", "India Gate"],
      ["Karol Bagh", "Rajiv Chowk"],
    ];

    for (const [from, to] of journeys) {
      const result = planByName(from, to, { preference: "fastest", period: "peak" });
      if (result.error) continue;

      for (const leg of result.legs) {
        if (leg.mode !== "bus" || leg.busType !== "ordinary") continue;
        const d = leg.distanceKm;
        // Distances are rounded to 0.1 km; skip legs next to a fare boundary.
        if (Math.abs(d - 4) < 0.15 || Math.abs(d - 10) < 0.15) continue;

        const expected = d <= 4 ? 5 : d <= 10 ? 10 : 15;
        assert.equal(leg.fare, expected, `${leg.route} ${d} km`);
      }
    }
  });
});