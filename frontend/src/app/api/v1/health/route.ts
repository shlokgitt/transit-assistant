import { NextResponse } from "next/server";
import { findStops } from "../../../../../../backend/route.js";

export async function GET() {
  try {
    const testMatches = findStops("Karol Bagh");
    return NextResponse.json({
      status: "ok",
      cwd: process.cwd(),
      timestamp: new Date().toISOString(),
      sampleStopSearchCount: testMatches.length,
      sampleMatch: testMatches[0] || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        cwd: process.cwd(),
        error: String(error),
      },
      { status: 500 }
    );
  }
}
