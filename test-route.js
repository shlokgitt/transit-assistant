import { planByName } from "./route.js";

// usage: node test-route.js "Karol Bagh" "Gandhi Darshan" [fastest|cheapest] [peak|offpeak] [avoid]
const [, , a, b, preference = "fastest", period, avoid] = process.argv;
const opts = { preference, avoidCrowded: avoid === "avoid" };
if (period) opts.period = period;
console.log(JSON.stringify(planByName(a, b, opts), null, 2));