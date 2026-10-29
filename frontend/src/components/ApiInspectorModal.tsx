"use client";

import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  Code2,
  Terminal,
  FileJson,
  Layers,
  ArrowRight,
} from "lucide-react";
import { RoutePlanRequest, RoutePlanResponse } from "@/types/transit";

interface ApiInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastRequest: RoutePlanRequest | null;
  lastResponse: RoutePlanResponse | null;
}

export const ApiInspectorModal: React.FC<ApiInspectorModalProps> = ({
  isOpen,
  onClose,
  lastRequest,
  lastResponse,
}) => {
  const [activeTab, setActiveTab] = useState<"response" | "request" | "curl">("response");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const curlCommand = `curl -X POST https://api.transitroute.io/api/v1/routes/plan \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(lastRequest, null, 2)}'`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          maxWidth: "760px",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          background: "#0d1322",
          border: "1px solid rgba(59, 130, 246, 0.3)",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(59, 130, 246, 0.2)",
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
            background: "rgba(15, 23, 42, 0.6)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "rgba(59, 130, 246, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#60a5fa",
              }}
            >
              <Code2 size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff" }}>
                API Contract & Response Inspector
              </h2>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                Complies with OpenAPI v1.0 multimodal transit specification
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

        {/* Tab Navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setActiveTab("response")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: activeTab === "response" ? "rgba(59, 130, 246, 0.2)" : "transparent",
                color: activeTab === "response" ? "#60a5fa" : "var(--text-secondary)",
              }}
            >
              <FileJson size={14} />
              <span>Response Payload ({lastResponse?.routes.length || 0} Routes)</span>
            </button>

            <button
              onClick={() => setActiveTab("request")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: activeTab === "request" ? "rgba(59, 130, 246, 0.2)" : "transparent",
                color: activeTab === "request" ? "#60a5fa" : "var(--text-secondary)",
              }}
            >
              <FileJson size={14} />
              <span>Request Body</span>
            </button>

            <button
              onClick={() => setActiveTab("curl")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: activeTab === "curl" ? "rgba(59, 130, 246, 0.2)" : "transparent",
                color: activeTab === "curl" ? "#60a5fa" : "var(--text-secondary)",
              }}
            >
              <Terminal size={14} />
              <span>cURL Snippet</span>
            </button>
          </div>

          <button
            onClick={() => {
              const text =
                activeTab === "curl"
                  ? curlCommand
                  : activeTab === "request"
                  ? JSON.stringify(lastRequest, null, 2)
                  : JSON.stringify(lastResponse, null, 2);
              copyToClipboard(text);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 12px",
              borderRadius: "6px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: copied ? "#34d399" : "#ffffff",
              fontSize: "0.72rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? "Copied!" : "Copy JSON"}</span>
          </button>
        </div>

        {/* Code Content Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px", background: "#080c16" }}>
          <pre
            style={{
              fontSize: "0.75rem",
              lineHeight: 1.5,
              color: "#38bdf8",
              fontFamily: "var(--font-mono)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {activeTab === "curl"
              ? curlCommand
              : activeTab === "request"
              ? JSON.stringify(lastRequest, null, 2)
              : JSON.stringify(lastResponse, null, 2)}
          </pre>
        </div>

        {/* Footer info */}
        <div
          style={{
            padding: "10px 20px",
            background: "rgba(10, 15, 29, 0.8)",
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.7rem",
            color: "var(--text-muted)",
          }}
        >
          <span>Contract specification: API_CONTRACT.md in repository root</span>
          <span style={{ color: "#34d399" }}>HTTP Status: 200 OK</span>
        </div>
      </div>
    </div>
  );
};
