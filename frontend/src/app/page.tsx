"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { SearchPanel } from "@/components/SearchPanel";
import { RouteCard } from "@/components/RouteCard";
import { ItineraryView } from "@/components/ItineraryView";
import { TransitMap } from "@/components/TransitMap";
import { ApiInspectorModal } from "@/components/ApiInspectorModal";
import { LiveAlertsModal } from "@/components/LiveAlertsModal";
import { ChatPanel } from "@/components/ChatPanel";
import {
  TransitMode, RoutingPriority, RoutePlanRequest,
  RoutePlanResponse,
} from "@/types/transit";
import { CITIES } from "@/lib/transitData";
import {
  ListFilter, Navigation,
} from "lucide-react";

const FEATURE_CARDS = [
  {
    icon: "📡",
    iconBg: "linear-gradient(135deg, rgba(59,130,246,0.3), rgba(6,182,212,0.2))",
    iconGlow: "0 0 20px rgba(59,130,246,0.4)",
    title: "Live Crowd Insights",
  desc: "Uses the route planner's real delay and crowd metadata for Delhi NCR journey planning.",
  tag: "GTFS",
  tagColor: "#34d399",
  },
  {
    icon: "🗺️",
    iconBg: "linear-gradient(135deg, rgba(168,85,247,0.3), rgba(99,102,241,0.2))",
    iconGlow: "0 0 20px rgba(168,85,247,0.4)",
    title: "Multi-Modal Routing",
  desc: "Combines Metro, Bus, Auto, and Walking into one real route-planning flow.",
    tag: "LIVE",
    tagColor: "#34d399",
  },
  {
    icon: "🌿",
    iconBg: "linear-gradient(135deg, rgba(16,185,129,0.3), rgba(74,222,128,0.2))",
    iconGlow: "0 0 20px rgba(16,185,129,0.4)",
    title: "Low-Carbon Travel",
  desc: "Tracks per-leg emissions using the computed route result instead of static demo assumptions.",
  tag: "REAL",
  tagColor: "#34d399",
  },
  {
    icon: "⚡",
    iconBg: "linear-gradient(135deg, rgba(245,158,11,0.3), rgba(251,191,36,0.2))",
    iconGlow: "0 0 20px rgba(245,158,11,0.4)",
  title: "Route Accuracy",
  desc: "Built from Delhi GTFS data and the real route planner, not static mock fares.",
  tag: "REAL DATA",
  tagColor: "#34d399",
  },
];

const STATS = [
  { value: "1", label: "City Covered" },
  { value: "6", label: "Transport Modes" },
  { value: "48+", label: "Metro Stations" },
  { value: "500+", label: "Bus Routes" },
  { value: "< 300ms", label: "Route Computation" },
  { value: "GTFS", label: "Open Data Standard" },
];

