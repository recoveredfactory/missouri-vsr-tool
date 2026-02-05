#!/usr/bin/env python3
"""
Aggregate statewide year-level sums from agency_year data.
Generates statewide_year_sums.json with totals by year and race for key metrics.
"""
import json
from pathlib import Path
from collections import defaultdict

AGENCY_YEAR_DIR = Path("static/data/agency_year")
OUTPUT_DIR = Path("static/data/dist")
YEARS = [2020, 2021, 2022, 2023, 2024]

# Race columns in the data
RACE_COLS = ["Total", "White", "Black", "Hispanic", "Asian", "Native American", "Other"]

# Metrics to aggregate (row_key -> friendly name for debugging)
METRICS = {
    # Core totals
    "rates-by-race--totals--all-stops": "Total Stops",
    "search-statistics--probable-cause--consent": "Consent Searches",
    # Stop outcomes (for stacked bar chart)
    "number-of-stops-by-race--stop-outcome--arrests": "Arrests",
    "number-of-stops-by-race--stop-outcome--citation": "Citations",
    "number-of-stops-by-race--stop-outcome--warning": "Warnings",
    "number-of-stops-by-race--stop-outcome--no-action": "No Action",
}


def main():
    # year -> row_key -> race -> sum
    data = {year: {rk: defaultdict(float) for rk in METRICS} for year in YEARS}

    agency_count = 0
    for agency_file in sorted(AGENCY_YEAR_DIR.glob("*.json")):
        try:
            with open(agency_file) as f:
                agency_data = json.load(f)
        except Exception as e:
            print(f"Error reading {agency_file}: {e}")
            continue

        agency_count += 1
        for row in agency_data.get("rows", []):
            year = row.get("year")
            if year not in YEARS:
                continue

            row_key = row.get("row_key")
            if row_key not in METRICS:
                continue

            for race in RACE_COLS:
                value = row.get(race)
                if value is not None and value != "":
                    try:
                        data[year][row_key][race] += float(value)
                    except (ValueError, TypeError):
                        pass

    # Build output structure
    output = {
        "years": YEARS,
        "data": {}
    }

    for row_key in METRICS:
        output["data"][row_key] = {}
        for year in YEARS:
            output["data"][row_key][str(year)] = {
                race: int(data[year][row_key][race]) if data[year][row_key][race] else 0
                for race in RACE_COLS
            }

    # Print summary
    print(f"Processed {agency_count} agencies")
    print("=" * 60)
    for row_key, label in METRICS.items():
        print(f"\n{label} ({row_key}):")
        for year in YEARS:
            total = output["data"][row_key][str(year)]["Total"]
            print(f"  {year}: {total:>12,}")

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    output_file = OUTPUT_DIR / "statewide_year_sums.json"
    with open(output_file, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nSaved to {output_file}")


if __name__ == "__main__":
    main()
