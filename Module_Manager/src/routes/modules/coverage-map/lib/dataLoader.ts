/**
 * Data loading utilities for the Coverage Map
 * Handles all data fetching logic to keep the main page component clean
 */

import { coverageMapService } from './coverageMapService.mongodb';
import type { 
  TowerSite, Sector, CPEDevice, NetworkEquipment,
  CoverageMapFilters 
} from './models';

export interface CoverageMapData {
  towers: TowerSite[];
  sectors: Sector[];
  cpeDevices: CPEDevice[];
  equipment: NetworkEquipment[];
}

export interface LoadOptions {
  tenantId: string;
  filters?: CoverageMapFilters;
}

/**
 * Load all coverage map data
 */
export async function loadCoverageMapData(options: LoadOptions): Promise<CoverageMapData> {
  const { tenantId, filters } = options;
  
  try {
    // Load towers (sites)
    const towers = await coverageMapService.getTowerSites(tenantId);
    
    // Load sectors
    const sectors = await coverageMapService.getSectors(tenantId);
    
    // Load CPE devices
    const cpeDevices = await coverageMapService.getCPEDevices(tenantId);
    
    // Load equipment
    const equipment = await coverageMapService.getNetworkEquipment(tenantId);
    
    // Apply filters if provided
    let filteredData = {
      towers,
      sectors,
      cpeDevices,
      equipment
    };
    
    if (filters) {
      filteredData = applyFilters(filteredData, filters);
    }
    
    return filteredData;
  } catch (error) {
    console.error('Error loading coverage map data:', error);
    throw error;
  }
}

/**
 * Apply filters to coverage map data
 */
function applyFilters(
  data: CoverageMapData,
  filters: CoverageMapFilters
): CoverageMapData {
  return {
    towers: data.towers.filter(tower => {
      if (!filters.showTowers) return false;
      if (filters.statusFilter.length > 0 && !filters.statusFilter.includes(tower.status)) return false;
      return true;
    }),
    sectors: data.sectors.filter(sector => {
      if (!filters.showSectors) return false;
      if (filters.bandFilters.length > 0 && !filters.bandFilters.includes(sector.band)) return false;
      return true;
    }),
    cpeDevices: data.cpeDevices.filter(cpe => {
      if (!filters.showCPE) return false;
      if (filters.statusFilter.length > 0 && !filters.statusFilter.includes(cpe.status)) return false;
      return true;
    }),
    equipment: data.equipment.filter(eq => {
      if (!filters.showEquipment) return false;
      return true;
    })
  };
}

/**
 * Delete a tower site
 */
export async function deleteTowerSite(tenantId: string, siteId: string): Promise<void> {
  try {
    await coverageMapService.deleteTowerSite(tenantId, siteId);
  } catch (error) {
    console.error('Error deleting tower site:', error);
    throw error;
  }
}

