/**
 * File Server Proxy - Exposes internal GenieACS FS (port 7567) to external clients
 * Access at: https://your-app.web.app/fs/*
 */
import type { RequestHandler } from '@sveltejs/kit';

const FS_URL = 'http://localhost:7567';

const proxyRequest: RequestHandler = async ({ params, url, request }) => {
  const path = params.path || '';
  const targetUrl = `${FS_URL}/${path}${url.search}`;
  
  console.log(`FS Proxy ${request.method}:`, targetUrl);
  
  try {
    const options: RequestInit = {
      method: request.method,
      headers: request.headers
    };
    
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      options.body = await request.arrayBuffer();
    }
    
    const response = await fetch(targetUrl, options);
    
    return new Response(response.body, {
      status: response.status,
      headers: response.headers
    });
  } catch (err: any) {
    console.error('FS Proxy error:', err);
    return new Response('GenieACS File Server not available', { status: 503 });
  }
};

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;

