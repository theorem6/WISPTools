/**
 * NBI API Proxy - Exposes internal GenieACS NBI (port 7557) to external clients
 * Access at: https://your-app.web.app/nbi/*
 */
import type { RequestHandler } from '@sveltejs/kit';

const NBI_URL = 'http://localhost:7557';

const proxyRequest: RequestHandler = async ({ params, url, request }) => {
  const path = params.path || '';
  const targetUrl = `${NBI_URL}/${path}${url.search}`;
  
  console.log(`NBI Proxy ${request.method}:`, targetUrl);
  
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
    console.error('NBI Proxy error:', err);
    return new Response('GenieACS NBI not available', { status: 503 });
  }
};

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
export const PATCH = proxyRequest;

