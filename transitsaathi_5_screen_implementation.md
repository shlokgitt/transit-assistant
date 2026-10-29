# TransitSaathi AI --- 5-Screen Web App Implementation Guide

**Stack:** React + Vite, Tailwind CSS, React Router,
Leaflet/OpenStreetMap, Node.js + Express, MongoDB Atlas\
**Authentication:** No login page; saved routes are associated with an
anonymous browser ID\
**Purpose:** Hackathon-ready implementation plan for five screens.

> Important: This is an implementation guide and starter architecture.
> The example route timings, fares, crowd levels, and disruptions must
> be labelled as sample data unless connected to verified transport
> data.

------------------------------------------------------------------------

## 1. Screens and user journeys

### Screen 1 --- Home / Route Search

**Goal:** Let a user choose an origin, destination, departure
preference, and routing priority.

**UI components** - App header: TransitSaathi AI logo/name, navigation
links, saved-route count. - Origin input. - Destination input and swap
button. - Travel time selector: leave now / depart at / arrive by
(optional for MVP). - Preference selector: fastest, cheapest, less
walking, fewer transfers. - "Find routes" button. - Map with stops and
route preview (Leaflet). - Recent searches (optional).

**Behavior** 1. Validate that origin and destination are present and
different. 2. Submit the search to the backend. 3. Show loading and
error states. 4. Navigate to Route Results with the returned journey
options.

**Acceptance checks** - Empty inputs show helpful validation. - Unknown
locations do not silently become a different place. - Search errors are
recoverable.

### Screen 2 --- Route Results / Compare Routes

**Goal:** Compare the feasible route alternatives.

**UI components** - Summary: origin → destination. - Route cards:
fastest, cheapest, balanced (only when those options actually exist). -
Each card shows estimated duration, estimated fare, walking distance,
transfers, modes, and any data freshness note. - "View steps", "Save
route", and "Show on map" actions. - Map with a polyline and stop
markers.

**Behavior** - Render values returned by the routing backend; do not
invent results in the UI. - Let users select a route and see its
step-by-step itinerary. - Save the route using the anonymous browser
ID. - If no route exists, explain this and offer the user a way to
change the search.

**Acceptance checks** - Route options have distinct IDs. - Estimates are
labelled as estimates. - The selected route and map remain consistent.

### Screen 3 --- AI Travel Chat

**Goal:** Let users ask for route changes in natural language.

**Example prompts** - "Find the cheapest route." - "Avoid crowded
stations." - "I can walk no more than 500 metres." - "Explain this route
in Hindi."

**UI components** - Conversation history. - Message input and send
button. - Suggested prompts. - Route result card embedded in the chat
when relevant.

**Behavior** 1. Send the message and current trip context to the
backend. 2. Parse intent/preferences with an LLM or a simple rule-based
fallback. 3. Ask the route engine for actual results. 4. Explain those
results using grounded data. 5. If origin/destination is missing, ask a
short follow-up question.

**Reliability rule:** The LLM should not invent stops, schedules, fares,
or live disruptions. Use backend route results as the source of truth.
If using an LLM API, call it from the backend and keep the API key in
environment variables.

### Screen 4 --- Disruption Simulator

**Goal:** Demonstrate route adaptation when transport conditions change.

**UI components** - Service selector. - Delay control (e.g. 0, 5, 10, 15
minutes). - Crowd-level selector (low / medium / high). - Optional
"close connection" toggle. - "Apply scenario" and "Reset" buttons. -
Before/after comparison with the affected route and alternative.

**Behavior** 1. Load a route and its baseline result. 2. Apply a
simulated disruption in the backend. 3. Recalculate routes using updated
edge costs or connection availability. 4. Show the changed estimate and
explain why the route changed. 5. Clearly label the scenario as
simulated.

**Acceptance checks** - Reset restores baseline values. - A closed
connection cannot appear in a valid route. - If no better alternative
exists, say so rather than claiming one.

