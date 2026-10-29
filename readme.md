
### 1. Delay and Crowd Data

File: `data/delays.json`

The file contains metadata and a `delays` array. Each delay record includes:

- `route_id`: Bus route identifier.
- `time_period`: One of `morning`, `afternoon`, `evening`, or `night`.
- `delay_minutes`: Estimated delay in minutes.
- `crowd_level`: One of `low`, `medium`, or `high`.

Example:

```json
{
  "route_id": "534",
  "time_period": "morning",
  "delay_minutes": 10,
  "crowd_level": "high"
}
```

**Important:** Delay and crowd values are simulated sample data, not live transport information.

## Saved routes API

### `GET /saved`

Returns every saved route. The `email` field is always present and is `null` when morning alerts are not enabled.

```json
[
  {
    "id": "r1",
    "name": "Home to Office",
    "from": "Karol Bagh",
    "to": "Gandhi Darshan",
    "preference": "fastest",
    "email": "user@gmail.com"
  }
]
```

### `POST /saved`

Accepts `name`, `from`, `to`, and `preference`. Add an optional `email` to opt into weekday 7:30 AM commute alerts. The API trims and lowercases the address. Invalid addresses return `400 { "error": "Invalid email" }`; omitted or empty email values are stored as `null`.

### `DELETE /saved/:id/email`

Stops morning alerts for a saved route by setting its `email` to `null`.

## NCR place routing

The route engine can connect supported non-station places to the nearest GTFS transit stop. NCR place coordinates are maintained in `data/ncr-places.json`; the catalog covers major Delhi, Gurugram, Noida/Greater Noida, Ghaziabad, Faridabad, Sonipat, and Bahadurgarh hubs. These are curated access points, not an exhaustive locality database. For more accurate routes beyond the current transit graph, add a Greater Noida/Noida bus GTFS feed or a road-routing dataset covering local last-mile roads.
