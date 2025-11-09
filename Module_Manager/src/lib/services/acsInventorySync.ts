/**
 * ACS CPE Inventory Sync Service
 * Automatically syncs ACS-managed CPE devices to the inventory system
 */

import { inventoryService } from './inventoryService';
import type { InventoryItem } from './inventoryService';

export interface CPEDevice {
  _id: string;
  'Device.DeviceInfo.SerialNumber'?: string;
  'Device.DeviceInfo.Manufacturer'?: string;
  'Device.DeviceInfo.ModelName'?: string;
  'Device.DeviceInfo.HardwareVersion'?: string;
  'Device.DeviceInfo.SoftwareVersion'?: string;
  'Device.ManagementServer.ConnectionRequestURL'?: string;
  'Device.DeviceInfo.ProvisioningCode'?: string;
  'InternetGatewayDevice.DeviceInfo.SerialNumber'?: string;
  'InternetGatewayDevice.DeviceInfo.Manufacturer'?: string;
  'InternetGatewayDevice.DeviceInfo.ModelName'?: string;
  _lastInform?: Date;
  _registered?: Date;
  _tags?: string[];
}

export interface SyncResult {
  success: boolean;
  synced: number;
  created: number;
  updated: number;
  errors: string[];
  skipped: number;
}

/**
 * Sync ACS CPE devices to inventory
 */
export async function syncACSCPEToInventory(
  tenantId: string,
  cpeDevices: CPEDevice[],
  defaultSiteId?: string
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    synced: 0,
    created: 0,
    updated: 0,
    errors: [],
    skipped: 0
  };

  console.log(`[ACS Sync] Starting sync of ${cpeDevices.length} CPE devices...`);

  for (const cpe of cpeDevices) {
    try {
      // Extract serial number (try both TR-069 and TR-181 paths)
      const serialNumber = cpe['Device.DeviceInfo.SerialNumber'] || 
                          cpe['InternetGatewayDevice.DeviceInfo.SerialNumber'] ||
                          cpe._id;
      
      if (!serialNumber) {
        result.skipped++;
        result.errors.push(`CPE ${cpe._id} has no serial number`);
        continue;
      }

      // Check if already exists in inventory
      const existingItems = await inventoryService.searchInventory(tenantId, serialNumber);
      
      const manufacturer = cpe['Device.DeviceInfo.Manufacturer'] || 
                          cpe['InternetGatewayDevice.DeviceInfo.Manufacturer'] || 
                          'Unknown';
      const model = cpe['Device.DeviceInfo.ModelName'] || 
                   cpe['InternetGatewayDevice.DeviceInfo.ModelName'] || 
                   'Unknown';
      const hardwareVersion = cpe['Device.DeviceInfo.HardwareVersion'] || '';
      const softwareVersion = cpe['Device.DeviceInfo.SoftwareVersion'] || '';
      
      // Prepare inventory data
      const inventoryData: Partial<InventoryItem> = {
        category: 'cpe',
        equipmentType: 'customer-cpe',
        serialNumber,
        manufacturer,
        model,
        currentLocation: {
          type: 'customer',
          siteId: defaultSiteId,
          siteName: defaultSiteId ? undefined : 'Customer Site'
        },
        status: cpe._lastInform ? 'deployed' : 'available',
        condition: 'good',
        purchaseInfo: {
          purchaseDate: cpe._registered ? new Date(cpe._registered) : undefined
        },
        hardwareVersion,
        firmwareVersion: softwareVersion,
        technicalSpecs: {
          managementUrl: cpe['Device.ManagementServer.ConnectionRequestURL']
        },
        notes: `Managed by ACS (GenieACS)\nACS ID: ${cpe._id}${cpe._tags ? `\nTags: ${cpe._tags.join(', ')}` : ''}`,
        modules: {
          acs: {
            deviceId: cpe._id,
            lastSync: new Date(),
            managedByACS: true
          }
        },
        tenantId
      };

      if (existingItems.length > 0) {
        // Update existing item
        const existingItem = existingItems[0];
        await inventoryService.updateInventory(tenantId, existingItem._id!, inventoryData);
        result.updated++;
        console.log(`[ACS Sync] Updated: ${serialNumber}`);
      } else {
        // Create new item
        await inventoryService.createInventory(tenantId, inventoryData);
        result.created++;
        console.log(`[ACS Sync] Created: ${serialNumber}`);
      }
      
      result.synced++;
    } catch (error: any) {
      result.errors.push(`Failed to sync ${cpe._id}: ${error.message}`);
      console.error('[ACS Sync] Error:', error);
    }
  }

  result.success = result.errors.length === 0;
  
  console.log('[ACS Sync] Complete:', result);
  
  return result;
}

/**
 * Get ACS sync status for a CPE device
 */
export async function getACSSyncStatus(tenantId: string, acsDeviceId: string): Promise<{
  inInventory: boolean;
  inventoryId?: string;
  lastSync?: Date;
}> {
  try {
    const items = await inventoryService.getInventoryByLocation(tenantId, 'customer');
    const syncedItem = items.find(item => item.modules?.acs?.deviceId === acsDeviceId);
    
    return {
      inInventory: !!syncedItem,
      inventoryId: syncedItem?._id,
      lastSync: syncedItem?.modules?.acs?.lastSync
        ? new Date(syncedItem.modules.acs.lastSync as string | number | Date)
        : undefined
    };
  } catch (error) {
    console.error('[ACS Sync] Status check failed:', error);
    return { inInventory: false };
  }
}

