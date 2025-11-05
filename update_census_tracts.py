#!/usr/bin/env python3
"""
Script to update census-tracts.ts by merging census-districts.json with CSV demographic data.

This script:
1. Reads census-districts.json (geometry + basic properties)
2. Reads ACS demographic data from CSV
3. Merges them together
4. Generates census-tracts.ts TypeScript file
"""

import json
import csv
from pathlib import Path

# Age group mapping from CSV column names to display names
AGE_GROUP_MAPPING = {
    'S0101_C01_002E': ('Under 5 years', 'total'),
    'S0101_C01_002M': ('Under 5 years', 'totalMOE'),
    'S0101_C01_003E': ('5 to 9 years', 'total'),
    'S0101_C01_003M': ('5 to 9 years', 'totalMOE'),
    'S0101_C01_004E': ('10 to 14 years', 'total'),
    'S0101_C01_004M': ('10 to 14 years', 'totalMOE'),
    'S0101_C01_005E': ('15 to 19 years', 'total'),
    'S0101_C01_005M': ('15 to 19 years', 'totalMOE'),
    'S0101_C01_006E': ('20 to 24 years', 'total'),
    'S0101_C01_006M': ('20 to 24 years', 'totalMOE'),
    'S0101_C01_007E': ('25 to 29 years', 'total'),
    'S0101_C01_007M': ('25 to 29 years', 'totalMOE'),
    'S0101_C01_008E': ('30 to 34 years', 'total'),
    'S0101_C01_008M': ('30 to 34 years', 'totalMOE'),
    'S0101_C01_009E': ('35 to 39 years', 'total'),
    'S0101_C01_009M': ('35 to 39 years', 'totalMOE'),
    'S0101_C01_010E': ('40 to 44 years', 'total'),
    'S0101_C01_010M': ('40 to 44 years', 'totalMOE'),
    'S0101_C01_011E': ('45 to 49 years', 'total'),
    'S0101_C01_011M': ('45 to 49 years', 'totalMOE'),
    'S0101_C01_012E': ('50 to 54 years', 'total'),
    'S0101_C01_012M': ('50 to 54 years', 'totalMOE'),
    'S0101_C01_013E': ('55 to 59 years', 'total'),
    'S0101_C01_013M': ('55 to 59 years', 'totalMOE'),
    'S0101_C01_014E': ('60 to 64 years', 'total'),
    'S0101_C01_014M': ('60 to 64 years', 'totalMOE'),
    'S0101_C01_015E': ('65 to 69 years', 'total'),
    'S0101_C01_015M': ('65 to 69 years', 'totalMOE'),
    'S0101_C01_016E': ('70 to 74 years', 'total'),
    'S0101_C01_016M': ('70 to 74 years', 'totalMOE'),
    'S0101_C01_017E': ('75 to 79 years', 'total'),
    'S0101_C01_017M': ('75 to 79 years', 'totalMOE'),
    'S0101_C01_018E': ('80 to 84 years', 'total'),
    'S0101_C01_018M': ('80 to 84 years', 'totalMOE'),
    'S0101_C01_019E': ('85 years and over', 'total'),
    'S0101_C01_019M': ('85 years and over', 'totalMOE'),
}

def parse_value(value):
    """Parse CSV value, handling special cases like (X), -, etc."""
    if not value or value.strip() in ['(X)', '-', 'N', '']:
        return 0
    try:
        # Remove commas and convert to int
        return int(value.replace(',', '').strip())
    except (ValueError, AttributeError):
        return 0

def read_csv_data(csv_path):
    """Read demographic data from CSV."""
    print(f"Reading CSV data from: {csv_path}")
    csv_data = {}
    
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for record in reader:
            # Get GEO_ID
            geo_id = (record.get('GEO_ID', '') or record.get('"GEO_ID"', '') or 
                     record.get('\ufeff"GEO_ID"', '')).strip().strip('"')
            
            # Skip header rows
            if not geo_id or geo_id in ['GEO_ID', 'Geography'] or not geo_id.startswith('1400000US'):
                continue
            
            name = (record.get('NAME', '') or record.get('"NAME"', '')).strip().strip('"')
            
            # Get total population
            total_pop = parse_value(record.get('S0101_C01_001E', '') or 
                                   record.get('"S0101_C01_001E"', ''))
            total_pop_moe = parse_value(record.get('S0101_C01_001M', '') or 
                                       record.get('"S0101_C01_001M"', ''))
            
            # Build age groups
            age_groups = {}
            for col_name, (age_group, field) in AGE_GROUP_MAPPING.items():
                if age_group not in age_groups:
                    age_groups[age_group] = {}
                
                value = parse_value(record.get(col_name, '') or record.get(f'"{col_name}"', ''))
                age_groups[age_group][field] = value
            
            csv_data[geo_id] = {
                'GEO_ID': geo_id,
                'NAME': name,
                'totalPopulation': total_pop,
                'totalPopulationMOE': total_pop_moe,
                'ageGroups': age_groups,
            }
    
    print(f"✓ Loaded {len(csv_data)} records from CSV")
    return csv_data

