/**
 * Plan deployment photo storage: MongoDB Atlas (GridFS) when possible, Firebase Storage as fallback.
 */

const mongoose = require('mongoose');
const { Readable } = require('stream');

const BUCKET_NAME = 'deployment_photos';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Store a photo buffer. Prefer MongoDB GridFS; fall back to Firebase Storage if GridFS fails or MongoDB unavailable.
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename (e.g. photo-123.jpg)
 * @param {object} metadata - { planId, userId, tenantId }
 * @param {string} baseUrl - Base URL for GridFS serve links (e.g. https://api.example.com)
 * @returns {Promise<{ url: string, storage: 'mongodb'|'firebase' }>}
 */
async function storePhoto(buffer, filename, metadata, baseUrl) {
  const { planId, userId, tenantId } = metadata || {};

  if (mongoose.connection.readyState === 1) {
    try {
      const db = mongoose.connection.db;
      const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME });
      const id = new mongoose.mongo.ObjectId();
      const opts = { metadata: { planId, userId, tenantId } };
      const uploadStream = bucket.openUploadStreamWithId(id, filename, opts);
      const readable = Readable.from(buffer);
      await new Promise((resolve, reject) => {
        readable.pipe(uploadStream);
        uploadStream.on('finish', resolve);
        uploadStream.on('error', reject);
      });
      const servePath = `/api/plans/deployment-photos/${planId}/${id.toString()}`;
      const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}${servePath}` : servePath;
      return { url, storage: 'mongodb' };
    } catch (err) {
      console.warn('[planDeploymentPhotoStorage] GridFS upload failed, falling back to Firebase:', err.message);
    }
  }

  // Fallback: Firebase Storage
  try {
    const { admin } = require('../config/firebase');
    const storage = admin.storage && admin.storage();
    if (!storage) throw new Error('Firebase Storage not available');
    const bucket = storage.bucket();
    const path = `plans/${planId}/photos/${Date.now()}-${(filename || 'photo').replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const file = bucket.file(path);
    await file.save(buffer, {
      contentType: 'image/jpeg',
      metadata: { planId, userId, tenantId }
    });
    const [url] = await file.getSignedUrl({ action: 'read', expires: '03-01-2500' }).catch(() => [null]);
    const publicUrl = url || `https://storage.googleapis.com/${bucket.name}/${path}`;
    return { url: publicUrl, storage: 'firebase' };
  } catch (err) {
    console.error('[planDeploymentPhotoStorage] Firebase fallback failed:', err);
    throw new Error('Photo storage failed: MongoDB and Firebase both unavailable');
  }
}

/**
 * Stream a photo from GridFS by planId and fileId. Returns null if not found or not in GridFS.
 * @param {string} planId
 * @param {string} fileId - ObjectId string
 * @returns {Promise<{ stream: Readable, contentType: string } | null>}
 */
async function getPhotoStream(planId, fileId) {
  if (mongoose.connection.readyState !== 1) return null;
  try {
    const db = mongoose.connection.db;
    const id = new mongoose.mongo.ObjectId(fileId);
    const file = await db.collection(BUCKET_NAME + '.files').findOne({ _id: id });
    if (!file || (file.metadata && file.metadata.planId !== planId)) return null;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME });
    const stream = bucket.openDownloadStream(id);
    return { stream, contentType: (file.metadata && file.metadata.contentType) || 'image/jpeg' };
  } catch {
    return null;
  }
}

module.exports = { storePhoto, getPhotoStream, BUCKET_NAME };
