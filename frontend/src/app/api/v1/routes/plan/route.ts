
function addMinutesToTime(timeStr: string | null | undefined, minutesToAdd: number): string {
  if (!timeStr || !timeStr.includes(":")) return "Scheduled";
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return "Scheduled";
  const total = h * 60 + m + Math.round(minutesToAdd);
  const nextH = Math.floor((total % 1440) / 60);
  const nextM = total % 60;
  return `${String(nextH).padStart(2, "0")}:${String(nextM).padStart(2, "0")}`;
}

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
  TransitMode,
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
import { resolveCoordinates } from "@/lib/transitData";
import { fetchStationTrains, detectStationCode } from "@/lib/trainApi";

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
  lineName?: string;
  instruction?: string;
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
    const busPart = busRoutes.length === 1 ? `Bus ${busRoutes[0]}` : `Bus ${busRoutes.join(" ➔ ")}`;
    return busPart;
  }

  const hasAuto = legs.some((l) => l.mode === "auto" || l.lineName === "Local Auto");
  if (hasAuto) {
    return "Local Auto";
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

  const isDirectWalkingResult = id === "route_real_walking" || id === "route_direct_walk";

  const processedLegs: PlannerLeg[] = plannerResponse.legs.map((leg) => {
    // If walking time is more than 10 mins, replace with local auto:
    if (leg.mode === "walk" && leg.minutes > 10) {
      const dist = leg.distanceKm || Math.max(0.8, Math.round((leg.minutes / 12) * 10) / 10);
      const autoMinutes = Math.max(3, Math.round(dist * 2.5));
      const autoFare = Math.max(25, Math.round(dist * 12 + 10));

      return {
        ...leg,
        mode: "auto" as const,
        minutes: autoMinutes,
        distanceKm: dist,
        distanceSource: "road" as const,
        fare: autoFare,
        lineName: "Local Auto",
        instruction: `Take local auto to ${leg.to} (~${autoMinutes} min, ₹${autoFare})`,
        route: undefined,
      };
    }
    return leg;
  });
  const routeModes = [...new Set(processedLegs.map((leg) => leg.mode))];
  const isAllAuto = processedLegs.every((leg) => leg.mode === "auto");
  const isAllWalk = processedLegs.every((leg) => leg.mode === "walk");

  const totalMinutes = Number(
    processedLegs.reduce((sum, leg) => sum + leg.minutes, 0).toFixed(1)
  );
  const autoFareSum = processedLegs
    .filter((leg) => leg.mode === "auto")
    .reduce((sum, leg) => sum + (leg.fare || 0), 0);
  const transitFare =
    plannerResponse.totalFare !== undefined && plannerResponse.totalFare !== null && plannerResponse.totalFare > 0
      ? plannerResponse.totalFare
      : processedLegs
          .filter((leg) => leg.mode !== "auto")
          .reduce((sum, leg) => sum + (leg.fare || 0), 0);
  const totalFare = (transitFare ?? 0) + autoFareSum;

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
        fare: leg.fare !== undefined ? leg.fare : 0,
        instruction: leg.instruction || `Follow the ${leg.route || leg.mode} leg from ${leg.from} to ${leg.to}`,
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
          leg.lineName ||
          (leg.mode === "metro"
            ? leg.route?.replace(/^metro:/, "")
            : undefined),
        provider: leg.lineName?.includes("Auto")
          ? "Local Auto / Walk"
          : leg.mode === "bus"
          ? "GTFS bus data"
          : "GTFS transit data",
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
    console.log("PLAN_REQUEST:", body.origin?.query, "->", body.destination?.query, "modes:", body.preferences?.allowedModes);

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

    const hasBaseline = !("error" in baselineFastest);
    const baselineCheapest = planByName(body.origin.query, body.destination.query, {
      preference: "cheapest",
      period,
      avoidCrowded,
      scenario: undefined,
    }) as PlannerResponse | { error: string };


    const allowedModes = new Set(
body.preferences?.allowedModes || (body as any).selectedModes || ["metro", "bus", "train", "walk"]
    );

    // Build all baseline options to identify the true optimal baseline route
    const baselineCandidates: RouteOption[] = [];
    const baseOpt = hasBaseline ? buildPlannerRoute(baselineFastest, "base_fastest", "FASTEST", constraints, null, false, null) : null;
    if (baseOpt) baselineCandidates.push(baseOpt);

    if (!("error" in baselineCheapest)) {
      const cheapOpt = buildPlannerRoute(baselineCheapest, "base_cheapest", "CHEAPEST", constraints, null, false, null);
      if (cheapOpt) baselineCandidates.push(cheapOpt);
    }

    if (allowedModes.has("metro")) {
      const baseMetro = planMetroByName(body.origin.query, body.destination.query, { scenario: undefined }) as PlannerResponse | { error: string };
      if (!("error" in baseMetro)) {
        const metroOpt = buildPlannerRoute(baseMetro, "base_metro", "RECOMMENDED", constraints, null, false, null);
        if (metroOpt) baselineCandidates.push(metroOpt);
      }
    }

    baselineCandidates.sort((a, b) => {
      const aSat = a.constraintsEvaluation?.satisfied !== false ? 1 : 0;
      const bSat = b.constraintsEvaluation?.satisfied !== false ? 1 : 0;
      if (aSat !== bSat) return bSat - aSat;
      if (requestedPriority === "cheapest") {
        return (a.totalFare ?? 999) - (b.totalFare ?? 999);
      }
      return a.totalDurationMinutes - b.totalDurationMinutes;
    });

    const baselineRecommendedRoute = baselineCandidates[0] || baseOpt;

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
if (!("error" in primaryPlannerResponse)) {
      candidateVariants.push({
        id: scenarioApplied ? "route_simulated_current" : "route_real_planner",
        tag: "RECOMMENDED",
        result: primaryPlannerResponse,
        isAlternative: scenarioApplied,
      });
    }

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
        body.destination.query,
        { scenario: scenarioApplied ? scenario : undefined }
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
    const candidateByTitle = new Map<string, RouteOption>();

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
      // Access walking (to/from stations) is allowed on any transit route.
      // Pure walking routes are only allowed if the user selected "walk".
      const hasDisallowedTransit = candidate.legs.some(
        (leg) => leg.mode !== "walk" && leg.mode !== "auto" && !allowedModes.has(leg.mode)
      );
      if (hasDisallowedTransit) continue;

      const isWalkOnly = candidate.legs.every((leg) => leg.mode === "walk");
      if (isWalkOnly && !allowedModes.has("walk")) continue;

      const existing = candidateByTitle.get(candidate.title);
      if (!existing) {
        candidateByTitle.set(candidate.title, candidate);
      } else if (candidate.totalDurationMinutes < existing.totalDurationMinutes) {
        candidateByTitle.set(candidate.title, candidate);
      }
    }

    routes.push(...candidateByTitle.values());

    const originCoord = resolveCoordinates(body.city, body.origin.query, body.origin.lat, body.origin.lng);
    const destCoord = resolveCoordinates(body.city, body.destination.query, body.destination.lat, body.destination.lng);

    // 1. Check for Railway Stations in Origin or Destination
    const originStation = detectStationCode(body.origin.query);
    const destStation = detectStationCode(body.destination.query);
    let liveTrainBoardData: RouteOption["trainLiveBoard"] = undefined;

    if (originStation || destStation) {
      try {
        const queryStation = originStation || destStation;
        if (queryStation) {
          const stnData = await fetchStationTrains(queryStation);
        if (stnData && stnData.data?.trains?.length > 0) {
          liveTrainBoardData = {
            stationCode: stnData.data.station.code,
            stationName: stnData.data.station.name,
            trains: stnData.data.trains.slice(0, 5).map((t) => ({
              number: t.train.number,
              name: t.train.name,
              type: t.train.type,
              departure: t.stop.departure,
              destination: t.train.destination.name,
            })),
          };
          }
        }
      } catch (err) {
        console.warn("Live train board fetch skipped:", err);
      }
    }

    // Attach live train board to routes if available
    if (liveTrainBoardData) {
      for (const r of routes) {
        r.trainLiveBoard = liveTrainBoardData;
      }
    }

    // 3. Dynamic Indian Railways Train Route (RailRadar)
    // Only generate an actual train option if BOTH endpoints are recognized railway hubs
    if (allowedModes.has("train") && originStation && destStation && originStation !== destStation) {
      try {
        const trainData = await fetchStationTrains(originStation);
        if (trainData && trainData.data?.trains?.length > 0) {
          const matchingTrain =
            trainData.data.trains.find(
              (t) =>
                t.train.destination.code === destStation ||
                t.train.name.toLowerCase().includes(destStation.toLowerCase())
            ) || trainData.data.trains[0];

          const origStn = trainData.data.station;
          const destStnCoord = resolveCoordinates(body.city, body.destination.query);
          const railDistKm = Math.round(
            Math.sqrt(
              Math.pow((destStnCoord.lat - origStn.lat) * 111, 2) +
                Math.pow((destStnCoord.lng - origStn.lng) * 111 * Math.cos((origStn.lat * Math.PI) / 180), 2)
            ) * 10
          ) / 10;
          const railMinutes = Math.max(20, Math.round(railDistKm * 2.2));

          const depTime = matchingTrain.stop.departure || "Scheduled";
          const arrTime = matchingTrain.stop.arrival || addMinutesToTime(matchingTrain.stop.departure, railMinutes);

          const trainOption: RouteOption = {
            id: "route_railradar_train",
            title: `Indian Railways (${origStn.code} ➔ ${destStation})`,
            summary: `${depTime !== "Scheduled" ? `Dep: ${depTime} ➔ Arr: ${arrTime} • ` : ""}Train #${matchingTrain.train.number} ${matchingTrain.train.name}`,
            totalDurationMinutes: railMinutes + 10,
            totalDistanceKm: railDistKm,
            distanceSource: "road",
            totalFare: 40,
            summaryModes: ["train"],
            tag: "RECOMMENDED",
            carbonEmissionsKg: Math.round(railDistKm * 0.04 * 10) / 10,
            caloriesBurned: 35,
            transfersCount: 0,
            crowdLevel: "medium",
            delayMinutes: 0,
            onTimeReliability: 92,
            recommendationReason: `Live RailRadar API: Departs ${depTime} (${origStn.name}) ➔ Arrives ${arrTime} (${destStation}). ${matchingTrain.train.name} (#${matchingTrain.train.number})`,
            trainLiveBoard: liveTrainBoardData,
            legs: [
              {
                legIndex: 0,
                mode: "walk",
                from: origStn.name,
                to: `${origStn.name} Platform`,
                durationMinutes: 5,
                distanceKm: 0.2,
                fare: 0,
                instruction: `Enter ${origStn.name} (${origStn.code}) and proceed to platform by ${depTime}`,
                coordinates: [
                  [origStn.lat, origStn.lng],
                  [origStn.lat, origStn.lng],
                ],
              },
              {
                legIndex: 1,
                mode: "train",
                from: origStn.name,
                to: destStnCoord.name,
                durationMinutes: railMinutes,
                distanceKm: railDistKm,
                fare: 40,
                lineName: `${matchingTrain.train.name} (${matchingTrain.train.number})${depTime !== "Scheduled" ? ` · Dep ${depTime}` : ""}`,
                scheduledTiming: {
                  source: "static_gtfs",
                  routeId: matchingTrain.train.number,
                  routeName: matchingTrain.train.name,
                  fromStop: origStn.name,
                  toStop: destStation,
                  departureTime: depTime,
                  arrivalTime: arrTime,
                  durationMinutes: railMinutes,
                  note: `Train #${matchingTrain.train.number} • Type: ${matchingTrain.train.type || "Express"} • Days: ${(matchingTrain.train.runDays || []).join(", ").toUpperCase() || "Daily"}`,
                },
                instruction: `Board ${matchingTrain.train.name} (#${matchingTrain.train.number}). Scheduled Departure: ${depTime} ➔ Scheduled Arrival: ${arrTime}`,
                provider: "RailRadar Train API",
                statusMessage: `Scheduled Dep: ${depTime} • Arr: ${arrTime} • Type: ${matchingTrain.train.type || "Express"}`,
                coordinates: [
                  [origStn.lat, origStn.lng],
                  [destStnCoord.lat, destStnCoord.lng],
                ],
              },
              {
                legIndex: 2,
                mode: "walk",
                from: `${destStnCoord.name} Platform`,
                to: destStnCoord.name,
                durationMinutes: 5,
                distanceKm: 0.2,
                fare: 0,
                instruction: `Exit ${destStnCoord.name}`,
                coordinates: [
                  [destStnCoord.lat, destStnCoord.lng],
                  [destStnCoord.lat, destStnCoord.lng],
                ],
              },
            ],
          };
          routes.push(trainOption);
        }
      } catch (err) {
        console.warn("Train integration skipped:", err);
      }
    }

    const directDistKm = Math.round(
      Math.sqrt(
        Math.pow((destCoord.lat - originCoord.lat) * 111, 2) +
          Math.pow((destCoord.lng - originCoord.lng) * 111 * Math.cos((originCoord.lat * Math.PI) / 180), 2)
      ) * 10
    ) / 10;

    // 4. Bus routes come strictly from GTFS dataset (no synthetic fallback)

    if (allowedModes.has("walk")) {
      const hasWalkOnly = routes.some((r) => r.legs.every((l) => l.mode === "walk"));
      if (!hasWalkOnly && directDistKm <= 7.0) {
        const walkDist = Math.round(directDistKm * 1.2 * 10) / 10;
        const walkMins = Math.round(walkDist * 12);
        const directWalk: RouteOption = {
          id: "route_direct_walk",
          title: `Direct Walk (${originCoord.name} ➔ ${destCoord.name})`,
          summary: `Pedestrian walk route (${walkDist} km)`,
          totalDurationMinutes: walkMins,
          totalDistanceKm: walkDist,
          distanceSource: "straight-line",
          totalFare: 0,
          summaryModes: ["walk"],
          tag: "ECO",
          carbonEmissionsKg: 0,
          caloriesBurned: Math.round(walkDist * 55),
          transfersCount: 0,
          crowdLevel: "low",
          delayMinutes: 0,
          onTimeReliability: 99,
          recommendationReason: `Direct pedestrian walking route between ${originCoord.name} and ${destCoord.name}`,
          legs: [
            {
              legIndex: 0,
              mode: "walk",
              from: originCoord.name,
              to: destCoord.name,
              durationMinutes: walkMins,
              distanceKm: walkDist,
              fare: 0,
              instruction: `Walk from ${originCoord.name} to ${destCoord.name}`,
              coordinates: [
                [originCoord.lat, originCoord.lng],
                [destCoord.lat, destCoord.lng],
              ],
            },
          ],
        };
        routes.push(directWalk);
      }
    }

    if (routes.length === 0) {
      const isOnlyMetro = allowedModes.has("metro") && allowedModes.size === 1;
      const errorMsg = isOnlyMetro
        ? `No direct Metro line serves ${destCoord.name} (${destCoord.name} does not have a Metro station). Please enable Bus or Walk to view available transit options.`
        : "No feasible route found meeting your transportation modes. Please enable Bus or Walk.";
      return NextResponse.json(
        { success: false, error: errorMsg },
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

      // Collect all disrupted services
      const delayedServices = [
        ...Object.keys(scenario?.serviceDelays || {}),
        ...(scenario?.disabledServices || []),
      ];
      const crowdedStation = scenario?.stationCrowd ? Object.keys(scenario.stationCrowd)[0] : null;

      // Check if baseline route actually uses any of the disrupted services or stations
      const baselineUsesDisruptedService = baselineRecommendedRoute.legs.some((leg) => {
        if (delayedServices.length > 0) {
          for (const s of delayedServices) {
            const sLower = s.toLowerCase();
            const routeLower = (leg.routeNumber || leg.lineName || "").toLowerCase();
            if (routeLower && (routeLower.includes(sLower) || sLower.includes(routeLower))) return true;
            if (sLower.includes("blue") && (routeLower.includes("blue") || leg.lineColor === "#0072bb")) return true;
            if (sLower.includes("yellow") && (routeLower.includes("yellow") || leg.lineColor === "#ffcc00")) return true;
            if (sLower.includes("red") && routeLower.includes("red")) return true;
            if (sLower.includes("green") && routeLower.includes("green")) return true;
            if (sLower.includes("violet") && routeLower.includes("violet")) return true;
            if (sLower.includes("magenta") && routeLower.includes("magenta")) return true;
            if (sLower.includes("pink") && routeLower.includes("pink")) return true;
            if (sLower.includes("airport") && (routeLower.includes("airport") || routeLower.includes("orange"))) return true;
          }
        }
        if (crowdedStation) {
          const cLower = crowdedStation.toLowerCase();
          if (leg.from.toLowerCase().includes(cLower) || leg.to.toLowerCase().includes(cLower)) return true;
          if (leg.intermediateStops?.some((s) => s.toLowerCase().includes(cLower))) return true;
        }
        return false;
      });

      const delayedNames = delayedServices.map(s => s.replace("metro-", "Metro ").replace("-", " ")).join(", ");

      let impactText = "";
      let alternativeRecommended = false;
      let altExplanation: string | undefined = undefined;

      if (!baselineUsesDisruptedService && delayDiff === 0) {
        impactText = `Original journey (${baselineRecommendedRoute.title}) is unaffected because it does not use the disrupted service (${delayedNames || "simulated disruption"}). The scheduled route remains optimal at ${baselineMins} min.`;
        alternativeRecommended = false;
      } else if (delayDiff > 0) {
        const isBypass = activeRecommended.id === "route_simulated_bypass" || activeRecommended.isSimulatedAlternative;
        if (isBypass) {
          impactText = `Primary route disrupted by ${delayedNames || "delays"}. Recommended alternative reroutes via ${activeRecommended.title} taking ~${simulatedMins} min (+${delayDiff} min vs baseline).`;
          alternativeRecommended = true;
          altExplanation = `Alternative via ${activeRecommended.title} bypasses the disrupted lines to minimize delays.`;
        } else {
          impactText = `Simulated conditions on ${delayedNames || "selected services"} add ~${delayDiff} min to your baseline journey (${baselineMins} min ➔ ${simulatedMins} min).`;
          const bypassOption = routes.find(r => r.id === "route_simulated_bypass");
          if (bypassOption && bypassOption.totalDurationMinutes < simulatedMins) {
            alternativeRecommended = true;
            altExplanation = `Alternative option (${bypassOption.title}) saves ~${Math.round(simulatedMins - bypassOption.totalDurationMinutes)} min by bypassing the disruption.`;
          }
        }
      } else if (delayDiff < 0) {
        impactText = `Alternative route (${activeRecommended.title}) is ~${Math.abs(delayDiff)} min faster under current disruptions.`;
        alternativeRecommended = true;
        altExplanation = activeRecommended.recommendationReason;
      } else {
        impactText = `Journey duration remains on track (~${simulatedMins} min). No delay is incurred on this route.`;
        alternativeRecommended = false;
      }

      comparison = {
        baselineRouteTitle: baselineRecommendedRoute.title,
        baselineDurationMinutes: baselineMins,
        simulatedDurationMinutes: simulatedMins,
        delayImpactMinutes: Math.max(0, delayDiff),
        impactExplanation: impactText,
        alternativeRecommended,
        alternativeExplanation: altExplanation,
      };
    }

    const unavailableModes: {
      mode: TransitMode;
      reason: string;
      source: "dataset" | "api";
    }[] = [];

    if (allowedModes.has("train")) {
      const hasTrain = routes.some((r) => r.legs.some((l) => l.mode === "train"));
      if (!hasTrain) {
        let reason = "Train route requires recognized Indian Railways hub stations at both origin and destination.";
        if (originStation && !destStation) {
          reason = `${destCoord.name} does not have an Indian Railways station in the dataset.`;
        } else if (!originStation && destStation) {
          reason = `${originCoord.name} does not have an Indian Railways station in the dataset.`;
        } else if (originStation && destStation) {
          reason = `No direct trains available between ${originStation} and ${destStation} according to the Indian Railways schedule.`;
        } else {
          reason = `Neither ${originCoord.name} nor ${destCoord.name} is an Indian Railways mainline station (both are served by city transit).`;
        }
        unavailableModes.push({
          mode: "train",
          reason,
          source: "api",
        });
      }
    }

    if (allowedModes.has("metro")) {
      const hasMetro = routes.some((r) => r.legs.some((l) => l.mode === "metro"));
      if (!hasMetro) {
        let reason = `No direct or connecting Metro line serves ${destCoord.name} in the DMRC GTFS dataset.`;
        if (destCoord.name.toLowerCase().includes("crossing")) {
          reason = "Crossings Republik does not have a Metro station in the NCR GTFS dataset (nearest is Shaheed Sthal, ~6.2 km).";
        }
        unavailableModes.push({
          mode: "metro",
          reason,
          source: "dataset",
        });
      }
    }

    if (allowedModes.has("bus")) {
      const hasBus = routes.some((r) => r.legs.some((l) => l.mode === "bus"));
      if (!hasBus) {
        unavailableModes.push({
          mode: "bus",
          reason: directDistKm > 50
            ? "Distance exceeds standard Delhi NCR bus transit coverage (>50 km)."
            : "No active bus service found in the GTFS network dataset for this corridor.",
          source: "dataset",
        });
      }
    }

    if (allowedModes.has("walk")) {
      const hasWalk = routes.some((r) => r.legs.every((l) => l.mode === "walk"));
      if (!hasWalk) {
        unavailableModes.push({
          mode: "walk",
          reason: `Pedestrian distance (~${directDistKm} km) exceeds practical walking range (>7 km).`,
          source: "dataset",
        });
      }
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
        unavailableModes,
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
