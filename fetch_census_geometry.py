#!/usr/bin/env python3
"""
Script to fetch geometry data for missing census districts from Census Bureau TIGER/Line shapefiles.

This script:
1. Downloads 2020 Census Tract shapefiles for New York State
2. Extracts geometry for missing districts
3. Merges geometry into census-districts.json
"""

import json
import zipfile
import urllib.request
from pathlib import Path
import tempfile
import shutil

try:
    import geopandas as gpd
    HAS_GEOPANDAS = True
except ImportError:
    HAS_GEOPANDAS = False
    print("⚠ geopandas not installed. Installing required packages...")
    print("   Run: pip install geopandas shapely")

try:
    from shapely.geometry import mapping
    HAS_SHAPELY = True
except ImportError:
    HAS_SHAPELY = False

# Census Bureau TIGER/Line shapefile download URLs
# 2020 Census Tracts for New York State (36)
TIGER_URLS = {
    '2020': 'https://www2.census.gov/geo/tiger/TIGER2020/TRACT/tl_2020_36_tract.zip',
    # Alternative: 2023 version (if 2020 is not available)
    # '2023': 'https://www2.census.gov/geo/tiger/TIGER2023/TRACT/tl_2023_36_tract.zip'
}

def download_shapefile(url, output_dir):
    """Download and extract shapefile from Census Bureau."""
    print(f"Downloading shapefile from: {url}")
    zip_path = output_dir / "tiger_tracts.zip"
    
    try:
        urllib.request.urlretrieve(url, zip_path)
        print(f"✓ Downloaded to {zip_path}")
        
        # Extract zip file
        print("Extracting shapefile...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(output_dir)
        print(f"✓ Extracted to {output_dir}")
        
        return True
    except Exception as e:
        print(f"✗ Error downloading: {e}")
        return False

def load_shapefile(shapefile_dir):
    """Load shapefile using geopandas."""
    if not HAS_GEOPANDAS:
        raise ImportError("geopandas is required. Install with: pip install geopandas")
    
    # Find .shp file
    shp_files = list(shapefile_dir.glob("*.shp"))
    if not shp_files:
        raise FileNotFoundError(f"No .shp file found in {shapefile_dir}")
    
    shp_path = shp_files[0]
    print(f"Loading shapefile: {shp_path}")
    
    gdf = gpd.read_file(shp_path)
    print(f"✓ Loaded {len(gdf)} features")
    print(f"  Columns: {list(gdf.columns)}")
    
    return gdf

def geoid_to_full_format(geoid):
    """Convert 11-digit GEOID to full format."""
    if len(geoid) == 11 and geoid.isdigit():
        return f"1400000US{geoid}"
    return geoid

def update_json_with_geometry(json_path, geometry_map, missing_geoids):
    """Update JSON file with geometry data for missing districts."""
    print(f"\nReading JSON file: {json_path}")
    with open(json_path, 'r', encoding='utf-8') as f:
        json_data = json.load(f)
    
    updated_count = 0
    missing_geometry = []
    
    for feature in json_data.get('features', []):
        geoid_prop = feature.get('properties', {}).get('GEOID', '').strip()
        
        # Normalize GEOID
        if geoid_prop.isdigit() and len(geoid_prop) == 11:
            full_geoid = f"1400000US{geoid_prop}"
        elif geoid_prop.startswith('1400000US'):
            full_geoid = geoid_prop
        else:
            continue
        
        # Check if this district needs geometry and if we have it
        if full_geoid in missing_geoids and geoid_prop in geometry_map:
            geometry = geometry_map[geoid_prop]
            
            # Convert geometry to GeoJSON format
            if HAS_GEOPANDAS:
                # geopandas geometry can be converted directly
                geom_dict = geometry.__geo_interface__ if hasattr(geometry, '__geo_interface__') else mapping(geometry)
            else:
                # Fallback if using shapely directly
                geom_dict = mapping(geometry)
            
            # Update feature geometry
            if geom_dict['type'] == 'Polygon':
                # Convert Polygon to MultiPolygon for consistency
                feature['geometry'] = {
                    'type': 'MultiPolygon',
                    'coordinates': [geom_dict['coordinates']]
                }
            elif geom_dict['type'] == 'MultiPolygon':
                feature['geometry'] = geom_dict
            else:
                feature['geometry'] = geom_dict
            
            updated_count += 1
            print(f"  ✓ Updated geometry for GEOID {geoid_prop}")
        elif full_geoid in missing_geoids:
            missing_geometry.append(geoid_prop)
    
    if missing_geometry:
        print(f"\n⚠ Could not find geometry for {len(missing_geometry)} districts:")
        for geoid in missing_geometry[:10]:
            print(f"    {geoid}")
        if len(missing_geometry) > 10:
            print(f"    ... and {len(missing_geometry) - 10} more")
    
    # Write updated JSON
    print(f"\nWriting updated JSON file...")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Updated {updated_count} districts with geometry")
    return updated_count, len(missing_geometry)

def main():
    print("=" * 60)
    print("Census Geometry Data Fetcher")
    print("=" * 60)
    
    # Check dependencies
    if not HAS_GEOPANDAS:
        print("\n❌ Required package missing: geopandas")
        print("\nPlease install required packages:")
        print("  pip install geopandas shapely")
        print("\nOr use conda:")
        print("  conda install -c conda-forge geopandas")
        return 1
    
    # Read list of missing GEOIDs
    missing_geoid_file = Path('missing_districts_geoid_list.txt')
    if not missing_geoid_file.exists():
        print(f"❌ Missing file: {missing_geoid_file}")
        print("   Run update_census_districts.py first to generate this file.")
        return 1
    
    print(f"\nReading missing GEOIDs from: {missing_geoid_file}")
    missing_geoids_full = []
    missing_geoids_numeric = []
    
    with open(missing_geoid_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                # Extract GEOID from line (format: "36005001903 # Census Tract...")
                geoid = line.split('#')[0].strip()
                if geoid:
                    missing_geoids_numeric.append(geoid)
                    missing_geoids_full.append(geoid_to_full_format(geoid))
    
    print(f"  Found {len(missing_geoids_numeric)} missing districts")
    
    # Create temporary directory for shapefile
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        shapefile_dir = temp_path / "tracts"
        shapefile_dir.mkdir()
        
        # Download shapefile
        print(f"\n{'='*60}")
        print("Step 1: Downloading Census TIGER/Line shapefile")
        print(f"{'='*60}")
        
        url = TIGER_URLS['2020']
        if not download_shapefile(url, shapefile_dir):
            print("❌ Failed to download shapefile")
            return 1
        
        # Load shapefile
        print(f"\n{'='*60}")
        print("Step 2: Loading shapefile")
        print(f"{'='*60}")
        
        try:
            gdf = load_shapefile(shapefile_dir)
        except Exception as e:
            print(f"❌ Error loading shapefile: {e}")
            return 1
        
        # Check GEOID column name (could be GEOID, GEOID20, GEOID_TRT, etc.)
        geoid_col = None
        for col in ['GEOID', 'GEOID20', 'GEOID_TRT', 'TRACTCE20']:
            if col in gdf.columns:
                geoid_col = col
                break
        
        if not geoid_col:
            print(f"❌ Could not find GEOID column in shapefile")
            print(f"   Available columns: {list(gdf.columns)}")
            return 1
        
        print(f"  Using GEOID column: {geoid_col}")
        
        # Filter to only missing districts
        print(f"\n{'='*60}")
        print("Step 3: Extracting geometry for missing districts")
        print(f"{'='*60}")
        
        geometry_map = {}
        found_count = 0
        
        for geoid_numeric in missing_geoids_numeric:
            # Try to find matching row in shapefile
            # GEOID in shapefile might be full format or just numeric
            mask = gdf[geoid_col] == geoid_numeric
            if not mask.any():
                # Try full format
                full_geoid = geoid_to_full_format(geoid_numeric)
                mask = gdf[geoid_col] == full_geoid
            
            if mask.any():
                row = gdf[mask].iloc[0]
                geometry_map[geoid_numeric] = row.geometry
                found_count += 1
        
        print(f"  Found geometry for {found_count} out of {len(missing_geoids_numeric)} districts")
        
        if found_count == 0:
            print("\n⚠ No matching geometries found. Possible reasons:")
            print("  1. GEOID format mismatch between shapefile and JSON")
            print("  2. Shapefile contains different year's data")
            print("  3. Districts may have been created/renumbered")
            print(f"\n  Sample GEOIDs from shapefile: {list(gdf[geoid_col].head(5))}")
            print(f"  Sample GEOIDs we're looking for: {missing_geoids_numeric[:5]}")
            return 1
        
        # Update JSON file
        print(f"\n{'='*60}")
        print("Step 4: Updating JSON file with geometry")
        print(f"{'='*60}")
        
        json_path = Path('src/app/_components/data/census-districts.json')
        updated_count, still_missing = update_json_with_geometry(
            json_path, 
            geometry_map, 
            set(missing_geoids_full)
        )
        
        print(f"\n{'='*60}")
        print("Summary")
        print(f"{'='*60}")
        print(f"✓ Updated {updated_count} districts with geometry")
        if still_missing > 0:
            print(f"⚠ {still_missing} districts still missing geometry")
        print(f"\n✓ JSON file updated: {json_path}")
    
    return 0

if __name__ == "__main__":
    exit(main())

