/**
 * API Service for Mobile App
 * Connects to existing backend APIs via hssProxy
 */

import axios, { AxiosInstance } from 'axios';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/firebase';

class APIService {
  private client: AxiosInstance;
  private tenantId: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor - add auth token and tenant ID
    this.client.interceptors.request.use(async (config) => {
      try {
        // Get Firebase auth token
        const user = auth().currentUser;
        if (user) {
          const token = await user.getIdToken();
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Get tenant ID from storage
        if (!this.tenantId) {
          this.tenantId = await AsyncStorage.getItem('selectedTenantId');
        }
        
        if (this.tenantId) {
          config.headers['X-Tenant-ID'] = this.tenantId;
        }

        return config;
      } catch (error) {
        console.error('Request interceptor error:', error);
        return config;
      }
    });

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Unauthorized - logout
          console.log('Unauthorized - logging out');
        }
        return Promise.reject(error);
      }
    );
  }

  // Set tenant ID
  async setTenantId(tenantId: string) {
    this.tenantId = tenantId;
    await AsyncStorage.setItem('selectedTenantId', tenantId);
  }

  // ============================================================================
  // INVENTORY API
  // ============================================================================

  async getInventoryItems(search?: string) {
    const params = search ? { search } : {};
    const response = await this.client.get('/api/inventory', { params });
    return response.data.items;
  }

  async getInventoryItem(id: string) {
    const response = await this.client.get(`/api/inventory/${id}`);
    return response.data;
  }

  async updateInventoryStatus(id: string, status: string) {
    const response = await this.client.put(`/api/inventory/${id}`, { status });
    return response.data;
  }

  async deployEquipment(id: string, deploymentInfo: any) {
    const response = await this.client.post(`/api/inventory/${id}/deploy`, deploymentInfo);
    return response.data;
  }

  async transferEquipment(id: string, transferData: any) {
    const response = await this.client.post(`/api/inventory/${id}/transfer`, transferData);
    return response.data;
  }

  async addMaintenanceRecord(id: string, maintenanceData: any) {
    const response = await this.client.post(`/api/inventory/${id}/maintenance`, maintenanceData);
    return response.data;
  }

  // ============================================================================
  // COVERAGE MAP / NETWORK API
  // ============================================================================

  async getSites() {
    const response = await this.client.get('/api/network/sites');
    return response.data;
  }

  async getSite(id: string) {
    const response = await this.client.get(`/api/network/sites/${id}`);
    return response.data;
  }

  async getSectors(siteId?: string) {
    const params = siteId ? { siteId } : {};
    const response = await this.client.get('/api/network/sectors', { params });
    return response.data;
  }

  async getCPEDevices() {
    const response = await this.client.get('/api/network/cpe');
    return response.data;
  }

  async getEquipmentAtSite(siteId: string) {
    const response = await this.client.get(`/api/inventory/by-site/${siteId}`);
    return response.data;
  }

  // ============================================================================
  // VEHICLE INVENTORY
  // ============================================================================

  async getVehicleInventory(vehicleId: string) {
    const response = await this.client.get(`/api/inventory/by-location/vehicle?locationId=${vehicleId}`);
    return response.data;
  }

  // ============================================================================
  // WORK ORDERS (Future)
  // ============================================================================

  async getWorkOrders() {
    // TODO: Implement work order API
    return [];
  }
}

export const apiService = new APIService();

