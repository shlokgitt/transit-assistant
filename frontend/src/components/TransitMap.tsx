"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  RouteOption,
  RouteLeg,
  TransitMode,
  CityConfig,
} from "@/types/transit";
import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Navigation2,
  Layers,
  Sparkles,
  Train,
  Bus,
  Car,
  Bike,
  Footprints,
  Volume2,
} from "lucide-react";

interface TransitMapProps {
  city: CityConfig;
  route: RouteOption | null;
  selectedLegIndex: number | null;
  simulationStep: number;
  isSimulating: boolean;
}

const MODE_STROKE: Record<TransitMode, { stroke: string; glow: string; width: number; dash?: string }> = {
  metro: { stroke: "#38bdf8", glow: "rgba(56, 189, 248, 0.6)", width: 5 },
  bus: { stroke: "#34d399", glow: "rgba(52, 211, 153, 0.6)", width: 4.5, dash: "6 3" },
  auto: { stroke: "#fbbf24", glow: "rgba(251, 191, 36, 0.6)", width: 4 },
  bike: { stroke: "#fb923c", glow: "rgba(251, 146, 60, 0.6)", width: 3.5 },
  cab: { stroke: "#e2e8f0", glow: "rgba(226, 232, 240, 0.5)", width: 4.5 },
  walk: { stroke: "#22d3ee", glow: "rgba(34, 211, 238, 0.6)", width: 3, dash: "3 3" },
};

