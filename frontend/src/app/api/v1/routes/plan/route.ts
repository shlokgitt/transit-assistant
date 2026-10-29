import { NextRequest, NextResponse } from "next/server";
import { RoutePlanRequest, RoutingPriority } from "@/types/transit";
import {
  periodFor,
  planMetroByName,
  planWalkingByName,
  planByName,
  stopCoordinates,
  stopName,
} from "../../../../../../backend/route.js";

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
  tag: "FASTEST" | "CHEAPEST" | "RECOMMENDED" | "ECO"
) {
  const firstLeg = plannerResponse.legs[0];
  if (!firstLeg) return null;

  // Keep transit legs as pure walk/transit - do not inject auto into planned routes
  const processedLegs = plannerResponse.legs;

  const routeModes = [
    ...new Set(processedLegs.map((leg) => leg.mode)),
  ];

  const totalMinutes = Number(
    processedLegs.reduce((sum, leg) => sum + leg.minutes, 0).toFixed(1)
  );
  const totalFare = processedLegs.reduce(
    (sum, leg) => sum + (leg.fare || 0),
    0
  );

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
    transfersCount: Math.max(0, routeModes.length - 1),
    crowdLevel: "unknown" as const,
    delayMinutes: Math.max(
      0,
      ...processedLegs.map((leg) => leg.delayMin || 0)
    ),
    onTimeReliability: 100,
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
        lineName:
          leg.mode === "metro"
            ? leg.route?.replace(/^metro:/, "")
            : undefined,
        provider: leg.mode === "bus" ? "GTFS bus data" : "GTFS transit data",
        crowdLevel: leg.crowd === "high" ? "high" : "medium",
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

    const plannerResponse = planByName(
      body.origin.query,
      body.destination.query,
      {
        preference: requestedPriority,
        period: plannerPeriod(body.preferences?.period),
        avoidCrowded: body.preferences?.avoidCrowded ?? false,
      }
    ) as PlannerResponse | { error: string };

    if ("error" in plannerResponse) {
      return NextResponse.json(
        { success: false, error: plannerResponse.error },
        { status: 404 }
      );
    }

    const allowedModes = new Set(
      body.preferences?.allowedModes || ["metro", "bus", "auto", "walk"]
    );

    if (allowedModes.size === 1 && allowedModes.has("walk")) {
      const walkingResponse = planWalkingByName(
        body.origin.query,
        body.destination.query
      ) as PlannerResponse | { error: string };

      if ("error" in walkingResponse) {
        return NextResponse.json(
          { success: false, error: walkingResponse.error },
          { status: 404 }
        );
      }

      const walkingLeg = walkingResponse.legs[0];
      const walkingCoordinates = coordinatesFor([
        walkingLeg.fromId,
        walkingLeg.toId,
      ]);
      const route = {
        id: "route_real_walking",
        tag: "RECOMMENDED" as const,
        title: "Walking route",
        summary: "Walk",
        summaryModes: ["walk" as const],
        totalDurationMinutes: walkingResponse.totalMinutes,
        totalDistanceKm: walkingResponse.totalDistanceKm,
        distanceSource: walkingResponse.distanceSource,
        totalFare: 0,
        carbonEmissionsKg: 0,
        caloriesBurned: 0,
        transfersCount: 0,
        crowdLevel: "low" as const,
        delayMinutes: 0,
        onTimeReliability: 100,
        legs: [
          {
            legIndex: 0,
            mode: "walk" as const,
            from: walkingLeg.from,
            to: walkingLeg.to,
            durationMinutes: walkingLeg.minutes,
            distanceKm: walkingLeg.distanceKm || 0,
            distanceSource: walkingLeg.distanceSource,
            fare: 0,
            instruction: `Walk from ${walkingLeg.from} to ${walkingLeg.to}`,
            coordinates: walkingCoordinates,
          },
        ],
      };

      return NextResponse.json({
        success: true,
        queryId: `req_${body.city.toLowerCase()}_walk_${Date.now().toString(36)}`,
        timestamp: new Date().toISOString(),
        city: { id: "delhi", name: "Delhi NCR", currency: "₹" },
        origin: {
          name: walkingLeg.from,
          lat: walkingCoordinates[0][0],
          lng: walkingCoordinates[0][1],
        },
        destination: {
          name: walkingLeg.to,
          lat: walkingCoordinates[1][0],
          lng: walkingCoordinates[1][1],
        },
        summary: {
          totalRoutes: 1,
          recommendedRouteId: route.id,
          fastestRouteId: route.id,
          cheapestRouteId: route.id,
        },
        routes: [route],
      });
    }

    if (allowedModes.size === 1 && allowedModes.has("metro")) {
      const metroResponse = planMetroByName(
        body.origin.query,
        body.destination.query
      ) as PlannerResponse | { error: string };

      if ("error" in metroResponse) {
        return NextResponse.json(
          { success: false, error: metroResponse.error },
          { status: 404 }
        );
      }

      const firstLeg = metroResponse.legs[0];
      const lastLeg = metroResponse.legs.at(-1);
      if (!firstLeg || !lastLeg) {
        return NextResponse.json(
          { success: false, error: "The planner returned no metro legs" },
          { status: 502 }
        );
      }

      const route = {
        id: "route_real_metro",
        tag: "RECOMMENDED" as const,
        title: "Metro route",
        summary: metroResponse.legs.map((leg) => leg.mode).join(" ➔ "),
        summaryModes: [
          ...new Set(metroResponse.legs.map((leg) => leg.mode)),
        ] as ("metro" | "walk")[],
        totalDurationMinutes: metroResponse.totalMinutes,
        totalDistanceKm: metroResponse.totalDistanceKm,
        distanceSource: metroResponse.distanceSource,
        totalFare: metroResponse.totalFare,
        carbonEmissionsKg: estimatedCarbonKg(metroResponse.legs),
        caloriesBurned: 0,
        transfersCount: Math.max(
          0,
          metroResponse.legs.filter(
            (leg, index) =>
              index > 0 &&
              leg.mode === "metro" &&
              metroResponse.legs[index - 1]?.mode === "metro" &&
              leg.route !== metroResponse.legs[index - 1]?.route
          ).length
        ),
        crowdLevel: "unknown" as const,
        delayMinutes: 0,
        onTimeReliability: 100,
        legs: metroResponse.legs.map((leg, index) => {
          const coordinates = coordinatesFor(leg.stopIds || [leg.fromId, leg.toId]);
          return {
            legIndex: index,
            mode: leg.mode,
            from: leg.from,
            to: leg.to,
            durationMinutes: leg.minutes,
            distanceKm: leg.distanceKm || 0,
            distanceSource: leg.distanceSource,
            fare: leg.fare ?? 0,
            instruction: `Follow the ${leg.mode} leg from ${leg.from} to ${leg.to}`,
            lineName:
              leg.mode === "metro"
                ? leg.route?.replace(/^metro:/, "")
                : undefined,
            stopsCount: leg.stops,
            coordinates,
          };
        }),
      };

      const originStop = stopCoordinates(firstLeg.fromId);
      const destinationStop = stopCoordinates(lastLeg.toId);
      if (!originStop || !destinationStop) {
        return NextResponse.json(
          { success: false, error: "The planner returned an unknown stop" },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        queryId: `req_${body.city.toLowerCase()}_metro_${Date.now().toString(36)}`,
        timestamp: new Date().toISOString(),
        city: { id: "delhi", name: "Delhi NCR", currency: "₹" },
        origin: { name: firstLeg.from, lat: originStop.lat, lng: originStop.lon },
        destination: {
          name: lastLeg.to,
          lat: destinationStop.lat,
          lng: destinationStop.lon,
        },
        summary: {
          totalRoutes: 1,
          recommendedRouteId: route.id,
          fastestRouteId: route.id,
          cheapestRouteId: route.id,
        },
        routes: [route],
      });
    }

    const routeModes = [
      ...new Set(plannerResponse.legs.map((leg) => leg.mode)),
    ];

    if (routeModes.some((mode) => !allowedModes.has(mode))) {
      return NextResponse.json(
        {
          success: false,
          error: `No route is available using only: ${[...allowedModes].join(", ")}`,
        },
        { status: 422 }
      );
    }

    const firstLeg = plannerResponse.legs[0];
    const lastLeg = plannerResponse.legs.at(-1);
    if (!firstLeg || !lastLeg) {
      return NextResponse.json(
        { success: false, error: "The planner returned no navigable legs" },
        { status: 502 }
      );
    }

    const originStop = stopCoordinates(firstLeg.fromId);
    const destinationStop = stopCoordinates(lastLeg.toId);
    if (!originStop || !destinationStop) {
      return NextResponse.json(
        { success: false, error: "The planner returned an unknown stop" },
        { status: 502 }
      );
    }

    const variants = [
      {
        id: "route_real_planner",
        tag: "RECOMMENDED" as const,
        preference: requestedPriority,
      },
      {
        id: "route_real_fastest",
        tag: "FASTEST" as const,
        preference: "fastest" as const,
      },
      {
        id: "route_real_cheapest",
        tag: "CHEAPEST" as const,
        preference: "cheapest" as const,
      },
    ];

    const routes = variants
      .map((variant) => {
        const result =
          variant.preference === requestedPriority
            ? plannerResponse
            : planByName(body.origin.query, body.destination.query, {
                preference: variant.preference,
                period: plannerPeriod(body.preferences?.period),
                avoidCrowded: body.preferences?.avoidCrowded ?? false,
              });

        if (!result || "error" in result) return null;
        const candidate = buildPlannerRoute(result as PlannerResponse, variant.id, variant.tag);
        if (!candidate || candidate.legs.some((leg) => !allowedModes.has(leg.mode))) {
          return null;
        }
        return candidate;
      })
      .filter((route): route is NonNullable<typeof route> => route !== null)

    const explicitAlternatives = [
      {
        id: "route_real_metro",
        tag: "FASTEST" as const,
        enabled: allowedModes.has("metro"),
        result: planMetroByName(
          body.origin.query,
          body.destination.query
        ),
      },
      {
        id: "route_real_walking",
        tag: "ECO" as const,
        enabled: allowedModes.has("walk"),
        result: planWalkingByName(
          body.origin.query,
          body.destination.query
        ),
      },
    ]
      .filter((alternative) => alternative.enabled)
      .map((alternative) => {
        if ("error" in alternative.result) return null;
        const candidate = buildPlannerRoute(alternative.result as PlannerResponse, alternative.id, alternative.tag);
        if (!candidate || candidate.legs.some((leg) => !allowedModes.has(leg.mode))) {
          return null;
        }
        return candidate;
      })
      .filter((route): route is NonNullable<typeof route> => route !== null);

    const routeIds = new Set(routes.map((route) => route.id));
    for (const alternative of explicitAlternatives) {
      if (!routeIds.has(alternative.id)) {
        routes.push(alternative);
      }
    }

    const recommendedRoute =
      routes.find((route) => route.tag === "RECOMMENDED") || routes[0];
    if (!recommendedRoute) {
      return NextResponse.json(
        { success: false, error: "No route is available using the selected modes" },
        { status: 422 }
      );
    }

    const route = recommendedRoute;

    return NextResponse.json(
      {
        success: true,
        queryId: `req_${body.city.toLowerCase()}_${Date.now().toString(36)}`,
        timestamp: new Date().toISOString(),
        city: { id: "delhi", name: "Delhi NCR", currency: "₹" },
        origin: {
          name: firstLeg.from,
          lat: originStop.lat,
          lng: originStop.lon,
        },
        destination: {
          name: lastLeg.to,
          lat: destinationStop.lat,
          lng: destinationStop.lon,
        },
        summary: {
          totalRoutes: routes.length,
          recommendedRouteId: route.id,
          fastestRouteId:
            routes.find((candidate) => candidate.tag === "FASTEST")?.id || route.id,
          cheapestRouteId:
            routes.find((candidate) => candidate.tag === "CHEAPEST")?.id || route.id,
        },
        routes,
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
