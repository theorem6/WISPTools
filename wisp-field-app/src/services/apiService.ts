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
  // WORK ORDERS
  // ============================================================================

  async getWorkOrders() {
    try {
      const response = await this.client.get('/api/work-orders');
      return response.data;
    } catch (error) {
      console.log('Work orders API not available yet');
      return [];
    }
  }

  async getMyTickets(userId: string) {
    try {
      const response = await this.client.get('/api/work-orders', {
        params: { assignedTo: userId }
      });
      return response.data;
    } catch (error) {
      console.log('Work orders API not available yet');
      return [];
    }
  }

  async getWorkOrder(id: string) {
    try {
      const response = await this.client.get(`/api/work-orders/${id}`);
      return response.data;
    } catch (error) {
      console.log('Work order not found');
      return null;
    }
  }

  async updateWorkOrderStatus(id: string, status: string, notes?: string) {
    const response = await this.client.put(`/api/work-orders/${id}`, {
      status,
      notes
    });
    return response.data;
  }

  async acceptWorkOrder(id: string, userId: string) {
    const response = await this.client.put(`/api/work-orders/${id}`, {
      status: 'assigned',
      assignedTo: userId,
      assignedAt: new Date().toISOString()
    });
    return response.data;
  }

  async addWorkLog(workOrderId: string, log: any) {
    const response = await this.client.post(`/api/work-orders/${workOrderId}/logs`, log);
    return response.data;
  }

  // ============================================================================
  // PLANS API - Role-based plan distribution
  // ============================================================================

  /**
   * Get plans for mobile app user based on their role
   * @param userId - User ID
   * @param role - User role: 'engineer', 'tower-crew', 'installer', 'manager', 'supervisor'
   */
  async getPlans(userId: string, role: string = 'tower-crew') {
    try {
      const response = await this.client.get(`/api/plans/mobile/${userId}`, {
        params: { role }
      });
      return response.data.plans || [];
    } catch (error) {
      console.error('Error fetching plans:', error);
      return [];
    }
  }

  /**
   * Get detailed plan information for mobile app
   * @param userId - User ID
   * @param planId - Plan ID
   * @param role - User role
   */
  async getPlanDetails(userId: string, planId: string, role: string = 'tower-crew') {
    try {
      const response = await this.client.get(`/api/plans/mobile/${userId}/${planId}`, {
        params: { role }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching plan details:', error);
      return null;
    }
  }
}

export const apiService = new APIService();

