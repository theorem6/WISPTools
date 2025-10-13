/**
 * HSS Core Service
 * 
 * Implements Home Subscriber Server functionality for LTE/EPC authentication
 * Using Milenage algorithm for authentication vector generation
 * 
 * Standards: 3GPP TS 33.102, 3GPP TS 33.401
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { MongoClient, Db, Collection } from 'mongodb';

// Milenage algorithm implementation
// For production, use a tested library like 'milenage' npm package
import * as Milenage from './milenage';

interface Subscriber {
  imsi: string;
  ki: string;      // 128-bit or 256-bit key (hex string)
  opc: string;     // Operator code (hex string)
  op?: string;     // Alternative: OP value
  sqn: number;     // Sequence number
  status: 'active' | 'inactive' | 'suspended';
  tenantId: string;
}

interface AuthenticationVector {
  rand: string;    // Random challenge (128-bit)
  autn: string;    // Authentication token
  xres: string;    // Expected response
  kasme: string;   // Key for MME
  ck: string;      // Cipher key
  ik: string;      // Integrity key
}

interface AuthenticationRequest {
  imsi: string;
  serving_network_name: string;  // e.g., "5G:mnc001.mcc001.3gppnetwork.org"
  plmn_id?: string;              // Public Land Mobile Network ID
}

export class HSSCoreService {
  private db: Db;
  private subscribersCollection: Collection<Subscriber>;
  private inactiveSubscribersCollection: Collection<Subscriber>;
  private authVectorsCollection: Collection;
  private encryptionKey: Buffer;

  constructor(mongoUri: string, encryptionKey: string) {
    this.encryptionKey = Buffer.from(encryptionKey, 'hex');
    // Initialize MongoDB connection
    this.initializeConnection(mongoUri);
  }

  private async initializeConnection(mongoUri: string): Promise<void> {
    const client = new MongoClient(mongoUri);
    await client.connect();
    this.db = client.db('hss');
    
    this.subscribersCollection = this.db.collection('active_subscribers');
    this.inactiveSubscribersCollection = this.db.collection('inactive_subscribers');
    this.authVectorsCollection = this.db.collection('authentication_vectors');
    
    // Create indexes
    await this.createIndexes();
  }

  private async createIndexes(): Promise<void> {
    await this.subscribersCollection.createIndex({ imsi: 1 }, { unique: true });
    await this.subscribersCollection.createIndex({ tenantId: 1 });
    await this.subscribersCollection.createIndex({ status: 1 });
    await this.subscribersCollection.createIndex({ 'acs.cpe_serial_number': 1 });
    
    await this.inactiveSubscribersCollection.createIndex({ imsi: 1 });
    await this.inactiveSubscribersCollection.createIndex({ 'deactivation.deactivated_at': -1 });
    
    await this.authVectorsCollection.createIndex({ imsi: 1 });
  }

  /**
   * Encrypt sensitive data (Ki, OPc) before storing in database
   */
  private encrypt(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    
    let encrypted = cipher.update(plaintext, 'hex', 'hex');
    encrypted += cipher.final('hex');
    
    // Prepend IV to encrypted data
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data when retrieving from database
   */
  private decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'hex');
    decrypted += decipher.final('hex');
    
    return decrypted;
  }

  /**
   * Generate Authentication Vectors for S6a interface
   * This is the core HSS function called by MME during attach
   */
  async generateAuthenticationVectors(
    request: AuthenticationRequest,
    numVectors: number = 1
  ): Promise<AuthenticationVector[]> {
    // 1. Lookup subscriber
    const subscriber = await this.subscribersCollection.findOne({ 
      imsi: request.imsi,
      status: 'active'
    });

    if (!subscriber) {
      throw new Error(`Subscriber not found or inactive: ${request.imsi}`);
    }

    // 2. Decrypt Ki and OPc
    const ki = this.decrypt(subscriber.ki);
    const opc = this.decrypt(subscriber.opc);

    // 3. Generate authentication vectors
    const vectors: AuthenticationVector[] = [];
    
    for (let i = 0; i < numVectors; i++) {
      // Generate random RAND
      const rand = randomBytes(16).toString('hex');
      
      // Run Milenage algorithm
      const milenageResult = Milenage.f1_f5_f2_f3_f4(
        Buffer.from(ki, 'hex'),
        Buffer.from(rand, 'hex'),
        Buffer.from(opc, 'hex'),
        Buffer.from(request.plmn_id || '00101', 'hex'), // Default PLMN
        subscriber.sqn + i
      );

      vectors.push({
        rand: rand,
        autn: milenageResult.autn.toString('hex'),
        xres: milenageResult.res.toString('hex'),
        kasme: milenageResult.kasme.toString('hex'),
        ck: milenageResult.ck.toString('hex'),
        ik: milenageResult.ik.toString('hex')
      });
    }

    // 4. Update SQN
    await this.subscribersCollection.updateOne(
      { imsi: request.imsi },
      { 
        $inc: { sqn: numVectors },
        $set: { 'metadata.updated_at': new Date() }
      }
    );

    // 5. Store vectors for audit/replay protection
    await this.authVectorsCollection.insertOne({
      imsi: request.imsi,
      vectors: vectors.map(v => ({
        ...v,
        generated_at: new Date(),
        used: false
      })),
      request: request,
      created_at: new Date()
    });

    return vectors;
  }

  /**
   * Add new subscriber to HSS
   */
  async addSubscriber(subscriber: Omit<Subscriber, 'metadata'>): Promise<void> {
    // Validate IMSI format (15 digits)
    if (!/^\d{15}$/.test(subscriber.imsi)) {
      throw new Error('Invalid IMSI format. Must be 15 digits.');
    }

    // Validate Ki (128-bit = 32 hex chars or 256-bit = 64 hex chars)
    if (!/^[0-9A-Fa-f]{32}$/.test(subscriber.ki) && !/^[0-9A-Fa-f]{64}$/.test(subscriber.ki)) {
      throw new Error('Invalid Ki format. Must be 128-bit or 256-bit hex string.');
    }

    // Validate OPc (128-bit = 32 hex chars)
    if (!/^[0-9A-Fa-f]{32}$/.test(subscriber.opc)) {
      throw new Error('Invalid OPc format. Must be 128-bit hex string.');
    }

    // Check if subscriber already exists
    const existing = await this.subscribersCollection.findOne({ imsi: subscriber.imsi });
    if (existing) {
      throw new Error(`Subscriber with IMSI ${subscriber.imsi} already exists`);
    }

    // Encrypt sensitive data
    const encryptedSubscriber = {
      ...subscriber,
      ki: this.encrypt(subscriber.ki),
      opc: this.encrypt(subscriber.opc),
      sqn: subscriber.sqn || 0,
      metadata: {
        created_at: new Date(),
        updated_at: new Date(),
        created_by: 'system'
      }
    };

    await this.subscribersCollection.insertOne(encryptedSubscriber as any);
  }

  /**
   * Deactivate subscriber (move to inactive table)
   */
  async deactivateSubscriber(imsi: string, reason: string, deactivatedBy: string): Promise<void> {
    const subscriber = await this.subscribersCollection.findOne({ imsi });
    
    if (!subscriber) {
      throw new Error(`Subscriber not found: ${imsi}`);
    }

    // Move to inactive collection
    await this.inactiveSubscribersCollection.insertOne({
      ...subscriber,
      deactivation: {
        deactivated_at: new Date(),
        deactivated_by: deactivatedBy,
        reason: reason,
        can_reactivate: true,
        original_data: subscriber
      }
    } as any);

    // Remove from active collection
    await this.subscribersCollection.deleteOne({ imsi });
  }

  /**
   * Reactivate subscriber (move from inactive to active table)
   */
  async reactivateSubscriber(imsi: string, reactivatedBy: string): Promise<void> {
    const inactiveSubscriber = await this.inactiveSubscribersCollection.findOne({ imsi });
    
    if (!inactiveSubscriber) {
      throw new Error(`Inactive subscriber not found: ${imsi}`);
    }

    // Restore to active collection
    const { deactivation, ...subscriberData } = inactiveSubscriber as any;
    
    await this.subscribersCollection.insertOne({
      ...subscriberData,
      status: 'active',
      metadata: {
        ...subscriberData.metadata,
        updated_at: new Date(),
        last_modified_by: reactivatedBy
      }
    });

    // Remove from inactive collection
    await this.inactiveSubscribersCollection.deleteOne({ imsi });
  }

  /**
   * Get subscriber by IMSI
   */
  async getSubscriber(imsi: string, includeCredentials: boolean = false): Promise<Subscriber | null> {
    const subscriber = await this.subscribersCollection.findOne({ imsi });
    
    if (!subscriber) {
      return null;
    }

    // Optionally decrypt credentials
    if (includeCredentials && subscriber.ki && subscriber.opc) {
      return {
        ...subscriber,
        ki: this.decrypt(subscriber.ki),
        opc: this.decrypt(subscriber.opc)
      } as Subscriber;
    }

    // Return without decrypting (for display purposes)
    return {
      ...subscriber,
      ki: '***ENCRYPTED***',
      opc: '***ENCRYPTED***'
    } as Subscriber;
  }

  /**
   * Update subscriber profile (not credentials)
   */
  async updateSubscriberProfile(imsi: string, updates: Partial<Subscriber>): Promise<void> {
    // Prevent updating credentials directly
    const { ki, opc, ...safeUpdates } = updates as any;
    
    await this.subscribersCollection.updateOne(
      { imsi },
      { 
        $set: {
          ...safeUpdates,
          'metadata.updated_at': new Date()
        }
      }
    );
  }

  /**
   * List all active subscribers for a tenant
   */
  async listSubscribers(tenantId: string, limit: number = 100, skip: number = 0): Promise<Subscriber[]> {
    const subscribers = await this.subscribersCollection
      .find({ tenantId, status: 'active' })
      .limit(limit)
      .skip(skip)
      .toArray();

    // Mask credentials
    return subscribers.map(sub => ({
      ...sub,
      ki: '***ENCRYPTED***',
      opc: '***ENCRYPTED***'
    })) as Subscriber[];
  }

  /**
   * List all inactive subscribers for a tenant
   */
  async listInactiveSubscribers(tenantId: string, limit: number = 100, skip: number = 0): Promise<any[]> {
    return await this.inactiveSubscribersCollection
      .find({ tenantId })
      .limit(limit)
      .skip(skip)
      .toArray();
  }

  /**
   * Check if subscriber is allowed to attach (active status check)
   */
  async isSubscriberActive(imsi: string): Promise<boolean> {
    const subscriber = await this.subscribersCollection.findOne({ 
      imsi,
      status: 'active'
    });
    
    return subscriber !== null;
  }

  /**
   * Get subscriber statistics
   */
  async getSubscriberStats(tenantId: string): Promise<{
    total_active: number;
    total_inactive: number;
    total_suspended: number;
    total_with_acs: number;
  }> {
    const [active, inactive, suspended, withAcs] = await Promise.all([
      this.subscribersCollection.countDocuments({ tenantId, status: 'active' }),
      this.inactiveSubscribersCollection.countDocuments({ tenantId }),
      this.subscribersCollection.countDocuments({ tenantId, status: 'suspended' }),
      this.subscribersCollection.countDocuments({ 
        tenantId, 
        'acs.cpe_serial_number': { $exists: true, $ne: null }
      })
    ]);

    return {
      total_active: active,
      total_inactive: inactive,
      total_suspended: suspended,
      total_with_acs: withAcs
    };
  }
}

export default HSSCoreService;

