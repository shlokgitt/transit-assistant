"use client";

import React from "react";
import { Compass, Code2, AlertTriangle, Radio } from "lucide-react";
import { CITIES } from "@/lib/transitData";

interface HeaderProps {
  selectedCity: string;
  onSelectCity: (cityId: string) => void;
  onOpenApiInspector: () => void;
  onOpenAlerts: () => void;
  period: "peak" | "offpeak";
  onTogglePeriod: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedCity,
  onSelectCity,
  onOpenApiInspector,
  onOpenAlerts,
  period,
  onTogglePeriod,
}) => {
  const city = CITIES[selectedCity] || CITIES["delhi"];

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 20px",
        background: "rgba(10, 15, 29, 0.85)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border-glass)",
        zIndex: 40,
        position: "relative",
      }}
    >
      {/* Brand & City */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 16px rgba(59, 130, 246, 0.4)",
          }}
        >
          <Compass size={22} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1
              style={{
                fontSize: "1.1rem",
                fontWeight: "800",
                letterSpacing: "-0.02em",
                background: "linear-gradient(90deg, #ffffff 30%, #93c5fd 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              TransitPulse
            </h1>
            <span
              style={{
                fontSize: "0.65rem",
                padding: "2px 6px",
                borderRadius: "4px",
                background: "rgba(59, 130, 246, 0.15)",
                color: "#60a5fa",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                fontWeight: 700,
              }}
            >
              MULTI-MODAL v1.0
            </span>
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "1px" }}>
            {city.tagline}
          </p>
        </div>
      </div>

      {/* Center: City Switcher */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            display: "flex",
            background: "rgba(18, 27, 47, 0.8)",
            padding: "3px",
            borderRadius: "10px",
            border: "1px solid var(--border-glass)",
          }}
        >
          {Object.values(CITIES).map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectCity(c.id)}
              style={{
                padding: "5px 12px",
                fontSize: "0.75rem",
                fontWeight: selectedCity === c.id ? 700 : 500,
                color: selectedCity === c.id ? "#ffffff" : "var(--text-secondary)",
                background:
                  selectedCity === c.id
                    ? "linear-gradient(135deg, #2563eb, #0891b2)"
                    : "transparent",
                border: "none",
                borderRadius: "7px",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Peak / Offpeak toggle */}
        <button
          onClick={onTogglePeriod}
          title="Toggle Peak Rush Hour / Off-Peak mode"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            borderRadius: "8px",
            border: "1px solid",
            borderColor: period === "peak" ? "rgba(245, 158, 11, 0.4)" : "rgba(16, 185, 129, 0.4)",
            background: period === "peak" ? "rgba(245, 158, 11, 0.12)" : "rgba(16, 185, 129, 0.12)",
            color: period === "peak" ? "#fbbf24" : "#34d399",
            cursor: "pointer",
            fontSize: "0.75rem",
            fontWeight: 600,
            transition: "all 0.2s ease",
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: period === "peak" ? "#f59e0b" : "#10b981",
              boxShadow: period === "peak" ? "0 0 8px #f59e0b" : "0 0 8px #10b981",
            }}
          />
          {period === "peak" ? "Peak Rush 🚦" : "Off-Peak 🌤️"}
        </button>
      </div>

      {/* Right: Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          onClick={onOpenAlerts}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            padding: "6px 12px",
            borderRadius: "8px",
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            color: "#fbbf24",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <AlertTriangle size={14} />
          <span>Live Alerts</span>
        </button>

        <button
          onClick={onOpenApiInspector}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            borderRadius: "8px",
            background: "rgba(59, 130, 246, 0.12)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            color: "#60a5fa",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Code2 size={14} />
          <span>API Contract</span>
        </button>
      </div>
    </header>
  );
};
