// Coverage Map Service - MongoDB Backend Version
import type { TowerSite, Sector, CPEDevice, NetworkEquipment } from './models';
import { getApiUrl } from '$lib/config/api';

// API Configuration - Use centralized config
const API_URL = getApiUrl('NETWORK');

export class CoverageMapService {
  
  // Helper to get auth token
  private async getAuthToken(): Promise<string> {
    // Try using authService first (more reliable in iframe context)
    try {
      const { authService } = await import('$lib/services/authService');
      // Wait for auth to be ready (iframe might still be initializing)
      let attempts = 0;
      while (attempts < 5) {
        const token = await authService.getAuthToken();
        if (token) {
          return token;
        }
        // Wait 200ms between attempts
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }
    } catch (err) {
      console.warn('[CoverageMapService] authService.getAuthToken failed after retries, trying direct Firebase auth:', err);
    }
    
    // Fallback to direct Firebase auth
    const { auth } = await import('$lib/firebase');
    let attempts = 0;
    while (attempts < 5) {
      const currentUser = auth().currentUser;
      if (currentUser) {
        try {
          return await currentUser.getIdToken();
        } catch (err) {
          console.warn('[CoverageMapService] getIdToken failed, retrying...', err);
        }
      }
      // Wait 200ms between attempts
      await new Promise(resolve => setTimeout(resolve, 200));
      attempts++;
    }
    
    throw new Error('Not authenticated - no user found after retries');
  }
  
  // Helper for API calls
  private async apiCall(endpoint: string, options: RequestInit = {}, tenantId?: string): Promise<any> {
    const token = await this.getAuthToken();
    
    // Use provided tenantId or fall back to localStorage
    const resolvedTenantId = tenantId || (typeof window !== 'undefined' ? localStorage.getItem('selectedTenantId') : null);
    
    if (!resolvedTenantId) {
      throw new Error('No tenant selected');
    }
    
    // Use relative URL (goes through Firebase Hosting rewrite to apiProxy)
    // Use centralized API configuration
    const apiPath = API_URL;
    const url = `${apiPath}/${endpoint}`;
    
    // Log API call details for hardware-deployments
    if (endpoint.includes('hardware-deployments')) {
      console.log('[CoverageMapService] API call:', {
        endpoint,
        url,
        tenantId: resolvedTenantId,
        method: options.method || 'GET',
        hasToken: !!token
      });
    }
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': resolvedTenantId,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      const errorMessage = errorData.details || errorData.error || `HTTP ${response.status}`;
      const error = new Error(errorMessage);
      // Attach additional error details for debugging
      (error as any).details = errorData.details;
      (error as any).validationErrors = errorData.validationErrors;
      
      // Log error for hardware-deployments
      if (endpoint.includes('hardware-deployments')) {
        console.error('[CoverageMapService] API error:', {
          endpoint,
          status: response.status,
          statusText: response.statusText,
          errorData,
          tenantId: resolvedTenantId
        });
      }
      
      throw error;
    }
    
    const result = await response.json();
    
    // Log result for hardware-deployments
    if (endpoint.includes('hardware-deployments')) {
      console.log('[CoverageMapService] API response:', {
        endpoint,
        status: response.status,
        resultType: typeof result,
        isArray: Array.isArray(result),
        count: Array.isArray(result) ? result.length : 'N/A',
        sample: Array.isArray(result) && result.length > 0 ? {
          id: result[0]._id,
          name: result[0].name,
          tenantId: result[0].tenantId,
          status: result[0].status
        } : result
      });
    }
    
