/**
 * Plan Service
 * Manages deployment plans and project workflows
 */

import { browser } from '$app/environment';
import { authService } from './authService';
import { inventoryService } from './inventoryService';
import { coverageMapService } from '../../routes/modules/coverage-map/lib/coverageMapService.mongodb';
import type { InventoryItem } from './inventoryService';
import type { TowerSite, Sector, CPEDevice, NetworkEquipment } from '../../routes/modules/coverage-map/lib/models';

// API Configuration
const API_URL = browser 
  ? 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy'
  : '';

export interface PlanProject {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'ready' | 'approved' | 'rejected' | 'deployed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tenantId: string;
  
  // Project Scope
  scope: {
    towers: string[]; // Tower IDs
    sectors: string[]; // Sector IDs
    cpeDevices: string[]; // CPE IDs
    equipment: string[]; // Equipment IDs
    backhauls: string[]; // Backhaul IDs
  };
  
  // Hardware Requirements
  hardwareRequirements: {
    existing: Array<{
      inventoryId: string;
      assetTag: string;
      type: string;
      location: string;
      status: 'available' | 'reserved' | 'deployed';
    }>;
    needed: Array<{
      category: string;
      equipmentType: string;
      manufacturer?: string;
      model?: string;
      quantity: number;
      estimatedCost?: number;
      priority: 'low' | 'medium' | 'high' | 'critical';
      specifications?: {
        power?: string;
        frequency?: string;
        range?: string;
        capacity?: string;
        [key: string]: any;
      };
    }>;
  };
  
  // Plan visibility on map
  showOnMap?: boolean;
  // Approval workflow
  approval?: {
    approvedBy?: string;
    approvedAt?: Date;
    rejectedBy?: string;
    rejectedAt?: Date;
    rejectionReason?: string;
    approvalNotes?: string;
  };
  // Purchase Planning
  purchasePlan: {
    totalEstimatedCost: number;
    missingHardware: Array<{
      id: string;
      category: string;
      equipmentType: string;
      manufacturer?: string;
      model?: string;
      quantity: number;
      estimatedCost: number;
      priority: 'low' | 'medium' | 'high' | 'critical';
      specifications?: any;
      reason: string; // Why this hardware is needed
      alternatives?: Array<{
        manufacturer: string;
        model: string;
        estimatedCost: number;
        availability: 'in-stock' | 'backorder' | 'discontinued';
      }>;
    }>;
    procurementStatus: 'pending' | 'quoted' | 'ordered' | 'received' | 'complete';
    vendorQuotes?: Array<{
      vendor: string;
      quoteDate: Date;
      totalCost: number;
      validUntil: Date;
      items: Array<{
        equipmentType: string;
        quantity: number;
        unitCost: number;
        totalCost: number;
      }>;
    }>;
  };
  
  // Deployment Details
  deployment: {
    estimatedStartDate?: Date;
    estimatedEndDate?: Date;
    actualStartDate?: Date;
    actualEndDate?: Date;
    assignedTo?: string;
    notes?: string;
  };
}

export interface HardwareView {
  id: string;
  type: 'tower' | 'sector' | 'cpe' | 'equipment' | 'backhaul';
  name: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  status: string;
  module: 'acs' | 'hss' | 'pci' | 'inventory' | 'manual';
  lastUpdated: Date;
  isReadOnly: boolean; // True for existing hardware from other modules
  inventoryId?: string; // Link to inventory if available
}

class PlanService {
  private async getAuthToken(): Promise<string> {
    const token = await authService.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    return token;
  }
  
  private async apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getAuthToken();
    const tenantId = localStorage.getItem('selectedTenantId');
    
