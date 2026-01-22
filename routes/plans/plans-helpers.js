/**
 * Plans Route Helpers
 * Shared utility functions used across plan route modules
 */

const trimString = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseLocation = (input) => {
  if (input === null) return null;
  if (!input || typeof input !== 'object') return undefined;

  const latitude = toNumber(input.latitude ?? input.lat);
  const longitude = toNumber(input.longitude ?? input.lon);

  const location = {
    addressLine1: trimString(input.addressLine1 ?? input.address),
    addressLine2: trimString(input.addressLine2 ?? input.unit),
    city: trimString(input.city),
    state: trimString(input.state ?? input.region),
    postalCode: trimString(input.postalCode ?? input.zip ?? input.postcode),
    country: trimString(input.country) ?? 'US'
  };

  if (latitude !== undefined) location.latitude = latitude;
  if (longitude !== undefined) location.longitude = longitude;

  const hasData = Object.values(location).some((value) => value !== undefined);
  return hasData ? location : undefined;
};

const parseBoundingBox = (input) => {
  if (!input || typeof input !== 'object') return undefined;
  const west = toNumber(input.west);
  const south = toNumber(input.south);
  const east = toNumber(input.east);
  const north = toNumber(input.north);
  if ([west, south, east, north].some((value) => value === undefined)) {
    return undefined;
  }
  return { west, south, east, north };
};

const isValidBoundingBox = (bbox) => {
  if (!bbox) return false;
  const required = ['west', 'south', 'east', 'north'];
  if (required.some((key) => !Number.isFinite(bbox[key]))) return false;
  if (bbox.east <= bbox.west) return false;
  if (bbox.north <= bbox.south) return false;
  return true;
};

const computeBoundingBoxCenter = (bbox) => ({
  lat: (bbox.north + bbox.south) / 2,
  lon: (bbox.east + bbox.west) / 2
});

const computeBoundingBoxSpanMiles = (bbox) => {
  const latSpan = Math.abs(bbox.north - bbox.south);
  const lonSpan = Math.abs(bbox.east - bbox.west);
  const centerLat = (bbox.north + bbox.south) / 2;
  const milesPerLat = 69.0;
  const milesPerLon = Math.cos((centerLat * Math.PI) / 180) * 69.172 || 69.172;
  return {
    widthMiles: lonSpan * Math.abs(milesPerLon),
    heightMiles: latSpan * milesPerLat
  };
};

const isWithinBoundingBox = (lat, lon, bbox, toleranceMeters = 40) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !isValidBoundingBox(bbox)) {
    return false;
  }
  const centerLat = (bbox.north + bbox.south) / 2;
  const latTolerance = toleranceMeters / 111000;
  const lonDenominator = Math.cos((centerLat * Math.PI) / 180) * 111000;
  const lonTolerance = lonDenominator ? toleranceMeters / lonDenominator : toleranceMeters / 111000;

  return (
    lat >= bbox.south - latTolerance &&
    lat <= bbox.north + latTolerance &&
    lon >= bbox.west - lonTolerance &&
    lon <= bbox.east + lonTolerance
  );
};

const subdivideBoundingBox = (bbox) => {
  const midLat = (bbox.north + bbox.south) / 2;
  const midLon = (bbox.east + bbox.west) / 2;
  if (!Number.isFinite(midLat) || !Number.isFinite(midLon)) {
    return [];
  }
  const subBoxes = [
    { west: bbox.west, south: midLat, east: midLon, north: bbox.north }, // NW
    { west: midLon, south: midLat, east: bbox.east, north: bbox.north }, // NE
    { west: bbox.west, south: bbox.south, east: midLon, north: midLat }, // SW
    { west: midLon, south: bbox.south, east: bbox.east, north: midLat } // SE
  ];
  return subBoxes.filter((box) => isValidBoundingBox(box));
};

