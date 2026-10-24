# Delhi NCR Metro Fare Reference Dataset

Version: 1.0.0  
Prepared: 2026-10-25  
Currency: INR (₹)

## Contents
- `dmrc_standard_fares.csv` — DMRC standard-network fare slabs by actual network travel distance and day type.
- `airport_express_qr_fares.csv` — Airport Express single-journey QR fare matrix by station pair.
- `noida_metro_fares.csv` — NMRC fare slabs by number of stations and day type.
- `rapid_metro_fare_note.json` — official DMRC fare statement, flagged for verification before production use.
- `metadata.json` — sources, scope, and limitations.

## Official sources
- DMRC standard fares: https://delhimetrorail.com/fare
- DMRC Airport Express: https://delhimetrorail.com/fare-for-airport-express-line
- Noida Metro (NMRC): https://www.nmrcnoida.com/Passenger-Information/Metro-Rail/Fare-Table
- Rapid Metro: https://new.delhimetrorail.com/en/rapid-metro

## Integration notes
1. This is structured reference data transcribed from official webpages, not an official operator-provided ZIP.
2. DMRC standard fares require actual distance along the selected metro route. Do not substitute straight-line distance between station coordinates.
3. Airport Express fares should be looked up in the origin-destination matrix.
4. Noida Metro uses station-count bands; align station counting with the operator's definition.
5. Verify Rapid Metro's fare interpretation before production.
6. Smart-card discounts, passes, and concessions are not included.
7. Recheck official sources before deployment because fares can change.

Suggested location in Transit Assistant: `data/metro-fares/`.
If a fare cannot be calculated reliably, return `null` with an explicit unavailable indicator instead of guessing.
