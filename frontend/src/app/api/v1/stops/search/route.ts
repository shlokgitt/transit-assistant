import { NextRequest, NextResponse } from "next/server";
import { findStops, stopDetails } from "../../../../../../backend/route.js";
import { searchStops } from "@/lib/transitData";

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

    const staticMatches = searchStops(city, query).map((stop) => ({
      id: stop.id,
      name: stop.name,
      type: stop.type,
      city: stop.city,
      line: stop.line,
      lat: stop.lat,
      lng: stop.lng,
    }));

    const matches = findStops(query);
    const dynamicResults = matches
      .map((stop) => stopDetails(stop.id))
      .filter((stop): stop is NonNullable<ReturnType<typeof stopDetails>> => stop !== null)
      .slice(0, 8)
      .map((stop) => {
        const isRailway = /railway|station gate|terminal/i.test(stop.name) && !/metro/i.test(stop.name);
        return {
          id: stop.id,
          name: stop.name,
          type: isRailway ? "train" : stop.type,
          city: stop.city,
          line: isRailway ? "Indian Railways" : stop.lines.join(" / ") || undefined,
          lat: stop.lat,
          lng: stop.lng,
        };
      });

    // Merge and deduplicate by name
    const seen = new Set<string>();
    const results = [];
    for (const item of [...staticMatches, ...dynamicResults]) {
      const key = item.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        results.push(item);
      }
    }

    return NextResponse.json({ results: results.slice(0, 10) }, { status: 200 });
  } catch (error) {
    console.error("Stop search API error:", error);
    return NextResponse.json(
      { results: [], error: "Failed to search stops" },
      { status: 500 }
    );
  }
}
