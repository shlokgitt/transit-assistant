"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MapPin,
  ArrowUpDown,
  Search,
  Train,
  Bus,
  Car,
  Bike,
  Footprints,
  SlidersHorizontal,
  ShieldAlert,
  Zap,
  Leaf,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  TransitMode,
  RoutingPriority,
  StopItem,
  CityConfig,
} from "@/types/transit";
import { searchStops } from "@/lib/transitData";

interface SearchPanelProps {
  city: CityConfig;
  origin: string;
  destination: string;
  onChangeOrigin: (val: string) => void;
  onChangeDestination: (val: string) => void;
  onSwap: () => void;
  selectedModes: TransitMode[];
  onToggleMode: (mode: TransitMode) => void;
  priority: RoutingPriority;
  onChangePriority: (p: RoutingPriority) => void;
  avoidCrowded: boolean;
  onToggleAvoidCrowded: () => void;
  onSearch: () => void;
  isLoading: boolean;
  onSelectPreset: (from: string, to: string) => void;
}

const MODES: { id: TransitMode; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "metro", label: "Metro", icon: <Train size={14} />, color: "#3b82f6" },
  { id: "bus", label: "Bus", icon: <Bus size={14} />, color: "#10b981" },
  { id: "auto", label: "Auto", icon: <span style={{ fontSize: "12px", fontWeight: 700 }}>🛺</span>, color: "#f59e0b" },
  { id: "bike", label: "Bike Taxi", icon: <Bike size={14} />, color: "#f97316" },
  { id: "cab", label: "Cab / Taxi", icon: <Car size={14} />, color: "#cbd5e1" },
  { id: "walk", label: "Walk", icon: <Footprints size={14} />, color: "#06b6d4" },
];

const PRIORITIES: { id: RoutingPriority; label: string; icon: React.ReactNode; badge: string }[] = [
  { id: "fastest", label: "Fastest", icon: <Zap size={13} />, badge: "⚡ Quickest Arrival" },
  { id: "cheapest", label: "Cheapest", icon: <span style={{ fontSize: "12px" }}>₹</span>, badge: "💰 Lowest Fare" },
  { id: "least_transfers", label: "Least Transfers", icon: <Layers size={13} />, badge: "🔄 Direct First" },
  { id: "eco", label: "Eco-Friendly", icon: <Leaf size={13} />, badge: "🌿 Low CO₂" },
];

