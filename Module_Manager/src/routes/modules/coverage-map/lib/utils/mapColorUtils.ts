/**
 * Color utility functions for map graphics
 */

export function getTowerColor(type: string, status?: string): string {
  // If status is provided, use status-based colors (for monitoring)
  if (status) {
    const statusColors: Record<string, string> = {
      active: '#10b981',      // Green - healthy/online
      inactive: '#ef4444',    // Red - down/offline
      maintenance: '#f59e0b', // Yellow - degraded/warning
      planned: '#6b7280',     // Gray - planned sites
      online: '#10b981',      // Green - device is online
      offline: '#ef4444',     // Red - device is offline
      unknown: '#6b7280'      // Gray - unknown/unmonitored status (initial state)
    };
    if (statusColors[status]) {
      return statusColors[status];
    }
  }
  
  // Fallback to type-based colors
  const colors: Record<string, string> = {
    tower: '#3b82f6',
    rooftop: '#8b5cf6',
    monopole: '#06b6d4',
    warehouse: '#f59e0b',
    noc: '#ef4444',
    'internet-access': '#06b6d4',
    internet: '#06b6d4',
    vehicle: '#10b981',
    rma: '#f97316',
    vendor: '#6366f1',
    other: '#6b7280'
  };
  return colors[type] || colors.other;
}

export function getBandColor(band: string): string {
  const colors: Record<string, string> = {
    LTE: '#ef4444',
    CBRS: '#3b82f6',
    FWA: '#10b981',
    '5G': '#8b5cf6',
    WiFi: '#f59e0b'
  };
  return colors[band] || '#6b7280';
}

export function getEquipmentColor(status: string): string {
  const colors: Record<string, string> = {
    // Deployment statuses
    deployed: '#10b981',
    inventory: '#3b82f6',
    rma: '#f59e0b',
    retired: '#6b7280',
    lost: '#ef4444',
    // Monitoring statuses (for devices in monitor module)
    online: '#10b981',      // Green - device is online
    offline: '#ef4444',     // Red - device is offline
    unknown: '#6b7280',     // Gray - unknown/unmonitored status (initial state for devices from deploy)
    active: '#10b981',      // Green - active/healthy
    inactive: '#ef4444'     // Red - inactive/down
  };
  return colors[status] || colors.deployed;
}

export function getBackhaulColor(type: string): string {
  const colors: Record<string, string> = {
    fiber: '#3b82f6',
    'fixed-wireless-licensed': '#10b981',
    'fixed-wireless-unlicensed': '#f97316'
  };

  return colors[type] || '#6366f1';
}

export function getPlanDraftColor(type: string): string {
  const colors: Record<string, string> = {
    plan: '#6366f1',
    site: '#38bdf8',
    tower: '#3b82f6',
    sector: '#8b5cf6',
    cpe: '#10b981',
    backhaul: '#f97316',
    warehouse: '#f59e0b',
    noc: '#ef4444',
    equipment: '#0ea5e9'
  };
  return colors[type] || '#6366f1';
}

export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ]
    : [0, 0, 0];
}
