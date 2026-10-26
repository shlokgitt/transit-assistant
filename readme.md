## Sample Transport Data

The project includes JSON files for demonstration and testing.

### 1. Delay and Crowd Data

File: `data/delays.json`

This file stores sample bus delay and passenger crowd-level information for different times of the day.

Each record includes:

* Route ID
* Time period
* Delay in minutes
* Crowd level

**Important:** Delay and crowd values are simulated and are not live transport information.

### 2. Fare Data

File: `data/fares.json`

This file stores the fare rules used for development of the cheapest-route feature.

The fare model is simplified and must not be treated as an official fare calculator until the rules have been verified against authoritative fare information.

### 3. Chat Test Cases

File: `test-data/chat-test-cases.json`

This file contains ten example user queries and their expected assistant behaviour.

The test cases cover:

* Fastest-route requests
* Cheapest-route requests
* Journey duration questions
* Bus-route questions
* Delay and crowd queries
* Saving routes
* Listing saved routes
* Unknown stops
* Requests for live delay information

### Current Data Limitations

* Delay and crowd values are simulated.
* Fare calculations use a simplified model.
* Live bus tracking is not provided by these datasets.
* Route identifiers should be checked against the filtered GTFS dataset.
* Actual route and chat testing depends on the corresponding application features being implemented.
