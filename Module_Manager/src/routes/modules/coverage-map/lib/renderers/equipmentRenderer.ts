/**
 * Equipment rendering functions
 */
import type { NetworkEquipment } from '../models';
import { getEquipmentColor } from '../utils/mapColorUtils';

export interface EquipmentRenderContext {
  graphicsLayer: any;
  graphicsMap: Map<string, any>;
  locationTypeFilter?: string[];
}

export async function renderEquipment(
  equipment: NetworkEquipment[],
  context: EquipmentRenderContext
): Promise<{ rendered: number; skipped: number }> {
  const { graphicsLayer, graphicsMap, locationTypeFilter = [] } = context;
  
  if (!graphicsLayer || !Array.isArray(equipment) || equipment.length === 0) {
    return { rendered: 0, skipped: 0 };
  }

  const [
    { default: Graphic },
    { default: Point },
    { default: SimpleMarkerSymbol }
  ] = await Promise.all([
    import('@arcgis/core/Graphic.js'),
    import('@arcgis/core/geometry/Point.js'),
    import('@arcgis/core/symbols/SimpleMarkerSymbol.js')
  ]);

  // Filter equipment by location type and validate coordinates
  const visibleEquipment = equipment.filter(eq => {
    // Check location type filter
    if (locationTypeFilter.length > 0 && !locationTypeFilter.includes(eq.locationType)) {
      return false;
    }
    
    // Validate coordinates
    const lat = eq.location?.latitude;
    const lon = eq.location?.longitude;
    
    if (lat == null || lon == null) {
      return false;
    }
    
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return false;
    }
    
    // Filter out 0,0 (invalid location)
    if (lat === 0 && lon === 0) {
      return false;
    }
    
    // Validate coordinate ranges
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return false;
    }
    
    return true;
  });

  const isMobile = window.innerWidth <= 768;
  const symbolSize = isMobile ? '16px' : '12px';
  const outlineWidth = isMobile ? 2 : 1;

  let rendered = 0;
  let skipped = equipment.length - visibleEquipment.length;

  visibleEquipment.forEach(eq => {
    try {
      const symbol = new SimpleMarkerSymbol({
        style: 'circle',
        color: getEquipmentColor(eq.status),
        size: symbolSize,
        outline: {
          color: 'white',
          width: outlineWidth
        }
      });

      const point = new Point({
        longitude: eq.location!.longitude,
        latitude: eq.location!.latitude
      });

      const graphic = new Graphic({
        geometry: point,
        symbol,
        attributes: {
          ...eq,
          type: 'equipment',
          id: eq.id
        }
      });

      graphicsLayer.add(graphic);
      const graphicId = `equipment-${eq.id}`;
      graphicsMap.set(graphicId, graphic);
      rendered++;
    } catch (error) {
      console.error('[CoverageMap] Error rendering equipment:', eq.id, error);
      skipped++;
    }
  });

  return { rendered, skipped };
}
