// SvelteKit API Route - CPE Devices
// Deploys automatically with App Hosting rollouts

import type { RequestHandler } from '@sveltejs/kit';
import { MongoClient } from 'mongodb';

// Use process.env instead of $env/static/private for compatibility
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'genieacs';

// GET - Fetch all CPE devices
export const GET: RequestHandler = async ({ url }) => {
  try {
    const status = url.searchParams.get('status');
    const limit = url.searchParams.get('limit');
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(MONGODB_DATABASE || 'genieacs');
    
    // Build query filter
    const filter: any = {};
    if (status) filter.status = status;
    
    let query = db.collection('devices').find(filter);
    
    if (limit) {
      query = query.limit(parseInt(limit));
    }
    
    const devices = await query.toArray();
    
    await client.close();
    
    return new Response(JSON.stringify({
      success: true,
      devices,
      count: devices.length
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

