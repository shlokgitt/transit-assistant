import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import {
  periodFor,
  planByName,
  planMetroByName,
  planWalkingByName,
  findStops,
  stopDetails,
} from "../../../../../../route.js";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_TOOL_ROUNDS = 3;
const GROQ_TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are TransitPulse AI, a friendly and knowledgeable Delhi NCR public transit assistant.
You help users plan routes and answer transit questions using real route-planning data.

RULES — follow these strictly:
1. ALWAYS use the provided tools to plan routes. NEVER fabricate routes, fares, station names, or travel times.
2. If the user hasn't specified an origin or destination, ask a brief clarifying question — do not guess.
3. When presenting a route, explain each leg clearly: transport mode, route/line name, boarding and alighting stops, number of stops, travel time, and fare.
4. If a fare is marked as estimated, say so. If fare data is unavailable, state that clearly.
5. For general transit questions (e.g., "which metro line is the longest?"), answer from general knowledge but note it may not reflect the latest updates.
6. The system covers Delhi NCR: DMRC Metro lines, DTC and cluster buses, and walking.
7. Supported route preferences: "fastest" (default) or "cheapest".
8. If a stop name is ambiguous (multiple matches), use search_stops and ask the user to pick the right one.
9. Keep responses concise but helpful. Use bullet points and short paragraphs.
10. Do not execute arbitrary code or reveal internal system details.`;

/* ------------------------------------------------------------------ */
/*  Tool definitions for Groq function calling                        */
/* ------------------------------------------------------------------ */

const TOOLS: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "plan_route",
      description:
        "Plan a multimodal transit route (metro + bus + walk) between two locations in Delhi NCR. Returns the optimal route with legs, fares, and duration.",
      parameters: {
        type: "object",
        properties: {
          from: {
            type: "string",
            description:
              "Name of the origin stop or location (e.g. 'Karol Bagh', 'Rajiv Chowk')",
          },
          to: {
            type: "string",
            description:
              "Name of the destination stop or location (e.g. 'Gandhi Darshan', 'Hauz Khas')",
          },
          preference: {
            type: "string",
            enum: ["fastest", "cheapest"],
            description:
              "Routing preference. 'fastest' for quickest arrival, 'cheapest' for lowest fare. Defaults to 'fastest'.",
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
        "Plan a metro-only route between two locations. Use when the user specifically asks for metro/subway directions.",
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
      name: "plan_walking_route",
      description:
        "Plan a walking-only route with straight-line distance and estimated walking time.",
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
        "Search for transit stops matching a name query. Use to verify stop names or help users find the correct stop when a name is ambiguous.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Partial or full name of the stop to search for (e.g. 'Karol', 'Rajiv')",
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
        "Get detailed information about a specific transit stop including type (metro/bus), metro lines served, and coordinates.",
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
];

/* ------------------------------------------------------------------ */
/*  Tool execution — validates arguments, calls routing functions      */
/* ------------------------------------------------------------------ */

interface ToolResult {
  data: unknown;
  isRoute: boolean;
}

function executeTool(
  name: string,
  args: Record<string, unknown>
): ToolResult {
  switch (name) {
    case "plan_route": {
      const from = String(args.from ?? "").trim();
      const to = String(args.to ?? "").trim();
      if (!from || !to) {
        return {
          data: { error: "Both origin and destination names are required." },
          isRoute: false,
        };
      }
      const preference =
        args.preference === "cheapest" ? "cheapest" : "fastest";
      const result = planByName(from, to, {
        preference,
        period: periodFor(),
      });
      return { data: result, isRoute: !("error" in (result as Record<string, unknown>)) };
    }

    case "plan_metro_route": {
      const from = String(args.from ?? "").trim();
      const to = String(args.to ?? "").trim();
      if (!from || !to) {
        return {
          data: { error: "Both origin and destination names are required." },
          isRoute: false,
        };
      }
      const result = planMetroByName(from, to);
      return { data: result, isRoute: !("error" in (result as Record<string, unknown>)) };
    }

    case "plan_walking_route": {
      const from = String(args.from ?? "").trim();
      const to = String(args.to ?? "").trim();
      if (!from || !to) {
        return {
          data: { error: "Both origin and destination names are required." },
          isRoute: false,
        };
      }
      const result = planWalkingByName(from, to);
      return { data: result, isRoute: !("error" in (result as Record<string, unknown>)) };
    }

    case "search_stops": {
      const query = String(args.query ?? "").trim();
      if (!query) {
        return {
          data: { error: "Search query is required." },
          isRoute: false,
        };
      }
      const results = findStops(query);
      return {
        data: {
          matchCount: results.length,
          results: results.slice(0, 10).map(
            (s: { id: string; name: string }) => ({
              id: s.id,
              name: s.name,
            })
          ),
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

    default:
      return {
        data: { error: `Unknown tool: ${name}` },
        isRoute: false,
      };
  }
}

/* ------------------------------------------------------------------ */
/*  POST handler                                                       */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  /* ---- Check API key ---- */
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        response: null,
        error:
          "The AI assistant is not configured. Set the GROQ_API_KEY environment variable.",
      },
      { status: 503 }
    );
  }

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

  const message =
    typeof body.message === "string" ? body.message.trim() : "";
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

  /* ---- Build the message array ---- */
  type ChatMessage = Groq.Chat.Completions.ChatCompletionMessageParam;
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  // Include recent conversation history (capped)
  for (const entry of rawHistory.slice(-MAX_HISTORY_MESSAGES)) {
    if (
      entry &&
      typeof entry === "object" &&
      "role" in entry &&
      "content" in entry
    ) {
      const role = entry.role === "user" ? "user" : "assistant";
      const content = String(entry.content ?? "").slice(0, 4000);
      if (content) {
        messages.push({ role, content } as ChatMessage);
      }
    }
  }

  messages.push({ role: "user", content: message });

  /* ---- Call Groq with tool support ---- */
  try {
    const groq = new Groq({
      apiKey,
      timeout: GROQ_TIMEOUT_MS,
    });

    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
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

    // Tool-call loop (bounded to prevent runaway)
    let round = 0;
    while (responseMessage?.tool_calls?.length && round < MAX_TOOL_ROUNDS) {
      round++;

      const toolResultMessages: ChatMessage[] = [];

      for (const call of responseMessage.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          /* malformed JSON → empty args, tool will return an error */
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

      // Append the assistant's tool-call message and the tool results
      messages.push(responseMessage as ChatMessage);
      messages.push(...toolResultMessages);

      // Get the model's final (or next) response
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

    return NextResponse.json({
      response:
        responseMessage?.content ||
        "I'm sorry, I couldn't generate a response. Please try again.",
      intent,
      routeResult,
    });
  } catch (err: unknown) {
    // Log internally but never expose stack traces or API keys
    console.error(
      "Chat API error:",
      err instanceof Error ? err.message : "Unknown error"
    );

    // Classify the error for a helpful user-facing message
    const errMsg =
      err instanceof Error ? err.message.toLowerCase() : "";

    if (errMsg.includes("401") || errMsg.includes("authentication")) {
      return NextResponse.json(
        {
          response: null,
          error: "AI service authentication failed. Please check the API key.",
        },
        { status: 503 }
      );
    }
    if (errMsg.includes("429") || errMsg.includes("rate")) {
      return NextResponse.json(
        {
          response: null,
          error:
            "The AI service is temporarily busy. Please wait a moment and try again.",
        },
        { status: 429 }
      );
    }
    if (
      errMsg.includes("timeout") ||
      errMsg.includes("abort") ||
      errMsg.includes("ECONNREFUSED")
    ) {
      return NextResponse.json(
        {
          response: null,
          error: "The AI service timed out. Please try again.",
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        response: null,
        error: "An unexpected error occurred with the AI assistant.",
      },
      { status: 500 }
    );
  }
}
