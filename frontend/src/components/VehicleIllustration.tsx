"use client";

import React from "react";
import { BusFront, CarFront, Footprints, TrainFront } from "lucide-react";
import { TransitMode } from "@/types/transit";

type VehicleIllustrationProps = {
  mode: TransitMode;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
};

const MODE_META: Record<TransitMode, { label: string; accent: string }> = {
  bus: { label: "Bus", accent: "#C47A44" },
  metro: { label: "Metro", accent: "#A7B58A" },
  cab: { label: "Cab", accent: "#B8ADA0" },
  auto: { label: "Auto", accent: "#D2A85A" },
  walk: { label: "Walk", accent: "#829A86" },
};

const ICONS: Record<TransitMode, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  bus: BusFront,
  metro: TrainFront,
  cab: CarFront,
  auto: CarFront,
  walk: Footprints,
};

const ASSETS: Partial<Record<TransitMode, string>> = {
  bus: "/transport/user-bus.png",
  metro: "/transport/user-metro.png",
  cab: "/transport/user-car.png",
  auto: "/transport/user-car.png",
  walk: "/transport/delhi-walk.webp",
};

export function VehicleIllustration({ mode, size = "md", className }: VehicleIllustrationProps) {
  const meta = MODE_META[mode];
  const Icon = ICONS[mode];
  const dimension = size === "lg" ? 92 : size === "md" ? 62 : size === "sm" ? 42 : 22;

  return (
    <span
      className={`vehicle-illustration vehicle-illustration-${size} ${className || ""}`}
      style={{ "--vehicle-accent": meta.accent, width: dimension, height: dimension } as React.CSSProperties}
      role="img"
      aria-label={meta.label}
    >
      <span className="vehicle-illustration-shadow" />
      <span className="vehicle-illustration-body">
        {ASSETS[mode] ? (
          <img src={ASSETS[mode]} alt="" aria-hidden="true" />
        ) : (
          <Icon size={dimension * 0.52} strokeWidth={1.5} />
        )}
      </span>
    </span>
  );
}
