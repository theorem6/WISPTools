/**
 * Mikrotik Management Service
 * Frontend service for interacting with Mikrotik RouterOS API
 */

import { API_CONFIG } from '$lib/config/api';

export interface MikrotikDevice {
  deviceId: string;
  tenantId: string;
  ipAddress: string;
  username: string;
  deviceType: 'router' | 'switch' | 'ap' | 'cpe' | 'lte';
  identity?: {
    name: string;
    comment: string;
  };
  systemInfo?: {
    version: string;
    architecture: string;
    boardName: string;
    model: string;
    serialNumber: string;
    uptime: string;
    cpuLoad: number;
    freeMemory: number;
    totalMemory: number;
  };
  status: 'online' | 'offline' | 'error';
  lastSeen?: Date;
  monitoringEnabled: boolean;
}

export interface MikrotikConfig {
  enabled: boolean;
  deviceType: string;
  ipAddress: string;
  username: string;
  password: string;
  port: number;
  useSSL: boolean;
  enableAPI: boolean;
  enableSNMP: boolean;
  enableWinbox: boolean;
  enableSSH: boolean;
  snmpCommunity: string;
  snmpLocation: string;
  snmpContact: string;
  wirelessConfig?: {
    enabled: boolean;
    mode: string;
    ssid: string;
    frequency: string;
    band: string;
    security: string;
    passphrase: string;
    countryCode: string;
    txPower: number;
  };
  lteConfig?: {
    enabled: boolean;
    apn: string;
    username: string;
    password: string;
    pinCode: string;
    allowRoaming: boolean;
  };
  networkConfig: {
    dhcpClient: boolean;
    staticIP: boolean;
    ipAddress: string;
    netmask: string;
    gateway: string;
    dns1: string;
    dns2: string;
  };
  monitoringConfig: {
    enableNetwatch: boolean;
    netwatchHosts: string[];
    enableHealthCheck: boolean;
    enableTrafficMonitoring: boolean;
    pollingInterval: number;
  };
  securityConfig: {
    changeDefaultPassword: boolean;
    disableDefaultServices: boolean;
    enableFirewall: boolean;
    allowedNetworks: string[];
    enableMacTelnet: boolean;
    enableNeighborDiscovery: boolean;
  };
}

export interface WirelessClient {
  macAddress: string;
  interface: string;
  signalStrength: number;
  txRate: string;
  rxRate: string;
  uptime: string;
  txBytes: number;
  rxBytes: number;
  txPackets: number;
  rxPackets: number;
}

export interface InterfaceStats {
  name: string;
  type: string;
  running: boolean;
  disabled: boolean;
  mtu: number;
  rxBytesPerSecond: number;
  txBytesPerSecond: number;
  rxPacketsPerSecond: number;
  txPacketsPerSecond: number;
}

export interface SystemResources {
  uptime: string;
  version: string;
  architecture: string;
  boardName: string;
  cpuLoad: number;
  freeMemory: number;
  totalMemory: number;
  freeHddSpace: number;
  totalHddSpace: number;
  cpuTemperature: number;
  voltage: number;
}

class MikrotikService {
  private baseUrl = API_CONFIG.PATHS.MIKROTIK || '/api/mikrotik';

  /**
   * Get authentication headers
   */
  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = localStorage.getItem('authToken');
    const tenantId = localStorage.getItem('selectedTenantId');
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-tenant-id': tenantId || ''
    };
  }

  /**
   * Register Mikrotik device for management
   */
  async registerDevice(config: MikrotikConfig): Promise<{ success: boolean; device: any }> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/register-device`, {
      method: 'POST',
      headers,
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to register device');
    }

    return response.json();
  }

  /**
   * Register device for SNMP monitoring
   */
  async registerSNMP(config: any): Promise<{ success: boolean; deviceId: string }> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/register-snmp`, {
      method: 'POST',
      headers,
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to register SNMP monitoring');
    }

    return response.json();
  }

  /**
   * Test connection to Mikrotik device
   */
  async testConnection(connectionConfig: {
    ipAddress: string;
    username: string;
    password: string;
    port?: number;
    useSSL?: boolean;
  }): Promise<{ success: boolean; identity?: any; systemInfo?: any; error?: string }> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/test-connection`, {
      method: 'POST',
      headers,
      body: JSON.stringify(connectionConfig)
    });

    return response.json();
  }

  /**
   * Get all Mikrotik devices for current tenant
   */
  async getDevices(): Promise<MikrotikDevice[]> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/devices`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error('Failed to fetch devices');
    }

    const data = await response.json();
    return data.devices;
  }

  /**
   * Get specific device status
   */
  async getDevice(deviceId: string): Promise<MikrotikDevice> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error('Failed to fetch device');
    }

    return response.json();
  }

  /**
   * Execute RouterOS command on device
   */
  async executeCommand(deviceId: string, command: string, params: any = {}): Promise<any> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}/execute`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ command, params })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Command execution failed');
    }

    return response.json();
  }

  /**
   * Apply configuration template to device
   */
  async applyConfiguration(deviceId: string, configTemplate: any): Promise<any> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}/configure`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ configTemplate })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Configuration failed');
    }

    return response.json();
  }

  /**
   * Backup device configuration
   */
  async backupConfiguration(deviceId: string): Promise<any> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}/backup`, {
      method: 'POST',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Backup failed');
    }

    return response.json();
  }

  /**
   * Get wireless clients for device
   */
  async getWirelessClients(deviceId: string): Promise<WirelessClient[]> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}/wireless-clients`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error('Failed to get wireless clients');
    }

    const data = await response.json();
    return data.clients;
  }

  /**
   * Get interface statistics
   */
  async getInterfaces(deviceId: string): Promise<InterfaceStats[]> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}/interfaces`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error('Failed to get interfaces');
    }

    const data = await response.json();
    return data.interfaces;
  }

  /**
   * Get system resources
   */
  async getSystemResources(deviceId: string): Promise<SystemResources> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}/resources`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error('Failed to get system resources');
    }

    const data = await response.json();
    return data.resources;
  }

  /**
   * Get DHCP leases
   */
  async getDHCPLeases(deviceId: string): Promise<any[]> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}/dhcp-leases`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error('Failed to get DHCP leases');
    }

    const data = await response.json();
    return data.leases;
  }

  /**
   * Get queue statistics
   */
  async getQueues(deviceId: string): Promise<any[]> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}/queues`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error('Failed to get queues');
    }

    const data = await response.json();
    return data.queues;
  }

  /**
   * Get available SNMP OIDs for device type
   */
  async getSNMPOIDs(deviceType: string = 'router'): Promise<any[]> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/snmp-oids?deviceType=${deviceType}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error('Failed to get SNMP OIDs');
    }

    const data = await response.json();
    return data.oids;
  }

  /**
   * Unregister device
   */
  async unregisterDevice(deviceId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}`, {
      method: 'DELETE',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to unregister device');
    }
  }
}

export const mikrotikService = new MikrotikService();
