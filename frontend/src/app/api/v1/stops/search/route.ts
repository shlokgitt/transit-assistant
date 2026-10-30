import { NextRequest, NextResponse } from "next/server";
import { findStops, stopDetails } from "../../../../../../backend/route.js";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city") || "delhi";
    const query = searchParams.get("q") || "";

    if (city.toLowerCase() !== "delhi") {
      return NextResponse.json(
        { results: [], error: "Real stop search is currently available for Delhi NCR only" },
        { status: 400 }
      );
    }

    if (!query.trim()) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    const matches = findStops(query);
    const results = matches
      .map((stop) => stopDetails(stop.id))
      .filter((stop): stop is NonNullable<ReturnType<typeof stopDetails>> => stop !== null)
      .slice(0, 8)
      .map((stop) => ({
        id: stop.id,
        name: stop.name,
        type: stop.type,
        city: stop.city,
        line: stop.lines.join(" / ") || undefined,
        lat: stop.lat,
        lng: stop.lng,
      }));

    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    console.error("Stop search API error:", error);
    return NextResponse.json(
      { results: [], error: "Failed to search stops" },
      { status: 500 }
    );
  }
}
