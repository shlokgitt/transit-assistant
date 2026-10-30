import { NextRequest, NextResponse } from "next/server";
import { findStops, stopDetails } from "../../../../../../../route.js";
import { searchStops } from "@/lib/transitData";
import { StopItem } from "@/types/transit";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") || "delhi";
  const query = searchParams.get("q") || "";

  // 1. Get matches from curated STOPS_DB (includes all major NCR hubs, stations & landmarks)
  const curatedResults = searchStops(city, query);

  // 2. Also search full GTFS stops database
  let gtfsResults: StopItem[] = [];
  try {
    const rawGtfs = findStops(query);
    gtfsResults = rawGtfs
      .map((stop) => stopDetails(stop.id))
      .filter((stop): stop is NonNullable<ReturnType<typeof stopDetails>> => stop !== null)
      .slice(0, 15)
      .map((stop) => ({
        id: stop.id,
        name: stop.name,
        type: (stop.type as any) || "bus",
        city: stop.city,
        line: stop.lines.join(" / ") || undefined,
        lat: stop.lat,
        lng: stop.lng,
      }));
  } catch {
    // ignore
  }

  // 3. Combine and deduplicate by normalized name
  const seen = new Set<string>();
  const combined: StopItem[] = [];

  for (const stop of [...curatedResults, ...gtfsResults]) {
    const key = stop.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(stop);
    }
    if (combined.length >= 10) break;
  }

  return NextResponse.json({ results: combined }, { status: 200 });
}
