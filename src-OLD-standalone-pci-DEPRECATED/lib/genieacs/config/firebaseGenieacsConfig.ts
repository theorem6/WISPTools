// Firebase-specific GenieACS Configuration
// Integrates GenieACS with Firebase Functions and Firestore

import { getFirestore, doc, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { CPEDevice } from '../models/cpeDevice';
import type { GenieACSConfig } from '../api/nbiClient';

export interface FirebaseGenieACSConfig extends GenieACSConfig {
  useFirebaseFunctions: true;     // Always true for Firebase integration
  firebaseProjectId: string;      // Firebase project ID
  enableFirestoreSync: boolean;   // Enable Firestore synchronization
  syncInterval?: number;          // Sync interval in milliseconds
}

export class FirebaseGenieACSService {
  private config: FirebaseGenieACSConfig;
  private functionsUrl: string;

  constructor(config: FirebaseGenieACSConfig) {
    this.config = {
      syncInterval: 30000, // 30 seconds
      ...config
    };
    
    this.functionsUrl = `https://us-central1-${this.config.firebaseProjectId}.cloudfunctions.net`;
  }

  /**
   * Get CPE devices from Firestore (cached/synced data)
   */
  async getCPEDevices(options: {
    status?: string;
    withGPS?: boolean;
    limit?: number;
  } = {}): Promise<CPEDevice[]> {
    try {
      let q = collection(db, 'cpe_devices');
      
      // Apply filters
      if (options.status) {
        q = query(q, where('status', '==', options.status));
      }
      
      if (options.withGPS) {
        q = query(q, where('location.latitude', '>', 0));
      }
      
      if (options.limit) {
        q = query(q, limit(options.limit));
      }
      
      // Order by last sync
      q = query(q, orderBy('lastSync', 'desc'));
      
      const snapshot = await getDocs(q);
      const devices: CPEDevice[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        devices.push({
          id: doc.id,
          ...data
        } as CPEDevice);
      });
      
      return devices;
      
    } catch (error) {
      console.error('Firebase GenieACS: Failed to get CPE devices from Firestore:', error);
      throw error;
    }
  }

  /**
   * Get a specific CPE device by ID
   */
  async getCPEDevice(deviceId: string): Promise<CPEDevice | null> {
    try {
      const deviceRef = doc(db, 'cpe_devices', deviceId);
      const deviceDoc = await deviceRef.get();
      
      if (!deviceDoc.exists()) {
        return null;
      }
      
      return {
        id: deviceDoc.id,
        ...deviceDoc.data()
      } as CPEDevice;
      
    } catch (error) {
      console.error('Firebase GenieACS: Failed to get CPE device:', error);
      throw error;
    }
  }

  /**
   * Sync CPE devices from GenieACS to Firestore
   */
  async syncCPEDevices(): Promise<{ success: boolean; synced: number; errors: number }> {
    try {
      const response = await fetch(`${this.functionsUrl}/syncCPEDevices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result;
      
    } catch (error) {
      console.error('Firebase GenieACS: Failed to sync CPE devices:', error);
      throw error;
    }
  }

  /**
   * Update CPE device location
   */
  async updateCPELocation(
    deviceId: string, 
    location: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<void> {
    try {
      const response = await fetch(`${this.functionsUrl}/updateCPELocation/${deviceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(location)
      });
      
      if (!response.ok) {
        throw new Error(`Location update failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Location update failed');
      }
      
    } catch (error) {
      console.error('Firebase GenieACS: Failed to update CPE location:', error);
      throw error;
    }
  }

  /**
   * Get CPE performance metrics
   */
  async getCPEPerformanceMetrics(deviceId: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.functionsUrl}/getCPEPerformanceMetrics/${deviceId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get performance metrics: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.metrics || [];
      
    } catch (error) {
      console.error('Firebase GenieACS: Failed to get performance metrics:', error);
      throw error;
    }
  }

  /**
   * Get devices with GPS coordinates
   */
  async getDevicesWithGPS(): Promise<CPEDevice[]> {
    return this.getCPEDevices({ withGPS: true });
  }

  /**
   * Get online devices
   */
  async getOnlineDevices(): Promise<CPEDevice[]> {
    return this.getCPEDevices({ status: 'online' });
  }

  /**
   * Search devices
   */
  async searchDevices(searchText: string): Promise<CPEDevice[]> {
    try {
      // For now, get all devices and filter client-side
      // In production, you might want to implement server-side search
      const allDevices = await this.getCPEDevices();
      const searchLower = searchText.toLowerCase();
      
      return allDevices.filter(device =>
        device.deviceId.serialNumber.toLowerCase().includes(searchLower) ||
        device.deviceId.manufacturer.toLowerCase().includes(searchLower) ||
        device.deviceId.productClass.toLowerCase().includes(searchLower) ||
        device.networkInfo.ipAddress.includes(searchText)
      );
      
    } catch (error) {
      console.error('Firebase GenieACS: Failed to search devices:', error);
      throw error;
    }
  }

  /**
   * Get device statistics
   */
  async getDeviceStatistics(): Promise<{
    total: number;
    online: number;
    offline: number;
    withGPS: number;
  }> {
    try {
      const [totalDevices, onlineDevices, offlineDevices, devicesWithGPS] = await Promise.all([
        this.getCPEDevices(),
        this.getCPEDevices({ status: 'online' }),
        this.getCPEDevices({ status: 'offline' }),
        this.getCPEDevices({ withGPS: true })
      ]);
      
      return {
        total: totalDevices.length,
        online: onlineDevices.length,
        offline: offlineDevices.length,
        withGPS: devicesWithGPS.length
      };
      
    } catch (error) {
      console.error('Firebase GenieACS: Failed to get device statistics:', error);
      throw error;
    }
  }

  /**
   * Start automatic synchronization
   */
  startAutoSync(): NodeJS.Timeout {
    return setInterval(async () => {
      try {
        await this.syncCPEDevices();
        console.log('Firebase GenieACS: Auto sync completed');
      } catch (error) {
        console.error('Firebase GenieACS: Auto sync failed:', error);
      }
    }, this.config.syncInterval);
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync(timeoutId: NodeJS.Timeout): void {
    clearInterval(timeoutId);
  }
}

// Factory function for Firebase GenieACS service
export function createFirebaseGenieACSService(
  firebaseProjectId: string,
  config?: Partial<FirebaseGenieACSConfig>
): FirebaseGenieACSService {
  const fullConfig: FirebaseGenieACSConfig = {
    baseUrl: '', // Will be overridden
    useFirebaseFunctions: true,
    firebaseProjectId,
    enableFirestoreSync: true,
    ...config
  };
  
  return new FirebaseGenieACSService(fullConfig);
}
