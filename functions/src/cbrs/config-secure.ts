/**
 * CBRS Config Secure Storage
 * Encrypts sensitive tenant CBRS config (credentials, certs) at rest using AES-256-GCM.
 * Key from environment: CBRS_CONFIG_ENCRYPTION_KEY (32-byte hex or base64).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../firebaseInit.js';
import * as crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer | null {
  const raw = process.env.CBRS_CONFIG_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) return null;
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length === 64) {
    return Buffer.from(raw, 'hex');
  }
  const buf = Buffer.from(raw, 'utf8');
  return buf.length >= KEY_LENGTH ? crypto.createHash('sha256').update(buf).digest() : null;
}

function encryptField(plain: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptField(ciphertext: string, key: Buffer): string {
  const buf = Buffer.from(ciphertext, 'base64');
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) throw new Error('Invalid ciphertext');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const enc = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString('utf8') + decipher.final('utf8');
}

const SENSITIVE_KEYS = ['googleUserId', 'googleEmail', 'googleCertificate', 'googlePrivateKey'] as const;

function encryptConfigPayload(config: Record<string, unknown>): Record<string, unknown> {
  const key = getEncryptionKey();
  if (!key) return config;

  const out: Record<string, unknown> = { ...config };
  const encrypted: Record<string, string> = {};
  for (const k of SENSITIVE_KEYS) {
    const v = config[k];
    if (typeof v === 'string' && v) {
      try {
        encrypted[k] = encryptField(v, key);
      } catch (e) {
        console.warn(`[CBRS Config] Encrypt failed for ${k}:`, e);
      }
      delete out[k];
    }
  }
  if (Object.keys(encrypted).length > 0) {
    (out as Record<string, unknown>)._encryptedFields = encrypted;
    (out as Record<string, unknown>)._encrypted = true;
  }
  return out;
}

function decryptConfigPayload(doc: Record<string, unknown>): Record<string, unknown> {
  if (!doc._encrypted || !doc._encryptedFields) return doc;
  const key = getEncryptionKey();
  if (!key) return doc;

  const out = { ...doc };
  delete (out as Record<string, unknown>)._encrypted;
  const fields = out._encryptedFields as Record<string, string> | undefined;
  delete (out as Record<string, unknown>)._encryptedFields;
  if (!fields) return out;

  for (const k of SENSITIVE_KEYS) {
    const v = fields[k];
    if (typeof v === 'string') {
      try {
        (out as Record<string, unknown>)[k] = decryptField(v, key);
      } catch (e) {
        console.warn(`[CBRS Config] Decrypt failed for ${k}:`, e);
      }
    }
  }
  return out;
}

/**
 * Returns decrypted CBRS config for a tenant (for use by proxySASRequest etc.)
 */
export async function getDecryptedCbrsConfig(tenantId: string): Promise<Record<string, unknown> | null> {
  const doc = await db.collection('cbrs_config').doc(tenantId).get();
  if (!doc.exists) return null;
  const data = doc.data() as Record<string, unknown>;
  return decryptConfigPayload(data);
}

/**
 * Callable: save CBRS config with encrypted sensitive fields.
 */
export const saveCbrsConfigSecure = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const config = request.data?.config;
  if (!config || typeof config !== 'object' || !config.tenantId) {
    throw new HttpsError('invalid-argument', 'config with tenantId is required');
  }
  const tenantId = config.tenantId as string;
  const uid = request.auth.uid;

  const userTenant = await db.collection('user_tenants').doc(`${uid}_${tenantId}`).get();
  if (!userTenant.exists) {
    throw new HttpsError('permission-denied', 'No access to this tenant');
  }

  const payload = encryptConfigPayload({
    ...config,
    updatedAt: new Date().toISOString(),
    updatedBy: uid,
  });

  await db.collection('cbrs_config').doc(tenantId).set(payload, { merge: true });
  return { success: true };
});

/**
 * Callable: load CBRS config with decrypted sensitive fields.
 */
export const loadCbrsConfigSecure = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const tenantId = request.data?.tenantId;
  if (!tenantId || typeof tenantId !== 'string') {
    throw new HttpsError('invalid-argument', 'tenantId is required');
  }
  const uid = request.auth.uid;

  const userTenant = await db.collection('user_tenants').doc(`${uid}_${tenantId}`).get();
  if (!userTenant.exists) {
    throw new HttpsError('permission-denied', 'No access to this tenant');
  }

  const doc = await db.collection('cbrs_config').doc(tenantId).get();
  if (!doc.exists) {
    return { success: true, config: null };
  }
  const data = doc.data() as Record<string, unknown>;
  const decrypted = decryptConfigPayload(data);
  return { success: true, config: decrypted };
});
