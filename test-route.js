import { findStops, plan } from "./route.js";

const [, , a, b] = process.argv;
const from = findStops(a), to = findStops(b);
console.log(`from: ${from.length} stops, to: ${to.length} stops`);
console.log(JSON.stringify(plan(from.map((s) => s.id), to.map((s) => s.id)), null, 2));