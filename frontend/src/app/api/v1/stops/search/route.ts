import { NextRequest, NextResponse } from "next/server";
import { searchStops } from "@/lib/transitData";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") || "delhi";
  const query = searchParams.get("q") || "";

  const results = searchStops(city, query);
  return NextResponse.json({ results }, { status: 200 });
}
