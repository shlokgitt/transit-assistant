require('dotenv').config();
const express = require('express');
const cors = require('cors');
const {
    getNcrTrains,
    getTrainsBetween,
    getTrainLiveStatus,
    getNcrStations,
    getRailwayStatus
} = require('./railway');

const app = express();
app.use(cors()); // Allows your frontend to talk to this backend
app.use(express.json());

function computeRoadDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const straight = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.max(0.8, Math.round(straight * 1.28 * 10) / 10);
}

// Create an endpoint that your frontend will call
app.get('/api/compare', async (req, res) => {
    // 1. Grab the dynamic coordinates sent by the frontend
    const { dep_lat, dep_lng, arr_lat, arr_lng } = req.query;

    if (!dep_lat || !dep_lng || !arr_lat || !arr_lng) {
        return res.status(400).json({ error: "Missing required coordinates" });
    }

    const dLat = parseFloat(dep_lat);
    const dLng = parseFloat(dep_lng);
    const aLat = parseFloat(arr_lat);
    const aLng = parseFloat(arr_lng);

    const calculatedRoadKm = computeRoadDistance(dLat, dLng, aLat, aLng);
    const calculatedDuration = Math.max(5, Math.round(4 + calculatedRoadKm * 2.4));

    let distance = calculatedRoadKm;
    let duration = calculatedDuration;
    let departure = "Departure point";
    let arrival = "Arrival point";
    let baseFareINR = Math.round(25 + distance * 14);

    // 2. Try fetching from RapidAPI if key is available
    if (process.env.RAPIDAPI_KEY) {
        const url = `https://taxi-fare-calculator.p.rapidapi.com/search-geo?dep_lat=${dep_lat}&dep_lng=${dep_lng}&arr_lat=${arr_lat}&arr_lng=${arr_lng}`;
        const options = {
            method: 'GET',
            headers: {
                'x-rapidapi-host': 'taxi-fare-calculator.p.rapidapi.com',
                'x-rapidapi-key': process.env.RAPIDAPI_KEY
            }
        };

        try {
            const apiResponse = await fetch(url, options);
            if (apiResponse.ok) {
                const data = await apiResponse.json();
                if (data && data.journey && typeof data.journey.distance === 'number' && data.journey.distance > 0) {
                    distance = Number(data.journey.distance.toFixed(1));
                    duration = data.journey.duration || duration;
                    departure = data.journey.department || departure;
                    arrival = data.journey.arrival || arrival;
                    if (data.journey.fares && data.journey.fares[0] && data.journey.fares[0].price_in_INR) {
                        baseFareINR = Math.round(data.journey.fares[0].price_in_INR / 100);
                    }
                }
            }
        } catch (fetchError) {
            console.warn("RapidAPI request failed, using calculated route distance:", fetchError.message);
        }
    }

    const comparisons = {
        route: {
            departure,
            arrival,
            distance_km: distance,
            duration_mins: duration
        },
        fares: {
            baseline_taxi: baseFareINR,
            uber_go: Math.max(60, Math.round(55 + (distance * 13))),
            ola_mini: Math.max(50, Math.round(50 + (distance * 12.5))),
            rapido_bike: Math.max(30, Math.round(20 + (distance * 5)))
        }
    };

    res.json(comparisons);
});

// Train API Endpoints (RailRadar Integration)

// 1. Get all trains information running in NCR
app.get('/api/trains/ncr', async (req, res) => {
    try {
        const { station, type, q, limit } = req.query;
        const result = await getNcrTrains({ station, type, query: q, limit });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch NCR trains', message: err.message });
    }
});

// 2. Get trains between two NCR stations
app.get('/api/trains/between', async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) {
            return res.status(400).json({ error: 'Missing required query parameters: from, to' });
        }
        const trains = await getTrainsBetween(from, to);
        res.json({
            from,
            to,
            count: trains.length,
            trains
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to find trains between stations', message: err.message });
    }
});

// 3. Get live status for any train
app.get('/api/trains/live/:trainNo', async (req, res) => {
    try {
        const status = await getTrainLiveStatus(req.params.trainNo);
        if (!status) {
            return res.status(404).json({ error: 'Train not found' });
        }
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch train live status', message: err.message });
    }
});

// 4. Get all major NCR railway stations
app.get('/api/trains/stations', (_req, res) => {
    res.json({
        count: getNcrStations().length,
        stations: getNcrStations()
    });
});

// 5. RailRadar API connectivity & health status
app.get('/api/trains/status', async (_req, res) => {
    try {
        const status = await getRailwayStatus();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: 'Failed to check railway status', message: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
});
