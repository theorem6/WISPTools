/**
 * ACS Integration Service
 * 
 * Bridges the HSS subscriber database with the ACS/TR-069 GenieACS system
 * Key correlation: IMSI from CPE device → HSS subscriber database
 * 
 * Flow:
 * 1. CPE reports IMSI via TR-069 parameter (Device.Cellular.Interface.1.USIM.IMSI)
 * 2. This service extracts IMSI from GenieACS
 * 3. Links IMSI to HSS subscriber record
 * 4. Provides unified view of subscriber + device status
 */

import { MongoClient, Db, Collection } from 'mongodb';
import axios from 'axios';

interface CPEDevice {
  _id: string;
  _deviceId: {
    Manufacturer: string;
    OUI: string;
    ProductClass: string;
    SerialNumber: string;
  };
  _lastInform: Date;
  tenantId: string;
  
  // TR-069 parameters we care about
  'Device.Cellular.Interface.1.USIM.IMSI'?: string;
  'Device.Cellular.Interface.1.USIM.ICCID'?: string;
  'Device.DeviceInfo.SerialNumber'?: string;
  'Device.GPS.Latitude'?: string;
  'Device.GPS.Longitude'?: string;
  'Device.IP.Interface.1.IPAddress'?: string;
}

interface SubscriberCPEMapping {
  imsi: string;
  tenantId: string;
  cpe: {
    serial_number: string;
    acs_device_id: string;
    manufacturer: string;
    product_class: string;
    last_inform: Date;
    online: boolean;
    location?: {
      latitude: number;
      longitude: number;
    };
    ip_address?: string;
  };
  updated_at: Date;
}

export class ACSIntegrationService {
  private db: Db;
  private hssDb: Db;
  private genieacsDb: Db;
  private subscribersCollection: Collection;
  private mappingsCollection: Collection;
  
  private genieacsApiUrl: string;
  private genieacsAuth?: { username: string; password: string };

  constructor(
    mongoUri: string,
    genieacsApiUrl: string = 'http://localhost:7557',
    genieacsAuth?: { username: string; password: string }
  ) {
    this.genieacsApiUrl = genieacsApiUrl;
    this.genieacsAuth = genieacsAuth;
    this.initializeConnection(mongoUri);
  }

  private async initializeConnection(mongoUri: string): Promise<void> {
    const client = new MongoClient(mongoUri);
    await client.connect();
    
    // HSS database
    this.hssDb = client.db('hss');
    this.subscribersCollection = this.hssDb.collection('active_subscribers');
    
    // GenieACS database (direct access for better performance)
    this.genieacsDb = client.db('genieacs');
    
    // Mapping collection (stores IMSI → CPE relationships)
    this.db = client.db('hss');
    this.mappingsCollection = this.db.collection('subscriber_cpe_mappings');
    
    await this.createIndexes();
  }

  private async createIndexes(): Promise<void> {
    await this.mappingsCollection.createIndex({ imsi: 1 }, { unique: true });
    await this.mappingsCollection.createIndex({ 'cpe.serial_number': 1 });
    await this.mappingsCollection.createIndex({ tenantId: 1 });
  }

  /**
   * Sync CPE devices from GenieACS and extract IMSI
   * This should be called periodically (e.g., every 5 minutes)
   */
  async syncCPEDevices(tenantId?: string): Promise<{
    synced: number;
    linked: number;
    errors: number;
  }> {
    const stats = { synced: 0, linked: 0, errors: 0 };

    try {
      // Get all devices from GenieACS MongoDB directly
      const devicesCollection = this.genieacsDb.collection('devices');
      
      const query: any = {};
      if (tenantId) {
        query.tenantId = tenantId;
      }

      const devices = await devicesCollection.find(query).toArray();
      stats.synced = devices.length;

      for (const device of devices) {
        try {
          // Extract IMSI from TR-069 parameters
          const imsi = this.extractIMSI(device);
          
          if (!imsi) {
            // No IMSI found, skip
            continue;
          }

          // Check if subscriber exists in HSS
          const subscriber = await this.subscribersCollection.findOne({ imsi });
          
          const mapping: SubscriberCPEMapping = {
            imsi: imsi,
            tenantId: device.tenantId || 'default',
            cpe: {
              serial_number: device._deviceId?.SerialNumber || device._id,
              acs_device_id: device._id,
              manufacturer: device._deviceId?.Manufacturer || 'Unknown',
              product_class: device._deviceId?.ProductClass || 'Unknown',
              last_inform: device._lastInform || new Date(),
              online: this.isDeviceOnline(device._lastInform),
              location: this.extractLocation(device),
              ip_address: device['Device.IP.Interface.1.IPAddress']
            },
            updated_at: new Date()
          };

          // Update mapping
          await this.mappingsCollection.updateOne(
            { imsi: imsi },
            { $set: mapping },
            { upsert: true }
          );

          // Update subscriber record with ACS info (if subscriber exists)
          if (subscriber) {
            await this.subscribersCollection.updateOne(
              { imsi: imsi },
              {
                $set: {
                  'acs.cpe_serial_number': mapping.cpe.serial_number,
                  'acs.acs_device_id': mapping.cpe.acs_device_id,
                  'acs.last_acs_inform': mapping.cpe.last_inform,
                  'acs.device_status': mapping.cpe.online ? 'online' : 'offline',
                  'metadata.updated_at': new Date()
                }
              }
            );
            stats.linked++;
          }

        } catch (error) {
          console.error(`Error processing device ${device._id}:`, error);
          stats.errors++;
        }
      }

    } catch (error) {
      console.error('Error syncing CPE devices:', error);
      throw error;
    }

    return stats;
  }