const parseCenter = (input) => {
  if (!input || typeof input !== 'object') return undefined;
  const lat = toNumber(input.lat ?? input.latitude);
  const lon = toNumber(input.lon ?? input.longitude);
  if (lat === undefined || lon === undefined) return undefined;
  return { lat, lon };
};

const parseMarketingAlgorithms = (input) => {
  const AVAILABLE_MARKETING_ALGORITHMS = {
    microsoft_footprints: 'Microsoft Building Footprints (OAuth2)',
    osm_buildings: 'OpenStreetMap Building Footprints',
    arcgis_address_points: 'ArcGIS Address Points',
    arcgis_building_footprints: 'ArcGIS Building Footprints (Feature Service)',
    arcgis_places: 'ArcGIS Places & Amenities'
  };

  if (!Array.isArray(input)) return undefined;
  const normalized = input
    .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : null))
    .filter(Boolean)
    .filter((value, index, self) => self.indexOf(value) === index)
    .filter((value) => Object.prototype.hasOwnProperty.call(AVAILABLE_MARKETING_ALGORITHMS, value));
  return normalized.length ? normalized : undefined;
};

const parseMarketing = (input) => {
  if (input === null) return null;
  if (!input || typeof input !== 'object') return undefined;

  const marketing = {};

  const radius = toNumber(input.targetRadiusMiles ?? input.radiusMiles ?? input.radius);
  if (radius !== undefined) marketing.targetRadiusMiles = radius;

  const lastRunAt = input.lastRunAt ? new Date(input.lastRunAt) : undefined;
  if (lastRunAt && !Number.isNaN(lastRunAt.valueOf())) {
    marketing.lastRunAt = lastRunAt;
  }

  const lastResultCount = toNumber(input.lastResultCount);
  if (lastResultCount !== undefined) marketing.lastResultCount = lastResultCount;

  const boundingBox = parseBoundingBox(input.lastBoundingBox ?? input.boundingBox);
  if (boundingBox) marketing.lastBoundingBox = boundingBox;

  const center = parseCenter(input.lastCenter ?? input.center);
  if (center) marketing.lastCenter = center;

  if (Array.isArray(input.addresses)) {
    marketing.addresses = input.addresses
      .map((addr) => {
        const latitude = toNumber(addr.latitude ?? addr.lat);
        const longitude = toNumber(addr.longitude ?? addr.lon);
        const addressLine1 = trimString(addr.addressLine1 ?? addr.address);
        const addressLine2 = trimString(addr.addressLine2 ?? addr.unit);
        const city = trimString(addr.city);
        const state = trimString(addr.state);
        const postalCode = trimString(addr.postalCode ?? addr.zip ?? addr.postcode);
        const country = trimString(addr.country);
        const source = trimString(addr.source);

        if (
          addressLine1 ||
          addressLine2 ||
          city ||
          state ||
          postalCode ||
          country ||
          (latitude !== undefined && longitude !== undefined)
        ) {
          const result = {
            addressLine1,
            addressLine2,
            city,
            state,
            postalCode,
            country,
            source
          };
          if (latitude !== undefined) result.latitude = latitude;
          if (longitude !== undefined) result.longitude = longitude;
          return result;
        }
        return null;
      })
      .filter(Boolean);
  }

  const algorithms = parseMarketingAlgorithms(input.algorithms);
  if (algorithms) {
    marketing.algorithms = algorithms;
  }
  if (input.algorithmStats && typeof input.algorithmStats === 'object') {
    marketing.algorithmStats = input.algorithmStats;
  }

  const hasData = Object.keys(marketing).length > 0;
  return hasData ? marketing : undefined;
};

module.exports = {
  trimString,
  toNumber,
  parseLocation,
  parseBoundingBox,
  isValidBoundingBox,
  computeBoundingBoxCenter,
  computeBoundingBoxSpanMiles,
  isWithinBoundingBox,
  subdivideBoundingBox,
  parseCenter,
  parseMarketingAlgorithms,
  parseMarketing
};

