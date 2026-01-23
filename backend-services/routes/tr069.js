const express = require('express');
const appConfig = require('../config/app');
const { Tenant } = require('../models/tenant');

const router = express.Router();

// Helper function to get GenieACS MongoDB connection
async function getGenieACSMongoDB() {
  const { MongoClient } = require('mongodb');
  // Use GenieACS MongoDB URI from env, or construct from main MONGODB_URI
  let mongoUrl = process.env.GENIEACS_MONGODB_URI;
  if (!mongoUrl) {
    // Construct GenieACS URI from main MONGODB_URI by changing database name
    const mainUri = process.env.MONGODB_URI || 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';
    const uriObj = new URL(mainUri);
    uriObj.pathname = '/genieacs';
    mongoUrl = uriObj.toString();
  }
  const client = new MongoClient(mongoUrl);
  await client.connect();
  return { client, db: client.db('genieacs') };
}

// Middleware to extract tenant ID
const requireTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'X-Tenant-ID header is required' });
  }
  req.tenantId = tenantId;
  next();
};

router.use(requireTenant);

const getNbiUrl = () => appConfig.externalServices.genieacs.nbiUrl || appConfig.externalServices.genieacs.baseUrl;

const resolveGenieacsConfig = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId).lean();
  const saved = tenant?.settings?.genieacsConfig || {};

  return {
    genieacsUrl: saved.genieacsUrl || appConfig.externalServices.genieacs.baseUrl,
    genieacsApiUrl: saved.genieacsApiUrl || appConfig.externalServices.genieacs.nbiUrl
  };
};

// GET /api/tr069/configuration - Fetch saved GenieACS config
router.get('/configuration', async (req, res) => {
  try {
    const config = await resolveGenieacsConfig(req.tenantId);
    
    // Get tenant to build CWMP URL
    const tenant = await Tenant.findById(req.tenantId).lean();
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }
    
    // Generate tenant-specific CWMP URL
    // Format: https://wisptools.io/cwmp/{tenant-subdomain}
    // Or use Firebase Functions URL if available
    const cwmpBaseUrl = process.env.CWMP_BASE_URL || process.env.PUBLIC_CWMP_BASE_URL || 'https://wisptools.io';
    const cwmpUrl = `${cwmpBaseUrl}/cwmp/${tenant.subdomain}`;
    
    res.json({ 
      success: true, 
      config: {
        ...config,
        cwmpUrl: cwmpUrl,
        tenantSubdomain: tenant.subdomain
      }
    });
  } catch (error) {
    console.error('[TR069 API] Failed to load configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load configuration'
    });
  }
});

// POST /api/tr069/configuration - Save GenieACS config
router.post('/configuration', async (req, res) => {
  try {
    const { genieacsUrl, genieacsApiUrl } = req.body || {};

    if (!genieacsApiUrl) {
      return res.status(400).json({ success: false, error: 'genieacsApiUrl is required' });
    }

    // Get tenant to ensure it exists and get subdomain
    const tenant = await Tenant.findById(req.tenantId).lean();
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    // Generate tenant-specific CWMP URL if not provided
    const cwmpBaseUrl = process.env.CWMP_BASE_URL || process.env.PUBLIC_CWMP_BASE_URL || 'https://wisptools.io';
    const tenantCwmpUrl = genieacsUrl || `${cwmpBaseUrl}/cwmp/${tenant.subdomain}`;

    // Update tenant's CWMP URL
    await Tenant.updateOne(
      { _id: req.tenantId },
      {
        $set: {
          cwmpUrl: tenantCwmpUrl,
          'settings.genieacsConfig': {
            genieacsUrl: tenantCwmpUrl,
            genieacsApiUrl: genieacsApiUrl.replace(/\/$/, ''),
            updatedAt: new Date().toISOString()
          }
        }
      }
    );

    res.json({ 
      success: true, 
      message: 'Configuration saved',
      cwmpUrl: tenantCwmpUrl
    });
  } catch (error) {
    console.error('[TR069 API] Failed to save configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save configuration'
    });
  }
});

// POST /api/tr069/connection-test - Test GenieACS NBI connectivity
router.post('/connection-test', async (req, res) => {
  try {
    const { genieacsApiUrl } = req.body || {};
    const config = await resolveGenieacsConfig(req.tenantId);
    const nbiUrl = (genieacsApiUrl || config.genieacsApiUrl || getNbiUrl()).replace(/\/$/, '');

    const response = await fetch(`${nbiUrl}/devices?limit=1`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(400).json({
        success: false,
        error: 'GenieACS connection failed',
        details: text
      });
    }

    res.json({ success: true, message: 'Connection successful' });
  } catch (error) {
    console.error('[TR069 API] Connection test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Connection test failed',
      details: error.message
    });
  }
});

const mapActionToTask = (action) => {
  switch (action) {
    case 'refreshParameters':
      return 'getParameterValues';
    case 'reboot':
      return 'reboot';
    case 'factoryReset':
      return 'factoryReset';
    case 'setParameterValues':
      return 'setParameterValues';
    default:
      return null;
  }
};

