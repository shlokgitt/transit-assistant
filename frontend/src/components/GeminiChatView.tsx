"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Plus,
  Send,
  Compass,
  Clock,
  BookOpen,
  FolderKanban,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ChevronDown,
  RotateCcw,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  MapPin,
  Train,
  Bus,
  Footprints,
  Car,
  ChevronRight,
  ShieldCheck,
  SquarePen,
  Search,
  ExternalLink,
} from "lucide-react";
import { VehicleIllustration } from "@/components/VehicleIllustration";

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

interface GeminiChatViewProps {
  onPlanRoute?: (from: string, to: string) => void;
  initialPrompt?: string;
  onInitialPromptHandled?: () => void;
  onNavigateScreen?: (screen: "home" | "results" | "chat" | "disruptions" | "saved") => void;
  scenario?: import("@/types/transit").DisruptionScenario;
}

/* ------------------------------------------------------------------ */
/*  Preset suggestions matching the Google Gemini interface            */
/* ------------------------------------------------------------------ */

const GEMINI_SUGGESTIONS = [
  {
    icon: <Compass size={17} color="#60a5fa" />,
    label: "Explore cheapest route from Karol Bagh to Gandhi Darshan",
    prompt: "Find the cheapest route from Karol Bagh to Gandhi Darshan",
  },
  {
    icon: <Clock size={17} color="#f59e0b" />,
    label: "What's the fastest metro line avoiding crowded stations?",
    prompt: "What is the fastest metro route avoiding crowded stations during peak hours?",
  },
  {
    icon: <Sparkles size={17} color="#c084fc" />,
    label: "Check DMRC metro fare slabs and Smart Card discounts",
    prompt: "What are the DMRC metro fare slabs, Sunday discounts, and Smart Card savings?",
  },
  {
    icon: <MapPin size={17} color="#34d399" />,
    label: "How do free DTC Pink Passes for women commuters work?",
    prompt: "How do free Pink Passes work for women on DTC buses in Delhi?",
  },
];

const RECENT_CHATS_LIST = [
  "Cheapest route to Gandhi Darshan",
  "Blue line metro delay alternatives",
  "DMRC off-peak Smart Card 20% off",
  "Karol Bagh to Rajiv Chowk direct",
  "Airport Express line timings",
  "Crossings Republik connectivity",
];

const NOTEBOOKS_LIST = [
  "Daily College Commute",
  "Office Peak Hours Plan",
  "Weekend Metro Outings",
];

/* ------------------------------------------------------------------ */
/*  Sparkle Gemini-style colorful SVG icon                             */
/* ------------------------------------------------------------------ */

const GeminiSparkleIcon = ({ size = 20 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0 }}
  >
    <path
      d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6L12 2Z"
      fill="url(#gemini-grad-1)"
    />
    <defs>
      <linearGradient id="gemini-grad-1" x1="3" y1="2" x2="21" y2="20" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4285F4" />
        <stop offset="0.33" stopColor="#9B72CB" />
        <stop offset="0.66" stopColor="#D96570" />
        <stop offset="1" stopColor="#10B981" />
      </linearGradient>
    </defs>
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Transit Mode Helper                                                */
/* ------------------------------------------------------------------ */

const MODE_ICON: Record<string, React.ReactNode> = {
  metro: <VehicleIllustration mode="metro" size="sm" />,
  bus: <VehicleIllustration mode="bus" size="sm" />,
  walk: <VehicleIllustration mode="walk" size="sm" />,
  auto: <VehicleIllustration mode="auto" size="sm" />,
};

/* ------------------------------------------------------------------ */
/*  Main GeminiChatView Component                                      */
/* ------------------------------------------------------------------ */

