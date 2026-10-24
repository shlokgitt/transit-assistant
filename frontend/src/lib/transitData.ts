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
    tagline: "Metro, DTC Bus, Auto, Rapido & Cabs",
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
    tagline: "Namma Metro, BMTC, Auto, Rapido & Cabs",
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
  const stops = STOPS_DB[city.toLowerCase()] || STOPS_DB["delhi"];
  const match = stops.find((s) => s.name.toLowerCase().includes(query.toLowerCase()));
  if (match) {
    return { name: match.name, lat: match.lat, lng: match.lng };
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

export function planRoutesMock(req: RoutePlanRequest): RoutePlanResponse {
  const cityKey = req.city?.toLowerCase() || "delhi";
  const city = CITIES[cityKey] || CITIES["delhi"];
  const originCoord = resolveCoordinates(cityKey, req.origin.query, req.origin.lat, req.origin.lng);
  const destCoord = resolveCoordinates(cityKey, req.destination.query, req.destination.lat, req.destination.lng);

  const directDistKm = haversineDistance(originCoord, destCoord);
  const isPeak = req.preferences?.period === "peak" || (req.preferences?.period !== "offpeak" && new Date().getHours() >= 8 && new Date().getHours() <= 11);
  const avoidCrowded = req.preferences?.avoidCrowded ?? false;
  const allowed = new Set<TransitMode>(
    req.preferences?.allowedModes || ["metro", "bus", "cab", "bike", "auto", "walk"]
  );

  const routes: RouteOption[] = [];

  // 1. SMART MULTIMODAL ROUTE (Recommended)
  if (allowed.has("metro") && allowed.has("walk")) {
    const walk1Dist = 0.3;
    const walk1Mins = 4;
    const metroDist = Math.max(1, +(directDistKm * 0.75).toFixed(1));
    const metroMins = Math.round(metroDist * 2.2);
    const lastLegAuto = directDistKm > 4 && allowed.has("auto");
    const lastDist = lastLegAuto ? Math.max(1, +(directDistKm * 0.25).toFixed(1)) : 0.4;
    const lastMins = lastLegAuto ? Math.round(lastDist * 3) : 5;
    const totalMins = walk1Mins + metroMins + lastMins + (isPeak ? 2 : 0);
    const metroFare = metroDist < 4 ? 20 : metroDist < 8 ? 30 : 40;
    const lastFare = lastLegAuto ? 35 : 0;
    const totalFare = metroFare + lastFare;

    const legs: RouteLeg[] = [
      {
        legIndex: 0,
        mode: "walk",
        from: originCoord.name,
        to: `${originCoord.name} Metro Station (Gate 1)`,
        durationMinutes: walk1Mins,
        distanceKm: walk1Dist,
        fare: 0,
        instruction: `Walk 300m to ${originCoord.name} Metro Station Gate 1`,
        coordinates: generatePath(originCoord, { lat: originCoord.lat + 0.002, lng: originCoord.lng + 0.002 }, 3),
      },
      {
        legIndex: 1,
        mode: "metro",
        from: `${originCoord.name} Metro`,
        to: `${destCoord.name} Interchange`,
        durationMinutes: metroMins,
        distanceKm: metroDist,
        fare: metroFare,
        lineName: cityKey === "delhi" ? "Blue Line" : cityKey === "mumbai" ? "Metro Line 1" : "Purple Line",
        lineColor: cityKey === "delhi" ? "#0066cc" : cityKey === "mumbai" ? "#06b6d4" : "#a855f7",
        platform: "Platform 1 - On Time",
        stopsCount: Math.max(3, Math.round(metroDist * 1.2)),
        intermediateStops: ["Central Station", "Market Gate", "Tech Junction"],
        provider: city.metroBrand,
        crowdLevel: isPeak ? "medium" : "low",
        delayMinutes: 0,
        instruction: `Board ${city.metroBrand} towards central concourse, express ride`,
        coordinates: generatePath(
          { lat: originCoord.lat + 0.002, lng: originCoord.lng + 0.002 },
          { lat: destCoord.lat - 0.004, lng: destCoord.lng - 0.003 },
          8,
          0.006
        ),
      },
    ];

    if (lastLegAuto) {
      legs.push({
        legIndex: 2,
        mode: "auto",
        from: `${destCoord.name} Metro Exit`,
        to: destCoord.name,
        durationMinutes: lastMins,
        distanceKm: lastDist,
        fare: lastFare,
        provider: "Prepaid / Metered Auto",
        crowdLevel: "low",
        delayMinutes: 0,
        instruction: `Take auto rickshaw for fast last-mile connection to ${destCoord.name}`,
        coordinates: generatePath(
          { lat: destCoord.lat - 0.004, lng: destCoord.lng - 0.003 },
          destCoord,
          4
        ),
      });
    } else {
      legs.push({
        legIndex: 2,
        mode: "walk",
        from: `${destCoord.name} Metro Exit`,
        to: destCoord.name,
        durationMinutes: lastMins,
        distanceKm: lastDist,
        fare: 0,
        instruction: `Walk 400m from metro exit directly to ${destCoord.name}`,
        coordinates: generatePath(
          { lat: destCoord.lat - 0.004, lng: destCoord.lng - 0.003 },
          destCoord,
          3
        ),
      });
    }

    routes.push({
      id: "route_recommended_metro_smart",
      tag: "RECOMMENDED",
      title: lastLegAuto ? "Smart Metro + Last-Mile Auto" : "Direct Fast Metro + Walk",
      summary: lastLegAuto ? "Walk ➔ Metro ➔ Auto" : "Walk ➔ Metro Express ➔ Walk",
      summaryModes: lastLegAuto ? ["walk", "metro", "auto"] : ["walk", "metro", "walk"],
      totalDurationMinutes: totalMins,
      totalDistanceKm: +(directDistKm * 1.05).toFixed(1),
      totalFare,
      carbonEmissionsKg: +(directDistKm * 0.04).toFixed(2),
      caloriesBurned: 52,
      transfersCount: lastLegAuto ? 1 : 0,
      crowdLevel: isPeak ? "medium" : "low",
      delayMinutes: 0,
      onTimeReliability: 97,
      legs,
    });
  }

  // 2. CHEAPEST ROUTE (Bus)
  if (allowed.has("bus")) {
    const busDist = +(directDistKm * 1.1).toFixed(1);
    const busMins = Math.round(busDist * (isPeak ? 3.8 : 2.8)) + (avoidCrowded ? 0 : 5);
    const busFare = 10;
    const busLine = cityKey === "delhi" ? "354UP" : cityKey === "mumbai" ? "C-51 Exp" : "G-4 MetroFeeder";
    const delay = isPeak ? 4 : 1;

    routes.push({
      id: "route_cheapest_bus",
      tag: "CHEAPEST",
      title: `City Bus Direct (${busLine})`,
      summary: `Walk ➔ ${city.busBrand} ➔ Walk`,
      summaryModes: ["walk", "bus", "walk"],
      totalDurationMinutes: busMins + 6,
      totalDistanceKm: busDist,
      totalFare: busFare,
      carbonEmissionsKg: +(busDist * 0.05).toFixed(2),
      caloriesBurned: 68,
      transfersCount: 0,
      crowdLevel: isPeak ? "high" : "medium",
      delayMinutes: delay,
      onTimeReliability: isPeak ? 82 : 91,
      legs: [
        {
          legIndex: 0,
          mode: "walk",
          from: originCoord.name,
          to: `${originCoord.name} Bus Stand`,
          durationMinutes: 3,
          distanceKm: 0.25,
          fare: 0,
          instruction: `Walk 250m to ${originCoord.name} Bus Stand`,
          coordinates: generatePath(originCoord, { lat: originCoord.lat + 0.001, lng: originCoord.lng + 0.001 }, 2),
        },
        {
          legIndex: 1,
          mode: "bus",
          from: `${originCoord.name} Bus Stand`,
          to: `${destCoord.name} Stop`,
          durationMinutes: busMins,
          distanceKm: busDist,
          fare: busFare,
          routeNumber: busLine,
          stopsCount: Math.max(4, Math.round(busDist * 1.8)),
          provider: city.busBrand,
          crowdLevel: isPeak ? "high" : "medium",
          delayMinutes: delay,
          instruction: `Board ${busLine} towards central corridor; alight at ${destCoord.name}`,
          coordinates: generatePath(
            { lat: originCoord.lat + 0.001, lng: originCoord.lng + 0.001 },
            { lat: destCoord.lat - 0.001, lng: destCoord.lng - 0.001 },
            10,
            -0.005
          ),
        },
        {
          legIndex: 2,
          mode: "walk",
          from: `${destCoord.name} Stop`,
          to: destCoord.name,
          durationMinutes: 3,
          distanceKm: 0.2,
          fare: 0,
          instruction: `Walk 200m to destination entrance`,
          coordinates: generatePath({ lat: destCoord.lat - 0.001, lng: destCoord.lng - 0.001 }, destCoord, 2),
        },
      ],
    });
  }

  // 3. FASTEST / TRAFFIC BUSTER (Bike Taxi)
  if (allowed.has("bike")) {
    const bikeMins = Math.round(directDistKm * 2.1);
    const bikeFare = Math.round(25 + directDistKm * 7);

    routes.push({
      id: "route_bike_taxi",
      tag: "TRAFFIC_BUSTER",
      title: "Zippy Bike Taxi (Rapido / Uber Moto)",
      summary: "Direct Door-to-Door Bike Taxi",
      summaryModes: ["bike"],
      totalDurationMinutes: bikeMins,
      totalDistanceKm: +(directDistKm * 1.05).toFixed(1),
      totalFare: bikeFare,
      carbonEmissionsKg: +(directDistKm * 0.07).toFixed(2),
      caloriesBurned: 0,
      transfersCount: 0,
      crowdLevel: "low",
      delayMinutes: 0,
      onTimeReliability: 96,
      legs: [
        {
          legIndex: 0,
          mode: "bike",
          from: originCoord.name,
          to: destCoord.name,
          durationMinutes: bikeMins,
          distanceKm: +(directDistKm * 1.05).toFixed(1),
          fare: bikeFare,
          provider: "Rapido / Bike Taxi",
          instruction: "Pickup directly at location. Weaves past traffic congestions.",
          crowdLevel: "low",
          delayMinutes: 0,
          coordinates: generatePath(originCoord, destCoord, 8, 0.003),
        },
      ],
    });
  }

  // 4. COMFORT ON-DEMAND CAB
  if (allowed.has("cab")) {
    const trafficMultiplier = isPeak ? 3.4 : 2.5;
    const cabMins = Math.round(directDistKm * trafficMultiplier);
    const cabFare = Math.round(75 + directDistKm * 16 * (isPeak ? 1.2 : 1.0));

    routes.push({
      id: "route_cab_comfort",
      tag: "COMFORT",
      title: "Direct AC Cab / Taxi (Uber / Ola)",
      summary: "Private AC Car Door-to-Door",
      summaryModes: ["cab"],
      totalDurationMinutes: cabMins,
      totalDistanceKm: +(directDistKm * 1.1).toFixed(1),
      totalFare: cabFare,
      carbonEmissionsKg: +(directDistKm * 0.22).toFixed(2),
      caloriesBurned: 0,
      transfersCount: 0,
      crowdLevel: "low",
      delayMinutes: isPeak ? 5 : 1,
      onTimeReliability: isPeak ? 85 : 94,
      legs: [
        {
          legIndex: 0,
          mode: "cab",
          from: originCoord.name,
          to: destCoord.name,
          durationMinutes: cabMins,
          distanceKm: +(directDistKm * 1.1).toFixed(1),
          fare: cabFare,
          provider: "Uber Go / Ola Prime AC",
          instruction: "Doorstep pickup. AC comfort via arterial expressways.",
          crowdLevel: "low",
          delayMinutes: isPeak ? 5 : 1,
          coordinates: generatePath(originCoord, destCoord, 8, -0.004),
        },
      ],
    });
  }

  // 5. DIRECT AUTO RICKSHAW
  if (allowed.has("auto")) {
    const autoMins = Math.round(directDistKm * (isPeak ? 3.0 : 2.4));
    const autoFare = Math.round(30 + directDistKm * 11);

    routes.push({
      id: "route_auto_direct",
      tag: "FASTEST",
      title: "Direct Auto Rickshaw (Metered CNG)",
      summary: "Direct Street Auto",
      summaryModes: ["auto"],
      totalDurationMinutes: autoMins,
      totalDistanceKm: +(directDistKm * 1.08).toFixed(1),
      totalFare: autoFare,
      carbonEmissionsKg: +(directDistKm * 0.09).toFixed(2),
      caloriesBurned: 0,
      transfersCount: 0,
      crowdLevel: "low",
      delayMinutes: isPeak ? 2 : 0,
      onTimeReliability: 93,
      legs: [
        {
          legIndex: 0,
          mode: "auto",
          from: originCoord.name,
          to: destCoord.name,
          durationMinutes: autoMins,
          distanceKm: +(directDistKm * 1.08).toFixed(1),
          fare: autoFare,
          provider: `${city.name} Metered Auto`,
          instruction: "Direct auto rickshaw hail or app booking.",
          crowdLevel: "low",
          delayMinutes: isPeak ? 2 : 0,
          coordinates: generatePath(originCoord, destCoord, 8, 0.002),
        },
      ],
    });
  }

  // 6. ECO-FRIENDLY (Walk + Metro)
  if (allowed.has("walk") && allowed.has("metro") && routes.length > 0) {
    const ecoDist = +(directDistKm * 1.02).toFixed(1);
    const ecoMins = Math.round(directDistKm * 2.5) + 6;
    routes.push({
      id: "route_eco_transit",
      tag: "ECO",
      title: "Eco Warrior (Metro + Pedestrian)",
      summary: "Zero-Fuel / Low Carbon Footprint",
      summaryModes: ["walk", "metro", "walk"],
      totalDurationMinutes: ecoMins,
      totalDistanceKm: ecoDist,
      totalFare: 30,
      carbonEmissionsKg: 0.22,
      caloriesBurned: 115,
      transfersCount: 0,
      crowdLevel: "medium",
      delayMinutes: 0,
      onTimeReliability: 98,
      legs: [
        {
          legIndex: 0,
          mode: "walk",
          from: originCoord.name,
          to: "Station Concours",
          durationMinutes: 6,
          distanceKm: 0.5,
          fare: 0,
          instruction: "Brisk walk to the station entrance",
          coordinates: generatePath(originCoord, { lat: originCoord.lat + 0.003, lng: originCoord.lng + 0.003 }, 3),
        },
        {
          legIndex: 1,
          mode: "metro",
          from: "Origin Metro",
          to: "Dest Metro",
          durationMinutes: ecoMins - 12,
          distanceKm: +(ecoDist - 1.0).toFixed(1),
          fare: 30,
          lineName: "Green Line / Eco corridor",
          lineColor: "#10b981",
          stopsCount: 6,
          provider: city.metroBrand,
          instruction: "Fully electrified 100% solar powered metro transit",
          coordinates: generatePath(
            { lat: originCoord.lat + 0.003, lng: originCoord.lng + 0.003 },
            { lat: destCoord.lat - 0.003, lng: destCoord.lng - 0.003 },
            8
          ),
        },
        {
          legIndex: 2,
          mode: "walk",
          from: "Dest Metro",
          to: destCoord.name,
          durationMinutes: 6,
          distanceKm: 0.5,
          fare: 0,
          instruction: "Walk to destination",
          coordinates: generatePath({ lat: destCoord.lat - 0.003, lng: destCoord.lng - 0.003 }, destCoord, 3),
        },
      ],
    });
  }

  // Sort candidates by chosen priority
  const priority = req.preferences?.routingPriority || "fastest";
  routes.sort((a, b) => {
    if (priority === "fastest") return a.totalDurationMinutes - b.totalDurationMinutes;
    if (priority === "cheapest") return a.totalFare - b.totalFare;
    if (priority === "shortest") return a.totalDistanceKm - b.totalDistanceKm;
    if (priority === "least_transfers") return a.transfersCount - b.transfersCount;
    if (priority === "eco") return a.carbonEmissionsKg - b.carbonEmissionsKg;
    return a.totalDurationMinutes - b.totalDurationMinutes;
  });

  // Assign fastest and cheapest IDs
  const fastest = [...routes].sort((a, b) => a.totalDurationMinutes - b.totalDurationMinutes)[0]?.id || "";
  const cheapest = [...routes].sort((a, b) => a.totalFare - b.totalFare)[0]?.id || "";
  const recommended = routes.find((r) => r.tag === "RECOMMENDED")?.id || routes[0]?.id || "";

  return {
    success: true,
    queryId: `req_${cityKey}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    city: {
      id: city.id,
      name: city.name,
      currency: "₹",
    },
    origin: originCoord,
    destination: destCoord,
    summary: {
      totalRoutes: routes.length,
      recommendedRouteId: recommended,
      fastestRouteId: fastest,
      cheapestRouteId: cheapest,
    },
    routes,
  };
}

export function getCityTransitStatus(city: string): TransitStatusResponse {
  const cityKey = city.toLowerCase();
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