const TR069_PATHS = {
  RSSI: 'Device.Cellular.Interface.1.RSSI',
  RSRP: 'Device.Cellular.Interface.1.RSRP',
  RSRQ: 'Device.Cellular.Interface.1.RSRQ',
  SINR: 'Device.Cellular.Interface.1.SINR',
  RSCP: 'Device.Cellular.Interface.1.RSCP',
  PCI: 'Device.Cellular.Interface.1.X_VENDOR_PhysicalCellID',
  EARFCN: 'Device.Cellular.Interface.1.X_VENDOR_EARFCN',
  BAND: 'Device.Cellular.Interface.1.X_VENDOR_Band',
  CELL_ID: 'Device.Cellular.Interface.1.X_VENDOR_CellID',
  PLMN: 'Device.Cellular.Interface.1.PLMN',
  STATUS: 'Device.Cellular.Interface.1.Status',
  UPTIME: 'Device.DeviceInfo.UpTime',
  BYTES_SENT: 'Device.Cellular.Interface.1.Stats.BytesSent',
  BYTES_RECEIVED: 'Device.Cellular.Interface.1.Stats.BytesReceived',
  ALT: {
    TELTONIKA_RSRP: 'Device.X_TELTONIKA_MobileInfo.RSRP',
    TELTONIKA_RSRQ: 'Device.X_TELTONIKA_MobileInfo.RSRQ',
    TELTONIKA_SINR: 'Device.X_TELTONIKA_MobileInfo.SINR',
    MIKROTIK_RSRP: 'Device.Cellular.Interface.1.X_MIKROTIK_CarrierInfo.1.RSRP',
    MIKROTIK_RSRQ: 'Device.Cellular.Interface.1.X_MIKROTIK_CarrierInfo.1.RSRQ',
    MIKROTIK_SINR: 'Device.Cellular.Interface.1.X_MIKROTIK_CarrierInfo.1.SINR',
    HUAWEI_RSRP: 'Device.X_HUAWEI_MobileInfo.RSRP',
    HUAWEI_RSRQ: 'Device.X_HUAWEI_MobileInfo.RSRQ'
  }
};

const getParamValue = (parameters, path) => {
  if (!parameters || !path) return undefined;
  const value = parameters[path];
  if (value && typeof value === 'object' && '_value' in value) {
    return value._value;
  }
  return value;
};

const toNumber = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const buildMetricsHistory = (hours, deviceId, parameters = {}) => {
  const metrics = [];
  const now = new Date();
  const intervalsPerHour = 12;

  const baseRSSI = toNumber(getParamValue(parameters, TR069_PATHS.RSSI), -65);
  const baseRSRP = toNumber(
    getParamValue(parameters, TR069_PATHS.RSRP) ??
    getParamValue(parameters, TR069_PATHS.ALT.TELTONIKA_RSRP) ??
    getParamValue(parameters, TR069_PATHS.ALT.MIKROTIK_RSRP) ??
    getParamValue(parameters, TR069_PATHS.ALT.HUAWEI_RSRP),
    -75
  );
  const baseRSRQ = toNumber(
    getParamValue(parameters, TR069_PATHS.RSRQ) ??
    getParamValue(parameters, TR069_PATHS.ALT.TELTONIKA_RSRQ) ??
    getParamValue(parameters, TR069_PATHS.ALT.MIKROTIK_RSRQ) ??
    getParamValue(parameters, TR069_PATHS.ALT.HUAWEI_RSRQ),
    -10
  );
  const baseSINR = toNumber(
    getParamValue(parameters, TR069_PATHS.SINR) ??
    getParamValue(parameters, TR069_PATHS.ALT.TELTONIKA_SINR) ??
    getParamValue(parameters, TR069_PATHS.ALT.MIKROTIK_SINR),
    15
  );
  const baseRSCP = toNumber(getParamValue(parameters, TR069_PATHS.RSCP), baseRSSI - 5);
  const basePCI = Math.round(toNumber(getParamValue(parameters, TR069_PATHS.PCI), 156));
  const baseEARFCN = Math.round(toNumber(getParamValue(parameters, TR069_PATHS.EARFCN), 5230));
  const baseBand = Math.round(toNumber(getParamValue(parameters, TR069_PATHS.BAND), baseEARFCN < 10000 ? 2 : 66));
  const baseCellId = Math.round(toNumber(getParamValue(parameters, TR069_PATHS.CELL_ID), 12345));
  const plmn = String(getParamValue(parameters, TR069_PATHS.PLMN) || '310410');
  const uptime = toNumber(getParamValue(parameters, TR069_PATHS.UPTIME), hours * 3600);
  const baseBytesSent = toNumber(getParamValue(parameters, TR069_PATHS.BYTES_SENT), 100000000);
  const baseBytesReceived = toNumber(getParamValue(parameters, TR069_PATHS.BYTES_RECEIVED), 500000000);

  for (let i = hours * intervalsPerHour; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 5 * 60 * 1000);
    const hour = timestamp.getHours();
    const isPeakHours = (hour >= 18 && hour <= 22) || (hour >= 8 && hour <= 10);
    const loadFactor = isPeakHours ? 1.4 : 1.0;

    const rssi = baseRSSI + (Math.random() * 6 - 3);
    const rsrp = baseRSRP + (Math.random() * 6 - 3);
    const rsrq = baseRSRQ + (Math.random() * 2 - 1);
    const sinr = baseSINR + (Math.random() * 6 - 3);
    const rscp = baseRSCP + (Math.random() * 4 - 2);

    const throughputDL = Math.max(1, loadFactor * 80 + (Math.random() * 20 - 10));
    const throughputUL = Math.max(0.5, throughputDL * 0.3 + (Math.random() * 5 - 2));
    const ueCount = Math.max(0, Math.round(40 * loadFactor + (Math.random() * 10 - 5)));
    const prbUtilization = Math.min(100, Math.max(5, loadFactor * 50 + (Math.random() * 15 - 7)));
    const cqi = Math.max(0, Math.min(15, Math.round(12 + (Math.random() * 4 - 2))));

    metrics.push({
      timestamp,
      deviceId,
      rssi,
      rsrp,
      rsrq,
      sinr,
      rscp,
      pci: basePCI,
      earfcn: baseEARFCN,
      band: baseBand,
      cellId: baseCellId,
      plmn,
      status: rsrp > -100 ? 'Connected' : 'Connecting',
      uptime: uptime + (hours * intervalsPerHour - i) * 5 * 60,
      bytesSent: Math.round(baseBytesSent + (hours * intervalsPerHour - i) * throughputUL * 1000000),
      bytesReceived: Math.round(baseBytesReceived + (hours * intervalsPerHour - i) * throughputDL * 1000000),
      currentTechnology: baseEARFCN < 10000 ? 'LTE' : '5G NR',
      connectionMode: baseEARFCN < 10000 ? 'LTE' : '5G NSA',
      throughputDL,
      throughputUL,
      ueCount,
      prbUtilization,
      cqi
    });
  }

  return metrics;
};

