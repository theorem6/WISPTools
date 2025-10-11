// SvelteKit API Route - CPE Devices
// Proxy to GCE GenieACS NBI API

import type { RequestHandler } from '@sveltejs/kit';

// Get GenieACS NBI URL from environment
const GENIEACS_NBI_URL = process.env.PUBLIC_GENIEACS_NBI_URL || 'http://localhost:7557';

// GET - Fetch all CPE devices from GenieACS NBI
export const GET: RequestHandler = async ({ url }) => {
  try {
    const status = url.searchParams.get('status');
    const limit = url.searchParams.get('limit');
    
    // Build query for GenieACS NBI
    const query: any = {};
    if (limit) query.limit = parseInt(limit);
    
    const queryString = Object.keys(query).length > 0 
      ? '?' + new URLSearchParams(query).toString()
      : '';
    
    // Fetch from GenieACS NBI on GCE backend
    const response = await fetch(`${GENIEACS_NBI_URL}/devices${queryString}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`GenieACS NBI error: ${response.status}`);
    }
    
    const devices = await response.json();
    
    return new Response(JSON.stringify({
      success: true,
      devices,
      count: devices.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('GenieACS NBI fetch error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

