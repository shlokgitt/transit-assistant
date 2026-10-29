"use client";

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
import { ItineraryView } from "@/components/ItineraryView";
import { TransitMap } from "@/components/TransitMap";
import { ChatPanel } from "@/components/ChatPanel";
import { ApiInspectorModal } from "@/components/ApiInspectorModal";
import { LiveAlertsModal } from "@/components/LiveAlertsModal";
import { CITIES } from "@/lib/transitData";
import {
  RoutePlanRequest,
  RoutePlanResponse,
  RoutingPriority,
  TransitMode,
} from "@/types/transit";

type Screen = "home" | "results" | "chat" | "disruptions" | "saved";
type SavedJourney = {
  id: string;
  name: string;
  origin: string;
  destination: string;
  priority: RoutingPriority;
  createdAt: string;
};

const STORAGE_KEY = "transitsaathi-saved-journeys";

const NAV_ITEMS: { id: Screen; label: string; icon: React.ReactNode }[] = [
  { id: "home", label: "Plan a trip", icon: <Compass size={16} /> },
  { id: "results", label: "Results", icon: <GitCompareArrows size={16} /> },
  { id: "chat", label: "Travel chat", icon: <Bot size={16} /> },
  { id: "disruptions", label: "Simulator", icon: <TriangleAlert size={16} /> },
  { id: "saved", label: "Saved journeys", icon: <Bookmark size={16} /> },
];

