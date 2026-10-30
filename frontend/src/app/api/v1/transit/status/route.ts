import { NextRequest, NextResponse } from "next/server";
import { getCityTransitStatus } from "@/lib/transitData";
import { withLiveDelhiBusStatus } from "@/lib/otd";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") || "delhi";

  const status = getCityTransitStatus(city);
  if (city.toLowerCase() !== "delhi" || !process.env.OTD_API_KEY) {
    return NextResponse.json(status, { status: 200 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(
        `https://otd.delhi.gov.in/api/realtime/VehiclePositions.pb?key=${encodeURIComponent(process.env.OTD_API_KEY)}`,
        { signal: controller.signal, cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(`OTD returned HTTP ${response.status}`);
      }

      const feed = new Uint8Array(await response.arrayBuffer());
      return NextResponse.json(withLiveDelhiBusStatus(status, feed), { status: 200 });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error("OTD realtime feed error:", error);
    return NextResponse.json(
      { ...status, error: "Live bus data is temporarily unavailable." },
      { status: 200 }
    );
  }
}
