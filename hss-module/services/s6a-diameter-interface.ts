/**
 * S6a/Diameter Interface for Remote MME Connections
 * 
 * Implements 3GPP TS 29.272 S6a interface
 * Allows remote MMEs to connect and authenticate subscribers
 * 
 * Supported Procedures:
 * - Authentication Information Request/Answer (AIR/AIA)
 * - Update Location Request/Answer (ULR/ULA)
 * - Purge UE Request/Answer (PUR/PUA)
 * - Notify Request/Answer (NOR/NOA)
 * - Cancel Location Request/Answer (CLR/CLA)
 */

import { createServer, Socket } from 'net';
import { EventEmitter } from 'events';
import HSSCoreService from './hss-core';
import { MongoClient, Db, Collection } from 'mongodb';

// Diameter Command Codes (3GPP TS 29.272)
const DIAMETER_COMMANDS = {
  AIR: 318,  // Authentication Information Request
  AIA: 318,  // Authentication Information Answer
  ULR: 316,  // Update Location Request
  ULA: 316,  // Update Location Answer
  PUR: 321,  // Purge UE Request
  PUA: 321,  // Purge UE Answer
  NOR: 323,  // Notify Request
  NOA: 323,  // Notify Answer
  CLR: 317,  // Cancel Location Request
  CLA: 317,  // Cancel Location Answer
  CER: 257,  // Capabilities Exchange Request
  CEA: 257,  // Capabilities Exchange Answer
  DWR: 280,  // Device Watchdog Request
  DWA: 280   // Device Watchdog Answer
};

// Diameter Result Codes
const DIAMETER_RESULT = {
  SUCCESS: 2001,
  COMMAND_UNSUPPORTED: 3001,
  UNABLE_TO_DELIVER: 3002,
  REALM_NOT_SERVED: 3003,
  TOO_BUSY: 3004,
  LOOP_DETECTED: 3005,
  REDIRECT_INDICATION: 3006,
  APPLICATION_UNSUPPORTED: 3007,
  INVALID_HDR_BITS: 3008,
  INVALID_AVP_BITS: 3009,
  UNKNOWN_PEER: 3010,
  AUTHENTICATION_REJECTED: 4001,
  OUT_OF_SPACE: 4002,
  ELECTION_LOST: 4003,
  USER_UNKNOWN: 5001,
  UNKNOWN_SESSION_ID: 5002,
  AUTHORIZATION_REJECTED: 5003,
  INVALID_AVP_VALUE: 5004,
  MISSING_AVP: 5005,
  RESOURCES_EXCEEDED: 5006,
  CONTRADICTING_AVPS: 5007,
  AVP_NOT_ALLOWED: 5008,
  AVP_OCCURS_TOO_MANY_TIMES: 5009,
  NO_COMMON_APPLICATION: 5010,
  UNSUPPORTED_VERSION: 5011,
  UNABLE_TO_COMPLY: 5012,
  INVALID_BIT_IN_HEADER: 5013,
  INVALID_AVP_LENGTH: 5014,
  INVALID_MESSAGE_LENGTH: 5015,
  INVALID_AVP_BIT_COMBO: 5016,
  NO_COMMON_SECURITY: 5017
};

// Diameter AVP Codes (subset for S6a)
const AVP_CODES = {
  USER_NAME: 1,
  RESULT_CODE: 268,
  ORIGIN_HOST: 264,
  ORIGIN_REALM: 296,
  DESTINATION_HOST: 293,
  DESTINATION_REALM: 283,
  SESSION_ID: 263,
  AUTH_SESSION_STATE: 277,
  VENDOR_SPECIFIC_APP_ID: 260,
  SUPPORTED_FEATURES: 628,
  REQUESTED_EUTRAN_AUTH_INFO: 1408,
  AUTH_INFO: 1413,
  E_UTRAN_VECTOR: 1414,
  RAND: 1447,
  XRES: 1448,
  AUTN: 1449,
  KASME: 1450,
  ULR_FLAGS: 1405,
  ULA_FLAGS: 1406,
  VISITED_PLMN_ID: 1407,
  RAT_TYPE: 1032,
  SUBSCRIPTION_DATA: 1400,
  SUBSCRIBER_STATUS: 1424,
  MSISDN: 701,
  IMEI: 1402,
  AMBR: 1435,
  APN_CONFIGURATION_PROFILE: 1429,
  CONTEXT_IDENTIFIER: 1423,
  PDN_TYPE: 1456,
  QOS_SUBSCRIBED: 1404,
  MAX_REQUESTED_BW_DL: 515,
  MAX_REQUESTED_BW_UL: 516
};

