# Public Transit Route Assistant - API Contract Specification (v1.0)

## Overview
This specification defines the multi-modal Public Transit Route Assistant API. It unifies public and on-demand transit systems (**Metro**, **Bus**, **Auto Rickshaw**, **Bike Taxi**, **Cab**, and **Walking**) to compute optimal routes prioritized by **fastest**, **cheapest**, **shortest**, **least transfers**, or **eco-friendly**.

---

## 1. Route Planning Endpoint

### `POST /api/v1/routes/plan`

Computes route candidates across all selected modes matching user preferences.

#### Request Headers
```http
Content-Type: application/json
Accept: application/json
```

#### Request Body Schema
```json
{
  "city": "delhi",
  "origin": {
    "query": "Karol Bagh",
    "lat": 28.6514,
    "lng": 77.1907
  },
  "destination": {
    "query": "Gandhi Darshan",
    "lat": 28.6415,
    "lng": 77.2485
  },
  "preferences": {
    "routingPriority": "fastest",
    "allowedModes": ["metro", "bus", "cab", "bike", "auto", "walk"],
    "avoidCrowded": true,
    "period": "peak",
    "maxWalkingDistanceMeters": 1000
  }
}
```

#### Field Definitions
| Field | Type | Required | Values / Notes |
| :--- | :--- | :--- | :--- |
| `city` | string | Yes | `"delhi"`, `"mumbai"`, `"bengaluru"`, etc. |
| `origin.query` | string | Yes | Landmark, station name, or place query |
| `origin.lat` / `lng` | number | Optional | Geographic coordinates (if GPS selected) |
| `destination.query`| string | Yes | Landmark, station name, or place query |
| `destination.lat` / `lng` | number | Optional | Geographic coordinates |
| `preferences.routingPriority` | string | No | `"fastest"` (default), `"cheapest"`, `"shortest"`, `"least_transfers"`, `"eco"` |
| `preferences.allowedModes` | array | No | Subset of `["metro", "bus", "cab", "bike", "auto", "walk"]` |
| `preferences.avoidCrowded` | boolean| No | If true, applies crowd penalty to packed routes |
| `preferences.period` | string | No | `"auto"`, `"peak"` (8-11am, 5-8pm), `"offpeak"` |
| `preferences.maxWalkingDistanceMeters` | number | No | Default `1200` meters |

---

