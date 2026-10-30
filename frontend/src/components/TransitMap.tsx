"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { RouteOption, TransitMode, CityConfig } from "@/types/transit";
import { ZoomIn, ZoomOut, Navigation2, Layers, MapPin, Info } from "lucide-react";

interface TransitMapProps {
  city: CityConfig;
  route: RouteOption | null;
  selectedLegIndex: number | null;
  simulationStep: number;
  isSimulating: boolean;
}

const MODE_COLOR: Record<TransitMode, { stroke: string; glow: string; width: number; dash?: string }> = {
  metro: { stroke: "#A7B58A", glow: "rgba(167,181,138,0.55)", width: 5 },
  bus:   { stroke: "#C47A44", glow: "rgba(196,122,68,0.55)", width: 4.5, dash: "8 4" },
  auto:  { stroke: "#D2A85A", glow: "rgba(210,168,90,0.55)", width: 4 },
  cab:   { stroke: "#B8ADA0", glow: "rgba(184,173,160,0.45)", width: 4.5 },
  walk:  { stroke: "#829A86", glow: "rgba(130,154,134,0.5)", width: 3, dash: "4 4" },
};

const CITY_METRO_LINES: Record<string, Array<{ name: string; color: string; coords: [number, number][] }>> = {
  delhi: [
    { name: "Blue Line", color: "#2563eb", coords: [[28.6304,77.0925],[28.6419,77.1217],[28.6525,77.192],[28.6667,77.2167],[28.6356,77.2506],[28.6228,77.2786]] },
    { name: "Yellow Line", color: "#eab308", coords: [[28.7041,77.1025],[28.6803,77.1067],[28.6530,77.1198],[28.6305,77.2167],[28.5874,77.2361]] },
    { name: "Red Line", color: "#dc2626", coords: [[28.7280,77.1050],[28.7041,77.1025],[28.6688,77.1055],[28.6477,77.1218]] },
    { name: "Green Line", color: "#16a34a", coords: [[28.6477,77.0716],[28.6530,77.1198],[28.6650,77.1330]] },
    { name: "Pink Line", color: "#db2777", coords: [[28.5562,77.0911],[28.5867,77.1538],[28.6305,77.2167],[28.6650,77.2800],[28.7041,77.3100]] },
    { name: "Violet Line", color: "#7c3aed", coords: [[28.6139,77.2090],[28.5874,77.2361],[28.5562,77.2700],[28.5091,77.2700]] },
  ],
  mumbai: [
    { name: "Line 1", color: "#2563eb", coords: [[19.1710,72.8280],[19.1520,72.8370],[19.1200,72.8480],[19.0760,72.8777]] },
    { name: "Line 2A", color: "#dc2626", coords: [[19.2380,72.8380],[19.2100,72.8360],[19.1710,72.8280]] },
    { name: "Line 7", color: "#ea580c", coords: [[19.2380,72.8380],[19.2100,72.8760],[19.1900,72.9020]] },
  ],
  bengaluru: [
    { name: "Purple Line", color: "#7c3aed", coords: [[12.9945,77.5707],[12.9800,77.5750],[12.9716,77.5946],[12.9630,77.6150],[12.9530,77.6300]] },
    { name: "Green Line", color: "#16a34a", coords: [[13.0300,77.5500],[13.0100,77.5660],[12.9716,77.5946],[12.9450,77.5890],[12.9280,77.5850]] },
  ],
};

