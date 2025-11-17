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

import { getApiUrl } from '$lib/config/api';

// API Configuration - Use centralized config
const API_URL = getApiUrl('PLANS');

export interface PlanProjectLocation {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface PlanMarketingAddress {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  source?: string;
  discoveredAt?: string;
}

export interface PlanProjectMarketing {
  targetRadiusMiles?: number;
  lastRunAt?: Date;
  lastResultCount?: number;
  lastBoundingBox?: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  lastCenter?: {
    lat: number;
    lon: number;
  };
  addresses?: PlanMarketingAddress[];
  algorithms?: string[];
  algorithmStats?: Record<string, { produced?: number; geocoded?: number }>;
  totalUniqueAddresses?: number;
  totalRuns?: number;
  lastRunNewAddresses?: number;
  runHistory?: Array<{
    runAt: string;
    boundingBox?: {
      west: number;
      south: number;
      east: number;
      north: number;
    };
    center?: {
      lat: number;
      lon: number;
    };
    newAddresses?: number;
    totalAddresses?: number;
    algorithms?: string[];
  }>;
}

export interface PlanProject {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'ready' | 'approved' | 'authorized' | 'rejected' | 'deployed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tenantId: string;
  location?: PlanProjectLocation | null;
  marketing?: PlanProjectMarketing | null;
  
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
  authorization?: {
    authorizedBy?: string;
    authorizedAt?: Date;
    notes?: string;
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
    assignedTo?: string; // User ID or email
    assignedToName?: string; // Display name
    assignedTeam?: string[]; // Array of user IDs/emails for team assignments
    deploymentStage?: 'planning' | 'procurement' | 'preparation' | 'in_progress' | 'testing' | 'completed' | 'on_hold' | 'cancelled';
    fieldTechs?: Array<{
      userId: string;
      email: string;
      name: string;
      assignedAt?: Date;
      status?: 'assigned' | 'in_progress' | 'completed' | 'blocked';
      tasks?: Array<{
        taskId: string;
        description: string;
        status?: 'pending' | 'in_progress' | 'completed' | 'blocked';
        completedAt?: Date;
        notes?: string;
      }>;
    }>;
    hardwareDeployment?: Array<{
      inventoryId: string;
      assetTag: string;
      equipmentType: string;
      location: {
        siteId: string;
        siteName: string;
        coordinates: {
          lat: number;
          lng: number;
        };
      };
      deployedBy?: string; // User ID
      deployedAt?: Date;
      status?: 'pending' | 'in_transit' | 'on_site' | 'installed' | 'tested' | 'completed' | 'failed';
      installationNotes?: string;
      photos?: string[]; // URLs to photos
      testResults?: {
        testedAt?: Date;
        testedBy?: string;
        passed?: boolean;
        notes?: string;
        metrics?: any;
      };
    }>;
    documentation?: {
      installationPhotos?: string[];
      testReports?: string[];
      asBuiltDrawings?: string[];
      completionCertificate?: string;
      notes?: string;
    };
    milestones?: Array<{
      name: string;
      description: string;
      targetDate?: Date;
      completedDate?: Date;
      status?: 'pending' | 'in_progress' | 'completed' | 'overdue';
    }>;
    notes?: string;
    issues?: Array<{
      reportedBy: string;
      reportedAt?: Date;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      status?: 'open' | 'investigating' | 'resolved' | 'closed';
      resolvedAt?: Date;
      resolvedBy?: string;
      resolution?: string;
    }>;
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

export type PlanFeatureType = 'site' | 'sector' | 'cpe' | 'equipment' | 'link' | 'note';

export interface PlanFeatureGeometry {
  type: 'Point' | 'LineString' | 'Polygon';
  coordinates: any;
}

export interface PlanLayerFeature {
  id: string;
  tenantId: string;
  planId: string;
  featureType: PlanFeatureType;
  geometry?: PlanFeatureGeometry;
  properties: Record<string, any>;
  status: 'draft' | 'pending-review' | 'approved' | 'rejected' | 'authorized';
  metadata?: Record<string, any>;
  originFeatureId?: string;
  promotedResourceId?: string;
  promotedResourceType?: string;
  createdBy?: string;
  createdById?: string;
  updatedBy?: string;
  updatedById?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanFeatureSummary {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

class PlanService {
  private async getAuthToken(): Promise<string> {
    const token = await authService.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    return token;
  }
  
  private async apiCall(endpoint: string, options: RequestInit = {}, tenantId?: string): Promise<any> {
    const token = await this.getAuthToken();
    const currentUser = await authService.getCurrentUser();
    
    // Use provided tenantId or fall back to localStorage
    const resolvedTenantId = tenantId || (typeof window !== 'undefined' ? localStorage.getItem('selectedTenantId') : null);
    
    if (!resolvedTenantId) {
      throw new Error('No tenant selected');
    }
    
    // Use centralized API configuration
    const apiPath = API_URL;
    const fullUrl = `${apiPath}${endpoint}`;
    console.log('[planService] API URL:', { API_URL, apiPath, fullUrl, endpoint });
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': resolvedTenantId,
        'X-User-Email': currentUser?.email || '',
        'Content-Type': 'application/json',
        ...options.headers
      }
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
      if (Array.isArray(towers)) {
        towers.forEach(tower => {
          const towerLocation = tower.location;
          hardware.push({
            id: tower.id,
            type: 'tower',
            name: tower.name,
            location: {
              latitude: towerLocation?.latitude ?? 0,
              longitude: towerLocation?.longitude ?? 0,
              address: towerLocation?.address
            },
            status: tower.status ?? 'unknown',
            module: 'manual',
            lastUpdated: new Date(tower.updatedAt ?? new Date()),
            isReadOnly: true, // Existing hardware is read-only in plan
            inventoryId: tower.inventoryId
          });
        });
      }
      
      // Get sectors from coverage map
      const sectors = await coverageMapService.getSectors(tenantId);
      if (Array.isArray(sectors)) {
        sectors.forEach(sector => {
          const sectorLocation = sector.location;
          const sectorName = sector.towerName ? `${sector.towerName} - Sector ${sector.azimuth}°` : sector.name;
          const modules = sector.modules as Record<string, unknown> | undefined;
          hardware.push({
            id: sector.id,
            type: 'sector',
            name: sectorName,
            location: {
              latitude: sectorLocation?.latitude ?? 0,
              longitude: sectorLocation?.longitude ?? 0,
              address: sectorLocation?.address
            },
            status: sector.status ?? 'unknown',
            module: modules?.pci ? 'pci' : 'manual',
            lastUpdated: new Date(sector.updatedAt ?? new Date()),
            isReadOnly: true,
            inventoryId: sector.inventoryId
          });
        });
      }
      
      // Get CPE devices from coverage map
      const cpeDevices = await coverageMapService.getCPEDevices(tenantId);
      if (Array.isArray(cpeDevices)) {
        cpeDevices.forEach(cpe => {
          const cpeLocation = cpe.location;
          const modules = cpe.modules as Record<string, unknown> | undefined;
          hardware.push({
            id: cpe.id,
            type: 'cpe',
            name: `${cpe.manufacturer} ${cpe.model} - ${cpe.serialNumber}`,
            location: {
              latitude: cpeLocation?.latitude ?? 0,
              longitude: cpeLocation?.longitude ?? 0,
              address: cpeLocation?.address
            },
            status: cpe.status ?? 'unknown',
            module: modules?.acs ? 'acs' : modules?.hss ? 'hss' : 'manual',
            lastUpdated: new Date(cpe.updatedAt ?? new Date()),
            isReadOnly: true,
            inventoryId: cpe.inventoryId
          });
        });
      }
      
      // Get equipment from coverage map
      const equipment = await coverageMapService.getEquipment(tenantId);
      if (Array.isArray(equipment)) {
        equipment.forEach(item => {
          const equipmentLocation = item.location;
          const modules = item.modules as Record<string, unknown> | undefined;
          hardware.push({
            id: item.id,
            type: 'equipment',
            name: `${item.manufacturer} ${item.model} - ${item.serialNumber}`,
            location: {
              latitude: equipmentLocation?.latitude ?? 0,
              longitude: equipmentLocation?.longitude ?? 0,
              address: equipmentLocation?.address
            },
            status: item.status ?? 'unknown',
            module: modules?.acs ? 'acs' : 'inventory',
            lastUpdated: new Date(item.updatedAt ?? new Date()),
            isReadOnly: true,
            inventoryId: item.inventoryId
          });
        });
      }
      
      // Get inventory items
      const inventoryResult = await inventoryService.getInventory({}, tenantId);
      const inventoryItems = inventoryResult?.items || [];
      if (Array.isArray(inventoryItems)) {
        inventoryItems.forEach(item => {
          // Only include items that aren't already mapped to coverage map
          const alreadyMapped = hardware.some(h => h.inventoryId === item._id);
          if (!alreadyMapped) {
            const currentLocation = item.currentLocation;
            const modules = item.modules;
            hardware.push({
              id: item._id || '',
              type: 'equipment',
              name: `${item.manufacturer || 'Unknown'} ${item.model || 'Unknown'} - ${item.serialNumber}`,
              location: {
                latitude: currentLocation?.latitude ?? 0,
                longitude: currentLocation?.longitude ?? 0,
                address: currentLocation?.address
              },
              status: item.status,
              module: modules?.acs ? 'acs' : modules?.hss ? 'hss' : 'inventory',
              lastUpdated: item.updatedAt ? new Date(item.updatedAt as string | number | Date) : new Date(),
              isReadOnly: true,
              inventoryId: item._id
            });
          }
        });
      }
      
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
        location: planData.location ?? undefined,
        marketing: planData.marketing
          ? {
              ...planData.marketing,
              lastRunAt: planData.marketing.lastRunAt
                ? new Date(planData.marketing.lastRunAt).toISOString()
                : undefined
            }
          : undefined,
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
    const plans = await this.apiCall(query, {}, tenantId);
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
   * Authorize plan (promote plan-layer assets to production)
   */
  async authorizePlan(planId: string, notes?: string): Promise<PlanProject> {
    const result = await this.apiCall(`/${planId}/authorize`, {
      method: 'POST',
      body: JSON.stringify({ notes })
    });
    return this.mapBackendPlanToFrontend(result.plan);
  }

  /**
   * Get staged features for a plan
   */
  async getPlanFeatures(planId: string): Promise<{ features: PlanLayerFeature[]; summary: PlanFeatureSummary }> {
    try {
      const response = await this.apiCall(`/${planId}/features`);
      const features: PlanLayerFeature[] = Array.isArray(response.features)
        ? response.features.map((feature: any) => this.mapBackendFeatureToFrontend(feature))
        : [];

      return {
        features,
        summary: this.normalizeSummary(response.summary)
      };
    } catch (error: any) {
      const message = (error?.message || '').toLowerCase();
      if (message.includes('plan not found') || message.includes('404')) {
        console.warn('[planService] Plan features not found, returning empty set for plan:', planId);
        return {
          features: [],
          summary: this.normalizeSummary({ total: 0, byType: {}, byStatus: {} })
        };
      }
      throw error;
    }
  }

  async createPlanFeature(planId: string, payload: {
    featureType: PlanFeatureType;
    geometry?: PlanFeatureGeometry;
    properties?: Record<string, any>;
    status?: PlanLayerFeature['status'];
    metadata?: Record<string, any>;
  }): Promise<{ feature: PlanLayerFeature; summary: PlanFeatureSummary }> {
    const response = await this.apiCall(`/${planId}/features`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return {
      feature: this.mapBackendFeatureToFrontend(response.feature),
      summary: this.normalizeSummary(response.summary)
    };
  }

  async updatePlanFeature(planId: string, featureId: string, updates: Partial<PlanLayerFeature>): Promise<{ feature: PlanLayerFeature; summary: PlanFeatureSummary }> {
    const response = await this.apiCall(`/${planId}/features/${featureId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });

    return {
      feature: this.mapBackendFeatureToFrontend(response.feature),
      summary: this.normalizeSummary(response.summary)
    };
  }

  async deletePlanFeature(planId: string, featureId: string): Promise<PlanFeatureSummary> {
    const response = await this.apiCall(`/${planId}/features/${featureId}`, {
      method: 'DELETE'
    });

    return this.normalizeSummary(response.summary);
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
      location: plan.location
        ? {
            addressLine1: plan.location.addressLine1 ?? plan.location.address ?? undefined,
            addressLine2: plan.location.addressLine2 ?? plan.location.unit ?? undefined,
            city: plan.location.city ?? undefined,
            state: plan.location.state ?? undefined,
            postalCode: plan.location.postalCode ?? plan.location.zip ?? plan.location.postcode ?? undefined,
            country: plan.location.country ?? undefined,
            latitude: typeof plan.location.latitude === 'number' ? plan.location.latitude : undefined,
            longitude: typeof plan.location.longitude === 'number' ? plan.location.longitude : undefined
          }
        : plan.location === null
          ? null
          : undefined,
      marketing: plan.marketing
        ? {
            targetRadiusMiles: plan.marketing.targetRadiusMiles ?? undefined,
            lastRunAt: plan.marketing.lastRunAt ? new Date(plan.marketing.lastRunAt) : undefined,
            lastResultCount: plan.marketing.lastResultCount ?? undefined,
            lastBoundingBox: plan.marketing.lastBoundingBox ?? undefined,
            lastCenter: plan.marketing.lastCenter ?? undefined,
            algorithms: Array.isArray(plan.marketing.algorithms) ? plan.marketing.algorithms : undefined,
            algorithmStats: plan.marketing.algorithmStats ?? undefined,
            addresses: Array.isArray(plan.marketing.addresses)
              ? plan.marketing.addresses.map((addr: any) => ({
                  addressLine1: addr.addressLine1 ?? addr.address ?? undefined,
                  addressLine2: addr.addressLine2 ?? addr.unit ?? undefined,
                  city: addr.city ?? undefined,
                  state: addr.state ?? undefined,
                  postalCode: addr.postalCode ?? addr.zip ?? addr.postcode ?? undefined,
                  country: addr.country ?? undefined,
                  latitude: typeof addr.latitude === 'number' ? addr.latitude : undefined,
                  longitude: typeof addr.longitude === 'number' ? addr.longitude : undefined,
                  source: addr.source ?? undefined,
                  discoveredAt: addr.discoveredAt
                    ? (() => {
                        const parsed = new Date(addr.discoveredAt);
                        return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
                      })()
                    : undefined
                }))
              : undefined,
            totalUniqueAddresses: plan.marketing.totalUniqueAddresses ?? undefined,
            totalRuns: plan.marketing.totalRuns ?? undefined,
            lastRunNewAddresses: plan.marketing.lastRunNewAddresses ?? undefined,
            runHistory: Array.isArray(plan.marketing.runHistory)
              ? plan.marketing.runHistory.map((entry: any) => ({
                  runAt: entry.runAt
                    ? (() => {
                        const parsed = new Date(entry.runAt);
                        return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
                      })()
                    : undefined,
                  boundingBox: entry.boundingBox ?? undefined,
                  center: entry.center ?? undefined,
                  newAddresses: entry.newAddresses ?? undefined,
                  totalAddresses: entry.totalAddresses ?? undefined,
                  algorithms: Array.isArray(entry.algorithms) ? entry.algorithms : undefined
                }))
              : undefined
          }
        : plan.marketing === null
          ? null
          : undefined,
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
      authorization: plan.authorization || undefined,
      deployment: plan.deployment || {}
    };
  }

  async discoverMarketingAddresses(
    planId: string,
    payload: {
      boundingBox: { west: number; south: number; east: number; north: number };
      radiusMiles: number;
      center?: { lat: number; lon: number };
      options?: {
        advancedOptions?: Record<string, unknown>;
        viewExtent?: Record<string, unknown>;
        algorithms?: string[];
        [key: string]: unknown;
      };
    }
  ): Promise<{
    summary: {
      totalCandidates: number;
      geocodedCount: number;
      radiusMiles: number;
      boundingBox: { west: number; south: number; east: number; north: number };
      center?: { lat: number; lon: number };
      algorithmsUsed?: string[];
      algorithmStats?: Record<string, { produced?: number; geocoded?: number }>;
      newlyAdded?: number;
      previousCount?: number;
      totalUniqueAddresses?: number;
      totalRuns?: number;
    };
    addresses: PlanMarketingAddress[];
    metadata?: {
      totalUniqueAddresses?: number;
      newlyAdded?: number;
      previousCount?: number;
      totalRuns?: number;
      runTimestamp?: string;
    };
  }> {
    const response = await this.apiCall(`/${planId}/marketing/discover`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const summary = response.summary || {};
    const metadata = response.metadata || {};
    const normalizeIsoString = (value: unknown): string | undefined => {
      if (!value) return undefined;
      const parsed = new Date(value as any);
      return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
    };
    const addresses: PlanMarketingAddress[] = Array.isArray(response.addresses)
      ? response.addresses.map((addr: any) => ({
          // Backend sends shortened field names (a1, c, s, z, lat, lon, src) to reduce JSON size
          // Map both shortened and full field names for compatibility
          addressLine1: addr.a1 ?? addr.addressLine1 ?? addr.address ?? undefined,
          addressLine2: addr.addressLine2 ?? addr.unit ?? undefined,
          city: addr.c ?? addr.city ?? undefined,
          state: addr.s ?? addr.state ?? undefined,
          postalCode: addr.z ?? addr.postalCode ?? addr.zip ?? addr.postcode ?? undefined,
          country: addr.country ?? undefined,
          latitude:
            typeof addr.lat === 'number'
              ? addr.lat
              : typeof addr.latitude === 'number'
                ? addr.latitude
                : addr.lat !== undefined
                  ? Number(addr.lat)
                  : addr.latitude !== undefined
                    ? Number(addr.latitude)
                    : undefined,
          longitude:
            typeof addr.lon === 'number'
              ? addr.lon
              : typeof addr.longitude === 'number'
                ? addr.longitude
                : addr.lon !== undefined
                  ? Number(addr.lon)
                  : addr.longitude !== undefined
                    ? Number(addr.longitude)
                    : undefined,
          source: addr.src ?? addr.source ?? undefined,
          discoveredAt: normalizeIsoString(addr.discoveredAt ?? addr.discovered_at ?? addr.runTimestamp)
        }))
      : [];

    return {
      summary: {
        totalCandidates: summary.totalCandidates ?? addresses.length,
        geocodedCount: summary.geocodedCount ?? 0,
        radiusMiles: summary.radiusMiles ?? payload.radiusMiles,
        boundingBox: summary.boundingBox ?? payload.boundingBox,
        center: summary.center ?? payload.center,
        algorithmsUsed: Array.isArray(summary.algorithmsUsed) ? summary.algorithmsUsed : undefined,
        algorithmStats: summary.algorithmStats ?? undefined,
        newlyAdded: summary.newlyAdded ?? metadata.newlyAdded ?? undefined,
        previousCount: summary.previousCount ?? metadata.previousCount ?? undefined,
        totalUniqueAddresses:
          summary.totalUniqueAddresses ?? metadata.totalUniqueAddresses ?? summary.totalCandidates ?? addresses.length,
        totalRuns: summary.totalRuns ?? metadata.totalRuns ?? undefined
      },
      addresses,
      metadata: {
        totalUniqueAddresses:
          metadata.totalUniqueAddresses ?? summary.totalUniqueAddresses ?? summary.totalCandidates ?? addresses.length,
        newlyAdded: metadata.newlyAdded ?? summary.newlyAdded ?? 0,
        previousCount: metadata.previousCount ?? summary.previousCount ?? 0,
        totalRuns: metadata.totalRuns ?? summary.totalRuns ?? undefined,
        runTimestamp: normalizeIsoString(metadata.runTimestamp)
      }
    };
  }

  private mapBackendFeatureToFrontend(feature: any): PlanLayerFeature {
    return {
      id: feature._id || feature.id,
      tenantId: feature.tenantId,
      planId: feature.planId,
      featureType: feature.featureType,
      geometry: feature.geometry,
      properties: feature.properties || {},
      status: feature.status || 'draft',
      metadata: feature.metadata || {},
      originFeatureId: feature.originFeatureId,
      promotedResourceId: feature.promotedResourceId,
      promotedResourceType: feature.promotedResourceType,
      createdBy: feature.createdBy,
      createdById: feature.createdById,
      updatedBy: feature.updatedBy,
      updatedById: feature.updatedById,
      createdAt: feature.createdAt ? new Date(feature.createdAt) : new Date(),
      updatedAt: feature.updatedAt ? new Date(feature.updatedAt) : new Date()
    };
  }

  private normalizeSummary(summary: any): PlanFeatureSummary {
    return {
      total: summary?.total ?? 0,
      byType: summary?.byType ?? {},
      byStatus: summary?.byStatus ?? {}
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
