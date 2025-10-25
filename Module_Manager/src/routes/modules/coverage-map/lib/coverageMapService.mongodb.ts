// Coverage Map Service - MongoDB Backend Version
import type { TowerSite, Sector, CPEDevice, NetworkEquipment } from './models';

// Backend API URL - wisptools.io with SSL certificate
const API_URL = import.meta.env.VITE_BACKEND_API_URL || 'https://wisptools.io';

export class CoverageMapService {
  
  // Helper to get auth token
  private async getAuthToken(): Promise<string> {
    const { auth } = await import('$lib/firebase');
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }
    return await currentUser.getIdToken();
  }
  
  // Helper for API calls
  private async apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getAuthToken();
    const tenantId = localStorage.getItem('selectedTenantId');
    
    if (!tenantId) {
      throw new Error('No tenant selected');
    }
    
    const response = await fetch(`${API_URL}/api/network/${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return await response.json();
  }
  
  // ========== Unified Sites ==========
  
  async createTowerSite(tenantId: string, site: Omit<TowerSite, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<TowerSite> {
    return await this.apiCall('sites', {
      method: 'POST',
      body: JSON.stringify(site)
    });
  }
  
  async getTowerSites(tenantId: string): Promise<TowerSite[]> {
    const sites = await this.apiCall('sites');
    return sites.map((s: any) => ({ ...s, id: s._id }));
  }
  
  async getTowerSite(tenantId: string, siteId: string): Promise<TowerSite | null> {
    try {
      const site = await this.apiCall(`sites/${siteId}`);
      return { ...site, id: site._id };
    } catch {
      return null;
    }
  }
  
  async updateTowerSite(tenantId: string, siteId: string, updates: Partial<TowerSite>): Promise<void> {
    await this.apiCall(`sites/${siteId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }
  
  async deleteTowerSite(tenantId: string, siteId: string): Promise<void> {
    await this.apiCall(`sites/${siteId}`, {
      method: 'DELETE'
    });
  }
  
  // ========== Sectors ==========
  
  async createSector(tenantId: string, sector: Omit<Sector, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Sector> {
    return await this.apiCall('sectors', {
      method: 'POST',
      body: JSON.stringify(sector)
    });
  }
  
  async getSectors(tenantId: string): Promise<Sector[]> {
    const sectors = await this.apiCall('sectors');
    return sectors.map((s: any) => ({ ...s, id: s._id }));
  }
  
  async getSectorsBySite(tenantId: string, siteId: string): Promise<Sector[]> {
    const sectors = await this.apiCall(`tower-sites/${siteId}/sectors`);
    return sectors.map((s: any) => ({ ...s, id: s._id }));
  }
  
  async getSectorsByBand(tenantId: string, band: string): Promise<Sector[]> {
    const sectors = await this.apiCall(`sectors?band=${encodeURIComponent(band)}`);
    return sectors.map((s: any) => ({ ...s, id: s._id }));
  }
  
  async updateSector(tenantId: string, sectorId: string, updates: Partial<Sector>): Promise<void> {
    await this.apiCall(`sectors/${sectorId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }
  
  async deleteSector(tenantId: string, sectorId: string): Promise<void> {
    await this.apiCall(`sectors/${sectorId}`, {
      method: 'DELETE'
    });
  }
  
  // ========== Unified CPE ==========
  
  async createCPE(tenantId: string, cpe: Omit<CPEDevice, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<CPEDevice> {
    return await this.apiCall('cpe', {
      method: 'POST',
      body: JSON.stringify(cpe)
    });
  }
  
  async getCPEDevices(tenantId: string): Promise<CPEDevice[]> {
    const devices = await this.apiCall('cpe');
    return devices.map((d: any) => ({ ...d, id: d._id }));
  }
  
  async updateCPE(tenantId: string, cpeId: string, updates: Partial<CPEDevice>): Promise<void> {
    await this.apiCall(`cpe/${cpeId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }
  
  async deleteCPE(tenantId: string, cpeId: string): Promise<void> {
    await this.apiCall(`cpe/${cpeId}`, {
      method: 'DELETE'
    });
  }
  
  // ========== Network Equipment ==========
  
  async createEquipment(tenantId: string, equipment: Omit<NetworkEquipment, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<NetworkEquipment> {
    return await this.apiCall('equipment', {
      method: 'POST',
      body: JSON.stringify(equipment)
    });
  }
  
  async getEquipment(tenantId: string): Promise<NetworkEquipment[]> {
    const equipment = await this.apiCall('equipment');
    return equipment.map((e: any) => ({ ...e, id: e._id }));
  }
  
  async getEquipmentByLocation(tenantId: string, locationType: string): Promise<NetworkEquipment[]> {
    const equipment = await this.apiCall(`equipment?locationType=${encodeURIComponent(locationType)}`);
    return equipment.map((e: any) => ({ ...e, id: e._id }));
  }
  
  async updateEquipment(tenantId: string, equipmentId: string, updates: Partial<NetworkEquipment>): Promise<void> {
    await this.apiCall(`equipment/${equipmentId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }
  
  async deleteEquipment(tenantId: string, equipmentId: string): Promise<void> {
    await this.apiCall(`equipment/${equipmentId}`, {
      method: 'DELETE'
    });
  }
  
  // ========== Geocoding ==========
  
  async geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
    try {
      return await this.apiCall('geocode', {
        method: 'POST',
        body: JSON.stringify({ address })
      });
    } catch (error) {
      console.error('Geocoding failed:', error);
      return null;
    }
  }
  
  async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    try {
      const result = await this.apiCall('reverse-geocode', {
        method: 'POST',
        body: JSON.stringify({ latitude, longitude })
      });
      return result.address;
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      return null;
    }
  }
  
  // ========== Data Import from Other Modules ==========
  
  /**
   * Import CBRS devices and convert to sectors
   */
  async importFromCBRS(tenantId: string): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;
    
    try {
      // TODO: Call backend endpoint to import from CBRS collection
      console.log('CBRS import - backend endpoint to be implemented');
    } catch (error: any) {
      errors.push(`CBRS import failed: ${error.message}`);
    }
    
    return { imported, errors };
  }
  
  /**
   * Import ACS CPE devices
   */
  async importFromACS(tenantId: string): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;
    
    try {
      // TODO: Call backend endpoint to import from GenieACS data
      console.log('ACS import - backend endpoint to be implemented');
    } catch (error: any) {
      errors.push(`ACS import failed: ${error.message}`);
    }
    
    return { imported, errors };
  }
}

export const coverageMapService = new CoverageMapService();

