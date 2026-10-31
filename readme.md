# Transit Assistant

Transit Assistant is a Delhi NCR multimodal journey planner for metro, bus, auto/cab, and walking trips. It includes route comparison, maps, saved journeys, disruption simulation, transit status, and an AI travel assistant.

This is a demo and development project. Results are based on repository datasets and should be verified against current operator information before important journeys.

## Features

- Multimodal Delhi NCR route planning.
- Fastest, cheapest, shortest, least-transfer, and eco preferences.
- Metro, bus, auto/cab, and walking legs.
- Stop and landmark autocomplete.
- Route cards with duration, fare, transfers, crowding, and delays.
- Leaflet map visualization.
- AI Travel Chat with route-planning tools.
- Saved journeys and optional alert-email fields.
- Disruption simulator.
- Responsive desktop, tablet, and mobile layouts.
- Reduced-motion support and accessible navigation behavior.

## Technology stack

- **Frontend:** Next.js 16 App Router, React 19, TypeScript, Leaflet, Lucide React, CSS.
- **Backend:** Node.js, Express 5, custom graph/routing logic, CSV/JSON datasets.
- **AI:** Groq SDK with tool calling for the Travel Chat feature.
- **Data:** Metro, fare, delay, road-distance, and GTFS-derived data.
- **Persistence:** Saved journeys are persisted to `data/saved-routes.json` and survive backend restarts. On Vercel serverless, routes are stored in `/tmp` per instance with client-side `localStorage` offline caching.
- **Evaluation & Documentation:** See [docs/FINAL_PRESENTATION_DOSSIER.md](./docs/FINAL_PRESENTATION_DOSSIER.md) for judge presentation pillars and team contributions, and [docs/DATABASE_ARCHITECTURE.md](./docs/DATABASE_ARCHITECTURE.md) for database specifications.

## Repository structure

```text
.
├── server.js                 # Express server and demo API
├── route.js                  # Core route planning and stop lookup
├── data/                     # Transit, fare, delay, and distance datasets
├── gtfs/                     # GTFS-derived source data, when present
├── scripts/                  # Dataset/build utilities
├── *.test.js                 # Node test suites
└── frontend/
    ├── src/app/page.tsx      # Main screens and navigation
    ├── src/components/       # Planner, route cards, maps, and UI
    ├── src/app/api/          # Next.js API routes
    ├── backend/              # Frontend route/data modules
    └── public/               # Static transport assets
```

## Architecture

```text
Browser
  └── Next.js UI
      ├── Plan a Trip
      ├── Results
      ├── Travel Chat
      ├── Simulator
      └── Saved Journeys
          ├── Next.js API routes
          │   ├── /api/v1/routes/plan
          │   ├── /api/v1/stops/search
          │   ├── /api/v1/chat
          │   └── /api/v1/transit/status
          └── Express APIs
              ├── /api/health
              ├── /route
              ├── /delays
              └── /saved
```

The planner calls `/api/v1/routes/plan`, which uses shared route and dataset modules to create normalized route alternatives. The UI renders those alternatives as route cards, itineraries, and map legs. Travel Chat uses the same route and stop tools when a Groq key is configured.

## Requirements

- Node.js 18 or newer; Node.js 20+ is recommended.
- npm.
- A modern browser.
- Optional Groq API key for AI responses.
- Optional Delhi Open Transit Data API key for live bus positions.

## Local setup

```bash
git clone https://github.com/shlokgitt/transit-assistant.git
cd transit-assistant
npm install
cd frontend
npm install
cd ..
```

Create a root `.env` file. Never commit it:

```env
PORT=5000
GROQ_API_KEY=your_groq_key
GROQ_MODEL=openai/gpt-oss-120b
OTD_API_KEY=your_otd_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

The optional AI and live-status keys can be omitted.

Start the backend from the repository root:

```bash
npm start
```

Start the frontend in a second terminal:

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000`. The backend health endpoint is `http://localhost:5000/api/health`. Without `PORT`, the Express server defaults to port `3001`.

