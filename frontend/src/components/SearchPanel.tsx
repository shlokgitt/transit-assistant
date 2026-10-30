"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MapPin,
  ArrowUpDown,
  Search,
  SlidersHorizontal,
  ShieldAlert,
  Sparkles,
  Clock,
} from "lucide-react";
import {
  TransitMode,
  RoutingPriority,
  StopItem,
  CityConfig,
  JourneyConstraints,
} from "@/types/transit";
import { VehicleIllustration } from "@/components/VehicleIllustration";

interface SearchPanelProps {
  city: CityConfig;
  origin: string;
  destination: string;
  onChangeOrigin: (val: string) => void;
  onChangeDestination: (val: string) => void;
  onSwap: () => void;
  selectedModes: TransitMode[];
  onToggleMode: (mode: TransitMode) => void;
  priority: RoutingPriority[];
  onChangePriority: (p: RoutingPriority) => void;
  avoidCrowded: boolean;
  onToggleAvoidCrowded: () => void;
  constraints?: JourneyConstraints;
  onChangeConstraints?: (c: JourneyConstraints) => void;
  constraintsEnabled?: boolean;
  onToggleConstraintsEnabled?: (enabled: boolean) => void;
  onSearch: () => void;
  isLoading: boolean;
  onSelectPreset: (from: string, to: string) => void;
}

// Rich mode icon badges with colors
const MODES: { id: TransitMode; label: string; icon: React.ReactNode; color: string }[] = [
  {
    id: "metro",
    label: "Metro",
    icon: <VehicleIllustration mode="metro" size="xs" />,
    color: "#A7B58A",
  },
  {
    id: "bus",
    label: "Bus",
    icon: <VehicleIllustration mode="bus" size="xs" />,
    color: "#C47A44",
  },
  {
    id: "train",
    label: "Train",
    icon: <VehicleIllustration mode="train" size="xs" />,
    color: "#38BDF8",
  },
  {
    id: "walk",
    label: "Walk",
    icon: <VehicleIllustration mode="walk" size="xs" />,
    color: "#829A86",
  },
];

const PRIORITIES: { id: RoutingPriority; label: string; icon: React.ReactNode; badge: string }[] = [
  { id: "fastest", label: "Fastest", icon: <Clock size={14} />, badge: "Quickest arrival" },
  { id: "cheapest", label: "Cheapest", icon: <span className="mono-symbol">₹</span>, badge: "Lowest fare" },
  { id: "least_transfers", label: "Direct", icon: <ArrowUpDown size={14} />, badge: "Fewer transfers" },
  { id: "eco", label: "Eco", icon: <ShieldAlert size={14} />, badge: "Lower emissions" },
];

