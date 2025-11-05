# Fetching Census District Geometry Data

This guide explains how to get geometry data for the missing census districts in `census-districts.json`.

## Quick Start

1. **Install required Python packages:**
   ```bash
   pip install geopandas shapely
   ```
   
   Or using conda:
   ```bash
   conda install -c conda-forge geopandas
   ```

2. **Run the geometry fetcher script:**
   ```bash
   python3 fetch_census_geometry.py
   ```

The script will:
- Download 2020 Census TIGER/Line shapefiles for New York State
- Extract geometry for the 328 missing districts
- Merge geometry data into `census-districts.json`

## Manual Method

If the automated script doesn't work, you can manually download and process the shapefiles:

### Step 1: Download Shapefiles

1. Visit the [Census Bureau TIGER/Line Shapefiles](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html)
2. Select **2020** (or most recent year)
3. Select **Census Tracts** as the geography type
4. Select **New York** (State FIPS: 36)
5. Download the ZIP file (e.g., `tl_2020_36_tract.zip`)

### Step 2: Extract and Process

You can use one of these methods:

#### Option A: Using Python (geopandas)

```python
import geopandas as gpd
import json

# Load shapefile
gdf = gpd.read_file('path/to/tl_2020_36_tract.shp')

# Filter to your missing GEOIDs
missing_geoids = ['36005001903', '36005005100', ...]  # from missing_districts_geoid_list.txt
filtered = gdf[gdf['GEOID'].isin(missing_geoids)]

# Convert to GeoJSON and merge into your JSON file
# (See fetch_census_geometry.py for full implementation)
```

#### Option B: Using QGIS

1. Open QGIS
2. Import the shapefile: `Layer → Add Layer → Add Vector Layer`
3. Filter by GEOID field to show only missing districts
4. Export selected features as GeoJSON
5. Merge with existing `census-districts.json`

#### Option C: Using ogr2ogr (command line)

```bash
# Convert shapefile to GeoJSON
ogr2ogr -f GeoJSON missing_tracts.geojson tl_2020_36_tract.shp \
  -where "GEOID IN ('36005001903', '36005005100', ...)"

# Then merge with existing JSON
```

## Alternative: Census Bureau API

The Census Bureau also provides a REST API for geometry data:

```python
import requests

# Example: Get geometry for a specific tract
geoid = "36005000100"
url = f"https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/8/query"
params = {
    "where": f"GEOID='{geoid}'",
    "outFields": "*",
    "f": "geojson"
}
response = requests.get(url, params=params)
geometry = response.json()
```

For bulk downloads, the TIGER/Line shapefiles are more efficient.

## Troubleshooting

### GEOID Format Mismatch

The shapefile GEOID might be in a different format than your JSON. Common formats:
- `36005000100` (11 digits - state+county+tract)
- `1400000US36005000100` (full format with prefix)

The script handles both formats, but if issues persist, check:
```python
# Inspect shapefile GEOID format
import geopandas as gpd
gdf = gpd.read_file('tl_2020_36_tract.shp')
print(gdf['GEOID'].head(10))
```

### Missing Districts

If some districts still don't have geometry:
1. They may be new districts created after 2020
2. They may have been renumbered/merged
3. Check if they exist in a newer year's shapefile

### Large File Sizes

The shapefile for all of New York is ~50-100MB. The script uses a temporary directory that's automatically cleaned up.

## Validation

After updating, validate the results:

```bash
python3 validate_census_districts.py
```

This will confirm all districts are present and check data integrity.

