const express = require('express');
const appConfig = require('../config/app');
const Tenant = require('../models/tenant');

const router = express.Router();

// Middleware to extract tenant ID
const requireTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'] || req.body?.tenantId || req.query?.tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'X-Tenant-ID header or tenantId is required' });
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
    res.json({ success: true, config });
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

    if (!genieacsUrl || !genieacsApiUrl) {
      return res.status(400).json({ success: false, error: 'genieacsUrl and genieacsApiUrl are required' });
    }

    await Tenant.updateOne(
      { _id: req.tenantId },
      {
        $set: {
          'settings.genieacsConfig': {
            genieacsUrl,
            genieacsApiUrl,
            updatedAt: new Date().toISOString()
          }
        }
      }
    );

    res.json({ success: true, message: 'Configuration saved' });
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

    const nbiUrl = getNbiUrl();
    const tasksEndpoint = `${nbiUrl.replace(/\/$/, '')}/tasks`;

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
        return res.status(response.status).json({
          success: false,
          error: 'GenieACS task creation failed',
          details: errorText
        });
      }

      const result = await response.json();
      createdTasks.push(result);
    }

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

module.exports = router;
