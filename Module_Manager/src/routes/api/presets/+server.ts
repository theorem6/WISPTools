// SvelteKit API Route - Presets CRUD Operations
// Proxy to GCE GenieACS NBI API

import type { RequestHandler} from '@sveltejs/kit';

// Get GenieACS NBI URL from environment
const GENIEACS_NBI_URL = process.env.PUBLIC_GENIEACS_NBI_URL || 'http://localhost:7557';

// GET - Fetch all presets from GenieACS NBI
export const GET: RequestHandler = async () => {
  try {
    // Fetch from GenieACS NBI on GCE backend
    const response = await fetch(`${GENIEACS_NBI_URL}/presets`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`GenieACS NBI error: ${response.status}`);
    }
    
    const presets = await response.json();
    
    return new Response(JSON.stringify({
      success: true,
      presets,
      count: Array.isArray(presets) ? presets.length : 0
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

// POST - Create or Update preset via GenieACS NBI
export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    const presetId = data.id || data.name?.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    
    // PUT to GenieACS NBI (create or update)
    const response = await fetch(`${GENIEACS_NBI_URL}/presets/${encodeURIComponent(presetId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`GenieACS NBI error: ${response.status}`);
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Preset saved successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('GenieACS NBI error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// DELETE - Delete preset via GenieACS NBI
export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const { id } = await request.json();
    
    // DELETE from GenieACS NBI
    const response = await fetch(`${GENIEACS_NBI_URL}/presets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`GenieACS NBI error: ${response.status}`);
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Preset deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('GenieACS NBI error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