const constraintNumberInputStyle: React.CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  padding: "4px 6px",
  borderRadius: "6px",
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  color: "#cbd5e1",
  fontSize: "0.68rem",
  outline: "none",
};

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
  constraints,
  onChangeConstraints,
  constraintsEnabled = true,
  onToggleConstraintsEnabled,
  onSearch,
  isLoading,
  onSelectPreset,
}) => {
  const [originSuggestions, setOriginSuggestions] = useState<StopItem[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<StopItem[]>([]);
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const [showConstraints, setShowConstraints] = useState(false);
  const [blinkingMode, setBlinkingMode] = useState<TransitMode | null>(null);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const originRef = useRef<HTMLDivElement>(null);
  const destRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showOriginDropdown) return;
    const controller = new AbortController();
    const loadSuggestions = async () => {
      try {
        const response = await fetch(
          `/api/v1/stops/search?city=${encodeURIComponent(city.id)}&q=${encodeURIComponent(origin)}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("Stop search failed");
        const data = (await response.json()) as { results?: StopItem[] };
        setOriginSuggestions(data.results || []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setOriginSuggestions([]);
        }
      }
    };
    void loadSuggestions();
    return () => controller.abort();
  }, [origin, city.id, showOriginDropdown]);

  useEffect(() => {
    if (!showDestDropdown) return;
    const controller = new AbortController();
    const loadSuggestions = async () => {
      try {
        const response = await fetch(
          `/api/v1/stops/search?city=${encodeURIComponent(city.id)}&q=${encodeURIComponent(destination)}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("Stop search failed");
        const data = (await response.json()) as { results?: StopItem[] };
        setDestSuggestions(data.results || []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setDestSuggestions([]);
        }
      }
    };
    void loadSuggestions();
    return () => controller.abort();
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

  useEffect(() => () => {
    if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
  }, []);

  const selectMode = (mode: TransitMode) => {
    const isSelected = selectedModes.includes(mode);
    onToggleMode(mode);
    if (!isSelected) {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
      setBlinkingMode(mode);
      blinkTimerRef.current = setTimeout(() => setBlinkingMode(null), 420);
    }
  };

  return (
    <div
      className="search-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        padding: "16px",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        overflowX: "hidden",
        background: "rgba(14, 21, 37, 0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border-glass)",
      }}
    >
      {/* Route Inputs with Swap Button */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "8px", width: "100%", maxWidth: "100%", minWidth: 0 }}>
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
              padding: "10px 42px 10px 14px",
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
              padding: "10px 42px 10px 14px",
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
        <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px", width: "100%", maxWidth: "100%", minWidth: 0, WebkitOverflowScrolling: "touch" }}>
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
<div className="planner-mode-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(70px, 1fr))", gap: "6px" }}>
          {MODES.map((m) => {
            const isSelected = selectedModes.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => selectMode(m.id)}
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
                <span className={blinkingMode === m.id ? "mode-icon-blink" : ""} style={{ color: isSelected ? m.color : "var(--text-muted)" }}>{m.icon}</span>
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "6px", width: "100%", maxWidth: "100%", minWidth: 0 }}>
          {PRIORITIES.map((p) => {
            const isSelected = priority.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => {
                  if (isSelected) {
                    if (priority.length > 1) onChangePriority(p.id);
                    return;
                  }
                  if (priority.length < 2) onChangePriority(p.id);
                }}
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

      
      {/* Hard Constraints & Reliability Preferences */}
      <div
        style={{
          border: constraintsEnabled ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "10px",
          background: constraintsEnabled ? "rgba(56, 189, 248, 0.03)" : "rgba(255, 255, 255, 0.02)",
          overflow: "hidden",
          transition: "all 0.2s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "9px 12px",
            background: "transparent",
            color: "#e2e8f0",
            fontSize: "0.76rem",
            fontWeight: 600,
          }}
        >
          {/* Left: icon + title + toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <div
              onClick={() => setShowConstraints(!showConstraints)}
              style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
            >
              <SlidersHorizontal size={13} color={constraintsEnabled ? "#38bdf8" : "#64748b"} />
              <span style={{ color: constraintsEnabled ? "#e2e8f0" : "#94a3b8" }}>
                Hard Constraints & Deadline
              </span>
            </div>

            {/* Constraint switch */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const nextEnabled = !constraintsEnabled;
                onToggleConstraintsEnabled?.(nextEnabled);
                if (nextEnabled) setShowConstraints(true);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "2px 8px 2px 4px",
                borderRadius: "999px",
                background: constraintsEnabled
                  ? "linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(6, 182, 212, 0.2))"
                  : "rgba(255, 255, 255, 0.08)",
                border: constraintsEnabled
                  ? "1px solid rgba(16, 185, 129, 0.5)"
                  : "1px solid rgba(255, 255, 255, 0.15)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              title={constraintsEnabled ? "Constraints are on — click to turn off" : "Constraints are off — click to turn on"}
              aria-label="Toggle hard constraints on or off"
            >
              <span
                style={{
                  width: "11px",
                  height: "11px",
                  borderRadius: "50%",
                  background: constraintsEnabled ? "#10b981" : "#64748b",
                  boxShadow: constraintsEnabled ? "0 0 6px #10b981" : "none",
                  transition: "all 0.2s ease",
                }}
              />
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: constraintsEnabled ? "#34d399" : "#94a3b8",
                }}
              >
                {constraintsEnabled ? "On" : "Off"}
              </span>
            </button>

            {constraintsEnabled && constraints && (constraints.maxBudget || constraints.maxWalkingDistanceMeters || constraints.maxTransfers !== undefined || constraints.requiredArrivalTime) ? (
              <span style={{ fontSize: "0.62rem", background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", padding: "1px 6px", borderRadius: "999px" }}>
                Active
              </span>
            ) : null}
          </div>

          {/* Right: Expand / Collapse button */}
          <button
            type="button"
            onClick={() => setShowConstraints(!showConstraints)}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              fontSize: "0.7rem",
              cursor: "pointer",
              padding: "4px 6px",
            }}
          >
            {showConstraints ? "▲ Hide" : "▼ Configure"}
          </button>
        </div>

        {showConstraints && (
          <div
            style={{
              padding: "10px 12px 14px",
              borderTop: "1px solid rgba(255, 255, 255, 0.06)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              background: "rgba(10, 16, 30, 0.6)",
            }}
          >
            {/* Notice if constraints are off */}
            {!constraintsEnabled && (
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: "6px",
                  background: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  color: "#fbbf24",
                  fontSize: "0.72rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <span>Constraints are currently <strong>off</strong>. Turn on to enforce them in route planning.</span>
                <button
                  type="button"
                  onClick={() => onToggleConstraintsEnabled?.(true)}
                  style={{
                    background: "linear-gradient(135deg, #10b981, #06b6d4)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "4px",
                    padding: "3px 8px",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Turn on
                </button>
              </div>
            )}

            {/* Arrival Deadline */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                  <Clock size={11} color="#60a5fa" /> Must Arrive Before:
                </span>
                {constraints?.requiredArrivalTime ? (
                  <button
                    type="button"
                    onClick={() => onChangeConstraints?.({ ...constraints, requiredArrivalTime: undefined })}
                    style={{ fontSize: "0.62rem", background: "none", border: "none", color: "#f87171", cursor: "pointer" }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <input
                type="time"
                min="00:00"
                max="23:59"
                step={60}
                value={constraints?.requiredArrivalTime || ""}
                onChange={(e) => {
                  const parts = e.target.value.split(":");
                  if (parts.length < 2) {
                    onChangeConstraints?.({ ...constraints, requiredArrivalTime: undefined });
                    return;
                  }
                  const hours = Math.min(23, Math.max(0, Number(parts[0]) || 0));
                  const minutes = Math.min(59, Math.max(0, Number(parts[1]) || 0));
                  const seconds = parts[2] === undefined
                    ? undefined
                    : Math.min(59, Math.max(0, Number(parts[2]) || 0));
                  const formatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}${seconds === undefined ? "" : `:${String(seconds).padStart(2, "0")}`}`;
                  onChangeConstraints?.({ ...constraints, requiredArrivalTime: formatted });
                }}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#f8fafc",
                  fontSize: "0.75rem",
                  outline: "none",
                }}
              />
            </div>

            {/* Max Budget */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600 }}>
                  💰 Maximum Fare Budget:
                </span>
                <span style={{ fontSize: "0.68rem", color: "#34d399", fontWeight: 700 }}>
                  {constraints?.maxBudget ? `₹${constraints.maxBudget}` : "No limit"}
                </span>
              </div>
              <div style={{ display: "flex", gap: "5px" }}>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Custom"
                  value={constraints?.maxBudget ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    onChangeConstraints?.({ ...constraints, maxBudget: value === "" ? undefined : Math.max(0, Number(value)) });
                  }}
                  aria-label="Custom maximum fare budget"
                  style={{ ...constraintNumberInputStyle, borderColor: constraints?.maxBudget !== undefined ? "#34d399" : "rgba(255, 255, 255, 0.08)" }}
                />
                {[20, 30, 40, 50].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => onChangeConstraints?.({ ...constraints, maxBudget: b })}
                    style={{
                      flex: 1,
                      padding: "4px 0",
                      borderRadius: "6px",
                      fontSize: "0.68rem",
                      background: constraints?.maxBudget === b ? "rgba(52, 211, 153, 0.2)" : "rgba(255, 255, 255, 0.04)",
                      border: constraints?.maxBudget === b ? "1px solid #34d399" : "1px solid rgba(255, 255, 255, 0.08)",
                      color: constraints?.maxBudget === b ? "#34d399" : "#cbd5e1",
                      cursor: "pointer",
                      fontWeight: constraints?.maxBudget === b ? 700 : 400,
                    }}
                  >
                    ₹{b}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Walking Distance */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600 }}>
                  Walking limit:
                </span>
                <span style={{ fontSize: "0.68rem", color: "#38bdf8", fontWeight: 700 }}>
                  {constraints?.maxWalkingDistanceMeters ? `${constraints.maxWalkingDistanceMeters}m` : "No limit"}
                </span>
              </div>
              <div style={{ display: "flex", gap: "5px" }}>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Custom"
                  value={constraints?.maxWalkingDistanceMeters ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    onChangeConstraints?.({ ...constraints, maxWalkingDistanceMeters: value === "" ? undefined : Math.max(0, Number(value)) });
                  }}
                  aria-label="Custom walking distance limit"
                  style={{ ...constraintNumberInputStyle, borderColor: constraints?.maxWalkingDistanceMeters !== undefined ? "#38bdf8" : "rgba(255, 255, 255, 0.08)" }}
                />
                {[300, 500, 800, 1500].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => onChangeConstraints?.({ ...constraints, maxWalkingDistanceMeters: w })}
                    style={{
                      flex: 1,
                      padding: "4px 0",
                      borderRadius: "6px",
                      fontSize: "0.68rem",
                      background: constraints?.maxWalkingDistanceMeters === w ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.04)",
                      border: constraints?.maxWalkingDistanceMeters === w ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.08)",
                      color: constraints?.maxWalkingDistanceMeters === w ? "#38bdf8" : "#cbd5e1",
                      cursor: "pointer",
                      fontWeight: constraints?.maxWalkingDistanceMeters === w ? 700 : 400,
                    }}
                  >
                    {w}m
                  </button>
                ))}
              </div>
            </div>

            {/* Max Transfers */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600 }}>
                  🔄 Transfer Preference:
                </span>
                <span style={{ fontSize: "0.68rem", color: "#fbbf24", fontWeight: 700 }}>
                  {constraints?.maxTransfers === 0 ? "Direct only (0)" : constraints?.maxTransfers === 1 ? "Max 1 interchange" : "Any interchanges"}
                </span>
              </div>
              <div style={{ display: "flex", gap: "5px" }}>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Custom"
                  value={constraints?.maxTransfers ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    onChangeConstraints?.({ ...constraints, maxTransfers: value === "" ? undefined : Math.max(0, Number(value)) });
                  }}
                  aria-label="Custom maximum transfers"
                  style={{ ...constraintNumberInputStyle, borderColor: constraints?.maxTransfers !== undefined ? "#fbbf24" : "rgba(255, 255, 255, 0.08)" }}
                />
                {[0, 1, 2].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onChangeConstraints?.({ ...constraints, maxTransfers: t })}
                    style={{
                      flex: 1,
                      padding: "4px 0",
                      borderRadius: "6px",
                      fontSize: "0.68rem",
                      background: constraints?.maxTransfers === t ? "rgba(251, 191, 36, 0.2)" : "rgba(255, 255, 255, 0.04)",
                      border: constraints?.maxTransfers === t ? "1px solid #fbbf24" : "1px solid rgba(255, 255, 255, 0.08)",
                      color: constraints?.maxTransfers === t ? "#fbbf24" : "#cbd5e1",
                      cursor: "pointer",
                      fontWeight: constraints?.maxTransfers === t ? 700 : 400,
                    }}
                  >
                    {t === 0 ? "Direct" : `≤ ${t}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
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
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          padding: "13px 16px",
          borderRadius: "10px",
          background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
          border: "none",
          color: "#ffffff",
          fontSize: "0.9rem",
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
        <Search size={16} style={{ flexShrink: 0, color: "#ffffff" }} />
        <span style={{ color: "#ffffff", fontWeight: 700, fontSize: "0.88rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {isLoading ? "Finding Routes..." : "Find Best Routes"}
        </span>
      </button>
    </div>
  );
};