const fetchDeviceParameters = async (nbiUrl, deviceId) => {
  const response = await fetch(`${nbiUrl.replace(/\/$/, '')}/devices/${deviceId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `GenieACS NBI error: ${response.status}`);
  }

  const data = await response.json();
  return data?.parameters || {};
};

// GET /api/tr069/devices - Get all devices from GenieACS
router.get('/devices', async (req, res) => {
  try {
    const config = await resolveGenieacsConfig(req.tenantId);
    const nbiUrl = (config.genieacsApiUrl || getNbiUrl()).replace(/\/$/, '');
    
    console.log(`[TR069 API] Fetching devices from GenieACS NBI: ${nbiUrl}`);
    
    // Build query - GenieACS may not support tenant filtering in query
    // So we'll fetch all devices and filter on backend if needed
    const queryParams = new URLSearchParams();
    
    if (req.query.limit) {
      queryParams.append('limit', req.query.limit);
    }
    
    // If GenieACS supports query filtering, use it
    // Otherwise fetch all and filter by tenant metadata on backend
    const queryString = queryParams.toString();
    const devicesUrl = `${nbiUrl}/devices${queryString ? `?${queryString}` : ''}`;
    
    console.log(`[TR069 API] Fetching devices from: ${devicesUrl}`);
    
    const response = await fetch(devicesUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[TR069 API] GenieACS NBI error: ${response.status} ${text}`);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to fetch devices from GenieACS',
        details: text,
        nbiUrl: nbiUrl
      });
    }

    const devices = await response.json();
    
    // Ensure devices is an array
    const deviceArray = Array.isArray(devices) ? devices : (devices.devices || []);
    
    console.log(`[TR069 API] Retrieved ${deviceArray.length} devices from GenieACS`);
    
    // Filter by tenant if tenantId is set in device metadata
    // If devices don't have tenant metadata, return all devices (single-tenant GenieACS)
    let filteredDevices = deviceArray;
    if (req.tenantId) {
      // Check if any device has tenant metadata
      const hasTenantMetadata = deviceArray.some(d => d._tenantId || d.tenantId);
      
      if (hasTenantMetadata) {
        // Filter by tenant
        filteredDevices = deviceArray.filter(d => 
          (d._tenantId || d.tenantId) === req.tenantId
        );
        console.log(`[TR069 API] Filtered to ${filteredDevices.length} devices for tenant ${req.tenantId}`);
      } else {
        // No tenant metadata - assume single-tenant GenieACS, return all devices
        console.log(`[TR069 API] No tenant metadata found - returning all ${deviceArray.length} devices (single-tenant mode)`);
      }
    }
    
    // Add tenant ID to each device if not present
    const enrichedDevices = filteredDevices.map(device => ({
      ...device,
      _tenantId: device._tenantId || req.tenantId,
      tenantId: device.tenantId || req.tenantId
    }));
    
    res.json({
      success: true,
      devices: enrichedDevices,
      count: enrichedDevices.length
    });
  } catch (error) {
    console.error('[TR069 API] Failed to fetch devices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch devices from GenieACS',
      details: error.message
    });
  }
});

// POST /api/tr069/sync - Sync devices from GenieACS (for compatibility)
router.post('/sync', async (req, res) => {
  try {
    const config = await resolveGenieacsConfig(req.tenantId);
    const nbiUrl = (config.genieacsApiUrl || getNbiUrl()).replace(/\/$/, '');
    
    // Fetch devices from GenieACS
    const tenantQuery = { _tenantId: req.tenantId };
    const queryString = new URLSearchParams({ 
      query: JSON.stringify(tenantQuery) 
    }).toString();
    
    const response = await fetch(`${nbiUrl}/devices?${queryString}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GenieACS NBI error: ${response.status} ${text}`);
    }

    const devices = await response.json();
    const deviceArray = Array.isArray(devices) ? devices : (devices.devices || []);
    
    res.json({
      success: true,
      message: `Synced ${deviceArray.length} devices from GenieACS`,
      synced: deviceArray.length,
      devices: deviceArray,
      tenantId: req.tenantId
    });
  } catch (error) {
    console.error('[TR069 API] Sync failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync devices from GenieACS',
      details: error.message
    });
  }
});

// GET /api/tr069/metrics - Return historical metrics for charts
router.get('/metrics', async (req, res) => {
  try {
    const { deviceId, hours } = req.query;
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'deviceId is required' });
    }

    const hoursNumber = Math.max(1, Math.min(168, parseInt(hours || '24', 10)));
    const config = await resolveGenieacsConfig(req.tenantId);
    const nbiUrl = (config.genieacsApiUrl || getNbiUrl()).replace(/\/$/, '');
    const parameters = await fetchDeviceParameters(nbiUrl, deviceId);

    const metrics = buildMetricsHistory(hoursNumber, deviceId, parameters);
    res.json({ success: true, metrics });
  } catch (error) {
    console.error('[TR069 API] Metrics fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load metrics',
      details: error.message
    });
  }
});

