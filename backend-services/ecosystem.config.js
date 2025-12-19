/**
 * PM2 Ecosystem Configuration
 * Manages all API services as separate processes on isolated ports
 * This prevents one service from affecting others during updates
 */

module.exports = {
  apps: [
    {
      name: 'main-api',
      script: './server.js',
      cwd: '/opt/lte-pci-mapper/backend-services',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0',
        FIREBASE_PROJECT_ID: 'wisptools-production',
        FIREBASE_SERVICE_ACCOUNT_KEY: '/opt/lte-pci-mapper/backend-services/wisptools-production-firebase-adminsdk.json',
        ARCGIS_API_KEY: 'AAPT85fOqywZsicJupSmVSCGrjWNNjURUpnE--wnh6GZUrdoxPtDwnuleQ7w-D3IjAfeg3sWvEIvfQitmq894hp5hUN7nAsjLja-hlpzZZekEgdf3besreVsmrBJqy9c2XCRMc5EnBZyP60U1Lhf6E4ZrPWlOoxUWLIe8cCoNPI1Zh9VL1o_1wRQglmdGLTqx9vbHon7Pa_hZyTKQxvVC2stN7sZKy4quJ6kiAtW1QpqwOo.AT2_12sjSDHZ',
        ARCGIS_OAUTH_CLIENT_ID: 'lkx9ZLDmdfe5OLYA',
        ARCGIS_OAUTH_CLIENT_SECRET: 'f544f0139944426bb3901601f2aebd4b',
        // Email configuration - Google Workspace SMTP Relay
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_PORT: '587',
        SMTP_SECURE: 'false',
        SMTP_USER: process.env.SMTP_USER || 'noreply@wisptools.io',
        SMTP_PASS: 'gaej lyex xydt efyp',
        FROM_EMAIL: 'noreply@wisptools.io',
        FROM_NAME: 'WISPTools'
      },
      error_file: '/home/david/.pm2/logs/main-api-error.log',
      out_file: '/home/david/.pm2/logs/main-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git']
    },
    {
      name: 'epc-api',
      script: './min-epc-server.js',
      cwd: '/opt/lte-pci-mapper/backend-services',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        HOST: '0.0.0.0',
        FIREBASE_PROJECT_ID: 'wisptools-production',
        FIREBASE_SERVICE_ACCOUNT_KEY: '/opt/lte-pci-mapper/backend-services/wisptools-production-firebase-adminsdk.json',
        ARCGIS_API_KEY: 'AAPT85fOqywZsicJupSmVSCGrjWNNjURUpnE--wnh6GZUrdoxPtDwnuleQ7w-D3IjAfeg3sWvEIvfQitmq894hp5hUN7nAsjLja-hlpzZZekEgdf3besreVsmrBJqy9c2XCRMc5EnBZyP60U1Lhf6E4ZrPWlOoxUWLIe8cCoNPI1Zh9VL1o_1wRQglmdGLTqx9vbHon7Pa_hZyTKQxvVC2stN7sZKy4quJ6kiAtW1QpqwOo.AT2_12sjSDHZ',
        ARCGIS_OAUTH_CLIENT_ID: 'lkx9ZLDmdfe5OLYA',
        ARCGIS_OAUTH_CLIENT_SECRET: 'f544f0139944426bb3901601f2aebd4b'
      },
      error_file: '/home/david/.pm2/logs/epc-api-error.log',
      out_file: '/home/david/.pm2/logs/epc-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '300M',
      watch: false
    }
  ]
};

