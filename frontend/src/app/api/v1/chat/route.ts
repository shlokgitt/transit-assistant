import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Groq from "groq-sdk";
import {
  periodFor,
  planByName,
  planMetroByName,
  planWalkingByName,
  findStops,
  stopDetails,
} from "../../../../../backend/route.js";
import { getCityTransitStatus } from "@/lib/transitData";

/* ------------------------------------------------------------------ */
/*  Constants & Config                                                */
/* ------------------------------------------------------------------ */

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_TOOL_ROUNDS = 3;
const GROQ_TIMEOUT_MS = 25_000;

const SYSTEM_PROMPT = `You are Transit Route AI, an intelligent, friendly, and knowledgeable Delhi NCR public transit assistant.
You help commuters plan multimodal journeys, find stations, calculate fares, check delays, and navigate Delhi Metro (DMRC), DTC buses, and connecting walkways.

CAPABILITIES & KNOWLEDGE:
1. Route Planning: You plan optimal transit routes across Delhi NCR. Always use the provided tools (plan_route, plan_metro_route, plan_walking_route) when specific origin/destination are mentioned.
2. Station Search: You can lookup stations, bus stops, and landmarks using search_stops and get_stop_details.
3. Live Status & Delays: You can check delays, traffic advisories, and system health using get_transit_status_and_delays.
4. Fares: DMRC standard fares range from ₹10 to ₹60 based on distance. Metro Smart Card users receive a 10% discount during peak hours and a 20% discount during off-peak hours. Women travel completely free on DTC and cluster buses with Pink Tickets.
5. Operating Timings: Delhi Metro generally operates from 05:30 AM to 11:30 PM (Airport Express Line starts at 04:45 AM).
6. Airport Connectivity: The Airport Express (Orange Line) runs directly from New Delhi Railway Station to IGI Airport T3 in under 20 minutes.
7. Multilingual: You understand and communicate fluently in English, Hindi (हिंदी), and Hinglish.

GUIDELINES:
- When a user asks a general question like "Find the cheapest route" or "Avoid crowded stations" without specifying origin and destination, answer their conceptual question warmly with helpful transit tips (e.g. explaining off-peak hours or bus fares) and politely ask for their start and end points.
- When presenting a route, clearly describe the legs, mode of transit (Metro 🚇, Bus 🚌, Walk 🚶), transfer stations, duration, and fares.
- Keep answers well-structured using bullet points, bold highlights, and short paragraphs.
- Always introduce yourself as Transit Route AI when asked about your identity.`;

/* ------------------------------------------------------------------ */
/*  Location Query Normalization Helper                               */
/* ------------------------------------------------------------------ */

function cleanLocationName(query: string): string {
  if (!query || typeof query !== "string") return "";
  return query
    .replace(/,\s*(?:delhi ncr|new delhi|delhi|noida|gurugram|gurgaon|ghaziabad|faridabad|india)\b/gi, "")
    .replace(/\b(?:metro station|subway station|bus station|bus stand|bus stop|bus terminal|metro|station|terminal|isbt)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function loadDelaysData() {
  const candidates = [
    path.join(process.cwd(), "frontend", "backend", "data", "delays.json"),
    path.join(process.cwd(), "backend", "data", "delays.json"),
    path.join(process.cwd(), "data", "delays.json"),
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..", "backend", "data", "delays.json"),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return JSON.parse(fs.readFileSync(candidate, "utf8"));
      }
    } catch {
      // Continue to next candidate
    }
  }
  return { delays: [] };
}

/* ------------------------------------------------------------------ */
/*  Tool definitions for Groq function calling                        */
/* ------------------------------------------------------------------ */