    return result;
  }
  
  // ========== Unified Sites ==========
  
  async createTowerSite(tenantId: string, site: Omit<TowerSite, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<TowerSite> {
    return await this.apiCall('sites', {
      method: 'POST',
      body: JSON.stringify(site)
    }, tenantId);
  }
  
  async getTowerSites(
    tenantId: string,
    options: { includePlanLayer?: boolean; planIds?: string[] } = {}
  ): Promise<TowerSite[]> {
    const params = new URLSearchParams();
    if (options.includePlanLayer) {
      params.set('includePlanLayer', 'true');
      if (options.planIds && options.planIds.length > 0) {
        params.set('planIds', options.planIds.join(','));
      }
    }
    const endpoint = params.toString() ? `sites?${params.toString()}` : 'sites';
    const sites = await this.apiCall(endpoint, {}, tenantId);
    // Normalize type field: ensure it's always an array (backward compatibility)
    return sites.map((s: any) => {
      const normalizedSite = { ...s, id: s._id };
      if (normalizedSite.type && !Array.isArray(normalizedSite.type)) {
        normalizedSite.type = [normalizedSite.type];
      } else if (!normalizedSite.type || normalizedSite.type.length === 0) {
        normalizedSite.type = ['tower'];
      }
      return normalizedSite;
    });
  }
  
  async getTowerSite(tenantId: string, siteId: string): Promise<TowerSite | null> {
    try {
      const site = await this.apiCall(`sites/${siteId}`, {}, tenantId);
      const normalizedSite = { ...site, id: site._id };
      // Normalize type field: ensure it's always an array (backward compatibility)
      if (normalizedSite.type && !Array.isArray(normalizedSite.type)) {
        normalizedSite.type = [normalizedSite.type];
      } else if (!normalizedSite.type || normalizedSite.type.length === 0) {
        normalizedSite.type = ['tower'];
      }
      return normalizedSite;
    } catch {
      return null;
    }
  }
  
  async updateTowerSite(tenantId: string, siteId: string, updates: Partial<TowerSite>): Promise<void> {
    await this.apiCall(`sites/${siteId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    }, tenantId);
  }
  
  async deleteTowerSite(tenantId: string, siteId: string): Promise<void> {
    await this.apiCall(`sites/${siteId}`, {
      method: 'DELETE'
    }, tenantId);
  }
  
  // ========== Sectors ==========
  
  async createSector(tenantId: string, sector: Omit<Sector, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Sector> {
    return await this.apiCall('sectors', {
      method: 'POST',
      body: JSON.stringify(sector)
    }, tenantId);
  }
  
  async getSectors(
    tenantId: string,
    options: { includePlanLayer?: boolean; planIds?: string[] } = {}
  ): Promise<Sector[]> {
    const params = new URLSearchParams();
    if (options.includePlanLayer) {
      params.set('includePlanLayer', 'true');
      if (options.planIds && options.planIds.length > 0) {
        params.set('planIds', options.planIds.join(','));
      }
    }
    const endpoint = params.toString() ? `sectors?${params.toString()}` : 'sectors';
    const sectors = await this.apiCall(endpoint, {}, tenantId);
    return sectors.map((s: any) => ({ ...s, id: s._id }));
  }
  
  async getSectorsBySite(tenantId: string, siteId: string): Promise<Sector[]> {
    const sectors = await this.apiCall(`sites/${siteId}/sectors`, {}, tenantId);
    return sectors.map((s: any) => ({ ...s, id: s._id }));
  }
  
  async getSectorsByBand(tenantId: string, band: string): Promise<Sector[]> {
    const sectors = await this.apiCall(`sectors?band=${encodeURIComponent(band)}`, {}, tenantId);
    return sectors.map((s: any) => ({ ...s, id: s._id }));
  }
  
  async updateSector(tenantId: string, sectorId: string, updates: Partial<Sector>): Promise<void> {
    await this.apiCall(`sectors/${sectorId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    }, tenantId);
  }
  
  async deleteSector(tenantId: string, sectorId: string): Promise<void> {
    await this.apiCall(`sectors/${sectorId}`, {
      method: 'DELETE'
    }, tenantId);
  }
  
  // ========== Unified CPE ==========
  
  async createCPE(tenantId: string, cpe: Omit<CPEDevice, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<CPEDevice> {
    return await this.apiCall('cpe', {
      method: 'POST',
      body: JSON.stringify(cpe)
    }, tenantId);
  }
  
  async getCPEDevices(
    tenantId: string,
    options: { includePlanLayer?: boolean; planIds?: string[] } = {}
  ): Promise<CPEDevice[]> {
    const params = new URLSearchParams();
    if (options.includePlanLayer) {
      params.set('includePlanLayer', 'true');
      if (options.planIds && options.planIds.length > 0) {
        params.set('planIds', options.planIds.join(','));
      }
    }
    const endpoint = params.toString() ? `cpe?${params.toString()}` : 'cpe';
    const devices = await this.apiCall(endpoint, {}, tenantId);
    return devices.map((d: any) => ({ ...d, id: d._id }));
  }
  
  async updateCPE(tenantId: string, cpeId: string, updates: Partial<CPEDevice>): Promise<void> {
    await this.apiCall(`cpe/${cpeId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    }, tenantId);
  }
  
  async deleteCPE(tenantId: string, cpeId: string): Promise<void> {
    await this.apiCall(`cpe/${cpeId}`, {
      method: 'DELETE'
    }, tenantId);
  }
  
  // ========== Network Equipment ==========
  
  async createEquipment(tenantId: string, equipment: Omit<NetworkEquipment, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<NetworkEquipment> {
    return await this.apiCall('equipment', {
      method: 'POST',
      body: JSON.stringify(equipment)
    }, tenantId);
  }
  
  async getEquipment(
    tenantId: string,
    options: { includePlanLayer?: boolean; planIds?: string[] } = {}
  ): Promise<NetworkEquipment[]> {
    const params = new URLSearchParams();
    if (options.includePlanLayer) {
      params.set('includePlanLayer', 'true');
      if (options.planIds && options.planIds.length > 0) {
        params.set('planIds', options.planIds.join(','));
      }
    }
    const endpoint = params.toString() ? `equipment?${params.toString()}` : 'equipment';
    const equipment = await this.apiCall(endpoint, {}, tenantId);
    return equipment.map((e: any) => ({ ...e, id: e._id }));
  }
  
  async getEquipmentByLocation(tenantId: string, locationType: string): Promise<NetworkEquipment[]> {
    const equipment = await this.apiCall(`equipment?locationType=${encodeURIComponent(locationType)}`, {}, tenantId);
    return equipment.map((e: any) => ({ ...e, id: e._id }));
  }
  
  async updateEquipment(tenantId: string, equipmentId: string, updates: Partial<NetworkEquipment>): Promise<void> {
    await this.apiCall(`equipment/${equipmentId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    }, tenantId);
  }
  
  async deleteEquipment(tenantId: string, equipmentId: string): Promise<void> {
    await this.apiCall(`equipment/${equipmentId}`, {
      method: 'DELETE'
    }, tenantId);
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
      // Call backend endpoint to import from CBRS collection
      const result = await this.apiCall('import/cbrs', {
        method: 'POST',
        body: JSON.stringify({ tenantId })
      });
      
      imported = result.imported || 0;
      if (result.errors) {
        errors.push(...result.errors);
      }
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
      // Call backend endpoint to import from GenieACS data
      const result = await this.apiCall('import/acs', {
        method: 'POST',
        body: JSON.stringify({ tenantId })
      });
      
      imported = result.imported || 0;
      if (result.errors) {
        errors.push(...result.errors);
      }
    } catch (error: any) {
      errors.push(`ACS import failed: ${error.message}`);
    }
    
    return { imported, errors };
  }
  
  // ========== Hardware Deployments ==========
  
  async getSiteHardware(tenantId: string, siteId: string): Promise<any[]> {
    return await this.apiCall(`sites/${siteId}/hardware`);
  }
  
  async deployHardware(tenantId: string, siteId: string, hardware: {
    hardware_type: string;
    name: string;
    config?: any;
    epc_config?: any;
    inventory_item_id?: string;
  }): Promise<any> {
    return await this.apiCall(`sites/${siteId}/hardware`, {
      method: 'POST',
      body: JSON.stringify(hardware)
    });
  }
  
  async getAllHardwareDeployments(tenantId: string, hardware_type?: string): Promise<any[]> {
    // Validate tenantId before making the call
    let resolvedTenantId = tenantId;
    if (!resolvedTenantId || typeof resolvedTenantId !== 'string' || resolvedTenantId.trim() === '') {
      // Try localStorage as fallback
      if (typeof window !== 'undefined') {
        resolvedTenantId = localStorage.getItem('selectedTenantId') || '';
      }
      if (!resolvedTenantId || typeof resolvedTenantId !== 'string' || resolvedTenantId.trim() === '') {
        console.warn('[CoverageMapService] getAllHardwareDeployments called without valid tenantId:', { 
          provided: tenantId, 
          fromLocalStorage: typeof window !== 'undefined' ? localStorage.getItem('selectedTenantId') : 'N/A' 
        });
        throw new Error('No tenant selected');
      }
    }
    const params = hardware_type ? `?hardware_type=${hardware_type}` : '';
    console.log('[CoverageMapService] getAllHardwareDeployments called:', {
      tenantId: resolvedTenantId,
      hardware_type,
      params,
      endpoint: `hardware-deployments${params}`
    });
    try {
      const result = await this.apiCall(`hardware-deployments${params}`, {}, resolvedTenantId);
      console.log('[CoverageMapService] getAllHardwareDeployments result:', {
        count: Array.isArray(result) ? result.length : 'not an array',
        isArray: Array.isArray(result),
        resultType: typeof result,
        sample: Array.isArray(result) && result.length > 0 ? result[0] : result
      });
      return result;
    } catch (error: any) {
      console.error('[CoverageMapService] getAllHardwareDeployments error:', {
        message: error.message,
        tenantId: resolvedTenantId,
        error
      });
      throw error;
    }
  }
  
  async updateHardwareDeployment(tenantId: string, deploymentId: string, updates: any): Promise<any> {
    return await this.apiCall(`hardware-deployments/${deploymentId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    }, tenantId);
  }
  
  async removeHardwareDeployment(tenantId: string, deploymentId: string): Promise<void> {
    await this.apiCall(`hardware-deployments/${deploymentId}`, {
      method: 'DELETE'
    }, tenantId);
  }
}

export const coverageMapService = new CoverageMapService();

