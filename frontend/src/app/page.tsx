"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { SearchPanel } from "@/components/SearchPanel";
import { RouteCard } from "@/components/RouteCard";
import { ItineraryView } from "@/components/ItineraryView";
import { TransitMap } from "@/components/TransitMap";
import { ApiInspectorModal } from "@/components/ApiInspectorModal";
import { LiveAlertsModal } from "@/components/LiveAlertsModal";
import {
  TransitMode,
  RoutingPriority,
  RoutePlanRequest,
  RoutePlanResponse,
  RouteOption,
} from "@/types/transit";
import { CITIES, planRoutesMock } from "@/lib/transitData";
import {
  ListFilter,
  Navigation,
  Sparkles,
  SlidersHorizontal,
  ChevronRight,
  Database,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

export default function Home() {
  const [selectedCity, setSelectedCity] = useState<string>("delhi");
  const [origin, setOrigin] = useState<string>("Karol Bagh");
  const [destination, setDestination] = useState<string>("Gandhi Darshan");
  const [selectedModes, setSelectedModes] = useState<TransitMode[]>([
    "metro",
    "bus",
    "cab",
    "bike",
    "auto",
    "walk",
  ]);
  const [priority, setPriority] = useState<RoutingPriority>("fastest");
  const [avoidCrowded, setAvoidCrowded] = useState<boolean>(false);
  const [period, setPeriod] = useState<"peak" | "offpeak">("peak");

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [routeResponse, setRouteResponse] = useState<RoutePlanResponse | null>(null);
  const [lastRequest, setLastRequest] = useState<RoutePlanRequest | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"routes" | "itinerary">("routes");
  const [selectedLegIndex, setSelectedLegIndex] = useState<number | null>(null);

  // Simulation State
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationStep, setSimulationStep] = useState<number>(0);

  // Modals
  const [isApiInspectorOpen, setIsApiInspectorOpen] = useState<boolean>(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState<boolean>(false);

  // Data Source Mode: Mock Response vs Live API Route
  const [dataSource, setDataSource] = useState<"mock" | "api">("mock");

  // Current City Object
  const currentCity = CITIES[selectedCity] || CITIES["delhi"];

  // Run Route Planning
  const handlePlanRoute = async () => {
    setIsLoading(true);
    setIsSimulating(false);
    setSimulationStep(0);

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

    if (dataSource === "api") {
      try {
        const res = await fetch("/api/v1/routes/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
        });
        const data = (await res.json()) as RoutePlanResponse;
        setRouteResponse(data);
        if (data.routes && data.routes.length > 0) {
          setSelectedRouteId(data.summary.recommendedRouteId || data.routes[0].id);
        }
      } catch (err) {
        console.warn("API route fallback to mock:", err);
        const data = planRoutesMock(requestPayload);
        setRouteResponse(data);
        if (data.routes && data.routes.length > 0) {
          setSelectedRouteId(data.summary.recommendedRouteId || data.routes[0].id);
        }
      }
    } else {
      // Immediate rich mock response
      setTimeout(() => {
        const data = planRoutesMock(requestPayload);
        setRouteResponse(data);
        if (data.routes && data.routes.length > 0) {
          setSelectedRouteId(data.summary.recommendedRouteId || data.routes[0].id);
        }
        setIsLoading(false);
      }, 300);
      return;
    }

    setIsLoading(false);
  };

  // Initial Route Computation on Mount
  useEffect(() => {
    handlePlanRoute();
  }, [selectedCity, priority, avoidCrowded, period]);

  // Mode Toggle Handler
  const handleToggleMode = (mode: TransitMode) => {
    setSelectedModes((prev) => {
      if (prev.includes(mode)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((m) => m !== mode);
      }
      return [...prev, mode];
    });
  };

  // Swap Origin and Destination
  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  // Preset Selection
  const handleSelectPreset = (from: string, to: string) => {
    setOrigin(from);
    setDestination(to);
  };

  // City Change Handler
  const handleCityChange = (cityId: string) => {
    setSelectedCity(cityId);
    const c = CITIES[cityId] || CITIES["delhi"];
    if (c.popularPresets.length > 0) {
      setOrigin(c.popularPresets[0].from);
      setDestination(c.popularPresets[0].to);
    }
  };

  // Simulation Timer
  const selectedRoute =
    routeResponse?.routes.find((r) => r.id === selectedRouteId) ||
    routeResponse?.routes[0] ||
    null;

  useEffect(() => {
    if (!isSimulating || !selectedRoute) return;

    const timer = setInterval(() => {
      setSimulationStep((prev) => {
        if (prev >= selectedRoute.legs.length - 1) {
          setIsSimulating(false);
          return 0;
        }
        return prev + 1;
      });
    }, 3500);

    return () => clearInterval(timer);
  }, [isSimulating, selectedRoute]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        backgroundColor: "var(--bg-dark)",
      }}
    >
      {/* Top Header */}
      <Header
        selectedCity={selectedCity}
        onSelectCity={handleCityChange}
        onOpenApiInspector={() => setIsApiInspectorOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        period={period}
        onTogglePeriod={() => setPeriod((p) => (p === "peak" ? "offpeak" : "peak"))}
      />

      {/* Main Split Layout: Left Control Panel & Right Interactive Map */}
      <div className="app-layout" style={{ flex: 1, minHeight: 0 }}>
        {/* Left Side: Search, Filters & Route Cards */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            background: "rgba(11, 17, 32, 0.95)",
            borderRight: "1px solid var(--border-glass)",
            overflow: "hidden",
            zIndex: 20,
          }}
        >
          {/* Top Search Controls */}
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

          {/* Navigation Sub-Tabs: Route Options vs Itinerary View */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 16px",
              background: "rgba(15, 23, 42, 0.75)",
              borderBottom: "1px solid var(--border-glass)",
            }}
          >
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={() => setActiveTab("routes")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 12px",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  background: activeTab === "routes" ? "rgba(59, 130, 246, 0.25)" : "transparent",
                  color: activeTab === "routes" ? "#60a5fa" : "var(--text-secondary)",
                }}
              >
                <ListFilter size={13} />
                <span>Options ({routeResponse?.routes.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveTab("itinerary")}
                disabled={!selectedRoute}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 12px",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: selectedRoute ? "pointer" : "not-allowed",
                  border: "none",
                  background: activeTab === "itinerary" ? "rgba(59, 130, 246, 0.25)" : "transparent",
                  color: activeTab === "itinerary" ? "#60a5fa" : "var(--text-secondary)",
                  opacity: selectedRoute ? 1 : 0.5,
                }}
              >
                <Navigation size={13} />
                <span>Turn Navigation</span>
              </button>
            </div>

            {/* Data Engine Toggle */}
            <button
              onClick={() => setDataSource((d) => (d === "mock" ? "api" : "mock"))}
              title="Toggle between Mock Responses and Next.js /api/v1 Routes"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "3px 8px",
                borderRadius: "4px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: dataSource === "mock" ? "#34d399" : "#60a5fa",
                fontSize: "0.68rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Database size={11} />
              <span>{dataSource === "mock" ? "Mock Contract" : "Live API"}</span>
            </button>
          </div>

          {/* Scrollable Content: Cards List or Itinerary Detail */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {activeTab === "routes" ? (
              <>
                {routeResponse && routeResponse.routes.length > 0 ? (
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
                  <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
                    <p style={{ fontSize: "0.85rem" }}>No routes found matching selected filters.</p>
                    <p style={{ fontSize: "0.75rem", marginTop: "4px" }}>Try enabling more transit modes.</p>
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
                  onResetSimulation={() => {
                    setIsSimulating(false);
                    setSimulationStep(0);
                  }}
                />
              )
            )}
          </div>
        </div>

        {/* Right Side: Interactive Vector Map View */}
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

      {/* API Contract Inspector Modal */}
      <ApiInspectorModal
        isOpen={isApiInspectorOpen}
        onClose={() => setIsApiInspectorOpen(false)}
        lastRequest={lastRequest}
        lastResponse={routeResponse}
      />

      {/* Live Alerts Radar Modal */}
      <LiveAlertsModal
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        cityId={selectedCity}
      />
    </div>
  );
}
