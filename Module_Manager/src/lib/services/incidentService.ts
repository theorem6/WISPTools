/**
 * Incident Service
 * Manages auto-reported incidents from monitoring, app events, or manual reports
 */

import { getApiUrl } from '$lib/config/api';

// API Configuration
const API_URL = getApiUrl();

// Lazy import to avoid circular dependencies
async function getAuthService() {
  const { authService } = await import('$lib/services/authService');
  return authService;
}

export interface Incident {
  _id?: string;
  tenantId: string;
  incidentNumber?: string;
  incidentId?: string;
  
  source: 'monitoring' | 'mobile-app' | 'employee-report' | 'customer-report' | 'system' | 'other';
  sourceDetails?: {
    ruleId?: string;
    ruleName?: string;
    deviceId?: string;
    siteId?: string;
    appUserId?: string;
    appUserName?: string;
    reportedBy?: string;
    reportedByName?: string;
  };
  
  incidentType: 'cpe-offline' | 'sector-down' | 'backhaul-failure' | 'network-outage' | 'equipment-failure' | 'power-outage' | 'performance-degradation' | 'configuration-error' | 'security-breach' | 'fiber-cut' | 'tower-issue' | 'environmental' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'investigating' | 'acknowledged' | 'mitigated' | 'resolved' | 'converted' | 'closed' | 'false-positive';
  
  affectedEquipment?: Array<{
    equipmentId: string;
    serialNumber: string;
    description: string;
    status: string;
  }>;
  
  affectedSites?: Array<{
    siteId: string;
    siteName: string;
    siteType: string;
    impact: string;
  }>;
  
  affectedCustomers?: Array<{
    customerId: string;
    customerName: string;
    phoneNumber?: string;
    serviceAddress?: string;
    impact: string;
  }>;
  
  title: string;
  description?: string;
  initialObservations?: string;
  
  location?: {
    type: 'tower' | 'customer' | 'warehouse' | 'noc' | 'backhaul' | 'other';
    siteId?: string;
    siteName?: string;
    address?: string;
    gpsCoordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  
  incidentMetrics?: {
    timestamp: Date | string;
    values: any;
    snapshot: any;
  };
  
  relatedTicketId?: string;
  relatedTicketNumber?: string;
  convertedAt?: Date | string;
  convertedBy?: string;
  
  investigationNotes?: Array<{
    timestamp: Date | string;
    note: string;
    addedBy: string;
    addedByName: string;
  }>;
  
  rootCause?: string;
  resolution?: string;
  
  detectedAt?: Date | string;
  acknowledgedAt?: Date | string;
  acknowledgedBy?: string;
  acknowledgedByName?: string;
  resolvedAt?: Date | string;
  resolvedBy?: string;
  closedAt?: Date | string;
  
  createdAt?: Date | string;
  createdBy?: string;
  updatedAt?: Date | string;
  updatedBy?: string;
}

export interface IncidentFilters {
  status?: string;
  severity?: string;
  incidentType?: string;
  source?: string;
  siteId?: string;
  converted?: boolean;
}

export interface IncidentStats {
  active: number;
  critical: number;
  bySeverity: Array<{ _id: string; count: number }>;
  byType: Array<{ _id: string; count: number }>;
}

class IncidentService {
  private async getAuthToken(): Promise<string> {
    const authService = await getAuthService();
    if (!authService || typeof authService.getIdToken !== 'function') {
      throw new Error('AuthService not properly initialized');
    }
    const token = await authService.getAuthTokenForApi();
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
    
    // Use relative URL (goes through Firebase Hosting rewrite to apiProxy)
    const apiPath = API_URL.replace('/api/maintain', '/api/incidents');
    const response = await fetch(`${apiPath}${endpoint}`, {
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

  // Get all incidents with filters
  async getIncidents(filters: IncidentFilters = {}): Promise<Incident[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    
    const queryString = params.toString();
    return await this.apiCall(queryString ? `?${queryString}` : '');
  }

  // Get single incident
  async getIncident(id: string): Promise<Incident> {
    return await this.apiCall(`/${id}`);
  }

  // Create incident
  async createIncident(incident: Partial<Incident>): Promise<Incident> {
    return await this.apiCall('', {
      method: 'POST',
      body: JSON.stringify(incident)
    });
  }

  // Update incident
  async updateIncident(id: string, updates: Partial<Incident>): Promise<Incident> {
    return await this.apiCall(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  // Acknowledge incident
  async acknowledgeIncident(id: string, userId: string, userName: string): Promise<Incident> {
    return await this.apiCall(`/${id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ userId, userName })
    });
  }

  // Convert incident to ticket
  async convertToTicket(
    id: string, 
    options: {
      priority?: 'low' | 'medium' | 'high' | 'critical';
      assignedTo?: string;
      assignedToName?: string;
      title?: string;
      description?: string;
      userId?: string;
    }
  ): Promise<{ incident: Incident; ticket: any }> {
    return await this.apiCall(`/${id}/convert-to-ticket`, {
      method: 'POST',
      body: JSON.stringify(options)
    });
  }

  // Resolve incident
  async resolveIncident(id: string, resolution: string, userId: string): Promise<Incident> {
    return await this.apiCall(`/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution, userId })
    });
  }

  // Close incident
  async closeIncident(id: string): Promise<Incident> {
    return await this.apiCall(`/${id}/close`, {
      method: 'POST'
    });
  }

  // Add investigation note
  async addInvestigationNote(
    id: string, 
    note: string, 
    userId: string, 
    userName: string
  ): Promise<Incident> {
    return await this.apiCall(`/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note, userId, userName })
    });
  }

  // Get incident statistics
  async getStats(): Promise<IncidentStats> {
    return await this.apiCall('/stats/dashboard');
  }
}

export const incidentService = new IncidentService();