## Production-style local run

```bash
cd frontend
npm run build
npm run start
```

Run the Express server separately with `npm start`.

## Tests and checks

From the repository root:

```bash
npm test
```

Frontend checks:

```bash
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```

Some legacy files may have baseline lint warnings or errors. New failures in changed files should be fixed before release.

## API reference

### `POST /api/v1/routes/plan`

Plans route alternatives.

```json
{
  "city": "delhi",
  "origin": { "query": "Karol Bagh" },
  "destination": { "query": "Gandhi Darshan" },
  "preferences": {
    "routingPriority": "fastest",
    "allowedModes": ["metro", "bus", "walk"],
    "avoidCrowded": false,
    "period": "auto"
  },
  "constraints": {
    "maxBudget": 50,
    "maxTransfers": 2
  }
}
```

Delhi NCR is currently the supported planning city. Constraints are optional and disabled by default in the UI.

### `GET /api/v1/stops/search?city=delhi&q=Karol`

Returns up to eight matching stops, stations, or landmarks.

### `POST /api/v1/chat`

Accepts chat history and returns a transit response. Model-backed responses require `GROQ_API_KEY`; supported general intents may use deterministic fallback behavior.

### `GET /api/v1/health`

Returns route-data health information and a sample stop lookup.

### `GET /api/v1/transit/status?city=delhi`

Uses the Delhi OTD feed when `OTD_API_KEY` is configured. Otherwise live vehicle data is unavailable.

### Express endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Backend health check |
| `GET /route?from=Karol%20Bagh&to=Gandhi%20Darshan&preference=fastest` | Compact route response |
| `GET /delays?time=08:30` | Delay records for a time period |
| `GET /saved` | In-memory saved journeys |
| `POST /saved` | Create a saved journey |
| `DELETE /saved/:id/email` | Clear a journey's alert email |

Example saved journey:

```json
{
  "name": "Home to Office",
  "from": "Karol Bagh",
  "to": "Gandhi Darshan",
  "preference": "fastest",
  "email": "commuter@example.com"
}
```

## Demo data and requests

Useful locations include `Karol Bagh`, `Rajiv Chowk`, `Gandhi Darshan`, `Connaught Place`, `Hauz Khas`, and `Kashmere Gate`.

PowerShell example:

