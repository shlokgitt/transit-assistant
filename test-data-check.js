const fs = require("fs");
const path = require("path");

console.log("================================");
console.log(" DELHI TRANSIT ASSISTANT");
console.log(" DATA VALIDATION TEST");
console.log("================================");

// File paths
const delaysPath = path.join(__dirname, "data", "delays.json");
const faresPath = path.join(__dirname, "data", "fares.json");

// Read JSON file
function readJSON(filePath) {
    try {
        const content = fs.readFileSync(filePath, "utf8");
        const data = JSON.parse(content);

        console.log(`PASS: ${path.basename(filePath)} loaded successfully`);

        return data;
    } catch (error) {
        console.log(`FAIL: ${path.basename(filePath)}`);
        console.log("Reason:", error.message);

        return null;
    }
}

// Load files
const delayData = readJSON(delaysPath);
const fareData = readJSON(faresPath);

// Test delay data
console.log("\n--- DELAY DATA TEST ---");

if (delayData) {
    console.log("City:", delayData.metadata?.city);
    console.log("Data type:", delayData.metadata?.data_type);

    if (Array.isArray(delayData.delays)) {
        console.log("Total delay records:", delayData.delays.length);

        const route = delayData.delays.find(
            item =>
                item.route_id === "534" &&
                item.time_period === "morning"
        );

        if (route) {
            console.log("PASS: Route 534 morning record found");
            console.log("Delay:", route.delay_minutes, "minutes");
            console.log("Crowd:", route.crowd_level);
        } else {
            console.log("WARNING: Route 534 morning record not found");
        }

        const invalidRecords = delayData.delays.filter(item =>
            typeof item.route_id !== "string" ||
            typeof item.delay_minutes !== "number" ||
            item.delay_minutes < 0 ||
            !["low", "medium", "high"].includes(item.crowd_level)
        );

        console.log("Invalid delay records:", invalidRecords.length);

        if (invalidRecords.length === 0) {
            console.log("PASS: Delay records have valid fields");
        } else {
            console.log("FAIL: Check the invalid delay records");
            console.log(invalidRecords);
        }
    } else {
        console.log("FAIL: delays must be an array");
    }
}

// Test fare data
console.log("\n--- FARE DATA TEST ---");

if (fareData) {
    const currency = fareData.currency ?? fareData.metadata?.currency;

    console.log("Currency:", currency ?? "Not specified");

    // Check the distance-based fare format
    if (fareData.bus) {
        for (const type of ["ordinary", "ac"]) {
            const stages = fareData.bus[type];

            if (!Array.isArray(stages) || stages.length === 0) {
                console.log(`FAIL: ${type} fare stages missing`);
                continue;
            }

            const validStages = stages.every(stage =>
                (typeof stage.maxKm === "number" ||
                    stage.maxKm === null) &&
                typeof stage.fare === "number" &&
                stage.fare >= 0
            );

            console.log(
                `${validStages ? "PASS" : "FAIL"}: ${type} fare stages`
            );

            console.log("Number of stages:", stages.length);
        }
    }

    // Check the duration-based fare format
    else if (fareData.fare_rules?.bus?.categories) {
        const categories = fareData.fare_rules.bus.categories;

        console.log("Fare categories:", categories.length);

        const validCategories = categories.every(category =>
            typeof category.fare_inr === "number" &&
            typeof category.minimum_minutes === "number" &&
            (typeof category.maximum_minutes === "number" ||
                category.maximum_minutes === null)
        );

        console.log(
            `${validCategories ? "PASS" : "FAIL"}: fare categories`
        );
    } else {
        console.log("WARNING: Unrecognized fare data structure");
    }
}

console.log("\n================================");
console.log(" DATA CHECK COMPLETE");
console.log("================================");