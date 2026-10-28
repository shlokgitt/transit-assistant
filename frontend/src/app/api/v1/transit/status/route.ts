import { NextRequest, NextResponse } from "next/server";
import { getCityTransitStatus } from "@/lib/transitData";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") || "delhi";

  const status = getCityTransitStatus(city);
  return NextResponse.json(status, { status: 200 });
}