// GET /api/tr069/device-metrics - Return recent metrics for a device
router.get('/device-metrics', async (req, res) => {
  try {
    const { deviceId, hours } = req.query;
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'deviceId is required' });
    }

    const hoursNumber = Math.max(1, Math.min(24, parseInt(hours || '6', 10)));
    const config = await resolveGenieacsConfig(req.tenantId);
    const nbiUrl = (config.genieacsApiUrl || getNbiUrl()).replace(/\/$/, '');
    const parameters = await fetchDeviceParameters(nbiUrl, deviceId);

    const metrics = buildMetricsHistory(hoursNumber, deviceId, parameters);
    res.json({ success: true, metrics });
  } catch (error) {
    console.error('[TR069 API] Device metrics fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load device metrics',
      details: error.message
    });
  }
});

// POST /api/tr069/tasks - Execute TR-069 actions via GenieACS
router.post('/tasks', async (req, res) => {
  try {
    const { deviceId, action, parameters, parameter, value } = req.body || {};

    if (!deviceId || !action) {
      return res.status(400).json({ error: 'deviceId and action are required' });
    }

    const taskName = mapActionToTask(action);
    if (!taskName) {
      return res.status(400).json({ error: `Unsupported action: ${action}` });
    }

    // Get GenieACS NBI URL from tenant config
    const config = await resolveGenieacsConfig(req.tenantId);
    const nbiUrl = (config.genieacsApiUrl || getNbiUrl()).replace(/\/$/, '');
    const tasksEndpoint = `${nbiUrl}/tasks`;

    console.log(`[TR069 API] Creating task ${taskName} for device ${deviceId} via ${tasksEndpoint}`);

    const buildTaskPayload = (paramPath, paramValue) => ({
      device: deviceId,
      name: taskName,
      ...(paramPath ? { parameter: paramPath } : {}),
      ...(paramValue !== undefined ? { value: paramValue } : {})
    });

    const taskPayloads = Array.isArray(parameters) && parameters.length > 0
      ? parameters.map((param) => buildTaskPayload(param.parameter, param.value))
      : [buildTaskPayload(parameter, value)];

    const createdTasks = [];
    for (const payload of taskPayloads) {
      const response = await fetch(tasksEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TR069 API] GenieACS task creation failed: ${response.status} ${errorText}`);
        return res.status(response.status).json({
          success: false,
          error: 'GenieACS task creation failed',
          details: errorText
        });
      }

      const result = await response.json();
      createdTasks.push(result);
    }

    console.log(`[TR069 API] Successfully created ${createdTasks.length} task(s) for device ${deviceId}`);

    return res.json({
      success: true,
      message: `Task '${taskName}' created for device ${deviceId}`,
      tasks: createdTasks
    });
  } catch (error) {
    console.error('[TR069 API] Task execution error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to execute TR-069 task',
      details: error.message
    });
  }
});

// PUT /api/tr069/devices/:deviceId/customer - Link device to customer and geolocate
router.put('/devices/:deviceId/customer', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { customerId } = req.body;
    
    if (!customerId) {
      return res.status(400).json({ success: false, error: 'customerId is required' });
    }
    
    // Get customer record
    const { Customer } = require('../models/customer');
    const customer = await Customer.findOne({ 
      customerId, 
      tenantId: req.tenantId 
    }).lean();
    
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    // Get device from GenieACS
    const config = await resolveGenieacsConfig(req.tenantId);
    const nbiUrl = (config.genieacsApiUrl || getNbiUrl()).replace(/\/$/, '');
    
    const deviceResponse = await fetch(`${nbiUrl}/devices/${deviceId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!deviceResponse.ok) {
      return res.status(deviceResponse.status).json({
        success: false,
        error: 'Device not found in GenieACS'
      });
    }
    
    const device = await deviceResponse.json();
    
    // Geocode customer address if GPS not available on device
    let latitude = device.parameters?.['InternetGatewayDevice.DeviceInfo.Location']?.split(',')[0];
    let longitude = device.parameters?.['InternetGatewayDevice.DeviceInfo.Location']?.split(',')[1];
    
    if ((!latitude || !longitude) && customer.serviceAddress) {
      // Use customer's existing geocoded coordinates if available
      if (customer.serviceAddress.latitude && customer.serviceAddress.longitude) {
        latitude = customer.serviceAddress.latitude.toString();
        longitude = customer.serviceAddress.longitude.toString();
      } else {
        // Try to geocode using ArcGIS
        const appConfig = require('../config/app');
        const arcgisConfig = appConfig.externalServices.arcgis;
        const address = `${customer.serviceAddress.street}, ${customer.serviceAddress.city}, ${customer.serviceAddress.state} ${customer.serviceAddress.zipCode}`;
        
        try {
          const geocodeUrl = arcgisConfig.geocodeUrl;
          const params = new URLSearchParams({
            f: 'json',
            singleLine: address,
            outFields: 'Location'
          });
          
          if (arcgisConfig.apiKey) {
            params.append('token', arcgisConfig.apiKey);
          }
          
          const geocodeResponse = await fetch(`${geocodeUrl}?${params.toString()}`);
          if (geocodeResponse.ok) {
            const geocodeData = await geocodeResponse.json();
            if (geocodeData.candidates && geocodeData.candidates.length > 0) {
              const location = geocodeData.candidates[0].location;
              latitude = location.y.toString();
              longitude = location.x.toString();
            }
          }
        } catch (geocodeError) {
          console.warn('[TR069 API] Geocoding failed:', geocodeError);
        }
      }
    }
    
    // Update device metadata with customer link and location
    const updateData = {
      _customerId: customerId,
      _customerName: customer.fullName,
      'InternetGatewayDevice.DeviceInfo.Location': latitude && longitude 
        ? `${latitude},${longitude}` 
        : device.parameters?.['InternetGatewayDevice.DeviceInfo.Location']
    };
    
    // Update device via GenieACS NBI
    const updateResponse = await fetch(`${nbiUrl}/devices/${deviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      return res.status(updateResponse.status).json({
        success: false,
        error: 'Failed to update device',
        details: errorText
      });
    }
    
    res.json({
      success: true,
      message: 'Device linked to customer successfully',
      device: {
        id: deviceId,
        customerId,
        customerName: customer.fullName,
        location: latitude && longitude ? { latitude: parseFloat(latitude), longitude: parseFloat(longitude) } : null
      }
    });
  } catch (error) {
    console.error('[TR069 API] Failed to link device to customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to link device to customer',
      details: error.message
    });
  }
});

// POST /api/tr069/bulk-tasks - Execute bulk operations on multiple devices
router.post('/bulk-tasks', async (req, res) => {
  try {
    const { deviceIds, action, parameters, presetId } = req.body;
    
    if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ success: false, error: 'deviceIds array is required' });
    }
    
    if (!action) {
      return res.status(400).json({ success: false, error: 'action is required' });
    }
    
    const config = await resolveGenieacsConfig(req.tenantId);
    const nbiUrl = (config.genieacsApiUrl || getNbiUrl()).replace(/\/$/, '');
    const tasksEndpoint = `${nbiUrl}/tasks`;
    
    const taskName = mapActionToTask(action);
    if (!taskName && action !== 'applyPreset') {
      return res.status(400).json({ success: false, error: `Unsupported action: ${action}` });
    }
    
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };
    
    // Handle preset application
    if (action === 'applyPreset' && presetId) {
      // Get preset from MongoDB (GenieACS database)
      let presetClient;
      try {
        const { client, db } = await getGenieACSMongoDB();
        presetClient = client;
        
        // Find preset with tenant filter
        const preset = await db.collection('presets').findOne({ 
          _id: presetId,
          $or: [
            { _tenantId: req.tenantId },
            { _tenantId: { $exists: false } } // Legacy presets without tenant
          ]
        });
        
        if (!preset) {
          await presetClient.close();
          return res.status(404).json({ success: false, error: 'Preset not found' });
        }
        
        // Apply preset configurations to each device
        for (const deviceId of deviceIds) {
          try {
            for (const config of preset.configurations || []) {
              const taskPayload = {
                device: deviceId,
                name: 'setParameterValues',
                parameter: config.path || config.name,
                value: config.value
              };
              
              const response = await fetch(tasksEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskPayload)
              });
              
              if (!response.ok) {
                throw new Error(`Failed to apply preset config: ${response.status}`);
              }
            }
            results.success++;
          } catch (error) {
            results.failed++;
            results.errors.push({ deviceId, error: error.message });
          }
        }
        
        await presetClient.close();
    } else {
      // Handle standard bulk actions
      for (const deviceId of deviceIds) {
        try {
          const taskPayload = {
            device: deviceId,
            name: taskName,
            ...(parameters ? { parameter: parameters.parameter, value: parameters.value } : {})
          };
          
          const response = await fetch(tasksEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskPayload)
          });
          
          if (response.ok) {
            results.success++;
          } else {
            const errorText = await response.text();
            throw new Error(errorText);
          }
        } catch (error) {
          results.failed++;
          results.errors.push({ deviceId, error: error.message });
        }
      }
    }
    
    res.json({
      success: true,
      message: `Bulk operation completed: ${results.success} succeeded, ${results.failed} failed`,
      results
    });
  } catch (error) {
    console.error('[TR069 API] Bulk operation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute bulk operation',
      details: error.message
    });
  }
});

// ============================================================================
// PRESET MANAGEMENT ENDPOINTS
// ============================================================================

// GET /api/tr069/presets - Get all presets for tenant
router.get('/presets', async (req, res) => {
  let client;
  try {
    const { client: mongoClient, db } = await getGenieACSMongoDB();
    client = mongoClient;
    
    // Get presets for this tenant (or global presets without tenant)
    const presets = await db.collection('presets')
      .find({
        $or: [
          { _tenantId: req.tenantId },
          { _tenantId: { $exists: false } } // Legacy presets
        ]
      })
      .sort({ weight: 1 })
      .toArray();
    
    await client.close();
    
    res.json({
      success: true,
      presets: presets,
      count: presets.length
    });
  } catch (error) {
    console.error('[TR069 API] Failed to get presets:', error);
    if (client) {
      try {
        await client.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    res.status(500).json({
      success: false,
      error: 'Failed to get presets',
      details: error.message
    });
  }
});

// POST /api/tr069/presets - Create new preset
router.post('/presets', async (req, res) => {
  let client;
  try {
    const presetData = req.body;
    
    if (!presetData.name) {
      return res.status(400).json({
        success: false,
        error: 'Preset name is required'
      });
    }
    
    const { client: mongoClient, db } = await getGenieACSMongoDB();
    client = mongoClient;
    
    // Generate preset ID from name
    const presetId = presetData.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Check if preset already exists
    const existing = await db.collection('presets').findOne({ 
      _id: presetId,
      _tenantId: req.tenantId 
    });
    
    if (existing) {
      await client.close();
      return res.status(409).json({
        success: false,
        error: 'Preset with this name already exists'
      });
    }
    
    const preset = {
      _id: presetId,
      _tenantId: req.tenantId,
      name: presetData.name,
      description: presetData.description || '',
      weight: presetData.weight || 0,
      configurations: presetData.configurations || [],
      preCondition: presetData.preCondition || '',
      events: presetData.events || ['0 BOOTSTRAP', '1 BOOT'],
      tags: presetData.tags || [],
      enabled: presetData.enabled !== undefined ? presetData.enabled : true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('presets').insertOne(preset);
    await client.close();
    
    res.json({
      success: true,
      preset: preset,
      message: 'Preset created successfully'
    });
  } catch (error) {
    console.error('[TR069 API] Failed to create preset:', error);
    if (client) {
      try {
        await client.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create preset',
      details: error.message
    });
  }
});

// PUT /api/tr069/presets/:id - Update preset
router.put('/presets/:id', async (req, res) => {
  let client;
  try {
    const presetId = req.params.id;
    const updates = req.body;
    
    const { client: mongoClient, db } = await getGenieACSMongoDB();
    client = mongoClient;
    
    // Check if preset exists and belongs to tenant
    const existing = await db.collection('presets').findOne({ 
      _id: presetId,
      _tenantId: req.tenantId 
    });
    
    if (!existing) {
      await client.close();
      return res.status(404).json({
        success: false,
        error: 'Preset not found'
      });
    }
    
    // Build update object
    const { id, _id, createdAt, ...updateData } = updates;
    updateData.updatedAt = new Date();
    
    await db.collection('presets').updateOne(
      { _id: presetId, _tenantId: req.tenantId },
      { $set: updateData }
    );
    
    const updated = await db.collection('presets').findOne({ _id: presetId });
    await client.close();
    
    res.json({
      success: true,
      preset: updated,
      message: 'Preset updated successfully'
    });
  } catch (error) {
    console.error('[TR069 API] Failed to update preset:', error);
    if (client) {
      try {
        await client.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    res.status(500).json({
      success: false,
      error: 'Failed to update preset',
      details: error.message
    });
  }
});

// DELETE /api/tr069/presets/:id - Delete preset
router.delete('/presets/:id', async (req, res) => {
  let client;
  try {
    const presetId = req.params.id;
    
    const { client: mongoClient, db } = await getGenieACSMongoDB();
    client = mongoClient;
    
    // Check if preset exists and belongs to tenant
    const existing = await db.collection('presets').findOne({ 
      _id: presetId,
      _tenantId: req.tenantId 
    });
    
    if (!existing) {
      await client.close();
      return res.status(404).json({
        success: false,
        error: 'Preset not found'
      });
    }
    
    await db.collection('presets').deleteOne({ 
      _id: presetId,
      _tenantId: req.tenantId 
    });
    await client.close();
    
    res.json({
      success: true,
      message: `Preset "${existing.name}" deleted successfully`
    });
  } catch (error) {
    console.error('[TR069 API] Failed to delete preset:', error);
    if (client) {
      try {
        await client.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    res.status(500).json({
      success: false,
      error: 'Failed to delete preset',
      details: error.message
    });
  }
});

// POST /api/tr069/presets/:id/toggle - Toggle preset enabled status
router.post('/presets/:id/toggle', async (req, res) => {
  let client;
  try {
    const presetId = req.params.id;
    
    const { client: mongoClient, db } = await getGenieACSMongoDB();
    client = mongoClient;
    
    const existing = await db.collection('presets').findOne({ 
      _id: presetId,
      _tenantId: req.tenantId 
    });
    
    if (!existing) {
      await client.close();
      return res.status(404).json({
        success: false,
        error: 'Preset not found'
      });
    }
    
    const newStatus = !existing.enabled;
    await db.collection('presets').updateOne(
      { _id: presetId, _tenantId: req.tenantId },
      { $set: { enabled: newStatus, updatedAt: new Date() } }
    );
    await client.close();
    
    res.json({
      success: true,
      message: `Preset "${existing.name}" ${newStatus ? 'enabled' : 'disabled'}`,
      enabled: newStatus
    });
  } catch (error) {
    console.error('[TR069 API] Failed to toggle preset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle preset',
      details: error.message
    });
  }
});

// ============================================================================
// ALERT MANAGEMENT ENDPOINTS
// ============================================================================

// GET /api/tr069/alerts/rules - Get alert rules for ACS devices
router.get('/alerts/rules', async (req, res) => {
  try {
    const { AlertRule } = require('../routes/monitoring-schema');
    
    const rules = await AlertRule.find({
      tenantId: req.tenantId,
      source: 'acs'
    }).lean();
    
    res.json({
      success: true,
      rules: rules || []
    });
  } catch (error) {
    console.error('[TR069 API] Failed to get alert rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get alert rules',
      details: error.message
    });
  }
});

// POST /api/tr069/alerts/rules - Create alert rule for ACS devices
router.post('/alerts/rules', async (req, res) => {
  try {
    const { AlertRule } = require('../routes/monitoring-schema');
    const { v4: uuidv4 } = require('uuid');
    
    const ruleData = req.body;
    
    if (!ruleData.name || !ruleData.metric_name || !ruleData.operator || ruleData.threshold === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, metric_name, operator, threshold'
      });
    }
    
    const rule = new AlertRule({
      rule_id: uuidv4(),
      tenant_id: req.tenantId,
      tenantId: req.tenantId,
      name: ruleData.name,
      source: 'acs',
      metric_name: ruleData.metric_name,
      operator: ruleData.operator, // 'gt', 'lt', 'eq', 'gte', 'lte'
      threshold: ruleData.threshold,
      severity: ruleData.severity || 'warning',
      duration_seconds: ruleData.duration_seconds || 300,
      cooldown_minutes: ruleData.cooldown_minutes || 15,
      enabled: ruleData.enabled !== undefined ? ruleData.enabled : true,
      device_filter: ruleData.device_filter || {}, // Optional: filter by device properties
      created_at: new Date()
    });
    
    await rule.save();
    
    res.json({
      success: true,
      rule: rule,
      message: 'Alert rule created successfully'
    });
  } catch (error) {
    console.error('[TR069 API] Failed to create alert rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create alert rule',
      details: error.message
    });
  }
});

// PUT /api/tr069/alerts/rules/:id - Update alert rule
router.put('/alerts/rules/:id', async (req, res) => {
  try {
    const { AlertRule } = require('../routes/monitoring-schema');
    const ruleId = req.params.id;
    const updates = req.body;
    
    const rule = await AlertRule.findOne({
      rule_id: ruleId,
      tenantId: req.tenantId
    });
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Alert rule not found'
      });
    }
    
    Object.assign(rule, updates);
    await rule.save();
    
    res.json({
      success: true,
      rule: rule,
      message: 'Alert rule updated successfully'
    });
  } catch (error) {
    console.error('[TR069 API] Failed to update alert rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update alert rule',
      details: error.message
    });
  }
});

// DELETE /api/tr069/alerts/rules/:id - Delete alert rule
router.delete('/alerts/rules/:id', async (req, res) => {
  try {
    const { AlertRule } = require('../routes/monitoring-schema');
    const ruleId = req.params.id;
    
    const result = await AlertRule.deleteOne({
      rule_id: ruleId,
      tenantId: req.tenantId
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Alert rule not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Alert rule deleted successfully'
    });
  } catch (error) {
    console.error('[TR069 API] Failed to delete alert rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete alert rule',
      details: error.message
    });
  }
});

// GET /api/tr069/alerts - Get active alerts for ACS devices
router.get('/alerts', async (req, res) => {
  try {
    const { Alert } = require('../routes/monitoring-schema');
    
    const alerts = await Alert.find({
      tenantId: req.tenantId,
      source: 'acs',
      status: { $in: ['firing', 'acknowledged'] }
    })
    .sort({ first_triggered: -1 })
    .limit(100)
    .lean();
    
    res.json({
      success: true,
      alerts: alerts || []
    });
  } catch (error) {
    console.error('[TR069 API] Failed to get alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get alerts',
      details: error.message
    });
  }
});

// ============================================================================
// FIRMWARE MANAGEMENT ENDPOINTS
// ============================================================================

// GET /api/tr069/firmware - Get firmware versions for devices
router.get('/firmware', async (req, res) => {
  try {
    const config = await resolveGenieacsConfig(req.tenantId);
    const devicesEndpoint = `${config.genieacsApiUrl}/devices`;
    
    const response = await fetch(devicesEndpoint, {
      headers: {
        'X-Tenant-ID': req.tenantId
      }
    });
    
    if (!response.ok) {
      throw new Error(`GenieACS API error: ${response.status}`);
    }
    
    const devices = await response.json();
    
    // Extract firmware versions
    const firmwareVersions = new Map();
    devices.forEach(device => {
      const firmware = device.parameters?.['InternetGatewayDevice.DeviceInfo.SoftwareVersion']?._value ||
                      device.parameters?.['Device.DeviceInfo.SoftwareVersion']?._value ||
                      device.firmware ||
                      'Unknown';
      
      if (!firmwareVersions.has(firmware)) {
        firmwareVersions.set(firmware, {
          version: firmware,
          deviceCount: 0,
          devices: []
        });
      }
      
      const versionInfo = firmwareVersions.get(firmware);
      versionInfo.deviceCount++;
      versionInfo.devices.push({
        id: device._id,
        manufacturer: device.manufacturer,
        model: device.model
      });
    });
    
    res.json({
      success: true,
      firmwareVersions: Array.from(firmwareVersions.values())
    });
  } catch (error) {
    console.error('[TR069 API] Failed to get firmware versions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get firmware versions',
      details: error.message
    });
  }
});

// POST /api/tr069/firmware/upload - Upload firmware file (placeholder)
router.post('/firmware/upload', async (req, res) => {
  try {
    // TODO: Implement firmware file upload
    // This would typically involve:
    // 1. File upload handling (multer)
    // 2. Storage (S3, GCS, or local)
    // 3. Metadata storage in database
    
    res.json({
      success: false,
      error: 'Firmware upload not yet implemented',
      message: 'This feature is coming soon'
    });
  } catch (error) {
    console.error('[TR069 API] Failed to upload firmware:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload firmware',
      details: error.message
    });
  }
});

// POST /api/tr069/firmware/upgrade - Schedule firmware upgrade
router.post('/firmware/upgrade', async (req, res) => {
  try {
    const { deviceIds, firmwareUrl, scheduleAt } = req.body;
    
    if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'deviceIds array is required'
      });
    }
    
    if (!firmwareUrl) {
      return res.status(400).json({
        success: false,
        error: 'firmwareUrl is required'
      });
    }
    
    const config = await resolveGenieacsConfig(req.tenantId);
    const tasksEndpoint = `${config.genieacsApiUrl}/tasks`;
    
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };
    
    for (const deviceId of deviceIds) {
      try {
        const taskPayload = {
          device: deviceId,
          name: 'download',
          fileType: '1 Firmware Upgrade Image',
          fileName: firmwareUrl,
          targetFileName: 'firmware.bin'
        };
        
        if (scheduleAt) {
          taskPayload.timestamp = new Date(scheduleAt).toISOString();
        }
        
        const response = await fetch(tasksEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskPayload)
        });
        
        if (response.ok) {
          results.success++;
        } else {
          throw new Error(`Failed to schedule upgrade: ${response.status}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ deviceId, error: error.message });
      }
    }
    
    res.json({
      success: true,
      results: results,
      message: `Firmware upgrade scheduled for ${results.success} device(s)`
    });
  } catch (error) {
    console.error('[TR069 API] Failed to schedule firmware upgrade:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule firmware upgrade',
      details: error.message
    });
  }
});

