## Delhi Transit Assistant

A web app that plans bus (and, where data allows, metro) routes in Delhi and lets you ask questions about them in chat. Built for Deviathon 2.0, problem statement DEV-P05: Public Transit Route Assistant (Meridian, theme Mission Bharat, build type: AI app or agent, target users: daily commuters and tourists).

Status: work in progress. See Current progress for what actually works today. Update that section whenever something changes.

## Problem

Commuters who mix bus, metro and rail have no single place to compare options. The app suggests the fastest or cheapest route from schedule data and answers follow-up questions in chat.

## Scope decisions

- City: Delhi only. It has public GTFS data for buses, which is rare in India, and the problem statement asks for one city and a small scope.

- Area: a central-Delhi bounding box (set in filter-gtfs.js). The full bus feed is about 118 MB of stop times, so the app runs on a filtered slice.

- Delay and crowd data is sample data, as the problem allows. It is not live.

- Modes: bus routing is built; metro routing is generated from the extracted DMRC GTFS feed in `metro/`. Rail is not covered.

## Team and responsibilities

|   | Member Section Why this split Shlok Routing engine + AI chat agent (the hardest Everything else depends on routes part): graph model, Dijkstra, cheapest mode, being correct, and the agent must call metro merge, LLM tool calling the engine instead of guessing Shrijan Frontend: React app, Leaflet map with the route Needs the API contract below, so it can drawn, from/to form, chat panel, delay and start with mock data crowd badges, saved-routes list |
| --- | --- |
|   | Standby Backend API and storage: Express endpoints, Wraps the engine's functions and gives stop search, saved routes in SQLite or the frontend something to call MongoDB, deployment ShriyamSample data and docs (the easiest part): delay Self-contained and needs no other part and crowd JSON, fare table research, test to be finished first queries, README upkeep, demo script |


## Task details

## Shlok

- Finish and test route.js, add cheapest mode using a fare rule

- Merge metro data into the graph if the DMRC feed is available

- Add delay and crowd weights from Shriyam's JSON

- Build the chat agent: tool definitions, the call loop, ambiguity handling for stop names

## Shrijan

- Build the UI against the API contract using mock responses first

- Draw the route legs on the map; show walk and bus legs differently

- Chat panel, saved-routes list, "delayed" and "crowded" badges

## Standby

- Express server with /stops, /route, /delays, /saved, /chat

- Saved routes storage

- Deploy the backend and frontend, and add environment config

## Shriyam

- data/delays.json: sample delay and crowd levels per route and time of day

- data/fares.json: a simple fare rule. Check the real fare structure before writing numbers, and note it as an assumption in the README

- A list of 10 test chat queries and their expected behaviour

- Keep this README current and prepare the demo script

## Current progress

## Done

Delhi bus GTFS downloaded (DTC feed from the Mobility Database)

GTFS filtered to a central-Delhi box: 1,134 stops, 872,294 stop times, 53,799 trips, 1,858

routes

- Graph built (build-graph.js): 29,393 route nodes, 27,728 ride edges, 1,598 walking links

Routing engine written (route.js): Dijkstra with a boarding cost, multi-stop name matching, readable legs

- Metro GTFS converter implemented (`scripts/build-metro-data.js`): 262 stations, 12 lines, and 616 route-adjacent connections derived from trip stop sequences and scheduled times.

- Metro merge implemented (`merge-metro.js`): validates a candidate graph before replacement, creates a timestamped backup, preserves bus edges, and adds metro-to-bus walking transfers. The current graph contains 1,396 stops and 1,870 routes.

- Routing tests cover bus, metro, bus-to-metro, GTFS parsing, platform/parent stations, malformed data, topology, duplicate-edge prevention, and repeated-merge idempotence.

## In progress / next


| Status Task [x] Test the routing engine on real stop pairs (test-route.js) [x] Cheapest route: fare rule in the engine [x] Sample delay and crowd data (data/delays.json) [x] Metro GTFS conversion and merge [ ] Refresh metro GTFS when a newer feed is available [ ] Express API (/stops, /route, /delays, /saved, /chat) [ ] Saved routes storage [ ] Frontend with map, route form, badges [ ] Saved-routes list in the UI [ ] Chat agent with tool calling | Owner Shlok Shlok Shriyam Shlok Shlok Standby Standby Shrijan Shrijan Shlok |
| --- | --- |
| [ ] Chat panel in the UI [ ] Test queries and demo script [ ] Deployment | Shrijan Shriyam Standby |

