/**
 * Incident Creation Service
 * Automatically creates incidents from monitoring alerts, app events, or system events
 */

const { Incident } = require('../models/incident');
const { WorkOrder } = require('../models/work-order');
const { UnifiedSite, UnifiedCPE } = require('../models/network');
const { Customer } = require('../models/customer');

class IncidentCreationService {
  /**
   * Create incident from monitoring alert
   */
  async createFromMonitoringAlert(alert, rule, device) {
    try {
      const tenantId = alert.tenant_id || rule.tenant_id;
      
      // Determine incident type based on rule/metric
      const incidentType = this.mapAlertToIncidentType(rule, alert);
      
      // Determine severity from alert severity
      const severity = this.mapAlertSeverity(alert.severity);
      
      // Get affected resources
      const affectedResources = await this.getAffectedResources(
        tenantId, 
        device, 
        incidentType
      );
      
      // Create incident
      const incident = new Incident({
        tenantId,
        source: 'monitoring',
        sourceDetails: {
          ruleId: rule.rule_id,
          ruleName: rule.name,
          deviceId: device?._id?.toString() || device?.id,
          siteId: device?.siteId?.toString() || device?.site_id
        },
        incidentType,
        severity,
        status: 'new',
        title: alert.message || rule.name,
        description: this.formatIncidentDescription(alert, rule, device),
        initialObservations: `Alert triggered: ${alert.message}\nMetric: ${alert.metric_name}\nCurrent Value: ${alert.current_value}\nThreshold: ${alert.threshold}`,
        affectedEquipment: affectedResources.equipment,
        affectedSites: affectedResources.sites,
        affectedCustomers: affectedResources.customers,
        location: this.getLocationFromDevice(device),
        incidentMetrics: {
          timestamp: alert.first_triggered || new Date(),
          values: {
            metric_name: alert.metric_name,
            current_value: alert.current_value,
            threshold: alert.threshold,
            operator: alert.operator
          },
          snapshot: {
            device_status: device?.status,
            device_type: device?.type,
            device_name: device?.name
          }
        },
        detectedAt: alert.first_triggered || new Date(),
        createdAt: new Date()
      });
      
      await incident.save();
      console.log(`[IncidentCreation] Created incident ${incident.incidentNumber} from alert ${alert.alert_id}`);
      
      // Optionally auto-convert critical incidents to tickets
      if (severity === 'critical' && rule.auto_create_ticket !== false) {
        await this.autoConvertToTicket(incident, tenantId);
      }
      
      return incident;
    } catch (error) {
      console.error('[IncidentCreation] Error creating incident from alert:', error);
      throw error;
    }
  }
  
  /**
   * Create incident from mobile app event
   */
  async createFromAppEvent(eventData, appUser) {
    try {
      const { tenantId, incidentType, title, description, location, deviceId, siteId, severity } = eventData;
      
      const affectedResources = await this.getAffectedResources(
        tenantId,
        { _id: deviceId, siteId },
        incidentType
      );
      
      const incident = new Incident({
        tenantId,
        source: 'mobile-app',
        sourceDetails: {
          appUserId: appUser.userId,
          appUserName: appUser.userName,
          deviceId,
          siteId
        },
        incidentType: incidentType || 'other',
        severity: severity || 'medium',
        status: 'new',
        title: title || 'App-Reported Incident',
        description,
        initialObservations: description,
        affectedEquipment: affectedResources.equipment,
        affectedSites: affectedResources.sites,
        affectedCustomers: affectedResources.customers,
        location: location ? {
          type: location.type || 'other',
          siteId: location.siteId,
          siteName: location.siteName,
          address: location.address,
          gpsCoordinates: location.gpsCoordinates
        } : undefined,
        detectedAt: new Date(),
        createdAt: new Date()
      });
      
      await incident.save();
      console.log(`[IncidentCreation] Created incident ${incident.incidentNumber} from app event`);
      
      return incident;
    } catch (error) {
      console.error('[IncidentCreation] Error creating incident from app event:', error);
      throw error;
    }
  }
  
