import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Load environment variables from the project root .env file (local dev only).
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
    /* Root .env not found — GROQ_API_KEY must be set via environment variable */
  }
})();

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
];

const nextConfig: NextConfig = {
  // Backend files (route.js, graph.json, data/) are copied into frontend/backend/
  // by the prebuild script — no need to trace outside this directory.
  outputFileTracingIncludes: {
    "/api/**/*": ["./backend/**/*"],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