  /**
   * Extract IMSI from CPE device TR-069 parameters
   * Supports multiple parameter paths as different manufacturers use different paths
   */
  private extractIMSI(device: any): string | null {
    // Try multiple possible TR-069 parameter paths for IMSI
    const possiblePaths = [
      'Device.Cellular.Interface.1.USIM.IMSI',
      'Device.X_ALU_Cellular.Interface.1.USIM.IMSI',
      'InternetGatewayDevice.WANDevice.1.X_BROADCOM_COM_IMSI',
      'Device.WWANInterfaceConfig.1.IMSI',
      'Device.X_VENDOR_IMSI',
    ];

    for (const path of possiblePaths) {
      const imsi = device[path];
      if (imsi && /^\d{15}$/.test(imsi)) {
        return imsi;
      }
    }

    // Fallback: check if IMSI is in device tags or metadata
    if (device._tags) {
      for (const tag of device._tags) {
        if (tag.startsWith('imsi:')) {
          const imsi = tag.substring(5);
          if (/^\d{15}$/.test(imsi)) {
            return imsi;
          }
        }
      }
    }

    return null;
  }

  /**
   * Extract GPS location from CPE device
   */
  private extractLocation(device: any): { latitude: number; longitude: number } | undefined {
    const lat = device['Device.GPS.Latitude'];
    const lon = device['Device.GPS.Longitude'];
    
    if (lat && lon) {
      return {
        latitude: parseFloat(lat),
        longitude: parseFloat(lon)
      };
    }
    
    return undefined;
  }

  /**
   * Check if device is online (last inform within 5 minutes)
   */
  private isDeviceOnline(lastInform: Date): boolean {
    if (!lastInform) return false;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return new Date(lastInform) > fiveMinutesAgo;
  }

  /**
   * Get CPE device info for a subscriber by IMSI
   */
  async getCPEByIMSI(imsi: string): Promise<SubscriberCPEMapping | null> {
    return await this.mappingsCollection.findOne({ imsi });
  }

  /**
   * Get subscriber info by CPE serial number
   */
  async getSubscriberBySerial(serialNumber: string): Promise<any | null> {
    const mapping = await this.mappingsCollection.findOne({ 
      'cpe.serial_number': serialNumber 
    });
    
    if (!mapping) {
      return null;
    }

    const subscriber = await this.subscribersCollection.findOne({ 
      imsi: mapping.imsi 
    });

    return {
      ...subscriber,
      ki: '***ENCRYPTED***',
      opc: '***ENCRYPTED***',
      cpe: mapping.cpe
    };
  }

  /**
   * Get unified view: Subscriber + CPE + Network Status
   */
  async getUnifiedSubscriberView(imsi: string): Promise<any> {
    // Get subscriber from HSS
    const subscriber = await this.subscribersCollection.findOne({ imsi });
    
    if (!subscriber) {
      throw new Error(`Subscriber not found: ${imsi}`);
    }

    // Get CPE mapping
    const mapping = await this.mappingsCollection.findOne({ imsi });

    // Get active sessions (if any)
    const sessionsCollection = this.hssDb.collection('subscriber_sessions');
    const activeSessions = await sessionsCollection.find({ 
      imsi,
      status: 'active'
    }).toArray();

    return {
      subscriber: {
        ...subscriber,
        ki: '***ENCRYPTED***',
        opc: '***ENCRYPTED***'
      },
      cpe: mapping?.cpe || null,
      network: {
        active_sessions: activeSessions.length,
        sessions: activeSessions
      },
      status: {
        subscriber_active: subscriber.status === 'active',
        cpe_online: mapping?.cpe?.online || false,
        has_active_session: activeSessions.length > 0
      }
    };
  }

