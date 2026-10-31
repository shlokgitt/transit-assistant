import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getSavedFilePath() {
  // On Vercel serverless, the project filesystem is read-only — use /tmp instead
  if (process.env.VERCEL) return "/tmp/saved-routes.json";

  const primary = path.join(process.cwd(), "backend", "data", "saved-routes.json");
  if (fs.existsSync(primary)) return primary;

  const rootData = path.join(process.cwd(), "..", "data", "saved-routes.json");
  if (fs.existsSync(rootData)) return rootData;

  const alt = path.join(process.cwd(), "data", "saved-routes.json");
  return alt;
}

type SavedRouteItem = {
  id: string;
  name: string;
  from: string;
  to: string;
  preference: string;
  email: string | null;
};

const DEFAULT_ROUTES: SavedRouteItem[] = [
  {
    id: "r1",
    name: "Home to Office",
    from: "Karol Bagh",
    to: "Gandhi Darshan",
    preference: "fastest",
    email: null,
  },
];

function loadRoutes(): SavedRouteItem[] {
  try {
    const file = getSavedFilePath();
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Failed to load saved routes from disk, using defaults:", err);
  }
  return DEFAULT_ROUTES;
}

function persistRoutes(routes: SavedRouteItem[]) {
  try {
    const file = getSavedFilePath();
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(file, JSON.stringify(routes, null, 2), "utf8");
  } catch (err) {
    console.warn("Failed to persist saved routes to disk:", err);
  }
}

export async function GET() {
  const routes = loadRoutes();
  return NextResponse.json(routes);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, from, to, preference, email } = body ?? {};

    if (
      typeof name !== "string" ||
      typeof from !== "string" ||
      typeof to !== "string" ||
      !name.trim() ||
      !from.trim() ||
      !to.trim()
    ) {
      return NextResponse.json(
        { error: "name, from, and to are required" },
        { status: 400 }
      );
    }

    let normalizedEmail: string | null = null;
    if (email !== undefined && email !== null) {
      if (typeof email !== "string") {
        return NextResponse.json({ error: "Invalid email" }, { status: 400 });
      }
      normalizedEmail = email.trim().toLowerCase() || null;
      if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return NextResponse.json({ error: "Invalid email" }, { status: 400 });
      }
    }

    const currentRoutes = loadRoutes();
    const newId = `r_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const newRoute: SavedRouteItem = {
      id: newId,
      name: name.trim(),
      from: from.trim(),
      to: to.trim(),
      preference: preference === "cheapest" ? "cheapest" : "fastest",
      email: normalizedEmail,
    };

    const updated = [newRoute, ...currentRoutes];
    persistRoutes(updated);

    return NextResponse.json(newRoute, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to parse saved route request" },
      { status: 400 }
    );
  }
}
