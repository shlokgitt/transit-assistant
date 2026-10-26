
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