const TOOLS: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "plan_route",
      description:
        "Plan a multimodal transit route (metro + bus + walk) between two locations in Delhi NCR. Returns the optimal route with legs, fares, duration, and transfer information.",
      parameters: {
        type: "object",
        properties: {
          from: {
            type: "string",
            description: "Origin stop, station, landmark, or area (e.g. 'Karol Bagh', 'Rajiv Chowk', 'Connaught Place')",
          },
          to: {
            type: "string",
            description: "Destination stop, station, landmark, or area (e.g. 'Gandhi Darshan', 'Hauz Khas', 'Kashmere Gate')",
          },
          preference: {
            type: "string",
            enum: ["fastest", "cheapest"],
            description: "Routing preference. 'fastest' for quickest arrival, 'cheapest' for lowest fare. Defaults to 'fastest'.",
          },
          avoid_crowded: {
            type: "boolean",
            description: "Whether to prefer routes that bypass congested stations and heavy crowding during peak hours.",
          },
        },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "plan_metro_route",
      description:
        "Plan a metro-only route between two stations or locations in Delhi NCR. Returns metro lines to take, interchanges, travel duration, and fares.",
      parameters: {
        type: "object",
        properties: {
          from: {
            type: "string",
            description: "Origin station or location name",
          },
          to: {
            type: "string",
            description: "Destination station or location name",
          },
        },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "plan_walking_route",
      description:
        "Plan a walking-only route with straight-line distance and estimated walking time in Delhi NCR.",
      parameters: {
        type: "object",
        properties: {
          from: {
            type: "string",
            description: "Origin location name",
          },
          to: {
            type: "string",
            description: "Destination location name",
          },
        },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_stops",
      description:
        "Search for transit stops, metro stations, or landmarks matching a query to verify stop names.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Partial or full name of the stop to search for (e.g. 'Karol', 'Rajiv', 'Noida')",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_stop_details",
      description:
        "Get detailed information about a specific transit stop including modes served, lines, and coordinates.",
      parameters: {
        type: "object",
        properties: {
          stop_id: {
            type: "string",
            description: "The stop ID obtained from search_stops results",
          },
        },
        required: ["stop_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_transit_status_and_delays",
      description:
        "Get current operational status, crowd index, active alerts, and delays across Delhi Metro lines and DTC bus routes.",
      parameters: {
        type: "object",
        properties: {
          mode: {
            type: "string",
            enum: ["all", "metro", "bus"],
            description: "Transit mode to inspect. Defaults to 'all'.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_metro_fare",
      description:
        "Calculate metro fares between two stations or get official DMRC fare slab rules, Sunday/holiday discounts, and Smart Card savings.",
      parameters: {
        type: "object",
        properties: {
          from_station: {
            type: "string",
            description: "Starting metro station name (optional)",
          },
          to_station: {
            type: "string",
            description: "Destination metro station name (optional)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_transit_guidance",
      description:
        "Get official guidelines, ticket purchasing advice, women safety (free pink passes on DTC buses), airport express connection, helpline numbers, or smart card tips for Delhi NCR public transit.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            enum: ["ticketing", "hours", "women_safety_pink_pass", "airport_express", "helpline", "general"],
            description: "The transit guidance topic requested.",
          },
        },
        required: ["topic"],
      },
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Tool execution — validates arguments & calls transit functions     */
/* ------------------------------------------------------------------ */

interface ToolResult {
  data: unknown;
  isRoute: boolean;
}

function executeTool(
  name: string,
  args: Record<string, unknown>
): ToolResult {
  try {
    switch (name) {
      case "plan_route": {
        const rawFrom = String(args.from ?? "").trim();
        const rawTo = String(args.to ?? "").trim();
        if (!rawFrom || !rawTo) {
          return {
            data: { error: "Both origin and destination names are required." },
            isRoute: false,
          };
        }
        const preference = args.preference === "cheapest" ? "cheapest" : "fastest";
        const avoidCrowded = Boolean(args.avoid_crowded);

        let result = planByName(rawFrom, rawTo, {
          preference,
          period: periodFor(),
          avoidCrowded,
        });

        // If direct match failed, retry with cleaned station names
        if (result && "error" in (result as Record<string, unknown>)) {
          const cleanedFrom = cleanLocationName(rawFrom);
          const cleanedTo = cleanLocationName(rawTo);
          if (cleanedFrom !== rawFrom || cleanedTo !== rawTo) {
            const retry = planByName(cleanedFrom || rawFrom, cleanedTo || rawTo, {
              preference,
              period: periodFor(),
              avoidCrowded,
            });
            if (!("error" in (retry as Record<string, unknown>))) {
              result = retry;
            }
          }
        }

        return {
          data: result,
          isRoute: !("error" in (result as Record<string, unknown>)),
        };
      }

      case "plan_metro_route": {
        const rawFrom = String(args.from ?? "").trim();
        const rawTo = String(args.to ?? "").trim();
        if (!rawFrom || !rawTo) {
          return {
            data: { error: "Both origin and destination names are required." },
            isRoute: false,
          };
        }

        let result = planMetroByName(rawFrom, rawTo);
        if (result && "error" in (result as Record<string, unknown>)) {
          const cleanedFrom = cleanLocationName(rawFrom);
          const cleanedTo = cleanLocationName(rawTo);
          if (cleanedFrom !== rawFrom || cleanedTo !== rawTo) {
            const retry = planMetroByName(cleanedFrom || rawFrom, cleanedTo || rawTo);
            if (!("error" in (retry as Record<string, unknown>))) {
              result = retry;
            }
          }
        }

        return {
          data: result,
          isRoute: !("error" in (result as Record<string, unknown>)),
        };
      }

      case "plan_walking_route": {
        const rawFrom = String(args.from ?? "").trim();
        const rawTo = String(args.to ?? "").trim();
        if (!rawFrom || !rawTo) {
          return {
            data: { error: "Both origin and destination names are required." },
            isRoute: false,
          };
        }

        let result = planWalkingByName(rawFrom, rawTo);
        if (result && "error" in (result as Record<string, unknown>)) {
          const cleanedFrom = cleanLocationName(rawFrom);
          const cleanedTo = cleanLocationName(rawTo);
          if (cleanedFrom !== rawFrom || cleanedTo !== rawTo) {
            const retry = planWalkingByName(cleanedFrom || rawFrom, cleanedTo || rawTo);
            if (!("error" in (retry as Record<string, unknown>))) {
              result = retry;
            }
          }
        }

        return {
          data: result,
          isRoute: !("error" in (result as Record<string, unknown>)),
        };
      }

      case "search_stops": {
        const query = String(args.query ?? "").trim();
        if (!query) {
          return {
            data: { error: "Search query is required." },
            isRoute: false,
          };
        }
        let results = findStops(query);
        if (!results.length) {
          const cleaned = cleanLocationName(query);
          if (cleaned && cleaned !== query) {
            results = findStops(cleaned);
          }
        }
        return {
          data: {
            matchCount: results.length,
            results: results.slice(0, 10).map((s: { id: string; name: string }) => ({
              id: s.id,
              name: s.name,
            })),
          },
          isRoute: false,
        };
      }

      case "get_stop_details": {
        const id = String(args.stop_id ?? "").trim();
        if (!id) {
          return {
            data: { error: "Stop ID is required." },
            isRoute: false,
          };
        }
        const details = stopDetails(id);
        return {
          data: details ?? { error: `No stop found with ID "${id}".` },
          isRoute: false,
        };
      }

      case "get_transit_status_and_delays": {
        const status = getCityTransitStatus("delhi");
        const delaysData = loadDelaysData();
        return {
          data: {
            systemHealth: "Normal operations",
            alerts: status.alerts,
            crowdIndex: status.crowdIndex,
            activeDelays: delaysData.delays.slice(0, 8).map((d: { route_id: string; delay_minutes: number; crowd_level: string }) => ({
              route: d.route_id,
              delayMinutes: d.delay_minutes,
              crowdLevel: d.crowd_level,
            })),
          },
          isRoute: false,
        };
      }

      case "get_metro_fare": {
        const from = String(args.from_station ?? "").trim();
        const to = String(args.to_station ?? "").trim();

        if (from && to) {
          const route = planMetroByName(from, to);
          if (!("error" in (route as Record<string, unknown>))) {
            const fare = (route as Record<string, unknown>).totalFare ?? 30;
            return {
              data: {
                from,
                to,
                standardFare: `₹${fare}`,
                smartCardFare: `₹${Math.round(Number(fare) * 0.9)} (10% off peak) / ₹${Math.round(Number(fare) * 0.8)} (20% off-peak)`,
                totalMinutes: (route as Record<string, unknown>).totalMinutes,
              },
              isRoute: true,
            };
          }
        }

        return {
          data: {
            fareSlabs: [
              { distance: "0 - 2 km", weekdayFare: "₹10", sundayHolidayFare: "₹10" },
              { distance: "2 - 5 km", weekdayFare: "₹20", sundayHolidayFare: "₹10" },
              { distance: "5 - 12 km", weekdayFare: "₹30", sundayHolidayFare: "₹20" },
              { distance: "12 - 21 km", weekdayFare: "₹40", sundayHolidayFare: "₹30" },
              { distance: "21 - 32 km", weekdayFare: "₹50", sundayHolidayFare: "₹40" },
              { distance: "> 32 km", weekdayFare: "₹60", sundayHolidayFare: "₹50" },
            ],
            discounts: "10% off on Metro Smart Card (20% during off-peak hours). Sunday and national holidays follow special discounted slabs.",
          },
          isRoute: false,
        };
      }

      case "get_transit_guidance": {
        const topic = String(args.topic ?? "general").toLowerCase();
        const guidance: Record<string, unknown> = {
          ticketing: {
            smartCard: "DMRC Smart Card offers 10% discount on peak hours and 20% on non-peak hours (08:00-12:00, 17:00-21:00 weekdays).",
            qrTickets: "Available via DMRC Travel App, Paytm, WhatsApp, and automated TVMs at all stations.",
            busTickets: "Available via cash with bus conductor or digital QR via 'One Delhi' app / Chartr.",
          },
          women_safety_pink_pass: {
            benefit: "Women commute 100% FREE on all Delhi DTC and cluster buses using single-journey Pink Tickets issued onboard.",
            safety: "CCTV cameras and bus marshals are deployed on DTC buses. DMRC reserve coach is the first car in direction of travel on all trains.",
          },
          hours: {
            metro: "Typically 05:30 AM to 11:30 PM across most lines.",
            airportExpress: "Starts early at 04:45 AM and runs until 11:40 PM.",
            bus: "DTC city buses run 05:00 AM to 11:00 PM; select night bus routes operate overnight between major railway stations.",
          },
          airport_express: {
            line: "Orange Line (Airport Express) connects New Delhi Railway Station to Indira Gandhi International Airport (Terminal 3) in under 20 minutes.",
            fare: "₹60 between New Delhi Railway Station and IGI Airport.",
          },
          helpline: {
            dmrcHelpline: "155370 (24x7 DMRC Customer Care)",
            dmrcSecurity: "155655 (CISF 24x7 Metro Security)",
            dtcHelpline: "1800-11-8181 / 011-23370373",
            womenHelpline: "1091 / 112",
          },
        };
        return {
          data: guidance[topic] || guidance.ticketing,
          isRoute: false,
        };
      }

      default:
        return {
          data: { error: `Unknown tool: ${name}` },
          isRoute: false,
        };
    }
  } catch (err: unknown) {
    return {
      data: { error: err instanceof Error ? err.message : "Tool execution failed" },
      isRoute: false,
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Smart Local Intent Fallback Engine                                */
/* ------------------------------------------------------------------ */

interface FallbackResponse {
  response: string;
  intent: string;
  routeResult: unknown | null;
}

function handleChatFallback(message: string): FallbackResponse {
  const text = message.trim();
  const lower = text.toLowerCase();

  // 1. Greetings & Identity
  if (/^(hi|hello|hey|namaste|greetings|who are you|kya kar sakte ho|help)\b/i.test(lower)) {
    return {
      response:
        "👋 **Hello! I'm Transit Route AI**, your Delhi NCR public transit assistant.\n\nHere is how I can help you travel smartly across the capital:\n- 🚇 **Plan Routes:** Multimodal journeys combining Delhi Metro, DTC buses, and walking.\n- 💰 **Cheapest & Fastest Options:** Find the best fare or quickest route between any two places.\n- ⏱️ **Live Status & Delays:** Check simulated delays and crowd warnings.\n- 🎫 **Fares & Guidelines:** DMRC distance slabs, Smart Card discounts, and free DTC Pink Passes for women.\n\nTry asking me: *'How do I go from Karol Bagh to Gandhi Darshan?'* or *'What is the metro fare between Rajiv Chowk and Noida?'*",
      intent: "greeting",
      routeResult: null,
    };
  }

  // 2. Hindi prompt suggestion or query
  if (/hindi|हिंदी|नमस्ते|किराया|रास्ता/i.test(lower)) {
    return {
      response:
        "नमस्ते! मैं आपका **Transit Route AI** सहायक हूँ।\n\nमैं दिल्ली-एनसीआर में सार्वजनिक परिवहन (मेट्रो, डीटीसी बस, और पैदल मार्ग) के लिए सबसे उपयुक्त मार्ग खोजने में आपकी सहायता करता हूँ:\n- **सबसे तेज़ व सबसे सस्ता मार्ग** – बस या मेट्रो का सटीक संयोजन\n- **किराया विवरण** – दूरी के अनुसार किराया व स्मार्ट कार्ड छूट\n- **स्टेशन जानकारी** – नजदीकी स्टेशन व इंटरचेंज\n\nआप मुझसे पूछ सकते हैं, जैसे: *'करोल बाग से गांधी दर्शन कैसे जाएं?'* या *'राजीव चौक से नोएडा का किराया कितना है?'*",
      intent: "hindi_guidance",
      routeResult: null,
    };
  }

  // 3. Prompt Suggestion: "Find the cheapest route"
  if (/^find the cheapest route/i.test(lower) || lower === "cheapest route") {
    return {
      response:
        "💡 **Finding the Cheapest Route in Delhi NCR:**\n\nTo give you the most cost-effective travel plan, please tell me your **origin** and **destination** (for example: *'From Karol Bagh to Gandhi Darshan'*).\n\n**Money-saving tips:**\n- 🚌 **DTC Non-AC Buses:** Lowest fares in Delhi (₹5 for up to 4 km, ₹10 for 4–10 km, ₹15 for 10+ km).\n- 🌸 **Free Pink Passes:** Women travel free on all DTC and cluster buses with onboard single-journey Pink Tickets.\n- 💳 **Metro Smart Card:** Save 10% on all trips, plus an extra 10% (total 20% off) during off-peak hours (08:00–12:00 and 17:00–21:00 on weekdays).",
      intent: "cheapest_advice",
      routeResult: null,
    };
  }

  // 4. Prompt Suggestion: "Avoid crowded stations"
  if (/avoid crowded/i.test(lower) || /crowd/i.test(lower)) {
    const status = getCityTransitStatus("delhi");
    return {
      response:
        `🛡️ **Crowd Avoidance & Peak Hour Tips:**\n\n- **Peak Hours:** 08:30 AM – 11:00 AM (Morning rush) and 05:30 PM – 08:30 PM (Evening commute).\n- **High-Congestion Hubs:** Rajiv Chowk, Kashmere Gate, Central Secretariat, and Botanical Garden.\n- **Current Metro Crowd Level:** ${status.crowdIndex.metro}\n- **Current Bus Network Crowd Level:** ${status.crowdIndex.bus}\n\nTo plan a route that avoids crowded transfers, share your start and destination (e.g. *'Plan route from Karol Bagh to Gandhi Darshan avoiding crowd'*).`,
      intent: "crowd_advice",
      routeResult: null,
    };
  }

  // 5. Delays, Traffic & Status
  if (/delay|status|traffic|alert|disruption/i.test(lower)) {
    const status = getCityTransitStatus("delhi");
    const delaysData = loadDelaysData();
    const alertsText = status.alerts
      .map((a) => `• **${a.title}:** ${a.message}`)
      .join("\n");
    const delaysText = delaysData.delays
      .slice(0, 3)
      .map((d: { route_id: string; delay_minutes: number; crowd_level: string }) => `• Route ${d.route_id}: +${d.delay_minutes} min delay (${d.crowd_level} crowd)`)
      .join("\n");

    return {
      response:
        `🚦 **Delhi NCR Transit Operations & Advisory:**\n\n**System Health:** Normal Operations across DMRC & DTC networks.\n\n**Active Advisories:**\n${alertsText}\n\n**Simulated Bus Delays:**\n${delaysText || "No major delays reported."}`,
      intent: "transit_status",
      routeResult: null,
    };
  }

  // 6. Fare / Ticket query
  if (/fare|ticket|cost|price|kiraya|paisa/i.test(lower)) {
    return {
      response:
        "🎫 **Delhi NCR Transit Fares Summary:**\n\n**Delhi Metro (DMRC Standard):**\n- 0 – 2 km: ₹10\n- 2 – 5 km: ₹20\n- 5 – 12 km: ₹30\n- 12 – 21 km: ₹40\n- 21 – 32 km: ₹50\n- > 32 km: ₹60\n\n**Discounts:**\n- Metro Smart Card: 10% off anytime; 20% off during weekday off-peak hours.\n- Sundays & National Holidays: Reduced fares apply.\n\n**DTC Buses:**\n- Non-AC: ₹5 / ₹10 / ₹15 based on distance.\n- AC Buses: ₹10 / ₹15 / ₹20 / ₹25.\n- **Women Commuters:** Free Pink Passes on all DTC & cluster buses.",
      intent: "fare_info",
      routeResult: null,
    };
  }

  // 7. Route planning intent extraction (e.g. "from X to Y", "X to Y", "go to Y from X")
  let fromPlace = "";
  let toPlace = "";

  const fromToMatch = /(?:from|starting from|start at)\s+([^,]+?)\s+(?:to|towards|reach|heading to)\s+([^,]+)/i.exec(text);
  const toFromMatch = /(?:to|reach|heading to)\s+([^,]+?)\s+(?:from|starting from)\s+([^,]+)/i.exec(text);
  const simpleToMatch = /^([a-zA-Z0-9\s.-]+?)\s+(?:to|se)\s+([a-zA-Z0-9\s.-]+)$/i.exec(text);

  if (fromToMatch) {
    fromPlace = fromToMatch[1].trim();
    toPlace = fromToMatch[2].trim();
  } else if (toFromMatch) {
    toPlace = toFromMatch[1].trim();
    fromPlace = toFromMatch[2].trim();
  } else if (simpleToMatch) {
    fromPlace = simpleToMatch[1].trim();
    toPlace = simpleToMatch[2].trim();
  }

  if (fromPlace && toPlace) {
    const preference = /cheap|sasta|saving/i.test(lower) ? "cheapest" : "fastest";
    let route = planByName(fromPlace, toPlace, {
      preference,
      period: periodFor(),
    });

    if (route && "error" in (route as Record<string, unknown>)) {
      const cFrom = cleanLocationName(fromPlace);
      const cTo = cleanLocationName(toPlace);
      const retry = planByName(cFrom || fromPlace, cTo || toPlace, {
        preference,
        period: periodFor(),
      });
      if (!("error" in (retry as Record<string, unknown>))) {
        route = retry;
      }
    }

    if (route && !("error" in (route as Record<string, unknown>))) {
      const r = route as Record<string, unknown>;
      const legs = Array.isArray(r.legs) ? (r.legs as Array<Record<string, unknown>>) : [];
      const totalMinutes = r.totalMinutes;
      const totalFare = r.totalFare !== null && r.totalFare !== undefined ? `₹${r.totalFare}` : "N/A";

      const legsList = legs
        .map((leg, index) => {
          const modeIcon = leg.mode === "metro" ? "🚇 Metro" : leg.mode === "bus" ? "🚌 Bus" : "🚶 Walk";
          const routeName = leg.route ? ` (${leg.route})` : "";
          const stopsInfo = leg.stops ? ` • ${leg.stops} stops` : "";
          return `${index + 1}. **${modeIcon}${routeName}:** ${leg.from} → ${leg.to} (~${leg.minutes} min${stopsInfo})`;
        })
        .join("\n");

      return {
        response:
          `📍 **Planned Route:** **${fromPlace}** to **${toPlace}**\n\n- ⏱️ **Total Duration:** ~${totalMinutes} mins\n- 💰 **Estimated Fare:** ${totalFare}\n- 🎯 **Preference:** ${preference === "cheapest" ? "Cheapest route" : "Fastest route"}\n\n**Journey Steps:**\n${legsList}\n\n*Check the interactive route card below for map visualization and stop details.*`,
        intent: "plan_route",
        routeResult: route,
      };
    }
  }

  // 8. General Transit Guidance Fallback
  return {
    response:
      "I'm here to assist with all your Delhi NCR transit needs! You can ask me to:\n- **Plan a journey:** *'How do I go from Karol Bagh to Gandhi Darshan?'*\n- **Calculate fares:** *'What is the metro fare between Rajiv Chowk and Hauz Khas?'*\n- **Find stations:** *'Search stops near Connaught Place'* \n- **Check status:** *'Are there any delays on Blue Line?'*\n\nWhere would you like to travel?",
    intent: "general_help",
    routeResult: null,
  };
}

/* ------------------------------------------------------------------ */
/*  POST Handler                                                       */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  /* ---- Parse & validate request body ---- */
  let body: { message?: unknown; conversationHistory?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { response: null, error: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json(
      { response: null, error: "A non-empty message is required." },
      { status: 400 }
    );
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      {
        response: null,
        error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`,
      },
      { status: 400 }
    );
  }

  const rawHistory = Array.isArray(body.conversationHistory)
    ? body.conversationHistory
    : [];

  /* ---- Check API Key & Fallback if missing ---- */
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const fallback = handleChatFallback(message);
    return NextResponse.json({
      response: fallback.response,
      intent: fallback.intent,
      routeResult: fallback.routeResult,
    });
  }

  /* ---- Build message array for Groq ---- */
  type ChatMessage = Groq.Chat.Completions.ChatCompletionMessageParam;
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  for (const entry of rawHistory.slice(-MAX_HISTORY_MESSAGES)) {
    if (
      entry &&
      typeof entry === "object" &&
      "role" in entry &&
      "content" in entry
    ) {
      const role = entry.role === "user" ? "user" : "assistant";
      const content = String(entry.content ?? "").slice(0, 4000);
      if (content && !content.startsWith("⚠️")) {
        messages.push({ role, content } as ChatMessage);
      }
    }
  }

  messages.push({ role: "user", content: message });

  /* ---- Call Groq with Function Calling ---- */
  try {
    const groq = new Groq({
      apiKey,
      timeout: GROQ_TIMEOUT_MS,
    });

    const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
    let routeResult: unknown = null;
    let intent: string | null = null;

    let completion = await groq.chat.completions.create({
      model,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      max_tokens: 1024,
      temperature: 0.3,
    });

    let responseMessage = completion.choices[0]?.message;

    // Bounded tool-calling execution loop
    let round = 0;
    while (responseMessage?.tool_calls?.length && round < MAX_TOOL_ROUNDS) {
      round++;
      const toolResultMessages: ChatMessage[] = [];

      for (const call of responseMessage.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }

        intent = call.function.name;
        const { data, isRoute } = executeTool(call.function.name, args);

        if (isRoute && routeResult === null) {
          routeResult = data;
        }

        toolResultMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(data),
        } as ChatMessage);
      }

      messages.push(responseMessage as ChatMessage);
      messages.push(...toolResultMessages);

      completion = await groq.chat.completions.create({
        model,
        messages,
        tools: TOOLS,
        tool_choice: "auto",
        max_tokens: 1024,
        temperature: 0.3,
      });

      responseMessage = completion.choices[0]?.message;
    }

    const finalContent = responseMessage?.content?.trim();

    if (finalContent) {
      return NextResponse.json({
        response: finalContent,
        intent,
        routeResult,
      });
    }

    // If model returned empty content, fallback gracefully
    const fallback = handleChatFallback(message);
    return NextResponse.json({
      response: fallback.response,
      intent: fallback.intent,
      routeResult: routeResult || fallback.routeResult,
    });
  } catch (err: unknown) {
    // Log error internally and fallback smoothly instead of crashing with a 500 error
    console.error(
      "Groq Chat API error (triggering smooth fallback):",
      err instanceof Error ? err.message : "Unknown error"
    );

    const fallback = handleChatFallback(message);
    return NextResponse.json({
      response: fallback.response,
      intent: fallback.intent,
      routeResult: fallback.routeResult,
    });
  }
}