### Screen 5 --- Saved Journeys

**Goal:** Let users save, reopen, rename, and remove common journeys
without a login page.

**UI components** - Saved route cards (e.g. Home → College). - Origin
and destination. - Last-known preferences. - "Recalculate", "Rename",
and "Remove" actions. - Empty state explaining how to save a route.

**Behavior** - Load routes for the current anonymous browser ID. -
Recalculate from origin, destination, and preferences when reopened; do
not rely on an old arrival time. - Allow route deletion. - Explain that
saved routes are tied to this browser unless a recovery/sync feature is
added.

------------------------------------------------------------------------

## 2. Suggested project structure

``` text
transitsaathi/
  client/
    src/
      components/
        AppHeader.jsx
        RouteSearchForm.jsx
        RouteCard.jsx
        TransitMap.jsx
        ChatMessage.jsx
      pages/
        HomePage.jsx
        ResultsPage.jsx
        ChatPage.jsx
        DisruptionPage.jsx
        SavedRoutesPage.jsx
      lib/
        api.js
        anonymousId.js
      App.jsx
      main.jsx
  server/
    src/
      models/
        SavedRoute.js
      routes/
        savedRoutes.js
        journey.js
        chat.js
        simulation.js
      services/
        routeEngine.js
        intentParser.js
      app.js
    .env
```

------------------------------------------------------------------------

## 3. Frontend setup

Create the app:

``` bash
npm create vite@latest client -- --template react
cd client
npm install
npm install react-router-dom leaflet react-leaflet
npm install -D tailwindcss @tailwindcss/vite
```

Configure Tailwind according to the current Tailwind Vite installation
instructions. Import Leaflet CSS in `src/main.jsx`:

``` js
import 'leaflet/dist/leaflet.css';
```

Create a separate backend:

``` bash
mkdir server
cd server
npm init -y
npm install express mongoose cors dotenv helmet express-rate-limit
npm install -D nodemon
```

Add `"type": "module"` to `server/package.json` and a development script
such as `"dev": "nodemon src/app.js"`.

------------------------------------------------------------------------

## 4. Navigation

Use React Router to provide five separate screens.

``` jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ResultsPage from './pages/ResultsPage';
import ChatPage from './pages/ChatPage';
import DisruptionPage from './pages/DisruptionPage';
import SavedRoutesPage from './pages/SavedRoutesPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/disruptions" element={<DisruptionPage />} />
        <Route path="/saved" element={<SavedRoutesPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

------------------------------------------------------------------------

## 5. Anonymous browser ID

Create `client/src/lib/anonymousId.js`:

``` js
const STORAGE_KEY = 'transitsaathi-anonymous-id';

export function getAnonymousId() {
  let id = localStorage.getItem(STORAGE_KEY);

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }

  return id;
}
```

This is an identifier, **not authentication**. If the API accepts any
caller-provided ID and returns all routes for it, a person who guesses
or obtains another ID could access those routes. For a private or
production app, use proper authentication or a server-issued, revocable
anonymous session token with authorization checks. For a hackathon demo,
keep stored information non-sensitive and add rate limiting and
validation.

------------------------------------------------------------------------

## 6. Frontend API helper

Create `client/src/lib/api.js`:

``` js
import { getAnonymousId } from './anonymousId';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Anonymous-Id': getAnonymousId(),
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || 'Request failed');
  }
  return body;
}

export function saveRoute(route) {
  return request('/api/saved-routes', {
    method: 'POST',
    body: JSON.stringify(route),
  });
}

export function getSavedRoutes() {
  return request('/api/saved-routes');
}

