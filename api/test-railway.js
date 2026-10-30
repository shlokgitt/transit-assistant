const API_KEY = "rg_a3fed45786a248fda13a2f6e62997c51";
const BASE_URL = "https://api.railradar.in/v1";

// Function to get trains for any station
async function getTrains(stationCode) {
    const url = `${BASE_URL}/stations/${stationCode}/trains`;

    try {
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                Accept: "application/json"
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.log("Error:", data);
            return;
        }

        console.log(`\nTrains at station: ${stationCode}`);
        console.log(JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("Request failed:", error.message);
    }
}

// Enter any station code here
getTrains("ANVT");