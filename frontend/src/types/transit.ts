export type TransitMode = "metro" | "bus" | "auto" | "walk" | "train";

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
  fare: number | null;
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
  fromStopId?: string;
  toStopId?: string;
  scheduledTiming?: {
    source: "static_gtfs";
    routeId: string;
    routeName: string;
    fromStop: string;
    toStop: string;
    departureTime: string;
    arrivalTime: string;
    durationMinutes: number;
    note: string;
  };
  coordinates: [number, number][]; // [lat, lng][]
}

export interface DisruptionScenario {
  active: boolean;
  serviceDelays?: Record<string, number>;
  stationCrowd?: Record<string, CrowdLevel>;
  disabledServices?: string[];
  disabledConnections?: { from: string; to: string }[];
  description?: string;
}

export interface JourneyConstraints {
  maxBudget?: number;
  maxWalkingDistanceMeters?: number;
  maxTransfers?: number;
  requiredArrivalTime?: string; // e.g. "09:00"
  departureTime?: string; // e.g. "08:15"
  avoidCrowded?: boolean;
}

export interface ConstraintEvaluation {
  satisfied: boolean;
  satisfiesAll: boolean;
  violations: string[];
  budgetSatisfied?: boolean | null;
  walkingSatisfied?: boolean | null;
  transfersSatisfied?: boolean | null;
  deadlineSatisfied?: boolean | null;
}

export interface ReliabilityDetails {
  scheduledDurationMinutes: number;
  estimatedTotalDurationMinutes: number;
  transferBufferMinutes: number;
  potentialDelayImpactMinutes: number;
  delayExposureScore: number;
  confidenceLevel: "high" | "medium" | "simulated";
  reliabilityPercentage: number;
  reliabilityBand: "High" | "Moderate" | "Low";
  transferCount: number;
  isSimulated?: boolean;
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
  constraintsEvaluation?: ConstraintEvaluation;
  reliabilityDetails?: ReliabilityDetails;
  recommendationReason?: string;
  isSimulatedAlternative?: boolean;
  scheduledDurationMinutes?: number;
  transferBufferMinutes?: number;
  trainLiveBoard?: {
    stationCode: string;
    stationName: string;
    trains: {
      number: string;
      name: string;
      type: string;
      departure: string | null;
      destination: string;
    }[];
  };
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
  constraints?: JourneyConstraints;
  scenario?: DisruptionScenario;
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
  unavailableModes?: {
    mode: TransitMode;
    reason: string;
    source: "dataset" | "api";
  }[];
  scenarioApplied?: boolean;
  scenarioDetails?: DisruptionScenario | null;
  comparison?: {
    baselineRouteTitle: string;
    baselineDurationMinutes: number;
    simulatedDurationMinutes: number;
    delayImpactMinutes: number;
    impactExplanation: string;
    alternativeRecommended: boolean;
    alternativeExplanation?: string;
  } | null;
  constraintSummary?: {
    hasConstraints: boolean;
    allSatisfied: boolean;
    unmetConstraints: string[];
    explanation?: string;
  };
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
  liveData?: {
    source: "otd";
    vehicleCount: number;
    updatedAt: string;
    vehicles?: {
      id: string;
      routeId?: string;
      lat: number;
      lng: number;
      nearestStop?: string;
      estimatedArrivalMinutes?: number;
    }[];
  };
  error?: string;
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