export function deleteSavedRoute(id) {
  return request(`/api/saved-routes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function findRoutes(search) {
  return request('/api/journeys', {
    method: 'POST',
    body: JSON.stringify(search),
  });
}

export function sendChatMessage(message, context = {}) {
  return request('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, context }),
  });
}

export function simulateDisruption(scenario) {
  return request('/api/simulations', {
    method: 'POST',
    body: JSON.stringify(scenario),
  });
}
```

Add `client/.env`:

``` text
VITE_API_BASE_URL=http://localhost:4000
```

Only public frontend configuration belongs in `VITE_` variables. Never
put database credentials or private AI API keys in the client
environment.

------------------------------------------------------------------------

## 7. Backend and MongoDB

Create a MongoDB Atlas database and place its connection string in
`server/.env`:

``` text
PORT=4000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<database>
CLIENT_ORIGIN=http://localhost:5173
```

Do not commit `.env` to Git. Use a restricted database user and network
access settings suitable for your deployment.

### Saved route model

`server/src/models/SavedRoute.js`:

``` js
import mongoose from 'mongoose';

const savedRouteSchema = new mongoose.Schema(
  {
    anonymousUserId: {
      type: String,
      required: true,
      index: true,
    },
    name: { type: String, required: true, maxlength: 100 },
    origin: { type: String, required: true, maxlength: 200 },
    destination: { type: String, required: true, maxlength: 200 },
    preferences: {
      priority: {
        type: String,
        enum: ['fastest', 'cheapest', 'less-walking', 'fewer-transfers'],
        default: 'fastest',
      },
      maxWalkingMeters: { type: Number, min: 0, max: 50000 },
    },
  },
  { timestamps: true }
);

savedRouteSchema.index({ anonymousUserId: 1, createdAt: -1 });

export default mongoose.model('SavedRoute', savedRouteSchema);
```

### Saved-route API routes

`server/src/routes/savedRoutes.js`:

``` js
import { Router } from 'express';
import mongoose from 'mongoose';
import SavedRoute from '../models/SavedRoute.js';

const router = Router();

function getOwnerId(req, res) {
  const id = req.get('X-Anonymous-Id');

  // Basic format validation only; this does NOT prove identity.
  if (!id || !/^[a-zA-Z0-9-]{16,80}$/.test(id)) {
    res.status(400).json({ error: 'Valid anonymous ID required' });
    return null;
  }

  return id;
}

router.get('/', async (req, res, next) => {
  try {
    const ownerId = getOwnerId(req, res);
    if (!ownerId) return;

    const routes = await SavedRoute.find({ anonymousUserId: ownerId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ routes });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const ownerId = getOwnerId(req, res);
    if (!ownerId) return;

    const { name, origin, destination, preferences = {} } = req.body ?? {};
    if (
      typeof name !== 'string' ||
      typeof origin !== 'string' ||
      typeof destination !== 'string' ||
      !name.trim() ||
      !origin.trim() ||
      !destination.trim()
    ) {
      return res.status(400).json({ error: 'Name, origin, and destination are required' });
    }

    const route = await SavedRoute.create({
      anonymousUserId: ownerId,
      name: name.trim(),
      origin: origin.trim(),
      destination: destination.trim(),
      preferences: {
        priority: preferences.priority ?? 'fastest',
        ...(Number.isFinite(preferences.maxWalkingMeters)
          ? { maxWalkingMeters: preferences.maxWalkingMeters }
          : {}),
      },
    });

    res.status(201).json({ route });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const ownerId = getOwnerId(req, res);
    if (!ownerId) return;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid route ID' });
    }

    const result = await SavedRoute.deleteOne({
      _id: req.params.id,
      anonymousUserId: ownerId,
    });

    if (!result.deletedCount) {
      return res.status(404).json({ error: 'Saved route not found' });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
```

### Express app

`server/src/app.js`:

``` js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import savedRoutes from './routes/savedRoutes.js';

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN }));
app.use(express.json({ limit: '30kb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 100 }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/saved-routes', savedRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 4000;

await mongoose.connect(process.env.MONGODB_URI);
app.listen(port, () => console.log(`API listening on ${port}`));
```

This is a starter implementation, not production-grade anonymous-user
authentication. A browser-generated ID can be copied or spoofed. For
production, use proper authorization or a secure anonymous-session
design; do not store sensitive user information with this basic scheme.

------------------------------------------------------------------------

## 8. Example: Save a route from React

A minimal save action can call the API helper:

``` jsx
import { useState } from 'react';
import { saveRoute } from '../lib/api';

export default function SaveRouteButton({ route }) {
  const [status, setStatus] = useState('idle');

  async function handleSave() {
    try {
      setStatus('saving');
      await saveRoute({
        name: `${route.origin} to ${route.destination}`,
        origin: route.origin,
        destination: route.destination,
        preferences: route.preferences ?? { priority: 'fastest' },
      });
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <button onClick={handleSave} disabled={status === 'saving'}>
      {status === 'saving'
        ? 'Saving…'
        : status === 'saved'
        ? 'Saved'
        : status === 'error'
        ? 'Try again'
        : 'Save route'}
    </button>
  );
}
```

For the complete app, add a duplicate-save check or allow users to
rename and remove saved routes.

------------------------------------------------------------------------

## 9. API contract for all five screens

  --------------------------------------------------------------------------------
  Screen                  Endpoint                         Purpose
  ----------------------- -------------------------------- -----------------------
  Home / Search           `POST /api/journeys`             Calculate route options

  Route Results           `POST /api/journeys`             Recalculate or compare
                                                           options

  AI Chat                 `POST /api/chat`                 Parse request, call
                                                           route engine, explain
                                                           results

  Disruption Simulator    `POST /api/simulations`          Recalculate with
                                                           simulated conditions

  Saved Journeys          `GET /api/saved-routes`          List saved routes

  Saved Journeys          `POST /api/saved-routes`         Save a route

  Saved Journeys          `DELETE /api/saved-routes/:id`   Remove a saved route
  --------------------------------------------------------------------------------

The journey, chat, and simulation endpoints are contracts to implement;
only the saved-route endpoint code is included above. Keep route
calculation in a separate service so it can be tested without the UI.

------------------------------------------------------------------------

## 10. Map integration notes

Use React Leaflet to show a map and route geometry returned by the
backend. A map library displays map tiles and markers; it does not
automatically calculate public transport journeys.

-   Use real coordinates for stops.
-   Draw a polyline using the calculated route geometry.
-   Clearly distinguish walking and transit segments.
-   Attribute OpenStreetMap data and follow the tile provider's usage
    policy.
-   Do not draw an invented straight line and present it as the actual
    road or transit path.

------------------------------------------------------------------------

## 11. Environment and deployment checklist

-   [ ] `client/.env` has only the public API base URL.
-   [ ] `server/.env` has MongoDB URI and server configuration.
-   [ ] `.env` files are excluded from Git.
-   [ ] MongoDB database user has limited permissions.
-   [ ] Backend validates request bodies and limits payload size.
-   [ ] CORS permits only the deployed frontend origin.
-   [ ] Anonymous IDs are treated as identifiers, not authentication.
-   [ ] Sample delay/crowd data is labelled as simulated.
-   [ ] Saved routes can be listed and deleted.
-   [ ] Reopening a saved route triggers a fresh route calculation.
-   [ ] Error, loading, and empty states are implemented.
-   [ ] All five screens are tested on desktop and mobile.

## 12. Suggested build order

1.  Build the Home search screen with a small sample transport dataset.
2.  Implement a route engine and display results on Screen 2.
3.  Add the saved-route API and Screen 5.
4.  Add the disruption simulator and Screen 4.
5.  Add chat and connect it to the same route engine on Screen 3.
6.  Finish the map, error states, responsive layout, and deployment.

**Hackathon principle:** Make the full journey work end to end before
adding optional features. The strongest demo is one where a judge can
search a route, compare options, change a simulated delay, see a
different recommendation, and save that journey without logging in.