    if (!tenantId) {
      throw new Error('No tenant selected');
    }
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenantId,
      ...options.headers as Record<string, string>
    };
    
    const response = await fetch(`${API_URL}/api/plans${endpoint}`, {
      ...options,
      headers
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || 'Request failed');
    }
    
    return await response.json();
  }
  
  /**
   * Get all existing hardware from all modules
   */
  async getAllExistingHardware(tenantId: string): Promise<HardwareView[]> {
    const hardware: HardwareView[] = [];
    
    try {
      // Get towers from coverage map
      const towers = await coverageMapService.getTowerSites(tenantId);
      towers.forEach(tower => {
        hardware.push({
          id: tower.id,
          type: 'tower',
          name: tower.name,
          location: {
            latitude: tower.latitude,
            longitude: tower.longitude,
            address: tower.address
          },
          status: tower.status,
          module: 'manual',
          lastUpdated: new Date(tower.updatedAt),
          isReadOnly: true, // Existing hardware is read-only in plan
          inventoryId: tower.inventoryId
        });
      });
      
      // Get sectors from coverage map
      const sectors = await coverageMapService.getSectors(tenantId);
      sectors.forEach(sector => {
        hardware.push({
          id: sector.id,
          type: 'sector',
          name: `${sector.towerName} - Sector ${sector.azimuth}°`,
          location: {
            latitude: sector.latitude,
            longitude: sector.longitude
          },
          status: sector.status,
          module: sector.modules?.pci ? 'pci' : 'manual',
          lastUpdated: new Date(sector.updatedAt),
          isReadOnly: true,
          inventoryId: sector.inventoryId
        });
      });
      
      // Get CPE devices from coverage map
      const cpeDevices = await coverageMapService.getCPEDevices(tenantId);
      cpeDevices.forEach(cpe => {
        hardware.push({
          id: cpe.id,
          type: 'cpe',
          name: `${cpe.manufacturer} ${cpe.model} - ${cpe.serialNumber}`,
          location: {
            latitude: cpe.latitude,
            longitude: cpe.longitude,
            address: cpe.address
          },
          status: cpe.status,
          module: cpe.modules?.acs ? 'acs' : cpe.modules?.hss ? 'hss' : 'manual',
          lastUpdated: new Date(cpe.updatedAt),
          isReadOnly: true,
          inventoryId: cpe.inventoryId
        });
      });
      
      // Get equipment from coverage map
      const equipment = await coverageMapService.getEquipment(tenantId);
      equipment.forEach(item => {
        hardware.push({
          id: item.id,
          type: 'equipment',
          name: `${item.manufacturer} ${item.model} - ${item.serialNumber}`,
          location: {
            latitude: item.latitude,
            longitude: item.longitude,
            address: item.address
          },
          status: item.status,
          module: 'inventory',
          lastUpdated: new Date(item.updatedAt),
          isReadOnly: true,
          inventoryId: item.inventoryId
        });
      });
      
      // Get inventory items
      const inventoryItems = await inventoryService.getInventory(tenantId);
      inventoryItems.forEach(item => {
        // Only include items that aren't already mapped to coverage map
        const alreadyMapped = hardware.some(h => h.inventoryId === item._id);
        if (!alreadyMapped) {
          hardware.push({
            id: item._id || '',
            type: 'equipment',
            name: `${item.manufacturer || 'Unknown'} ${item.model || 'Unknown'} - ${item.serialNumber}`,
            location: {
              latitude: item.currentLocation?.latitude || 0,
              longitude: item.currentLocation?.longitude || 0,
              address: item.currentLocation?.address
            },
            status: item.status,
            module: item.modules?.acs ? 'acs' : item.modules?.hss ? 'hss' : 'inventory',
            lastUpdated: new Date(item.updatedAt),
            isReadOnly: true,
            inventoryId: item._id
          });
        }
      });
      
    } catch (error) {
      console.error('Error loading existing hardware:', error);
    }
    
    return hardware;
  }
  
  /**
   * Create a new plan project
   */
  async createPlan(tenantId: string, planData: Partial<PlanProject>): Promise<PlanProject> {
    const plan = await this.apiCall('', {
      method: 'POST',
      body: JSON.stringify({
        name: planData.name || 'New Plan',
        description: planData.description || '',
        status: 'draft',
        createdBy: planData.createdBy || '',
        showOnMap: false,
        scope: {
          towers: [],
          sectors: [],
          cpeDevices: [],
          equipment: [],
          backhauls: []
        },
        hardwareRequirements: {
          existing: [],
          needed: []
        },
        purchasePlan: {
          totalEstimatedCost: 0,
          missingHardware: [],
          procurementStatus: 'pending'
        },
        deployment: {},
        ...planData
      })
    });
    
    return this.mapBackendPlanToFrontend(plan);
  }
  
  /**
   * Get all plans for a tenant
   */
  async getPlans(tenantId: string, status?: string): Promise<PlanProject[]> {
    const query = status ? `?status=${status}` : '';
    const plans = await this.apiCall(query);
    return Array.isArray(plans) ? plans.map(p => this.mapBackendPlanToFrontend(p)) : [];
  }
  
  /**
   * Get a specific plan
   */
  async getPlan(planId: string): Promise<PlanProject | null> {
    try {
      const plan = await this.apiCall(`/${planId}`);
      return this.mapBackendPlanToFrontend(plan);
    } catch (error: any) {
      if (error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }
  
  /**
   * Update a plan
   */
  async updatePlan(planId: string, updates: Partial<PlanProject>): Promise<PlanProject | null> {
    const plan = await this.apiCall(`/${planId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return this.mapBackendPlanToFrontend(plan);
  }
  
  /**
   * Toggle plan visibility on map
   */
  async togglePlanVisibility(planId: string): Promise<PlanProject> {
    const result = await this.apiCall(`/${planId}/toggle-visibility`, {
      method: 'PUT'
    });
    return this.mapBackendPlanToFrontend(result.plan);
  }
  
  /**
   * Approve plan for deployment
   */
  async approvePlan(planId: string, notes?: string): Promise<PlanProject> {
    const result = await this.apiCall(`/${planId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes })
    });
    return this.mapBackendPlanToFrontend(result.plan);
  }
  
  /**
   * Reject plan with reason
   */
  async rejectPlan(planId: string, reason: string, notes?: string): Promise<PlanProject> {
    const result = await this.apiCall(`/${planId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason, notes })
    });
    return this.mapBackendPlanToFrontend(result.plan);
  }
  
  /**
   * Get all sites/equipment in a plan
   */
  async getPlanSites(planId: string): Promise<{
    plan: { id: string; name: string; status: string; showOnMap: boolean };
    sites: TowerSite[];
    sectors: Sector[];
    cpeDevices: CPEDevice[];
    equipment: NetworkEquipment[];
  }> {
    return await this.apiCall(`/${planId}/sites`);
  }
  
  /**
   * Map backend plan format to frontend format
   */
  private mapBackendPlanToFrontend(plan: any): PlanProject {
    return {
      id: plan._id || plan.id,
      name: plan.name,
      description: plan.description || '',
      status: plan.status,
      createdAt: plan.createdAt ? new Date(plan.createdAt) : new Date(),
      updatedAt: plan.updatedAt ? new Date(plan.updatedAt) : new Date(),
      createdBy: plan.createdBy,
      tenantId: plan.tenantId,
      showOnMap: plan.showOnMap || false,
      scope: plan.scope || {
        towers: [],
        sectors: [],
        cpeDevices: [],
        equipment: [],
        backhauls: []
      },
      hardwareRequirements: plan.hardwareRequirements || {
        existing: [],
        needed: []
      },
      purchasePlan: plan.purchasePlan || {
        totalEstimatedCost: 0,
        missingHardware: [],
        procurementStatus: 'pending'
      },
      approval: plan.approval || {},
      deployment: plan.deployment || {}
    };
  }
  
  /**
   * Add hardware to a plan
   */
  async addHardwareToPlan(planId: string, hardwareId: string, hardwareType: string): Promise<boolean> {
    try {
      const plan = await this.getPlan(planId);
      if (!plan) return false;
      
      const scopeKey = `${hardwareType}s` as keyof typeof plan.scope;
      if (scopeKey in plan.scope && !plan.scope[scopeKey].includes(hardwareId)) {
        plan.scope[scopeKey].push(hardwareId);
        await this.updatePlan(planId, { scope: plan.scope });
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  }
  
  /**
   * Remove hardware from a plan
   */
  async removeHardwareFromPlan(planId: string, hardwareId: string, hardwareType: string): Promise<boolean> {
    try {
      const plan = await this.getPlan(planId);
      if (!plan) return false;
      
      const scopeKey = `${hardwareType}s` as keyof typeof plan.scope;
      if (scopeKey in plan.scope) {
        plan.scope[scopeKey] = plan.scope[scopeKey].filter(id => id !== hardwareId);
        await this.updatePlan(planId, { scope: plan.scope });
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  }
  
  /**
   * Mark plan as ready for deployment
   */
  async markPlanReady(planId: string): Promise<boolean> {
    try {
      await this.updatePlan(planId, { status: 'ready' });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get plans ready for deployment
   */
  async getReadyPlans(tenantId: string): Promise<PlanProject[]> {
    return await this.getPlans(tenantId, 'ready');
  }
  
  /**
   * Delete a plan
   */
  async deletePlan(planId: string): Promise<boolean> {
    try {
      await this.apiCall(`/${planId}`, { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Analyze project requirements and identify missing hardware
   */
  async analyzeMissingHardware(planId: string): Promise<PlanProject | null> {
    try {
      const plan = await this.apiCall(`/${planId}/analyze`, {
        method: 'POST'
      });
      return this.mapBackendPlanToFrontend(plan);
    } catch (error) {
      console.error('Error analyzing missing hardware:', error);
      return null;
    }
  }
  
  /**
   * Add hardware requirement to a plan
   */
  async addHardwareRequirement(
    planId: string, 
    requirement: {
      category: string;
      equipmentType: string;
      manufacturer?: string;
      model?: string;
      quantity: number;
      priority: 'low' | 'medium' | 'high' | 'critical';
      specifications?: any;
    }
  ): Promise<boolean> {
    try {
      await this.apiCall(`/${planId}/requirements`, {
        method: 'POST',
        body: JSON.stringify(requirement)
      });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Remove hardware requirement from a plan
   */
  async removeHardwareRequirement(planId: string, requirementIndex: number): Promise<boolean> {
    try {
      await this.apiCall(`/${planId}/requirements/${requirementIndex}`, {
        method: 'DELETE'
      });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Generate purchase order from missing hardware
   */
  async generatePurchaseOrder(planId: string): Promise<{
    purchaseOrderId: string;
    items: Array<{
      equipmentType: string;
      quantity: number;
      estimatedCost: number;
      priority: string;
    }>;
    totalCost: number;
    generatedAt: Date;
  } | null> {
    try {
      const purchaseOrder = await this.apiCall(`/${planId}/purchase-order`, {
        method: 'POST'
      });
      
      return {
        purchaseOrderId: purchaseOrder.purchaseOrderId,
        items: purchaseOrder.items,
        totalCost: purchaseOrder.totalCost,
        generatedAt: new Date(purchaseOrder.generatedAt)
      };
    } catch {
      return null;
    }
  }
  
  /**
   * Estimate hardware cost based on equipment type
   */
  private estimateHardwareCost(requirement: any): number {
    const costEstimates: { [key: string]: number } = {
      'tower': 50000,
      'sector-antenna': 2000,
      'cpe-device': 500,
      'router': 300,
      'switch': 200,
      'power-supply': 150,
      'cable': 5,
      'connector': 10,
      'mounting-hardware': 100,
      'backhaul-radio': 3000,
      'fiber-optic': 2,
      'ups': 800,
      'generator': 5000
    };
    
    return costEstimates[requirement.equipmentType] || 1000;
  }
  
  /**
   * Generate reason for missing hardware
   */
  private generateMissingHardwareReason(requirement: any, missingQuantity: number, availableQuantity: number): string {
    if (availableQuantity === 0) {
      return `No ${requirement.equipmentType} equipment available in inventory`;
    } else {
      return `Only ${availableQuantity} ${requirement.equipmentType} available, need ${missingQuantity} more`;
    }
  }
  
  /**
   * Generate alternative equipment options
   */
  private generateAlternatives(requirement: any): Array<{
    manufacturer: string;
    model: string;
    estimatedCost: number;
    availability: 'in-stock' | 'backorder' | 'discontinued';
  }> {
    const alternatives: Array<{
      manufacturer: string;
      model: string;
      estimatedCost: number;
      availability: 'in-stock' | 'backorder' | 'discontinued';
    }> = [];
    
    // Add some generic alternatives based on equipment type
    switch (requirement.equipmentType) {
      case 'cpe-device':
        alternatives.push(
          { manufacturer: 'Ubiquiti', model: 'NanoStation M5', estimatedCost: 450, availability: 'in-stock' },
          { manufacturer: 'MikroTik', model: 'SXT Lite5', estimatedCost: 380, availability: 'in-stock' },
          { manufacturer: 'Cambium', model: 'ePMP 1000', estimatedCost: 520, availability: 'backorder' }
        );
        break;
      case 'sector-antenna':
        alternatives.push(
          { manufacturer: 'RFS', model: 'Sector Antenna 120°', estimatedCost: 1800, availability: 'in-stock' },
          { manufacturer: 'CommScope', model: 'Sector Antenna 90°', estimatedCost: 2200, availability: 'in-stock' }
        );
        break;
      case 'router':
        alternatives.push(
          { manufacturer: 'Cisco', model: 'ISR 4331', estimatedCost: 2500, availability: 'in-stock' },
          { manufacturer: 'Juniper', model: 'MX104', estimatedCost: 3000, availability: 'backorder' }
        );
        break;
    }
    
    return alternatives;
  }
}

export const planService = new PlanService();
