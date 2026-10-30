import { NextRequest, NextResponse } from "next/server";
import { fetchStationTrains } from "@/lib/trainApi";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ stationCode: string }> }
) {
  try {
    const { stationCode } = await context.params;
    if (!stationCode) {
      return NextResponse.json({ error: "Missing station code" }, { status: 400 });
    }

    const data = await fetchStationTrains(stationCode);
    if (!data) {
      return NextResponse.json({ error: "Failed to fetch trains from RailRadar" }, { status: 502 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Train API route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
