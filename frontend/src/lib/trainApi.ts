export interface TrainItem {
  train: {
    number: string;
    name: string;
    type: string;
    source: {
      code: string;
      name: string;
    };
    destination: {
      code: string;
      name: string;
    };
    runDays: string[];
  };
  stop: {
    sequence: number;
    arrival: string | null;
    departure: string | null;
    distance: number;
    stopType: string;
  };
}

export interface TrainStationResponse {
  success: boolean;
  data: {
    station: {
      code: string;
      name: string;
      city: string;
      lat: number;
      lng: number;
      stationType: string;
    };
    trains: TrainItem[];
    count: number;
  };
}

// Exactly as configured in api/test-railway.js
const RAILRADAR_API_KEY = process.env.RAILRADAR_API_KEY || "rg_a3fed45786a248fda13a2f6e62997c51";
const RAILRADAR_BASE_URL = process.env.RAILRADAR_BASE_URL || process.env.NEXT_PUBLIC_RAILRADAR_BASE_URL || "https://api.railradar.in/v1";

export async function fetchStationTrains(stationCode: string): Promise<TrainStationResponse | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const url = `${RAILRADAR_BASE_URL}/stations/${encodeURIComponent(stationCode)}/trains`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${RAILRADAR_API_KEY}`,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn("RailRadar API returned status", response.status);
      return null;
    }

    return (await response.json()) as TrainStationResponse;
  } catch (error) {
    console.error("fetchStationTrains error:", error);
    return null;
  }
}

export function detectStationCode(stationName: string): string | null {
  if (!stationName) return null;
  const normalized = stationName.toLowerCase();
  if (normalized.includes("anand vihar") || normalized.includes("anvt")) return "ANVT";
  if (normalized.includes("new delhi") || normalized.includes("ndls")) return "NDLS";
  if (normalized.includes("nizamuddin") || normalized.includes("nzm")) return "NZM";
  if (normalized.includes("old delhi") || normalized.includes("dli")) return "DLI";
  if (normalized.includes("sarai rohilla") || normalized.includes("dee")) return "DEE";
  if (normalized.includes("ghaziabad") || normalized.includes("gzb")) return "GZB";
  if (normalized.includes("gurgaon") || normalized.includes("gurugram") || normalized.includes("ggn")) return "GGN";
  if (normalized.includes("faridabad") || normalized.includes("fdb")) return "FDB";
  if (normalized.includes("delhi cantt") || normalized.includes("cantonment") || normalized.includes("dec")) return "DEC";
  if (normalized.includes("subzi mandi") || normalized.includes("sabzi mandi") || normalized.includes("szm")) return "SZM";
  if (normalized.includes("shakurbasti") || normalized.includes("shakur basti") || normalized.includes("ssb")) return "SSB";
  if (normalized.includes("okhla") || normalized.includes("oka")) return "OKA";
  if (normalized.includes("ballabgarh") || normalized.includes("bvh")) return "BVH";
  return null;
}
