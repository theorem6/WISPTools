/**
 * Work Order Service
 * Manages trouble tickets, installations, and field operations
 */

const API_URL = import.meta.env.VITE_HSS_API_URL || 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy';

// Lazy import to avoid circular dependencies and ensure authService is fully initialized
async function getAuthService() {
  const { authService } = await import('$lib/services/authService');
  return authService;
}

export interface WorkOrder {
  _id?: string;
  tenantId: string;
  ticketNumber?: string;
  type: 'installation' | 'repair' | 'maintenance' | 'upgrade' | 'removal' | 'troubleshoot' | 'inspection' | 'other';
  issueCategory?: 'cpe-offline' | 'sector-down' | 'backhaul-failure' | 'network-outage' | 'poor-performance' | 'equipment-failure' | 'power-issue' | 'configuration-error' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'assigned' | 'in-progress' | 'waiting-parts' | 'resolved' | 'closed' | 'cancelled';
  
  assignedTo?: string;
  assignedToName?: string;
  assignedAt?: Date | string;
  
  title: string;
  description?: string;
  symptoms?: string;
  
  affectedEquipment?: Array<{
    equipmentId: string;
    serialNumber: string;
    description: string;
  }>;
  
  affectedSites?: Array<{
    siteId: string;
    siteName: string;
    siteType: string;
  }>;
  
  affectedCustomers?: Array<{
    customerId: string;
    customerName: string;
    phoneNumber?: string;
    serviceAddress?: string;
  }>;
  
  customerReported?: boolean;
  customerContact?: {
    name: string;
    phone?: string;
    email?: string;
  };
  
  location?: {
    type: 'tower' | 'customer' | 'warehouse' | 'noc' | 'other';
    siteId?: string;
    siteName?: string;
    address?: string;
    gpsCoordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  
  scheduledDate?: Date | string;
  scheduledTimeWindow?: string;
  estimatedDuration?: number;
  
  startedAt?: Date | string;
  arrivedAt?: Date | string;
  completedAt?: Date | string;
  closedAt?: Date | string;
  
  sla?: {
    responseTimeHours?: number;
    resolutionTimeHours?: number;
    responseDeadline?: Date | string;
    resolutionDeadline?: Date | string;
    breached?: boolean;
  };
  
  workPerformed?: Array<{
    timestamp: Date | string;
    action: string;
    performedBy: string;
    performedByName: string;
    notes?: string;
    photos?: string[];
    equipmentUsed?: Array<{
      equipmentId: string;
      serialNumber: string;
      action: string;
    }>;
  }>;
  
  partsUsed?: Array<{
    inventoryItemId: string;
    serialNumber: string;
    description: string;
    quantity: number;
    action: string;
  }>;
  
  resolution?: string;
  rootCause?: string;
  preventiveMeasures?: string;
  
  requiresFollowUp?: boolean;
  followUpDate?: Date | string;
  followUpNotes?: string;
  
  photos?: string[];
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    uploadedAt: Date | string;
    uploadedBy: string;
  }>;
  
  customerSignature?: {
    signatureUrl: string;
    signedAt: Date | string;
    customerName: string;
  };
  
  internalNotes?: string;
  customerVisibleNotes?: string;
  
  billable?: boolean;
  laborHours?: number;
  laborRate?: number;
  totalCost?: number;
  invoiced?: boolean;
  
  createdAt?: Date | string;
  createdBy?: string;
  createdByName?: string;
  updatedAt?: Date | string;
  updatedBy?: string;
}

export interface WorkOrderFilters {
  status?: string;
  priority?: string;
  assignedTo?: string;
  type?: string;
  siteId?: string;
}

export interface WorkOrderStats {
  totalOpen: number;
  byStatus: Array<{ _id: string; count: number }>;
  byPriority: Array<{ _id: string; count: number }>;
  byType: Array<{ _id: string; count: number }>;
  avgResolutionTime?: number;
}

class WorkOrderService {
  private async getAuthToken(): Promise<string> {
    // Use authService for consistent token retrieval (lazy import to avoid timing issues)
    const authService = await getAuthService();
    if (!authService || typeof authService.getIdToken !== 'function') {
      throw new Error('AuthService not properly initialized');
    }
    const token = await authService.getIdToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    return token;
  }

  private async apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getAuthToken();
    const tenantId = localStorage.getItem('selectedTenantId');
    
    if (!tenantId) {
      throw new Error('No tenant selected');
    }
    
    const response = await fetch(`${API_URL}/api/work-orders${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId,
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

  // Get all work orders with filters
  async getWorkOrders(filters: WorkOrderFilters = {}): Promise<WorkOrder[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, String(value));
    });
    
    const queryString = params.toString();
    return await this.apiCall(queryString ? `?${queryString}` : '');
  }

  // Get single work order
  async getWorkOrder(id: string): Promise<WorkOrder> {
    return await this.apiCall(`/${id}`);
  }

  // Create work order
  async createWorkOrder(workOrder: Partial<WorkOrder>): Promise<WorkOrder> {
    return await this.apiCall('', {
      method: 'POST',
      body: JSON.stringify(workOrder)
    });
  }

  // Update work order
  async updateWorkOrder(id: string, updates: Partial<WorkOrder>): Promise<WorkOrder> {
    return await this.apiCall(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  // Delete work order
  async deleteWorkOrder(id: string): Promise<void> {
    await this.apiCall(`/${id}`, {
      method: 'DELETE'
    });
  }

  // Assign to technician
  async assignWorkOrder(id: string, userId: string, userName: string): Promise<WorkOrder> {
    return await this.apiCall(`/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ userId, userName })
    });
  }

  // Start work
  async startWork(id: string, userId: string): Promise<WorkOrder> {
    return await this.apiCall(`/${id}/start`, {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  }

  // Add work log entry
  async addWorkLog(id: string, logEntry: any): Promise<WorkOrder> {
    return await this.apiCall(`/${id}/log`, {
      method: 'POST',
      body: JSON.stringify(logEntry)
    });
  }

  // Complete work order
  async completeWorkOrder(id: string, completionData: {
    resolution: string;
    rootCause?: string;
    preventiveMeasures?: string;
  }): Promise<WorkOrder> {
    return await this.apiCall(`/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify(completionData)
    });
  }

  // Close work order
  async closeWorkOrder(id: string): Promise<WorkOrder> {
    return await this.apiCall(`/${id}/close`, {
      method: 'POST'
    });
  }

  // Get assigned tickets for user
  async getAssignedTickets(userId: string): Promise<WorkOrder[]> {
    return await this.apiCall(`/assigned/${userId}`);
  }

  // Get tickets by site
  async getTicketsBySite(siteId: string): Promise<WorkOrder[]> {
    return await this.apiCall(`/site/${siteId}`);
  }

  // Get SLA breached tickets
  async getSLABreachedTickets(): Promise<WorkOrder[]> {
    return await this.apiCall('/alerts/sla-breach');
  }

  // Get statistics
  async getStats(): Promise<WorkOrderStats> {
    return await this.apiCall('/stats/dashboard');
  }
}

export const workOrderService = new WorkOrderService();