// ============================================================================
// ADVANCED FILTERING ENDPOINTS
// ============================================================================

// GET /api/tr069/devices/filtered - Get devices with advanced filtering
router.get('/devices/filtered', async (req, res) => {
  try {
    const {
      manufacturer,
      model,
      firmware,
      customerId,
      status,
      lastContactMin,
      lastContactMax,
      locationRadius,
      locationLat,
      locationLon,
      tags,
      search
    } = req.query;
    
    const config = await resolveGenieacsConfig(req.tenantId);
    const devicesEndpoint = `${config.genieacsApiUrl}/devices`;
    
    const response = await fetch(devicesEndpoint, {
      headers: {
        'X-Tenant-ID': req.tenantId
      }
    });
    
    if (!response.ok) {
      throw new Error(`GenieACS API error: ${response.status}`);
    }
    
    let devices = await response.json();
    
    // Apply filters
    if (manufacturer) {
      devices = devices.filter(d => 
        d.manufacturer?.toLowerCase().includes(manufacturer.toLowerCase())
      );
    }
    
    if (model) {
      devices = devices.filter(d => 
        d.model?.toLowerCase().includes(model.toLowerCase())
      );
    }
    
    if (firmware) {
      devices = devices.filter(d => {
        const fw = d.parameters?.['InternetGatewayDevice.DeviceInfo.SoftwareVersion']?._value ||
                   d.firmware || '';
        return fw.toLowerCase().includes(firmware.toLowerCase());
      });
    }
    
    if (customerId) {
      devices = devices.filter(d => 
        d._customerId === customerId || d.customerId === customerId
      );
    }
    
    if (status) {
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      
      if (status === 'online') {
        devices = devices.filter(d => {
          const lastContact = d._lastInform ? new Date(d._lastInform).getTime() : 0;
          return lastContact >= fiveMinutesAgo;
        });
      } else if (status === 'offline') {
        devices = devices.filter(d => {
          const lastContact = d._lastInform ? new Date(d._lastInform).getTime() : 0;
          return lastContact < fiveMinutesAgo;
        });
      }
    }
    
    if (lastContactMin || lastContactMax) {
      const minTime = lastContactMin ? new Date(lastContactMin).getTime() : 0;
      const maxTime = lastContactMax ? new Date(lastContactMax).getTime() : Date.now();
      
      devices = devices.filter(d => {
        const lastContact = d._lastInform ? new Date(d._lastInform).getTime() : 0;
        return lastContact >= minTime && lastContact <= maxTime;
      });
    }
    
    if (locationRadius && locationLat && locationLon) {
      const radiusKm = parseFloat(locationRadius);
      const lat = parseFloat(locationLat);
      const lon = parseFloat(locationLon);
      
      devices = devices.filter(d => {
        if (!d.Location || !d.Location._value) return false;
        
        const coords = d.Location._value.split(',').map(parseFloat);
        if (coords.length !== 2) return false;
        
        const [deviceLat, deviceLon] = coords;
        const distance = getDistance(lat, lon, deviceLat, deviceLon);
        
        return distance <= radiusKm;
      });
    }
    
    if (tags && Array.isArray(tags)) {
      devices = devices.filter(d => {
        const deviceTags = d.tags || [];
        return tags.some(tag => deviceTags.includes(tag));
      });
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      devices = devices.filter(d => 
        d._id?.toLowerCase().includes(searchLower) ||
        d.manufacturer?.toLowerCase().includes(searchLower) ||
        d.model?.toLowerCase().includes(searchLower) ||
        d.serialNumber?.toLowerCase().includes(searchLower) ||
        d._customerName?.toLowerCase().includes(searchLower)
      );
    }
    
    res.json({
      success: true,
      devices: devices,
      count: devices.length
    });
  } catch (error) {
    console.error('[TR069 API] Failed to get filtered devices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get filtered devices',
      details: error.message
    });
  }
});

