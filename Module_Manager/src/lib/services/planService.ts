/**
 * Plan Service
 * Manages deployment plans and project workflows
 */

import { inventoryService } from './inventoryService';
import { coverageMapService } from '../routes/modules/coverage-map/lib/coverageMapService.mongodb';
import type { InventoryItem } from './inventoryService';
import type { TowerSite, Sector, CPEDevice, NetworkEquipment } from '../routes/modules/coverage-map/lib/models';

export interface PlanProject {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'ready' | 'deployed' | 'cancelled';
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
  private plans: Map<string, PlanProject> = new Map();
  
  /**
   * Get all existing hardware from all modules
   */
  async getAllExistingHardware(tenantId: string): Promise<HardwareView[]> {
    const hardware: HardwareView[] = [];
    
    try {
      // Get towers from coverage map
      const towers = await coverageMapService.getTowers(tenantId);
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
    const plan: PlanProject = {
      id: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: planData.name || 'New Plan',
      description: planData.description || '',
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: planData.createdBy || '',
      tenantId,
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
      deployment: {},
      ...planData
    };
    
    this.plans.set(plan.id, plan);
    return plan;
  }
  
  /**
   * Get all plans for a tenant
   */
  async getPlans(tenantId: string): Promise<PlanProject[]> {
    return Array.from(this.plans.values()).filter(plan => plan.tenantId === tenantId);
  }
  
  /**
   * Get a specific plan
   */
  async getPlan(planId: string): Promise<PlanProject | null> {
    return this.plans.get(planId) || null;
  }
  
  /**
   * Update a plan
   */
  async updatePlan(planId: string, updates: Partial<PlanProject>): Promise<PlanProject | null> {
    const plan = this.plans.get(planId);
    if (!plan) return null;
    
    const updatedPlan = {
      ...plan,
      ...updates,
      updatedAt: new Date()
    };
    
    this.plans.set(planId, updatedPlan);
    return updatedPlan;
  }
  
  /**
   * Add hardware to a plan
   */
  async addHardwareToPlan(planId: string, hardwareId: string, hardwareType: string): Promise<boolean> {
    const plan = this.plans.get(planId);
    if (!plan) return false;
    
    const scopeKey = `${hardwareType}s` as keyof typeof plan.scope;
    if (scopeKey in plan.scope && !plan.scope[scopeKey].includes(hardwareId)) {
      plan.scope[scopeKey].push(hardwareId);
      plan.updatedAt = new Date();
      this.plans.set(planId, plan);
      return true;
    }
    
    return false;
  }
  
  /**
   * Remove hardware from a plan
   */
  async removeHardwareFromPlan(planId: string, hardwareId: string, hardwareType: string): Promise<boolean> {
    const plan = this.plans.get(planId);
    if (!plan) return false;
    
    const scopeKey = `${hardwareType}s` as keyof typeof plan.scope;
    if (scopeKey in plan.scope) {
      plan.scope[scopeKey] = plan.scope[scopeKey].filter(id => id !== hardwareId);
      plan.updatedAt = new Date();
      this.plans.set(planId, plan);
      return true;
    }
    
    return false;
  }
  
  /**
   * Mark plan as ready for deployment
   */
  async markPlanReady(planId: string): Promise<boolean> {
    const plan = this.plans.get(planId);
    if (!plan) return false;
    
    plan.status = 'ready';
    plan.updatedAt = new Date();
    this.plans.set(planId, plan);
    return true;
  }
  
  /**
   * Get plans ready for deployment
   */
  async getReadyPlans(tenantId: string): Promise<PlanProject[]> {
    return Array.from(this.plans.values()).filter(
      plan => plan.tenantId === tenantId && plan.status === 'ready'
    );
  }
  
  /**
   * Delete a plan
   */
  async deletePlan(planId: string): Promise<boolean> {
    return this.plans.delete(planId);
  }
}

export const planService = new PlanService();
