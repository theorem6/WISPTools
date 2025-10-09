// SvelteKit API Route - Presets CRUD Operations
// Deploys automatically with App Hosting rollouts

import type { RequestHandler } from '@sveltejs/kit';
import { MongoClient } from 'mongodb';
import { MONGODB_URI, MONGODB_DATABASE } from '$env/static/private';

// GET - Fetch all presets
export const GET: RequestHandler = async () => {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(MONGODB_DATABASE || 'genieacs');
    const presets = await db.collection('presets')
      .find({})
      .sort({ weight: 1 })
      .toArray();
    
    await client.close();
    
    return new Response(JSON.stringify({
      success: true,
      presets,
      count: presets.length
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

// POST - Create or Update preset
export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(MONGODB_DATABASE || 'genieacs');
    const presetsCollection = db.collection('presets');
    
    if (data.id) {
      // Update existing preset
      const { id, _id, ...updateData } = data;
      updateData.updatedAt = new Date();
      
      await presetsCollection.updateOne(
        { _id: id },
        { $set: updateData }
      );
      
      const updated = await presetsCollection.findOne({ _id: id });
      await client.close();
      
      return new Response(JSON.stringify({
        success: true,
        preset: updated,
        message: 'Preset updated successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Create new preset
      const presetId = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      const preset = {
        _id: presetId,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await presetsCollection.insertOne(preset);
      await client.close();
      
      return new Response(JSON.stringify({
        success: true,
        preset,
        message: 'Preset created successfully'
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

// DELETE - Delete preset
export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const { id } = await request.json();
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(MONGODB_DATABASE || 'genieacs');
    const result = await db.collection('presets').deleteOne({ _id: id });
    
    await client.close();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Preset deleted successfully',
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

