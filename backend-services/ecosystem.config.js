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
        ARCGIS_API_KEY: 'AAPTxy8BH1VEsoebNVZXo8HurGbnlTRSD_LpCIzNN_GYtkaaVGZtaA5vQ2USVJ_79QPe7yOvuh8tFFM0WMguSFCMJ7IG8r9rfuM6fzDUDviu7eAvqgqA9nu1J3mT3jbv_rUPKU2dgp9H8qtEZDOjJ2G_nNM9XWuipReP9xbzFvg8Bo24782l8wWU8RMjLGcxEw_5aKtJZ-XMGb3PlBMj5wTBiF84JeWXIppu_wJ504qzB7A.AT1_12sjSDHZ'
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
        ARCGIS_API_KEY: 'AAPTxy8BH1VEsoebNVZXo8HurGbnlTRSD_LpCIzNN_GYtkaaVGZtaA5vQ2USVJ_79QPe7yOvuh8tFFM0WMguSFCMJ7IG8r9rfuM6fzDUDviu7eAvqgqA9nu1J3mT3jbv_rUPKU2dgp9H8qtEZDOjJ2G_nNM9XWuipReP9xbzFvg8Bo24782l8wWU8RMjLGcxEw_5aKtJZ-XMGb3PlBMj5wTBiF84JeWXIppu_wJ504qzB7A.AT1_12sjSDHZ'
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

