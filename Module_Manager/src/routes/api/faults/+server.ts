// SvelteKit API Route - Faults CRUD Operations
// Proxy to GCE GenieACS NBI API

import type { RequestHandler } from '@sveltejs/kit';

// Get GenieACS NBI URL from environment
const GENIEACS_NBI_URL = process.env.PUBLIC_GENIEACS_NBI_URL || 'http://localhost:7557';

// GET - Fetch all faults from GenieACS NBI
export const GET: RequestHandler = async ({ url }) => {
  try {
    const severity = url.searchParams.get('severity');
    const status = url.searchParams.get('status');
    const limit = url.searchParams.get('limit');
    
    // Build query for GenieACS NBI
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit);
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    
    // Fetch from GenieACS NBI on GCE backend
    const response = await fetch(`${GENIEACS_NBI_URL}/faults${queryString}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`GenieACS NBI error: ${response.status}`);
    }
    
    const faults = await response.json();
    
    return new Response(JSON.stringify({
      success: true,
      faults,
      count: Array.isArray(faults) ? faults.length : 0
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

// POST - Acknowledge/Resolve fault
export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(MONGODB_DATABASE || 'genieacs');
    
    const updateData = {
      status: 'Resolved',
      resolution: data.resolution || 'Fault acknowledged and resolved',
      resolvedBy: data.resolvedBy || 'admin',
      resolvedAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('faults').updateOne(
      { _id: data.id },
      { $set: updateData }
    );
    
    const updated = await db.collection('faults').findOne({ _id: data.id });
    
    await client.close();
    
    return new Response(JSON.stringify({
      success: true,
      fault: updated,
      message: 'Fault acknowledged and resolved'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// DELETE - Delete fault
export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const { id } = await request.json();
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(MONGODB_DATABASE || 'genieacs');
    const result = await db.collection('faults').deleteOne({ _id: id });
    
    await client.close();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Fault deleted successfully',
      deletedCount: result.deletedCount
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

