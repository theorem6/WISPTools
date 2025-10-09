// SvelteKit API Route - MongoDB Health Check
// Deploys automatically with App Hosting rollouts - no Functions needed!

import type { RequestHandler } from '@sveltejs/kit';
import { MongoClient } from 'mongodb';
import { MONGODB_URI, MONGODB_DATABASE } from '$env/static/private';

export const GET: RequestHandler = async () => {
  try {
    // Connect to MongoDB
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(MONGODB_DATABASE || 'genieacs');
    
    // Get database stats
    const stats = await db.stats();
    const serverInfo = await db.admin().serverInfo();
    
    // Count documents in collections
    const presetsCount = await db.collection('presets').countDocuments();
    const faultsCount = await db.collection('faults').countDocuments();
    
    await client.close();
    
    return new Response(JSON.stringify({
      success: true,
      connected: true,
      database: db.databaseName,
      serverVersion: serverInfo.version,
      collections: {
        presets: presetsCount,
        faults: faultsCount
      },
      stats: {
        totalCollections: stats.collections,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexes: stats.indexes
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('MongoDB health check failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      hint: 'Check MONGODB_URI environment variable'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

