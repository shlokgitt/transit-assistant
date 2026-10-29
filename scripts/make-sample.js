// Generates SAMPLE delay and crowd data for every route, so the app can run today.
// Shriyam can replace data/delays.json with hand-made values. Existing files are never overwritten.
import fs from "fs";

const G = JSON.parse(fs.readFileSync("./graph.json"));
fs.mkdirSync("data", { recursive: true });

let seed = 42; // fixed seed, so everyone gets the same sample data
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pickCrowd = (pHigh, pMed) => {
  const r = rnd();
  return r < pHigh ? "high" : r < pHigh + pMed ? "medium" : "low";
};

const names = [...new Set(Object.values(G.routes))];
const delays = { peak: {}, offpeak: {} };
for (const n of names) {
  delays.peak[n] = { delayMin: Math.round(rnd() * 12), crowd: pickCrowd(0.4, 0.35) };
  delays.offpeak[n] = { delayMin: Math.round(rnd() * 4), crowd: pickCrowd(0.1, 0.3) };
}

if (!fs.existsSync("data/delays.json")) {
  fs.writeFileSync("data/delays.json", JSON.stringify(delays));
  console.log(`wrote data/delays.json for ${names.length} routes (SAMPLE values)`);
} else console.log("data/delays.json exists, left unchanged");

if (!fs.existsSync("data/fares.json")) {
  fs.writeFileSync("data/fares.json", JSON.stringify({
    note: "PLACEHOLDER. Replace with the real fare rule.",
    bus: { boarding: 10 },
  }, null, 2));
  console.log("wrote data/fares.json (PLACEHOLDER fare)");
} else console.log("data/fares.json exists, left unchanged");