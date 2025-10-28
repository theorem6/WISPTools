/**
 * Map event handling utilities
 * Centralizes all map interaction logic
 */

import type { TowerSite } from './models';

export interface MapClickEvent {
  type: 'tower' | 'sector' | 'cpe' | 'cpe-device' | 'equipment' | 'backhaul';
  id: string;
  data: any;
  screenX: number;
  screenY: number;
  isRightClick: boolean;
}

export interface ContextMenuEvent {
  lat: number;
  lon: number;
  screenX: number;
  screenY: number;
}

/**
 * Handle asset click events from the map
 */
export function handleAssetClick(
  event: CustomEvent<MapClickEvent>,
  callbacks: {
    onShowTowerMenu: (tower: TowerSite, x: number, y: number) => void;
    onShowSuccessMessage: (message: string, duration?: number) => void;
  }
): void {
  const { type, id, data, screenX, screenY, isRightClick } = event.detail;
  
  console.log(`Clicked ${type}:`, id, data);
  
  // Check if this is a read-only item from ACS or CBRS
  if (data.modules?.acs || data.modules?.cbrs) {
    callbacks.onShowSuccessMessage(
      `This ${type} is managed by the ${data.modules.acs ? 'ACS' : 'CBRS'} module (read-only)`,
      5000
    );
    return;
  }
  
  // Only show menu for right-clicks
  if (isRightClick) {
    // Handle all asset types - show actions menu
    if (type === 'tower' || type === 'noc' || type === 'warehouse') {
      const tower: TowerSite = {
        id,
        name: data.name || 'Unknown',
        type: data.type || 'tower',
        location: {
          latitude: data.latitude || 0,
          longitude: data.longitude || 0,
          address: data.address || ''
        },
        status: data.status || 'active',
        tenantId: data.tenantId || ''
      };
      
      callbacks.onShowTowerMenu(tower, screenX, screenY);
    } else if (type === 'sector') {
      callbacks.onShowSuccessMessage(`Sector: ${data.name || 'Unknown'} - Right-click for options`, 3000);
    } else if (type === 'cpe' || type === 'cpe-device') {
      callbacks.onShowSuccessMessage(`CPE: ${data.name || 'Unknown'} - Right-click for options`, 3000);
    } else if (type === 'equipment') {
      callbacks.onShowSuccessMessage(`Equipment: ${data.name || 'Unknown'} - Right-click for options`, 3000);
    } else if (type === 'backhaul') {
      callbacks.onShowSuccessMessage(`Backhaul: ${data.name || 'Unknown'} - Right-click for options`, 3000);
    }
  }
}

/**
 * Handle context menu events (right-click on empty map)
 */
export function handleContextMenu(
  event: CustomEvent<ContextMenuEvent>,
  callbacks: {
    onShowContextMenu: (lat: number, lon: number, x: number, y: number) => void;
    onShowCreateSiteModal: (type: 'tower' | 'noc' | 'warehouse' | 'other') => void;
  }
): void {
  const { lat, lon, screenX, screenY } = event.detail;
  
  // This should trigger the context menu, but for now just show success message
  callbacks.onShowContextMenu(lat, lon, screenX, screenY);
}