interface DiameterMessage {
  version: number;
  length: number;
  flags: {
    request: boolean;
    proxyable: boolean;
    error: boolean;
    retransmit: boolean;
  };
  commandCode: number;
  applicationId: number;
  hopByHopId: number;
  endToEndId: number;
  avps: DiameterAVP[];
}

interface DiameterAVP {
  code: number;
  flags: {
    vendor: boolean;
    mandatory: boolean;
    protected: boolean;
  };
  vendorId?: number;
  data: Buffer | DiameterAVP[];
}

interface MMEConnection {
  socket: Socket;
  mmeRealm: string;
  mmeHost: string;
  connected: boolean;
  lastActivity: Date;
}

export class S6aDiameterInterface extends EventEmitter {
  private server: any;
  private hssCore: HSSCoreService;
  private db: Db;
  private mmeConnectionsCollection: Collection;
  private subscribersCollection: Collection;
  private sessionsCollection: Collection;
  
  private connections: Map<string, MMEConnection> = new Map();
  private config: {
    host: string;
    port: number;
    realm: string;
    identity: string;
  };

  constructor(
    mongoUri: string,
    encryptionKey: string,
    config: {
      host?: string;
      port?: number;
      realm: string;
      identity: string;
    }
  ) {
    super();
    
    this.config = {
      host: config.host || '0.0.0.0',
      port: config.port || 3868,  // Standard Diameter port
      realm: config.realm,
      identity: config.identity
    };
    
    this.hssCore = new HSSCoreService(mongoUri, encryptionKey);
    this.initializeDatabase(mongoUri);
  }

  private async initializeDatabase(mongoUri: string): Promise<void> {
    const client = new MongoClient(mongoUri);
    await client.connect();
    
    this.db = client.db('hss');
    this.mmeConnectionsCollection = this.db.collection('mme_connections');
    this.subscribersCollection = this.db.collection('active_subscribers');
    this.sessionsCollection = this.db.collection('subscriber_sessions');
  }

  /**
   * Start S6a Diameter server
   */
  async start(): Promise<void> {
    this.server = createServer((socket: Socket) => {
      console.log(`New MME connection from ${socket.remoteAddress}:${socket.remotePort}`);
      
      socket.on('data', (data: Buffer) => {
        this.handleIncomingMessage(socket, data);
      });
      
      socket.on('error', (err: Error) => {
        console.error('Socket error:', err);
      });
      
      socket.on('close', () => {
        console.log(`MME disconnected: ${socket.remoteAddress}`);
        this.handleDisconnection(socket);
      });
    });

    this.server.listen(this.config.port, this.config.host, () => {
      console.log(`✅ S6a Diameter Interface listening on ${this.config.host}:${this.config.port}`);
      console.log(`   Realm: ${this.config.realm}`);
      console.log(`   Identity: ${this.config.identity}`);
    });

    // Start watchdog timer
    setInterval(() => this.sendWatchdogRequests(), 30000);
  }

