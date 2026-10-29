import {
  CityConfig,
  StopItem,
  RoutePlanRequest,
  RoutePlanResponse,
  RouteOption,
  RouteLeg,
  TransitMode,
  TransitStatusResponse,
} from "../types/transit";

export const CITIES: Record<string, CityConfig> = {
  delhi: {
    id: "delhi",
    name: "Delhi NCR",
    state: "Delhi",
    tagline: "Metro, DTC Bus, Auto & Cabs",
    center: { lat: 28.6139, lng: 77.209 },
    metroBrand: "Delhi Metro (DMRC)",
    busBrand: "Delhi Transport Corp (DTC)",
    popularPresets: [
      {
        from: "Karol Bagh",
        to: "Gandhi Darshan",
        description: "Shopping hub to Raj Ghat cultural park (GTFS verified)",
      },
      {
        from: "Rajiv Chowk (Connaught Place)",
        to: "Hauz Khas Village",
        description: "City center to historic cultural & dining district",
      },
      {
        from: "Kashmere Gate ISBT",
        to: "Cyber City Gurgaon",
        description: "North transit interchange to tech corridor",
      },
      {
        from: "Noida Sector 18",
        to: "Indira Gandhi Airport T3",
        description: "Suburban hub to International Airport Express",
      },
    ],
  },
  mumbai: {
    id: "mumbai",
    name: "Mumbai MMR",
    state: "Maharashtra",
    tagline: "Metro, Local Suburban, BEST, Kaali-Peeli & Cabs",
    center: { lat: 19.076, lng: 72.8777 },
    metroBrand: "Mumbai Metro (MMRDA)",
    busBrand: "BEST Undertaking",
    popularPresets: [
      {
        from: "Chhatrapati Shivaji Terminus (CSMT)",
        to: "Bandra Kurla Complex (BKC)",
        description: "Heritage South Mumbai to Financial Capital Hub",
      },
      {
        from: "Andheri West",
        to: "Ghatkopar",
        description: "East-West Metro Line 1 Corridor",
      },
      {
        from: "Dadar TT Circle",
        to: "Nariman Point",
        description: "Central junction to Marine Drive business district",
      },
    ],
  },
  bengaluru: {
    id: "bengaluru",
    name: "Bengaluru",
    state: "Karnataka",
    tagline: "Namma Metro, BMTC, Auto & Cabs",
    center: { lat: 12.9716, lng: 77.5946 },
    metroBrand: "Namma Metro (BMRCL)",
    busBrand: "BMTC Vajra & City Bus",
    popularPresets: [
      {
        from: "Kempegowda Majestic",
        to: "Indiranagar 100ft Road",
        description: "Central Interchange to trendy cultural quarter",
      },
      {
        from: "MG Road Metro",
        to: "Whitefield ITPL",
        description: "Purple Line Metro tech commute",
      },
      {
        from: "Koramangala 5th Block",
        to: "Electronic City Phase 1",
        description: "Startup hub to tech township",
      },
    ],
  },
};

export const SUPPORTED_CITIES: Record<string, CityConfig> = {
  delhi: CITIES.delhi,
};

