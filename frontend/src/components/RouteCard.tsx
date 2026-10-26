"use client";

import React from "react";
import { Clock, IndianRupee, Navigation, Users, Leaf, ChevronRight, Zap, Star } from "lucide-react";
import { RouteOption, TransitMode } from "@/types/transit";

interface RouteCardProps {
  route: RouteOption;
  isSelected: boolean;
  onSelect: () => void;
}

const MODE_EMOJI: Record<TransitMode, string> = {
  metro: "🚇",
  bus: "🚌",
  auto: "🛺",
  bike: "🏍️",
  cab: "🚖",
  walk: "🚶",
};

const MODE_COLOR: Record<TransitMode, string> = {
  metro: "#3b82f6",
  bus: "#10b981",
  auto: "#f59e0b",
  bike: "#f97316",
  cab: "#a78bfa",
  walk: "#06b6d4",
};

const TAG_CONFIG: Record<string, { emoji: string; label: string }> = {
  FASTEST:       { emoji: "⚡", label: "Fastest" },
  CHEAPEST:      { emoji: "💰", label: "Cheapest" },
  RECOMMENDED:   { emoji: "⭐", label: "Recommended" },
  COMFORT:       { emoji: "🛋️", label: "Comfort" },
  TRAFFIC_BUSTER:{ emoji: "🚀", label: "Traffic Buster" },
  ECO:           { emoji: "🌿", label: "Eco-Friendly" },
};

const getCrowdConfig = (level: string) => {
  if (level === "high")   return { color: "#f43f5e", bg: "rgba(244,63,94,0.12)", fill: 90, label: "Crowded" };
  if (level === "medium") return { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", fill: 55, label: "Moderate" };
  return { color: "#10b981", bg: "rgba(16,185,129,0.12)", fill: 25, label: "Comfortable" };
};

export const RouteCard: React.FC<RouteCardProps> = ({ route, isSelected, onSelect }) => {
  const tagCfg = TAG_CONFIG[route.tag] || { emoji: "🔵", label: route.tag };
  const crowd = getCrowdConfig(route.crowdLevel);
  const tagClass = `tag-${route.tag.toLowerCase().replace("_", "-")}`;

  return (
    <div
      onClick={onSelect}
      className={`glass-card ${isSelected ? "active" : ""}`}
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
          {tagCfg.emoji} {tagCfg.label}
        </span>
        <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
          {route.delayMinutes > 0 ? (
            <span style={{ fontSize: "0.65rem", padding: "2px 7px", borderRadius: "999px", background: "rgba(244,63,94,0.15)", color: "#fb7185", fontWeight: 700, border: "1px solid rgba(244,63,94,0.3)" }}>
              +{route.delayMinutes}m delay
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

      {/* Route Title */}
      <h3 style={{ fontSize: "0.92rem", fontWeight: 700, color: "#f1f5f9", marginBottom: "10px", lineHeight: 1.3 }}>
        {route.title}
      </h3>

      {/* Mode chain with emoji badges */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap", marginBottom: "12px" }}>
        {route.legs.map((leg, i) => (
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
                {MODE_EMOJI[leg.mode]}
              </span>
              <span style={{ fontSize: "0.7rem" }}>
                {leg.lineName || (leg.routeNumber ? `B${leg.routeNumber}` : leg.mode.toUpperCase())} • {leg.durationMinutes}m
              </span>
            </span>
            {i < route.legs.length - 1 && (
              <ChevronRight size={11} color="#4b5a6e" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Crowd level bar */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <span style={{ fontSize: "0.6rem", color: "#4b5a6e", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "4px" }}>
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
          <span className="stat-value" style={{ color: "#60a5fa" }}>{route.totalDurationMinutes}m</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">💰 Fare</span>
          <span className="stat-value" style={{ color: "#34d399" }}>₹{route.totalFare}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label" style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            <Navigation size={9} /> Distance
          </span>
          <span className="stat-value">{route.totalDistanceKm}km</span>
        </div>
        <div className="stat-box">
          <span className="stat-label" style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            <Leaf size={9} /> CO₂
          </span>
          <span className="stat-value" style={{ color: "#4ade80" }}>{route.carbonEmissionsKg}kg</span>
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
    </div>
  );
};