const CITY_LANDMARKS: Record<string, Array<{ name: string; lat: number; lng: number; type: string }>> = {
  delhi: [
    { name: "India Gate", lat: 28.6129, lng: 77.2295, type: "monument" },
    { name: "Red Fort", lat: 28.6562, lng: 77.2410, type: "monument" },
    { name: "Qutub Minar", lat: 28.5244, lng: 77.1855, type: "monument" },
    { name: "Connaught Place", lat: 28.6315, lng: 77.2167, type: "hub" },
    { name: "Kashmere Gate", lat: 28.6680, lng: 77.2268, type: "hub" },
    { name: "New Delhi Rly", lat: 28.6431, lng: 77.2189, type: "transport" },
    { name: "IGI Airport", lat: 28.5562, lng: 77.1000, type: "transport" },
    { name: "Cyber City", lat: 28.4950, lng: 77.0880, type: "business" },
    { name: "Noida Sector 18", lat: 28.5705, lng: 77.3219, type: "business" },
  ],
  mumbai: [
    { name: "CSMT", lat: 18.9400, lng: 72.8353, type: "transport" },
    { name: "BKC", lat: 19.0607, lng: 72.8681, type: "business" },
    { name: "Bandra West", lat: 19.0596, lng: 72.8295, type: "hub" },
    { name: "Marine Drive", lat: 18.9438, lng: 72.8232, type: "monument" },
  ],
  bengaluru: [
    { name: "MG Road", lat: 12.9758, lng: 77.6100, type: "hub" },
    { name: "Whitefield", lat: 12.9698, lng: 77.7500, type: "business" },
    { name: "Kempegowda", lat: 12.9778, lng: 77.5723, type: "transport" },
    { name: "Koramangala", lat: 12.9347, lng: 77.6266, type: "hub" },
  ],
};

