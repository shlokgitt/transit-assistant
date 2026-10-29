import React from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Lock, Eye, HardDrive, RefreshCw } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for TransitSaathi — Smart Multimodal Route Planner for Delhi NCR.",
};

export default function PrivacyPolicyPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at 50% 0%, #0d1b38 0%, #04060f 100%)",
        color: "#f1f5f9",
        padding: "32px 20px 60px",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: "780px", margin: "0 auto" }}>
        {/* Back Link */}
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "#60a5fa",
            fontSize: "0.85rem",
            textDecoration: "none",
            marginBottom: "24px",
          }}
        >
          <ArrowLeft size={16} /> Back to Route Planner
        </Link>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(59, 130, 246, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(59, 130, 246, 0.4)",
            }}
          >
            <Shield size={20} color="#38bdf8" />
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, color: "#ffffff" }}>
            Privacy Policy
          </h1>
        </div>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "32px" }}>
          Effective Date: October 29, 2026 • TransitSaathi — Delhi NCR Multimodal Mobility
        </p>

        {/* Content Card */}
        <div
          style={{
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "16px",
            padding: "28px 24px",
            lineHeight: 1.65,
            fontSize: "0.9rem",
            color: "#cbd5e1",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          <section>
            <h2 style={{ fontSize: "1.1rem", color: "#f8fafc", margin: "0 0 8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Eye size={16} color="#06b6d4" /> 1. Information We Collect
            </h2>
            <p style={{ margin: 0 }}>
              TransitSaathi is built with privacy-first principles. We do not require account creation, passwords, or personal identity numbers. The information processed includes:
            </p>
            <ul style={{ paddingLeft: "20px", marginTop: "8px", marginBottom: 0 }}>
              <li><strong>Transit Search Queries:</strong> Origin and destination station queries entered into the route planner.</li>
              <li><strong>Saved Journey Alerts:</strong> If you opt-in to journey disruption alerts, your chosen email and route endpoints are stored to transmit transit updates.</li>
              <li><strong>Device Telemetry:</strong> Anonymized client IDs generated locally to persist favorites without storing personal identities.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: "1.1rem", color: "#f8fafc", margin: "0 0 8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <HardDrive size={16} color="#10b981" /> 2. Local Storage Usage
            </h2>
            <p style={{ margin: 0 }}>
              We store saved itineraries, recent searches, and UI theme preferences directly inside your browser&apos;s <code>localStorage</code>. This data never leaves your device unless you explicitly click &ldquo;Save Journey with Email Alerts&rdquo;.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "1.1rem", color: "#f8fafc", margin: "0 0 8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Lock size={16} color="#f59e0b" /> 3. Data Protection & Security
            </h2>
            <p style={{ margin: 0 }}>
              All network communications are secured using modern Transport Layer Security (TLS/HTTPS). Server endpoints adhere to strict HTTP Strict Transport Security (HSTS) headers, X-Frame-Options, and X-Content-Type protections. We never sell or share search history with commercial advertisers.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "1.1rem", color: "#f8fafc", margin: "0 0 8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <RefreshCw size={16} color="#a78bfa" /> 4. Third-Party Transit Providers
            </h2>
            <p style={{ margin: 0 }}>
              Transit route calculations utilize open static data published by the Delhi Transport Corporation (DTC), Delhi Metro Rail Corporation (DMRC), Noida Metro Rail Corporation (NMRC), and OpenStreetMap cartography. Maps are rendered via Leaflet / OpenStreetMap tile servers subject to their respective open data terms.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "1.1rem", color: "#f8fafc", margin: "0 0 8px" }}>
              5. Contact & Data Deletion
            </h2>
            <p style={{ margin: 0 }}>
              You may clear all stored route history at any time by clearing your browser cache and local storage, or clicking &ldquo;Remove&rdquo; on any saved journey card. For academic inquiries regarding TransitSaathi, reach out to the project repository.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
