// SvelteKit Server Hooks
// Validates environment variables and adds logging

import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';

// Log environment configuration at startup
console.log('🚀 Server starting...');
console.log('📊 Environment variables loaded:');
console.log('  - FIREBASE_API_KEY:', env.PUBLIC_FIREBASE_API_KEY ? '✅ Set' : '❌ Missing');
console.log('  - FIREBASE_AUTH_DOMAIN:', env.PUBLIC_FIREBASE_AUTH_DOMAIN ? '✅ Set' : '❌ Missing');
console.log('  - FIREBASE_PROJECT_ID:', env.PUBLIC_FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing');
console.log('  - PORT:', process.env.PORT || '8080');
console.log('  - HOST:', process.env.HOST || '0.0.0.0');

// Validate critical environment variables
const requiredEnvVars = [
  'PUBLIC_FIREBASE_API_KEY',
  'PUBLIC_FIREBASE_AUTH_DOMAIN',
  'PUBLIC_FIREBASE_PROJECT_ID'
];

const missingVars = requiredEnvVars.filter(varName => !env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars);
  console.error('⚠️  Application may not function correctly!');
  console.error('📝 Check your apphosting.yaml configuration');
}

export const handle: Handle = async ({ event, resolve }) => {
  // Add request logging
  const start = Date.now();
  
  // Handle health check endpoint
  if (event.url.pathname === '/health' || event.url.pathname === '/_health') {
    return new Response(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        port: process.env.PORT || '8080',
        hasFirebaseConfig: !!env.PUBLIC_FIREBASE_API_KEY
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  const response = await resolve(event);
  
  const duration = Date.now() - start;
  
  // Log requests (but not too verbose)
  if (duration > 1000 || response.status >= 400) {
    console.log(`${event.request.method} ${event.url.pathname} - ${response.status} (${duration}ms)`);
  }
  
  return response;
};

