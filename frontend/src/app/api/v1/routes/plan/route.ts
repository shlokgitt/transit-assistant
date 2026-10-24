import { NextRequest, NextResponse } from "next/server";
import { RoutePlanRequest } from "@/types/transit";
import { planRoutesMock } from "@/lib/transitData";

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

    const response = planRoutesMock(body);
    return NextResponse.json(response, { status: 200 });
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
