/**
 * Sector rendering functions
 */
import type { Sector, TowerSite } from '../models';
import { createSectorCone } from '../utils/mapGeometryUtils';
import { getBandColor, hexToRgb } from '../utils/mapColorUtils';

export interface SectorRenderContext {
  graphicsLayer: any;
  graphicsMap: Map<string, any>;
  mapView: any;
  towers: TowerSite[];
}

export async function renderSectors(
  sectors: Sector[],
  context: SectorRenderContext
): Promise<{ rendered: number; skipped: number }> {
  const { graphicsLayer, graphicsMap, mapView, towers } = context;
  
  if (!graphicsLayer || !Array.isArray(sectors) || sectors.length === 0) {
    return { rendered: 0, skipped: 0 };
  }

  const [
    { default: Graphic },
    { default: SimpleFillSymbol }
  ] = await Promise.all([
    import('@arcgis/core/Graphic.js'),
    import('@arcgis/core/symbols/SimpleFillSymbol.js')
  ]);

  let rendered = 0;
  let skipped = 0;

  for (const sector of sectors) {
    try {
      // Sectors might not have location directly - try to get it from associated site
      let sectorLat = sector.location?.latitude;
      let sectorLon = sector.location?.longitude;
      
      // If sector doesn't have location but has siteId, try to find the site
      if ((!sectorLat || !sectorLon) && sector.siteId) {
        const sectorSiteIdStr = String(sector.siteId);
        
        const associatedSite = towers?.find((t: any) => {
          const siteIdStr = String(t.id || t._id || '');
          return siteIdStr === sectorSiteIdStr || 
                 (t._id && String(t._id) === sectorSiteIdStr) ||
                 (sector.siteId && typeof sector.siteId === 'object' && String(sector.siteId) === siteIdStr);
        });
        
        if (associatedSite?.location && associatedSite.location.latitude && associatedSite.location.longitude) {
          sectorLat = associatedSite.location.latitude;
          sectorLon = associatedSite.location.longitude;
        }
      }
      
      if (!sectorLat || !sectorLon) {
        console.warn('[CoverageMap] Sector missing location:', {
          id: sector.id || sector._id,
          name: sector.name,
          siteId: sector.siteId
        });
        skipped++;
        continue;
      }

      // Calculate sector radius based on zoom level for better visibility
      const mapZoom = mapView?.zoom || 10;
      const baseRadius = 0.003;
      const zoomFactor = Math.max(0.5, Math.min(1.5, (mapZoom - 8) / 10));
      const sectorRadius = baseRadius * zoomFactor;
      
      const sectorPolygon = createSectorCone(
        sectorLat,
        sectorLon,
        sector.azimuth || 0,
        sector.beamwidth || 60,
        sectorRadius
      );

      const color = getBandColor(sector.band || sector.technology);
      const rgbaColor = hexToRgb(color);
      const transparentColor = [...rgbaColor, 0.3];

      const graphic = new Graphic({
        geometry: sectorPolygon,
        symbol: {
          type: 'simple-fill',
          color: transparentColor,
          style: 'solid',
          outline: {
            color: color,
            width: 1
          }
        },
        attributes: {
          ...sector,
          type: 'sector',
          id: sector.id || sector._id,
          name: sector.name,
          siteId: sector.siteId
        }
      });

      graphicsLayer.add(graphic);
      const graphicId = `sector-${sector.id}`;
      graphicsMap.set(graphicId, graphic);
      rendered++;
    } catch (sectorError) {
      console.error('[CoverageMap] Error rendering sector:', sector.id, sectorError);
      skipped++;
    }
  }

  return { rendered, skipped };
}