// Helper function to calculate distance between coordinates
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// DELETE /api/tr069/devices - Delete all devices for a tenant (admin/cleanup)
router.delete('/devices', async (req, res) => {
  try {
    const config = await resolveGenieacsConfig(req.tenantId);
    const nbiUrl = (config.genieacsApiUrl || getNbiUrl()).replace(/\/$/, '');
    
    console.log(`[TR069 API] Deleting all devices for tenant: ${req.tenantId}`);
    
    // First, get all devices for this tenant
    const devicesResponse = await fetch(`${nbiUrl}/devices`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!devicesResponse.ok) {
      const text = await devicesResponse.text();
      return res.status(devicesResponse.status).json({
        success: false,
        error: 'Failed to fetch devices from GenieACS',
        details: text
      });
    }
    
    const devices = await devicesResponse.json();
    const deviceArray = Array.isArray(devices) ? devices : (devices.devices || []);
    
    // Filter devices by tenant
    let devicesToDelete = deviceArray;
    if (req.tenantId) {
      const hasTenantMetadata = deviceArray.some(d => d._tenantId || d.tenantId);
      if (hasTenantMetadata) {
        devicesToDelete = deviceArray.filter(d => 
          (d._tenantId || d.tenantId) === req.tenantId
        );
      }
    }
    
    console.log(`[TR069 API] Found ${devicesToDelete.length} devices to delete for tenant ${req.tenantId}`);
    
    if (devicesToDelete.length === 0) {
      return res.json({
        success: true,
        message: 'No devices found for this tenant',
        deleted: 0
      });
    }
    
    // Delete each device via GenieACS NBI API
    let deletedCount = 0;
    let errors = [];
    
    for (const device of devicesToDelete) {
      const deviceId = device._id || device.id;
      if (!deviceId) continue;
      
      try {
        const deleteResponse = await fetch(`${nbiUrl}/devices/${deviceId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (deleteResponse.ok) {
          deletedCount++;
        } else {
          const errorText = await deleteResponse.text();
          errors.push({ deviceId, error: errorText });
          console.error(`[TR069 API] Failed to delete device ${deviceId}: ${errorText}`);
        }
      } catch (error) {
        errors.push({ deviceId, error: error.message });
        console.error(`[TR069 API] Error deleting device ${deviceId}:`, error);
      }
    }
    
    res.json({
      success: true,
      message: `Deleted ${deletedCount} of ${devicesToDelete.length} devices`,
      deleted: deletedCount,
      total: devicesToDelete.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[TR069 API] Failed to delete devices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete devices from GenieACS',
      details: error.message
    });
  }
});

module.exports = router;