export const STOPS_DB: Record<string, StopItem[]> = {
  delhi: [
    { id: "del_kb_m", name: "Karol Bagh", type: "metro", line: "Blue Line", lineColor: "#0066cc", lat: 28.6525, lng: 77.192, city: "delhi", popular: true },
    { id: "del_kb_t", name: "Karol Bagh Terminal", type: "bus", lat: 28.651, lng: 77.1925, city: "delhi", popular: true },
    { id: "del_gd", name: "Gandhi Darshan", type: "landmark", lat: 28.6415, lng: 77.2485, city: "delhi", popular: true },
    { id: "del_rc", name: "Rajiv Chowk (Connaught Place)", type: "metro", line: "Blue / Yellow Interchange", lineColor: "#f59e0b", lat: 28.6328, lng: 77.2197, city: "delhi", popular: true },
    { id: "del_kg", name: "Kashmere Gate", type: "metro", line: "Red / Yellow / Violet", lineColor: "#ef4444", lat: 28.6675, lng: 77.2285, city: "delhi", popular: true },
    { id: "del_hk", name: "Hauz Khas", type: "metro", line: "Yellow / Magenta Interchange", lineColor: "#ec4899", lat: 28.5432, lng: 77.2065, city: "delhi", popular: true },
    { id: "del_aiims", name: "AIIMS Delhi", type: "metro", line: "Yellow Line", lineColor: "#eab308", lat: 28.5672, lng: 77.21, city: "delhi" },
    { id: "del_cc", name: "Chandni Chowk", type: "metro", line: "Yellow Line", lineColor: "#eab308", lat: 28.6575, lng: 77.2305, city: "delhi" },
    { id: "del_av", name: "Anand Vihar ISBT", type: "bus", lat: 28.6468, lng: 77.3155, city: "delhi" },
    { id: "del_n18", name: "Noida Sector 18", type: "metro", line: "Blue Line", lineColor: "#0066cc", lat: 28.5708, lng: 77.3261, city: "delhi" },
    { id: "del_t3", name: "Indira Gandhi Airport T3", type: "metro", line: "Airport Express", lineColor: "#f97316", lat: 28.5562, lng: 77.087, city: "delhi", popular: true },
    { id: "del_cyber", name: "Cyber City Gurgaon", type: "metro", line: "Rapid Metro", lineColor: "#06b6d4", lat: 28.4986, lng: 77.0878, city: "delhi", popular: true },
    { id: "del_mh", name: "Mandi House", type: "metro", line: "Blue / Violet Interchange", lineColor: "#8b5cf6", lat: 28.6258, lng: 77.2345, city: "delhi" },
    { id: "del_dg", name: "Delhi Gate", type: "metro", line: "Violet Line", lineColor: "#8b5cf6", lat: 28.6415, lng: 77.2435, city: "delhi" },
    { id: "del_ito", name: "ITO", type: "bus", lat: 28.6302, lng: 77.2428, city: "delhi" },
    { id: "del_cp", name: "Connaught Place Outer Circle", type: "landmark", lat: 28.6335, lng: 77.2215, city: "delhi" },
  ],
  mumbai: [
    { id: "mum_csmt", name: "Chhatrapati Shivaji Terminus (CSMT)", type: "landmark", lat: 18.9401, lng: 72.8355, city: "mumbai", popular: true },
    { id: "mum_bkc", name: "Bandra Kurla Complex (BKC)", type: "landmark", lat: 19.0657, lng: 72.8687, city: "mumbai", popular: true },
    { id: "mum_andh", name: "Andheri West", type: "metro", line: "Line 1 & 2A", lineColor: "#06b6d4", lat: 19.1197, lng: 72.8468, city: "mumbai", popular: true },
    { id: "mum_ghat", name: "Ghatkopar", type: "metro", line: "Line 1 Blue", lineColor: "#0066cc", lat: 19.0863, lng: 72.9085, city: "mumbai", popular: true },
    { id: "mum_dadar", name: "Dadar TT Circle", type: "bus", lat: 19.0178, lng: 72.8478, city: "mumbai", popular: true },
    { id: "mum_np", name: "Nariman Point", type: "landmark", lat: 18.9265, lng: 72.8228, city: "mumbai", popular: true },
    { id: "mum_bandra", name: "Bandra Station", type: "bus", lat: 19.0544, lng: 72.8402, city: "mumbai" },
    { id: "mum_bor", name: "Borivali West", type: "metro", line: "Line 7 Yellow", lineColor: "#eab308", lat: 19.2307, lng: 72.8567, city: "mumbai" },
  ],
  bengaluru: [
    { id: "blr_maj", name: "Kempegowda Majestic", type: "metro", line: "Green / Purple Interchange", lineColor: "#10b981", lat: 12.9757, lng: 77.5728, city: "bengaluru", popular: true },
    { id: "blr_ind", name: "Indiranagar 100ft Road", type: "landmark", lat: 12.9719, lng: 77.6412, city: "bengaluru", popular: true },
    { id: "blr_mg", name: "MG Road Metro", type: "metro", line: "Purple Line", lineColor: "#a855f7", lat: 12.9756, lng: 77.6066, city: "bengaluru", popular: true },
    { id: "blr_wf", name: "Whitefield ITPL", type: "metro", line: "Purple Line", lineColor: "#a855f7", lat: 12.9863, lng: 77.7381, city: "bengaluru", popular: true },
    { id: "blr_kor", name: "Koramangala 5th Block", type: "landmark", lat: 12.9352, lng: 77.6245, city: "bengaluru", popular: true },
    { id: "blr_ec", name: "Electronic City Phase 1", type: "bus", lat: 12.8399, lng: 77.677, city: "bengaluru", popular: true },
    { id: "blr_hsr", name: "HSR Layout Sector 1", type: "bus", lat: 12.9121, lng: 77.6446, city: "bengaluru" },
  ],
};

// Haversine distance in KM
export function haversineDistance(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number }
): number {
  const R = 6371; // Earth radius in KM
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(0.5, Math.round(R * c * 10) / 10);
}

// Coordinate generator between two points with curvature
function generatePath(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  steps = 5,
  offsetFactor = 0.003
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = start.lat + (end.lat - start.lat) * t;
    const lng = start.lng + (end.lng - start.lng) * t;
    // slight curve for visual realism
    const bend = Math.sin(t * Math.PI) * offsetFactor;
    points.push([+lat.toFixed(6), +(lng + bend).toFixed(6)]);
  }
  return points;
}