export default function Home() {
  const [selectedCity, setSelectedCity] = useState<string>("delhi");
  const [origin, setOrigin] = useState<string>("Karol Bagh");
  const [destination, setDestination] = useState<string>("Gandhi Darshan");
  const [selectedModes, setSelectedModes] = useState<TransitMode[]>(["metro", "bus", "cab", "auto", "walk"]);
  const [priority, setPriority] = useState<RoutingPriority>("fastest");
  const [avoidCrowded, setAvoidCrowded] = useState<boolean>(false);
  const [period, setPeriod] = useState<"peak" | "offpeak">("peak");

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [routeResponse, setRouteResponse] = useState<RoutePlanResponse | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<RoutePlanRequest | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"routes" | "itinerary">("routes");
  const [selectedLegIndex, setSelectedLegIndex] = useState<number | null>(null);

  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationStep, setSimulationStep] = useState<number>(0);

  const [isApiInspectorOpen, setIsApiInspectorOpen] = useState<boolean>(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState<boolean>(false);
  const currentCity = CITIES[selectedCity] || CITIES["delhi"];

  const handlePlanRoute = useCallback(async () => {
    setIsLoading(true);
    setIsSimulating(false);
    setSimulationStep(0);
    setRouteError(null);

    const requestPayload: RoutePlanRequest = {
      city: selectedCity,
      origin: { query: origin },
      destination: { query: destination },
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
      const res = await fetch("/api/v1/routes/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });
      const data = (await res.json()) as RoutePlanResponse & { error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Route planning failed");
      }
      setRouteResponse(data);
      if (data.routes?.length > 0) setSelectedRouteId(data.summary.recommendedRouteId || data.routes[0].id);
    } catch (err) {
      setRouteResponse(null);
      setSelectedRouteId(null);
      setRouteError(err instanceof Error ? err.message : "Route planning failed");
    }
    setIsLoading(false);
  }, [
    avoidCrowded,
    destination,
    origin,
    period,
    priority,
    selectedCity,
    selectedModes,
  ]);

  useEffect(() => { void handlePlanRoute(); }, [handlePlanRoute]);

  const handleToggleMode = (mode: TransitMode) => {
    setSelectedModes((prev) => {
      if (prev.includes(mode)) {
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== mode);
      }
      return [...prev, mode];
    });
  };

  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const handleSelectPreset = (from: string, to: string) => {
    setOrigin(from);
    setDestination(to);
  };

  const handleCityChange = (cityId: string) => {
    setSelectedCity(cityId);
    const c = CITIES[cityId] || CITIES["delhi"];
    if (c.popularPresets.length > 0) {
      setOrigin(c.popularPresets[0].from);
      setDestination(c.popularPresets[0].to);
    }
  };

  const selectedRoute =
    routeResponse?.routes.find((r) => r.id === selectedRouteId) ||
    routeResponse?.routes[0] ||
    null;

  useEffect(() => {
    if (!isSimulating || !selectedRoute) return;
    const timer = setInterval(() => {
      setSimulationStep((prev) => {
        if (prev >= selectedRoute.legs.length - 1) { setIsSimulating(false); return 0; }
        return prev + 1;
      });
    }, 3500);
    return () => clearInterval(timer);
  }, [isSimulating, selectedRoute]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", width: "100vw", overflow: "hidden", backgroundColor: "var(--bg-dark)" }}>
      {/* Top Header */}
      <Header
        selectedCity={selectedCity}
        onSelectCity={handleCityChange}
        onOpenApiInspector={() => setIsApiInspectorOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        period={period}
        onTogglePeriod={() => setPeriod((p) => (p === "peak" ? "offpeak" : "peak"))}
      />

      {/* Stats Ribbon */}
      <div className="stats-ribbon">
        {STATS.map((s, i) => (
          <div key={i} className="stats-ribbon-item">
            <span>{s.value}</span>
            <span>{s.label}</span>
          </div>
        ))}
        <div className="demo-banner" style={{ marginLeft: "auto" }}>
          ✓ Real route values from planner
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="app-layout" style={{ flex: 1, minHeight: 0 }}>
        {/* Left Side: Search + Cards */}
        <div style={{
          display: "flex", flexDirection: "column", height: "100%",
          background: "linear-gradient(180deg, rgba(9,13,26,0.98) 0%, rgba(7,10,19,0.99) 100%)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          overflow: "hidden", zIndex: 20,
        }}>
          {/* Search Panel */}
          <SearchPanel
            city={currentCity}
            origin={origin}
            destination={destination}
            onChangeOrigin={setOrigin}
            onChangeDestination={setDestination}
            onSwap={handleSwap}
            selectedModes={selectedModes}
            onToggleMode={handleToggleMode}
            priority={priority}
            onChangePriority={setPriority}
            avoidCrowded={avoidCrowded}
            onToggleAvoidCrowded={() => setAvoidCrowded((a) => !a)}
            onSearch={handlePlanRoute}
            isLoading={isLoading}
            onSelectPreset={handleSelectPreset}
          />

          {/* Tab Bar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 14px",
            background: "rgba(7,10,19,0.8)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ display: "flex", gap: "4px" }}>
              {[
                { id: "routes" as const, label: `Options (${routeResponse?.routes.length || 0})`, icon: <ListFilter size={12} /> },
                { id: "itinerary" as const, label: "Turn Navigation", icon: <Navigation size={12} />, disabled: !selectedRoute },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => !tab.disabled && setActiveTab(tab.id)}
                  disabled={tab.disabled}
                  style={{
                    display: "flex", alignItems: "center", gap: "5px",
                    padding: "5px 10px", borderRadius: "7px", fontSize: "0.73rem", fontWeight: 600,
                    cursor: tab.disabled ? "not-allowed" : "pointer", border: "none",
                    background: activeTab === tab.id ? "rgba(59,130,246,0.2)" : "transparent",
                    color: activeTab === tab.id ? "#60a5fa" : "#4b5a6e",
                    opacity: tab.disabled ? 0.4 : 1,
                    transition: "all 0.15s ease",
                  }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#60a5fa" }}>
              LIVE BACKEND
            </span>
          </div>

          {/* Scrollable Cards / Itinerary */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {activeTab === "routes" ? (
              <>
                {isLoading ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {[1,2,3].map(i => (
                      <div key={i} style={{
                        height: "130px", borderRadius: "14px",
                        background: "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.07), rgba(255,255,255,0.04))",
                        backgroundSize: "200%",
                        animation: "shimmerLoad 1.5s ease-in-out infinite",
                      }}>
                        <style>{`@keyframes shimmerLoad { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
                      </div>
                    ))}
                  </div>
                ) : routeError ? (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: "#fca5a5" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "12px" }}>⚠️</div>
                    <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>Route planning failed</p>
                    <p style={{ fontSize: "0.75rem", marginTop: "4px" }}>{routeError}</p>
                  </div>
                ) : routeResponse && routeResponse.routes.length > 0 ? (
                  routeResponse.routes.map((r) => (
                    <RouteCard
                      key={r.id}
                      route={r}
                      isSelected={r.id === selectedRouteId}
                      onSelect={() => {
                        setSelectedRouteId(r.id);
                        setSelectedLegIndex(null);
                        setIsSimulating(false);
                      }}
                    />
                  ))
                ) : (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: "#4b5a6e" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🔍</div>
                    <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>No routes found</p>
                    <p style={{ fontSize: "0.75rem", marginTop: "4px" }}>Try enabling more transport modes</p>
                  </div>
                )}
              </>
            ) : (
              selectedRoute && (
                <ItineraryView
                  route={selectedRoute}
                  simulationStep={simulationStep}
                  isSimulating={isSimulating}
                  onStartSimulation={() => setIsSimulating(true)}
                  onResetSimulation={() => { setIsSimulating(false); setSimulationStep(0); }}
                />
              )
            )}
          </div>
        </div>

        {/* Right Side: Interactive Leaflet Map */}
        <div style={{ height: "100%", width: "100%", position: "relative" }}>
          <TransitMap
            city={currentCity}
            route={selectedRoute}
            selectedLegIndex={selectedLegIndex}
            simulationStep={simulationStep}
            isSimulating={isSimulating}
          />
        </div>
      </div>

      {/* Feature Cards Section */}
      <div className="features-section">
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          {/* Section Header */}
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "4px 14px", borderRadius: "999px",
              background: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.25)",
              fontSize: "0.7rem", fontWeight: 700, color: "#60a5fa",
              textTransform: "uppercase", letterSpacing: "0.08em",
              marginBottom: "14px",
            }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#60a5fa", boxShadow: "0 0 8px #60a5fa" }} />
              Platform Capabilities
            </div>
            <h2 style={{
              fontSize: "1.8rem", fontWeight: 900, letterSpacing: "-0.03em",
              background: "linear-gradient(135deg, #fff 30%, #93c5fd 70%, #67e8f9 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              marginBottom: "10px",
            }}>
              Smart Transit. Smarter City.
            </h2>
            <p style={{ fontSize: "0.88rem", color: "#4b5a6e", maxWidth: "480px", margin: "0 auto", lineHeight: 1.6 }}>
              Built for the next generation of urban mobility — multimodal, sustainable, and AI-assisted.
            </p>
          </div>

          <div className="features-grid">
            {FEATURE_CARDS.map((card, i) => (
              <div key={i} className="feature-card">
                {/* Background glow blob */}
                <div style={{
                  position: "absolute", top: "-30px", right: "-30px",
                  width: "120px", height: "120px", borderRadius: "50%",
                  background: card.iconBg, filter: "blur(30px)", opacity: 0.5,
                  pointerEvents: "none",
                }} />

                {/* Icon */}
                <div className="feature-icon-wrap" style={{ background: card.iconBg, boxShadow: card.iconGlow }}>
                  <span style={{ fontSize: "22px" }}>{card.icon}</span>
                </div>

                {/* Tag */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{
                    fontSize: "0.58rem", fontWeight: 800, textTransform: "uppercase",
                    letterSpacing: "0.08em", padding: "2px 7px", borderRadius: "999px",
                    color: card.tagColor,
                    background: `${card.tagColor}18`,
                    border: `1px solid ${card.tagColor}40`,
                  }}>
                    {card.tag}
                  </span>
                </div>

                <h3>{card.title}</h3>
                <p>{card.desc}</p>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div style={{
            textAlign: "center", marginTop: "48px",
            padding: "28px", borderRadius: "20px",
            background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(6,182,212,0.06))",
            border: "1px solid rgba(59,130,246,0.15)",
          }}>
            <p style={{ fontSize: "0.78rem", color: "#4b5a6e", marginBottom: "6px" }}>
              🚆 TransitPulse v1.0 • Real Delhi NCR route planning
            </p>
            <p style={{ fontSize: "0.88rem", color: "#94a3b8", fontWeight: 500 }}>
              Multimodal Urban Route Assistant • Delhi NCR • GTFS Open Data
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ApiInspectorModal
        isOpen={isApiInspectorOpen}
        onClose={() => setIsApiInspectorOpen(false)}
        lastRequest={lastRequest}
        lastResponse={routeResponse}
      />
      {/* AI Chat Assistant */}
      <ChatPanel
        onPlanRoute={(from, to) => {
          setOrigin(from);
          setDestination(to);
          void handlePlanRoute();
        }}
      />

      <LiveAlertsModal
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        cityId={selectedCity}
      />
    </div>
  );
}
