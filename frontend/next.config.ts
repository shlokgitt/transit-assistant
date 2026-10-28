import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Load environment variables from the project root .env file.
// Next.js only auto-loads .env from the frontend/ directory; the shared
// GROQ_API_KEY lives one level up in the repository root.
(function loadRootEnv() {
  try {
    const envPath = path.resolve(process.cwd(), "..", ".env");
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq);
      if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1);
    }
  } catch {
    /* Root .env not found — GROQ_API_KEY must be set via environment */
  }
})();

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: path.resolve(process.cwd(), ".."),
  },
};

export default nextConfig;
