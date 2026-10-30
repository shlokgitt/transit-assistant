import { NextRequest, NextResponse } from "next/server";
import {
  RoutePlanRequest,
  RoutePlanResponse,
  RoutingPriority,
  RouteOption,
  RouteLeg,
  JourneyConstraints,
  DisruptionScenario,
  ConstraintEvaluation,
  ReliabilityDetails,
  CrowdLevel,
} from "@/types/transit";
import {
  periodFor,
  planMetroByName,
  planWalkingByName,
  planByName,
  stopCoordinates,
  stopName,
  evaluateRouteConstraints,
  calculateRouteReliability,
  generateRouteExplanation,
} from "../../../../../../backend/route.js";
import { getScheduledBusTiming } from "@/lib/staticSchedule";

type PlannerLeg = {
  mode: "walk" | "bus" | "metro" | "auto";
  route?: string;
  fromId: string;
  toId: string;
  from: string;
  to: string;
  minutes: number;
  distanceKm?: number;
  fare?: number | null;
  stops?: number;
  stopIds?: string[];
  crowd?: string;
  delayMin?: number;
  distanceSource?: "road" | "straight-line" | "mixed" | null;
};

type PlannerResponse = {
  totalMinutes: number;
  totalDistanceKm: number;
  distanceSource: "road" | "straight-line" | "mixed" | null;
  totalFare: number | null;
  legs: PlannerLeg[];
  scenarioApplied?: boolean;
  scenarioDetails?: unknown;
};

function normalizeRoutingPriority(
  priority?: RoutingPriority
): "fastest" | "cheapest" {
  switch (priority) {
    case "cheapest":
      return "cheapest";
    case "eco":
    case "shortest":
    case "least_transfers":
    case "fastest":
    default:
      return "fastest";
  }
}

function plannerPeriod(
  period: "peak" | "offpeak" | "auto" | undefined
): "peak" | "offpeak" {
  return period === "peak" || period === "offpeak" ? period : periodFor();
}

function coordinatesFor(ids: string[]) {
  return ids
    .map((id) => {
      const stop = stopCoordinates(id);
      return stop ? ([stop.lat, stop.lon] as [number, number]) : null;
    })
    .filter((point): point is [number, number] => point !== null);
}

function estimatedCarbonKg(legs: PlannerLeg[]) {
  const gramsPerKm: Record<PlannerLeg["mode"], number> = {
    walk: 0,
    metro: 0.04,
    bus: 0.08,
    auto: 0.12,
  };

  return Number(
    legs
      .reduce(
        (total, leg) =>
          total + (leg.distanceKm || 0) * (gramsPerKm[leg.mode] || 0),
        0
      )
      .toFixed(2)
  );
}

function formatRouteTitle(legs: PlannerLeg[]): string {
  const metroLegs = legs.filter((l) => l.mode === "metro" && l.route);
  const busLegs = legs.filter((l) => l.mode === "bus" && l.route);
  const autoLegs = legs.filter((l) => l.mode === "auto");

  const metroLines = [
    ...new Set(metroLegs.map((l) => l.route!.replace(/^metro:/, ""))),
  ];
  const busRoutes = [
    ...new Set(
      busLegs.map((l) =>
        l.route ? (l.route.startsWith("B") ? l.route : `B${l.route}`) : "Bus"
      )
    ),
  ];

  if (metroLines.length > 0 && busRoutes.length > 0) {
    const metroPart = metroLines.join(" ➔ ");
    return `${metroPart} + ${busRoutes[0]}`;
  }

  if (metroLines.length > 0) {
    return `${metroLines.join(" ➔ ")} Metro`;
  }

  if (busRoutes.length > 0) {
    return busRoutes.length === 1
      ? `Bus ${busRoutes[0]}`
      : `Bus ${busRoutes.join(" ➔ ")}`;
  }

  if (autoLegs.length > 0) {
    return "Auto-rickshaw route";
  }

  return "Walking route";
}