export const TransitMap: React.FC<TransitMapProps> = ({
  city,
  route,
  selectedLegIndex,
  simulationStep,
  isSimulating,
}) => {
  const [zoom, setZoom] = useState(1);
  const [mapStyle, setMapStyle] = useState<"dark" | "transit">("dark");
  const [vehiclePos, setVehiclePos] = useState<{ x: number; y: number } | null>(null);

  // Extract all coordinates from current route
  const allCoords = route
    ? route.legs.flatMap((l) => l.coordinates)
    : [
        [city.center.lat - 0.02, city.center.lng - 0.02],
        [city.center.lat + 0.02, city.center.lng + 0.02],
      ];

  const lats = allCoords.map((c) => c[0]);
  const lngs = allCoords.map((c) => c[1]);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Map projection to SVG canvas (viewBox 0 0 1000 800)
  const padding = 120;
  const project = (lat: number, lng: number) => {
    const latSpan = maxLat - minLat || 0.01;
    const lngSpan = maxLng - minLng || 0.01;
    const x = padding + ((lng - minLng) / lngSpan) * (1000 - padding * 2);
    // Invert Y so North is up
    const y = 800 - (padding + ((lat - minLat) / latSpan) * (800 - padding * 2));
    return { x: +x.toFixed(1), y: +y.toFixed(1) };
  };

  // Simulation vehicle animation along the active leg
  useEffect(() => {
    if (!isSimulating || !route || !route.legs[simulationStep]) {
      setVehiclePos(null);
      return;
    }
    const leg = route.legs[simulationStep];
    const coords = leg.coordinates;
    if (coords.length < 2) return;

    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.03;
      if (progress > 1) progress = 0;
      const index = Math.min(Math.floor(progress * (coords.length - 1)), coords.length - 2);
      const subT = (progress * (coords.length - 1)) - index;
      const c1 = coords[index];
      const c2 = coords[index + 1];
      const curLat = c1[0] + (c2[0] - c1[0]) * subT;
      const curLng = c1[1] + (c2[1] - c1[1]) * subT;
      setVehiclePos(project(curLat, curLng));
    }, 50);

    return () => clearInterval(interval);
  }, [isSimulating, simulationStep, route]);

  return (
    <div
      className="map-canvas-container"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "450px",
        overflow: "hidden",
        background:
          mapStyle === "dark"
            ? "radial-gradient(ellipse at center, #0f1c3f 0%, #060913 100%)"
            : "radial-gradient(ellipse at center, #111e38 0%, #080d1a 100%)",
      }}
    >
      {/* High-tech Background Grid */}
      <div className="map-grid-overlay" />

      {/* SVG Vector Map Rendering */}
      <svg
        viewBox="0 0 1000 800"
        style={{
          width: "100%",
          height: "100%",
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
          transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <defs>
          {/* Glowing Filters */}
          <filter id="glow-metro" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#38bdf8" floodOpacity="0.8" />
          </filter>
          <filter id="glow-bus" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#34d399" floodOpacity="0.8" />
          </filter>
          <filter id="glow-auto" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#fbbf24" floodOpacity="0.8" />
          </filter>
          <filter id="glow-bike" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#fb923c" floodOpacity="0.8" />
          </filter>
          <radialGradient id="originPulse">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="destPulse">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient City Landmark Network rings */}
        <circle cx="500" cy="400" r="340" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
        <circle cx="500" cy="400" r="220" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" strokeDasharray="6 4" />
        <circle cx="500" cy="400" r="120" fill="none" stroke="rgba(59, 130, 246, 0.08)" strokeWidth="1" />

        {/* Route Paths */}
        {route &&
          route.legs.map((leg, lIdx) => {
            const isLegActive = selectedLegIndex === null || selectedLegIndex === lIdx;
            const isSimActive = isSimulating && simulationStep === lIdx;
            const style = MODE_STROKE[leg.mode];

            const points = leg.coordinates.map((c) => project(c[0], c[1]));
            if (points.length < 2) return null;

            const pathD = points.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), "");

            return (
              <g key={lIdx} opacity={isLegActive ? 1 : 0.25} style={{ transition: "opacity 0.2s ease" }}>
                {/* Glow backdrop path */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={style.glow}
                  strokeWidth={style.width + 8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Core path line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth={style.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={style.dash}
                  filter={leg.mode === "metro" ? "url(#glow-metro)" : undefined}
                />

                {/* Intermediate Stop Dots */}
                {points.slice(1, -1).map((pt, pIdx) => (
                  <circle
                    key={pIdx}
                    cx={pt.x}
                    cy={pt.y}
                    r={3.5}
                    fill="#0f172a"
                    stroke={style.stroke}
                    strokeWidth={2}
                  />
                ))}
              </g>
            );
          })}

        {/* Origin Marker */}
        {route && route.legs.length > 0 && (() => {
          const first = project(route.legs[0].coordinates[0][0], route.legs[0].coordinates[0][1]);
          return (
            <g transform={`translate(${first.x}, ${first.y})`}>
              <circle r="22" fill="url(#originPulse)" className="animate-pulse-glow" />
              <circle r="9" fill="#10b981" stroke="#ffffff" strokeWidth="2.5" />
              <text
                x="14"
                y="5"
                fill="#ffffff"
                fontSize="12"
                fontWeight="700"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))"
              >
                {route.legs[0]?.from || "Start"} (Start)
              </text>
            </g>
          );
        })()}

        {/* Destination Marker */}
        {route && route.legs.length > 0 && (() => {
          const lastLeg = route.legs[route.legs.length - 1];
          const last = project(
            lastLeg.coordinates[lastLeg.coordinates.length - 1][0],
            lastLeg.coordinates[lastLeg.coordinates.length - 1][1]
          );
          return (
            <g transform={`translate(${last.x}, ${last.y})`}>
              <circle r="22" fill="url(#destPulse)" className="animate-pulse-glow" />
              <circle r="9" fill="#f43f5e" stroke="#ffffff" strokeWidth="2.5" />
              <text
                x="14"
                y="5"
                fill="#ffffff"
                fontSize="12"
                fontWeight="700"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))"
              >
                {lastLeg?.to || "Destination"} (Goal)
              </text>
            </g>
          );
        })()}

        {/* Live Simulation Moving Vehicle */}
        {isSimulating && vehiclePos && (
          <g transform={`translate(${vehiclePos.x}, ${vehiclePos.y})`}>
            {/* Vehicle Beacon Rings */}
            <circle r="18" fill="rgba(56, 189, 248, 0.4)" className="animate-pulse-glow" />
            <circle r="8" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
            {/* Headlight cone */}
            <polygon points="-8,-4 0,-18 8,-4" fill="rgba(255, 255, 255, 0.3)" />
          </g>
        )}
      </svg>

      {/* Floating Map HUD Top: Current Selected Route Overview */}
      {route && (
        <div
          style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            background: "rgba(10, 15, 29, 0.85)",
            backdropFilter: "blur(16px)",
            border: "1px solid var(--border-glass)",
            borderRadius: "12px",
            padding: "10px 14px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            zIndex: 10,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className={`badge-tag tag-${route.tag.toLowerCase().replace('_', '-')}`} style={{ fontSize: "0.65rem", padding: "2px 8px" }}>
                {route.tag}
              </span>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffffff" }}>
                {route.title}
              </span>
            </div>
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
              {(route.legs[0]?.from || "Start")} ➔ {(route.legs[route.legs.length - 1]?.to || "Destination")} ({route.totalDistanceKm} km)
            </p>
          </div>

          <div style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: "12px" }}>
            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>
              TOTAL TIME
            </span>
            <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#38bdf8" }}>
              {route.totalDurationMinutes} min
            </span>
          </div>

          <div style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: "12px" }}>
            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>
              FARE
            </span>
            <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#34d399" }}>
              ₹{route.totalFare}
            </span>
          </div>
        </div>
      )}

      {/* Floating Simulation Status Banner */}
      {isSimulating && route && route.legs[simulationStep] && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(15, 23, 42, 0.95)",
            border: "1px solid rgba(56, 189, 248, 0.5)",
            boxShadow: "0 0 25px rgba(56, 189, 248, 0.3)",
            borderRadius: "30px",
            padding: "8px 20px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            zIndex: 20,
          }}
        >
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "#38bdf8",
              boxShadow: "0 0 10px #38bdf8",
            }}
            className="animate-pulse-glow"
          />
          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#ffffff" }}>
            Currently in transit: {route.legs[simulationStep].instruction}
          </span>
          <span
            style={{
              fontSize: "0.72rem",
              padding: "2px 8px",
              borderRadius: "12px",
              background: "rgba(56, 189, 248, 0.2)",
              color: "#38bdf8",
              fontWeight: 600,
            }}
          >
            Step {simulationStep + 1} / {route.legs.length}
          </span>
        </div>
      )}

      {/* Map Legend (Bottom Left) */}
      <div
        style={{
          position: "absolute",
          bottom: "16px",
          left: "16px",
          background: "rgba(10, 15, 29, 0.8)",
          backdropFilter: "blur(14px)",
          border: "1px solid var(--border-glass)",
          borderRadius: "10px",
          padding: "8px 12px",
          display: "flex",
          gap: "12px",
          alignItems: "center",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "12px", height: "3px", background: "#38bdf8", borderRadius: "2px" }} />
          <span style={{ fontSize: "0.68rem", color: "#e2e8f0" }}>Metro</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "12px", height: "3px", background: "#34d399", borderRadius: "2px" }} />
          <span style={{ fontSize: "0.68rem", color: "#e2e8f0" }}>Bus</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "12px", height: "3px", background: "#fbbf24", borderRadius: "2px" }} />
          <span style={{ fontSize: "0.68rem", color: "#e2e8f0" }}>Auto</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "12px", height: "3px", background: "#fb923c", borderRadius: "2px" }} />
          <span style={{ fontSize: "0.68rem", color: "#e2e8f0" }}>Bike</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "12px", height: "3px", background: "#e2e8f0", borderRadius: "2px" }} />
          <span style={{ fontSize: "0.68rem", color: "#e2e8f0" }}>Cab</span>
        </div>
      </div>

      {/* Map Floating Controls (Bottom Right) */}
      <div
        style={{
          position: "absolute",
          bottom: "16px",
          right: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          zIndex: 10,
        }}
      >
        <button
          onClick={() => setZoom((z) => Math.min(z + 0.25, 2.5))}
          title="Zoom In"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: "rgba(18, 27, 47, 0.85)",
            backdropFilter: "blur(10px)",
            border: "1px solid var(--border-glass)",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z - 0.25, 0.75))}
          title="Zoom Out"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: "rgba(18, 27, 47, 0.85)",
            backdropFilter: "blur(10px)",
            border: "1px solid var(--border-glass)",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={() => setZoom(1)}
          title="Reset View"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: "rgba(18, 27, 47, 0.85)",
            backdropFilter: "blur(10px)",
            border: "1px solid var(--border-glass)",
            color: "#60a5fa",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Navigation2 size={16} />
        </button>
      </div>
    </div>
  );
};
