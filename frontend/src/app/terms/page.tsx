import React from "react";
import Link from "next/link";
import { ArrowLeft, FileText, CheckCircle2, AlertTriangle, Scale } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Terms and Conditions of Service for Transit Route — Delhi NCR Multimodal Mobility.",
};

export default function TermsPage() {
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
              background: "rgba(6, 182, 212, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(6, 182, 212, 0.4)",
            }}
          >
            <FileText size={20} color="#06b6d4" />
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, color: "#ffffff" }}>
            Terms &amp; Conditions
          </h1>
        </div>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "32px" }}>
          Last Updated: October 29, 2026 • Transit Route — Delhi NCR Multimodal Mobility
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
              <Scale size={16} color="#3b82f6" /> 1. Nature of the Service
            </h2>
            <p style={{ margin: 0 }}>
              Transit Route is a multimodal route planning and passenger assistance tool developed for educational, techfest demonstration, and informational navigation purposes across Delhi National Capital Region (NCR). The system plans itineraries across Delhi Metro, DTC public buses, auto-rickshaws, and walking connectors.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "1.1rem", color: "#f8fafc", margin: "0 0 8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckCircle2 size={16} color="#10b981" /> 2. Fares &amp; Schedule Accuracy
            </h2>
            <ul style={{ paddingLeft: "20px", marginTop: "8px", marginBottom: 0 }}>
              <li><strong>Metro Fares:</strong> Derived from official DMRC station-to-station distance slabs and published Airport Express / Aqua Line fare tables.</li>
              <li><strong>Bus Fares:</strong> Based on official Delhi Government DTC distance bands (₹5, ₹10, ₹15 for ordinary services).</li>
              <li><strong>Auto-rickshaw Fares:</strong> Computed using the statutory Delhi Transport Department meter rate (₹30 for the first 1.5 km, ₹10 per km thereafter). Actual street auto drivers may quote flat or negotiated fares.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: "1.1rem", color: "#f8fafc", margin: "0 0 8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertTriangle size={16} color="#f59e0b" /> 3. Real-Time Transit Disclaimers
            </h2>
            <p style={{ margin: 0 }}>
              While Transit Route incorporates live delay simulations and crowd modeling, public transit conditions in Delhi NCR can fluctuate due to weather, traffic bottlenecks, festival diversions, or emergency operational suspensions. Commuters are advised to factor in safety margins for airport or railway connections.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "1.1rem", color: "#f8fafc", margin: "0 0 8px" }}>
              4. Intellectual Property &amp; Open Data
            </h2>
            <p style={{ margin: 0 }}>
              Public transit schedule and routing data are provided courtesy of Delhi Open Data / GTFS initiatives and OpenStreetMap contributors under Open Database License (ODbL). Transit Route makes no claim of ownership over official transit authority marks or municipal emblems.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
