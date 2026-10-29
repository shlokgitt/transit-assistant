import { NextRequest, NextResponse } from "next/server";
import { findStops, stopDetails } from "../../../../../../backend/route.js";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") || "delhi";
  const query = searchParams.get("q") || "";

  if (city.toLowerCase() !== "delhi") {
    return NextResponse.json(
      { results: [], error: "Real stop search is currently available for Delhi NCR only" },
      { status: 400 }
    );
  }

  const results = findStops(query)
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
}