  /**
   * List all subscribers with their CPE status
   */
  async listSubscribersWithCPE(
    tenantId: string,
    filter?: {
      status?: 'active' | 'inactive' | 'suspended';
      cpe_online?: boolean;
      has_cpe?: boolean;
    },
    limit: number = 100,
    skip: number = 0
  ): Promise<any[]> {
    const query: any = { tenantId };
    
    if (filter?.status) {
      query.status = filter.status;
    }

    const subscribers = await this.subscribersCollection
      .find(query)
      .limit(limit)
      .skip(skip)
      .toArray();

    // Enrich with CPE data
    const enriched = await Promise.all(
      subscribers.map(async (sub) => {
        const mapping = await this.mappingsCollection.findOne({ imsi: sub.imsi });
        
        // Apply filters
        if (filter?.has_cpe !== undefined) {
          if (filter.has_cpe && !mapping) return null;
          if (!filter.has_cpe && mapping) return null;
        }
        
        if (filter?.cpe_online !== undefined && mapping) {
          if (mapping.cpe.online !== filter.cpe_online) return null;
        }

        return {
          ...sub,
          ki: '***ENCRYPTED***',
          opc: '***ENCRYPTED***',
          cpe: mapping?.cpe || null
        };
      })
    );

    return enriched.filter(item => item !== null);
  }

  /**
   * Trigger immediate sync for a specific device
   * Useful when a new CPE connects to ACS
   */
  async syncSingleDevice(deviceId: string): Promise<boolean> {
    try {
      const devicesCollection = this.genieacsDb.collection('devices');
      const device = await devicesCollection.findOne({ _id: deviceId });
      
      if (!device) {
        return false;
      }

      const imsi = this.extractIMSI(device);
      
      if (!imsi) {
        return false;
      }

      const mapping: SubscriberCPEMapping = {
        imsi: imsi,
        tenantId: device.tenantId || 'default',
        cpe: {
          serial_number: device._deviceId?.SerialNumber || device._id,
          acs_device_id: device._id,
          manufacturer: device._deviceId?.Manufacturer || 'Unknown',
          product_class: device._deviceId?.ProductClass || 'Unknown',
          last_inform: device._lastInform || new Date(),
          online: this.isDeviceOnline(device._lastInform),
          location: this.extractLocation(device),
          ip_address: device['Device.IP.Interface.1.IPAddress']
        },
        updated_at: new Date()
      };

      await this.mappingsCollection.updateOne(
        { imsi: imsi },
        { $set: mapping },
        { upsert: true }
      );

      // Update subscriber record
      await this.subscribersCollection.updateOne(
        { imsi: imsi },
        {
          $set: {
            'acs.cpe_serial_number': mapping.cpe.serial_number,
            'acs.acs_device_id': mapping.cpe.acs_device_id,
            'acs.last_acs_inform': mapping.cpe.last_inform,
            'acs.device_status': mapping.cpe.online ? 'online' : 'offline',
            'metadata.updated_at': new Date()
          }
        }
      );

      return true;

    } catch (error) {
      console.error('Error syncing single device:', error);
      return false;
    }
  }

  /**
   * Get statistics about IMSI/CPE correlation
   */
  async getCorrelationStats(tenantId: string): Promise<{
    total_subscribers: number;
    subscribers_with_cpe: number;
    subscribers_without_cpe: number;
    cpe_online: number;
    cpe_offline: number;
  }> {
    const totalSubscribers = await this.subscribersCollection.countDocuments({ 
      tenantId,
      status: 'active'
    });

    const mappings = await this.mappingsCollection.find({ tenantId }).toArray();
    
    const withCPE = mappings.length;
    const withoutCPE = totalSubscribers - withCPE;
    const online = mappings.filter(m => m.cpe.online).length;
    const offline = mappings.filter(m => !m.cpe.online).length;

    return {
      total_subscribers: totalSubscribers,
      subscribers_with_cpe: withCPE,
      subscribers_without_cpe: withoutCPE,
      cpe_online: online,
      cpe_offline: offline
    };
  }

  /**
   * Setup automatic sync via GenieACS webhook
   * Call this endpoint when a device connects to ACS
   */
  async handleACSWebhook(event: {
    type: 'INFORM' | 'CONNECTION_REQUEST' | 'BOOTSTRAP';
    deviceId: string;
    timestamp: Date;
  }): Promise<void> {
    console.log(`ACS Webhook: ${event.type} for device ${event.deviceId}`);
    
    // Sync this device immediately
    await this.syncSingleDevice(event.deviceId);
  }
}

export default ACSIntegrationService;

