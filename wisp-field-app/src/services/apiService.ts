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

  async createWorkOrder(workOrderData: any) {
    try {
      const response = await this.client.post('/api/work-orders', workOrderData);
      return response.data;
    } catch (error) {
      console.error('Error creating work order:', error);
      throw error;
    }
  }

  // ============================================================================
  // INSTALLATION DOCUMENTATION API
  // ============================================================================

  async createInstallationDocumentation(data: any) {
    const response = await this.client.post('/api/installation-documentation', data);
    return response.data;
  }

  async getInstallationDocumentation(id: string) {
    const response = await this.client.get(`/api/installation-documentation/${id}`);
    return response.data;
  }

  async uploadInstallationPhotos(docId: string, photos: any[], photoData: any[]) {
    const formData = new FormData();
    
    photos.forEach((photo, index) => {
      formData.append('photos', {
        uri: photo.uri,
        type: photo.type || 'image/jpeg',
        name: photo.filename || `photo-${Date.now()}-${index}.jpg`
      } as any);
      
      if (photoData[index]?.description) {
        formData.append(`description_${photo.filename || `photo-${index}.jpg`}`, photoData[index].description);
      }
      if (photoData[index]?.category) {
        formData.append(`category_${photo.filename || `photo-${index}.jpg`}`, photoData[index].category);
      }
    });
    
    if (photoData[0]?.location) {
      formData.append('location', JSON.stringify(photoData[0].location));
    }
    
    const response = await this.client.post(
      `/api/installation-documentation/${docId}/photos`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    return response.data;
  }

  async updateInstallationDocumentation(id: string, data: any) {
    const response = await this.client.put(`/api/installation-documentation/${id}`, data);
    return response.data;
  }

  async submitInstallationDocumentation(id: string) {
    const response = await this.client.post(`/api/installation-documentation/${id}/submit`);
    return response.data;
  }

  async getPendingApprovals() {
    const response = await this.client.get('/api/installation-documentation', {
      params: { approvalStatus: 'submitted' }
    });
    return response.data;
  }

  // ============================================================================
  // SUBCONTRACTORS API
  // ============================================================================

  async getSubcontractors() {
    const response = await this.client.get('/api/subcontractors');
    return response.data;
  }

  async getSubcontractor(id: string) {
    const response = await this.client.get(`/api/subcontractors/${id}`);
    return response.data;
  }

  // ============================================================================
  // PLANS API - Role-based plan distribution
  // ============================================================================

  /**
   * Get plans for mobile app user based on their role
   * @param userId - User ID (e.g. Firebase UID)
   * @param role - User role: 'engineer', 'tower-crew', 'installer', 'manager', 'supervisor'
   * @param options.filter - 'assigned-to-me' to return only plans assigned to this user
   */
  async getPlans(userId: string, role: string = 'tower-crew', options?: { filter?: 'assigned-to-me' }) {
    try {
      const params: { role: string; filter?: string } = { role };
      if (options?.filter === 'assigned-to-me') params.filter = 'assigned-to-me';
      const response = await this.client.get(`/api/plans/mobile/${userId}`, { params });
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

  /**
   * Upload plan deployment photo. Backend stores in MongoDB Atlas (GridFS) when possible, Firebase Storage as fallback.
   * @param userId - Current user ID (Firebase UID)
   * @param planId - Plan ID
   * @param fileUri - Local file URI from image picker
   * @param filename - Optional filename
   * @param mimeType - Optional (default image/jpeg)
   * @returns { url, storage: 'mongodb'|'firebase' }
   */
  async uploadPlanDeploymentPhoto(
    userId: string,
    planId: string,
    fileUri: string,
    filename?: string,
    mimeType: string = 'image/jpeg'
  ): Promise<{ url: string; storage: string }> {
    const form = new FormData();
    const name = filename || `photo-${Date.now()}.jpg`;
    form.append('photo', { uri: fileUri, name, type: mimeType } as any);
    const response = await this.client.post(
      `/api/plans/mobile/${userId}/${planId}/deployment/photos`,
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        maxBodyLength: 15 * 1024 * 1024,
        maxContentLength: 15 * 1024 * 1024,
      }
    );
    return response.data;
  }

  /**
   * Update plan deployment progress/docs (stage, notes, photo URLs). Allowed only for assigned techs.
   * @param userId - Current user ID (Firebase UID)
   * @param planId - Plan ID
   * @param body - { deploymentStage?, notes?, documentation?: { notes?, installationPhotos? } }
   */
  async updatePlanDeployment(
    userId: string,
    planId: string,
    body: {
      deploymentStage?: string;
      notes?: string;
      documentation?: { notes?: string; installationPhotos?: string[] };
    }
  ) {
    try {
      const response = await this.client.patch(
        `/api/plans/mobile/${userId}/${planId}/deployment`,
        body
      );
      return response.data;
    } catch (error) {
      console.error('Error updating plan deployment:', error);
      throw error;
    }
  }

  // ============================================================================
  // NOTIFICATIONS API (§4 – project approvals, etc.)
  // ============================================================================

  /**
   * Get user notifications (recent, read and unread). Returns [] when unauthenticated.
   */
  async getNotifications(): Promise<{ id: string; type: string; title: string; message: string; read: boolean; createdAt: string; data?: any }[]> {
    try {
      const response = await this.client.get('/api/notifications');
      return response.data ?? [];
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  /**
   * Get unread notification count.
   */
  async getUnreadNotificationCount(): Promise<number> {
    try {
      const response = await this.client.get('/api/notifications/count');
      return response.data?.count ?? 0;
    } catch (error) {
      console.error('Error fetching notification count:', error);
      return 0;
    }
  }

  /**
   * Mark notification as read.
   */
  async markNotificationRead(id: string): Promise<void> {
    try {
      await this.client.put(`/api/notifications/${id}/read`);
    } catch (error) {
      console.error('Error marking notification read:', error);
      throw error;
    }
  }

  // ============================================================================
  // MOBILE TASKS API - User task permissions
  // ============================================================================

  /**
   * Get allowed tasks for current user
   * @returns Array of allowed task objects
   */
  async getMyTasks() {
    try {
      const response = await this.client.get('/api/mobile/tasks');
      return response.data.tasks || [];
    } catch (error) {
      console.error('Error fetching tasks:', error);
      // Return empty array on error - user will see no tasks
      return [];
    }
  }

  /**
   * Check if user has a specific task permission
   * @param taskId - Task ID (e.g., 'inventory-checkin', 'deploy-network')
   * @returns True if user has permission for this task
   */
  async hasTask(taskId: string): Promise<boolean> {
    try {
      const tasks = await this.getMyTasks();
      return tasks.some((task: any) => task.id === taskId);
    } catch (error) {
      console.error('Error checking task permission:', error);
      return false;
    }
  }

  /**
   * Update CPE aiming data
   * @param cpeId - CPE device ID
   * @param aimingData - Aiming configuration data
   */
  async updateCPEAiming(cpeId: string, aimingData: any) {
    try {
      const response = await this.client.put(`/api/network/cpe/${cpeId}`, {
        aiming: aimingData.aiming
      });
      return response.data;
    } catch (error) {
      console.error('Error updating CPE aiming:', error);
      throw error;
    }
  }
}

export const apiService = new APIService();
