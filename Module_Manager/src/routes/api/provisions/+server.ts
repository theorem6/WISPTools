// SvelteKit API Route - Provisions CRUD Operations
// Deploys automatically with App Hosting rollouts

import type { RequestHandler } from '@sveltejs/kit';
import { MongoClient } from 'mongodb';
// Use process.env instead of $env/static/private for compatibility
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'genieacs';

// GET - Fetch all provisions
export const GET: RequestHandler = async ({ url }) => {
  try {
    const enabled = url.searchParams.get('enabled');
    const limit = url.searchParams.get('limit');
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(MONGODB_DATABASE || 'genieacs');
    
    // Build query filter
    const filter: any = {};
    if (enabled) filter.enabled = enabled === 'true';
    
    let query = db.collection('provisions').find(filter);
    
    if (limit) {
      query = query.limit(parseInt(limit));
    }
    
    const provisions = await query.toArray();
    
    await client.close();
    
    return new Response(JSON.stringify({
      success: true,
      provisions,
      count: provisions.length
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

// POST - Create or Update provision
export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(MONGODB_DATABASE || 'genieacs');
    const provisionsCollection = db.collection('provisions');
    
    if (data.id) {
      // Update existing provision
      const { id, _id, ...updateData } = data;
      updateData.updatedAt = new Date();
      
      await provisionsCollection.updateOne(
        { _id: id },
        { $set: updateData }
      );
      
      const updated = await provisionsCollection.findOne({ _id: id });
      await client.close();
      
      return new Response(JSON.stringify({
        success: true,
        provision: updated,
        message: 'Provision updated successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Create new provision
      const provisionId = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      const provision = {
        _id: provisionId,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await provisionsCollection.insertOne(provision);
      await client.close();
      
      return new Response(JSON.stringify({
        success: true,
        provision,
        message: 'Provision created successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
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

// DELETE - Delete provision
export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const { id } = await request.json();
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(MONGODB_DATABASE || 'genieacs');
    const result = await db.collection('provisions').deleteOne({ _id: id });
    
    await client.close();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Provision deleted successfully',
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

