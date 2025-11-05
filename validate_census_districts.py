#!/usr/bin/env python3
import json
import csv
from pathlib import Path

# Read CSV data
csv_path = Path('src/app/_components/data/census_age_sex_data/ACSST5Y2023.S0101-Data.csv')

csv_geo_ids = set()
csv_data = {}

with open(csv_path, 'r', encoding='utf-8-sig') as f:  # utf-8-sig handles BOM
    reader = csv.DictReader(f)
    for record in reader:
        # Handle quoted column names and BOM
        geo_id = (record.get('GEO_ID', '') or record.get('"GEO_ID"', '') or record.get('\ufeff"GEO_ID"', '')).strip().strip('"')
        if geo_id:
            csv_geo_ids.add(geo_id)
            name = (record.get('NAME', '') or record.get('"NAME"', '')).strip().strip('"')
            total_pop = (record.get('S0101_C01_001E', '') or record.get('"S0101_C01_001E"', '')).strip().strip('"')
            csv_data[geo_id] = {
                'name': name,
                'total_population': total_pop,
            }

print(f'\n=== Census Age/Sex Data (CSV) ===')
print(f'Total records: {len(csv_data)}')
print(f'Unique GEO_IDs: {len(csv_geo_ids)}')

# Read JSON data
json_path = Path('src/app/_components/data/census-districts.json')

with open(json_path, 'r', encoding='utf-8') as f:
    json_data = json.load(f)

json_geo_ids = set()
json_data_map = {}

for feature in json_data.get('features', []):
    geo_id = feature.get('properties', {}).get('GEOID', '').strip()
    if geo_id:
        # Convert JSON GEOID to match CSV format if needed
        # CSV format: "1400000US36005000100"
        # JSON format might be: "36005000100" or "1400000US36005000100"
        normalized_geo_id = geo_id
        
        # If it's just the numeric part (11 digits), add the prefix
        if geo_id.isdigit() and len(geo_id) == 11:
            normalized_geo_id = f'1400000US{geo_id}'
        # If it's already in the full format, use as-is
        elif geo_id.startswith('1400000US'):
            normalized_geo_id = geo_id
        
        json_geo_ids.add(normalized_geo_id)
        props = feature.get('properties', {})
        json_data_map[normalized_geo_id] = {
            'ct_label': props.get('CTLabel', ''),
            'boro_name': props.get('BoroName', ''),
            'ct2020': props.get('CT2020', ''),
        }

print(f'\n=== Census Districts JSON ===')
print(f'Total features: {len(json_data.get("features", []))}')
print(f'Unique GEOIDs: {len(json_geo_ids)}')

# Compare
missing_in_json = []
missing_in_csv = []
in_both = []

for geo_id in csv_geo_ids:
    if geo_id in json_geo_ids:
        in_both.append(geo_id)
    else:
        missing_in_json.append(geo_id)

for geo_id in json_geo_ids:
    if geo_id not in csv_geo_ids:
        missing_in_csv.append(geo_id)

print(f'\n=== Validation Results ===')
print(f'Districts in both: {len(in_both)}')
print(f'Districts in CSV but missing in JSON: {len(missing_in_json)}')
print(f'Districts in JSON but missing in CSV: {len(missing_in_csv)}')

if missing_in_json:
    print(f'\n=== Missing in JSON (first 20) ===')
    for idx, geo_id in enumerate(missing_in_json[:20], 1):
        name = csv_data.get(geo_id, {}).get('name', 'N/A')
        print(f'{idx}. {geo_id} - {name}')
    if len(missing_in_json) > 20:
        print(f'... and {len(missing_in_json) - 20} more')

if missing_in_csv:
    print(f'\n=== Missing in CSV (first 20) ===')
    for idx, geo_id in enumerate(missing_in_csv[:20], 1):
        ct_label = json_data_map.get(geo_id, {}).get('ct_label', 'N/A')
        print(f'{idx}. {geo_id} - {ct_label}')
    if len(missing_in_csv) > 20:
        print(f'... and {len(missing_in_csv) - 20} more')

# Sample comparison for districts in both
if in_both:
    print(f'\n=== Sample Comparison (first 5 districts in both) ===')
    for geo_id in in_both[:5]:
        csv_info = csv_data.get(geo_id, {})
        json_info = json_data_map.get(geo_id, {})
        print(f'\nGEO_ID: {geo_id}')
        print(f'  CSV Name: {csv_info.get("name", "N/A")}')
        print(f'  JSON CTLabel: {json_info.get("ct_label", "N/A")}')
        print(f'  JSON BoroName: {json_info.get("boro_name", "N/A")}')
        print(f'  CSV Total Population: {csv_info.get("total_population", "N/A")}')

# Summary
is_valid = len(missing_in_json) == 0 and len(missing_in_csv) == 0
print(f'\n=== Summary ===')
print(f'Validation: {"PASSED ✓" if is_valid else "FAILED ✗"}')
if not is_valid:
    print(f'\nIssues found:')
    if missing_in_json:
        print(f'  - {len(missing_in_json)} district(s) from CSV are missing in JSON')
    if missing_in_csv:
        print(f'  - {len(missing_in_csv)} district(s) from JSON are missing in CSV')

exit(0 if is_valid else 1)

