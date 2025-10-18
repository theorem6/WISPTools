// Service Management API
// Allows monitoring and controlling backend services via PM2

const express = require('express');
const { execSync } = require('child_process');
const router = express.Router();

// List of manageable services
const SERVICES = [
  { name: 'genieacs-nbi', displayName: 'GenieACS NBI', port: 7557, canRestart: true },
  { name: 'genieacs-cwmp', displayName: 'GenieACS CWMP', port: 7547, canRestart: true },
  { name: 'genieacs-fs', displayName: 'GenieACS FS', port: 7567, canRestart: true },
  { name: 'genieacs-ui', displayName: 'GenieACS UI', port: 8080, canRestart: true },
  { name: 'hss-api', displayName: 'HSS API', port: 3000, canRestart: true }
];

/**
 * Get status of a specific service
 * GET /services/:serviceName/status
 */
router.get('/:serviceName/status', (req, res) => {
  try {
    const { serviceName } = req.params;
    
    const service = SERVICES.find(s => s.name === serviceName);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    try {
      const output = execSync(`pm2 jlist`, { encoding: 'utf8' });
      const processes = JSON.parse(output);
      const process = processes.find(p => p.name === serviceName);
      
      if (process) {
        res.json({
          success: true,
          service: serviceName,
          status: process.pm2_env.status,
          running: process.pm2_env.status === 'online',
          uptime: process.pm2_env.pm_uptime,
          memory: process.monit.memory,
          cpu: process.monit.cpu,
          restarts: process.pm2_env.restart_time
        });
      } else {
        res.json({
          success: true,
          service: serviceName,
          status: 'stopped',
          running: false
        });
      }
    } catch (error) {
      console.error(`Error checking service ${serviceName}:`, error);
      res.json({
        success: false,
        service: serviceName,
        status: 'unknown',
        error: error.message
      });
    }
  } catch (error) {
    console.error('[Service Status] Error:', error);
    res.status(500).json({ error: 'Failed to check service status' });
  }
});

/**
 * Get status of all services
 * GET /services/all/status
 */
router.get('/all/status', (req, res) => {
  try {
    const output = execSync(`pm2 jlist`, { encoding: 'utf8' });
    const processes = JSON.parse(output);
    
    const serviceStatuses = SERVICES.map(service => {
      const process = processes.find(p => p.name === service.name);
      
      if (process) {
        return {
          name: service.name,
          displayName: service.displayName,
          port: service.port,
          status: process.pm2_env.status,
          running: process.pm2_env.status === 'online',
          uptime: process.pm2_env.pm_uptime,
          memory: process.monit.memory,
          cpu: process.monit.cpu,
          restarts: process.pm2_env.restart_time,
          canRestart: service.canRestart
        };
      } else {
        return {
          name: service.name,
          displayName: service.displayName,
          port: service.port,
          status: 'stopped',
          running: false,
          canRestart: service.canRestart
        };
      }
    });
    
    res.json({
      success: true,
      services: serviceStatuses
    });
  } catch (error) {
    console.error('[All Services Status] Error:', error);
    res.status(500).json({ error: 'Failed to get services status' });
  }
});

/**
 * Restart a service
 * POST /services/:serviceName/restart
 */
router.post('/:serviceName/restart', (req, res) => {
  try {
    const { serviceName } = req.params;
    
    const service = SERVICES.find(s => s.name === serviceName && s.canRestart);
    if (!service) {
      return res.status(404).json({ error: 'Service not found or cannot be restarted' });
    }
    
    console.log(`[Service Management] Restarting ${serviceName}...`);
    
    execSync(`pm2 restart ${serviceName}`, { encoding: 'utf8' });
    
    res.json({
      success: true,
      message: `${service.displayName} restarted successfully`
    });
  } catch (error) {
    console.error(`[Service Restart] Error restarting ${req.params.serviceName}:`, error);
    res.status(500).json({ error: 'Failed to restart service' });
  }
});

/**
 * Stop a service
 * POST /services/:serviceName/stop
 */
router.post('/:serviceName/stop', (req, res) => {
  try {
    const { serviceName } = req.params;
    
    const service = SERVICES.find(s => s.name === serviceName && s.canRestart);
    if (!service) {
      return res.status(404).json({ error: 'Service not found or cannot be stopped' });
    }
    
    console.log(`[Service Management] Stopping ${serviceName}...`);
    
    execSync(`pm2 stop ${serviceName}`, { encoding: 'utf8' });
    
    res.json({
      success: true,
      message: `${service.displayName} stopped successfully`
    });
  } catch (error) {
    console.error(`[Service Stop] Error stopping ${req.params.serviceName}:`, error);
    res.status(500).json({ error: 'Failed to stop service' });
  }
});

/**
 * Start a service
 * POST /services/:serviceName/start
 */
router.post('/:serviceName/start', (req, res) => {
  try {
    const { serviceName } = req.params;
    
    const service = SERVICES.find(s => s.name === serviceName && s.canRestart);
    if (!service) {
      return res.status(404).json({ error: 'Service not found or cannot be started' });
    }
    
    console.log(`[Service Management] Starting ${serviceName}...`);
    
    execSync(`pm2 start ${serviceName}`, { encoding: 'utf8' });
    
    res.json({
      success: true,
      message: `${service.displayName} started successfully`
    });
  } catch (error) {
    console.error(`[Service Start] Error starting ${req.params.serviceName}:`, error);
    res.status(500).json({ error: 'Failed to start service' });
  }
});

module.exports = router;

