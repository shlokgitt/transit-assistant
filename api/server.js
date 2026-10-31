require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); // Allows your frontend to talk to this backend
app.use(express.json());

// Create an endpoint that your frontend will call
app.get('/api/compare', async (req, res) => {
    // 1. Grab the dynamic coordinates sent by the frontend
    const { dep_lat, dep_lng, arr_lat, arr_lng } = req.query;

    if (!dep_lat || !dep_lng || !arr_lat || !arr_lng) {
        return res.status(400).json({ error: "Missing required coordinates" });
    }

    // 2. Inject the variables into the RapidAPI URL
    const url = `https://taxi-fare-calculator.p.rapidapi.com/search-geo?dep_lat=${dep_lat}&dep_lng=${dep_lng}&arr_lat=${arr_lat}&arr_lng=${arr_lng}`;
    
    const options = {
        method: 'GET',
        headers: {
            'x-rapidapi-host': 'taxi-fare-calculator.p.rapidapi.com',
            'x-rapidapi-key': process.env.RAPIDAPI_KEY // Kept secure via .env
        }
    };

    try {
        // 3. Fetch data from RapidAPI
        const apiResponse = await fetch(url, options);
        const data = await apiResponse.json();

        // 4. Extract needed values (Distance and converting paise to real INR)
        const distance = data.journey.distance; // e.g., 27.5 km
        const baseFareINR = data.journey.fares[0].price_in_INR / 100; 

        // 5. Build your Hackathon Comparison Algorithm
        // (Simulating market rates based on the fetched distance)
        const comparisons = {
            route: {
                departure: data.journey.department,
                arrival: data.journey.arrival,
                distance_km: distance,
                duration_mins: data.journey.duration
            },
            fares: {
                baseline_taxi: baseFareINR,
                uber_go: Math.round(55 + (distance * 13)),
                ola_mini: Math.round(50 + (distance * 12.5)),
                rapido_bike: Math.round(20 + (distance * 5))
            }
        };

        // 6. Send the compiled data back to your frontend app
        res.json(comparisons);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to calculate fares" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
});
