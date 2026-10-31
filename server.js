import dotenv from "dotenv";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planByName } from "./route.js";

dotenv.config();

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3001);

app.use((_request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (_request.method === "OPTIONS") {
    return response.sendStatus(204);
  }
  next();
});
app.use(express.json({ limit: "30kb" }));

const SAVED_FILE = path.join(ROOT_DIR, "data", "saved-routes.json");

function saveSavedRoutes(routes) {
  try {
    fs.mkdirSync(path.dirname(SAVED_FILE), { recursive: true });
    fs.writeFileSync(SAVED_FILE, JSON.stringify(routes, null, 2), "utf8");
  } catch (err) {
    console.error("Error persisting saved routes:", err);
  }
}

function loadSavedRoutes() {
  try {
    if (fs.existsSync(SAVED_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SAVED_FILE, "utf8"));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.error("Error loading saved routes:", err);
  }
  const defaults = [
    {
      id: "r1",
      name: "Home to Office",
      from: "Karol Bagh",
      to: "Gandhi Darshan",
      preference: "fastest",
      email: null,
    },
  ];
  saveSavedRoutes(defaults);
  return defaults;
}

let savedRoutes = loadSavedRoutes();

function normalizePreference(value) {
  return value === "cheapest" ? "cheapest" : "fastest";
}

function periodForTime(value) {
  if (!value) return null;
  const match = /^([01]\d|2[0-3]):[0-5]\d$/.exec(value);
  if (!match) return null;

  const hour = Number(match[1]);
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function loadDelays() {
  const file = path.join(ROOT_DIR, "data", "delays.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

app.get("/saved", (_request, response) => {
  response.type("application/json").json(
    savedRoutes.map(({ id, name, from, to, preference, email }) => ({
      id,
      name,
      from,
      to,
      preference,
      email: email || null,
    }))
  );
});

app.post("/saved", (request, response) => {
  const { name, from, to, preference, email } = request.body ?? {};
  if (
    typeof name !== "string" ||
    typeof from !== "string" ||
    typeof to !== "string" ||
    !name.trim() ||
    !from.trim() ||
    !to.trim()
  ) {
    return response.status(400).json({
      error: "name, from, and to are required",
    });
  }

  let normalizedEmail = null;
  if (email !== undefined && email !== null) {
    if (typeof email !== "string") {
      return response.status(400).json({ error: "Invalid email" });
    }
    normalizedEmail = email.trim().toLowerCase() || null;
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return response.status(400).json({ error: "Invalid email" });
    }
  }

  const saved = {
    id: `r_${Date.now().toString(36)}`,
    name: name.trim(),
    from: from.trim(),
    to: to.trim(),
    preference: normalizePreference(preference),
    email: normalizedEmail,
  };
  savedRoutes.unshift(saved);
  saveSavedRoutes(savedRoutes);
  return response.status(201).type("application/json").json(saved);
});

app.delete("/saved/:id/email", (request, response) => {
  const saved = savedRoutes.find((route) => route.id === request.params.id);
  if (!saved) {
    return response.status(404).json({ error: "Saved route not found" });
  }

  saved.email = null;
  saveSavedRoutes(savedRoutes);
  return response.type("application/json").json(saved);
});



app.delete("/saved/:id", (request, response) => {
  const index = savedRoutes.findIndex((r) => r.id === request.params.id);
  if (index === -1) {
    return response.status(404).json({ error: "Saved route not found" });
  }
  const [removed] = savedRoutes.splice(index, 1);
  saveSavedRoutes(savedRoutes);
  return response.type("application/json").json({ success: true, removed });
});
app.get("/route", (request, response) => {
  const from = typeof request.query.from === "string" ? request.query.from.trim() : "";
  const to = typeof request.query.to === "string" ? request.query.to.trim() : "";
  const preference = normalizePreference(request.query.preference);

  if (!from || !to) {
    return response.status(400).json({
      error: "from and to query parameters are required",
    });
  }

  const result = planByName(from, to, {
    preference,
    period: "peak",
  });

  if (!result || result.error) {
    return response.json({ totalMinutes: 0, legs: [] });
  }

  return response.type("application/json").json({
    totalMinutes: result.totalMinutes,
    legs: result.legs.map((leg) => ({
      mode: leg.mode,
      route: leg.mode === "bus" ? String(leg.route || "") : null,
      from: leg.from,
      to: leg.to,
      minutes: leg.minutes,
    })),
  });
});

app.get("/delays", (request, response) => {
  const period = periodForTime(request.query.time);
  if (request.query.time && !period) {
    return response.status(400).json({
      error: "time must use HH:mm format",
    });
  }

  const data = loadDelays();
  const delays = data.delays
    .filter((delay) => !period || delay.time_period === period)
    .map((delay) => ({
      route_id: String(delay.route_id),
      delayMinutes: delay.delay_minutes,
      reason:
        delay.crowd_level === "high"
          ? "Heavy traffic and high crowding"
          : delay.crowd_level === "medium"
            ? "Moderate traffic"
            : "Minor operational delay",
    }));

  return response.type("application/json").json({ delays });
});

app.get("/api/health", (_request, response) => {
  response.type("application/json").json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Transit API listening on http://localhost:${port}`);
});