export const GeminiChatView: React.FC<GeminiChatViewProps> = ({
  onPlanRoute,
  initialPrompt,
  onInitialPromptHandled,
  onNavigateScreen,
  scenario,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== "undefined" ? window.innerWidth > 768 : true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCopiedId, setIsCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-collapse sidebar on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle incoming initialPrompt
  useEffect(() => {
    if (!initialPrompt) return;
    void handleSend(initialPrompt);
    onInitialPromptHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const handleSend = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend ?? input).trim();
      if (!text || isLoading) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      try {
        const conversationHistory = messages.slice(-15).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("/api/v1/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            conversationHistory,
            scenario: scenario?.active ? scenario : undefined,
          }),
        });

        const data = (await res.json()) as ChatApiResponse;
        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to get route assistance.");
        }

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.response || "I could not find a response. Please try another stop or prompt.",
          routeResult: data.routeResult,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-err-${Date.now()}`,
            role: "assistant",
            content: `⚠️ ${errMsg}`,
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages]
  );

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  };

  const copyToClipboard = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setIsCopiedId(id);
    setTimeout(() => setIsCopiedId(null), 2000);
  };

  const handleRouteClick = (route: RouteResult) => {
    if (!onPlanRoute || !route.legs?.length) return;
    const from = route.legs[0].from;
    const to = route.legs[route.legs.length - 1].to;
    onPlanRoute(from, to);
  };

  const hasMessages = messages.length > 0;

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "calc(100vh - 72px)",
        maxHeight: "-webkit-fill-available",
        background: "#0e1117",
        color: "#e2e8f0",
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ============================================================ */}
      {/*  LEFT SIDEBAR (Gemini Style)                                 */}
      {/* ============================================================ */}
      <aside
        style={{
          width: sidebarOpen ? "260px" : "0px",
          minWidth: sidebarOpen ? "260px" : "0px",
          height: "100%",
          background: "#13151b",
          borderRight: sidebarOpen ? "1px solid rgba(255, 255, 255, 0.07)" : "none",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          overflow: "hidden",
          zIndex: 40,
        }}
      >
        {sidebarOpen && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "260px" }}>
            {/* Sidebar Top: Collapse Toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                padding: "14px 16px 10px",
              }}
            >
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                title="Collapse sidebar"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
              >
                <PanelLeftClose size={18} />
              </button>
            </div>

            {/* "+ New chat" Button */}
            <div style={{ padding: "0 14px 12px" }}>
              <button
                type="button"
                onClick={handleNewChat}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  padding: "9px 14px",
                  borderRadius: "24px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#e2e8f0",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.09)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                }}
              >
                <SquarePen size={15} color="#93c5fd" />
                <span>New chat</span>
              </button>
            </div>

            {/* Scrollable Center: Nav items + Notebooks + Recents */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "0 10px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              {/* Secondary Navigation */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {[
                  { label: "Trip Planner", icon: <Compass size={15} />, action: () => onNavigateScreen?.("home") },
                  { label: "What-If Simulator", icon: <Clock size={15} />, action: () => onNavigateScreen?.("disruptions") },
                  { label: "Saved Journeys", icon: <FolderKanban size={15} />, action: () => onNavigateScreen?.("saved") },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={item.action}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "7px 10px",
                      borderRadius: "8px",
                      background: "transparent",
                      border: "none",
                      color: "#94a3b8",
                      fontSize: "0.78rem",
                      fontWeight: 500,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                      e.currentTarget.style.color = "#f1f5f9";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "#94a3b8";
                    }}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Notebooks / Commute Plans */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 8px",
                    marginBottom: "4px",
                  }}
                >
                  <span style={{ fontSize: "0.68rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                    Notebooks
                  </span>
                  <Plus size={13} color="#64748b" style={{ cursor: "pointer" }} />
                </div>
                {NOTEBOOKS_LIST.map((nb, i) => (
                  <div
                    key={i}
                    onClick={() => void handleSend(`Check status and options for ${nb}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      color: "#cbd5e1",
                      fontSize: "0.74rem",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <BookOpen size={13} color="#60a5fa" />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{nb}</span>
                  </div>
                ))}
              </div>

              {/* Recent Conversations */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 8px",
                    marginBottom: "4px",
                  }}
                >
                  <span style={{ fontSize: "0.68rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                    Recent
                  </span>
                  <Search size={12} color="#64748b" />
                </div>
                {RECENT_CHATS_LIST.map((item, i) => (
                  <div
                    key={i}
                    onClick={() => void handleSend(item)}
                    style={{
                      padding: "6px 8px",
                      borderRadius: "6px",
                      color: "#94a3b8",
                      fontSize: "0.73rem",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      transition: "color 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                      e.currentTarget.style.color = "#f1f5f9";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "#94a3b8";
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Sidebar Bottom: User Profile */}
            <div
              style={{
                padding: "12px 14px",
                borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #3b82f6, #ec4899)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}
                >
                  SS
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#f8fafc" }}>Shlok Srivastava</span>
                  <span style={{ fontSize: "0.62rem", color: "#64748b" }}>Delhi Commuter</span>
                </div>
              </div>
              <Settings size={15} color="#64748b" style={{ cursor: "pointer" }} />
            </div>
          </div>
        )}
      </aside>

      {/* ============================================================ */}
      {/*  MAIN CHAT CANVAS (Gemini Theme)                             */}
      {/* ============================================================ */}
      <main
        style={{
          flex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          background: "radial-gradient(ellipse 65% 55% at 50% 40%, rgba(29, 78, 216, 0.14) 0%, #0d1017 65%, #08090e 100%)",
          overflow: "hidden",
        }}
      >
        {/* Top Header Row (Expand toggle, Upgrade pill, Model selector) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
            zIndex: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                title="Open sidebar"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
            
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #3b82f6, #ec4899)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontSize: "0.7rem",
                fontWeight: 700,
              }}
            >
              SS
            </div>
          </div>
        </div>

        {/* Center Content Stage */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "20px 24px",
          }}
        >
          {/* -------------------------------------------------------- */}
          {/*  A. EMPTY WELCOME STATE (Exact Google Gemini layout)     */}
          {/* -------------------------------------------------------- */}
          {!hasMessages && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                maxWidth: "760px",
                margin: "auto 0",
              }}
            >
              {/* "Where should we start?" Headline */}
              <h1
                style={{
                  fontSize: "2.35rem",
                  fontWeight: 600,
                  color: "#f1f5f9",
                  marginBottom: "28px",
                  letterSpacing: "-0.02em",
                  textAlign: "center",
                }}
              >
                Where should we start?
              </h1>

              {/* Centered Input Bar */}
              <div
                style={{
                  width: "100%",
                  borderRadius: "28px",
                  background: "#1e212b",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  boxShadow: "0 10px 35px rgba(0, 0, 0, 0.45)",
                  padding: "10px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "24px",
                  transition: "border 0.2s ease, box-shadow 0.2s ease",
                }}
              >
                {/* Input Text Field */}
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Ask TransitRouteAI..."
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#f8fafc",
                    fontSize: "0.95rem",
                    fontWeight: 400,
                  }}
                />

                {/* Send Button */}
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!input.trim()}
                  title="Send message"
                  aria-label="Send message"
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "50%",
                    background: input.trim() ? "#3b82f6" : "rgba(255, 255, 255, 0.06)",
                    border: "none",
                    color: input.trim() ? "#ffffff" : "#64748b",
                    cursor: input.trim() ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s ease",
                    flexShrink: 0,
                  }}
                >
                  <Send size={15} />
                </button>
              </div>

              {/* Suggested Prompts Stack (Gemini style) */}
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {GEMINI_SUGGESTIONS.map((s, idx) => (
                  <div
                    key={idx}
                    onClick={() => void handleSend(s.prompt)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      cursor: "pointer",
                      color: "#cbd5e1",
                      fontSize: "0.82rem",
                      fontWeight: 500,
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                      e.currentTarget.style.color = "#ffffff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
                      e.currentTarget.style.color = "#cbd5e1";
                    }}
                  >
                    {s.icon}
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* -------------------------------------------------------- */}
          {/*  B. ACTIVE CONVERSATION STREAM (When messages exist)     */}
          {/* -------------------------------------------------------- */}
          {hasMessages && (
            <div
              style={{
                width: "100%",
                maxWidth: "760px",
                display: "flex",
                flexDirection: "column",
                gap: "24px",
                paddingBottom: "110px",
              }}
            >
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      gap: "14px",
                      alignItems: "flex-start",
                      justifyContent: isUser ? "flex-end" : "flex-start",
                    }}
                  >
                    {!isUser && (
                      <div style={{ marginTop: "2px" }}>
                        <GeminiSparkleIcon size={24} />
                      </div>
                    )}

                    <div
                      style={{
                        maxWidth: isUser ? "78%" : "100%",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {/* Message Content Bubble */}
                      <div
                        style={{
                          padding: isUser ? "10px 16px" : "4px 0",
                          borderRadius: isUser ? "20px" : "0",
                          background: isUser ? "rgba(59, 130, 246, 0.18)" : "transparent",
                          border: isUser ? "1px solid rgba(59, 130, 246, 0.35)" : "none",
                          color: "#f1f5f9",
                          fontSize: "0.88rem",
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {msg.content}
                      </div>

                      {/* Embedded Interactive Route Result Card */}
                      {msg.routeResult && msg.routeResult.legs && msg.routeResult.legs.length > 0 && (
                        <div
                          style={{
                            marginTop: "6px",
                            padding: "12px 14px",
                            borderRadius: "12px",
                            background: "rgba(255, 255, 255, 0.035)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: "10px",
                              paddingBottom: "8px",
                              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                            }}
                          >
                            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#60a5fa" }}>
                              Planned Itinerary
                            </span>
                            <div style={{ display: "flex", gap: "10px", fontSize: "0.74rem" }}>
                              <span style={{ color: "#38bdf8", fontWeight: 700 }}>
                                ~{msg.routeResult.totalMinutes} min
                              </span>
                              <span style={{ color: "#34d399", fontWeight: 700 }}>
                                {msg.routeResult.totalFare != null ? `₹${msg.routeResult.totalFare}` : "Fare on card"}
                              </span>
                            </div>
                          </div>

                          {/* Legs step-by-step chain */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
                            {msg.routeResult.legs.map((leg, lIdx) => (
                              <div
                                key={lIdx}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  fontSize: "0.74rem",
                                  color: "#cbd5e1",
                                }}
                              >
                                {MODE_ICON[leg.mode] || <Train size={13} />}
                                <span style={{ fontWeight: 600, color: "#f8fafc" }}>{leg.from}</span>
                                <ChevronRight size={11} color="#64748b" />
                                <span style={{ fontWeight: 600, color: "#f8fafc" }}>{leg.to}</span>
                                <span style={{ color: "#94a3b8", fontSize: "0.68rem", marginLeft: "auto" }}>
                                  {leg.minutes}m {leg.stops ? `· ${leg.stops} stops` : ""}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Action Button: View on Map */}
                          <button
                            type="button"
                            onClick={() => handleRouteClick(msg.routeResult!)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                              width: "100%",
                              padding: "7px 12px",
                              borderRadius: "8px",
                              background: "rgba(59, 130, 246, 0.15)",
                              border: "1px solid rgba(59, 130, 246, 0.35)",
                              color: "#93c5fd",
                              fontSize: "0.74rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(59, 130, 246, 0.25)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(59, 130, 246, 0.15)")}
                          >
                            <MapPin size={13} />
                            <span>Open Route in Visual Planner</span>
                          </button>
                        </div>
                      )}

                      {/* Response Action Buttons (Copy, Like, Dislike, Retry) */}
                      {!isUser && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            title="Copy response"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: isCopiedId === msg.id ? "#34d399" : "#64748b",
                              cursor: "pointer",
                              padding: "4px",
                            }}
                          >
                            {isCopiedId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                          <button
                            type="button"
                            title="Good response"
                            style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: "4px" }}
                          >
                            <ThumbsUp size={13} />
                          </button>
                          <button
                            type="button"
                            title="Bad response"
                            style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: "4px" }}
                          >
                            <ThumbsDown size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSend(messages[messages.length - 2]?.content || "Explain again")}
                            title="Regenerate"
                            style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: "4px" }}
                          >
                            <RotateCcw size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Typing / Thinking Indicator */}
              {isLoading && (
                <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                  <GeminiSparkleIcon size={24} />
                  <div style={{ display: "flex", gap: "4px", padding: "8px 0" }}>
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        style={{
                          width: "7px",
                          height: "7px",
                          borderRadius: "50%",
                          background: "#60a5fa",
                          animation: `chatDotBounce 1.2s ease-in-out ${dot * 0.2}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------- */}
        {/*  STICKY BOTTOM INPUT PILL (When messages are active)       */}
        {/* ---------------------------------------------------------- */}
        {hasMessages && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "12px 24px 16px",
              background: "linear-gradient(180deg, transparent 0%, rgba(14, 17, 23, 0.95) 40%, #0e1117 100%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              zIndex: 30,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "760px",
                borderRadius: "28px",
                background: "#1e212b",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
                padding: "8px 18px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Ask TransitRouteAI..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#f8fafc",
                  fontSize: "0.92rem",
                }}
              />

              {/* Send Button */}
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!input.trim()}
                title="Send message"
                aria-label="Send message"
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: input.trim() ? "#3b82f6" : "rgba(255, 255, 255, 0.06)",
                  border: "none",
                  color: input.trim() ? "#ffffff" : "#64748b",
                  cursor: input.trim() ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s ease",
                  flexShrink: 0,
                }}
              >
                <Send size={14} />
              </button>
            </div>

            <p style={{ fontSize: "0.65rem", color: "#64748b", marginTop: "8px", textAlign: "center" }}>
              Transit Route AI can make mistakes. Verify important timings with DMRC / DTC official feeds.
            </p>
          </div>
        )}
        {/* Keyframe animations for UI */}
        <style>{`
          @keyframes chatDotBounce {
            0%, 80%, 100% {
              transform: scale(0.6);
              opacity: 0.4;
            }
            40% {
              transform: scale(1.1);
              opacity: 1;
            }
          }
        `}</style>
      </main>
    </div>
  );
};
