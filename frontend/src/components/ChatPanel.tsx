"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, RotateCcw, MapPin, Clock, Wallet, Footprints, ChevronRight } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RouteLeg {
  mode: string;
  route?: string;
  from: string;
  to: string;
  minutes: number;
  distanceKm?: number;
  fare?: number | null;
  stops?: number;
}

interface RouteResult {
  totalMinutes?: number;
  totalFare?: number | null;
  totalDistanceKm?: number;
  fareStatus?: string;
  fareEstimate?: boolean;
  legs?: RouteLeg[];
  error?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  routeResult?: RouteResult | null;
  timestamp: number;
}

interface ChatApiResponse {
  response: string | null;
  intent: string | null;
  routeResult: RouteResult | null;
  error?: string;
}

interface ChatPanelProps {
  onPlanRoute?: (from: string, to: string) => void;
  initialPrompt?: string;
  onInitialPromptHandled?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Mode helpers                                                       */
/* ------------------------------------------------------------------ */

const MODE_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  metro: { emoji: "🚇", color: "#3b82f6", label: "Metro" },
  bus: { emoji: "🚌", color: "#10b981", label: "Bus" },
  walk: { emoji: "🚶", color: "#06b6d4", label: "Walk" },
  auto: { emoji: "🛺", color: "#f59e0b", label: "Auto" },
  cab: { emoji: "🚖", color: "#a78bfa", label: "Cab" },
};

function getModeConfig(mode: string) {
  return MODE_CONFIG[mode] || { emoji: "🔹", color: "#94a3b8", label: mode };
}

