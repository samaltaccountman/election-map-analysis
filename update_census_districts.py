#!/usr/bin/env python3
"""
Script to update census-districts.json with missing districts from CSV data.

This script:
1. Identifies districts in CSV but missing in JSON
2. Extracts available data from CSV
3. Creates placeholder entries for missing districts (geometry must be added separately)
"""

import json
import csv
from pathlib import Path

# Read CSV data
csv_path = Path('src/app/_components/data/census_age_sex_data/ACSST5Y2023.S0101-Data.csv')

csv_geo_ids = set()
csv_data = {}

print("Reading CSV data...")
with open(csv_path, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for record in reader:
        geo_id = (record.get('GEO_ID', '') or record.get('"GEO_ID"', '') or record.get('\ufeff"GEO_ID"', '')).strip().strip('"')
        if geo_id:
            csv_geo_ids.add(geo_id)
            name = (record.get('NAME', '') or record.get('"NAME"', '')).strip().strip('"')
            total_pop = (record.get('S0101_C01_001E', '') or record.get('"S0101_C01_001E"', '')).strip().strip('"')
            
            # Parse name to extract county and tract info
            # Format: "Census Tract 1; Bronx County; New York"
            parts = name.split(';')
            tract_info = parts[0].strip() if len(parts) > 0 else ''
            county_info = parts[1].strip() if len(parts) > 1 else ''
            
            # Extract tract number from "Census Tract 1" or "Census Tract 1.02"
            tract_num = tract_info.replace('Census Tract', '').strip() if 'Census Tract' in tract_info else ''
            
            # Determine borough from county
            borough_map = {
                'Bronx County': ('Bronx', '2'),
                'Kings County': ('Brooklyn', '3'),
                'New York County': ('Manhattan', '1'),
                'Queens County': ('Queens', '4'),
                'Richmond County': ('Staten Island', '5')
            }
            boro_name, boro_code = borough_map.get(county_info, ('', ''))
            
            csv_data[geo_id] = {
                'name': name,
                'total_population': total_pop,
                'tract_number': tract_num,
                'county': county_info,
                'boro_name': boro_name,
                'boro_code': boro_code,
            }

print(f"Found {len(csv_data)} districts in CSV")

# Read JSON data
json_path = Path('src/app/_components/data/census-districts.json')

print("Reading JSON data...")
with open(json_path, 'r', encoding='utf-8') as f:
    json_data = json.load(f)

json_geo_ids = set()
json_features = {}

for feature in json_data.get('features', []):
    geo_id = feature.get('properties', {}).get('GEOID', '').strip()
    if geo_id:
        # Normalize GEOID format
        if geo_id.isdigit() and len(geo_id) == 11:
            normalized_geo_id = f'1400000US{geo_id}'
        elif geo_id.startswith('1400000US'):
            normalized_geo_id = geo_id
        else:
            continue
        
        json_geo_ids.add(normalized_geo_id)
        json_features[normalized_geo_id] = feature

print(f"Found {len(json_features)} districts in JSON")

# Find missing districts
missing_geo_ids = sorted([gid for gid in csv_geo_ids if gid not in json_geo_ids])

print(f"\nFound {len(missing_geo_ids)} missing districts")

if not missing_geo_ids:
    print("No missing districts to add!")
    exit(0)

# Create placeholder features for missing districts
# Note: These will have empty/null geometry - geometry must be added separately
print("\nCreating placeholder features for missing districts...")
new_features = []

for geo_id in missing_geo_ids:
    csv_info = csv_data[geo_id]
    
    # Extract GEOID numeric part (last 11 digits)
    geoid_numeric = geo_id.replace('1400000US', '') if geo_id.startswith('1400000US') else geo_id
    
    # Create a placeholder feature
    # WARNING: Geometry is empty - must be populated from shapefile or API
    feature = {
        "type": "Feature",
        "id": len(json_data['features']) + len(new_features) + 1,
        "geometry": {
            "type": "MultiPolygon",
            "coordinates": []  # PLACEHOLDER - geometry must be added
        },
        "properties": {
            "OBJECTID": len(json_data['features']) + len(new_features) + 1,
            "CTLabel": csv_info['tract_number'],
            "BoroCode": csv_info['boro_code'],
            "BoroName": csv_info['boro_name'],
            "CT2020": csv_info['tract_number'],
            "BoroCT2020": f"{csv_info['boro_code']}{csv_info['tract_number']}" if csv_info['boro_code'] and csv_info['tract_number'] else "",
            "CDEligibil": "",
            "NTAName": "",
            "NTA2020": "",
            "CDTA2020": "",
            "CDTANAME": "",
            "GEOID": geoid_numeric,  # Store numeric part
            "PUMA": "",
            "Shape__Area": 0,
            "Shape__Length": 0
        }
    }
    new_features.append(feature)

# Add new features to JSON
print(f"\nAdding {len(new_features)} new features to JSON...")
json_data['features'].extend(new_features)

# Update metadata if present
if 'properties' in json_data:
    json_data['properties']['exceededTransferLimit'] = False

# Write updated JSON
print("Writing updated JSON file...")
output_path = json_path
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(json_data, f, indent=2, ensure_ascii=False)

print(f"\n✓ Updated {output_path}")
print(f"  Added {len(new_features)} districts")
print(f"  Total features: {len(json_data['features'])}")
print(f"\n⚠ WARNING: New districts have empty geometry coordinates!")
print(f"  Geometry data must be added from a shapefile or Census API.")
print(f"  Missing districts saved to: missing_districts_geoid_list.txt")

# Save list of missing GEOIDs for reference
with open('missing_districts_geoid_list.txt', 'w') as f:
    f.write("# Missing districts GEOIDs (for geometry lookup)\n")
    for geo_id in missing_geo_ids:
        csv_info = csv_data[geo_id]
        geoid_numeric = geo_id.replace('1400000US', '') if geo_id.startswith('1400000US') else geo_id
        f.write(f"{geoid_numeric} # {csv_info['name']}\n")

print("\nDone!")

