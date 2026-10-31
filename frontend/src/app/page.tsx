"use client";

import Link from "next/link";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  Bot,
  ChevronRight,
  Clock3,
  Compass,
  GitCompareArrows,
  Map,
  Menu,
  RefreshCw,
  Route as RouteIcon,
  Save,
  Settings2,
  Sparkles,
  TrainFront,
  TriangleAlert,
  X,
} from "lucide-react";
import { SearchPanel } from "@/components/SearchPanel";
import { RouteCard } from "@/components/RouteCard";
import { VehicleIllustration } from "@/components/VehicleIllustration";
import { ItineraryView } from "@/components/ItineraryView";
import { TransitMap } from "@/components/TransitMap";
import { ChatPanel } from "@/components/ChatPanel";
import { GeminiChatView } from "@/components/GeminiChatView";
import { ApiInspectorModal } from "@/components/ApiInspectorModal";
import { LiveAlertsModal } from "@/components/LiveAlertsModal";
import { CITIES } from "@/lib/transitData";
import {
  JourneyConstraints,
  DisruptionScenario,
  RoutePlanRequest,
  RoutePlanResponse,
  RoutingPriority,
  TransitMode,
} from "@/types/transit";

type Screen = "home" | "results" | "chat" | "disruptions" | "saved";

type SavedJourney = {
  id: string;
  name: string;
  from: string;
  to: string;
  preference: RoutingPriority;
  email: string | null;
  createdAt?: string;
};

const STORAGE_KEY = "transitsaathi-saved-journeys";
const SAVED_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

function getJourneyFrom(journey: SavedJourney): string {
  return journey.from || (journey as unknown as { origin?: string }).origin || "";
}

function getJourneyTo(journey: SavedJourney): string {
  return journey.to || (journey as unknown as { destination?: string }).destination || "";
}

function getJourneyPreference(journey: SavedJourney): RoutingPriority {
  return journey.preference || (journey as unknown as { priority?: RoutingPriority }).priority || "fastest";
}

const NAV_ITEMS: { id: Screen; label: string; icon: React.ReactNode }[] = [
  { id: "home", label: "Plan a Trip", icon: <TripNavIcon type="plan" /> },
  { id: "results", label: "Results", icon: <TripNavIcon type="results" /> },
  { id: "chat", label: "Travel Chat", icon: <TripNavIcon type="chat" /> },
  { id: "disruptions", label: "Simulator", icon: <TripNavIcon type="simulator" /> },
  { id: "saved", label: "Saved Journeys", icon: <TripNavIcon type="saved" /> },
];

function TripNavIcon({ type }: { type: "plan" | "results" | "chat" | "simulator" | "saved" }) {
  const paths = {
    plan: "M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z",
    results: "M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z",
    chat: "M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z",
    simulator: "M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5",
    saved: "M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z",
  };

  return (
    <svg
      className="hi"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.25"
      aria-hidden="true"
    >
      <path d={paths[type]} />
    </svg>
  );
}