```powershell
$body = @{
  city = "delhi"
  origin = @{ query = "Karol Bagh" }
  destination = @{ query = "Gandhi Darshan" }
  preferences = @{
    routingPriority = "fastest"
    allowedModes = @("metro", "bus", "walk")
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/v1/routes/plan" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

## Dataset templates and disclosure

Important files include:

- `data/metro.json`: metro stations, lines, and network information.
- `data/fares.json`: fare data.
- `data/delays.json`: simulated delays and crowd levels.
- `data/road-distances.json`: road-distance estimates.
- `data/metro-fares/*.csv`: fare tables for supported networks.
- `frontend/backend/data/`: frontend route/data support files.
- `gtfs/`: GTFS-derived data where available.

Delay records follow this shape:

```json
{
  "route_id": "534",
  "time_period": "morning",
  "delay_minutes": 10,
  "crowd_level": "high"
}
```

Delay and crowd values are simulated sample data, not guaranteed live information. Dataset refreshes should be reviewed for schema and licensing changes.

## Failure cases

| Case | Expected behavior |
|---|---|
| Empty origin or destination | UI requests both locations |
| Same origin and destination | Validation error |
| Unknown place | Failed route response and UI error state |
| Unsupported city | HTTP 400 |
| Invalid delay time | `GET /delays` returns HTTP 400 |
| Missing Groq key | Fallback response or AI-unavailable message |
| Missing OTD key | Live status unavailable |
| Backend unavailable | Saved-route requests fail visibly |
| Empty saved list | Empty-state UI |
| Reduced-motion preference | Animations are disabled |

## Security and privacy

- Never commit `.env`, API keys, generated databases, or personal route data.
- The saved-route API currently has no authentication or account ownership.
- Tighten CORS, rate limiting, authorization, logging, and validation before public deployment.
- AI chat content may be sent to the configured model provider.
- Do not use the demo saved-route API for sensitive personal information.

## Known limitations

- walking route shows only straight line distance
- Static fares, delays, and travel times can become stale.
- Saved journeys are persisted to `data/saved-routes.json` and survive backend restarts. On Vercel, routes are stored in `/tmp` per instance with client-side `localStorage` offline caching.
- Live status depends on an external API and key.
- AI answers can be incomplete; structured route results should be trusted over free-form prose.
- Production observability, authentication, rate limiting, and automated deployment checks are incomplete.
- Some legacy components may have baseline lint maintenance issues.
- train is into intrgation and testing and will be deployed shortly

## Disruption Simulator Implementation

The simulator now fully integrates with the routing engine, providing realistic impact of delays, crowd conditions, and service disruptions on journey calculations.

### Features Implemented
- **Delay Awareness:** Service‑specific delay simulation applied at runtime without mutating original GTFS data.
- **Crowd Awareness:** Station‑level crowd conditions (Low, Medium, High) affecting routing decisions and UI warnings.
- **Service Disruption:** Ability to temporarily disable a service, causing the planner to find alternative routes.
- **Before/After Comparison:** Functional comparison panel showing original vs. simulated routes, durations, fares, transfers, added delay, crowd warnings, and percentage changes.
- **Routing Engine Integration:** Simulation overlay applied immutably to the existing Dijkstra‑based planner, preserving all existing preferences, fare calculations, and interchange logic.
- **Journey Time Bug Fixes:** Correct GTFS time parsing (including “24:xx” times), proper midnight handling, and removal of duplicate delay calculations.
- **State Management:** Temporary simulation state is scoped to the current scenario and resettable via “Reset to Normal” without affecting the base graph.
- **Frontend & Chat Integration:** UI controls propagate a `DisruptionScenario` object to the route‑plan API and chat backend, enabling simulation through the planner and AI chat.

### API Changes
- `POST /api/v1/routes/plan` now accepts an optional `scenario` field describing delays, disabled services, and crowd levels.
- Chat endpoint (`/api/v1/chat`) forwards the same `scenario` when planning routes via AI tools.

### Usage
- Open the **Simulator** pane, configure delay, crowd, or disable a service, and click **Apply & Simulate**.
- The **Before/After** panel updates with actual recalculated results.
- Click **Reset to Normal** to clear the scenario.

## Future roadmap

1. Add authenticated users and durable saved-journey storage.
2. Add scheduled GTFS, fare, delay, and road-data ingestion.
3. Add cached live service alerts and vehicle positions.
4. Add shareable route URLs and offline-friendly behavior.
5. Improve accessibility and visual regression coverage.
6. Add rate limiting, structured logs, tracing, and error monitoring.
7. Expand support beyond Delhi NCR.

## AI-assisted development disclosure

Development used AI-assisted tools, including GitHub Copilot CLI. The product's Travel Chat uses Groq-compatible model calls and deterministic transit tools; these are separate from the development tools.

AI assistance supported code exploration, implementation, debugging, UI iteration, documentation, and test guidance. Human review remains necessary for route correctness, data freshness, security, accessibility, and deployment decisions.

## Contribution checklist

Before opening a pull request:

1. Keep changes scoped.
2. Remove secrets and personal data from commits.
3. Run `npm test`.
4. Run `cd frontend && npx tsc --noEmit`.
5. Run `cd frontend && npm run build`.
6. Check desktop, tablet, and narrow mobile layouts.
7. Document new environment variables, datasets, and limitations.

## License and data rights

Review the licensing and redistribution terms of external GTFS, fare, map, icon, image, and API datasets before public distribution. Application code and bundled data may have different rights.
