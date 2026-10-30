"use client";

import React, { useRef, useState } from "react";
import { Clock, Navigation, Users, Leaf, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { RouteOption, TransitMode } from "@/types/transit";
import { VehicleIllustration } from "@/components/VehicleIllustration";

interface RouteCardProps {
  route: RouteOption;
  isSelected: boolean;
  onSelect: () => void;
}

const MODE_COLOR: Record<TransitMode, string> = {
  metro: "#A7B58A",
  bus: "#C47A44",
  auto: "#D2A85A",
  cab: "#B8ADA0",
  walk: "#829A86",
};

const TAG_CONFIG: Record<string, { label: string }> = {
  FASTEST: { label: "Fastest" },
  CHEAPEST: { label: "Cheapest" },
  RECOMMENDED: { label: "Recommended" },
  COMFORT: { label: "Comfort" },
  TRAFFIC_BUSTER: { label: "Traffic Buster" },
  ECO: { label: "Eco-Friendly" },
};

const getCrowdConfig = (level: string) => {
  if (level === "high")   return { color: "#f43f5e", bg: "rgba(244,63,94,0.12)", fill: 90, label: "Crowded" };
  if (level === "medium") return { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", fill: 55, label: "Moderate" };
  return { color: "#10b981", bg: "rgba(16,185,129,0.12)", fill: 25, label: "Comfortable" };
};

const formatMode = (mode: TransitMode) => mode.charAt(0).toUpperCase() + mode.slice(1);

export const RouteCard: React.FC<RouteCardProps> = ({ route, isSelected, onSelect }) => {
  const [expandedLegs, setExpandedLegs] = useState<Record<number, boolean>>({});
  const tiltRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const tagCfg = TAG_CONFIG[route.tag] || { label: route.tag };
  const crowd = getCrowdConfig(route.crowdLevel);
  const tagClass = `tag-${route.tag.toLowerCase().replace("_", "-")}`;

  const resetTilt = () => {
    const tilt = tiltRef.current;
    const card = cardRef.current;
    if (!tilt || !card) return;
    tilt.classList.remove("is-hover");
    card.classList.remove("is-tilting");
    card.style.setProperty("--tilt-rx", "0deg");
    card.style.setProperty("--tilt-ry", "0deg");
  };

  const trackTilt = (event: React.PointerEvent<HTMLDivElement>) => {
    const tilt = tiltRef.current;
    const card = cardRef.current;
    if (!tilt || !card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = tilt.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const py = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
    const maxTilt = 8;
    tilt.classList.add("is-hover");
    card.classList.add("is-tilting");
    card.style.setProperty("--tilt-ry", `${((px - 0.5) * maxTilt).toFixed(2)}deg`);
    card.style.setProperty("--tilt-rx", `${((0.5 - py) * maxTilt).toFixed(2)}deg`);
    card.style.setProperty("--tilt-gx", `${(px * 100).toFixed(1)}%`);
    card.style.setProperty("--tilt-gy", `${(py * 100).toFixed(1)}%`);
  };

  return (
    <div
      ref={tiltRef}
      className="t-tilt"
      onPointerMove={trackTilt}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") resetTilt();
      }}
      onPointerUp={resetTilt}
      onPointerDown={(event) => {
        if (event.pointerType !== "mouse") {
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Pointer capture is not available in every embedded browser.
          }
        }
      }}
    >
      <div
        ref={cardRef}
        onClick={onSelect}
        className={`t-tilt-card glass-card ${isSelected ? "active" : ""}`}
        style={{ padding: "16px", cursor: "pointer", position: "relative", overflow: "hidden" }}
      >
        {/* Selected glow accent line */}
        {isSelected && (
          <div style={{
            position: "absolute", top: 0, left: 0, bottom: 0, width: "3px",
            background: "linear-gradient(180deg, #06b6d4, #3b82f6)",
            borderRadius: "0 0 0 0",
          }} />
        )}

      {/* Top Row: Tag + Status Chips */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <span className={`badge-tag ${tagClass}`}>
          {tagCfg.label}
        </span>
        <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
          {route.delayMinutes > 0 ? (
            <span style={{ fontSize: "0.65rem", padding: "2px 7px", borderRadius: "999px", background: "rgba(244,63,94,0.15)", color: "#fb7185", fontWeight: 700, border: "1px solid rgba(244,63,94,0.3)" }}>
              +{route.delayMinutes} min delay
            </span>
          ) : (
            <span style={{ fontSize: "0.65rem", padding: "2px 7px", borderRadius: "999px", background: "rgba(16,185,129,0.15)", color: "#34d399", fontWeight: 700, border: "1px solid rgba(16,185,129,0.3)" }}>
              ✓ On Time
            </span>
          )}
          <span style={{
            fontSize: "0.65rem", padding: "2px 7px", borderRadius: "999px",
            background: crowd.bg, color: crowd.color,
            fontWeight: 700, border: `1px solid ${crowd.color}44`,
          }}>
            {crowd.label}
          </span>
        </div>
      </div>

      {/* Recommendation Reason & Constraint Status */}
        {route.recommendationReason && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "6px",
              padding: "7px 10px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(37, 99, 235, 0.08))",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              marginBottom: "8px",
              fontSize: "0.72rem",
              color: "#93c5fd",
              lineHeight: 1.4,
            }}
          >
            <span style={{ fontSize: "12px", flexShrink: 0 }}>💡</span>
            <div>
              <strong style={{ color: "#38bdf8", display: "block", marginBottom: "1px", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Why Recommended
              </strong>
              <span>{route.recommendationReason}</span>
            </div>
          </div>
        )}

        {route.constraintsEvaluation &&
          (route.constraintsEvaluation.budgetSatisfied !== null ||
            route.constraintsEvaluation.walkingSatisfied !== null ||
            route.constraintsEvaluation.transfersSatisfied !== null ||
            route.constraintsEvaluation.deadlineSatisfied !== null ||
            !route.constraintsEvaluation.satisfiesAll) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 8px",
              borderRadius: "6px",
              marginBottom: "8px",
              fontSize: "0.68rem",
              fontWeight: 600,
              background: route.constraintsEvaluation.satisfiesAll ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
              border: route.constraintsEvaluation.satisfiesAll ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
              color: route.constraintsEvaluation.satisfiesAll ? "#34d399" : "#fbbf24",
            }}
          >
            <span>{route.constraintsEvaluation.satisfiesAll ? "✓ All Constraints Met" : `⚠️ Closest Alternative: ${route.constraintsEvaluation.violations.join(", ")}`}</span>
          </div>
        )}

        {route.reliabilityDetails && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "6px",
              marginBottom: "8px",
              padding: "6px 8px",
              borderRadius: "6px",
              background: "rgba(255, 255, 255, 0.025)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              fontSize: "0.66rem",
            }}
          >
            <span style={{
              fontWeight: 700,
              color: route.reliabilityDetails.reliabilityBand === "High" ? "#34d399" : route.reliabilityDetails.reliabilityBand === "Moderate" ? "#38bdf8" : "#fb7185"
            }}>
              ● {route.reliabilityDetails.reliabilityBand} ({route.reliabilityDetails.reliabilityPercentage}%)
            </span>
            {route.reliabilityDetails.potentialDelayImpactMinutes > 0 && (
              <>
                <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>•</span>
                <span style={{ color: "#fb7185", fontWeight: 600 }}>
                  +{route.reliabilityDetails.potentialDelayImpactMinutes} min delay risk
                </span>
              </>
            )}
            {route.reliabilityDetails.isSimulated && (
              <span style={{
                marginLeft: "auto",
                fontSize: "0.58rem",
                padding: "1px 5px",
                borderRadius: "4px",
                background: "rgba(245, 158, 11, 0.15)",
                color: "#fbbf24",
                border: "1px solid rgba(245, 158, 11, 0.3)"
              }}>
                Simulated
              </span>
            )}
          </div>
        )}

        {/* Route Title */}
      <h3 style={{ fontSize: "0.92rem", fontWeight: 700, color: "#f1f5f9", marginBottom: "10px", lineHeight: 1.3 }}>
        {route.title}
      </h3>

      {/* Mode chain with emoji badges */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap", marginBottom: "12px" }}>
        {(() => {
          // Omit minor transfer walks (<= 3 min) between transit legs to avoid duplicate walk badges
          const badgeLegs = route.legs.filter(
            (leg, i) =>
              !(
                i > 0 &&
                i < route.legs.length - 1 &&
                leg.mode === "walk" &&
                leg.durationMinutes <= 3
              )
          );
          return badgeLegs.map((leg, i) => (
            <React.Fragment key={i}>
              <span
                className={`mode-badge mode-${leg.mode}`}
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <span style={{
                  width: "18px", height: "18px", borderRadius: "5px",
                  background: `${MODE_COLOR[leg.mode]}22`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "10px",
                }}>
                  <VehicleIllustration mode={leg.mode} size="xs" />
                </span>
                <span style={{ fontSize: "0.7rem" }}>
                  {leg.lineName || (leg.routeNumber ? `B${leg.routeNumber}` : formatMode(leg.mode))} · {leg.durationMinutes} min
                </span>
              </span>
              {i < badgeLegs.length - 1 && (
                <ChevronRight size={11} color="#4b5a6e" />
              )}
            </React.Fragment>
          ));
        })()}
      </div>

      {/* Stop-to-stop journey and interchange details */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          marginBottom: "12px",
          padding: "8px 10px",
          borderRadius: "8px",
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {route.legs.map((leg, i) => {
          const previousLeg = route.legs[i - 1];
          const interchange =
            i > 0 &&
            previousLeg?.mode === "metro" &&
            leg.mode === "metro" &&
            previousLeg.lineName !== leg.lineName;

          return (
            <React.Fragment key={`detail-${i}`}>
              {interchange && (
                <span style={{ fontSize: "0.66rem", color: "#fbbf24", fontWeight: 700 }}>
                  🔁 Interchange at {previousLeg.to}
                </span>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.7rem" }}>
                <span style={{ color: MODE_COLOR[leg.mode], fontWeight: 700 }}>
                  {formatMode(leg.mode)}
                </span>
                <span style={{ color: "#cbd5e1" }}>{leg.from}</span>
                <ChevronRight size={10} color="#64748b" />
                <span style={{ color: "#cbd5e1" }}>{leg.to}</span>
              </div>
              {leg.mode === "bus" && leg.scheduledTiming && (
                <div
                  style={{
                    marginTop: "6px",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    background: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                    color: "#a7f3d0",
                    fontSize: "0.66rem",
                  }}
                >
                  <strong>Scheduled bus:</strong> Departs {leg.scheduledTiming.departureTime}
                  {" → "}arrives {leg.scheduledTiming.arrivalTime}
                  <span style={{ display: "block", color: "#718078", marginTop: "2px" }}>
                    {leg.scheduledTiming.note}
                  </span>
                </div>
              )}
              {(leg.mode === "bus" || leg.mode === "metro") &&
                leg.intermediateStops &&
                leg.intermediateStops.length > 0 && (
                  <div style={{ marginTop: "7px" }}>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setExpandedLegs((current) => ({
                          ...current,
                          [i]: !current[i],
                        }));
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "3px 0",
                        border: 0,
                        color: MODE_COLOR[leg.mode],
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: "0.66rem",
                        fontWeight: 700,
                      }}
                    >
                      {expandedLegs[i] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      {leg.intermediateStops.length} stops · view route
                    </button>
                    {expandedLegs[i] && (
                      <div
                        onClick={(event) => event.stopPropagation()}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "5px",
                          marginTop: "4px",
                          padding: "8px 10px",
                          borderLeft: `2px solid ${MODE_COLOR[leg.mode]}`,
                          borderRadius: "0 7px 7px 0",
                          background: "rgba(255,255,255,0.035)",
                        }}
                      >
                        {[leg.from, ...leg.intermediateStops, leg.to].map((stop, stopIndex, stops) => {
                          const estimatedMinutes = Math.round(
                            (leg.durationMinutes * stopIndex) / Math.max(stops.length - 1, 1)
                          );
                          return (
                            <div
                              key={`${i}-${stopIndex}-${stop}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "10px",
                                color: stopIndex === 0 || stopIndex === stops.length - 1 ? "#f1f5f9" : "#aebbb2",
                                fontSize: "0.68rem",
                              }}
                            >
                              <span style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                                <span
                                  style={{
                                    width: stopIndex === 0 || stopIndex === stops.length - 1 ? "7px" : "5px",
                                    height: stopIndex === 0 || stopIndex === stops.length - 1 ? "7px" : "5px",
                                    borderRadius: "50%",
                                    background: MODE_COLOR[leg.mode],
                                    flexShrink: 0,
                                  }}
                                />
                                {stop}
                              </span>
                              <span style={{ color: "#718078", whiteSpace: "nowrap" }}>
                                {estimatedMinutes} min
                              </span>
                            </div>
                          );
                        })}
                        <span style={{ marginTop: "2px", color: "#718078", fontSize: "0.58rem" }}>
                          Stop times are estimated from the route duration.
                        </span>
                      </div>
                    )}
                  </div>
                )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Crowd level bar */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <span style={{ fontSize: "0.6rem", color: "#4b5a6e", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
            <Users size={10} /> Crowd Level
          </span>
          <span style={{ fontSize: "0.6rem", color: crowd.color, fontWeight: 700 }}>{crowd.fill}%</span>
        </div>
        <div className="crowd-bar">
          <div className="crowd-fill" style={{ width: `${crowd.fill}%`, background: `linear-gradient(90deg, ${crowd.color}88, ${crowd.color})` }} />
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px",
        paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div className="stat-box">
          <span className="stat-label" style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            <Clock size={9} /> Duration
          </span>
          <span className="stat-value" style={{ color: "#60a5fa" }}>{route.totalDurationMinutes} min</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">💰 Fare</span>
          <span className="stat-value" style={{ color: "#34d399" }}>
            {route.totalFare === null ? "Unavailable" : `₹${route.totalFare}`}
          </span>
        </div>
        <div className="stat-box">
          <span className="stat-label" style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            <Navigation size={9} /> Distance
          </span>
          <span className="stat-value">
            {route.totalDistanceKm}km
            {route.distanceSource && (
              <small style={{ display: "block", fontSize: "0.55rem", color: "#64748b" }}>
                {route.distanceSource === "road" ? "road" : "estimated"}
              </small>
            )}
          </span>
        </div>
        <div className="stat-box">
          <span className="stat-label" style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            <Leaf size={9} /> CO₂
          </span>
          <span className="stat-value" style={{ color: "#4ade80" }}>
            {route.carbonEmissionsKg}kg
            <small style={{ display: "block", fontSize: "0.55rem", color: "#64748b" }}>approx.</small>
          </span>
        </div>
      </div>

      {/* Reliability score */}
      <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
        <div style={{ flex: 1, height: "2px", borderRadius: "1px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${route.onTimeReliability}%`, background: "linear-gradient(90deg, #3b82f6, #06b6d4)", borderRadius: "1px" }} />
        </div>
        <span style={{ fontSize: "0.6rem", color: "#4b5a6e", fontWeight: 600, whiteSpace: "nowrap" }}>
          {route.onTimeReliability}% reliable
        </span>
      </div>
        <div className="t-tilt-glare" aria-hidden="true" />
      </div>
    </div>
  );
};