  /**
   * Create incident from employee report
   */
  async createFromEmployeeReport(reportData, employee) {
    try {
      const { tenantId, incidentType, title, description, location, severity, affectedSites, affectedCustomers } = reportData;
      
      const incident = new Incident({
        tenantId,
        source: 'employee-report',
        sourceDetails: {
          reportedBy: employee.userId,
          reportedByName: employee.userName
        },
        incidentType: incidentType || 'other',
        severity: severity || 'medium',
        status: 'new',
        title: title || 'Employee-Reported Incident',
        description,
        initialObservations: description,
        affectedSites: affectedSites || [],
        affectedCustomers: affectedCustomers || [],
        location,
        detectedAt: new Date(),
        createdAt: new Date()
      });
      
      await incident.save();
      console.log(`[IncidentCreation] Created incident ${incident.incidentNumber} from employee report`);
      
      return incident;
    } catch (error) {
      console.error('[IncidentCreation] Error creating incident from employee report:', error);
      throw error;
    }
  }
  
  /**
   * Map alert to incident type
   */
  mapAlertToIncidentType(rule, alert) {
    const metricName = (alert.metric_name || rule.metric_name || '').toLowerCase();
    const ruleName = (rule.name || '').toLowerCase();
    
    // Map based on metric name
    if (metricName.includes('ping') || metricName.includes('connectivity')) {
      return 'cpe-offline';
    }
    if (metricName.includes('sector') || ruleName.includes('sector')) {
      return 'sector-down';
    }
    if (metricName.includes('backhaul') || ruleName.includes('backhaul')) {
      return 'backhaul-failure';
    }
    if (metricName.includes('network') || ruleName.includes('network')) {
      return 'network-outage';
    }
    if (metricName.includes('equipment') || metricName.includes('hardware')) {
      return 'equipment-failure';
    }
    if (metricName.includes('power')) {
      return 'power-outage';
    }
    if (metricName.includes('performance') || metricName.includes('throughput')) {
      return 'performance-degradation';
    }
    if (metricName.includes('config')) {
      return 'configuration-error';
    }
    
    return 'other';
  }
  
  /**
   * Map alert severity to incident severity
   */
  mapAlertSeverity(alertSeverity) {
    const severityMap = {
      'critical': 'critical',
      'high': 'high',
      'warning': 'medium',
      'medium': 'medium',
      'low': 'low',
      'info': 'low'
    };
    
    return severityMap[alertSeverity?.toLowerCase()] || 'medium';
  }
  
  /**
   * Get affected resources from device/site
   */
  async getAffectedResources(tenantId, device, incidentType) {
    const resources = {
      equipment: [],
      sites: [],
      customers: []
    };
    
    try {
      // Add affected equipment
      if (device?._id || device?.id) {
        const deviceId = device._id?.toString() || device.id;
        resources.equipment.push({
          equipmentId: deviceId,
          serialNumber: device.serialNumber || '',
          description: device.name || device.type || 'Unknown device',
          status: 'offline'
        });
      }
      
      // Add affected site
      if (device?.siteId) {
        const siteId = typeof device.siteId === 'object' 
          ? device.siteId._id?.toString() || device.siteId.toString()
          : device.siteId.toString();
          
        const site = await UnifiedSite.findOne({ _id: siteId, tenantId }).lean();
        if (site) {
          resources.sites.push({
            siteId: site._id.toString(),
            siteName: site.name,
            siteType: site.type || 'tower',
            impact: incidentType === 'sector-down' ? 'degraded' : 'down'
          });
        }
      }
      
      // For CPE offline, find affected customers
      if (incidentType === 'cpe-offline' && device?._id) {
        const cpe = await UnifiedCPE.findOne({ _id: device._id, tenantId }).lean();
        if (cpe?.customerId) {
          const customer = await Customer.findOne({ 
            customerId: cpe.customerId, 
            tenantId 
          }).lean();
          
          if (customer) {
            resources.customers.push({
              customerId: customer.customerId,
              customerName: customer.fullName || `${customer.firstName} ${customer.lastName}`,
              phoneNumber: customer.primaryPhone,
              serviceAddress: customer.serviceAddress?.street 
                ? `${customer.serviceAddress.street}, ${customer.serviceAddress.city}, ${customer.serviceAddress.state}`
                : undefined,
              impact: 'outage'
            });
          }
        }
      }
    } catch (error) {
      console.error('[IncidentCreation] Error getting affected resources:', error);
    }
    
    return resources;
  }
  
