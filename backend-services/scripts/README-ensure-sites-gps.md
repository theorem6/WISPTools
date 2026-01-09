# Ensure All Sites Have GPS Coordinates

This script ensures all sites in the database have GPS coordinates for mobile app lookup.

## Purpose

The mobile app (`wisp-field-app`) requires sites to have GPS coordinates (`latitude` and `longitude`) to:
- Show nearby towers
- Calculate distances
- Enable navigation to sites
- Display sites on maps

## Usage

### Run the script:

```bash
cd backend-services
node scripts/ensure-sites-have-gps.js
```

### What it does:

1. **Finds all sites** in the database
2. **Identifies sites missing GPS coordinates**
3. **Attempts to geocode addresses** for sites that have addresses but no coordinates
4. **Reports sites** that need manual coordinate entry

### Geocoding:

The script uses:
- **ArcGIS Geocoding API** (if configured in `config/app.js`)
- **Nominatim (OpenStreetMap)** as fallback

Rate limiting: Nominatim requires 1 request per second, so the script includes delays.

## Output

The script will:
- Show how many sites have/need coordinates
- Attempt to geocode sites with addresses
- List sites that need manual entry
- Report final status

## Example Output

```
🔍 Ensuring all sites have GPS coordinates...

✅ Connected to MongoDB

📊 Found 150 total sites

📈 Site Analysis:
   ✅ Sites with GPS coordinates: 120
   ❌ Sites without GPS coordinates: 30
   📍 Sites with address (can geocode): 25

🌍 Geocoding addresses...

   Geocoding: Tower Site 1 - 123 Main St, City, State
   ✅ Updated: 40.712776, -74.005974

📊 Summary:
   ✅ Successfully geocoded: 20
   ❌ Failed or needs manual entry: 10

✅ Final status: 10 sites still need GPS coordinates
```

## Manual Entry

For sites that can't be geocoded automatically, you'll need to:
1. Look up the site address on Google Maps
2. Get the GPS coordinates
3. Update the site via the API or web interface

## API Changes

The API endpoints have been updated to:
- **GET /api/network/sites**: Always returns location data in correct format
- **POST /api/network/sites**: Requires GPS coordinates for new sites
- **PUT /api/network/sites/:id**: Validates coordinates when updating

## Mobile App Compatibility

The mobile app expects sites to have:
```javascript
{
  location: {
    latitude: number,  // Required, must be valid number
    longitude: number, // Required, must be valid number
    address: string    // Optional but recommended
  }
}
```

Sites without valid coordinates will show distance as "unknown" in the mobile app.