def read_json_data(json_path):
    """Read geometry and basic properties from JSON."""
    print(f"Reading JSON data from: {json_path}")
    with open(json_path, 'r', encoding='utf-8') as f:
        json_data = json.load(f)
    
    print(f"✓ Loaded {len(json_data.get('features', []))} features from JSON")
    return json_data

def merge_data(json_data, csv_data):
    """Merge JSON geometry with CSV demographic data."""
    print("\nMerging data...")
    
    merged_features = []
    matched_count = 0
    missing_count = 0
    
    for feature in json_data.get('features', []):
        props = feature.get('properties', {})
        geoid = props.get('GEOID', '').strip()
        
        # Normalize GEOID to match CSV format
        if geoid.isdigit() and len(geoid) == 11:
            full_geoid = f'1400000US{geoid}'
        elif geoid.startswith('1400000US'):
            full_geoid = geoid
        else:
            continue
        
        # Get CSV data for this GEOID
        csv_info = csv_data.get(full_geoid)
        
        if csv_info:
            # Merge properties
            merged_props = {
                **props,  # Keep original JSON properties
                **csv_info,  # Add CSV demographic data
            }
            
            # Ensure GEOID is in the numeric format
            merged_props['GEOID'] = geoid if geoid.isdigit() else full_geoid.replace('1400000US', '')
            
            merged_feature = {
                'type': 'Feature',
                'geometry': feature.get('geometry', {}),
                'properties': merged_props,
            }
            
            merged_features.append(merged_feature)
            matched_count += 1
        else:
            # Feature exists in JSON but not in CSV - still include it
            # with zero/empty demographic data
            merged_props = {
                **props,
                'GEO_ID': full_geoid,
                'NAME': props.get('CTLabel', ''),
                'totalPopulation': 0,
                'totalPopulationMOE': 0,
                'ageGroups': {},
            }
            
            merged_feature = {
                'type': 'Feature',
                'geometry': feature.get('geometry', {}),
                'properties': merged_props,
            }
            
            merged_features.append(merged_feature)
            missing_count += 1
    
    print(f"✓ Matched {matched_count} features")
    if missing_count > 0:
        print(f"⚠ {missing_count} features missing CSV data")
    
    return {
        'type': 'FeatureCollection',
        'features': merged_features,
    }

def format_ts_value(value, indent_level=0):
    """Format a value for TypeScript output."""
    indent = '  ' * indent_level
    
    if isinstance(value, dict):
        if not value:
            return '{}'
        lines = ['{']
        for k, v in value.items():
            key_str = json.dumps(k) if not k.isidentifier() else k
            val_str = format_ts_value(v, indent_level + 1)
            lines.append(f'{indent}  {key_str}: {val_str},')
        lines.append(f'{indent}}}')
        return '\n'.join(lines)
    elif isinstance(value, list):
        if not value:
            return '[]'
        if len(value) > 0 and isinstance(value[0], (int, float)):
            # Array of numbers - format compactly
            return json.dumps(value)
        else:
            # Array of objects - format with indentation
            lines = ['[']
            for item in value:
                item_str = format_ts_value(item, indent_level + 1)
                lines.append(f'{indent}  {item_str},')
            lines.append(f'{indent}]')
            return '\n'.join(lines)
    else:
        return json.dumps(value, ensure_ascii=False)

def generate_typescript(merged_data, output_path):
    """Generate TypeScript file from merged data."""
    print(f"\nGenerating TypeScript file: {output_path}")
    
    # Start with header
    lines = [
        '// Auto-generated from Census ACS 2019-2023 data',
        '// Source: ACSST5Y2023.S0101-Data.csv merged with census-districts.json',
        '// Generated by update_census_tracts.py',
        '',
        'export const censusTracts = ',
    ]
    
    # Format the data as JSON (TypeScript accepts JSON)
    # Use json.dump with proper formatting for large files
    data_str = json.dumps(merged_data, indent=2, ensure_ascii=False)
    lines.append(data_str)
    lines.append(';')
    
    # Write to file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    
    print(f"✓ Generated TypeScript file: {output_path}")
    print(f"  Total features: {len(merged_data['features'])}")
    print(f"  File size: {output_path.stat().st_size / 1024 / 1024:.2f} MB")

def main():
    print("=" * 60)
    print("Census Tracts TypeScript Generator")
    print("=" * 60)
    
    # File paths
    csv_path = Path('src/app/_components/data/census_age_sex_data/ACSST5Y2023.S0101-Data.csv')
    json_path = Path('src/app/_components/data/census-districts.json')
    output_path = Path('src/app/_components/data/census-tracts.ts')
    
    # Read data
    csv_data = read_csv_data(csv_path)
    json_data = read_json_data(json_path)
    
    # Merge data
    merged_data = merge_data(json_data, csv_data)
    
    # Generate TypeScript file
    generate_typescript(merged_data, output_path)
    
    print("\n" + "=" * 60)
    print("✓ Complete!")
    print("=" * 60)
    
    return 0

if __name__ == "__main__":
    exit(main())

