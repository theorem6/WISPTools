// SvelteKit API Route - Faults CRUD Operations
// Deploys automatically with App Hosting rollouts

import type { RequestHandler } from '@sveltejs/kit';
import { MongoClient } from 'mongodb';
import { MONGODB_URI, MONGODB_DATABASE } from '$env/static/private';

// GET - Fetch all faults
export const GET: RequestHandler = async ({ url }) => {
  try {
    const severity = url.searchParams.get('severity');
    const status = url.searchParams.get('status');
    const limit = url.searchParams.get('limit');
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(MONGODB_DATABASE || 'genieacs');
    
    // Build query filter
    const filter: any = {};
    if (severity) filter.severity = severity;
    if (status) filter.status = status;
    
    let query = db.collection('faults').find(filter).sort({ timestamp: -1 });
    
    if (limit) {
      query = query.limit(parseInt(limit));
    }
    
    const faults = await query.toArray();
    
    await client.close();
    
    return new Response(JSON.stringify({
      success: true,
      faults,
      count: faults.length
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

