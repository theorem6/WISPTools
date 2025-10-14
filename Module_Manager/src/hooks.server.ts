// SvelteKit Server Hooks
// Handles server-side initialization and error handling

import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Add CORS headers for API routes
  if (event.url.pathname.startsWith('/api/')) {
    // Handle preflight requests
    if (event.request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }
  }

  const response = await resolve(event);

  // Add CORS headers to API responses
  if (event.url.pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  
  // Allow popup communication for OAuth callback
  // Set Cross-Origin-Opener-Policy to allow window.opener access
  if (event.url.pathname.startsWith('/oauth/')) {
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  }

  return response;
};
