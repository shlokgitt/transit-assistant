export type TransitMode = "metro" | "bus" | "cab" | "auto" | "walk";

export type RoutingPriority = "fastest" | "cheapest" | "shortest" | "least_transfers" | "eco";

export type CrowdLevel = "low" | "medium" | "high";

export type TimePeriod = "auto" | "peak" | "offpeak";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface StopItem {
  id: string;
  name: string;
  type: TransitMode | "landmark";
  city: string;
  line?: string;
  lineColor?: string;
  lat: number;
  lng: number;
  popular?: boolean;
}

export interface RouteLeg {
  legIndex: number;
  mode: TransitMode;
  from: string;
  to: string;
  durationMinutes: number;
  distanceKm: number;
  distanceSource?: "road" | "straight-line" | "mixed" | null;
  fare: number;
  instruction: string;
  stopsCount?: number;
  intermediateStops?: string[];
  routeNumber?: string;
  lineName?: string;
  lineColor?: string;
  platform?: string;
  provider?: string;
  crowdLevel?: CrowdLevel;
  delayMinutes?: number;
  statusMessage?: string;
  coordinates: [number, number][]; // [lat, lng][]
}

export interface RouteOption {
  id: string;
  tag: "FASTEST" | "CHEAPEST" | "RECOMMENDED" | "COMFORT" | "TRAFFIC_BUSTER" | "ECO";
  title: string;
  summary: string;
  summaryModes: TransitMode[];
  totalDurationMinutes: number;
  totalDistanceKm: number;
  distanceSource?: "road" | "straight-line" | "mixed" | null;
  totalFare: number | null;
  carbonEmissionsKg: number;
  caloriesBurned: number;
  transfersCount: number;
  crowdLevel: CrowdLevel;
  delayMinutes: number;
  onTimeReliability: number; // percentage, e.g. 96
  departureTime?: string;
  arrivalTime?: string;
  legs: RouteLeg[];
}

export interface RoutePlanRequest {
  city: string;
  origin: {
    query: string;
    lat?: number;
    lng?: number;
    stopId?: string;
  };
  destination: {
    query: string;
    lat?: number;
    lng?: number;
    stopId?: string;
  };
  preferences?: {
    routingPriority?: RoutingPriority;
    allowedModes?: TransitMode[];
    avoidCrowded?: boolean;
    period?: TimePeriod;
    maxWalkingDistanceMeters?: number;
  };
}

export interface RoutePlanResponse {
  success: boolean;
  queryId: string;
  timestamp: string;
  city: {
    id: string;
    name: string;
    currency: string;
  };
  origin: {
    name: string;
    lat: number;
    lng: number;
  };
  destination: {
    name: string;
    lat: number;
    lng: number;
  };
  summary: {
    totalRoutes: number;
    recommendedRouteId: string;
    fastestRouteId: string;
    cheapestRouteId: string;
  };
  routes: RouteOption[];
  error?: string;
}

export interface TransitAlert {
  id: string;
  severity: "info" | "warning" | "alert";
  mode: TransitMode;
  title: string;
  message: string;
  activeLines?: string[];
}

export interface TransitStatusResponse {
  city: string;
  period: "peak" | "offpeak";
  systemStatus: "NORMAL_OPERATIONS" | "MODERATE_DELAYS" | "WEATHER_ADVISORY";
  alerts: TransitAlert[];
  crowdIndex: {
    metro: "Low" | "Medium" | "High";
    bus: "Low" | "Medium" | "High";
    roads: "Smooth" | "Moderate" | "Heavy Congestion";
  };
}

export interface CityConfig {
  id: string;
  name: string;
  state: string;
  tagline: string;
  center: GeoPoint;
  metroBrand: string;
  busBrand: string;
  popularPresets: {
    from: string;
    to: string;
    description: string;
  }[];
}
