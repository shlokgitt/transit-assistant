
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;

const delaysPath = path.join(rootDir, "data", "delays.json");
const faresPath = path.join(rootDir, "data", "fares.json");

let hasErrors = false;

function readJson(filePath, label) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`❌ ${label}: ${error.message}`);
    hasErrors = true;
    return null;
  }
}

function validateDelays() {
  console.log("\nChecking delays.json...");

  const data = readJson(delaysPath, "delays.json");
  if (!data) return;

  if (!data.metadata || typeof data.metadata !== "object") {
    console.error("❌ Missing metadata object.");
    hasErrors = true;
  } else {
    if (data.metadata.city !== "Delhi") {
      console.error('❌ Expected metadata.city to be "Delhi".');
      hasErrors = true;
    }

    if (data.metadata.data_type !== "simulated") {
      console.error('❌ Expected metadata.data_type to be "simulated".');
      hasErrors = true;
    }

    if (data.metadata.live_data !== false) {
      console.error("❌ Expected metadata.live_data to be false.");
      hasErrors = true;
    }
  }

  const validPeriods = ["morning", "afternoon", "evening", "night"];
  const validCrowdLevels = ["low", "medium", "high"];

  if (!Array.isArray(data.delays)) {
    console.error('❌ Expected "delays" to be an array.');
    hasErrors = true;
    return;
  }

  if (data.delays.length === 0) {
    console.error("❌ No delay records found.");
    hasErrors = true;
    return;
  }

  const seen = new Set();

  for (const record of data.delays) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      console.error("❌ Invalid delay record.");
      hasErrors = true;
      continue;
    }

    if (
      typeof record.route_id !== "string" ||
      record.route_id.trim() === ""
    ) {
      console.error("❌ Invalid route_id.");
      hasErrors = true;
    }

    if (!validPeriods.includes(record.time_period)) {
      console.error(
        `❌ Invalid time_period for route ${record.route_id ?? "unknown"}.`
      );
      hasErrors = true;
    }

    if (
      typeof record.delay_minutes !== "number" ||
      !Number.isFinite(record.delay_minutes) ||
      record.delay_minutes < 0
    ) {
      console.error(
        `❌ Invalid delay_minutes for route ${record.route_id ?? "unknown"}.`
      );
      hasErrors = true;
    }

    if (!validCrowdLevels.includes(record.crowd_level)) {
      console.error(
        `❌ Invalid crowd_level for route ${record.route_id ?? "unknown"}.`
      );
      hasErrors = true;
    }

    if (
      typeof record.route_id === "string" &&
      validPeriods.includes(record.time_period)
    ) {
      const key = `${record.route_id}|${record.time_period}`;

      if (seen.has(key)) {
        console.error(`❌ Duplicate route/time-period entry: ${key}`);
        hasErrors = true;
      }

      seen.add(key);
    }
  }

  console.log(`  Delay records checked: ${data.delays.length}`);

  if (
    data.metadata?.live_data === false &&
    data.metadata?.data_type === "simulated"
  ) {
    console.log("  ℹ️ Delay and crowd data is simulated, not live.");
  }
}

function validateFares() {
  console.log("\nChecking fares.json...");

  const data = readJson(faresPath, "fares.json");
  if (!data) return;

  if (data.currency !== "INR") {
    console.error('❌ Expected currency to be "INR".');
    hasErrors = true;
  }

  if (data.distanceUnit !== "km") {
    console.error('❌ Expected distanceUnit to be "km".');
    hasErrors = true;
  }

  if (!data.bus || typeof data.bus !== "object" || Array.isArray(data.bus)) {
    console.error('❌ Missing or invalid "bus" object.');
    hasErrors = true;
    return;
  }

  for (const category of ["ordinary", "ac"]) {
    const slabs = data.bus[category];

    if (!Array.isArray(slabs) || slabs.length === 0) {
      console.error(`❌ bus.${category} must be a non-empty array.`);
      hasErrors = true;
      continue;
    }

    let previousMax = -Infinity;
    let hasOpenEnded = false;

    slabs.forEach((slab, index) => {
      if (!slab || typeof slab !== "object" || Array.isArray(slab)) {
        console.error(`❌ Invalid bus.${category}[${index}] fare slab.`);
        hasErrors = true;
        return;
      }

      if (
        typeof slab.fare !== "number" ||
        !Number.isFinite(slab.fare) ||
        slab.fare < 0
      ) {
        console.error(`❌ Invalid fare in bus.${category}[${index}].`);
        hasErrors = true;
      }

      if (slab.maxKm === null) {
        if (index !== slabs.length - 1) {
          console.error(
            `❌ Open-ended maxKm must be the final slab in bus.${category}.`
          );
          hasErrors = true;
        }

        hasOpenEnded = true;
      } else if (
        typeof slab.maxKm !== "number" ||
        !Number.isFinite(slab.maxKm) ||
        slab.maxKm <= 0
      ) {
        console.error(`❌ Invalid maxKm in bus.${category}[${index}].`);
        hasErrors = true;
      } else {
        if (slab.maxKm <= previousMax) {
          console.error(
            `❌ maxKm values must increase in bus.${category}.`
          );
          hasErrors = true;
        }

        previousMax = slab.maxKm;
      }
    });

    if (!hasOpenEnded) {
      console.error(`❌ bus.${category} needs a final maxKm: null slab.`);
      hasErrors = true;
    }

    console.log(`  ${category}: ${slabs.length} fare slabs`);
  }

  if (typeof data.note !== "string" || data.note.trim() === "") {
    console.warn("⚠️ fares.json has no explanatory note.");
  } else {
    console.log("  ℹ️ Fare values are estimates; verify against official sources.");
  }
}

validateDelays();
validateFares();

if (hasErrors) {
  console.error("\n❌ Validation failed. Fix the errors above.");
  process.exitCode = 1;
} else {
  console.log("\n✅ All transit data checks passed.");
}
