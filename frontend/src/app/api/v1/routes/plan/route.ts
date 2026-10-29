import { NextRequest, NextResponse } from "next/server";
import { RoutePlanRequest, RoutingPriority } from "@/types/transit";
import {
  periodFor,
  planMetroByName,
  planWalkingByName,
  planByName,
  stopCoordinates,
  stopName,
  findStops,
} from "../../../../../../../route.js";
import { resolveCoordinates } from "@/lib/transitData";

type PlannerLeg = {
  mode: "walk" | "bus" | "metro";
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

function computeHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function generateCurvedPoints(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  steps = 8
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = start.lat + (end.lat - start.lat) * t;
    const lng = start.lng + (end.lng - start.lng) * t;
    const bend = Math.sin(t * Math.PI) * 0.002;
    points.push([+lat.toFixed(6), +(lng + bend).toFixed(6)]);
  }
  return points;
}

function resolvePointCoordinates(
  query: string,
  city: string,
  explicitLat?: number,
  explicitLng?: number
): { name: string; lat: number; lng: number } {
  if (explicitLat && explicitLng) {
    return { name: query, lat: explicitLat, lng: explicitLng };
  }
  try {
    const gtfs = findStops(query);
    if (gtfs && gtfs.length > 0) {
      return { name: gtfs[0].name, lat: gtfs[0].lat, lng: gtfs[0].lon };
    }
  } catch {
    // ignore
  }
  return resolveCoordinates(city, query, explicitLat, explicitLng);
}

async function buildCabOption(
  origin: { name: string; lat: number; lng: number },
  destination: { name: string; lat: number; lng: number }
) {
  const straightKm = computeHaversineDistanceKm(
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng
  );
  // Urban driving distance in Delhi is ~1.28x straight line distance, with a minimum of 0.8 km
  const calculatedRoadKm = Math.max(0.8, Number((straightKm * 1.28).toFixed(1)));
  const calculatedDuration = Math.max(5, Math.round(4 + calculatedRoadKm * 2.4));

  let distanceKm = calculatedRoadKm;
  let durationMinutes = calculatedDuration;
  let cabFare = Math.max(60, Math.round(55 + calculatedRoadKm * 13));

  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
    const fareRes = await fetch(
      `${backendUrl}/api/compare?dep_lat=${origin.lat}&dep_lng=${origin.lng}&arr_lat=${destination.lat}&arr_lng=${destination.lng}`,
      { signal: AbortSignal.timeout(2000) }
    );
    if (fareRes.ok) {
      const fareData = await fareRes.json();
      if (typeof fareData.route?.distance_km === "number" && fareData.route.distance_km > 0) {
        distanceKm = Number(fareData.route.distance_km.toFixed(1));
      }
      if (typeof fareData.route?.duration_mins === "number" && fareData.route.duration_mins > 0) {
        durationMinutes = Math.round(fareData.route.duration_mins);
      }
      if (typeof fareData.fares?.uber_go === "number" && fareData.fares.uber_go > 0) {
        cabFare = Math.round(fareData.fares.uber_go);
      }
    }
  } catch {
    // Graceful fallback to real calculated road distance and fares
  }

  const coordinates = generateCurvedPoints(origin, destination);

  return {
    id: "route_cab_direct",
    tag: "COMFORT" as const,
    title: "Direct Cab (Uber / Ola)",
    summary: "Door-to-door Cab",
    summaryModes: ["cab" as const],
    totalDurationMinutes: durationMinutes,
    totalDistanceKm: distanceKm,
    distanceSource: "road" as const,
    totalFare: cabFare,
    carbonEmissionsKg: +(distanceKm * 0.16).toFixed(2),
    caloriesBurned: 0,
    transfersCount: 0,
    crowdLevel: "low" as const,
    delayMinutes: 2,
    onTimeReliability: 95,
    legs: [
      {
        legIndex: 0,
        mode: "cab" as const,
        from: origin.name,
        to: destination.name,
        durationMinutes,
        distanceKm,
        distanceSource: "road" as const,
        fare: cabFare,
        provider: "Uber Go / Ola Mini",
        instruction: `Direct cab from ${origin.name} to ${destination.name}`,
        coordinates,
      },
    ],
  };
}

