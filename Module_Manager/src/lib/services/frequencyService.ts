/**
 * Frequency Planning Service
 * Business logic layer for frequency planning operations
 */

import { frequencyPlanner, type TowerSector, type FrequencyPlan, type FrequencyConflict, type FrequencyOptimization } from '../frequencyPlanner';
import { coverageMapService } from '../../routes/modules/coverage-map/lib/coverageMapService.mongodb';

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class FrequencyService {
  private static instance: FrequencyService;
  
  private constructor() {
    console.log('[FrequencyService] Initialized');
  }
  
  public static getInstance(): FrequencyService {
    if (!FrequencyService.instance) {
      FrequencyService.instance = new FrequencyService();
    }
    return FrequencyService.instance;
  }

  /**
   * Load network data and convert to frequency planner format
   */
  async loadNetworkData(tenantId: string): Promise<ServiceResult<TowerSector[]>> {
    try {
      console.log(`[FrequencyService] Loading network data for tenant: ${tenantId}`);
      
      if (!tenantId || tenantId.trim() === '') {
        return {
          success: false,
          error: 'No tenant ID provided'
        };
      }

      // Load tower sites from coverage map service
      const sites = await coverageMapService.getTowerSites(tenantId);
      console.log(`[FrequencyService] Loaded ${sites.length} sites from coverage map service`);

      // Convert sites to tower sectors
      const sectors: TowerSector[] = sites.map(site => ({
        id: site.id,
        name: site.name,
        latitude: site.latitude,
        longitude: site.longitude,
        azimuth: site.azimuth || 0,
        antennaHeight: site.height || 0,
        vendor: site.vendor || 'Unknown',
        frequency: {
          frequency: site.frequency || 3550, // Default to CBRS
          bandwidth: site.bandwidth || 20,
          vendor: site.vendor || 'Unknown',
          power: site.power || 30
        },
        radCenterHeight: (site.height || 0) + 2, // Assume 2m above antenna
        towerId: site.towerId || site.id,
        sectorId: site.sectorId || site.id
      }));

      console.log(`[FrequencyService] Converted to ${sectors.length} sectors for frequency analysis`);
      
      return {
        success: true,
        data: sectors
      };
    } catch (error: any) {
      console.error('[FrequencyService] Failed to load network data:', error);
      return {
        success: false,
        error: `Failed to load network data: ${error.message || 'Unknown error'}`
      };
    }
  }

  /**
   * Perform frequency conflict analysis
   */
  async performAnalysis(tenantId: string): Promise<ServiceResult<FrequencyPlan>> {
    try {
      console.log(`[FrequencyService] Performing frequency analysis for tenant: ${tenantId}`);
      
      // Load network data
      const networkResult = await this.loadNetworkData(tenantId);
      if (!networkResult.success || !networkResult.data) {
        return {
          success: false,
          error: networkResult.error || 'Failed to load network data'
        };
      }

      // Clear existing sectors and add new ones
      frequencyPlanner.clearSectors();
      frequencyPlanner.addSectors(networkResult.data);

      // Generate frequency plan
      const plan = frequencyPlanner.generateFrequencyPlan();
      
      console.log(`[FrequencyService] Analysis complete. Found ${plan.conflicts.length} conflicts`);
      
      return {
        success: true,
        data: plan
      };
    } catch (error: any) {
      console.error('[FrequencyService] Failed to perform analysis:', error);
      return {
        success: false,
        error: `Failed to perform analysis: ${error.message || 'Unknown error'}`
      };
    }
  }

  /**
   * Get frequency optimization suggestions
   */
  async getOptimizations(tenantId: string): Promise<ServiceResult<FrequencyOptimization[]>> {
    try {
      console.log(`[FrequencyService] Getting optimization suggestions for tenant: ${tenantId}`);
      
      // Load network data
      const networkResult = await this.loadNetworkData(tenantId);
      if (!networkResult.success || !networkResult.data) {
        return {
          success: false,
          error: networkResult.error || 'Failed to load network data'
        };
      }

      // Clear existing sectors and add new ones
      frequencyPlanner.clearSectors();
      frequencyPlanner.addSectors(networkResult.data);

      // Analyze conflicts first
      frequencyPlanner.analyzeConflicts();
      
      // Generate optimizations
      const optimizations = frequencyPlanner.generateOptimizations();
      
      console.log(`[FrequencyService] Generated ${optimizations.length} optimization suggestions`);
      
      return {
        success: true,
        data: optimizations
      };
    } catch (error: any) {
      console.error('[FrequencyService] Failed to get optimizations:', error);
      return {
        success: false,
        error: `Failed to get optimizations: ${error.message || 'Unknown error'}`
      };
    }
  }

  /**
   * Get plan statistics
   */
  async getPlanStatistics(tenantId: string): Promise<ServiceResult<any>> {
    try {
      console.log(`[FrequencyService] Getting plan statistics for tenant: ${tenantId}`);
      
      // Load network data
      const networkResult = await this.loadNetworkData(tenantId);
      if (!networkResult.success || !networkResult.data) {
        return {
          success: false,
          error: networkResult.error || 'Failed to load network data'
        };
      }

      // Clear existing sectors and add new ones
      frequencyPlanner.clearSectors();
      frequencyPlanner.addSectors(networkResult.data);

      // Analyze conflicts
      frequencyPlanner.analyzeConflicts();
      
      // Get statistics
      const stats = frequencyPlanner.getPlanStatistics();
      
      console.log(`[FrequencyService] Plan statistics:`, stats);
      
      return {
        success: true,
        data: stats
      };
    } catch (error: any) {
      console.error('[FrequencyService] Failed to get plan statistics:', error);
      return {
        success: false,
        error: `Failed to get plan statistics: ${error.message || 'Unknown error'}`
      };
    }
  }

  /**
   * Export frequency plan data
   */
  exportPlanData(plan: FrequencyPlan): string {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        plan: {
          sectors: plan.sectors,
          conflicts: plan.conflicts,
          optimizations: plan.optimizations,
          statistics: {
            totalSectors: plan.sectors.length,
            totalConflicts: plan.conflicts.length,
            planScore: plan.planScore,
            totalInterference: plan.totalInterference
          }
        }
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error: any) {
      console.error('[FrequencyService] Failed to export plan data:', error);
      return JSON.stringify({ error: 'Failed to export plan data' }, null, 2);
    }
  }

  /**
   * Validate frequency plan
   */
  validatePlan(plan: FrequencyPlan): {
    isValid: boolean;
    issues: string[];
    score: number;
  } {
    const issues: string[] = [];
    
    // Check for high severity conflicts
    const highSeverityConflicts = plan.conflicts.filter(c => c.severity === 'HIGH');
    if (highSeverityConflicts.length > 0) {
      issues.push(`${highSeverityConflicts.length} high severity conflicts found`);
    }
    
    // Check for vendor spacing issues
    const vendorConflicts = plan.conflicts.filter(c => c.type === 'VENDOR_SPACING');
    if (vendorConflicts.length > 0) {
      issues.push(`${vendorConflicts.length} vendor spacing issues found`);
    }
    
    // Check plan score
    if (plan.planScore < 70) {
      issues.push(`Plan score is low: ${plan.planScore}/100`);
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      score: plan.planScore
    };
  }
}

// Export singleton instance
export const frequencyService = FrequencyService.getInstance();