## Not planned unless time allows

- Rail (no feed found yet)

- Live data


## How it works

- 1. Graph: every bus stop has an S: hub and each metro station has an M: hub. Every transit (stop, route) pair has its own R: node. Ride edges move along explicit consecutive connections, boarding edges add a fixed cost, alighting costs 0, and walking edges join nearby hubs.

- 2. Routing: Dijkstra over that graph, started from every stop that matches the typed name.

- 3. Chat: the LLM does not compute routes. It turns a message into calls to tools (plan_route, get_delays, save_route, list_saved_routes) and explains the result, so it cannot invent stops or times.

## API contract

The frontend and backend work against this shape, so agree on it before coding.

Route response, as produced by plan() in route.js:

json


```
{
"totalMinutes":42.5,
"legs":[
{"mode":"walk","from":"Stop A","to":"Stop B","minutes":2.5},
{"mode":"bus","route":"534","from":"Stop B","to":"Stop C","stops":
]
}
```

## Data sources and limitations

| Source | Used for |
| --- | --- |
| Delhi Transport Corporation bus GTFS, via the Mobility Database (IIIT- | Stops, routes, trips, stop |
| Delhi open data terms) | times |
| OpenStreetMap | Map tiles |
| Hand-made JSON | Sample delays, crowd |
|   | levels, fares |

- Bus times in stop_times.txt are estimates, not real timetables. Travel time on each hop is an average over all trips.

- The feed's service dates are old (Jan 2022 to Jan 2024). The app ignores the calendar and treats the data as a generic weekday timetable.

- The 5-minute boarding cost is a fixed guess, not real headway data.

- The feed has no fares, so the cheapest mode uses a simplified fare rule.

- Metro coverage comes from a historical DMRC GTFS snapshot in `metro/`. Its calendar ends on 2025-12-31, so it is not current live data.

- Metro travel times are averages of scheduled consecutive-stop times from the feed. Fare integration uses the manually structured `data/metro-fares/` references only for Airport Express matrix fares and Noida station-count fares. DMRC standard and Rapid Metro fares remain unavailable because reliable route-distance or verified fare rules are not yet available.

- Delays and crowding are sample values.

## Tech stack

- Frontend: React, Leaflet

- Backend: Node.js, Express

- Storage:SQLite or MongoDB, to be decided

- LLM:provider and model, to be decided

## Getting started

Requires Node.js 18 or later.

bash


```
gitclonehttps://github.com/shlokgitt/transit-assistant.git
cdtransit-assistant
npminstall
# Download the Delhi bus GTFS and unzip it into ./gtfs-raw/
# (large files are not stored in git, see below)
nodefilter-gtfs.js # filters to the demo area, writes ./gtfs/
nodebuild-graph.js # builds the bus graph
nodescripts/build-metro-data.js # generates data/metro.json from ./metro/
nodemerge-metro.js # validates and adds the metro layer without rebuilding the bus graph
nodetest-route.js"Karol Bagh""Gandhi Darshan"
```

The data files are too large for git (stop_times.txt is about 118 MB, over GitHub's 100 MB

limit). Keep gtfs-raw/, delhi-bus.zip, gtfs/ and graph.json out of the repo with a

.gitignore, and rebuild them with the commands above.

## Project structure

```
transit-assistant/
├── filter-gtfs.js # filters raw GTFS to the demo area
├── build-graph.js # builds graph.json from the filtered GTFS
├── route.js # Dijkstra routing engine
├── test-route.js # command-line test for the engine
├── scripts/build-metro-data.js # reproducible metro GTFS converter
├── metro/ # extracted DMRC GTFS source
├── server/ # (planned) Express API
├── client/ # (planned) React + Leaflet frontend
└── data/ # delays, fares, and generated metro topology
```

## Known limitations

- Covers one part of Delhi, not the whole city.

- Metro coverage is limited to the routes and stations present in the historical DMRC feed.

- No live data.

- Fare calculation is a simplified assumption.

## Acknowledgements

- Delhi bus GTFS data, published through the Mobility Database under the IIIT-Delhi open data terms

- OpenStreetMap contributors
