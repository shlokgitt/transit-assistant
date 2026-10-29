import React from "react";
import Link from "next/link";
import { Compass, Home, MapPin } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 — Station Not Found",
  description: "The page or station you were looking for is not on the TransitSaathi network.",
};

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at 50% 30%, #0f2347 0%, #04060f 100%)",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          textAlign: "center",
          background: "rgba(15, 23, 42, 0.8)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(59, 130, 246, 0.25)",
          borderRadius: "20px",
          padding: "40px 28px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(59, 130, 246, 0.15)",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "18px",
            background: "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(6, 182, 212, 0.2))",
            border: "1px solid rgba(59, 130, 246, 0.4)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "20px",
          }}
        >
          <Compass size={32} color="#38bdf8" />
        </div>

        <div style={{ fontSize: "3rem", fontWeight: 800, color: "#38bdf8", lineHeight: 1, marginBottom: "8px" }}>
          404
        </div>

        <h1 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 10px", color: "#f8fafc" }}>
          Destination Off the Transit Map
        </h1>

        <p style={{ color: "#94a3b8", fontSize: "0.85rem", lineHeight: 1.6, margin: "0 0 24px" }}>
          The station, terminal, or URL you requested is not currently part of the Delhi NCR transit network. Let&apos;s get your journey back on schedule.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "12px 20px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #2563eb, #06b6d4)",
              color: "#ffffff",
              fontSize: "0.88rem",
              fontWeight: 600,
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
            }}
          >
            <Home size={16} /> Return to Route Planner
          </Link>

          <Link
            href="/?preset=cp_noida"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "10px 18px",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              color: "#94a3b8",
              fontSize: "0.82rem",
              textDecoration: "none",
            }}
          >
            <MapPin size={14} /> Plan popular CP ➔ Noida route
          </Link>
        </div>
      </div>
    </main>
  );
}