export const SearchPanel: React.FC<SearchPanelProps> = ({
  city,
  origin,
  destination,
  onChangeOrigin,
  onChangeDestination,
  onSwap,
  selectedModes,
  onToggleMode,
  priority,
  onChangePriority,
  avoidCrowded,
  onToggleAvoidCrowded,
  onSearch,
  isLoading,
  onSelectPreset,
}) => {
  const [originSuggestions, setOriginSuggestions] = useState<StopItem[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<StopItem[]>([]);
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);

  const originRef = useRef<HTMLDivElement>(null);
  const destRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showOriginDropdown) {
      setOriginSuggestions(searchStops(city.id, origin));
    }
  }, [origin, city.id, showOriginDropdown]);

  useEffect(() => {
    if (showDestDropdown) {
      setDestSuggestions(searchStops(city.id, destination));
    }
  }, [destination, city.id, showDestDropdown]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (originRef.current && !originRef.current.contains(e.target as Node)) {
        setShowOriginDropdown(false);
      }
      if (destRef.current && !destRef.current.contains(e.target as Node)) {
        setShowDestDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        padding: "16px",
        background: "rgba(14, 21, 37, 0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border-glass)",
      }}
    >
      {/* Route Inputs with Swap Button */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "8px" }}>
        {/* Origin Field */}
        <div ref={originRef} style={{ position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "rgba(23, 34, 58, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "10px",
              padding: "10px 14px",
              transition: "all 0.2s ease",
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#10b981",
                boxShadow: "0 0 10px #10b981",
                flexShrink: 0,
              }}
            />
            <input
              type="text"
              value={origin}
              onChange={(e) => {
                onChangeOrigin(e.target.value);
                setShowOriginDropdown(true);
              }}
              onFocus={() => setShowOriginDropdown(true)}
              placeholder={`Starting location or station in ${city.name}...`}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#ffffff",
                fontSize: "0.85rem",
                fontWeight: 500,
              }}
            />
          </div>

          {/* Autocomplete Dropdown */}
          {showOriginDropdown && originSuggestions.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: "4px",
                background: "#0f172a",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: "10px",
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.7)",
                zIndex: 50,
                maxHeight: "220px",
                overflowY: "auto",
              }}
            >
              {originSuggestions.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onChangeOrigin(item.name);
                    setShowOriginDropdown(false);
                  }}
                  style={{
                    padding: "9px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                    fontSize: "0.8rem",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(59, 130, 246, 0.15)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <MapPin size={13} color="#94a3b8" />
                    <span style={{ color: "#f8fafc", fontWeight: 500 }}>{item.name}</span>
                  </div>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: "rgba(255, 255, 255, 0.08)",
                      color: "#94a3b8",
                      textTransform: "capitalize",
                    }}
                  >
                    {item.type} {item.line ? `• ${item.line}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Swap Button Absolute */}
        <button
          onClick={onSwap}
          title="Swap origin and destination"
          style={{
            position: "absolute",
            right: "16px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 10,
            width: "30px",
            height: "30px",
            borderRadius: "50%",
            background: "rgba(30, 41, 59, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            color: "#60a5fa",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-50%) rotate(180deg)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(-50%) rotate(0deg)")}
        >
          <ArrowUpDown size={14} />
        </button>

        {/* Destination Field */}
        <div ref={destRef} style={{ position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "rgba(23, 34, 58, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "10px",
              padding: "10px 14px",
              transition: "all 0.2s ease",
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#f43f5e",
                boxShadow: "0 0 10px #f43f5e",
                flexShrink: 0,
              }}
            />
            <input
              type="text"
              value={destination}
              onChange={(e) => {
                onChangeDestination(e.target.value);
                setShowDestDropdown(true);
              }}
              onFocus={() => setShowDestDropdown(true)}
              placeholder={`Where do you want to go in ${city.name}?`}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#ffffff",
                fontSize: "0.85rem",
                fontWeight: 500,
              }}
            />
          </div>

          {/* Autocomplete Dropdown */}
          {showDestDropdown && destSuggestions.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: "4px",
                background: "#0f172a",
                border: "1px solid rgba(244, 63, 94, 0.3)",
                borderRadius: "10px",
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.7)",
                zIndex: 50,
                maxHeight: "220px",
                overflowY: "auto",
              }}
            >
              {destSuggestions.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onChangeDestination(item.name);
                    setShowDestDropdown(false);
                  }}
                  style={{
                    padding: "9px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                    fontSize: "0.8rem",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(244, 63, 94, 0.15)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <MapPin size={13} color="#94a3b8" />
                    <span style={{ color: "#f8fafc", fontWeight: 500 }}>{item.name}</span>
                  </div>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: "rgba(255, 255, 255, 0.08)",
                      color: "#94a3b8",
                      textTransform: "capitalize",
                    }}
                  >
                    {item.type} {item.line ? `• ${item.line}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* City Presets Quick Pills */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
          <Sparkles size={12} color="#f59e0b" />
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
            Popular City Routes
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
          {city.popularPresets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => onSelectPreset(p.from, p.to)}
              style={{
                flexShrink: 0,
                padding: "4px 10px",
                borderRadius: "16px",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                color: "#94a3b8",
                fontSize: "0.72rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(59, 130, 246, 0.15)";
                e.currentTarget.style.color = "#93c5fd";
                e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                e.currentTarget.style.color = "#94a3b8";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
              }}
            >
              {p.from} ➔ {p.to}
            </button>
          ))}
        </div>
      </div>

      {/* Transit Modes Toggles */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
            Include Modes
          </span>
          <span style={{ fontSize: "0.68rem", color: "#60a5fa" }}>
            {selectedModes.length} / {MODES.length} Active
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
          {MODES.map((m) => {
            const isSelected = selectedModes.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => onToggleMode(m.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 10px",
                  borderRadius: "8px",
                  background: isSelected ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.02)",
                  border: isSelected ? `1px solid ${m.color}` : "1px solid rgba(255, 255, 255, 0.06)",
                  color: isSelected ? "#ffffff" : "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  fontWeight: isSelected ? 600 : 400,
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ color: isSelected ? m.color : "var(--text-muted)" }}>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Routing Priority & Crowd Penalty */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
            Routing Priority
          </span>
          {/* Avoid Crowded Routes Checkbox */}
          <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "0.72rem", color: avoidCrowded ? "#f59e0b" : "var(--text-muted)" }}>
            <input
              type="checkbox"
              checked={avoidCrowded}
              onChange={onToggleAvoidCrowded}
              style={{ accentColor: "#f59e0b" }}
            />
            <ShieldAlert size={12} />
            <span>Avoid Crowded</span>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px" }}>
          {PRIORITIES.map((p) => {
            const isSelected = priority === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onChangePriority(p.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 10px",
                  borderRadius: "8px",
                  background: isSelected
                    ? "linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(6, 182, 212, 0.15))"
                    : "rgba(255, 255, 255, 0.03)",
                  border: isSelected ? "1px solid rgba(59, 130, 246, 0.5)" : "1px solid rgba(255, 255, 255, 0.06)",
                  color: isSelected ? "#38bdf8" : "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  fontWeight: isSelected ? 700 : 500,
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  {p.icon}
                  <span>{p.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Plan Route CTA Button */}
      <button
        onClick={onSearch}
        disabled={isLoading || !origin.trim() || !destination.trim()}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          width: "100%",
          padding: "12px",
          borderRadius: "10px",
          background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
          border: "none",
          color: "#ffffff",
          fontSize: "0.88rem",
          fontWeight: 700,
          letterSpacing: "0.02em",
          cursor: isLoading || !origin.trim() || !destination.trim() ? "not-allowed" : "pointer",
          opacity: isLoading || !origin.trim() || !destination.trim() ? 0.6 : 1,
          boxShadow: "0 4px 18px rgba(37, 99, 235, 0.4)",
          transition: "all 0.2s ease",
          marginTop: "4px",
        }}
        onMouseEnter={(e) => {
          if (!isLoading) e.currentTarget.style.transform = "scale(1.01)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <Search size={16} />
        <span>{isLoading ? "Computing Optimal Multimodal Routes..." : "Find Best Routes"}</span>
      </button>
    </div>
  );
};