#### Success Response `200 OK`
```json
{
  "success": true,
  "queryId": "req_del_8923a41b",
  "timestamp": "2026-10-25T08:30:00.000Z",
  "city": {
    "id": "delhi",
    "name": "Delhi NCR",
    "currency": "₹"
  },
  "origin": {
    "name": "Karol Bagh Metro",
    "lat": 28.6514,
    "lng": 77.1907
  },
  "destination": {
    "name": "Gandhi Darshan / Raj Ghat",
    "lat": 28.6415,
    "lng": 77.2485
  },
  "summary": {
    "totalRoutes": 5,
    "recommendedRouteId": "route_metro_express",
    "fastestRouteId": "route_rapido_bike",
    "cheapestRouteId": "route_dtc_bus"
  },
  "routes": [
    {
      "id": "route_metro_express",
      "tag": "RECOMMENDED",
      "title": "Smart Metro + Last-Mile Auto",
      "summary": "Walk ➔ Metro Blue ➔ Metro Violet ➔ Auto",
      "totalDurationMinutes": 24,
      "totalDistanceKm": 8.6,
      "totalFare": 45,
      "carbonEmissionsKg": 0.38,
      "caloriesBurned": 55,
      "transfersCount": 1,
      "crowdLevel": "medium",
      "delayMinutes": 0,
      "onTimeReliability": 98,
      "legs": [
        {
          "legIndex": 0,
          "mode": "walk",
          "from": "Karol Bagh Market",
          "to": "Karol Bagh Metro Station",
          "durationMinutes": 4,
          "distanceKm": 0.28,
          "fare": 0,
          "instruction": "Walk to Karol Bagh Metro Station (Gate 2)",
          "coordinates": [[28.6514, 77.1907], [28.6525, 77.1920]]
        },
        {
          "legIndex": 1,
          "mode": "metro",
          "from": "Karol Bagh",
          "to": "Mandi House",
          "durationMinutes": 11,
          "distanceKm": 4.8,
          "fare": 30,
          "lineName": "Blue Line",
          "lineColor": "#0066cc",
          "platform": "Platform 1 towards Noida Electronic City",
          "stopsCount": 5,
          "intermediateStops": ["Jhandewalan", "RK Ashram Marg", "Rajiv Chowk", "Barakhamba Road"],
          "provider": "Delhi Metro (DMRC)",
          "crowdLevel": "medium",
          "delayMinutes": 0,
          "instruction": "Board Blue Line at Karol Bagh, alight at Mandi House",
          "coordinates": [[28.6525, 77.1920], [28.6328, 77.2197], [28.6258, 77.2345]]
        },
        {
          "legIndex": 2,
          "mode": "metro",
          "from": "Mandi House",
          "to": "Delhi Gate",
          "durationMinutes": 5,
          "distanceKm": 2.2,
          "fare": 10,
          "lineName": "Violet Line",
          "lineColor": "#8b008b",
          "platform": "Platform 2 towards Kashmere Gate",
          "stopsCount": 2,
          "intermediateStops": ["ITO"],
          "provider": "Delhi Metro (DMRC)",
          "crowdLevel": "low",
          "delayMinutes": 0,
          "instruction": "Transfer to Violet Line at Mandi House to Delhi Gate",
          "coordinates": [[28.6258, 77.2345], [28.6360, 77.2405], [28.6415, 77.2435]]
        },
        {
          "legIndex": 3,
          "mode": "auto",
          "from": "Delhi Gate Metro Gate 4",
          "to": "Gandhi Darshan",
          "durationMinutes": 4,
          "distanceKm": 1.3,
          "fare": 35,
          "provider": "Shared / Metered Auto",
          "instruction": "Take auto rickshaw from Delhi Gate to Gandhi Darshan main entrance",
          "crowdLevel": "low",
          "coordinates": [[28.6415, 77.2435], [28.6415, 77.2485]]
        }
      ]
    },
    {
      "id": "route_dtc_bus",
      "tag": "CHEAPEST",
      "title": "Direct City Bus (DTC 354UP)",
      "summary": "Walk ➔ DTC Bus 354UP ➔ Walk",
      "totalDurationMinutes": 26,
      "totalDistanceKm": 7.9,
      "totalFare": 10,
      "carbonEmissionsKg": 0.42,
      "caloriesBurned": 65,
      "transfersCount": 0,
      "crowdLevel": "high",
      "delayMinutes": 2,
      "onTimeReliability": 84,
      "legs": [
        {
          "legIndex": 0,
          "mode": "walk",
          "from": "Karol Bagh",
          "to": "Karol Bagh Terminal",
          "durationMinutes": 3,
          "distanceKm": 0.2,
          "fare": 0,
          "instruction": "Walk to Karol Bagh Terminal Bus Stop",
          "coordinates": [[28.6514, 77.1907], [28.6510, 77.1925]]
        },
        {
          "legIndex": 1,
          "mode": "bus",
          "from": "Karol Bagh Terminal",
          "to": "Gandhi Darshan",
          "durationMinutes": 21,
          "distanceKm": 7.5,
          "fare": 10,
          "routeNumber": "354UP",
          "stopsCount": 12,
          "provider": "Delhi Transport Corporation (DTC)",
          "crowdLevel": "high",
          "delayMinutes": 2,
          "instruction": "Board Bus 354UP towards Mayur Vihar, alight at Gandhi Darshan",
          "coordinates": [[28.6510, 77.1925], [28.6480, 77.2100], [28.6415, 77.2485]]
        },
        {
          "legIndex": 2,
          "mode": "walk",
          "from": "Gandhi Darshan Stop",
          "to": "Gandhi Darshan Complex",
          "durationMinutes": 2,
          "distanceKm": 0.15,
          "fare": 0,
          "instruction": "Walk 150m to complex gates",
          "coordinates": [[28.6415, 77.2485], [28.6420, 77.2490]]
        }
      ]
    },
    {
      "id": "route_rapido_bike",
      "tag": "TRAFFIC_BUSTER",
      "title": "Bike Taxi (Instant Dispatch)",
      "summary": "Direct Rapido / Ola Bike",
      "totalDurationMinutes": 16,
      "totalDistanceKm": 7.8,
      "totalFare": 65,
      "carbonEmissionsKg": 0.65,
      "caloriesBurned": 0,
      "transfersCount": 0,
      "crowdLevel": "low",
      "delayMinutes": 0,
      "onTimeReliability": 95,
      "legs": [
        {
          "legIndex": 0,
          "mode": "bike",
          "from": "Karol Bagh (Pickup at doorway)",
          "to": "Gandhi Darshan (Dropoff at gate)",
          "durationMinutes": 16,
          "distanceKm": 7.8,
          "fare": 65,
          "provider": "Bike Taxi (Rapido/Uber Moto)",
          "instruction": "Helmet provided. Fastest route cutting through Ring Road traffic",
          "coordinates": [[28.6514, 77.1907], [28.6415, 77.2485]]
        }
      ]
    },
    {
      "id": "route_cab_comfort",
      "tag": "COMFORT",
      "title": "On-Demand AC Cab / Taxi",
      "summary": "Door-to-door Sedan / Premier",
      "totalDurationMinutes": 19,
      "totalDistanceKm": 8.1,
      "totalFare": 185,
      "carbonEmissionsKg": 1.92,
      "caloriesBurned": 0,
      "transfersCount": 0,
      "crowdLevel": "low",
      "delayMinutes": 3,
      "onTimeReliability": 90,
      "legs": [
        {
          "legIndex": 0,
          "mode": "cab",
          "from": "Karol Bagh",
          "to": "Gandhi Darshan",
          "durationMinutes": 19,
          "distanceKm": 8.1,
          "fare": 185,
          "provider": "Uber Go / Ola Prime",
          "instruction": "Air-conditioned direct ride via Pusa Rd and Vikas Marg",
          "coordinates": [[28.6514, 77.1907], [28.6450, 77.2200], [28.6415, 77.2485]]
        }
      ]
    },
    {
      "id": "route_auto_direct",
      "tag": "LOCAL_FAVORITE",
      "title": "Direct Auto Rickshaw",
      "summary": "Metered CNG Auto",
      "totalDurationMinutes": 21,
      "totalDistanceKm": 8.0,
      "totalFare": 115,
      "carbonEmissionsKg": 0.85,
      "caloriesBurned": 0,
      "transfersCount": 0,
      "crowdLevel": "low",
      "delayMinutes": 1,
      "onTimeReliability": 92,
      "legs": [
        {
          "legIndex": 0,
          "mode": "auto",
          "from": "Karol Bagh",
          "to": "Gandhi Darshan",
          "durationMinutes": 21,
          "distanceKm": 8.0,
          "fare": 115,
          "provider": "Delhi Auto Rickshaw (CNG)",
          "instruction": "Direct CNG auto ride via D.B. Gupta Rd",
          "coordinates": [[28.6514, 77.1907], [28.6415, 77.2485]]
        }
      ]
    }
  ]
}
```

