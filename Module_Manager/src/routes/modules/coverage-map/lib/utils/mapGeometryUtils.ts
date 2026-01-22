/**
 * Geometry utility functions for map graphics
 */

export function createSectorCone(lat: number, lon: number, azimuth: number, beamwidth: number, radius: number): any {
  const startAngle = azimuth - beamwidth / 2;
  const endAngle = azimuth + beamwidth / 2;
  const rings = [[
    [lon, lat]
  ]];

  for (let angle = startAngle; angle <= endAngle; angle += 5) {
    const radians = (angle * Math.PI) / 180;
    const x = lon + radius * Math.sin(radians);
    const y = lat + radius * Math.cos(radians);
    rings[0].push([x, y]);
  }

  rings[0].push([lon, lat]);

  return {
    type: 'polygon',
    rings,
    spatialReference: { wkid: 4326 }
  };
}

export function normalizePlanGeometry(geometry: any): any {
  if (!geometry) return null;

  // Handle GeoJSON format
  if (geometry.type && geometry.coordinates) {
    if (geometry.type === 'Point') {
      return {
        type: 'point',
        latitude: geometry.coordinates[1],
        longitude: geometry.coordinates[0],
        spatialReference: { wkid: 4326 }
      };
    } else if (geometry.type === 'LineString') {
      return {
        type: 'polyline',
        paths: [geometry.coordinates.map((coord: number[]) => [coord[0], coord[1]])],
        spatialReference: { wkid: 4326 }
      };
    } else if (geometry.type === 'Polygon') {
      return {
        type: 'polygon',
        rings: geometry.coordinates.map((ring: number[][]) => ring.map((coord: number[]) => [coord[0], coord[1]])),
        spatialReference: { wkid: 4326 }
      };
    }
  }

  // Handle Esri format (already normalized)
  if (geometry.spatialReference || geometry.latitude || geometry.longitude || geometry.paths || geometry.rings) {
    return geometry;
  }

  return null;
}