export function searchStops(city: string, query: string): StopItem[] {
  const list = STOPS_DB[city.toLowerCase()] || STOPS_DB["delhi"];
  if (!query || query.trim() === "") {
    return list.slice(0, 8);
  }
  const q = query.toLowerCase().trim();
  return list
    .filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.line && s.line.toLowerCase().includes(q))
    )
    .slice(0, 8);
}

export function resolveCoordinates(city: string, query: string, explicitLat?: number, explicitLng?: number): { name: string; lat: number; lng: number } {
  if (explicitLat && explicitLng) {
    return { name: query, lat: explicitLat, lng: explicitLng };
  }
  const q = query.toLowerCase().trim();
  const stops = STOPS_DB[city.toLowerCase()] || STOPS_DB["delhi"];

  // 1. Direct or bidirectional match
  const match = stops.find(
    (s) =>
      s.name.toLowerCase() === q ||
      s.name.toLowerCase().includes(q) ||
      q.includes(s.name.toLowerCase())
  );
  if (match) {
    return { name: match.name, lat: match.lat, lng: match.lng };
  }

  // 2. Token / word matching
  const tokens = q.split(/[\s,()\-]+/).filter((t) => t.length > 2);
  const tokenMatch = stops.find((s) => {
    const sLower = s.name.toLowerCase();
    return tokens.some((token) => sLower.includes(token));
  });
  if (tokenMatch) {
    return { name: tokenMatch.name, lat: tokenMatch.lat, lng: tokenMatch.lng };
  }

  // Fallback offset near city center
  const center = CITIES[city.toLowerCase()]?.center || CITIES["delhi"].center;
  const hash = query.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const offsetLat = ((hash % 40) - 20) * 0.003;
  const offsetLng = (((hash * 3) % 40) - 20) * 0.003;
  return {
    name: query,
    lat: +(center.lat + offsetLat).toFixed(4),
    lng: +(center.lng + offsetLng).toFixed(4),
  };
}

export function planRoutesMock(_req: RoutePlanRequest): RoutePlanResponse {
  throw new Error(
    "Mock route generation has been removed. Use the real planner API at /api/v1/routes/plan."
  );
}

export function getCityTransitStatus(city: string): TransitStatusResponse {  const cityKey = city.toLowerCase();
  const c = CITIES[cityKey] || CITIES["delhi"];

  if (cityKey === "delhi") {
    return {
      city: "delhi",
      period: "peak",
      systemStatus: "NORMAL_OPERATIONS",
      alerts: [
        {
          id: "del_alt_1",
          severity: "warning",
          mode: "bus",
          title: "ITO / Vikas Marg Traffic Advisory",
          message: "DTC buses traversing ITO crossing experiencing 5-8 min delay due to ongoing flyover lane maintenance.",
          activeLines: ["354UP", "543", "720", "GL91"],
        },
        {
          id: "del_alt_2",
          severity: "info",
          mode: "metro",
          title: "Yellow & Blue Line Peak Frequencies",
          message: "DMRC running peak frequency with trains every 2.4 mins across Rajiv Chowk, Karol Bagh and Kashmere Gate.",
          activeLines: ["Blue Line", "Yellow Line"],
        },
      ],
      crowdIndex: {
        metro: "Medium",
        bus: "High",
        roads: "Heavy Congestion",
      },
    };
  }

  if (cityKey === "mumbai") {
    return {
      city: "mumbai",
      period: "peak",
      systemStatus: "MODERATE_DELAYS",
      alerts: [
        {
          id: "mum_alt_1",
          severity: "warning",
          mode: "cab",
          title: "Western Express Highway Slow Moving",
          message: "Vehicular movement slow between Andheri flyover and Bandra Kurla Complex.",
        },
        {
          id: "mum_alt_2",
          severity: "info",
          mode: "metro",
          title: "Metro Line 2A & 7 Full Capacity",
          message: "Services running smoothly every 3 minutes.",
        },
      ],
      crowdIndex: {
        metro: "High",
        bus: "High",
        roads: "Heavy Congestion",
      },
    };
  }

  return {
    city: "bengaluru",
    period: "peak",
    systemStatus: "NORMAL_OPERATIONS",
    alerts: [
      {
        id: "blr_alt_1",
        severity: "warning",
        mode: "auto",
        title: "Silk Board - Outer Ring Road Congestion",
        message: "Surface traffic moving at 12 km/h. Metro feeder routes advised.",
      },
      {
        id: "blr_alt_2",
        severity: "info",
        mode: "metro",
        title: "Purple Line Full Reach Operational",
        message: "Challaghatta to Whitefield operational with 3.5 min headway.",
      },
    ],
    crowdIndex: {
      metro: "Medium",
      bus: "High",
      roads: "Heavy Congestion",
    },
  };
}