function buildPlannerRoute(
  plannerResponse: PlannerResponse,
  id: string,
  tag: "FASTEST" | "CHEAPEST" | "RECOMMENDED" | "ECO" | "COMFORT" | "TRAFFIC_BUSTER",
  constraints?: JourneyConstraints,
  scenario?: DisruptionScenario | null,
  isAlternative = false,
  baselineRoute?: RouteOption | null
): RouteOption | null {
  const firstLeg = plannerResponse.legs[0];
  if (!firstLeg) return null;

  const processedLegs = plannerResponse.legs;
  const routeModes = [...new Set(processedLegs.map((leg) => leg.mode))];

  const totalMinutes = Number(
    processedLegs.reduce((sum, leg) => sum + leg.minutes, 0).toFixed(1)
  );
  const totalFare = processedLegs.reduce(
    (sum, leg) => sum + (leg.fare || 0),
    0
  );

  const vehicleLegs = processedLegs.filter((l) => l.mode !== "walk");
  const transfersCount = Math.max(0, vehicleLegs.length - 1);

  // Reliability calculations
  const rawRoute = {
    totalMinutes,
    totalFare,
    legs: processedLegs,
    fareStatus: "verified",
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reliabilityDetails = calculateRouteReliability(rawRoute, scenario as any) as ReliabilityDetails | null;
  const hasUserConstraints = Boolean(
    constraints &&
      (constraints.maxBudget !== undefined ||
        constraints.maxWalkingDistanceMeters !== undefined ||
        constraints.maxTransfers !== undefined ||
        Boolean(constraints.requiredArrivalTime) ||
        Boolean(constraints.avoidCrowded))
  );
  const constraintsEvaluation = hasUserConstraints
    ? (evaluateRouteConstraints(
        rawRoute,
        constraints,
        constraints?.departureTime
      ) as ConstraintEvaluation | undefined)
    : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recommendationReason = generateRouteExplanation(
    { ...rawRoute, tag, reliabilityDetails, constraintsEvaluation, totalMinutes },
    hasUserConstraints ? constraints : undefined,
    scenario as any,
    isAlternative,
    baselineRoute as any
  ) as string;

  const hasHighCrowd = processedLegs.some((leg) => leg.crowd === "high");
  const hasMedCrowd = processedLegs.some((leg) => leg.crowd === "medium");
  const crowdLevel: CrowdLevel = hasHighCrowd ? "high" : hasMedCrowd ? "medium" : "low";

  const totalDelayMin = Math.max(0, ...processedLegs.map((leg) => leg.delayMin || 0));

  return {
    id,
    tag,
    title: formatRouteTitle(processedLegs),
    summary: processedLegs.map((leg) => leg.mode).join(" ➔ "),
    summaryModes: routeModes,
    totalDurationMinutes: totalMinutes,
    totalDistanceKm: plannerResponse.totalDistanceKm,
    distanceSource: plannerResponse.distanceSource,
    totalFare,
    carbonEmissionsKg: estimatedCarbonKg(processedLegs),
    caloriesBurned: 0,
    transfersCount,
    crowdLevel,
    delayMinutes: totalDelayMin,
    onTimeReliability: reliabilityDetails ? reliabilityDetails.reliabilityPercentage : 96,
    scheduledDurationMinutes: reliabilityDetails ? reliabilityDetails.scheduledDurationMinutes : totalMinutes,
    transferBufferMinutes: reliabilityDetails ? reliabilityDetails.transferBufferMinutes : 5,
    reliabilityDetails: reliabilityDetails ?? undefined,
    constraintsEvaluation,
    recommendationReason,
    isSimulatedAlternative: isAlternative,
    legs: processedLegs.map((leg, index) => {
      const ids = leg.stopIds || [leg.fromId, leg.toId];
      const coordinates = coordinatesFor(ids);

      return {
        legIndex: index,
        mode: leg.mode,
        from: leg.from,
        to: leg.to,
        durationMinutes: leg.minutes,
        distanceKm: leg.distanceKm || 0,
        distanceSource: leg.distanceSource,
        fare: leg.fare ?? 0,
        instruction: `Follow the ${leg.route || leg.mode} leg from ${leg.from} to ${leg.to}`,
        stopsCount: leg.stops,
        intermediateStops: ids.slice(1, -1).map((id) => stopName(id)),
        routeNumber: leg.mode === "bus" ? leg.route : undefined,
        fromStopId: leg.mode === "bus" ? leg.fromId : undefined,
        toStopId: leg.mode === "bus" ? leg.toId : undefined,
        scheduledTiming:
          leg.mode === "bus" && leg.route
            ? getScheduledBusTiming(leg.route, leg.fromId, leg.toId) || undefined
            : undefined,
        lineName:
          leg.mode === "metro"
            ? leg.route?.replace(/^metro:/, "")
            : undefined,
        provider: leg.mode === "bus" ? "GTFS bus data" : "GTFS transit data",
        crowdLevel: leg.crowd === "high" ? "high" : leg.crowd === "low" ? "low" : "medium",
        delayMinutes: leg.delayMin,
        coordinates:
          coordinates.length >= 2
            ? coordinates
            : coordinatesFor([leg.fromId, leg.toId]),
      };
    }),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RoutePlanRequest;

    if (!body || !body.origin?.query || !body.destination?.query) {
      return NextResponse.json(
        {
          success: false,
          error: "Origin and destination queries are required",
        },
        { status: 400 }
      );
    }

    if (body.city.toLowerCase() !== "delhi") {
      return NextResponse.json(
        {
          success: false,
          error: "Real route planning is currently available for Delhi NCR only",
        },
        { status: 400 }
      );
    }

    const requestedPriority = normalizeRoutingPriority(
      body.preferences?.routingPriority ?? "fastest"
    );
    const period = plannerPeriod(body.preferences?.period);
    const avoidCrowded = body.preferences?.avoidCrowded ?? body.constraints?.avoidCrowded ?? false;
    const constraints = body.constraints;
    const scenario = body.scenario?.active ? body.scenario : null;

    // 1. Calculate Baseline Routes (without scenario)
    const baselineFastest = planByName(body.origin.query, body.destination.query, {
      preference: "fastest",
      period,
      avoidCrowded,
      scenario: undefined,
    }) as PlannerResponse | { error: string };

    if ("error" in baselineFastest) {
      return NextResponse.json(
        { success: false, error: baselineFastest.error },
        { status: 404 }
      );
    }

    const baselineCheapest = planByName(body.origin.query, body.destination.query, {
      preference: "cheapest",
      period,
      avoidCrowded,
      scenario: undefined,
    }) as PlannerResponse | { error: string };

    const allowedModes = new Set(
      body.preferences?.allowedModes || ["metro", "bus", "auto", "walk"]
    );

    // Build baseline recommended route
    const baselineRecommendedRoute = buildPlannerRoute(
      baselineFastest,
      "route_baseline",
      "RECOMMENDED",
      constraints,
      null,
      false,
      null
    );

    // 2. Scenario-affected routing if scenario is active
    let primaryPlannerResponse = baselineFastest;
    let scenarioApplied = false;
    let comparison: { baselineRouteTitle: string; baselineDurationMinutes: number; simulatedDurationMinutes: number; delayImpactMinutes: number; impactExplanation: string; alternativeRecommended: boolean; alternativeExplanation?: string; } | null = null;

    if (scenario) {
      scenarioApplied = true;
      const scenarioPlan = planByName(body.origin.query, body.destination.query, {
        preference: requestedPriority,
        period,
        avoidCrowded,
        scenario,
      }) as PlannerResponse | { error: string };

      if (!("error" in scenarioPlan)) {
        primaryPlannerResponse = scenarioPlan;
      }
    }

    // 3. Candidate routes collection
    const candidateVariants: {
      id: string;
      tag: "FASTEST" | "CHEAPEST" | "RECOMMENDED" | "ECO";
      result: PlannerResponse;
      isAlternative?: boolean;
    }[] = [];

    // Main route under current conditions
    candidateVariants.push({
      id: scenarioApplied ? "route_simulated_current" : "route_real_planner",
      tag: "RECOMMENDED",
      result: primaryPlannerResponse,
      isAlternative: scenarioApplied,
    });

    // Cheapest alternative under current conditions
    const currentCheapest = scenarioApplied
      ? (planByName(body.origin.query, body.destination.query, {
          preference: "cheapest",
          period,
          avoidCrowded,
          scenario,
        }) as PlannerResponse)
      : baselineCheapest;

    if (!("error" in currentCheapest)) {
      candidateVariants.push({
        id: "route_real_cheapest",
        tag: "CHEAPEST",
        result: currentCheapest,
      });
    }

    // Metro-only alternative
    if (allowedModes.has("metro")) {
      const metroPlan = planMetroByName(
        body.origin.query,
        body.destination.query
      ) as PlannerResponse | { error: string };
      if (!("error" in metroPlan)) {
        candidateVariants.push({
          id: "route_real_metro",
          tag: "FASTEST",
          result: metroPlan,
        });
      }
    }

    // Walking-only alternative
    if (allowedModes.has("walk")) {
      const walkPlan = planWalkingByName(
        body.origin.query,
        body.destination.query
      ) as PlannerResponse | { error: string };
      if (!("error" in walkPlan)) {
        candidateVariants.push({
          id: "route_real_walking",
          tag: "ECO",
          result: walkPlan,
        });
      }
    }

    // If scenario is active, also compute an alternative that bypasses disrupted services
    if (scenarioApplied && scenario && (scenario.serviceDelays || scenario.disabledServices)) {
      const allDisrupted = [
        ...(scenario?.disabledServices || []),
        ...Object.keys(scenario?.serviceDelays || {}),
      ];
      const bypassPlan = planByName(body.origin.query, body.destination.query, {
        preference: requestedPriority,
        period,
        avoidCrowded: true,
        scenario: scenario ? {
          ...scenario,
          disabledServices: allDisrupted,
        } : { active: true, disabledServices: allDisrupted },
      }) as PlannerResponse | { error: string };

      if (!("error" in bypassPlan)) {
        candidateVariants.push({
          id: "route_simulated_bypass",
          tag: "RECOMMENDED",
          result: bypassPlan,
          isAlternative: true,
        });
      }
    }

    // 4. Build RouteOption objects
    const routes: RouteOption[] = [];
    const seenTitlesAndModes = new Set<string>();

    for (const variant of candidateVariants) {
      const candidate = buildPlannerRoute(
        variant.result,
        variant.id,
        variant.tag,
        constraints,
        scenario ?? undefined,
        variant.isAlternative,
        baselineRecommendedRoute
      );

      if (!candidate) continue;
      if (candidate.legs.some((leg) => !allowedModes.has(leg.mode))) continue;

      const signature = `${candidate.title}_${candidate.totalDurationMinutes}_${candidate.totalFare}`;
      if (!seenTitlesAndModes.has(signature)) {
        seenTitlesAndModes.add(signature);
        routes.push(candidate);
      }
    }

    if (routes.length === 0) {
      return NextResponse.json(
        { success: false, error: "No feasible route found meeting your transportation modes" },
        { status: 422 }
      );
    }

    // 5. Evaluate and enforce constraints
    const validRoutes = routes.filter((r) => r.constraintsEvaluation?.satisfied !== false);
    const hasConstraints = Boolean(
      constraints &&
        (constraints.maxBudget !== undefined ||
          constraints.maxWalkingDistanceMeters !== undefined ||
          constraints.maxTransfers !== undefined ||
          constraints.requiredArrivalTime ||
          constraints.avoidCrowded)
    );

    let constraintSummary: { hasConstraints: boolean; allSatisfied: boolean; unmetConstraints: string[]; explanation?: string; } | undefined = undefined;

    if (hasConstraints) {
      const allSatisfied = validRoutes.length > 0;
      const allViolations = [
        ...new Set(routes.flatMap((r) => r.constraintsEvaluation?.violations || [])),
      ];

      constraintSummary = {
        hasConstraints: true,
        allSatisfied,
        unmetConstraints: allSatisfied ? [] : allViolations,
        explanation: allSatisfied
          ? `Found ${validRoutes.length} route(s) satisfying all your hard constraints.`
          : `No route met all specified constraints (${allViolations.join("; ")}). Showing closest alternatives with detailed trade-offs.`,
      };
    }

    // 6. Rank routes
    // Priority: Constraint satisfaction first -> Then requested priority or reliability
    routes.sort((a, b) => {
      const aSat = a.constraintsEvaluation?.satisfied !== false ? 1 : 0;
      const bSat = b.constraintsEvaluation?.satisfied !== false ? 1 : 0;
      if (aSat !== bSat) return bSat - aSat; // Satisfied routes first

      if (requestedPriority === "cheapest") {
        return (a.totalFare ?? 999) - (b.totalFare ?? 999);
      }
      return a.totalDurationMinutes - b.totalDurationMinutes;
    });

    // Ensure the top route carries the RECOMMENDED tag
    routes[0].tag = "RECOMMENDED";

    // 7. Calculate comparison if scenario was active
    if (scenarioApplied && baselineRecommendedRoute) {
      const activeRecommended = routes[0];
      const baselineMins = baselineRecommendedRoute.totalDurationMinutes;
      const simulatedMins = activeRecommended.totalDurationMinutes;
      const delayDiff = Number((simulatedMins - baselineMins).toFixed(1));

      const delayedNames = Object.keys(scenario?.serviceDelays || {}).join(", ");
      const impactText =
        delayDiff > 0
          ? `Simulated conditions on ${delayedNames || "selected services"} add ~${delayDiff} min to your baseline journey (${baselineMins} min ➔ ${simulatedMins} min).`
          : delayDiff < 0
          ? `Alternative route is ~${Math.abs(delayDiff)} min faster than the baseline route under current disruptions.`
          : `Journey duration remains on track (~${simulatedMins} min) by utilizing alternative services.`;

      comparison = {
        baselineRouteTitle: baselineRecommendedRoute.title,
        baselineDurationMinutes: baselineMins,
        simulatedDurationMinutes: simulatedMins,
        delayImpactMinutes: Math.max(0, delayDiff),
        impactExplanation: impactText,
        alternativeRecommended: delayDiff > 0 || routes.some((r) => r.isSimulatedAlternative),
        alternativeExplanation: activeRecommended.recommendationReason,
      };
    }

    const firstLeg = routes[0].legs[0];
    const lastLeg = routes[0].legs.at(-1);

    const originCoordinates = firstLeg ? firstLeg.coordinates[0] || [28.6139, 77.209] : [28.6139, 77.209];
    const destCoordinates = lastLeg ? lastLeg.coordinates.at(-1) || [28.6139, 77.209] : [28.6139, 77.209];

    return NextResponse.json(
      {
        success: true,
        queryId: `req_${body.city.toLowerCase()}_${Date.now().toString(36)}`,
        timestamp: new Date().toISOString(),
        city: { id: "delhi", name: "Delhi NCR", currency: "₹" },
        origin: {
          name: firstLeg ? firstLeg.from : body.origin.query,
          lat: originCoordinates[0],
          lng: originCoordinates[1],
        },
        destination: {
          name: lastLeg ? lastLeg.to : body.destination.query,
          lat: destCoordinates[0],
          lng: destCoordinates[1],
        },
        summary: {
          totalRoutes: routes.length,
          recommendedRouteId: routes[0].id,
          fastestRouteId:
            routes.find((c) => c.tag === "FASTEST")?.id || routes[0].id,
          cheapestRouteId:
            routes.find((c) => c.tag === "CHEAPEST")?.id || routes[0].id,
        },
        routes,
        scenarioApplied,
        scenarioDetails: scenario,
        comparison,
        constraintSummary,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Route planning API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error calculating route",
      },
      { status: 500 }
    );
  }
}