---

## 2. Autocomplete & Search Endpoint

### `GET /api/v1/stops/search?city={city}&q={query}`

#### Query Parameters
- `city`: string (e.g. `"delhi"`, `"mumbai"`, `"bengaluru"`)
- `q`: search keyword (e.g. `"karol"`, `"andheri"`, `"indira"`)
- `type`: optional filter (`"metro" | "bus" | "landmark" | "all"`)

#### Response Schema
```json
{
  "results": [
    {
      "id": "stop_del_kb_metro",
      "name": "Karol Bagh Metro",
      "type": "metro",
      "line": "Blue Line",
      "city": "delhi",
      "lat": 28.6525,
      "lng": 77.1920
    },
    {
      "id": "stop_del_kb_term",
      "name": "Karol Bagh Terminal",
      "type": "bus",
      "city": "delhi",
      "lat": 28.6510,
      "lng": 77.1925
    }
  ]
}
```

---

## 3. Live City Transit Alerts Endpoint

### `GET /api/v1/transit/status?city={city}`

Returns network health, congestion alerts, and weather-related transit warnings.

#### Response Schema
```json
{
  "city": "delhi",
  "period": "peak",
  "systemStatus": "NORMAL_OPERATIONS",
  "alerts": [
    {
      "id": "alert_01",
      "severity": "warning",
      "mode": "bus",
      "title": "ITO Intersection Slow Traffic",
      "message": "Buses transiting Vikas Marg may experience 5-10 min delay",
      "activeLines": ["354UP", "543", "720"]
    },
    {
      "id": "alert_02",
      "severity": "info",
      "mode": "metro",
      "title": "Yellow Line High Frequency",
      "message": "Trains running every 2.5 minutes during peak hours"
    }
  ],
  "crowdIndex": {
    "metro": "High",
    "bus": "High",
    "roads": "Heavy Congestion"
  }
}
```
