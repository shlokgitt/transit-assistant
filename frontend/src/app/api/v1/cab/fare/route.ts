import { NextRequest, NextResponse } from "next/server";

// The Express backend (api/server.js) runs on port 3000
// This Next.js route forwards the request to the Express server or computes the fare directly
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

function computeRoadDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const straight = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(0.8, Math.round(straight * 1.28 * 10) / 10);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const dep_lat = searchParams.get("dep_lat");
    const dep_lng = searchParams.get("dep_lng");
    const arr_lat = searchParams.get("arr_lat");
    const arr_lng = searchParams.get("arr_lng");

    // Validate required coordinates
    if (!dep_lat || !dep_lng || !arr_lat || !arr_lng) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required coordinates: dep_lat, dep_lng, arr_lat, arr_lng",
        },
        { status: 400 }
      );
    }

    const dLat = parseFloat(dep_lat);
    const dLng = parseFloat(dep_lng);
    const aLat = parseFloat(arr_lat);
    const aLng = parseFloat(arr_lng);

    const fallbackDistance = computeRoadDistance(dLat, dLng, aLat, aLng);
    const fallbackDuration = Math.max(5, Math.round(4 + fallbackDistance * 2.4));

    let routeInfo = {
      departure: "Origin",
      arrival: "Destination",
      distanceKm: fallbackDistance,
      durationMinutes: fallbackDuration,
    };

    let fares = {
      baseline_taxi: Math.round(25 + fallbackDistance * 14),
      uber_go: Math.max(60, Math.round(55 + fallbackDistance * 13)),
      ola_mini: Math.max(50, Math.round(50 + fallbackDistance * 12.5)),
      rapido_bike: Math.max(30, Math.round(20 + fallbackDistance * 5)),
    };

    // Forward request to Express backend (api/server.js)
    try {
      const backendResponse = await fetch(
        `${BACKEND_URL}/api/compare?dep_lat=${dep_lat}&dep_lng=${dep_lng}&arr_lat=${arr_lat}&arr_lng=${arr_lng}`,
        { signal: AbortSignal.timeout(2500) }
      );

      if (backendResponse.ok) {
        const data = await backendResponse.json();
        if (data && data.route && typeof data.route.distance_km === "number" && data.route.distance_km > 0) {
          routeInfo = {
            departure: data.route.departure || routeInfo.departure,
            arrival: data.route.arrival || routeInfo.arrival,
            distanceKm: Number(data.route.distance_km.toFixed(1)),
            durationMinutes: data.route.duration_mins || routeInfo.durationMinutes,
          };
          if (data.fares) {
            fares = {
              baseline_taxi: data.fares.baseline_taxi ?? fares.baseline_taxi,
              uber_go: data.fares.uber_go ?? fares.uber_go,
              ola_mini: data.fares.ola_mini ?? fares.ola_mini,
              rapido_bike: data.fares.rapido_bike ?? fares.rapido_bike,
            };
          }
        }
      }
    } catch {
      // Backend unavailable; graceful fallback to computed road distance
    }

    return NextResponse.json({
      success: true,
      route: routeInfo,
      fares,
      cabLeg: {
        legIndex: 0,
        mode: "cab" as const,
        from: routeInfo.departure,
        to: routeInfo.arrival,
        durationMinutes: routeInfo.durationMinutes,
        distanceKm: routeInfo.distanceKm,
        fare: fares.uber_go,
        provider: "Uber Go / Ola Mini",
        instruction: `Direct cab ride from ${routeInfo.departure} to ${routeInfo.arrival}`,
        coordinates: [
          [dLat, dLng],
          [aLat, aLng],
        ],
      },
    });
  } catch (error) {
    console.error("Cab fare API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error fetching cab fare",
      },
      { status: 500 }
    );
  }
}
