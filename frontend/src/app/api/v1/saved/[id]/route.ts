import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getSavedFilePath() {
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const file = getSavedFilePath();
    if (!fs.existsSync(file)) {
      return NextResponse.json({ error: "Saved route not found" }, { status: 404 });
    }

    const data = fs.readFileSync(file, "utf8");
    const routes = JSON.parse(data) as SavedRouteItem[];
    const index = routes.findIndex((r) => r.id === id);

    if (index === -1) {
      return NextResponse.json({ error: "Saved route not found" }, { status: 404 });
    }

    const [removed] = routes.splice(index, 1);
    fs.writeFileSync(file, JSON.stringify(routes, null, 2), "utf8");

    return NextResponse.json({ success: true, removed });
  } catch {
    return NextResponse.json({ error: "Failed to delete saved route" }, { status: 500 });
  }
}
