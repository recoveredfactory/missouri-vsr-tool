#!/usr/bin/env python3
"""
Aggregate statewide historical data for homepage charts.
Generates total stops and consent searches by year (2020-2024).
"""
import json
from pathlib import Path
from collections import defaultdict

AGENCY_YEAR_DIR = Path("static/data/agency_year")
YEARS = [2020, 2021, 2022, 2023, 2024]

METRICS = {
    "total_stops": "rates-by-race--totals--all-stops",
    "consent_searches": "search-statistics--probable-cause--consent",
}


def main():
    # year -> metric -> total
    by_year = {year: defaultdict(float) for year in YEARS}

    for agency_file in AGENCY_YEAR_DIR.glob("*.json"):
        try:
            with open(agency_file) as f:
                data = json.load(f)
        except Exception as e:
            print(f"Error reading {agency_file}: {e}")
            continue

        for row in data.get("rows", []):
            year = row.get("year")
            if year not in by_year:
                continue

            row_key = row.get("row_key")
            for metric_name, metric_key in METRICS.items():
                if row_key == metric_key:
                    value = row.get("Total")
                    if value is not None and value != "":
                        by_year[year][metric_name] += float(value)
                    break

    output = {
        "years": YEARS,
        "totalStops": [int(by_year[y]["total_stops"]) for y in YEARS],
        "consentSearches": [int(by_year[y]["consent_searches"]) for y in YEARS],
    }

    # Print summary
    print("Statewide Historical Data")
    print("=" * 50)
    for i, year in enumerate(YEARS):
        print(
            f"  {year}: {output['totalStops'][i]:>10,} stops, "
            f"{output['consentSearches'][i]:>6,} consent searches"
        )

    output_file = Path("static/data/homepage_historical.json")
    with open(output_file, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nSaved to {output_file}")


if __name__ == "__main__":
    main()
