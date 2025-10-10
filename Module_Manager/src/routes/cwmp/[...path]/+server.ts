/**
 * CWMP Proxy - Exposes internal GenieACS CWMP (port 7547) to external clients
 * CPE devices can connect to: https://your-app.web.app/cwmp
 */
import type { RequestHandler } from '@sveltejs/kit';

const CWMP_URL = 'http://localhost:7547';

export const GET: RequestHandler = async ({ params, url, request }) => {
  const path = params.path || '';
  const targetUrl = `${CWMP_URL}/${path}${url.search}`;
  
  console.log('CWMP Proxy GET:', targetUrl);
  
  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: request.headers
    });
    
    return new Response(response.body, {
      status: response.status,
      headers: response.headers
    });
  } catch (err: any) {
    console.error('CWMP Proxy error:', err);
    return new Response('GenieACS CWMP not available', { status: 503 });
  }
};

export const POST: RequestHandler = async ({ params, url, request }) => {
  const path = params.path || '';
  const targetUrl = `${CWMP_URL}/${path}${url.search}`;
  
  console.log('CWMP Proxy POST:', targetUrl);
  
  try {
    const body = await request.arrayBuffer();
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: request.headers,
      body
    });
    
    return new Response(response.body, {
      status: response.status,
      headers: response.headers
    });
  } catch (err: any) {
    console.error('CWMP Proxy error:', err);
    return new Response('GenieACS CWMP not available', { status: 503 });
  }
};