  /**
   * Stop S6a server
   */
  async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
      console.log('S6a Diameter Interface stopped');
    }
  }

  /**
   * Handle incoming Diameter message
   */
  private async handleIncomingMessage(socket: Socket, data: Buffer): Promise<void> {
    try {
      const message = this.parseDiameterMessage(data);
      
      // Update connection last activity
      const connectionKey = `${socket.remoteAddress}:${socket.remotePort}`;
      if (this.connections.has(connectionKey)) {
        const conn = this.connections.get(connectionKey)!;
        conn.lastActivity = new Date();
      }
      
      // Route message based on command code
      switch (message.commandCode) {
        case DIAMETER_COMMANDS.CER:
          await this.handleCapabilitiesExchange(socket, message);
          break;
          
        case DIAMETER_COMMANDS.DWR:
          await this.handleDeviceWatchdog(socket, message);
          break;
          
        case DIAMETER_COMMANDS.AIR:
          await this.handleAuthenticationInformationRequest(socket, message);
          break;
          
        case DIAMETER_COMMANDS.ULR:
          await this.handleUpdateLocationRequest(socket, message);
          break;
          
        case DIAMETER_COMMANDS.PUR:
          await this.handlePurgeUERequest(socket, message);
          break;
          
        default:
          console.warn(`Unsupported command code: ${message.commandCode}`);
          await this.sendErrorResponse(socket, message, DIAMETER_RESULT.COMMAND_UNSUPPORTED);
      }
      
    } catch (error) {
      console.error('Error handling Diameter message:', error);
    }
  }

  /**
   * Handle Authentication Information Request (AIR)
   * MME requests authentication vectors for subscriber
   */
  private async handleAuthenticationInformationRequest(
    socket: Socket,
    message: DiameterMessage
  ): Promise<void> {
    try {
      // Extract IMSI from User-Name AVP
      const userNameAvp = this.findAVP(message.avps, AVP_CODES.USER_NAME);
      if (!userNameAvp) {
        await this.sendErrorResponse(socket, message, DIAMETER_RESULT.MISSING_AVP);
        return;
      }
      
      const imsi = userNameAvp.data.toString('utf8');
      
      // Extract Visited PLMN ID
      const visitedPlmnAvp = this.findAVP(message.avps, AVP_CODES.VISITED_PLMN_ID);
      const visitedPlmn = visitedPlmnAvp ? visitedPlmnAvp.data : Buffer.from([0x00, 0x01, 0x01]);
      
      // Extract number of requested vectors
      const requestedAuthAvp = this.findAVP(message.avps, AVP_CODES.REQUESTED_EUTRAN_AUTH_INFO);
      const numVectors = requestedAuthAvp ? 
        this.parseRequestedAuthInfo(requestedAuthAvp.data) : 1;
      
      console.log(`AIR from MME for IMSI: ${imsi}, requesting ${numVectors} vectors`);
      
      // Check if subscriber is active
      const subscriber = await this.subscribersCollection.findOne({ imsi, status: 'active' });
      
      if (!subscriber) {
        console.log(`User unknown: ${imsi}`);
        await this.sendErrorResponse(socket, message, DIAMETER_RESULT.USER_UNKNOWN);
        return;
      }
      
      // Generate authentication vectors
      const vectors = await this.hssCore.generateAuthenticationVectors({
        imsi: imsi,
        serving_network_name: `5G:mnc${visitedPlmn.toString('hex').substring(2, 5)}.mcc${visitedPlmn.toString('hex').substring(0, 2)}.3gppnetwork.org`,
        plmn_id: visitedPlmn.toString('hex')
      }, numVectors);
      
      // Build AIA response
      const response = this.buildAuthenticationInformationAnswer(message, vectors, imsi);
      
      // Send response
      socket.write(this.encodeDiameterMessage(response));
      
      console.log(`✅ Sent AIA with ${numVectors} vectors for ${imsi}`);
      
      // Log to statistics
      await this.logAuthenticationRequest(socket, imsi, true);
      
    } catch (error: any) {
      console.error('Error handling AIR:', error);
      await this.sendErrorResponse(socket, message, DIAMETER_RESULT.UNABLE_TO_COMPLY);
      await this.logAuthenticationRequest(socket, '', false);
    }
  }

  /**
   * Handle Update Location Request (ULR)
   * MME informs HSS of subscriber location and requests subscription data
   */
  private async handleUpdateLocationRequest(
    socket: Socket,
    message: DiameterMessage
  ): Promise<void> {
    try {
      // Extract parameters
      const userNameAvp = this.findAVP(message.avps, AVP_CODES.USER_NAME);
      const imsi = userNameAvp!.data.toString('utf8');
      
      const visitedPlmnAvp = this.findAVP(message.avps, AVP_CODES.VISITED_PLMN_ID);
      const ratTypeAvp = this.findAVP(message.avps, AVP_CODES.RAT_TYPE);
      const ulrFlagsAvp = this.findAVP(message.avps, AVP_CODES.ULR_FLAGS);
      
      // Extract IMEI if provided (capture when UE comes online)
      const imeiAvp = this.findAVP(message.avps, AVP_CODES.IMEI);
      let imei: string | null = null;
      if (imeiAvp) {
        imei = this.decodeIMEI(imeiAvp.data);
        console.log(`📱 Captured IMEI for ${imsi}: ${imei}`);
        
        // Update subscriber with IMEI
        await this.updateSubscriberIMEI(imsi, imei);
      }
      
      // Get subscriber data
      const subscriber = await this.subscribersCollection.findOne({ imsi });
      
      if (!subscriber) {
        await this.sendErrorResponse(socket, message, DIAMETER_RESULT.USER_UNKNOWN);
        return;
      }
      
      // Update MME tracking
      const mmeRealm = this.findAVP(message.avps, AVP_CODES.ORIGIN_REALM)?.data.toString('utf8') || 'unknown';
      const mmeHost = this.findAVP(message.avps, AVP_CODES.ORIGIN_HOST)?.data.toString('utf8') || 'unknown';
      
      await this.updateSubscriberLocation(imsi, {
        mme_realm: mmeRealm,
        mme_host: mmeHost,
        visited_plmn: visitedPlmnAvp ? visitedPlmnAvp.data.toString('hex') : null,
        rat_type: ratTypeAvp ? ratTypeAvp.data.readUInt32BE(0) : null
      });
      
      // Build subscription data
      const subscriptionData = await this.buildSubscriptionData(subscriber);
      
      // Build ULA response
      const response = this.buildUpdateLocationAnswer(message, subscriptionData, subscriber);
      
      // Send response
      socket.write(this.encodeDiameterMessage(response));
      
      console.log(`✅ Sent ULA for ${imsi} - Location updated`);
      
      // Create session record
      await this.createSessionRecord(imsi, imei, mmeRealm, subscriber);
      
    } catch (error) {
      console.error('Error handling ULR:', error);
      await this.sendErrorResponse(socket, message, DIAMETER_RESULT.UNABLE_TO_COMPLY);
    }
  }

  /**
   * Handle Purge UE Request (PUR)
   * MME informs HSS that UE is detached
   */
  private async handlePurgeUERequest(
    socket: Socket,
    message: DiameterMessage
  ): Promise<void> {
    try {
      const userNameAvp = this.findAVP(message.avps, AVP_CODES.USER_NAME);
      const imsi = userNameAvp!.data.toString('utf8');
      
      console.log(`PUR from MME for IMSI: ${imsi}`);
      
      // Update subscriber - remove MME context
      await this.subscribersCollection.updateOne(
        { imsi },
        {
          $set: {
            'mme_tracking.current_serving_mme': null,
            'metadata.updated_at': new Date()
          }
        }
      );
      
      // End active sessions
      await this.sessionsCollection.updateMany(
        { imsi, status: 'active' },
        {
          $set: {
            status: 'disconnected',
            ended_at: new Date(),
            disconnect_reason: 'purge'
          }
        }
      );
      
      // Build PUA response
      const response: DiameterMessage = {
        ...message,
        flags: { ...message.flags, request: false },
        avps: [
          ...message.avps.filter(avp => 
            avp.code === AVP_CODES.SESSION_ID ||
            avp.code === AVP_CODES.ORIGIN_HOST ||
            avp.code === AVP_CODES.ORIGIN_REALM
          ),
          this.createAVP(AVP_CODES.RESULT_CODE, Buffer.from([
            0, 0, (DIAMETER_RESULT.SUCCESS >> 8) & 0xFF, DIAMETER_RESULT.SUCCESS & 0xFF
          ]))
        ]
      };
      
      socket.write(this.encodeDiameterMessage(response));
      
      console.log(`✅ Sent PUA for ${imsi}`);
      
    } catch (error) {
      console.error('Error handling PUR:', error);
      await this.sendErrorResponse(socket, message, DIAMETER_RESULT.UNABLE_TO_COMPLY);
    }
  }

  /**
   * Update subscriber with captured IMEI
   */
  private async updateSubscriberIMEI(imsi: string, imei: string): Promise<void> {
    const subscriber = await this.subscribersCollection.findOne({ imsi });
    
    if (!subscriber) return;
    
    const now = new Date();
    const updates: any = {
      'device_info.last_seen': now,
      'metadata.updated_at': now
    };
    
    // Check if this is a new IMEI
    if (!subscriber.device_info?.imei || subscriber.device_info.imei !== imei) {
      // New IMEI detected
      updates['device_info.imei'] = imei;
      
      if (!subscriber.device_info?.first_seen) {
        updates['device_info.first_seen'] = now;
      }
      
      // Add to history
      if (subscriber.device_info?.imei) {
        updates.$push = {
          'device_info.history': {
            imei: subscriber.device_info.imei,
            first_seen: subscriber.device_info.first_seen || now,
            last_seen: subscriber.device_info.last_seen || now
          }
        };
      }
      
      console.log(`📱 New IMEI registered for ${imsi}: ${imei}`);
      this.emit('imei-registered', { imsi, imei, timestamp: now });
    }
    
    await this.subscribersCollection.updateOne({ imsi }, { $set: updates });
  }

  /**
   * Update subscriber location and MME tracking
   */
  private async updateSubscriberLocation(
    imsi: string,
    location: {
      mme_realm: string;
      mme_host: string;
      visited_plmn: string | null;
      rat_type: number | null;
    }
  ): Promise<void> {
    await this.subscribersCollection.updateOne(
      { imsi },
      {
        $set: {
          'mme_tracking.last_mme_realm': location.mme_realm,
          'mme_tracking.last_mme_host': location.mme_host,
          'mme_tracking.current_serving_mme': location.mme_host,
          'mme_tracking.last_location_update': new Date(),
          'metadata.updated_at': new Date()
        }
      }
    );
  }

  /**
   * Build subscription data for ULA response
   */
  private async buildSubscriptionData(subscriber: any): Promise<any> {
    // Get group settings if subscriber is in a group
    let groupSettings = null;
    let bandwidthPlan = null;
    
    if (subscriber.group_membership?.group_id) {
      const group = await this.db.collection('subscriber_groups').findOne({
        group_id: subscriber.group_membership.group_id
      });
      
      if (group) {
        groupSettings = group;
        
        // Get bandwidth plan
        const planId = subscriber.bandwidth_plan?.plan_id || group.default_plan_id;
        if (planId) {
          bandwidthPlan = await this.db.collection('bandwidth_plans').findOne({
            plan_id: planId
          });
        }
      }
    }
    
    // Build AMBR (Aggregate Maximum Bit Rate)
    const ambr = {
      max_bandwidth_dl: bandwidthPlan?.bandwidth?.download_mbps * 1000000 || 100000000,
      max_bandwidth_ul: bandwidthPlan?.bandwidth?.upload_mbps * 1000000 || 50000000
    };
    
    // Build APN configurations
    const apnConfigs = subscriber.profile?.apn_config || [{
      apn: subscriber.profile?.apn || 'internet',
      qci: bandwidthPlan?.qos?.qci || 9,
      pdp_type: 'IPv4v6'
    }];
    
    return {
      subscriber_status: subscriber.status === 'active' ? 0 : 1,
      msisdn: subscriber.user_info?.msisdn || subscriber.profile?.msisdn,
      ambr: ambr,
      apn_configurations: apnConfigs,
      qos: bandwidthPlan?.qos || { qci: 9 }
    };
  }

  /**
   * Create session record when UE attaches
   */
  private async createSessionRecord(
    imsi: string,
    imei: string | null,
    mmeRealm: string,
    subscriber: any
  ): Promise<void> {
    const sessionId = `sess_${imsi}_${Date.now()}`;
    
    await this.sessionsCollection.insertOne({
      session_id: sessionId,
      tenantId: subscriber.tenantId,
      imsi: imsi,
      imei: imei,
      msisdn: subscriber.user_info?.msisdn,
      network: {
        serving_mme: mmeRealm
      },
      started_at: new Date(),
      status: 'active',
      usage: {
        bytes_uploaded: 0,
        bytes_downloaded: 0,
        total_bytes: 0
      },
      qos_applied: {
        plan_id: subscriber.bandwidth_plan?.plan_id,
        group_id: subscriber.group_membership?.group_id
      }
    });
  }

  /**
   * Helper: Find AVP in message
   */
  private findAVP(avps: DiameterAVP[], code: number): DiameterAVP | undefined {
    return avps.find(avp => avp.code === code);
  }

  /**
   * Helper: Create AVP
   */
  private createAVP(code: number, data: Buffer, flags = { vendor: false, mandatory: true, protected: false }): DiameterAVP {
    return { code, flags, data };
  }

  /**
   * Helper: Decode IMEI from Diameter format
   */
  private decodeIMEI(data: Buffer): string {
    // IMEI is encoded as TBCD (Telephony Binary Coded Decimal)
    let imei = '';
    for (let i = 0; i < data.length; i++) {
      const low = data[i] & 0x0F;
      const high = (data[i] >> 4) & 0x0F;
      if (low !== 0x0F) imei += low.toString();
      if (high !== 0x0F) imei += high.toString();
    }
    return imei;
  }

  // Placeholder methods (to be implemented with actual Diameter protocol encoding)
  private parseDiameterMessage(data: Buffer): DiameterMessage {
    // TODO: Implement proper Diameter message parsing
    // For production, use a library like 'diameter' or 'node-diameter'
    throw new Error('Diameter parsing not implemented - use diameter library');
  }

  private encodeDiameterMessage(message: DiameterMessage): Buffer {
    // TODO: Implement proper Diameter message encoding
    throw new Error('Diameter encoding not implemented - use diameter library');
  }

  private buildAuthenticationInformationAnswer(message: DiameterMessage, vectors: any[], imsi: string): DiameterMessage {
    // TODO: Build proper AIA message
    throw new Error('AIA building not implemented');
  }

  private buildUpdateLocationAnswer(message: DiameterMessage, subscriptionData: any, subscriber: any): DiameterMessage {
    // TODO: Build proper ULA message
    throw new Error('ULA building not implemented');
  }

  private async sendErrorResponse(socket: Socket, message: DiameterMessage, resultCode: number): Promise<void> {
    // TODO: Build and send error response
    console.error(`Sending error response: ${resultCode}`);
  }

  private async handleCapabilitiesExchange(socket: Socket, message: DiameterMessage): Promise<void> {
    // TODO: Handle CER/CEA
    console.log('Handling Capabilities Exchange');
  }

  private async handleDeviceWatchdog(socket: Socket, message: DiameterMessage): Promise<void> {
    // TODO: Handle DWR/DWA
    console.log('Handling Device Watchdog');
  }

  private sendWatchdogRequests(): void {
    // TODO: Send DWR to all connected MMEs
  }

  private handleDisconnection(socket: Socket): void {
    const key = `${socket.remoteAddress}:${socket.remotePort}`;
    this.connections.delete(key);
  }

  private parseRequestedAuthInfo(data: Buffer): number {
    // Parse number of requested vectors from AVP
    return 1; // Default
  }

  private async logAuthenticationRequest(socket: Socket, imsi: string, success: boolean): Promise<void> {
    // Log to statistics collection
  }
}

export default S6aDiameterInterface;