export const TransitMap: React.FC<TransitMapProps> = ({
  city,
  route,
  selectedLegIndex,
  simulationStep,
  isSimulating,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapStyle, setMapStyle] = useState<"dark" | "satellite">("dark");
  const [showLegend, setShowLegend] = useState(true);
  const vehicleAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize Leaflet map
  useEffect(() => {
    const container = mapContainerRef.current as (HTMLDivElement & { _leaflet_id?: number }) | null;
    if (!container || mapInstanceRef.current || container._leaflet_id != null) return;

    const initMap = async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      const map = L.map(container, {
        center: [city.center.lat, city.center.lng],
        zoom: 12,
        zoomControl: false,
        attributionControl: true,
      });

      // Dark styled tile layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      // Add custom zoom control
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Draw metro network lines for this city
      const metroLines = CITY_METRO_LINES[city.id] || [];
      metroLines.forEach((line) => {
        // Glow backdrop
        L.polyline(line.coords, {
          color: line.color,
          weight: 8,
          opacity: 0.18,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
        // Main line
        L.polyline(line.coords, {
          color: line.color,
          weight: 3,
          opacity: 0.75,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map).bindPopup(
          `<div style="font-weight:700;font-size:0.85rem;margin-bottom:4px">${line.name}</div><div style="font-size:0.75rem;color:#94a3b8">Metro Rail Network — Route overlay</div>`
        );
      });

      // Landmark markers
      const landmarks = CITY_LANDMARKS[city.id] || [];
      landmarks.forEach((lm) => {
        const icon = lm.type === "monument" ? "🏛️" : lm.type === "transport" ? "🚉" : lm.type === "business" ? "🏢" : "📍";
        const divIcon = L.divIcon({
          html: `<div style="
            background: rgba(8,13,26,0.88);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 8px;
            padding: 3px 7px;
            font-size: 10px;
            color: #e2e8f0;
            font-family: var(--font-main);
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            display: flex; align-items: center; gap: 4px;
            backdrop-filter: blur(8px);
          ">${icon} <span>${lm.name}</span></div>`,
          className: "",
          iconAnchor: [0, 0],
        });
        L.marker([lm.lat, lm.lng], { icon: divIcon }).addTo(map)
          .bindPopup(`<div style="font-weight:700">${icon} ${lm.name}</div><div style="font-size:0.72rem;color:#94a3b8;margin-top:3px">${lm.type.charAt(0).toUpperCase() + lm.type.slice(1)} — City landmark</div>`);
      });

      mapInstanceRef.current = map;
      routeLayerRef.current = L.layerGroup().addTo(map);
      markersLayerRef.current = L.layerGroup().addTo(map);
      setMapReady(true);
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (container) {
        (container as HTMLDivElement & { _leaflet_id?: number })._leaflet_id = undefined;
      }
    };
  }, [city.id]);

  // Update route on map when route changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    const renderRoute = async () => {
      const L = (await import("leaflet")).default;

      // Clear previous route layers
      routeLayerRef.current?.clearLayers();
      markersLayerRef.current?.clearLayers();
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.remove();
        vehicleMarkerRef.current = null;
      }

      if (!route) {
        map.setView([city.center.lat, city.center.lng], 12);
        return;
      }

      const allCoords: [number, number][] = route.legs.flatMap((l) =>
        l.coordinates.map((c): [number, number] => [c[0], c[1]])
      );

      if (allCoords.length < 2) return;

      // Fit map to route bounds
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, { padding: [60, 60] });

      // Draw each leg
      route.legs.forEach((leg, lIdx) => {
        const isActive = selectedLegIndex === null || selectedLegIndex === lIdx;
        const style = MODE_COLOR[leg.mode];
        const coords: [number, number][] = leg.coordinates.map((c): [number, number] => [c[0], c[1]]);
        if (coords.length < 2) return;

        // Glow backdrop
        L.polyline(coords, {
          color: style.glow,
          weight: style.width + 10,
          opacity: isActive ? 0.35 : 0.08,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(routeLayerRef.current!);

        // Main path
        const line = L.polyline(coords, {
          color: style.stroke,
          weight: style.width,
          opacity: isActive ? 0.95 : 0.2,
          lineCap: "round",
          lineJoin: "round",
          dashArray: style.dash,
        }).addTo(routeLayerRef.current!);

        line.bindPopup(
          `<div style="font-weight:700;font-size:0.85rem;margin-bottom:6px;color:${style.stroke}">${leg.mode.charAt(0).toUpperCase() + leg.mode.slice(1)} ${leg.lineName ? `— ${leg.lineName}` : ""}</div>` +
          `<div style="font-size:0.78rem;margin-bottom:3px">📍 <strong>${leg.from}</strong> → <strong>${leg.to}</strong></div>` +
          `<div style="font-size:0.75rem;color:#94a3b8">⏱ ${leg.durationMinutes} min &nbsp;•&nbsp; 📏 ${leg.distanceKm} km &nbsp;•&nbsp; ${leg.fare != null ? `₹${leg.fare}` : "Fare unavailable"}</div>` +
          `<div style="font-size:0.68rem;color:#34d399;margin-top:6px;padding:3px 6px;background:rgba(16,185,129,0.1);border-radius:4px">✓ Real route data</div>`
        );

        // Stop markers along route
        coords.slice(1, -1).forEach((coord, sIdx) => {
          const stopDot = L.circleMarker(coord, {
            radius: 4,
            fillColor: style.stroke,
            color: "#0a0d1c",
            weight: 2,
            fillOpacity: 0.9,
            opacity: isActive ? 1 : 0.2,
          }).addTo(routeLayerRef.current!);
        });
      });

      // Origin marker
      const firstLeg = route.legs[0];
      const originCoord: [number, number] = [firstLeg.coordinates[0][0], firstLeg.coordinates[0][1]];

      const originIcon = L.divIcon({
        html: `<div style="position:relative;">
          <div style="position:absolute;inset:-8px;border-radius:50%;background:rgba(16,185,129,0.25);animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite;"></div>
          <div style="width:18px;height:18px;border-radius:50%;background:#10b981;border:3px solid #fff;box-shadow:0 0 16px rgba(16,185,129,0.8);display:flex;align-items:center;justify-content:center;position:relative;z-index:1;"></div>
        </div>`,
        className: "",
        iconAnchor: [9, 9],
      });

      L.marker(originCoord, { icon: originIcon })
        .addTo(markersLayerRef.current!)
        .bindPopup(
          `<div style="font-weight:700;color:#10b981;margin-bottom:4px">🟢 START</div>` +
          `<div style="font-size:0.82rem;font-weight:600">${firstLeg.from}</div>`
        );

      // Destination marker
      const lastLeg = route.legs[route.legs.length - 1];
      const lastCoords = lastLeg.coordinates;
      const destCoord: [number, number] = [lastCoords[lastCoords.length - 1][0], lastCoords[lastCoords.length - 1][1]];

      const destIcon = L.divIcon({
        html: `<div style="position:relative;">
          <div style="position:absolute;inset:-8px;border-radius:50%;background:rgba(244,63,94,0.25);animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite 0.5s;"></div>
          <div style="width:18px;height:18px;border-radius:50%;background:#f43f5e;border:3px solid #fff;box-shadow:0 0 16px rgba(244,63,94,0.8);display:flex;align-items:center;justify-content:center;position:relative;z-index:1;"></div>
        </div>`,
        className: "",
        iconAnchor: [9, 9],
      });

      L.marker(destCoord, { icon: destIcon })
        .addTo(markersLayerRef.current!)
        .bindPopup(
          `<div style="font-weight:700;color:#f43f5e;margin-bottom:4px">📍 DESTINATION</div>` +
          `<div style="font-size:0.82rem;font-weight:600">${lastLeg.to}</div>`
        );

      // Add transfer markers between legs
      route.legs.forEach((leg, lIdx) => {
        if (lIdx === route.legs.length - 1) return;
        const lastCoord = leg.coordinates[leg.coordinates.length - 1];
        const transferIcon = L.divIcon({
          html: `<div style="width:12px;height:12px;border-radius:50%;background:#fbbf24;border:2px solid #fff;box-shadow:0 0 10px rgba(251,191,36,0.6);"></div>`,
          className: "",
          iconAnchor: [6, 6],
        });
        L.marker([lastCoord[0], lastCoord[1]], { icon: transferIcon })
          .addTo(markersLayerRef.current!)
          .bindPopup(`<div style="font-weight:700;color:#fbbf24">🔄 Transfer Point</div><div style="font-size:0.75rem;color:#94a3b8;margin-top:2px">${leg.to}</div>`);
      });
    };

    renderRoute();
  }, [mapReady, route, selectedLegIndex, city]);

  // Vehicle simulation animation
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !isSimulating || !route) return;

    const animateVehicle = async () => {
      const L = (await import("leaflet")).default;

      const leg = route.legs[simulationStep];
      if (!leg || leg.coordinates.length < 2) return;

      const style = MODE_COLOR[leg.mode];
      const vehicleIcon = L.divIcon({
        html: `<div style="position:relative;width:24px;height:24px;">
          <div style="position:absolute;inset:-6px;border-radius:50%;background:${style.glow};animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite;"></div>
          <div style="width:24px;height:24px;border-radius:50%;background:${style.stroke};border:3px solid #fff;box-shadow:0 0 20px ${style.glow};display:flex;align-items:center;justify-content:center;font-size:11px;position:relative;z-index:1;">🚀</div>
        </div>`,
        className: "",
        iconAnchor: [12, 12],
      });

      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.remove();
      }

      const coords = leg.coordinates;
      let progress = 0;

      vehicleMarkerRef.current = L.marker(
        [coords[0][0], coords[0][1]],
        { icon: vehicleIcon, zIndexOffset: 1000 }
      ).addTo(mapInstanceRef.current!);

      if (vehicleAnimRef.current) clearInterval(vehicleAnimRef.current);
      vehicleAnimRef.current = setInterval(() => {
        progress = (progress + 0.025) % 1;
        const idx = Math.min(Math.floor(progress * (coords.length - 1)), coords.length - 2);
        const subT = (progress * (coords.length - 1)) - idx;
        const lat = coords[idx][0] + (coords[idx + 1][0] - coords[idx][0]) * subT;
        const lng = coords[idx][1] + (coords[idx + 1][1] - coords[idx][1]) * subT;
        vehicleMarkerRef.current?.setLatLng([lat, lng]);
      }, 60);
    };

    animateVehicle();

    return () => {
      if (vehicleAnimRef.current) clearInterval(vehicleAnimRef.current);
      vehicleMarkerRef.current?.remove();
      vehicleMarkerRef.current = null;
    };
  }, [mapReady, isSimulating, simulationStep, route]);

  const LEGEND = [
    { label: "Metro", color: "#A7B58A" },
    { label: "Bus", color: "#C47A44" },
    { label: "Auto", color: "#D2A85A" },
    { label: "Bike", color: "#B47758" },
    { label: "Cab", color: "#B8ADA0" },
    { label: "Walk", color: "#829A86" },
  ];

  return (
    <div className="map-canvas-container" style={{ position: "relative", width: "100%", height: "100%", minHeight: "280px" }}>
      <div className="map-grid-overlay" style={{ zIndex: 2, pointerEvents: "none" }} />

      {/* Real Leaflet Map */}
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%", zIndex: 1 }} />

      {/* Loading state */}
      {!mapReady && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: "radial-gradient(ellipse at 40% 50%, #0a1428 0%, #040609 100%)",
          gap: "16px",
        }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "50%",
            border: "3px solid rgba(59,130,246,0.2)",
            borderTop: "3px solid #3b82f6",
            animation: "spin 1s linear infinite",
          }} />
          <p style={{ color: "#64748b", fontSize: "0.82rem" }}>Loading Delhi NCR Map…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Route HUD — top left */}
      {route && mapReady && (
        <div style={{
          position: "absolute", top: "14px", left: "14px", zIndex: 20,
          background: "rgba(7,10,20,0.88)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "14px",
          padding: "10px 14px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.6), 0 0 20px rgba(59,130,246,0.1)",
          display: "flex", alignItems: "center", gap: "14px",
          maxWidth: "calc(100% - 24px)",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
              <span className={`badge-tag tag-${route.tag.toLowerCase().replace("_", "-")}`} style={{ fontSize: "0.6rem", padding: "2px 7px" }}>
                {route.tag.replace("_", " ")}
              </span>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {route.title}
              </span>
            </div>
            <p style={{ fontSize: "0.7rem", color: "#64748b" }}>
              {route.legs[0]?.from} → {route.legs[route.legs.length - 1]?.to}
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px", flexShrink: 0 }}>
            <div className="stat-box" style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", paddingLeft: "12px" }}>
              <span className="stat-label">Time</span>
              <span className="stat-value" style={{ color: "#38bdf8" }}>{route.totalDurationMinutes} min</span>
            </div>
            <div className="stat-box" style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", paddingLeft: "12px" }}>
              <span className="stat-label">Fare</span>
              <span className="stat-value" style={{ color: "#34d399" }}>₹{route.totalFare}</span>
            </div>
          </div>
        </div>
      )}

      {/* Simulation status banner */}
      {isSimulating && route?.legs[simulationStep] && (
        <div style={{
          position: "absolute", bottom: "70px", left: "50%", transform: "translateX(-50%)",
          zIndex: 20, background: "rgba(7,10,20,0.92)",
          border: "1px solid rgba(56,189,248,0.5)",
          boxShadow: "0 0 30px rgba(56,189,248,0.25)",
          borderRadius: "999px", padding: "8px 20px",
          display: "flex", alignItems: "center", gap: "10px",
          whiteSpace: "nowrap",
        }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 10px #38bdf8", flexShrink: 0 }}
            className="animate-pulse-glow" />
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff" }}>
            {route.legs[simulationStep].instruction}
          </span>
          <span style={{ padding: "2px 8px", borderRadius: "12px", background: "rgba(56,189,248,0.2)", color: "#38bdf8", fontSize: "0.7rem", fontWeight: 600 }}>
            Leg {simulationStep + 1}/{route.legs.length}
          </span>
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div style={{
          position: "absolute", bottom: "14px", left: "14px", zIndex: 20,
          background: "rgba(7,10,20,0.85)",
          backdropFilter: "blur(14px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px", padding: "8px 12px",
          display: "flex", gap: "10px", flexWrap: "wrap", maxWidth: "340px",
        }}>
          {LEGEND.map((l) => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "14px", height: "3px", background: l.color, borderRadius: "2px", display: "inline-block" }} />
              <span style={{ fontSize: "0.65rem", color: "#cbd5e1", fontWeight: 600 }}>{l.label}</span>
            </div>
          ))}
          <span className="demo-banner" style={{ marginLeft: "auto" }}>✓ Real route values</span>
        </div>
      )}

      {/* Map controls — right side */}
      <div style={{
        position: "absolute", top: "14px", right: "14px", zIndex: 20,
        display: "flex", flexDirection: "column", gap: "6px",
      }}>
        {[
          { icon: <Layers size={15} />, title: "Toggle Legend", onClick: () => setShowLegend(v => !v) },
        ].map((btn, i) => (
          <button key={i} onClick={btn.onClick} title={btn.title}
            style={{
              width: "34px", height: "34px", borderRadius: "8px",
              background: "rgba(9,14,28,0.9)", backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.2s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(59,130,246,0.25)"; e.currentTarget.style.color = "#93c5fd"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(9,14,28,0.9)"; e.currentTarget.style.color = "#94a3b8"; }}
          >
            {btn.icon}
          </button>
        ))}
      </div>

      {/* Ping keyframe injection */}
      <style>{`
        @keyframes ping {
          0% { transform: scale(1); opacity: 1; }
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
};
