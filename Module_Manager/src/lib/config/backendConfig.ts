// Backend Configuration
// Centralized configuration for backend API endpoints

export interface BackendConfig {
  // Main backend API
  backendApiUrl: string;
  
  // GenieACS endpoints
  genieacs: {
    nbiUrl: string;
    cwmpUrl: string;
    fsUrl: string;
    uiUrl: string;
  };
  
  // STUN/TURN configuration
  stun: {
    server: string;
    port: number;
  };
  
  // Timeouts and limits
  timeout: number;
  maxRetries: number;
}

// Get configuration from environment variables
function getBackendConfig(): BackendConfig {
  // Check if we're running on the server side
  const isServer = typeof window === 'undefined';
  
  // For server-side, use import.meta.env
  // For client-side, these should be available as PUBLIC_ prefixed
  const getEnv = (key: string): string => {
    if (isServer) {
      return import.meta.env[key] || '';
    }
    // Client-side access through window or import.meta.env
    return import.meta.env[key] || '';
  };
  
  const backendApiUrl = getEnv('PUBLIC_BACKEND_API_URL') || 'http://localhost:3000/api';
  const genieacsNbiUrl = getEnv('PUBLIC_GENIEACS_NBI_URL') || 'http://localhost:7557';
  const genieacsCwmpUrl = getEnv('PUBLIC_GENIEACS_CWMP_URL') || 'http://localhost:7547';
  const genieacsFsUrl = getEnv('PUBLIC_GENIEACS_FS_URL') || 'http://localhost:7567';
  const genieacsUiUrl = getEnv('PUBLIC_GENIEACS_UI_URL') || 'http://localhost:8080';
  const stunServer = getEnv('PUBLIC_STUN_SERVER') || 'stun:localhost:3478';
  
  // Parse STUN server
  const stunMatch = stunServer.match(/^stun:([^:]+):(\d+)$/);
  const stunHost = stunMatch ? stunMatch[1] : 'localhost';
  const stunPort = stunMatch ? parseInt(stunMatch[2]) : 3478;
  
  return {
    backendApiUrl,
    genieacs: {
      nbiUrl: genieacsNbiUrl,
      cwmpUrl: genieacsCwmpUrl,
      fsUrl: genieacsFsUrl,
      uiUrl: genieacsUiUrl
    },
    stun: {
      server: `stun:${stunHost}:${stunPort}`,
      port: stunPort
    },
    timeout: 30000,
    maxRetries: 3
  };
}

// Export singleton instance
export const backendConfig = getBackendConfig();

// Helper function to build API URLs
export function buildApiUrl(path: string): string {
  const base = backendConfig.backendApiUrl.replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  return `${base}/${cleanPath}`;
}

export function buildGenieacsNbiUrl(path: string): string {
  const base = backendConfig.genieacs.nbiUrl.replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  return `${base}/${cleanPath}`;
}

export function buildGenieacsFsUrl(path: string): string {
  const base = backendConfig.genieacs.fsUrl.replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  return `${base}/${cleanPath}`;
}

// Validate configuration
export function validateBackendConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!backendConfig.backendApiUrl) {
    errors.push('Backend API URL is not configured');
  }
  
  if (!backendConfig.genieacs.nbiUrl) {
    errors.push('GenieACS NBI URL is not configured');
  }
  
  if (!backendConfig.stun.server) {
    errors.push('STUN server is not configured');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Log configuration on startup (server-side only)
if (typeof window === 'undefined') {
  console.log('Backend Configuration:', {
    backendApiUrl: backendConfig.backendApiUrl,
    genieacsNbiUrl: backendConfig.genieacs.nbiUrl,
    genieacsCwmpUrl: backendConfig.genieacs.cwmpUrl,
    stunServer: backendConfig.stun.server
  });
  
  const validation = validateBackendConfig();
  if (!validation.valid) {
    console.warn('Backend configuration validation errors:', validation.errors);
  }
}

