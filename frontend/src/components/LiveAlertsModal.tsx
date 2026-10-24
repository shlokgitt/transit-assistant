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

  useEffect(() => {
    if (isOpen) {
      setStatus(getCityTransitStatus(cityId));
    }
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
                Updated 1 minute ago • DMRC, DTC & Urban Traffic Feeds
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
              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>METRO LINES</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: status.crowdIndex.metro === "High" ? "#f43f5e" : "#f59e0b" }} />
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffffff" }}>{status.crowdIndex.metro} Crowd</span>
              </div>
            </div>

            <div style={{ padding: "10px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>CITY BUS CORRIDORS</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f43f5e" }} />
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffffff" }}>{status.crowdIndex.bus} Load</span>
              </div>
            </div>

            <div style={{ padding: "10px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>SURFACE ROADS</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} />
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffffff" }}>{status.crowdIndex.roads}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Active Line Advisories */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px", maxHeight: "320px", overflowY: "auto" }}>
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
