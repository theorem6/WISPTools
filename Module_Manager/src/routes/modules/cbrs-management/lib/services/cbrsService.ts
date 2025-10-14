/**
 * CBRS Service
 * Unified service layer for CBRS device management
 * Integrates Google SAS and Federated Wireless APIs
 */

import { browser } from '$app/environment';
import type {
  CBSDDevice,
  CBSDState,
  Grant,
  GrantRequest,
  HeartbeatRequest,
  SpectrumInquiryRequest,
  SpectrumInquiryResponse,
  DeregistrationRequest,
  RelinquishmentRequest
} from '../models/cbsdDevice';
import { GoogleSASClient, type GoogleSASConfig } from '../api/googleSASClient';
import { FederatedWirelessClient, type FederatedWirelessConfig, type FederatedWirelessEnhancements } from '../api/federatedWirelessClient';

/**
 * CBRS Service Configuration
 */
export interface CBRSServiceConfig {
  provider: 'google' | 'federated-wireless' | 'both';
  googleConfig?: GoogleSASConfig;
  federatedConfig?: FederatedWirelessConfig;
  federatedEnhancements?: FederatedWirelessEnhancements;
  tenantId: string;
}

/**
 * CBRS Service
 */
export class CBRSService {
  private config: CBRSServiceConfig;
  private googleClient?: GoogleSASClient;
  private federatedClient?: FederatedWirelessClient;
  private devices: Map<string, CBSDDevice> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: CBRSServiceConfig) {
    this.config = config;
    this.initializeClients();
  }

  /**
   * Initialize SAS API clients
   */
  private initializeClients() {
    if (this.config.provider === 'google' || this.config.provider === 'both') {
      if (this.config.googleConfig) {
        this.googleClient = new GoogleSASClient(this.config.googleConfig);
        console.log('[CBRS Service] Google SAS client initialized');
      }
    }

    if (this.config.provider === 'federated-wireless' || this.config.provider === 'both') {
      if (this.config.federatedConfig) {
        this.federatedClient = new FederatedWirelessClient(
          this.config.federatedConfig,
          this.config.federatedEnhancements
        );
        console.log('[CBRS Service] Federated Wireless client initialized');
      }
    }
  }

  /**
   * Register a CBSD device
   */
  async registerDevice(device: CBSDDevice): Promise<CBSDDevice> {
    try {
      console.log('[CBRS Service] Registering device:', device.cbsdSerialNumber);

      let cbsdId: string | undefined;
      let registrationSuccess = false;

      // Register with selected provider
      if (device.sasProviderId === 'google' && this.googleClient) {
        const response = await this.googleClient.registerDevice(device);
        if (response.responseCode === 0 && response.cbsdId) {
          cbsdId = response.cbsdId;
          registrationSuccess = true;
        }
      } else if (device.sasProviderId === 'federated-wireless' && this.federatedClient) {
        const response = await this.federatedClient.registerDevice(device);
        if (response.responseCode === 0 && response.cbsdId) {
          cbsdId = response.cbsdId;
          registrationSuccess = true;
        }
      }

      if (!registrationSuccess || !cbsdId) {
        throw new Error('Device registration failed');
      }

      // Update device with CBSD ID and state
      const registeredDevice: CBSDDevice = {
        ...device,
        cbsdId,
        state: 'REGISTERED' as CBSDState,
        registrationTime: new Date(),
        updatedAt: new Date()
      };

      // Store device locally
      this.devices.set(device.id, registeredDevice);

      // Save to Firestore
      await this.saveDeviceToFirestore(registeredDevice);

      console.log('[CBRS Service] Device registered successfully:', cbsdId);
      return registeredDevice;
    } catch (error) {
      console.error('[CBRS Service] Registration failed:', error);
      throw error;
    }
  }

  /**
   * Request spectrum inquiry
   */
  async spectrumInquiry(device: CBSDDevice, frequencyRanges: { lowFrequency: number; highFrequency: number }[]): Promise<SpectrumInquiryResponse> {
    try {
      if (!device.cbsdId) {
        throw new Error('Device not registered with SAS');
      }

      const request: SpectrumInquiryRequest = {
        cbsdId: device.cbsdId,
        inquiredSpectrum: frequencyRanges
      };

      console.log('[CBRS Service] Requesting spectrum inquiry for:', device.cbsdId);

      let response: SpectrumInquiryResponse | undefined;

      if (device.sasProviderId === 'google' && this.googleClient) {
        response = await this.googleClient.spectrumInquiry(request);
      } else if (device.sasProviderId === 'federated-wireless' && this.federatedClient) {
        response = await this.federatedClient.spectrumInquiry(request);
      }

      if (!response) {
        throw new Error('Spectrum inquiry failed');
      }

      console.log('[CBRS Service] Spectrum inquiry response:', response);
      return response;
    } catch (error) {
      console.error('[CBRS Service] Spectrum inquiry failed:', error);
      throw error;
    }
  }

  /**
   * Request a grant
   */
  async requestGrant(device: CBSDDevice, operationParam: { maxEirp: number; lowFrequency: number; highFrequency: number }): Promise<Grant> {
    try {
      if (!device.cbsdId) {
        throw new Error('Device not registered with SAS');
      }

      const request: GrantRequest = {
        cbsdId: device.cbsdId,
        operationParam: {
          maxEirp: operationParam.maxEirp,
          operationFrequencyRange: {
            lowFrequency: operationParam.lowFrequency,
            highFrequency: operationParam.highFrequency
          }
        }
      };

      console.log('[CBRS Service] Requesting grant for:', device.cbsdId);

      let grantResponse;

      if (device.sasProviderId === 'google' && this.googleClient) {
        grantResponse = await this.googleClient.requestGrant(request);
      } else if (device.sasProviderId === 'federated-wireless' && this.federatedClient) {
        grantResponse = await this.federatedClient.requestGrant(request);
      }

      if (!grantResponse || !grantResponse.grantId) {
        throw new Error('Grant request failed');
      }

      const grant: Grant = {
        grantId: grantResponse.grantId,
        cbsdId: device.cbsdId,
        grantExpireTime: grantResponse.grantExpireTime || new Date(Date.now() + 86400000), // Default 24 hours
        heartbeatInterval: grantResponse.heartbeatInterval || 60, // Default 60 seconds
        channelType: grantResponse.channelType || 'GAA',
        operationParam: {
          maxEirp: operationParam.maxEirp,
          operationFrequencyRange: {
            lowFrequency: operationParam.lowFrequency,
            highFrequency: operationParam.highFrequency
          }
        },
        grantState: 'GRANTED'
      };

      // Update device with grant
      const updatedDevice: CBSDDevice = {
        ...device,
        state: 'GRANTED' as CBSDState,
        activeGrants: [...(device.activeGrants || []), grant],
        updatedAt: new Date()
      };

      this.devices.set(device.id, updatedDevice);
      await this.saveDeviceToFirestore(updatedDevice);

      // Start heartbeat for this grant
      this.startHeartbeat(updatedDevice, grant);

      console.log('[CBRS Service] Grant approved:', grant.grantId);
      return grant;
    } catch (error) {
      console.error('[CBRS Service] Grant request failed:', error);
      throw error;
    }
  }

  /**
   * Start automated heartbeat for a grant
   */
  private startHeartbeat(device: CBSDDevice, grant: Grant) {
    if (!browser || !device.cbsdId) return;

    const heartbeatKey = `${device.id}-${grant.grantId}`;

    // Clear existing heartbeat if any
    if (this.heartbeatIntervals.has(heartbeatKey)) {
      clearInterval(this.heartbeatIntervals.get(heartbeatKey)!);
    }

    // Start new heartbeat interval
    const interval = setInterval(async () => {
      try {
        await this.sendHeartbeat(device, grant);
      } catch (error) {
        console.error('[CBRS Service] Heartbeat failed:', error);
        // If heartbeat fails, stop the interval
        clearInterval(interval);
        this.heartbeatIntervals.delete(heartbeatKey);
      }
    }, grant.heartbeatInterval * 1000);

    this.heartbeatIntervals.set(heartbeatKey, interval);
    console.log('[CBRS Service] Heartbeat started for grant:', grant.grantId);
  }

  /**
   * Send heartbeat for a grant
   */
  async sendHeartbeat(device: CBSDDevice, grant: Grant): Promise<void> {
    try {
      if (!device.cbsdId) return;

      const request: HeartbeatRequest = {
        cbsdId: device.cbsdId,
        grantId: grant.grantId,
        operationState: grant.grantState === 'AUTHORIZED' ? 'AUTHORIZED' : 'GRANTED'
      };

      if (device.sasProviderId === 'google' && this.googleClient) {
        await this.googleClient.sendHeartbeat(request);
      } else if (device.sasProviderId === 'federated-wireless' && this.federatedClient) {
        await this.federatedClient.sendHeartbeat(request);
      }

      // Update last heartbeat time
      const updatedDevice: CBSDDevice = {
        ...device,
        lastHeartbeatTime: new Date(),
        updatedAt: new Date()
      };

      this.devices.set(device.id, updatedDevice);
      await this.saveDeviceToFirestore(updatedDevice);

      console.log('[CBRS Service] Heartbeat sent for grant:', grant.grantId);
    } catch (error) {
      console.error('[CBRS Service] Heartbeat failed:', error);
      throw error;
    }
  }

  /**
   * Relinquish a grant
   */
  async relinquishGrant(device: CBSDDevice, grantId: string): Promise<void> {
    try {
      if (!device.cbsdId) {
        throw new Error('Device not registered with SAS');
      }

      const request: RelinquishmentRequest = {
        cbsdId: device.cbsdId,
        grantId
      };

      console.log('[CBRS Service] Relinquishing grant:', grantId);

      if (device.sasProviderId === 'google' && this.googleClient) {
        await this.googleClient.relinquishGrant(request);
      } else if (device.sasProviderId === 'federated-wireless' && this.federatedClient) {
        await this.federatedClient.relinquishGrant(request);
      }

      // Stop heartbeat
      const heartbeatKey = `${device.id}-${grantId}`;
      if (this.heartbeatIntervals.has(heartbeatKey)) {
        clearInterval(this.heartbeatIntervals.get(heartbeatKey)!);
        this.heartbeatIntervals.delete(heartbeatKey);
      }

      // Update device - remove grant
      const updatedDevice: CBSDDevice = {
        ...device,
        activeGrants: device.activeGrants?.filter(g => g.grantId !== grantId),
        state: (device.activeGrants?.length || 0) > 1 ? 'GRANTED' as CBSDState : 'REGISTERED' as CBSDState,
        updatedAt: new Date()
      };

      this.devices.set(device.id, updatedDevice);
      await this.saveDeviceToFirestore(updatedDevice);

      console.log('[CBRS Service] Grant relinquished successfully');
    } catch (error) {
      console.error('[CBRS Service] Grant relinquishment failed:', error);
      throw error;
    }
  }

  /**
   * Deregister a device
   */
  async deregisterDevice(device: CBSDDevice): Promise<void> {
    try {
      if (!device.cbsdId) {
        throw new Error('Device not registered with SAS');
      }

      const request: DeregistrationRequest = {
        cbsdId: device.cbsdId
      };

      console.log('[CBRS Service] Deregistering device:', device.cbsdId);

      if (device.sasProviderId === 'google' && this.googleClient) {
        await this.googleClient.deregisterDevice(request);
      } else if (device.sasProviderId === 'federated-wireless' && this.federatedClient) {
        await this.federatedClient.deregisterDevice(request);
      }

      // Stop all heartbeats for this device
      device.activeGrants?.forEach(grant => {
        const heartbeatKey = `${device.id}-${grant.grantId}`;
        if (this.heartbeatIntervals.has(heartbeatKey)) {
          clearInterval(this.heartbeatIntervals.get(heartbeatKey)!);
          this.heartbeatIntervals.delete(heartbeatKey);
        }
      });

      // Update device state
      const updatedDevice: CBSDDevice = {
        ...device,
        state: 'DEREGISTERED' as CBSDState,
        cbsdId: undefined,
        activeGrants: [],
        updatedAt: new Date()
      };

      this.devices.set(device.id, updatedDevice);
      await this.saveDeviceToFirestore(updatedDevice);

      console.log('[CBRS Service] Device deregistered successfully');
    } catch (error) {
      console.error('[CBRS Service] Deregistration failed:', error);
      throw error;
    }
  }

  /**
   * Get all devices for current tenant
   */
  async getDevices(): Promise<CBSDDevice[]> {
    try {
      const devices = await this.loadDevicesFromFirestore();
      devices.forEach(device => this.devices.set(device.id, device));
      return devices;
    } catch (error) {
      console.error('[CBRS Service] Failed to load devices:', error);
      return [];
    }
  }

  /**
   * Save device to Firestore
   */
  private async saveDeviceToFirestore(device: CBSDDevice): Promise<void> {
    try {
      // Import Firebase dynamically
      const { db } = await import('$lib/firebase');
      const { doc, setDoc } = await import('firebase/firestore');

      // Call db() as a function to get Firestore instance
      await setDoc(doc(db(), 'cbrs_devices', device.id), {
        ...device,
        createdAt: device.createdAt.toISOString(),
        updatedAt: device.updatedAt.toISOString(),
        registrationTime: device.registrationTime?.toISOString(),
        lastHeartbeatTime: device.lastHeartbeatTime?.toISOString(),
        activeGrants: device.activeGrants?.map(grant => ({
          ...grant,
          grantExpireTime: grant.grantExpireTime.toISOString(),
          lastHeartbeat: grant.lastHeartbeat?.toISOString(),
          transmitExpireTime: grant.transmitExpireTime?.toISOString()
        }))
      });

      console.log('[CBRS Service] Device saved to Firestore:', device.id);
    } catch (error) {
      console.error('[CBRS Service] Failed to save device:', error);
      throw error;
    }
  }

  /**
   * Load devices from Firestore
   */
  private async loadDevicesFromFirestore(): Promise<CBSDDevice[]> {
    try {
      const { db } = await import('$lib/firebase');
      const { collection, query, where, getDocs } = await import('firebase/firestore');

      // Call db() as a function to get Firestore instance
      const devicesRef = collection(db(), 'cbrs_devices');
      const q = query(devicesRef, where('tenantId', '==', this.config.tenantId));
      const snapshot = await getDocs(q);

      const devices: CBSDDevice[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        devices.push({
          ...data,
          id: doc.id,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
          registrationTime: data.registrationTime ? new Date(data.registrationTime) : undefined,
          lastHeartbeatTime: data.lastHeartbeatTime ? new Date(data.lastHeartbeatTime) : undefined,
          activeGrants: data.activeGrants?.map((grant: any) => ({
            ...grant,
            grantExpireTime: new Date(grant.grantExpireTime),
            lastHeartbeat: grant.lastHeartbeat ? new Date(grant.lastHeartbeat) : undefined,
            transmitExpireTime: grant.transmitExpireTime ? new Date(grant.transmitExpireTime) : undefined
          }))
        } as CBSDDevice);
      });

      console.log('[CBRS Service] Loaded', devices.length, 'devices from Firestore');
      return devices;
    } catch (error) {
      console.error('[CBRS Service] Failed to load devices from Firestore:', error);
      return [];
    }
  }

  /**
   * Cleanup - stop all heartbeats
   */
  cleanup() {
    this.heartbeatIntervals.forEach(interval => clearInterval(interval));
    this.heartbeatIntervals.clear();
    console.log('[CBRS Service] Cleanup completed');
  }
}

/**
 * Factory function to create CBRS service
 */
export function createCBRSService(config: CBRSServiceConfig): CBRSService {
  return new CBRSService(config);
}