/* ------------------------------------------------------------------ */
/*  Subcomponents                                                      */
/* ------------------------------------------------------------------ */

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "12px 16px" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: "#60a5fa",
            animation: `chatDotBounce 1.4s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function RouteResultCard({ route, onViewRoute }: { route: RouteResult; onViewRoute?: () => void }) {
  if (route.error) {
    return (
      <div style={{
        marginTop: "8px",
        padding: "10px 12px",
        borderRadius: "10px",
        background: "rgba(244, 63, 94, 0.1)",
        border: "1px solid rgba(244, 63, 94, 0.25)",
        fontSize: "0.78rem",
        color: "#fca5a5",
      }}>
        ⚠️ {route.error}
      </div>
    );
  }

  const legs = route.legs || [];

  return (
    <div style={{
      marginTop: "8px",
      padding: "12px",
      borderRadius: "12px",
      background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(6,182,212,0.05))",
      border: "1px solid rgba(59,130,246,0.2)",
    }}>
      {/* Summary row */}
      <div style={{
        display: "flex",
        gap: "16px",
        marginBottom: "10px",
        flexWrap: "wrap",
      }}>
        {route.totalMinutes != null && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.78rem" }}>
            <Clock size={13} color="#60a5fa" />
            <span style={{ color: "#93c5fd", fontWeight: 700 }}>{route.totalMinutes} min</span>
          </div>
        )}
        {route.totalFare != null && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.78rem" }}>
            <Wallet size={13} color="#34d399" />
            <span style={{ color: "#86efac", fontWeight: 700 }}>
              ₹{route.totalFare}
              {route.fareEstimate && (
                <span style={{ fontSize: "0.65rem", color: "#f59e0b", marginLeft: "3px" }}>est.</span>
              )}
            </span>
          </div>
        )}
        {route.totalDistanceKm != null && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.78rem" }}>
            <Footprints size={13} color="#c084fc" />
            <span style={{ color: "#d8b4fe", fontWeight: 700 }}>{route.totalDistanceKm} km</span>
          </div>
        )}
      </div>

      {/* Mode pills summary */}
      {legs.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "10px", flexWrap: "wrap" }}>
          {legs.map((leg, i) => {
            const cfg = getModeConfig(leg.mode);
            return (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight size={10} color="#475569" />}
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  padding: "2px 7px",
                  borderRadius: "6px",
                  background: `${cfg.color}18`,
                  border: `1px solid ${cfg.color}40`,
                  fontSize: "0.68rem",
                  fontWeight: 600,
                  color: cfg.color,
                }}>
                  <span>{cfg.emoji}</span>
                  {leg.route?.replace(/^metro:/, "") || cfg.label}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Leg details */}
      {legs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {legs.map((leg, i) => {
            const cfg = getModeConfig(leg.mode);
            return (
              <div key={i} style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                fontSize: "0.75rem",
                color: "#cbd5e1",
              }}>
                <span style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "6px",
                  background: `${cfg.color}22`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  flexShrink: 0,
                  marginTop: "1px",
                }}>
                  {cfg.emoji}
                </span>
                <div style={{ flex: 1, lineHeight: 1.45 }}>
                  <span style={{ fontWeight: 600, color: "#f1f5f9" }}>{leg.from}</span>
                  <span style={{ color: "#64748b" }}> → </span>
                  <span style={{ fontWeight: 600, color: "#f1f5f9" }}>{leg.to}</span>
                  <div style={{ color: "#64748b", fontSize: "0.7rem", marginTop: "1px" }}>
                    {leg.minutes} min
                    {leg.stops != null && leg.stops > 0 && ` · ${leg.stops} stops`}
                    {leg.fare != null && ` · ₹${leg.fare}`}
                    {leg.distanceKm != null && ` · ${leg.distanceKm} km`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View on map action */}
      {onViewRoute && legs.length > 0 && (
        <button
          onClick={onViewRoute}
          style={{
            marginTop: "10px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            padding: "6px 12px",
            borderRadius: "8px",
            background: "rgba(59,130,246,0.15)",
            border: "1px solid rgba(59,130,246,0.3)",
            color: "#60a5fa",
            fontSize: "0.73rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
            width: "100%",
            justifyContent: "center",
          }}
        >
          <MapPin size={12} />
          View in Route Planner
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Suggested prompts                                                  */
/* ------------------------------------------------------------------ */

const SUGGESTED_PROMPTS = [
  "Find the cheapest route from Karol Bagh to Gandhi Darshan",
  "What's the fastest metro route to Rajiv Chowk?",
  "How much will a trip from Kashmere Gate to Hauz Khas cost?",
  "Can I walk from Connaught Place to India Gate?",
];

/* ------------------------------------------------------------------ */
/*  Main ChatPanel component                                           */
/* ------------------------------------------------------------------ */

export const ChatPanel: React.FC<ChatPanelProps> = ({
  onPlanRoute,
  initialPrompt,
  onInitialPromptHandled,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setError(null);

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);

      try {
        // Build conversation history for context
        const conversationHistory = messages.slice(-20).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("/api/v1/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            conversationHistory,
          }),
        });

        const data = (await res.json()) as ChatApiResponse;

        if (!res.ok || data.error) {
          throw new Error(data.error || `Request failed (${res.status})`);
        }

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.response || "I couldn't generate a response.",
          routeResult: data.routeResult,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        const errMsg =
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.";
        setError(errMsg);

        // Add error as assistant message for conversation flow
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `⚠️ ${errMsg}`,
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const handleRetry = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      // Remove the error message
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("error-")));
      void sendMessage(lastUserMsg.content);
    }
  };

  useEffect(() => {
    if (!initialPrompt) return;

    setIsOpen(true);
    void sendMessage(initialPrompt);
    onInitialPromptHandled?.();
  }, [initialPrompt, onInitialPromptHandled, sendMessage]);

  const handleViewRoute = (route: RouteResult) => {
    if (!onPlanRoute || !route.legs?.length) return;
    const from = route.legs[0].from;
    const to = route.legs[route.legs.length - 1].to;
    onPlanRoute(from, to);
  };

  return (
    <>
      {/* ---- Floating Action Button ---- */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close Transit Route assistant" : "Open Transit Route assistant"}
        className="chat-fab"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 1000,
          width: "56px",
          height: "56px",
          borderRadius: "16px",
          border: "1px solid rgba(59,130,246,0.4)",
          background: isOpen
            ? "rgba(30,41,59,0.95)"
            : "linear-gradient(135deg, #1d4ed8 0%, #0891b2 100%)",
          color: "#ffffff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: isOpen
            ? "0 4px 20px rgba(0,0,0,0.5)"
            : "0 4px 25px rgba(37,99,235,0.5), 0 0 40px rgba(59,130,246,0.15)",
          transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* ---- Chat Panel Overlay ---- */}
      <div
        className="chat-panel-container"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "420px",
          maxWidth: "100vw",
          zIndex: 999,
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
          display: "flex",
          flexDirection: "column",
          background: "rgba(7, 10, 19, 0.97)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(24px)",
          boxShadow: isOpen ? "-8px 0 40px rgba(0,0,0,0.5)" : "none",
        }}
      >
        {/* ---- Header ---- */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(14, 21, 37, 0.8)",
          backdropFilter: "blur(12px)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "34px",
              height: "34px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #1d4ed8, #0891b2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 15px rgba(59,130,246,0.4)",
            }}>
              <MessageCircle size={16} color="#fff" />
            </div>
            <div>
              <h3 style={{
                fontSize: "0.92rem",
                fontWeight: 800,
                background: "linear-gradient(90deg, #fff 0%, #93c5fd 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                lineHeight: 1.2,
              }}>
                Transit Route AI
              </h3>
              <p style={{ fontSize: "0.65rem", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: "#10b981",
                  boxShadow: "0 0 6px #10b981",
                  display: "inline-block",
                }} />
                Powered by real route data
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close chat"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#94a3b8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ---- Messages Area ---- */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}>
          {/* Welcome state */}
          {messages.length === 0 && !isLoading && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              textAlign: "center",
              padding: "20px",
            }}>
              <div style={{
                width: "60px",
                height: "60px",
                borderRadius: "16px",
                background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(6,182,212,0.15))",
                border: "1px solid rgba(59,130,246,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}>
                <MessageCircle size={28} color="#60a5fa" />
              </div>
              <h4 style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "#f1f5f9",
                marginBottom: "6px",
              }}>
                Ask Transit Route AI
              </h4>
              <p style={{
                fontSize: "0.78rem",
                color: "#64748b",
                lineHeight: 1.5,
                maxWidth: "280px",
                marginBottom: "20px",
              }}>
                I can plan routes, explain fares, suggest alternatives, and answer questions about Delhi NCR transit.
              </p>

              {/* Suggested prompts */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
                <span style={{ fontSize: "0.68rem", color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                  Try asking
                </span>
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => void sendMessage(prompt)}
                    style={{
                      padding: "9px 14px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      color: "#94a3b8",
                      fontSize: "0.77rem",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      lineHeight: 1.4,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(59,130,246,0.1)";
                      e.currentTarget.style.borderColor = "rgba(59,130,246,0.25)";
                      e.currentTarget.style.color = "#93c5fd";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                      e.currentTarget.style.color = "#94a3b8";
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                animation: "chatSlideIn 0.25s ease-out",
              }}
            >
              <div style={{
                maxWidth: "88%",
                padding: "10px 14px",
                borderRadius: msg.role === "user"
                  ? "14px 14px 4px 14px"
                  : "14px 14px 14px 4px",
                background: msg.role === "user"
                  ? "linear-gradient(135deg, #1d4ed8, #0e7490)"
                  : "rgba(30, 41, 59, 0.8)",
                border: msg.role === "user"
                  ? "1px solid rgba(59,130,246,0.3)"
                  : "1px solid rgba(255,255,255,0.07)",
                color: msg.role === "user" ? "#e0f2fe" : "#cbd5e1",
                fontSize: "0.82rem",
                lineHeight: 1.55,
                wordBreak: "break-word",
              }}>
                {/* Render message content with line breaks */}
                {msg.content.split("\n").map((line, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <br />}
                    {line}
                  </React.Fragment>
                ))}

                {/* Route result card */}
                {msg.routeResult && (
                  <RouteResultCard
                    route={msg.routeResult}
                    onViewRoute={
                      onPlanRoute
                        ? () => handleViewRoute(msg.routeResult!)
                        : undefined
                    }
                  />
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div style={{
              display: "flex",
              justifyContent: "flex-start",
              animation: "chatSlideIn 0.25s ease-out",
            }}>
              <div style={{
                padding: "6px 10px",
                borderRadius: "14px 14px 14px 4px",
                background: "rgba(30, 41, 59, 0.8)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}>
                <TypingIndicator />
              </div>
            </div>
          )}

          {/* Error retry */}
          {error && !isLoading && (
            <div style={{
              display: "flex",
              justifyContent: "center",
            }}>
              <button
                onClick={handleRetry}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  background: "rgba(244, 63, 94, 0.1)",
                  border: "1px solid rgba(244, 63, 94, 0.25)",
                  color: "#fca5a5",
                  fontSize: "0.73rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <RotateCcw size={12} />
                Retry
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ---- Input Area ---- */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "14px 16px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(14, 21, 37, 0.8)",
            flexShrink: 0,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about routes, fares, transit..."
            disabled={isLoading}
            maxLength={2000}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: "10px",
              background: "rgba(23, 34, 58, 0.7)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#f1f5f9",
              fontSize: "0.83rem",
              outline: "none",
              transition: "border-color 0.15s ease",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(59,130,246,0.4)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: input.trim() && !isLoading
                ? "linear-gradient(135deg, #1d4ed8, #0891b2)"
                : "rgba(30,41,59,0.5)",
              border: "none",
              color: input.trim() && !isLoading ? "#fff" : "#475569",
              cursor: input.trim() && !isLoading ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
              flexShrink: 0,
            }}
          >
            {isLoading ? <Loader2 size={16} className="chat-spinner" /> : <Send size={16} />}
          </button>
        </form>
      </div>
    </>
  );
};
