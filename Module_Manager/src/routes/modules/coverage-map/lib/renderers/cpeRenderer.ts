/**
 * CPE device rendering functions
 */
import type { CPEDevice } from '../models';
import { createSectorCone } from '../utils/mapGeometryUtils';
import { hexToRgb } from '../utils/mapColorUtils';

export interface CPERenderContext {
  graphicsLayer: any;
  graphicsMap: Map<string, any>;
}

export async function renderCPEDevices(
  cpeDevices: CPEDevice[],
  context: CPERenderContext
): Promise<{ rendered: number; skipped: number }> {
  const { graphicsLayer, graphicsMap } = context;
  
  if (!graphicsLayer || !Array.isArray(cpeDevices) || cpeDevices.length === 0) {
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

  cpeDevices.forEach(cpe => {
    try {
      if (cpe.status === 'inventory') {
        skipped++;
        return;
      }

      if (!cpe.location?.latitude || !cpe.location?.longitude) {
        skipped++;
        return;
      }

      const cpePolygon = createSectorCone(
        cpe.location.latitude,
        cpe.location.longitude,
        cpe.azimuth,
        cpe.beamwidth || 30,
        0.002
      );

      const color = cpe.status === 'online' ? '#10b981' : '#ef4444';

      const fillSymbol = new SimpleFillSymbol({
        color: [...hexToRgb(color), 0.5],
        outline: {
          color: color,
          width: 1
        }
      });

      const graphic = new Graphic({
        geometry: cpePolygon,
        symbol: fillSymbol,
        attributes: {
          ...cpe,
          type: 'cpe',
          id: cpe.id
        }
      });

      graphicsLayer.add(graphic);
      const graphicId = `cpe-${cpe.id}`;
      graphicsMap.set(graphicId, graphic);
      rendered++;
    } catch (error) {
      console.error('[CoverageMap] Error rendering CPE:', cpe.id, error);
      skipped++;
    }
  });

  return { rendered, skipped };
}
