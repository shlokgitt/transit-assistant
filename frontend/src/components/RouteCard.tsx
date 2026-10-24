"use client";

import React from "react";
import {
  Clock,
  IndianRupee,
  Navigation,
  Train,
  Bus,
  Car,
  Bike,
  Footprints,
  ShieldAlert,
  Leaf,
  ChevronRight,
  Flame,
} from "lucide-react";
import { RouteOption, TransitMode } from "@/types/transit";

interface RouteCardProps {
  route: RouteOption;
  isSelected: boolean;
  onSelect: () => void;
}

const MODE_ICON: Record<TransitMode, React.ReactNode> = {
  metro: <Train size={13} />,
  bus: <Bus size={13} />,
  auto: <span style={{ fontSize: "11px" }}>🛺</span>,
  bike: <Bike size={13} />,
  cab: <Car size={13} />,
  walk: <Footprints size={13} />,
};

export const RouteCard: React.FC<RouteCardProps> = ({
  route,
  isSelected,
  onSelect,
}) => {
  const getTagClass = () => {
    switch (route.tag) {
      case "FASTEST":
        return "tag-fastest";
      case "CHEAPEST":
        return "tag-cheapest";
      case "RECOMMENDED":
        return "tag-recommended";
      case "COMFORT":
        return "tag-comfort";
      case "TRAFFIC_BUSTER":
        return "tag-traffic-buster";
      case "ECO":
        return "tag-eco";
      default:
        return "tag-fastest";
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`glass-card ${isSelected ? "active" : ""}`}
      style={{
        padding: "14px",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top Bar: Title & Tag Badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <span className={`badge-tag ${getTagClass()}`}>
          {route.tag.replace("_", " ")}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {route.delayMinutes > 0 ? (
            <span
              style={{
                fontSize: "0.68rem",
                padding: "2px 6px",
                borderRadius: "4px",
                background: "rgba(244, 63, 94, 0.15)",
                color: "#fb7185",
                fontWeight: 600,
              }}
            >
              +{route.delayMinutes}m delay
            </span>
          ) : (
            <span
              style={{
                fontSize: "0.68rem",
                padding: "2px 6px",
                borderRadius: "4px",
                background: "rgba(16, 185, 129, 0.15)",
                color: "#34d399",
                fontWeight: 600,
              }}
            >
              On Time
            </span>
          )}

          {/* Crowd indicator */}
          <span
            style={{
              fontSize: "0.68rem",
              padding: "2px 6px",
              borderRadius: "4px",
              background:
                route.crowdLevel === "high"
                  ? "rgba(244, 63, 94, 0.15)"
                  : route.crowdLevel === "medium"
                  ? "rgba(245, 158, 11, 0.15)"
                  : "rgba(16, 185, 129, 0.15)",
              color:
                route.crowdLevel === "high"
                  ? "#fb7185"
                  : route.crowdLevel === "medium"
                  ? "#fbbf24"
                  : "#34d399",
              fontWeight: 600,
              textTransform: "capitalize",
            }}
          >
            {route.crowdLevel} crowd
          </span>
        </div>
      </div>

      {/* Route Title */}
      <h3
        style={{
          fontSize: "0.95rem",
          fontWeight: 700,
          color: "#f8fafc",
          marginBottom: "6px",
        }}
      >
        {route.title}
      </h3>

      {/* Mode Chain Journey Pills */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          flexWrap: "wrap",
          marginBottom: "12px",
        }}
      >
        {route.legs.map((leg, i) => (
          <React.Fragment key={i}>
            <span className={`mode-badge mode-${leg.mode}`}>
              {MODE_ICON[leg.mode]}
              <span>
                {leg.lineName
                  ? leg.lineName
                  : leg.routeNumber
                  ? `Bus ${leg.routeNumber}`
                  : leg.mode.toUpperCase()}{" "}
                ({leg.durationMinutes}m)
              </span>
            </span>
            {i < route.legs.length - 1 && (
              <span style={{ color: "var(--text-muted)", fontSize: "0.65rem" }}>➔</span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "8px",
          paddingTop: "8px",
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <div>
          <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", display: "block" }}>
            DURATION
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "3px", marginTop: "1px" }}>
            <Clock size={12} color="#60a5fa" />
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffffff" }}>
              {route.totalDurationMinutes} min
            </span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", display: "block" }}>
            EST. FARE
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "2px", marginTop: "1px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#34d399" }}>
              ₹{route.totalFare}
            </span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", display: "block" }}>
            DISTANCE
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "3px", marginTop: "1px" }}>
            <Navigation size={12} color="#94a3b8" />
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#e2e8f0" }}>
              {route.totalDistanceKm} km
            </span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", display: "block" }}>
            TRANSFERS
          </span>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#e2e8f0" }}>
            {route.transfersCount === 0 ? "Direct" : `${route.transfersCount} change`}
          </span>
        </div>
      </div>
    </div>
  );
};
