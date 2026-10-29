"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";

export const CookieConsent: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem("transitsaathi_cookie_consent");
      if (!consent) {
        // Small delay so it smoothly floats in
        const timer = setTimeout(() => setIsVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore storage errors in privacy mode
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem("transitsaathi_cookie_consent", "accepted");
    } catch {}
    setIsVisible(false);
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem("transitsaathi_cookie_consent", "dismissed");
    } catch {}
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Cookie consent banner"
      style={{
        position: "fixed",
        bottom: "16px",
        left: "16px",
        right: "16px",
        maxWidth: "500px",
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.95)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(59, 130, 246, 0.3)",
        borderRadius: "12px",
        padding: "14px 16px",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(59, 130, 246, 0.15)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        color: "#cbd5e1",
        fontSize: "0.82rem",
        animation: "fadeIn 0.3s ease-out",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#f8fafc", fontWeight: 600 }}>
          <Cookie size={16} color="#f59e0b" />
          <span>Privacy & Cookie Preferences</span>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Close cookie banner"
          style={{
            background: "transparent",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            padding: "2px",
          }}
        >
          <X size={14} />
        </button>
      </div>

      <p style={{ margin: 0, lineHeight: 1.4, color: "#94a3b8" }}>
        Transit Route uses browser local storage to save your recent route searches, favorite stations, and user preferences locally on your device. We do not sell your personal data. Read our{" "}
        <Link href="/privacy" style={{ color: "#38bdf8", textDecoration: "underline" }}>
          Privacy Policy
        </Link>
        .
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
        <button
          onClick={handleDismiss}
          style={{
            padding: "5px 12px",
            borderRadius: "6px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "#cbd5e1",
            fontSize: "0.75rem",
            cursor: "pointer",
          }}
        >
          Essential Only
        </button>
        <button
          onClick={handleAccept}
          style={{
            padding: "5px 14px",
            borderRadius: "6px",
            background: "linear-gradient(135deg, #2563eb, #06b6d4)",
            border: "none",
            color: "#ffffff",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
          }}
        >
          Accept & Continue
        </button>
      </div>
    </aside>
  );
};