function SlidingNav({
  activeScreen,
  onChange,
}: {
  activeScreen: Screen;
  onChange: (screen: Screen) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabRefs = useRef<Record<Screen, HTMLButtonElement | null>>({
    home: null,
    results: null,
    chat: null,
    disruptions: null,
    saved: null,
  });

  useLayoutEffect(() => {
    const bar = barRef.current;
    const pill = pillRef.current;
    const tab = tabRefs.current[activeScreen];
    if (!bar || !pill || !tab) return;

    const moveToActiveTab = (animate: boolean) => {
      if (!animate) {
        const previousTransition = pill.style.transition;
        pill.style.transition = "none";
        pill.style.transform = `translateX(${tab.offsetLeft}px)`;
        pill.style.width = `${tab.offsetWidth}px`;
        void pill.offsetWidth;
        pill.style.transition = previousTransition;
        return;
      }

      pill.style.transform = `translateX(${tab.offsetLeft}px)`;
      pill.style.width = `${tab.offsetWidth}px`;
    };

    moveToActiveTab(true);
    const handleResize = () => moveToActiveTab(false);
    const resizeObserver = new ResizeObserver(() => moveToActiveTab(false));
    resizeObserver.observe(bar);
    window.addEventListener("resize", handleResize);
    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => moveToActiveTab(false));
    }
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [activeScreen]);

  const holdPressedState = (tab: HTMLButtonElement) => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    tab.classList.add("is-pressed");
    pressTimerRef.current = setTimeout(() => tab.classList.remove("is-pressed"), 150);
  };

  return (
    <div ref={barRef} className="t-tabs t-nav-tabs" role="tablist" aria-label="Main navigation">
      <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          ref={(element) => {
            tabRefs.current[item.id] = element;
          }}
          className="t-tab"
          role="tab"
          aria-selected={activeScreen === item.id}
          aria-label={item.label}
          onPointerDown={(event) => {
            if (event.pointerType !== "mouse") holdPressedState(event.currentTarget);
          }}
          onClick={() => onChange(item.id)}
        >
          {item.icon}
          <span className="t-tab-label">
            <span className="t-tab-text">{item.label}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedCity, setSelectedCity] = useState("delhi");
  const [origin, setOrigin] = useState("Karol Bagh");
  const [destination, setDestination] = useState("Gandhi Darshan");
  const [selectedModes, setSelectedModes] = useState<TransitMode[]>([
    "metro",
    "bus",
"train",
    "auto",


    "walk",
  ]);
  const [priority, setPriority] = useState<RoutingPriority[]>(["fastest"]);
  const [avoidCrowded, setAvoidCrowded] = useState(false);
  const [period, setPeriod] = useState<"peak" | "offpeak">("peak");
  const [isLoading, setIsLoading] = useState(false);
  const [routeResponse, setRouteResponse] = useState<RoutePlanResponse | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<RoutePlanRequest | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedLegIndex, setSelectedLegIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"routes" | "itinerary">("routes");
  const [mobileResultTab, setMobileResultTab] = useState<"routes" | "map">("routes");
  const [isApiInspectorOpen, setIsApiInspectorOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [savedJourneys, setSavedJourneys] = useState<SavedJourney[]>([]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(false);
  const [alertEmail, setAlertEmail] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [delayMinutes, setDelayMinutes] = useState(10);
  const [scenarioApplied, setScenarioApplied] = useState(false);
  const [chatPrompt, setChatPrompt] = useState<string | undefined>();
  const [constraints, setConstraints] = useState<JourneyConstraints>({});
  const [constraintsEnabled, setConstraintsEnabled] = useState(false);
  const [scenario, setScenario] = useState<DisruptionScenario>({ active: false });
  const [simService, setSimService] = useState("metro-blue");
  const [simStation, setSimStation] = useState("Rajiv Chowk");
  const [simCrowdLevel, setSimCrowdLevel] = useState<"low" | "medium" | "high">("high");
  const [simDisable, setSimDisable] = useState(false);
  const [simIsLoading, setSimIsLoading] = useState(false);
  const [simResult, setSimResult] = useState<null | { baseline: import("@/types/transit").RoutePlanResponse; affected: import("@/types/transit").RoutePlanResponse }>(null);

  const city = CITIES[selectedCity] || CITIES.delhi;
  const selectedRoute = useMemo(
    () =>
      routeResponse?.routes.find((route) => route.id === selectedRouteId) ||
      routeResponse?.routes[0] ||
      null,
    [routeResponse, selectedRouteId]
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSavedJourneys(JSON.parse(stored) as SavedJourney[]);
      }
    } catch {
      setSavedJourneys([]);
    }

    void fetch(`${SAVED_API_BASE}/saved`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Saved routes unavailable.");
        return (await response.json()) as SavedJourney[];
      })
      .then((routes) => {
        if (Array.isArray(routes)) {
          setSavedJourneys(routes);
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
        }
      })
      .catch(() => undefined);
  }, []);

  const persistSavedJourneys = (next: SavedJourney[]) => {
    setSavedJourneys(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handlePlanRoute = useCallback(async (
    overrideScenario?: DisruptionScenario,
    routeOverrides?: { origin: string; destination: string; priority?: RoutingPriority },
  ) => {
    const requestOrigin = routeOverrides?.origin ?? origin;
    const requestDestination = routeOverrides?.destination ?? destination;
    const requestPriority = routeOverrides?.priority ?? priority[0];

    if (!requestOrigin.trim() || !requestDestination.trim() || requestOrigin.trim() === requestDestination.trim()) {
      setRouteError("Enter two different places to plan a journey.");
      setScreen("results");
      return;
    }

    setIsLoading(true);
    setRouteError(null);

    // Build constraints object – only include if enabled and fields are actually set
    const activeConstraints: JourneyConstraints = {};
    if (constraintsEnabled) {
      if (constraints.maxBudget) activeConstraints.maxBudget = constraints.maxBudget;
      if (constraints.maxWalkingDistanceMeters) activeConstraints.maxWalkingDistanceMeters = constraints.maxWalkingDistanceMeters;
      if (constraints.maxTransfers !== undefined) activeConstraints.maxTransfers = constraints.maxTransfers;
      if (constraints.requiredArrivalTime) activeConstraints.requiredArrivalTime = constraints.requiredArrivalTime;
    }

    const activeScenario = overrideScenario ?? (scenario.active ? scenario : undefined);

    const requestPayload: RoutePlanRequest = {
      city: selectedCity,
      origin: { query: requestOrigin.trim() },
      destination: { query: requestDestination.trim() },
      preferences: {
        routingPriority: requestPriority,
        allowedModes: selectedModes,
        avoidCrowded,
        period,
        ...(constraintsEnabled && constraints.maxWalkingDistanceMeters
          ? { maxWalkingDistanceMeters: constraints.maxWalkingDistanceMeters }
          : {}),
      },
      ...(Object.keys(activeConstraints).length ? { constraints: activeConstraints } : {}),
      ...(activeScenario ? { scenario: activeScenario } : {}),
    };
    setLastRequest(requestPayload);

    try {
      const response = await fetch("/api/v1/routes/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });
      const data = (await response.json()) as RoutePlanResponse;
      if (!response.ok || !data.success) throw new Error(data.error || "Route planning failed.");
      setRouteResponse(data);
      setSelectedRouteId(data.summary.recommendedRouteId || data.routes[0]?.id || null);
      setActiveTab("routes");
      setScreen("results");
    } catch (error) {
      setRouteResponse(null);
      setSelectedRouteId(null);
      setRouteError(error instanceof Error ? error.message : "Route planning failed.");
      setScreen("results");
    } finally {
      setIsLoading(false);
    }
  }, [avoidCrowded, constraints, constraintsEnabled, destination, origin, period, priority, scenario, selectedCity, selectedModes]);

  const handleSimulate = async () => {
    if (!origin.trim() || !destination.trim()) {
      alert("Please plan a route first from the 'Plan a trip' screen.");
      return;
    }
    setSimIsLoading(true);
    try {
      // Build scenario from simulator controls
      const builtScenario: DisruptionScenario = {
        active: true,
        serviceDelays: delayMinutes > 0 ? { [simService]: delayMinutes } : {},
        stationCrowd: { [simStation]: simCrowdLevel },
        disabledServices: simDisable ? [simService] : [],
        description: `[Simulated] ${simService} delayed by ${delayMinutes}m at ${simStation}`,
      };

      const basePayload: RoutePlanRequest = {
        city: selectedCity,
        origin: { query: origin.trim() },
        destination: { query: destination.trim() },
        preferences: { routingPriority: priority[0], allowedModes: selectedModes, avoidCrowded, period },
      };

      const [baseRes, affectedRes] = await Promise.all([
        fetch("/api/v1/routes/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(basePayload) }),
        fetch("/api/v1/routes/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...basePayload, scenario: builtScenario }) }),
      ]);

      const baseline = (await baseRes.json()) as RoutePlanResponse;
      const affected = (await affectedRes.json()) as RoutePlanResponse;

      setSimResult({ baseline, affected });
      setScenario(builtScenario);
      setScenarioApplied(true);
    } catch {
      // handled gracefully
    } finally {
      setSimIsLoading(false);
    }
  };

  const openSavedJourney = (journey: SavedJourney) => {
    const savedOrigin = getJourneyFrom(journey);
    const savedDestination = getJourneyTo(journey);
    const savedPriority = getJourneyPreference(journey);

    setOrigin(savedOrigin);
    setDestination(savedDestination);
    setPriority([savedPriority]);
    setRouteError(null);
    void handlePlanRoute(undefined, {
      origin: savedOrigin,
      destination: savedDestination,
      priority: savedPriority,
    });
  };

  const saveCurrentJourney = async () => {
    if (!origin || !destination) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      const payload = {
        name: `${origin} to ${destination}`,
        from: origin,
        to: destination,
        preference: priority[0],
        ...(emailAlertsEnabled && alertEmail.trim() ? { email: alertEmail.trim() } : {}),
      };

      let newJourney: SavedJourney;
      try {
        const response = await fetch(`${SAVED_API_BASE}/saved`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to save route.");
        newJourney = data as SavedJourney;
      } catch (networkOrApiError) {
        console.warn("Backend save failed, saving locally:", networkOrApiError);
        newJourney = {
          id: `local-${crypto.randomUUID()}`,
          name: payload.name,
          from: payload.from,
          to: payload.to,
          preference: payload.preference,
          email: payload.email || null,
        };
      }

      const nextJourneys = [newJourney, ...savedJourneys.filter((j) => j.id !== newJourney.id)];
      persistSavedJourneys(nextJourneys);
      setIsSaveModalOpen(false);
      setEmailAlertsEnabled(false);
      setAlertEmail("");
      setSavedSuccessMessage("Journey saved successfully!");
      setTimeout(() => setSavedSuccessMessage(null), 3500);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save route.");
    } finally {
      setIsSaving(false);
    }
  };

  const stopAlerts = async (id: string) => {
    setAlertsError(null);
    try {
      const response = await fetch(`${SAVED_API_BASE}/saved/${encodeURIComponent(id)}/email`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Unable to stop alerts.");
      const updated = (await response.json()) as SavedJourney;
      const next = savedJourneys.map((journey) => (journey.id === id ? updated : journey));
      persistSavedJourneys(next);
    } catch (error) {
      setAlertsError(error instanceof Error ? error.message : "Unable to stop alerts.");
    }
  };

  const renderResults = () => (
    <div className={`journey-workspace show-${mobileResultTab}`}>
      <section className="results-column">
        <div className="page-heading compact-heading">
          <div>
            <p className="eyebrow">Route Results</p>
            <h2>{origin} <span>to</span> {destination}</h2>
            <p className="muted-copy">Compare available journeys from the live route planner.</p>
          </div>
          <button className="quiet-button" onClick={() => setScreen("home")}>
            <Settings2 size={15} /> Edit search
          </button>
        </div>
        <div className="result-toolbar">
          <span>{routeResponse?.routes.length || 0} option{routeResponse?.routes.length === 1 ? "" : "s"}</span>
          <div className="mobile-view-tabs" role="tablist">
            <button
              type="button"
              className={mobileResultTab === "routes" ? "active" : ""}
              onClick={() => setMobileResultTab("routes")}
            >
              Routes ({routeResponse?.routes.length || 0})
            </button>
            <button
              type="button"
              className={mobileResultTab === "map" ? "active" : ""}
              onClick={() => setMobileResultTab("map")}
            >
              Map
            </button>
          </div>
        </div>
        {isLoading ? (
          <div className="empty-panel"><RefreshCw className="spin" size={22} /><p>Finding practical routes…</p></div>
        ) : routeError ? (
          <div className="empty-panel error-panel"><TriangleAlert size={24} /><p>{routeError}</p><button className="text-button" onClick={() => setScreen("home")}>Change search</button></div>
        ) : routeResponse?.routes.length ? (
          <div className="route-list">
            {routeResponse.routes.map((route) => (
              <RouteCard key={route.id} route={route} isSelected={route.id === selectedRouteId} onSelect={() => { setSelectedRouteId(route.id); setSelectedLegIndex(null); }} />
            ))}

            {routeResponse.unavailableModes && routeResponse.unavailableModes.length > 0 && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: "rgba(148, 163, 184, 0.05)",
                  border: "1px solid rgba(148, 163, 184, 0.15)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8", fontSize: "0.8rem", fontWeight: 700 }}>
                  <TriangleAlert size={15} color="#f59e0b" />
                  <span>Transports Not Available for this Route (via Dataset & API)</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {routeResponse.unavailableModes.map((item) => (
                    <div
                      key={item.mode}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        fontSize: "0.76rem",
                        color: "#94a3b8",
                        lineHeight: 1.4,
                      }}
                    >
                      <span
                        className={`mode-badge mode-${item.mode}`}
                        style={{
                          textTransform: "capitalize",
                          fontWeight: 700,
                          fontSize: "0.68rem",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          flexShrink: 0,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <VehicleIllustration mode={item.mode} size="xs" />
                        {item.mode}
                      </span>
                      <span>{item.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedRoute && (
              <div className="save-action-bar">
                <button
                  type="button"
                  className="save-journey-button"
                  onClick={() => {
                    setSaveError(null);
                    setIsSaveModalOpen(true);
                  }}
                >
                  <Save size={16} /> Save this journey
                </button>
                {savedSuccessMessage && (
                  <span className="save-success-pill">✓ {savedSuccessMessage}</span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="empty-panel"><RouteIcon size={24} /><p>Plan a journey to compare route options.</p></div>
        )}
      </section>
      <section className="map-column">
        <TransitMap city={city} route={selectedRoute} selectedLegIndex={selectedLegIndex} simulationStep={0} isSimulating={false} />
        {selectedRoute && (
          <div className="map-detail-card">
            <div className="segmented-control">
              <button className={activeTab === "routes" ? "active" : ""} onClick={() => setActiveTab("routes")}>Overview</button>
              <button className={activeTab === "itinerary" ? "active" : ""} onClick={() => setActiveTab("itinerary")}>Steps</button>
            </div>
            {activeTab === "itinerary" ? <ItineraryView route={selectedRoute} simulationStep={0} isSimulating={false} onStartSimulation={() => undefined} onResetSimulation={() => undefined} /> : <div className="map-summary"><strong>{selectedRoute.totalDurationMinutes} min</strong><span>Estimated trip · ₹{selectedRoute.totalFare ?? "—"} · {selectedRoute.transfersCount} transfers</span></div>}
          </div>
        )}
      </section>
    </div>
  );

  const renderHome = () => (
    <div className="home-grid">
      <section className="hero-panel">
        <div className="planner-device" aria-label="Trip planner">
          <div className="planner-device-top">
            <span>Transit Route</span>
            <span className="planner-device-signal">● ● ●</span>
          </div>
          <div className="planner-device-screen">
            <span className="planner-device-camera" aria-hidden="true" />
            <div className="planner-device-heading">
              <span>Plan Your Journey</span>
              <small>Delhi NCR</small>
            </div>
            <SearchPanel city={city} origin={origin} destination={destination} onChangeOrigin={setOrigin} onChangeDestination={setDestination} onSwap={() => { setOrigin(destination); setDestination(origin); }} selectedModes={selectedModes} onToggleMode={(mode) => setSelectedModes((current) => current.includes(mode) ? (current.length === 1 ? current : current.filter((item) => item !== mode)) : [...current, mode])} priority={priority} onChangePriority={(next) => setPriority((current) => current.includes(next) ? (current.length > 1 ? current.filter((item) => item !== next) : current) : (current.length < 2 ? [...current, next] : [current[1], next]))} avoidCrowded={avoidCrowded} onToggleAvoidCrowded={() => setAvoidCrowded((value) => !value)} onSearch={() => void handlePlanRoute()} isLoading={isLoading} onSelectPreset={(from, to) => { setOrigin(from); setDestination(to); }} constraints={constraints} onChangeConstraints={(c) => setConstraints(c)} constraintsEnabled={constraintsEnabled} onToggleConstraintsEnabled={setConstraintsEnabled} />
          </div>
          <div className="planner-device-home" />
        </div>
      </section>
      <section className="home-aside">
        <div className="aside-card route-note">
          <div className="aside-icon"><TrainFront size={18} /></div>
          <p className="eyebrow">Built For Real Trips</p>
          <h3>Start With A Place, Not A Station Code.</h3>
          <p className="muted-copy">Search by landmark, metro station, or bus stop. The planner will explain the journey in plain language.</p>
        </div>
        <div className="aside-card">
          <div className="aside-card-heading"><Clock3 size={16} /><strong>Recent Journeys</strong></div>
          {savedJourneys.slice(0, 3).map((journey) => (
            <button className="recent-item" key={journey.id} onClick={() => openSavedJourney(journey)}>
              <span>{getJourneyFrom(journey)} → {getJourneyTo(journey)}</span>
              <ChevronRight size={14} />
            </button>
          ))}
          {!savedJourneys.length && <p className="muted-copy">Saved journeys will appear here after your first trip.</p>}
        </div>
        <div className="page-heading home-heading-below">
          <p className="eyebrow">Delhi NCR Route Transit Planner</p>
          <h2>Make The Next Journey Feel Simple.</h2>
          <p className="hero-copy">One calm place to compare metro, bus, and walking routes—without the guesswork.</p>
        </div>
      </section>
    </div>
  );

  const renderChat = () => (
    <GeminiChatView
      initialPrompt={chatPrompt}
      onInitialPromptHandled={() => setChatPrompt(undefined)}
      onPlanRoute={(from, to) => {
        setOrigin(from);
        setDestination(to);
        setScreen("results");
        void handlePlanRoute();
      }}
      onNavigateScreen={(targetScreen) => setScreen(targetScreen)}
    />
  );

  const renderDisruptions = () => {
    const baselineRoute = simResult?.baseline?.routes?.[0];
    const affectedRoute = simResult?.affected?.routes?.[0];
    const comparison = simResult?.affected?.comparison;
    const delayImpact = comparison?.delayImpactMinutes ?? (affectedRoute && baselineRoute ? affectedRoute.totalDurationMinutes - baselineRoute.totalDurationMinutes : 0);

    return (
      <div className="simple-screen">
        <div className="page-heading">
          <p className="eyebrow">Scenario Lab</p>
          <h2>What-If Disruption Simulator</h2>
          <p className="hero-copy">
            ⚠️ All events are <strong>simulated</strong>. They do not represent live disruptions.
          </p>
        </div>

        {(!origin.trim() || !destination.trim()) && (
          <div className="aside-card" style={{ marginBottom: "12px", borderColor: "rgba(251, 191, 36, 0.3)", background: "rgba(251, 191, 36, 0.06)" }}>
            <p className="muted-copy">ℹ️ Plan a route first from the "Plan a trip" screen so the simulator has a journey to affect.</p>
            <button className="primary-button" style={{ marginTop: "8px" }} onClick={() => setScreen("home")}>
              Plan a journey first
            </button>
          </div>
        )}

        <div className="simulator-grid">
          {/* Controls Panel */}
          <div className="aside-card">
            <div className="aside-card-heading">
              <TriangleAlert size={16} />
              <strong>Simulated disruption controls</strong>
            </div>

            {/* Service selector */}
            <label className="field-label">Affected Service</label>
            <select
              className="select-field"
              value={simService}
              onChange={(e) => setSimService(e.target.value)}
            >
              <option value="metro-blue">Metro · Blue Line</option>
              <option value="metro-yellow">Metro · Yellow Line</option>
              <option value="metro-red">Metro · Red Line</option>
              <option value="metro-green">Metro · Green Line</option>
              <option value="bus-534">Bus · Route 534</option>
              <option value="bus-03down">Bus · Route 03DOWN</option>
              <option value="bus-general">Bus · General DTC</option>
            </select>

            {/* Delay slider */}
            <label className="field-label" style={{ marginTop: "10px" }}>
              Added delay: <strong style={{ color: delayMinutes > 0 ? "#fb7185" : "#34d399" }}>{delayMinutes} minutes</strong>
            </label>
            <input
              className="range-field"
              type="range"
              min="0"
              max="30"
              step="5"
              value={delayMinutes}
              onChange={(e) => setDelayMinutes(Number(e.target.value))}
            />
            <div className="range-labels"><span>On time</span><span>+30 min</span></div>

            {/* Station crowd */}
            <label className="field-label" style={{ marginTop: "10px" }}>Simulated crowd at station</label>
            <select
              className="select-field"
              value={simStation}
              onChange={(e) => setSimStation(e.target.value)}
            >
              <option>Rajiv Chowk</option>
              <option>Kashmere Gate</option>
              <option>Central Secretariat</option>
              <option>Botanical Garden</option>
              <option>Hauz Khas</option>
              <option>Karol Bagh</option>
            </select>
            <select
              className="select-field"
              style={{ marginTop: "6px" }}
              value={simCrowdLevel}
              onChange={(e) => setSimCrowdLevel(e.target.value as "low" | "medium" | "high")}
            >
              <option value="high">High Crowd</option>
              <option value="medium">Moderate Crowd</option>
              <option value="low">Low Crowd</option>
            </select>

            {/* Disable service */}
            <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px", cursor: "pointer", fontSize: "0.78rem", color: "#e2e8f0" }}>
              <input
                type="checkbox"
                checked={simDisable}
                onChange={(e) => setSimDisable(e.target.checked)}
                style={{ accentColor: "#f43f5e" }}
              />
              <span>Temporarily disable this service</span>
            </label>

            {/* Buttons */}
            <button
              className="primary-button"
              style={{ marginTop: "14px", opacity: simIsLoading ? 0.7 : 1 }}
              disabled={simIsLoading || !origin.trim()}
              onClick={() => void handleSimulate()}
            >
              <Sparkles size={15} />
              {simIsLoading ? "Simulating…" : "Apply & Simulate"}
            </button>
            <button
              className="quiet-button full-width"
              style={{ marginTop: "6px" }}
              onClick={() => {
                setDelayMinutes(10);
                setSimDisable(false);
                setSimStation("Rajiv Chowk");
                setSimCrowdLevel("high");
                setSimResult(null);
                setScenario({ active: false });
                setScenarioApplied(false);
              }}
            >
              Reset to Normal
            </button>
          </div>

          {/* Comparison Panel */}
          <div className="aside-card comparison-card">
            <p className="eyebrow" style={{ marginBottom: "8px" }}>Before / After comparison</p>

            {!simResult ? (
              <p className="muted-copy">
                {origin.trim() ? "Configure a disruption and click ‘Apply & Simulate’ to see the impact." : "Plan a route first, then return here."}
              </p>
            ) : (
              <>
                {/* Journey info */}
                <p style={{ fontSize: "0.72rem", color: "#60a5fa", marginBottom: "10px", fontWeight: 600 }}>
                  {origin} → {destination}
                </p>

                {/* Baseline row */}
                <div className="comparison-row">
                  <span>✅ Baseline (no disruption)</span>
                  <strong style={{ color: "#34d399" }}>
                    {baselineRoute?.totalDurationMinutes ?? "—"} min · {baselineRoute?.totalFare != null ? `₹${baselineRoute.totalFare}` : "—"}
                  </strong>
                </div>

                {/* Simulated row */}
                <div className="comparison-row">
                  <span>⚠️ Simulated ({simService.replace("-", " ")} +{delayMinutes}m)</span>
                  <strong style={{ color: delayImpact > 0 ? "#fb7185" : "#34d399" }}>
                    {affectedRoute?.totalDurationMinutes ?? "—"} min
                    {delayImpact > 0 && <span style={{ fontSize: "0.68rem" }}> (+{delayImpact}m)</span>}
                  </strong>
                </div>

                {/* Comparison explanation */}
                {comparison && (
                  <p className="muted-copy" style={{ marginTop: "8px", padding: "8px", background: "rgba(255,255,255,0.03)", borderRadius: "6px", borderLeft: "3px solid rgba(251, 191, 36, 0.4)", fontSize: "0.72rem" }}>
                    {comparison.impactExplanation}
                  </p>
                )}

                {/* Alternative recommendation */}
                {comparison?.alternativeRecommended && comparison.alternativeExplanation && (
                  <div style={{ marginTop: "10px", padding: "10px", borderRadius: "8px", background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.25)" }}>
                    <p style={{ fontSize: "0.68rem", fontWeight: 700, color: "#38bdf8", marginBottom: "4px" }}>💡 Recommended alternative:</p>
                    <p style={{ fontSize: "0.72rem", color: "#cbd5e1" }}>{comparison.alternativeExplanation}</p>
                  </div>
                )}

                {/* Reliability of affected route */}
                {affectedRoute?.reliabilityDetails && (
                  <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: "0.66rem",
                      padding: "3px 8px",
                      borderRadius: "999px",
                      fontWeight: 700,
                      background: affectedRoute.reliabilityDetails.reliabilityBand === "High" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                      color: affectedRoute.reliabilityDetails.reliabilityBand === "High" ? "#34d399" : "#fbbf24",
                      border: `1px solid ${affectedRoute.reliabilityDetails.reliabilityBand === "High" ? "rgba(16,185,129,0.35)" : "rgba(245,158,11,0.35)"}`
                    }}>
                      {affectedRoute.reliabilityDetails.reliabilityBand} Reliability ({affectedRoute.reliabilityDetails.reliabilityPercentage}%)
                    </span>
                    <span style={{ fontSize: "0.66rem", color: "#94a3b8", padding: "3px 6px", background: "rgba(255,255,255,0.04)", borderRadius: "999px", border: "1px solid rgba(255,255,255,0.08)" }}>
                      [Simulated scenario data]
                    </span>
                  </div>
                )}

                {/* View full affected results CTA */}
                <button
                  className="quiet-button full-width"
                  style={{ marginTop: "12px" }}
                  onClick={() => {
                    if (simResult?.affected) {
                      setRouteResponse(simResult.affected);
                      setSelectedRouteId(simResult.affected.summary.recommendedRouteId || simResult.affected.routes[0]?.id || null);
                      setScreen("results");
                    }
                  }}
                >
                  View full simulated results →
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSaved = () => (
    <div className="simple-screen">
      <div className="page-heading">
        <p className="eyebrow">Saved Journeys</p>
        <h2>Your Everyday Routes, Close At Hand.</h2>
        <p className="hero-copy">Your saved routes sync with Transit Route so optional morning alerts can reach you.</p>
      </div>
      {alertsError && <p className="inline-error">{alertsError}</p>}
      {!savedJourneys.length ? (
        <div className="empty-panel large-empty">
          <Bookmark size={30} />
          <h3>No saved journeys yet</h3>
          <p>Save a route after planning it and it will appear here.</p>
          <button className="primary-button" onClick={() => setScreen("home")}>Plan a journey</button>
        </div>
      ) : (
        <div className="saved-grid">
          {savedJourneys.map((journey) => (
            <article className="saved-card" key={journey.id}>
              <div>
                <p className="eyebrow">{journey.name}</p>
                <h3>{getJourneyFrom(journey)} <span>→</span> {getJourneyTo(journey)}</h3>
                <p className="muted-copy">Priority: {getJourneyPreference(journey)}</p>
                {journey.email && <p className="alert-label">Alerts: {journey.email}</p>}
              </div>
              <div className="saved-actions">
                <button className="quiet-button" onClick={() => openSavedJourney(journey)}>Recalculate</button>
                {journey.email && (
                  <button className="quiet-button" onClick={() => void stopAlerts(journey.id)}>Stop alerts</button>
                )}
                <button
                  className="icon-button danger"
                  aria-label="Remove journey"
                  onClick={() => persistSavedJourneys(savedJourneys.filter((item) => item.id !== journey.id))}
                >
                  <X size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <main className="sa-app">
      <header className="sa-header">
        <button className="brand" onClick={() => setScreen("home")}><img className="brand-logo-image" src="/transit-route-icon.png" alt="Transit Route" /><span><strong>Transit Route</strong><small>Delhi NCR journeys</small></span></button>
        <nav className="desktop-nav"><SlidingNav activeScreen={screen} onChange={setScreen} /></nav>
        <div className="header-actions">
          <button className="icon-button mobile-menu" aria-label="Open menu"><Menu size={18} /></button>
          <button className="header-save" onClick={() => setIsAlertsOpen(true)} title="View live bus positions and estimates">
            <RefreshCw size={15} /> Live buses
          </button>
          <button className="header-save" onClick={() => setScreen("saved")}><Bookmark size={15} /> {savedJourneys.length}</button>
        </div>
      </header>
      <div className="mobile-nav">{NAV_ITEMS.map((item) => <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => setScreen(item.id)}>{item.icon}<span>{item.label}</span></button>)}</div>
      <div className="sa-content" style={screen === "chat" ? { width: "100%", maxWidth: "100%", margin: 0, padding: 0 } : undefined}>
        {screen === "home" && renderHome()}
        {screen === "results" && renderResults()}
        {screen === "chat" && renderChat()}
        {screen === "disruptions" && renderDisruptions()}
        {screen === "saved" && renderSaved()}
      </div>

      {isSaveModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsSaveModalOpen(false)}>
          <form
            className="save-modal"
            onSubmit={(event) => {
              event.preventDefault();
              void saveCurrentJourney();
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="page-heading compact-heading">
              <div>
                <p className="eyebrow">Save journey</p>
                <h2>{origin} <span>to</span> {destination}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close"
                onClick={() => setIsSaveModalOpen(false)}
              >
                <X size={15} />
              </button>
            </div>
            <label className="alert-checkbox">
              <input
                type="checkbox"
                checked={emailAlertsEnabled}
                onChange={(event) => setEmailAlertsEnabled(event.target.checked)}
              />
              <span>Email me morning alerts (weekdays, 7:30 AM)</span>
            </label>
            {emailAlertsEnabled && (
              <>
                <label className="field-label" htmlFor="alert-email">Email address</label>
                <input
                  id="alert-email"
                  className="email-field"
                  type="email"
                  required
                  value={alertEmail}
                  onChange={(event) => setAlertEmail(event.target.value)}
                  placeholder="you@example.com"
                />
                <p className="muted-copy">We only use this to send your commute alert. No account needed.</p>
              </>
            )}
            {saveError && <p className="inline-error">{saveError}</p>}
            <div className="saved-actions modal-actions">
              <button
                type="button"
                className="quiet-button"
                onClick={() => setIsSaveModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : "Save journey"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Footer with legal & compliance links */}
      {screen !== "chat" && (
      <footer
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          fontSize: "0.75rem",
          color: "#64748b",
          background: "rgba(4, 6, 15, 0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontWeight: 600, color: "#94a3b8" }}>Transit Route</span>
          <span>•</span>
          <span>Delhi NCR Multimodal Transit Planner</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link href="/privacy" style={{ color: "#94a3b8", textDecoration: "none", transition: "color 0.2s" }}>
            Privacy Policy
          </Link>
          <Link href="/terms" style={{ color: "#94a3b8", textDecoration: "none", transition: "color 0.2s" }}>
            Terms & Conditions
          </Link>
          <button
            onClick={() => setIsApiInspectorOpen(true)}
            style={{
              background: "transparent",
              border: "none",
              color: "#38bdf8",
              cursor: "pointer",
              fontSize: "0.75rem",
              padding: 0,
            }}
          >
            API Contract
          </button>
        </div>
      </footer>
      )}

      <ApiInspectorModal isOpen={isApiInspectorOpen} onClose={() => setIsApiInspectorOpen(false)} lastRequest={lastRequest} lastResponse={routeResponse} />
      <LiveAlertsModal isOpen={isAlertsOpen} onClose={() => setIsAlertsOpen(false)} cityId={selectedCity} />
    </main>
  );
}