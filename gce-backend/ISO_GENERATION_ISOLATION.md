# ISO Generation Code Isolation

## 🛡️ **Purpose**

The ISO generation code has been isolated into separate helper files to prevent accidental breakage when modifying other parts of the backend. Each helper file contains tested, working code that should NOT be modified unless fixing ISO-specific bugs.

## 📁 **File Structure**

```
gce-backend/
├── server.js                    # Main server (mounts routes)
├── routes/
│   └── epc-deployment.js       # Route handlers only (minimal, safe to modify)
└── utils/                       # ISOLATED HELPERS - DO NOT MODIFY UNLESS FIXING ISO BUGS
    ├── iso-helpers.js          # Cloud-init config generation
    ├── bootstrap-helpers.js    # Bootstrap script generation  
    └── deployment-helpers.js   # Full Open5GS deployment script
```

## 🔒 **Isolated Helper Files**

### `gce-backend/utils/iso-helpers.js`
- **Purpose**: Generates cloud-init configuration for autoinstall
- **Function**: `generateCloudInitConfig(config)`
- **DO NOT MODIFY** unless fixing cloud-init/autoinstall issues

### `gce-backend/utils/bootstrap-helpers.js`
- **Purpose**: Generates bootstrap script that runs on first boot
- **Function**: `generateBootstrapScript(epc_id, gce_ip, hss_port)`
- **DO NOT MODIFY** unless fixing bootstrap/download issues

### `gce-backend/utils/deployment-helpers.js`
- **Purpose**: Generates full Open5GS EPC deployment script
- **Function**: `generateFullDeploymentScript(epc_id, gce_ip, hss_port)`
- **DO NOT MODIFY** unless fixing Open5GS installation/configuration issues

## ✅ **Safe to Modify**

### `gce-backend/routes/epc-deployment.js`
- Contains only HTTP route handlers
- Imports helpers from `utils/` directory
- Safe to modify for route logic, validation, error handling

### `gce-backend/server.js`
- Contains server setup and route mounting
- Safe to modify for middleware, server configuration

## 🚫 **When to Modify Isolated Files**

**ONLY modify isolated helper files if:**
1. Fixing a specific bug in ISO generation
2. Fixing cloud-init configuration issues
3. Fixing bootstrap script problems
4. Fixing Open5GS deployment script issues

**DO NOT modify isolated files for:**
- Adding new routes (add to `epc-deployment.js`)
- Changing API responses (modify route handlers)
- General refactoring (modify route handlers)

## 📝 **How Routes Use Helpers**

```javascript
// routes/epc-deployment.js
const { generateCloudInitConfig } = require('../utils/iso-helpers');
const { generateBootstrapScript } = require('../utils/bootstrap-helpers');
const { generateFullDeploymentScript } = require('../utils/deployment-helpers');

// Route handler uses helpers
router.post('/generate-epc-iso', async (req, res) => {
  const cloudInit = generateCloudInitConfig({ ... });
  // ... use cloudInit
});

router.get('/:epc_id/bootstrap', async (req, res) => {
  const script = generateBootstrapScript(epc_id, gce_ip, hss_port);
  res.send(script);
});

router.get('/:epc_id/full-deployment', async (req, res) => {
  const script = generateFullDeploymentScript(epc_id, gce_ip, hss_port);
  res.send(script);
});
```

## 🔍 **Verifying Isolation Works**

After any changes, verify:
1. Service starts: `systemctl status gce-backend.service`
2. Routes load: Check server logs for "[Server] EPC deployment routes loaded"
3. Helper files exist: `ls /opt/gce-backend/utils/`
4. Health check works: `curl http://localhost:3002/health`

## ⚠️ **Important Notes**

- Helper files are **production code** - they work!
- Route file is **safe to modify** - it's just HTTP handlers
- Changes to helpers require careful testing
- When in doubt, modify routes, not helpers

