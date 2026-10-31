"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  AlertTriangle,
  Info,
  Radio,
  Train,
  Bus,
  Car,
  Activity,
} from "lucide-react";
import { TransitStatusResponse, TransitMode } from "@/types/transit";
import { getCityTransitStatus, CITIES } from "@/lib/transitData";

interface LiveAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cityId: string;
}

export const LiveAlertsModal: React.FC<LiveAlertsModalProps> = ({
  isOpen,
  onClose,
  cityId,
}) => {
  const [status, setStatus] = useState<TransitStatusResponse | null>(null);
  const [selectedStation, setSelectedStation] = useState<string>("NDLS");
  const [stationTrains, setStationTrains] = useState<any[]>([]);
  const [isLoadingTrains, setIsLoadingTrains] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingTrains(true);
    fetch(`/api/v1/trains/${selectedStation}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.data?.trains) {
          setStationTrains(data.data.trains.slice(0, 5));
        }
      })
      .catch((err) => console.warn("Failed to fetch trains:", err))
      .finally(() => setIsLoadingTrains(false));
  }, [isOpen, selectedStation]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    void fetch(`/api/v1/transit/status?city=${encodeURIComponent(cityId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Live transit status unavailable.");
        return (await response.json()) as TransitStatusResponse;
      })
      .then((nextStatus) => {
        if (!cancelled) setStatus(nextStatus);
      })
      .catch(() => {
        if (!cancelled) setStatus(getCityTransitStatus(cityId));
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, cityId]);

  if (!isOpen || !status) return null;

  const city = CITIES[cityId] || CITIES["delhi"];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: "90%",
          maxWidth: "600px",
          background: "#0d1322",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(245, 158, 11, 0.15)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(245, 158, 11, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "rgba(245, 158, 11, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fbbf24",
              }}
            >
              <Radio size={18} className="animate-pulse-glow" />
            </div>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff" }}>
                {city.name} Transit Radar & Live Status
              </h2>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                {status.liveData
                  ? `Live OTD feed • ${status.liveData.vehicleCount} buses • Updated ${new Date(status.liveData.updatedAt).toLocaleTimeString()}`
                  : status.error
                    ? "Live bus feed unavailable • Showing latest available status"
                    : "DMRC, DTC & Urban Traffic Feeds"}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Live Congestion Metric Cards */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, display: "block", marginBottom: "8px" }}>
            Real-Time Network Congestion Radar
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
            <div style={{ padding: "10px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Metro lines</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: status.crowdIndex.metro === "High" ? "#f43f5e" : "#f59e0b" }} />
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffffff" }}>{status.crowdIndex.metro} Crowd</span>
              </div>
            </div>

            <div style={{ padding: "10px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>City bus corridors</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f43f5e" }} />
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffffff" }}>{status.crowdIndex.bus} Load</span>
              </div>
            </div>

            <div style={{ padding: "10px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Surface roads</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} />
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffffff" }}>{status.crowdIndex.roads}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Indian Railways Live Departures (RailRadar) */}
        <div style={{ padding: "0 20px 10px 20px" }}>
          <div
            style={{
              padding: "12px",
              borderRadius: "8px",
              background: "rgba(56, 189, 248, 0.06)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ fontSize: "0.78rem", color: "#38bdf8", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                <span>🚆 RailRadar Live Station Board</span>
              </div>
              <span style={{ fontSize: "0.64rem", color: "#7dd3fc", background: "rgba(56, 189, 248, 0.15)", padding: "2px 6px", borderRadius: "4px" }}>
                Live API
              </span>
            </div>

            {/* Station selector pills */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "10px", overflowX: "auto", paddingBottom: "4px" }}>
              {[
                { code: "NDLS", name: "New Delhi" },
                { code: "ANVT", name: "Anand Vihar" },
                { code: "GZB", name: "Ghaziabad" },
                { code: "NZM", name: "Nizamuddin" },
                { code: "DLI", name: "Old Delhi" },
                { code: "GGN", name: "Gurgaon" },
                { code: "FDB", name: "Faridabad" },
                { code: "DEC", name: "Delhi Cantt" },
                { code: "DEE", name: "Sarai Rohilla" },
              ].map((stn) => (
                <button
                  key={stn.code}
                  onClick={() => setSelectedStation(stn.code)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "5px",
                    fontSize: "0.68rem",
                    fontWeight: selectedStation === stn.code ? 700 : 500,
                    border: selectedStation === stn.code ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.08)",
                    background: selectedStation === stn.code ? "rgba(56, 189, 248, 0.25)" : "rgba(255,255,255,0.03)",
                    color: selectedStation === stn.code ? "#ffffff" : "#94a3b8",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {stn.name} ({stn.code})
                </button>
              ))}
            </div>

            {/* Train departures */}
            {isLoadingTrains ? (
              <div style={{ fontSize: "0.72rem", color: "#94a3b8", padding: "6px 0" }}>Loading live trains from RailRadar...</div>
            ) : stationTrains.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {stationTrains.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.74rem",
                      padding: "5px 8px",
                      background: "rgba(0,0,0,0.3)",
                      borderRadius: "5px",
                      border: "1px solid rgba(255,255,255,0.03)",
                    }}
                  >
                    <span>
                      <strong style={{ color: "#38bdf8" }}>#{item.train.number}</strong>{" "}
                      <span style={{ color: "#f1f5f9" }}>{item.train.name}</span>
                      <span style={{ color: "#94a3b8", fontSize: "0.68rem", marginLeft: "6px" }}>
                        ➔ {item.train.destination?.name || "Terminus"}
                      </span>
                    </span>
                    <strong style={{ color: "#fbbf24", whiteSpace: "nowrap" }}>
                      {item.stop?.departure || "Scheduled"}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>No active trains scheduled at this time.</div>
            )}
          </div>
        </div>

        {/* Active Line Advisories */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px", maxHeight: "320px", overflowY: "auto" }}>
          {status.liveData?.vehicles && status.liveData.vehicles.length > 0 && (
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
              }}
            >
              <div style={{ fontSize: "0.78rem", color: "#34d399", fontWeight: 700, marginBottom: "8px" }}>
                Live bus estimates
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {status.liveData.vehicles.slice(0, 5).map((vehicle) => (
                  <div
                    key={vehicle.id}
                    style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "0.72rem", color: "var(--text-secondary)" }}
                  >
                    <span>
                      Bus {vehicle.routeId || vehicle.id}
                      {vehicle.nearestStop ? ` near ${vehicle.nearestStop}` : ""}
                    </span>
                    <strong style={{ color: "#ffffff", whiteSpace: "nowrap" }}>
                      {vehicle.estimatedArrivalMinutes
                        ? `~${vehicle.estimatedArrivalMinutes} min`
                        : "Location only"}
                    </strong>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", marginTop: "8px" }}>
                Estimated from live vehicle position; not an official OTD arrival prediction.
              </div>
            </div>
          )}
          {status.alerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                padding: "12px",
                borderRadius: "8px",
                background: alert.severity === "warning" ? "rgba(245, 158, 11, 0.08)" : "rgba(59, 130, 246, 0.08)",
                border: alert.severity === "warning" ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid rgba(59, 130, 246, 0.3)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                {alert.severity === "warning" ? (
                  <AlertTriangle size={15} color="#fbbf24" />
                ) : (
                  <Info size={15} color="#60a5fa" />
                )}
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffffff" }}>
                  {alert.title}
                </span>
              </div>
              <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                {alert.message}
              </p>
              {alert.activeLines && (
                <div style={{ display: "flex", gap: "5px", marginTop: "8px" }}>
                  {alert.activeLines.map((line, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: "0.68rem",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: "rgba(255, 255, 255, 0.08)",
                        color: "#fbbf24",
                        fontWeight: 600,
                      }}
                    >
                      {line}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
