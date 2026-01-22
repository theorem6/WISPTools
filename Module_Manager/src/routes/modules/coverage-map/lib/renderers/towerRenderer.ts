/**
 * Tower/Site rendering functions
 */
import type { TowerSite } from '../models';
import { createLocationIcon } from '$lib/mapIcons';
import { getTowerColor } from '../utils/mapColorUtils';

export interface TowerRenderContext {
  graphicsLayer: any;
  graphicsMap: Map<string, any>;
  mapView: any;
}

export async function renderTowers(
  towers: TowerSite[],
  context: TowerRenderContext
): Promise<{ rendered: number; skipped: number }> {
  const { graphicsLayer, graphicsMap } = context;
  
  if (!graphicsLayer || !Array.isArray(towers) || towers.length === 0) {
    return { rendered: 0, skipped: 0 };
  }

  const [
    { default: Graphic },
    { default: Point },
    { default: SimpleMarkerSymbol },
    { default: PictureMarkerSymbol }
  ] = await Promise.all([
    import('@arcgis/core/Graphic.js'),
    import('@arcgis/core/geometry/Point.js'),
    import('@arcgis/core/symbols/SimpleMarkerSymbol.js'),
    import('@arcgis/core/symbols/PictureMarkerSymbol.js')
  ]);

  const isMobile = window.innerWidth <= 768;
  const iconSize = isMobile ? 48 : 40;
  const symbolSize = isMobile ? '28px' : '20px';
  const outlineWidth = isMobile ? 4 : 3;

  let rendered = 0;
  let skipped = 0;

  towers.forEach(tower => {
    try {
      // Validate tower has required location data
      if (!tower.location || !tower.location.latitude || !tower.location.longitude) {
        console.warn('[CoverageMap] Tower missing location data:', tower.id, tower.name, tower.location);
        skipped++;
        return;
      }

      const lat = tower.location.latitude;
      const lon = tower.location.longitude;

      // Validate coordinates are valid numbers
      if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
        console.warn('[CoverageMap] Tower has invalid coordinates:', tower.id, { lat, lon });
        skipped++;
        return;
      }

      // Validate coordinate ranges
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        console.warn('[CoverageMap] Tower coordinates out of range:', tower.id, { lat, lon });
        skipped++;
        return;
      }

      // Normalize type field - handle both string and array formats
      let towerType: string;
      if (Array.isArray(tower.type)) {
        const preferredTypes = ['noc', 'warehouse', 'vehicle', 'rma', 'vendor', 'internet-access', 'internet'];
        const preferredType = tower.type.find((t: string) => preferredTypes.includes(t));
        towerType = preferredType || tower.type[0] || 'tower';
      } else {
        towerType = tower.type || 'tower';
      }

      let symbol;
      const customIcon = createLocationIcon(towerType, iconSize);

      if (customIcon) {
        symbol = new PictureMarkerSymbol(customIcon);
      } else {
        const color = getTowerColor(towerType, tower.status);
        symbol = new SimpleMarkerSymbol({
          style: 'circle',
          color: color,
          size: symbolSize,
          outline: {
            color: 'white',
            width: outlineWidth
          }
        });
      }

      const point = new Point({
        longitude: lon,
        latitude: lat
      });

      const graphic = new Graphic({
        geometry: point,
        symbol,
        attributes: {
          ...tower,
          type: 'tower',
          id: tower.id,
          name: tower.name
        }
      });

      graphicsLayer.add(graphic);
      // Track graphic by ID for incremental updates
      const graphicId = `tower-${tower.id}`;
      graphicsMap.set(graphicId, graphic);
      rendered++;
    } catch (towerError) {
      console.error('[CoverageMap] Error rendering tower:', tower.id, towerError);
      skipped++;
    }
  });

  return { rendered, skipped };
}
