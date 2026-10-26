"use client";

import React from "react";
import { Code2, AlertTriangle, Radio, Zap } from "lucide-react";
import { CITIES } from "@/lib/transitData";

const TransitPulseLogo = () => (
  <div style={{ position: "relative", width: "42px", height: "42px" }}>
    {/* Animated outer pulse ring */}
    <div
      style={{
        position: "absolute",
        inset: "-4px",
        borderRadius: "14px",
        background: "linear-gradient(135deg, rgba(59,130,246,0.5), rgba(6,182,212,0.5))",
        animation: "logoPulse 2.5s ease-in-out infinite",
        filter: "blur(4px)",
      }}
    />
    {/* Main icon container */}
    <div
      style={{
        position: "relative",
        width: "42px",
        height: "42px",
        borderRadius: "12px",
        background: "linear-gradient(135deg, #1d4ed8 0%, #0891b2 60%, #06b6d4 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 0 20px rgba(59,130,246,0.6), inset 0 1px 0 rgba(255,255,255,0.2)",
        border: "1px solid rgba(255,255,255,0.15)",
      }}
    >
      {/* Custom transit pulse SVG */}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        {/* Metro/train track lines */}
        <path d="M3 12 L21 12" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="2 2"/>
        {/* Speed lines */}
        <path d="M5 8 L10 8" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M5 16 L9 16" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
        {/* Main pulse/signal circle */}
        <circle cx="12" cy="12" r="4" fill="white" opacity="0.95"/>
        <circle cx="12" cy="12" r="7" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" fill="none"/>
        {/* Navigation arrow tip */}
        <path d="M12 5 L14.5 9.5 L12 8.5 L9.5 9.5 Z" fill="white"/>
        {/* Dot accent */}
        <circle cx="18" cy="8" r="1.5" fill="rgba(56,189,248,0.9)"/>
        <circle cx="6" cy="16" r="1.5" fill="rgba(52,211,153,0.9)"/>
      </svg>
    </div>
    <style>{`
      @keyframes logoPulse {
        0%, 100% { opacity: 0.6; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.08); }
      }
    `}</style>
  </div>
);

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
        <TransitPulseLogo />
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1
              style={{
                fontSize: "1.15rem",
                fontWeight: "900",
                letterSpacing: "-0.03em",
                background: "linear-gradient(90deg, #ffffff 0%, #bfdbfe 50%, #67e8f9 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "0 0 30px rgba(59,130,246,0.3)",
              }}
            >
              TransitPulse
            </h1>
            <span
              style={{
                fontSize: "0.6rem",
                padding: "2px 7px",
                borderRadius: "999px",
                background: "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(6,182,212,0.2))",
                color: "#67e8f9",
                border: "1px solid rgba(103,232,249,0.4)",
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              <Zap size={8} />
              v1.0
            </span>
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981", display: "inline-block", flexShrink: 0 }} />
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