function SlidingNav({
  activeScreen,
  onChange,
}: {
  activeScreen: Screen;
  onChange: (screen: Screen) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
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
    const resizeObserver = new ResizeObserver(() => moveToActiveTab(false));
    resizeObserver.observe(bar);
    return () => resizeObserver.disconnect();
  }, [activeScreen]);

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
          onClick={() => onChange(item.id)}
        >
          {item.icon}
          {item.label}
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
    "auto",
    "walk",
  ]);
  const [priority, setPriority] = useState<RoutingPriority>("fastest");
  const [avoidCrowded, setAvoidCrowded] = useState(false);
  const [period, setPeriod] = useState<"peak" | "offpeak">("peak");
  const [isLoading, setIsLoading] = useState(false);
  const [routeResponse, setRouteResponse] = useState<RoutePlanResponse | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<RoutePlanRequest | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedLegIndex, setSelectedLegIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"routes" | "itinerary">("routes");
  const [isApiInspectorOpen, setIsApiInspectorOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [savedJourneys, setSavedJourneys] = useState<SavedJourney[]>([]);
  const [delayMinutes, setDelayMinutes] = useState(10);
  const [scenarioApplied, setScenarioApplied] = useState(false);
  const [chatPrompt, setChatPrompt] = useState<string | undefined>();

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
      if (stored) setSavedJourneys(JSON.parse(stored) as SavedJourney[]);
    } catch {
      setSavedJourneys([]);
    }
  }, []);

  const persistSavedJourneys = (next: SavedJourney[]) => {
    setSavedJourneys(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handlePlanRoute = useCallback(async () => {
    if (!origin.trim() || !destination.trim() || origin.trim() === destination.trim()) {
      setRouteError("Enter two different places to plan a journey.");
      return;
    }

    setIsLoading(true);
    setRouteError(null);
    const requestPayload: RoutePlanRequest = {
      city: selectedCity,
      origin: { query: origin.trim() },
      destination: { query: destination.trim() },
      preferences: {
        routingPriority: priority,
        allowedModes: selectedModes,
        avoidCrowded,
        period,
        maxWalkingDistanceMeters: 1200,
      },
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
    } finally {
      setIsLoading(false);
    }
  }, [avoidCrowded, destination, origin, period, priority, selectedCity, selectedModes]);

  const openSavedJourney = (journey: SavedJourney) => {
    setOrigin(journey.origin);
    setDestination(journey.destination);
    setPriority(journey.priority);
    setScreen("home");
  };

  const saveCurrentJourney = () => {
    if (!origin || !destination) return;
    const journey: SavedJourney = {
      id: crypto.randomUUID(),
      name: `${origin} to ${destination}`,
      origin,
      destination,
      priority,
      createdAt: new Date().toISOString(),
    };
    persistSavedJourneys([journey, ...savedJourneys]);
  };

  const renderResults = () => (
    <div className="journey-workspace">
      <section className="results-column">
        <div className="page-heading compact-heading">
          <div>
            <p className="eyebrow">Route results</p>
            <h2>{origin} <span>to</span> {destination}</h2>
            <p className="muted-copy">Compare available journeys from the live route planner.</p>
          </div>
          <button className="quiet-button" onClick={() => setScreen("home")}>
            <Settings2 size={15} /> Edit search
          </button>
        </div>
        <div className="result-toolbar">
          <span>{routeResponse?.routes.length || 0} option{routeResponse?.routes.length === 1 ? "" : "s"}</span>
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
            {selectedRoute && (
              <button className="save-journey-button" onClick={saveCurrentJourney}><Save size={16} /> Save this journey</button>
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
        <div className="page-heading">
          <p className="eyebrow">Delhi NCR transit planner</p>
          <h2>Make the next journey feel simple.</h2>
          <p className="hero-copy">One calm place to compare metro, bus, and walking routes—without the guesswork.</p>
        </div>
        <SearchPanel city={city} origin={origin} destination={destination} onChangeOrigin={setOrigin} onChangeDestination={setDestination} onSwap={() => { setOrigin(destination); setDestination(origin); }} selectedModes={selectedModes} onToggleMode={(mode) => setSelectedModes((current) => current.includes(mode) ? (current.length === 1 ? current : current.filter((item) => item !== mode)) : [...current, mode])} priority={priority} onChangePriority={setPriority} avoidCrowded={avoidCrowded} onToggleAvoidCrowded={() => setAvoidCrowded((value) => !value)} onSearch={handlePlanRoute} isLoading={isLoading} onSelectPreset={(from, to) => { setOrigin(from); setDestination(to); }} />
      </section>
      <section className="home-aside">
        <div className="aside-card route-note">
          <div className="aside-icon"><TrainFront size={18} /></div>
          <p className="eyebrow">Built for real trips</p>
          <h3>Start with a place, not a station code.</h3>
          <p className="muted-copy">Search by landmark, metro station, or bus stop. The planner will explain the journey in plain language.</p>
        </div>
        <div className="aside-card">
          <div className="aside-card-heading"><Clock3 size={16} /><strong>Recent journeys</strong></div>
          {savedJourneys.slice(0, 3).map((journey) => <button className="recent-item" key={journey.id} onClick={() => openSavedJourney(journey)}><span>{journey.origin} → {journey.destination}</span><ChevronRight size={14} /></button>)}
          {!savedJourneys.length && <p className="muted-copy">Saved journeys will appear here after your first trip.</p>}
        </div>
      </section>
    </div>
  );

  const renderChat = () => (
    <div className="simple-screen">
      <div className="page-heading">
        <p className="eyebrow">Travel chat</p>
        <h2>Ask for a better way there.</h2>
        <p className="hero-copy">Tell the assistant what matters—price, walking, crowding, or an explanation in Hindi.</p>
      </div>
      <div className="chat-screen-card">
        <div className="chat-screen-intro"><div className="aside-icon"><Bot size={20} /></div><div><h3>TransitSaathi assistant</h3><p className="muted-copy">Route answers are grounded in the planner, not invented by the assistant.</p></div></div>
        <div className="prompt-row"><span>Try asking</span>{["Find the cheapest route", "Avoid crowded stations", "Explain this in Hindi"].map((prompt) => <button key={prompt} onClick={() => { setChatPrompt(prompt); setScreen("chat"); }}>“{prompt}”</button>)}</div>
      </div>
      <ChatPanel initialPrompt={chatPrompt} onInitialPromptHandled={() => setChatPrompt(undefined)} onPlanRoute={(from, to) => { setOrigin(from); setDestination(to); void handlePlanRoute(); }} />
    </div>
  );

  const renderDisruptions = () => (
    <div className="simple-screen">
      <div className="page-heading"><p className="eyebrow">Scenario lab</p><h2>See how a delay changes the journey.</h2><p className="hero-copy">This is a simulation. It does not represent live disruptions.</p></div>
      <div className="simulator-grid">
        <div className="aside-card">
          <div className="aside-card-heading"><TriangleAlert size={16} /><strong>Simulated disruption</strong></div>
          <label className="field-label">Service</label><select className="select-field"><option>Metro · Blue Line</option><option>Bus · Route 534</option></select>
          <label className="field-label">Added delay: {delayMinutes} minutes</label><input className="range-field" type="range" min="0" max="30" step="5" value={delayMinutes} onChange={(event) => setDelayMinutes(Number(event.target.value))} />
          <div className="range-labels"><span>On time</span><span>30 min</span></div>
          <button className="primary-button" onClick={() => setScenarioApplied(true)}><Sparkles size={16} /> Apply scenario</button>
          <button className="quiet-button full-width" onClick={() => { setDelayMinutes(0); setScenarioApplied(false); }}>Reset</button>
        </div>
        <div className="aside-card comparison-card">
          <p className="eyebrow">Before / after</p>
          {selectedRoute ? <><div className="comparison-row"><span>Baseline</span><strong>{selectedRoute.totalDurationMinutes} min</strong></div><div className="comparison-row"><span>Simulated estimate</span><strong>{selectedRoute.totalDurationMinutes + (scenarioApplied ? delayMinutes : 0)} min</strong></div><p className="muted-copy">{scenarioApplied ? `The selected service adds ${delayMinutes} minutes in this demo scenario. Re-run the search to compare alternatives.` : "Apply a scenario to see the affected estimate."}</p></> : <p className="muted-copy">Plan a route first, then return here to test a disruption.</p>}
        </div>
      </div>
    </div>
  );

  const renderSaved = () => (
    <div className="simple-screen">
      <div className="page-heading"><p className="eyebrow">Saved journeys</p><h2>Your everyday routes, close at hand.</h2><p className="hero-copy">These journeys are saved only in this browser. Recalculate before travelling.</p></div>
      {!savedJourneys.length ? <div className="empty-panel large-empty"><Bookmark size={30} /><h3>No saved journeys yet</h3><p>Save a route after planning it and it will appear here.</p><button className="primary-button" onClick={() => setScreen("home")}>Plan a journey</button></div> : <div className="saved-grid">{savedJourneys.map((journey) => <article className="saved-card" key={journey.id}><div><p className="eyebrow">{journey.name}</p><h3>{journey.origin} <span>→</span> {journey.destination}</h3><p className="muted-copy">Priority: {journey.priority}</p></div><div className="saved-actions"><button className="quiet-button" onClick={() => openSavedJourney(journey)}>Recalculate</button><button className="icon-button danger" aria-label="Remove journey" onClick={() => persistSavedJourneys(savedJourneys.filter((item) => item.id !== journey.id))}><X size={15} /></button></div></article>)}</div>}
    </div>
  );

  return (
    <main className="sa-app">
      <header className="sa-header">
        <button className="brand" onClick={() => setScreen("home")}><span className="brand-mark"><RouteIcon size={18} /></span><span><strong>TransitSaathi</strong><small>Delhi NCR journeys</small></span></button>
        <nav className="desktop-nav"><SlidingNav activeScreen={screen} onChange={setScreen} /></nav>
        <div className="header-actions"><button className="icon-button mobile-menu" aria-label="Open menu"><Menu size={18} /></button><button className="header-save" onClick={() => setScreen("saved")}><Bookmark size={15} /> {savedJourneys.length}</button></div>
      </header>
      <div className="mobile-nav">{NAV_ITEMS.map((item) => <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => setScreen(item.id)}>{item.icon}<span>{item.label}</span></button>)}</div>
      <div className="sa-content">
        {screen === "home" && renderHome()}
        {screen === "results" && renderResults()}
        {screen === "chat" && renderChat()}
        {screen === "disruptions" && renderDisruptions()}
        {screen === "saved" && renderSaved()}
      </div>
      <ApiInspectorModal isOpen={isApiInspectorOpen} onClose={() => setIsApiInspectorOpen(false)} lastRequest={lastRequest} lastResponse={routeResponse} />
      <LiveAlertsModal isOpen={isAlertsOpen} onClose={() => setIsAlertsOpen(false)} cityId={selectedCity} />
    </main>
  );
}
