"use client";

import React, { useState, useEffect } from "react";
import {
  RouteOption,
  RouteLeg,
  TransitMode,
} from "@/types/transit";
import {
  Train,
  Bus,
  Car,
  Footprints,
  Clock,
  ArrowRight,
  ShieldCheck,
  Leaf,
  Flame,
  Play,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ItineraryViewProps {
  route: RouteOption;
  onClose?: () => void;
  simulationStep: number;
  isSimulating: boolean;
  onStartSimulation: () => void;
  onResetSimulation: () => void;
}

const MODE_ICON: Record<TransitMode, React.ReactNode> = {
  metro: <Train size={15} />,
  bus: <Bus size={15} />,
  auto: <span style={{ fontSize: "13px" }}>🛺</span>,
  cab: <Car size={15} />,
  walk: <Footprints size={15} />,
};

const MODE_COLOR: Record<TransitMode, string> = {
  metro: "#3b82f6",
  bus: "#10b981",
  auto: "#f59e0b",
  cab: "#cbd5e1",
  walk: "#06b6d4",
};

export const ItineraryView: React.FC<ItineraryViewProps> = ({
  route,
  simulationStep,
  isSimulating,
  onStartSimulation,
  onResetSimulation,
}) => {
  const [expandedStops, setExpandedStops] = useState<Record<number, boolean>>({});

  const toggleStops = (idx: number) => {
    setExpandedStops((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        padding: "16px",
        background: "rgba(14, 21, 37, 0.95)",
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Simulation Controls Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "linear-gradient(135deg, rgba(37, 99, 235, 0.15), rgba(6, 182, 212, 0.15))",
          border: "1px solid rgba(59, 130, 246, 0.3)",
          borderRadius: "10px",
        }}
      >
        <div>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#60a5fa", display: "block" }}>
            Live Journey Navigation
          </span>
          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
            {isSimulating
              ? `Navigating leg ${simulationStep + 1} of ${route.legs.length}...`
              : "Step-by-step turn guidance"}
          </span>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          {!isSimulating ? (
            <button
              onClick={onStartSimulation}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "6px",
                background: "#2563eb",
                border: "none",
                color: "#ffffff",
                fontSize: "0.72rem",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 0 10px rgba(37, 99, 235, 0.5)",
              }}
            >
              <Play size={12} fill="#ffffff" />
              <span>Simulate Ride</span>
            </button>
          ) : (
            <button
              onClick={onResetSimulation}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "6px",
                background: "rgba(239, 68, 68, 0.2)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#f87171",
                fontSize: "0.72rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Environmental & Health Scorecard */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "8px",
          padding: "10px",
          background: "rgba(255, 255, 255, 0.03)",
          borderRadius: "10px",
          border: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", display: "block" }}>
            RELIABILITY
          </span>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#34d399" }}>
            {route.onTimeReliability}%
          </span>
        </div>
        <div style={{ textAlign: "center", borderLeft: "1px solid rgba(255,255,255,0.06)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", display: "block" }}>
            CO₂ EMISSIONS
          </span>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#4ade80" }}>
            {route.carbonEmissionsKg} kg approx.
          </span>
        </div>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", display: "block" }}>
            CALORIES
          </span>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fb923c" }}>
            {route.caloriesBurned} kcal
          </span>
        </div>
      </div>

      {/* Step-by-Step Vertical Timeline */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", position: "relative" }}>
        {route.legs.map((leg, idx) => {
          const isCurrentSimStep = isSimulating && simulationStep === idx;
          const isPassedSimStep = isSimulating && simulationStep > idx;
          const color = MODE_COLOR[leg.mode];
          const previousLeg = route.legs[idx - 1];
          const isMetroInterchange =
            idx > 0 &&
            previousLeg?.mode === "metro" &&
            leg.mode === "metro" &&
            previousLeg.lineName !== leg.lineName;

          return (
            <React.Fragment key={idx}>
              {isMetroInterchange && (
                <div
                  style={{
                    margin: "0 12px",
                    padding: "7px 10px",
                    borderRadius: "7px",
                    background: "rgba(245, 158, 11, 0.12)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    color: "#fbbf24",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}
                >
                  🔁 Interchange at {previousLeg.to}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  position: "relative",
                  padding: "12px",
                  borderRadius: "10px",
                  background: isCurrentSimStep
                    ? "rgba(59, 130, 246, 0.12)"
                    : "rgba(255, 255, 255, 0.02)",
                  border: isCurrentSimStep
                    ? "1px solid rgba(59, 130, 246, 0.4)"
                    : "1px solid rgba(255, 255, 255, 0.05)",
                  transition: "all 0.3s ease",
                }}
              >
              {/* Left Timeline Indicator */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: isPassedSimStep ? "#10b981" : color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    boxShadow: `0 0 10px ${color}88`,
                  }}
                >
                  {isPassedSimStep ? <CheckCircle2 size={16} /> : MODE_ICON[leg.mode]}
                </div>
                {idx < route.legs.length - 1 && (
                  <div
                    style={{
                      width: "2px",
                      flexGrow: 1,
                      marginTop: "6px",
                      background: `linear-gradient(to bottom, ${color}, rgba(255,255,255,0.1))`,
                      minHeight: "40px",
                    }}
                  />
                )}
              </div>

              {/* Right Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: color,
                      }}
                    >
                      {leg.mode}
                    </span>
                    {leg.lineName && (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: leg.lineColor ? `${leg.lineColor}33` : "rgba(59,130,246,0.2)",
                          color: leg.lineColor || "#60a5fa",
                          fontWeight: 600,
                        }}
                      >
                        {leg.lineName}
                      </span>
                    )}
                    {leg.routeNumber && (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: "rgba(16, 185, 129, 0.2)",
                          color: "#34d399",
                          fontWeight: 700,
                        }}
                      >
                        Route {leg.routeNumber}
                      </span>
                    )}
                  </div>

                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#ffffff" }}>
                    {leg.durationMinutes} min
                  </span>
                </div>

                {/* Instruction */}
                <p style={{ fontSize: "0.82rem", color: "#f8fafc", fontWeight: 500, marginBottom: "6px" }}>
                  {leg.instruction}
                </p>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#cbd5e1",
                    marginBottom: "6px",
                  }}
                >
                  <strong>{leg.from}</strong>
                  <span style={{ color: "#64748b", margin: "0 6px" }}>→</span>
                  <strong>{leg.to}</strong>
                </div>

                {/* Platform / Gate / Guidance info */}
                {leg.platform && (
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "#fbbf24",
                      background: "rgba(245, 158, 11, 0.1)",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      marginBottom: "6px",
                      display: "inline-block",
                    }}
                  >
                    🚉 {leg.platform}
                  </div>
                )}

                {/* Expandable intermediate stops */}
                {leg.intermediateStops && leg.intermediateStops.length > 0 && (
                  <div style={{ marginTop: "4px" }}>
                    <button
                      onClick={() => toggleStops(idx)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        background: "none",
                        border: "none",
                        color: "#60a5fa",
                        fontSize: "0.72rem",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      <span>
                        {leg.stopsCount || leg.intermediateStops.length} stops en route
                      </span>
                      {expandedStops[idx] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    {expandedStops[idx] && (
                      <div
                        style={{
                          marginTop: "6px",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          background: "rgba(0, 0, 0, 0.3)",
                          borderLeft: `2px solid ${color}`,
                          fontSize: "0.72rem",
                          color: "var(--text-secondary)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "3px",
                        }}
                      >
                        {leg.intermediateStops.map((stop, sIdx) => (
                          <div key={sIdx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: color }} />
                            <span>{stop}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Sub details: Distance & Fare */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginTop: "8px",
                    fontSize: "0.7rem",
                    color: "var(--text-muted)",
                  }}
                >
                  <span>Distance: {leg.distanceKm} km</span>
                  {leg.distanceSource && (
                    <>
                      <span>•</span>
                      <span>{leg.distanceSource === "road" ? "Road distance" : "Estimated"}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>Fare: {leg.fare > 0 ? `₹${leg.fare}` : "Free Walk"}</span>
                  {leg.provider && (
                    <>
                      <span>•</span>
                      <span>{leg.provider}</span>
                    </>
                  )}
                </div>
              </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
