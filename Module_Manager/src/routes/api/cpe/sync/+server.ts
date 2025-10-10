// SvelteKit API Route - Sync CPE Devices from GenieACS MongoDB
// Deploys automatically with App Hosting rollouts

import type { RequestHandler } from '@sveltejs/kit';
import { MongoClient } from 'mongodb';
// Use process.env instead of $env/static/private for compatibility
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'genieacs';

// POST - Sync devices from GenieACS MongoDB
export const POST: RequestHandler = async () => {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(MONGODB_DATABASE || 'genieacs');
    
    // Get all devices from GenieACS devices collection
    const devices = await db.collection('devices').find({}).toArray();
    
    await client.close();
    
    return new Response(JSON.stringify({
      success: true,
      message: `Synced ${devices.length} devices from GenieACS`,
      synced: devices.length,
      devices
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Failed to sync CPE devices:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