function estimatedCarbonKg(legs: PlannerLeg[]) {
  const gramsPerKm: Record<PlannerLeg["mode"], number> = {
    walk: 0,
    metro: 0.04,
    bus: 0.08,
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

function buildPlannerRoute(
  plannerResponse: PlannerResponse,
  id: string,
  tag: "FASTEST" | "CHEAPEST" | "RECOMMENDED" | "ECO"
) {
  const firstLeg = plannerResponse.legs[0];
  const routeModes = [
    ...new Set(plannerResponse.legs.map((leg) => leg.mode)),
  ];

  if (!firstLeg) return null;

  return {
    id,
    tag,
    title: `${firstLeg.route || firstLeg.mode} route`,
    summary: plannerResponse.legs.map((leg) => leg.mode).join(" ➔ "),
    summaryModes: routeModes,
    totalDurationMinutes: plannerResponse.totalMinutes,
    totalDistanceKm: plannerResponse.totalDistanceKm,
    distanceSource: plannerResponse.distanceSource,
    totalFare: plannerResponse.totalFare ?? 0,
    carbonEmissionsKg: estimatedCarbonKg(plannerResponse.legs),
    caloriesBurned: 0,
    transfersCount: Math.max(0, routeModes.length - 1),
    crowdLevel: "unknown" as const,
    delayMinutes: Math.max(
      0,
      ...plannerResponse.legs.map((leg) => leg.delayMin || 0)
    ),
    onTimeReliability: 100,
    legs: plannerResponse.legs.map((leg, index) => {
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

    const allowedModes = new Set(
      body.preferences?.allowedModes || ["metro", "bus", "walk"]
    );

    // ── CAB-ONLY mode: directly compute and return the cab route ──
    if (allowedModes.size === 1 && allowedModes.has("cab")) {
      const origin = resolvePointCoordinates(
        body.origin.query,
        body.city,
        body.origin.lat,
        body.origin.lng
      );
      const destination = resolvePointCoordinates(
        body.destination.query,
        body.city,
        body.destination.lat,
        body.destination.lng
      );

      const cabRoute = await buildCabOption(origin, destination);

      return NextResponse.json({
        success: true,
        queryId: `req_${body.city.toLowerCase()}_cab_${Date.now().toString(36)}`,
        timestamp: new Date().toISOString(),
        city: { id: "delhi", name: "Delhi NCR", currency: "₹" },
        origin: { name: origin.name, lat: origin.lat, lng: origin.lng },
        destination: { name: destination.name, lat: destination.lat, lng: destination.lng },
        summary: {
          totalRoutes: 1,
          recommendedRouteId: cabRoute.id,
          fastestRouteId: cabRoute.id,
          cheapestRouteId: cabRoute.id,
        },
        routes: [cabRoute],
      });
    }

    // ── Non-transit only mode (e.g. cab + walk, or cab + auto) ──
    if (!allowedModes.has("bus") && !allowedModes.has("metro")) {
      const routes = [];
      const origin = resolvePointCoordinates(
        body.origin.query,
        body.city,
        body.origin.lat,
        body.origin.lng
      );
      const destination = resolvePointCoordinates(
        body.destination.query,
        body.city,
        body.destination.lat,
        body.destination.lng
      );

      if (allowedModes.has("cab")) {
        const cabRoute = await buildCabOption(origin, destination);
        routes.push(cabRoute);
      }

      if (allowedModes.has("walk")) {
        const walkingResponse = planWalkingByName(
          body.origin.query,
          body.destination.query
        ) as PlannerResponse | { error: string };

        if (!("error" in walkingResponse)) {
          const walkingLeg = walkingResponse.legs[0];
          const walkingCoordinates = coordinatesFor([
            walkingLeg.fromId,
            walkingLeg.toId,
          ]);
          routes.push({
            id: "route_real_walking",
            tag: "ECO" as const,
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
          });
        }
      }

      if (routes.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `No route is available using only: ${[...allowedModes].join(", ")}`,
          },
          { status: 422 }
        );
      }

      const primary = routes[0];
      return NextResponse.json({
        success: true,
        queryId: `req_${body.city.toLowerCase()}_direct_${Date.now().toString(36)}`,
        timestamp: new Date().toISOString(),
        city: { id: "delhi", name: "Delhi NCR", currency: "₹" },
        origin: { name: origin.name, lat: origin.lat, lng: origin.lng },
        destination: { name: destination.name, lat: destination.lat, lng: destination.lng },
        summary: {
          totalRoutes: routes.length,
          recommendedRouteId: primary.id,
          fastestRouteId: primary.id,
          cheapestRouteId: primary.id,
        },
        routes,
      });
    }

    // ── Transit route planning ──
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
      // If transit routing fails, check if cab was allowed and return cab route
      if (allowedModes.has("cab")) {
        const origin = resolvePointCoordinates(
          body.origin.query,
          body.city,
          body.origin.lat,
          body.origin.lng
        );
        const destination = resolvePointCoordinates(
          body.destination.query,
          body.city,
          body.destination.lat,
          body.destination.lng
        );
        const cabRoute = await buildCabOption(origin, destination);
        return NextResponse.json({
          success: true,
          queryId: `req_${body.city.toLowerCase()}_cab_${Date.now().toString(36)}`,
          timestamp: new Date().toISOString(),
          city: { id: "delhi", name: "Delhi NCR", currency: "₹" },
          origin: { name: origin.name, lat: origin.lat, lng: origin.lng },
          destination: { name: destination.name, lat: destination.lat, lng: destination.lng },
          summary: {
            totalRoutes: 1,
            recommendedRouteId: cabRoute.id,
            fastestRouteId: cabRoute.id,
            cheapestRouteId: cabRoute.id,
          },
          routes: [cabRoute],
        });
      }

      return NextResponse.json(
        { success: false, error: plannerResponse.error },
        { status: 404 }
      );
    }

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
      .filter((route): route is NonNullable<typeof route> => route !== null);

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
        const candidate = buildPlannerRoute(
          alternative.result as PlannerResponse,
          alternative.id,
          alternative.tag
        );
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

    // ── Include Cab alternative when allowed ──
    if (allowedModes.has("cab")) {
      const origin = {
        name: firstLeg.from,
        lat: originStop.lat,
        lng: originStop.lon,
      };
      const destination = {
        name: lastLeg.to,
        lat: destinationStop.lat,
        lng: destinationStop.lon,
      };
      const cabRoute = await buildCabOption(origin, destination);
      routes.push(cabRoute);
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
