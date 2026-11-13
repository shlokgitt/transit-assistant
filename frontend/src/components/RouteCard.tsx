"use client";

import React, { useRef } from "react";
import { Clock, Navigation, Users, Leaf, ChevronRight, ExternalLink } from "lucide-react";
import { RouteOption, TransitMode } from "@/types/transit";
import { VehicleIllustration } from "@/components/VehicleIllustration";

interface RouteCardProps {
  route: RouteOption;
  isSelected: boolean;
  onSelect: () => void;
}

const MODE_COLOR: Record<TransitMode, string> = {
  metro: "#A7B58A",
  train: "#38BDF8",
  bus: "#C47A44",
  auto: "#D2A85A",
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
  const tiltRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const tagCfg = TAG_CONFIG[route.tag] || { label: route.tag };
  const crowd = getCrowdConfig(route.crowdLevel);
  const tagClass = `tag-${route.tag.toLowerCase().replace("_", "-")}`;

  const openFullRoute = (legIndex: number) => {
    try {
      window.localStorage.setItem(`transit-route:${route.id}`, JSON.stringify(route));
      window.open(`/route-details?routeId=${encodeURIComponent(route.id)}&leg=${legIndex}`, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Unable to open route details:", error);
    }
  };

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
        {/* Selected route marker */}
        {isSelected && (
          <div style={{
            position: "absolute", top: 0, left: 0, bottom: 0, width: "1px",
            background: "#38bdf8",
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
              background: "rgba(56, 189, 248, 0.1)",
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
                {route.tag === "RECOMMENDED" ? "Why Recommended" : "Live Transit Insights"}
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

        {/* Route Title */}
        <h3 style={{ fontSize: "0.92rem", fontWeight: 700, color: "#f1f5f9", marginBottom: "10px", lineHeight: 1.3 }}>
          {route.title}
        </h3>

        {/* Mode chain with emoji badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap", marginBottom: "12px" }}>
          {(() => {
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

        {/* Four-stop preview with full route details on a dedicated page */}
        <div className="route-preview-panel">
          {route.legs.map((leg, i) => {
            const previousLeg = route.legs[i - 1];
            const interchange =
              i > 0 &&
              previousLeg?.mode === "metro" &&
              leg.mode === "metro" &&
              previousLeg.lineName !== leg.lineName;
            const allStops = [leg.from, ...(leg.intermediateStops || []), leg.to];
            const previewStops = allStops.length > 4
              ? [allStops[0], allStops[1], allStops[2], allStops[allStops.length - 1]]
              : allStops;
            const hiddenStopCount = Math.max(0, allStops.length - previewStops.length);

            return (
              <div key={`detail-${i}`} className="route-leg-preview">
                {interchange && (
                  <div className="route-interchange">
                    <span aria-hidden="true">↔</span>
                    <span>
                      <strong>Interchange at {previousLeg.to}</strong>
                      <small>
                        Arrive: {previousLeg.platform || "Platform information unavailable"} · Continue: {leg.platform || "check station signage"}
                      </small>
                    </span>
                  </div>
                )}
                <div className="route-leg-heading">
                  <span style={{ color: MODE_COLOR[leg.mode], fontWeight: 700 }}>
                    {leg.mode === "auto" ? (leg.lineName || "Auto") : formatMode(leg.mode)}
                  </span>
                  <span className="route-leg-endpoints">
                    {leg.from} <ChevronRight size={11} /> {leg.to}
                  </span>
                  {leg.fare !== undefined && leg.fare !== null && leg.fare > 0 && (
                    <span className="route-leg-fare">₹{leg.fare}</span>
                  )}
                </div>
                <div className="route-stop-preview" aria-label={`${formatMode(leg.mode)} stop preview`}>
                  {previewStops.map((stop, stopIndex) => (
                    <React.Fragment key={`${i}-${stopIndex}-${stop}`}>
                      <span className={`route-stop-chip ${stopIndex === 0 || stopIndex === previewStops.length - 1 ? "is-endpoint" : ""}`}>
                        <span className="route-stop-dot" style={{ background: MODE_COLOR[leg.mode] }} />
                        {stop}
                      </span>
                      {stopIndex < previewStops.length - 1 && <ChevronRight size={11} className="route-stop-arrow" />}
                    </React.Fragment>
                  ))}
                </div>
                <div className="route-leg-actions">
                  <span className="route-stop-count">
                    {allStops.length} stops · {leg.durationMinutes} min
                    {hiddenStopCount > 0 ? ` · ${hiddenStopCount} more in full route` : ""}
                  </span>
                  <button
                    type="button"
                    className="route-expand-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openFullRoute(i);
                    }}
                  >
                    <ExternalLink size={13} />
                    View full {formatMode(leg.mode)} route
                  </button>
                </div>
                {leg.scheduledTiming && (
                  <div className="route-timing-preview">
                    <strong>{leg.mode === "bus" ? "Scheduled timing" : "Live schedule"}</strong>
                    <span>
                      Departs {leg.scheduledTiming.departureTime} · Arrives {leg.scheduledTiming.arrivalTime}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Crowd level bar */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ fontSize: "0.68rem", color: "#72808f", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
              <Users size={10} /> Crowd Level: <span style={{ color: crowd.color, marginLeft: "4px" }}>{crowd.label}</span>
            </span>
          </div>
          <div className="crowd-bar">
            <div className="crowd-fill" style={{ width: `${crowd.fill}%`, background: crowd.color }} />
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
            <span className="stat-value" style={{ color: "#60a5fa", fontSize: "1.05rem" }}>{route.totalDurationMinutes} min</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">💰 Fare</span>
            <span className="stat-value" style={{ color: "#34d399", fontSize: "1.05rem" }}>
              {route.totalFare === null || route.summaryModes.every((m) => m === "auto") ? "Unavailable" : `₹${route.totalFare}`}
              {(() => {
                const fareLegs = route.legs.filter((l) => l.fare && l.fare > 0);
                if (fareLegs.length > 1) {
                  return (
                    <small style={{ display: "block", fontSize: "0.55rem", color: "#94a3b8", fontWeight: 500 }}>
                      {fareLegs.map((l) => `₹${l.fare} ${l.lineName?.includes("Aqua") ? "NMRC" : l.mode === "bus" ? "DTC" : "DMRC"}`).join(" + ")}
                    </small>
                  );
                }
                return null;
              })()}
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label" style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              <Navigation size={9} /> Distance
            </span>
            <span className="stat-value" style={{ fontSize: "1.05rem" }}>
              {route.totalDistanceKm}km
              {route.distanceSource && (
                <small style={{ display: "block", fontSize: "0.55rem", color: route.distanceSource === "road" ? "#38bdf8" : "#64748b", fontWeight: route.distanceSource === "road" ? 600 : 400 }}>
                  {route.distanceSource === "road" ? "by road" : "estimated"}
                </small>
              )}
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label" style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              <Leaf size={9} /> CO₂
            </span>
            <span className="stat-value" style={{ color: "#4ade80", fontSize: "1.05rem" }}>
              {route.carbonEmissionsKg !== undefined && route.carbonEmissionsKg !== null ? `${route.carbonEmissionsKg}kg` : "0.6kg"}
              <small style={{ display: "block", fontSize: "0.55rem", color: "#64748b" }}>approx.</small>
            </span>
          </div>
        </div>

        <div className="t-tilt-glare" aria-hidden="true" />
      </div>
    </div>
  );
};
