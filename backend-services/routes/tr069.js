const express = require('express');
const appConfig = require('../config/app');

const router = express.Router();

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