  /**
   * Get location from device
   */
  getLocationFromDevice(device) {
    if (!device) return undefined;
    
    const location = device.location || {};
    const siteId = device.siteId?.toString() || device.site_id;
    
    return {
      type: siteId ? 'tower' : 'customer',
      siteId,
      siteName: device.siteName,
      address: location.address,
      gpsCoordinates: location.coordinates ? {
        latitude: location.coordinates.latitude || 0,
        longitude: location.coordinates.longitude || 0
      } : location.latitude && location.longitude ? {
        latitude: location.latitude,
        longitude: location.longitude
      } : undefined
    };
  }
  
  /**
   * Format incident description from alert
   */
  formatIncidentDescription(alert, rule, device) {
    let description = `Alert: ${alert.message || rule.name}\n`;
    description += `Metric: ${alert.metric_name}\n`;
    description += `Current Value: ${alert.current_value}\n`;
    description += `Threshold: ${alert.threshold}\n`;
    
    if (device) {
      description += `Device: ${device.name || device.type || 'Unknown'}\n`;
      if (device.siteId) {
        description += `Site ID: ${device.siteId}\n`;
      }
    }
    
    return description;
  }
  
  /**
   * Auto-convert critical incident to ticket
   */
  async autoConvertToTicket(incident, tenantId) {
    try {
      const ticketCount = await WorkOrder.countDocuments({ tenantId });
      const ticketNumber = `TKT-${new Date().getFullYear()}-${String(ticketCount + 1).padStart(4, '0')}`;
      
      const typeMap = {
        'cpe-offline': 'troubleshoot',
        'sector-down': 'repair',
        'backhaul-failure': 'repair',
        'network-outage': 'troubleshoot',
        'equipment-failure': 'repair',
        'power-outage': 'repair',
        'performance-degradation': 'troubleshoot',
        'configuration-error': 'repair',
        'other': 'troubleshoot'
      };
      
      const workOrderType = typeMap[incident.incidentType] || 'troubleshoot';
      const ticketCategory = 'infrastructure';
      
      const workOrder = new WorkOrder({
        tenantId,
        ticketNumber,
        type: workOrderType,
        ticketCategory,
        issueCategory: incident.incidentType,
        priority: incident.severity,
        status: 'open',
        title: incident.title,
        description: incident.description || incident.initialObservations,
        affectedEquipment: incident.affectedEquipment,
        affectedSites: incident.affectedSites,
        affectedCustomers: incident.affectedCustomers,
        location: incident.location,
        internalNotes: `Auto-created from incident ${incident.incidentNumber}\nSource: ${incident.source}\nDetected: ${incident.detectedAt}`,
        createdAt: new Date()
      });
      
      await workOrder.save();
      
      // Update incident
      incident.status = 'converted';
      incident.relatedTicketId = workOrder._id.toString();
      incident.relatedTicketNumber = ticketNumber;
      incident.convertedAt = new Date();
      incident.convertedBy = 'system';
      await incident.save();
      
      console.log(`[IncidentCreation] Auto-converted incident ${incident.incidentNumber} to ticket ${ticketNumber}`);
      
      return { incident, ticket: workOrder };
    } catch (error) {
      console.error('[IncidentCreation] Error auto-converting to ticket:', error);
      throw error;
    }
  }
}

module.exports = new IncidentCreationService();
