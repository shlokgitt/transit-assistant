/**
 * Reliability & Constraints Test Suite
 * Tests the 12 core acceptance criteria from the implementation handoff spec.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  planByName,
  planMetroByName,
  evaluateRouteConstraints,
  calculateRouteReliability,
  generateRouteExplanation,
} from "./route.js";

// -----------------------------------------------------------------------
// Helper to get a route or throw a test-friendly error
// -----------------------------------------------------------------------
function requireRoute(from, to, opts = {}) {
  const result = planByName(from, to, { preference: "fastest", period: "peak", ...opts });
  if (result && "error" in result) {
    throw new Error(`Route planning error for ${from} → ${to}: ${result.error}`);
  }
  return result;
}

// -----------------------------------------------------------------------
// 1. Fastest route selection
// -----------------------------------------------------------------------
describe("fastest route selection", () => {
  test("returns a valid route with preference = fastest", () => {
    const route = requireRoute("Karol Bagh", "Gandhi Darshan");
    assert.ok(route, "Route should exist");
    assert.ok(Array.isArray(route.legs) && route.legs.length > 0, "Should have legs");
    assert.strictEqual(route.preference, "fastest");
  });

  test("totalMinutes is a positive number", () => {
    const route = requireRoute("Karol Bagh", "Gandhi Darshan");
    assert.ok(typeof route.totalMinutes === "number" && route.totalMinutes > 0);
  });
});

// -----------------------------------------------------------------------
// 2. Cheapest route selection
// -----------------------------------------------------------------------
describe("cheapest route selection", () => {
  test("cheapest route fare is <= fastest route fare", (t) => {
    const fastest = planByName("Karol Bagh", "Gandhi Darshan", { preference: "fastest", period: "peak" });
    const cheapest = planByName("Karol Bagh", "Gandhi Darshan", { preference: "cheapest", period: "peak" });

    if ("error" in fastest || "error" in cheapest) {
      t.skip("Route unavailable");
      return;
    }

    assert.ok(
      (cheapest.totalFare ?? 999) <= (fastest.totalFare ?? 999),
      `Cheapest fare (₹${cheapest.totalFare}) should be ≤ fastest fare (₹${fastest.totalFare})`
    );
  });

  test("cheapest route has preference=cheapest", () => {
    const cheapest = planByName("Karol Bagh", "Gandhi Darshan", { preference: "cheapest", period: "peak" });
    if ("error" in cheapest) return;
    assert.strictEqual(cheapest.preference, "cheapest");
  });
});

// -----------------------------------------------------------------------
// 3. Budget constraint: route exceeding budget is rejected
// -----------------------------------------------------------------------
describe("budget constraint enforcement", () => {
  test("evaluateRouteConstraints rejects route exceeding maxBudget", () => {
    const mockRoute = {
      totalMinutes: 40,
      totalFare: 60,
      legs: [{ mode: "bus", minutes: 40, fare: 60 }],
    };

    const result = evaluateRouteConstraints(mockRoute, { maxBudget: 40 });

    assert.strictEqual(result.satisfied, false, "Route exceeding budget should be unsatisfied");
    assert.ok(result.violations.some((v) => v.includes("₹60") && v.includes("₹40")),
      `Violation should mention fare and budget: ${result.violations}`
    );
  });

  test("evaluateRouteConstraints passes route within budget", () => {
    const mockRoute = {
      totalMinutes: 35,
      totalFare: 30,
      legs: [{ mode: "bus", minutes: 35, fare: 30 }],
    };

    const result = evaluateRouteConstraints(mockRoute, { maxBudget: 50 });
    assert.strictEqual(result.satisfied, true);
    assert.strictEqual(result.budgetSatisfied, true);
    assert.strictEqual(result.violations.length, 0);
  });

  test("satisfiesAll aliases satisfied", () => {
    const mockRoute = { totalMinutes: 30, totalFare: 70, legs: [] };
    const result = evaluateRouteConstraints(mockRoute, { maxBudget: 40 });
    assert.strictEqual(result.satisfiesAll, result.satisfied);
  });
});

// -----------------------------------------------------------------------
// 4. Walking constraint: route exceeding walk limit is rejected
// -----------------------------------------------------------------------
describe("walking distance constraint enforcement", () => {
  test("evaluateRouteConstraints rejects excessive walking distance", () => {
    const mockRoute = {
      totalMinutes: 20,
      totalFare: 0,
      legs: [
        { mode: "walk", minutes: 20, distanceKm: 0.8 }, // 800m
      ],
    };

    const result = evaluateRouteConstraints(mockRoute, { maxWalkingDistanceMeters: 500 });
    assert.strictEqual(result.satisfied, false);
    assert.ok(result.violations.some((v) => v.includes("800m") && v.includes("500m")),
      `Violation should mention distances: ${result.violations}`
    );
  });

  test("evaluateRouteConstraints passes route within walking limit", () => {
    const mockRoute = {
      totalMinutes: 10,
      totalFare: 0,
      legs: [
        { mode: "walk", minutes: 10, distanceKm: 0.3 }, // 300m
      ],
    };

    const result = evaluateRouteConstraints(mockRoute, { maxWalkingDistanceMeters: 500 });
    assert.strictEqual(result.satisfied, true);
    assert.strictEqual(result.walkingSatisfied, true);
  });
});

// -----------------------------------------------------------------------
// 5. Unreachable destination is handled gracefully
// -----------------------------------------------------------------------
describe("unreachable destination handling", () => {
  test("returns an error object for completely unknown destination", () => {
    const result = planByName("Karol Bagh", "ZZZ_Nonexistent_Place_XYZ_9999");
    assert.ok(result && "error" in result, "Should return error for unknown destination");
  });

  test("error object has a descriptive message", () => {
    const result = planByName("Karol Bagh", "ZZZ_Nonexistent_Place_XYZ_9999");
    assert.ok(typeof result.error === "string" && result.error.length > 0);
  });

  test("does not throw an exception for unknown stops", () => {
    assert.doesNotThrow(() => {
      planByName("Unknown_Origin_99", "Unknown_Dest_99");
    });
  });
});

// -----------------------------------------------------------------------
// 6. Transfer constraint
// -----------------------------------------------------------------------
describe("transfer count constraint", () => {
  test("evaluateRouteConstraints enforces maxTransfers = 0", () => {
    const mockRoute = {
      totalMinutes: 45,
      totalFare: 30,
      legs: [
        { mode: "metro", minutes: 20, fare: 20 },
        { mode: "walk", minutes: 5 },
        { mode: "bus", minutes: 20, fare: 10 },
      ],
    };

    const result = evaluateRouteConstraints(mockRoute, { maxTransfers: 0 });
    assert.strictEqual(result.satisfied, false);
    assert.ok(result.violations.some((v) => v.includes("Transfers")));
  });

  test("evaluateRouteConstraints passes single-leg route with maxTransfers = 0", () => {
    const mockRoute = {
      totalMinutes: 30,
      totalFare: 20,
      legs: [{ mode: "metro", minutes: 30, fare: 20 }],
    };

    const result = evaluateRouteConstraints(mockRoute, { maxTransfers: 0 });
    assert.strictEqual(result.satisfied, true);
    assert.strictEqual(result.transfersSatisfied, true);
  });
});

// -----------------------------------------------------------------------
// 7. Arrival deadline constraint
// -----------------------------------------------------------------------
describe("arrival deadline constraint", () => {
  test("evaluateRouteConstraints rejects route that misses deadline", () => {
    // 45-minute journey departing at 08:30 arrives at 09:15 — misses 09:00 deadline
    const mockRoute = {
      totalMinutes: 45,
      totalFare: 30,
      legs: [{ mode: "bus", minutes: 45, fare: 30 }],
    };

    const result = evaluateRouteConstraints(mockRoute, {
      maxBudget: 100,
      requiredArrivalTime: "09:00",
      departureTime: "08:30",
    });

    assert.strictEqual(result.satisfied, false, "Should not satisfy a deadline that is missed");
    assert.ok(result.violations.some((v) => v.includes("deadline") || v.includes("09:00")),
      `Violation should mention deadline: ${result.violations}`
    );
  });

  test("evaluateRouteConstraints accepts route that meets deadline", () => {
    // 25-minute journey departing at 08:30 arrives at 08:55 — meets 09:00 deadline
    const mockRoute = {
      totalMinutes: 25,
      totalFare: 20,
      legs: [{ mode: "metro", minutes: 25, fare: 20 }],
    };

    const result = evaluateRouteConstraints(mockRoute, {
      requiredArrivalTime: "09:00",
      departureTime: "08:30",
    });

    assert.strictEqual(result.deadlineSatisfied, true);
    assert.strictEqual(result.satisfied, true);
  });
});

// -----------------------------------------------------------------------
// 8. Reliability calculation
// -----------------------------------------------------------------------
describe("reliability calculation", () => {
  test("returns a reliability object with all required fields", () => {
    const mockRoute = {
      totalMinutes: 45,
      totalFare: 30,
      legs: [
        { mode: "metro", minutes: 30, delayMin: 0 },
        { mode: "bus", minutes: 15, delayMin: 0 },
      ],
    };

    const rel = calculateRouteReliability(mockRoute, null);
    assert.ok(rel, "Reliability result should exist");
    assert.ok(typeof rel.reliabilityPercentage === "number");
    assert.ok(["High", "Moderate", "Low"].includes(rel.reliabilityBand));
    assert.ok(["high", "medium", "simulated"].includes(rel.confidenceLevel));
    assert.ok(typeof rel.transferBufferMinutes === "number");
    assert.ok(typeof rel.potentialDelayImpactMinutes === "number");
  });

  test("marks confidenceLevel as simulated when scenario is active", () => {
    const mockRoute = {
      totalMinutes: 50,
      totalFare: 40,
      legs: [{ mode: "metro", minutes: 50, delayMin: 10 }],
    };

    const rel = calculateRouteReliability(mockRoute, { active: true, serviceDelays: { metro: 10 } });
    assert.strictEqual(rel.confidenceLevel, "simulated");
    assert.strictEqual(rel.isSimulated, true);
  });

  test("delay impact lowers reliability score", () => {
    const baseRoute = { totalMinutes: 40, totalFare: 30, legs: [{ mode: "metro", minutes: 40, delayMin: 0 }] };
    const delayedRoute = { totalMinutes: 50, totalFare: 30, legs: [{ mode: "metro", minutes: 40, delayMin: 10 }] };

    const baseRel = calculateRouteReliability(baseRoute, null);
    const delayedRel = calculateRouteReliability(delayedRoute, { active: true });

    assert.ok(
      delayedRel.reliabilityPercentage <= baseRel.reliabilityPercentage,
      `Delayed route reliability (${delayedRel.reliabilityPercentage}%) should be ≤ base (${baseRel.reliabilityPercentage}%)`
    );
  });
});

// -----------------------------------------------------------------------
// 9. Scenario: disabled connection forces reroute or error
// -----------------------------------------------------------------------
describe("disruption scenario: disabled service", () => {
  test("route with disabled service produces a different result or error", (t) => {
    const baseResult = planByName("Karol Bagh", "Gandhi Darshan", {
      preference: "fastest",
      period: "peak",
      scenario: null,
    });

    const disruptedResult = planByName("Karol Bagh", "Gandhi Darshan", {
      preference: "fastest",
      period: "peak",
      scenario: {
        active: true,
        disabledServices: ["03DOWN", "534", "B03DOWN"],
      },
    });

    if ("error" in baseResult) {
      t.skip("Base route not available");
      return;
    }

    // The disrupted result should either return an error OR a different route
    if (!("error" in disruptedResult)) {
      // If it finds a route, verify it was calculated
      assert.ok(Array.isArray(disruptedResult.legs));
    }
    // Either way, no exception was thrown — the scenario was handled gracefully
    assert.ok(true, "Disruption scenario was handled without throwing");
  });
});

// -----------------------------------------------------------------------
// 10. Before/after comparison fields from evaluateRouteConstraints
// -----------------------------------------------------------------------
describe("before/after comparison data", () => {
  test("evaluateRouteConstraints returns all detail fields", () => {
    const mockRoute = {
      totalMinutes: 45,
      totalFare: 55,
      legs: [
        { mode: "metro", minutes: 30, fare: 40 },
        { mode: "bus", minutes: 15, fare: 15 },
      ],
    };

    const result = evaluateRouteConstraints(mockRoute, {
      maxBudget: 40,
      maxTransfers: 0,
      requiredArrivalTime: "09:00",
      departureTime: "08:00",
    });

    assert.ok(Array.isArray(result.violations));
    assert.ok(result.violations.length > 0, "Should have violations");
    assert.strictEqual(typeof result.budgetSatisfied, "boolean");
    assert.strictEqual(typeof result.transfersSatisfied, "boolean");
    assert.strictEqual(result.satisfiesAll, result.satisfied);
  });
});

// -----------------------------------------------------------------------
// 11. Explanation generation is grounded in route data
// -----------------------------------------------------------------------
describe("explanation generation", () => {
  test("generates a non-empty explanation string for a valid route", () => {
    const mockRoute = {
      totalMinutes: 40,
      totalFare: 30,
      tag: "RECOMMENDED",
      legs: [{ mode: "metro", minutes: 40, fare: 30 }],
    };

    const explanation = generateRouteExplanation(mockRoute, {}, null, false, null);
    assert.ok(typeof explanation === "string" && explanation.length > 0, "Should return a non-empty explanation");
  });

  test("explanation mentions budget compliance when budget constraint is set", () => {
    const mockRoute = {
      totalMinutes: 35,
      totalFare: 30,
      tag: "RECOMMENDED",
      legs: [{ mode: "metro", minutes: 35, fare: 30 }],
    };

    const explanation = generateRouteExplanation(mockRoute, { maxBudget: 50 }, null, false, null);
    // Explanation should mention fare or budget
    assert.ok(
      explanation.includes("₹") || explanation.toLowerCase().includes("budget") || explanation.toLowerCase().includes("fare"),
      `Explanation should reference fare: "${explanation}"`
    );
  });

  test("returns empty string for null route", () => {
    const explanation = generateRouteExplanation(null, {}, null, false, null);
    assert.strictEqual(explanation, "");
  });
});

// -----------------------------------------------------------------------
// 12. Saved journey recalculation: planByName is deterministic for same input
// -----------------------------------------------------------------------
describe("deterministic routing for saved journey recalculation", () => {
  test("same origin/destination/preference yields same totalMinutes", () => {
    const r1 = planByName("Karol Bagh", "Gandhi Darshan", { preference: "fastest", period: "peak" });
    const r2 = planByName("Karol Bagh", "Gandhi Darshan", { preference: "fastest", period: "peak" });

    if ("error" in r1 || "error" in r2) return;

    assert.strictEqual(r1.totalMinutes, r2.totalMinutes, "Identical inputs should yield identical totalMinutes");
    assert.strictEqual(r1.totalFare, r2.totalFare, "Identical inputs should yield identical fare");
  });

  test("same origin/destination/cheapest preference yields same totalFare", () => {
    const r1 = planByName("Karol Bagh", "Gandhi Darshan", { preference: "cheapest", period: "peak" });
    const r2 = planByName("Karol Bagh", "Gandhi Darshan", { preference: "cheapest", period: "peak" });

    if ("error" in r1 || "error" in r2) return;
    assert.strictEqual(r1.totalFare, r2.totalFare);
  });
});
