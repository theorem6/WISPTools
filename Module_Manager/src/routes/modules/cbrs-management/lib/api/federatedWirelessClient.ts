/**
 * Federated Wireless SAS API Client
 * Implements WinnForum SAS-CBSD Interface with Federated Wireless enhancements
 */

import type {
  CBSDDevice,
  RegistrationResponse,
  GrantRequest,
  GrantResponse,
  HeartbeatRequest,
  HeartbeatResponse,
  SpectrumInquiryRequest,
  SpectrumInquiryResponse,
  DeregistrationRequest,
  RelinquishmentRequest,
  SASResponse
} from '../models/cbsdDevice';

/**
 * Federated Wireless specific configuration
 */
export interface FederatedWirelessConfig {
  apiEndpoint: string;
  apiKey: string;
  certificatePath?: string;
  privateKeyPath?: string;
  customerId: string; // Federated Wireless customer ID
  tenantId: string;
}

/**
 * Federated Wireless Enhanced Features
 */
export interface FederatedWirelessEnhancements {
  // Real-time interference monitoring
  interferenceMonitoring?: boolean;
  // Advanced analytics
  analyticsEnabled?: boolean;
  // Automated optimization
  autoOptimization?: boolean;
  // Multi-site coordination
  multiSiteCoordination?: boolean;
}

/**
 * Federated Wireless Analytics Data
 */
export interface FederatedWirelessAnalytics {
  cbsdId: string;
  timestamp: Date;
  metrics: {
    throughput?: number; // Mbps
    latency?: number; // ms
    packetLoss?: number; // percentage
    connectedUsers?: number;
    interferenceLevel?: number; // dBm
    spectrumEfficiency?: number;
  };
}

/**
 * Federated Wireless API Client
 */
export class FederatedWirelessClient {
  private config: FederatedWirelessConfig;
  private baseUrl: string;
  private enhancements: FederatedWirelessEnhancements;

  constructor(
    config: FederatedWirelessConfig,
    enhancements: FederatedWirelessEnhancements = {}
  ) {
    this.config = config;
    // Federated Wireless Production endpoint
    this.baseUrl = config.apiEndpoint || 'https://sas.federatedwireless.com/api/v1';
    this.enhancements = enhancements;
  }

  /**
   * Register a CBSD with Federated Wireless SAS
   */
  async registerDevice(device: CBSDDevice): Promise<RegistrationResponse> {
    try {
      const registrationRequest = {
        registrationRequest: [
          {
            cbsdSerialNumber: device.cbsdSerialNumber,
            fccId: device.fccId,
            userId: device.userId,
            callSign: device.callSign,
            cbsdCategory: device.cbsdCategory,
            cbsdInfo: device.cbsdInfo,
            airInterface: {
              radioTechnology: 'E_UTRA'
            },
            installationParam: {
              latitude: device.installationParam.latitude,
              longitude: device.installationParam.longitude,
              height: device.installationParam.height || 1.5,
              heightType: device.installationParam.heightType || 'AGL',
              horizontalAccuracy: device.installationParam.horizontalAccuracy || 50,
              verticalAccuracy: device.installationParam.verticalAccuracy || 3,
              indoorDeployment: device.installationParam.indoorDeployment || false,
              antennaAzimuth: device.installationParam.antennaAzimuth,
              antennaDowntilt: device.installationParam.antennaDowntilt,
              antennaGain: device.installationParam.antennaGain,
              antennaBeamwidth: device.installationParam.antennaBeamwidth
            },
            measCapability: device.measCapability || [],
            // Federated Wireless specific fields
            customerId: this.config.customerId
          }
        ]
      };

      console.log('[Federated Wireless] Registering device:', device.cbsdSerialNumber);
      
      const response = await this.makeRequest('/registration', registrationRequest);
      
      if (response.registrationResponse && response.registrationResponse[0]) {
        const regResponse = response.registrationResponse[0];
        return {
          responseCode: regResponse.response.responseCode,
          responseMessage: regResponse.response.responseMessage,
          cbsdId: regResponse.cbsdId
        };
      }

      throw new Error('Invalid registration response from Federated Wireless');
    } catch (error) {
      console.error('[Federated Wireless] Registration error:', error);
      throw error;
    }
  }

  /**
   * Request spectrum inquiry with Federated Wireless enhancements
   */
  async spectrumInquiry(request: SpectrumInquiryRequest): Promise<SpectrumInquiryResponse> {
    try {
      const inquiryRequest = {
        spectrumInquiryRequest: [
          {
            cbsdId: request.cbsdId,
            inquiredSpectrum: request.inquiredSpectrum.map(range => ({
              lowFrequency: range.lowFrequency,
              highFrequency: range.highFrequency
            })),
            // Federated Wireless enhancements
            requestEnhancedAnalytics: this.enhancements.analyticsEnabled || false
          }
        ]
      };

      console.log('[Federated Wireless] Spectrum inquiry for CBSD:', request.cbsdId);
      
      const response = await this.makeRequest('/spectrumInquiry', inquiryRequest);
      
      if (response.spectrumInquiryResponse && response.spectrumInquiryResponse[0]) {
        const inquiryResponse = response.spectrumInquiryResponse[0];
        return {
          cbsdId: inquiryResponse.cbsdId,
          availableChannel: inquiryResponse.availableChannel || []
        };
      }

      throw new Error('Invalid spectrum inquiry response from Federated Wireless');
    } catch (error) {
      console.error('[Federated Wireless] Spectrum inquiry error:', error);
      throw error;
    }
  }

  /**
   * Request a grant with optimization
   */
  async requestGrant(request: GrantRequest): Promise<GrantResponse> {
    try {
      const grantRequest = {
        grantRequest: [
          {
            cbsdId: request.cbsdId,
            operationParam: {
              maxEirp: request.operationParam.maxEirp,
              operationFrequencyRange: {
                lowFrequency: request.operationParam.operationFrequencyRange.lowFrequency,
                highFrequency: request.operationParam.operationFrequencyRange.highFrequency
              }
            },
            // Federated Wireless optimization flags
            enableAutoOptimization: this.enhancements.autoOptimization || false
          }
        ]
      };

      console.log('[Federated Wireless] Requesting grant for CBSD:', request.cbsdId);
      
      const response = await this.makeRequest('/grant', grantRequest);
      
      if (response.grantResponse && response.grantResponse[0]) {
        const grantResp = response.grantResponse[0];
        return {
          cbsdId: grantResp.cbsdId,
          responseCode: grantResp.response.responseCode,
          responseMessage: grantResp.response.responseMessage,
          grantId: grantResp.grantId,
          grantExpireTime: grantResp.grantExpireTime ? new Date(grantResp.grantExpireTime) : undefined,
          heartbeatInterval: grantResp.heartbeatInterval,
          channelType: grantResp.channelType,
          operationParam: grantResp.operationParam
        };
      }

      throw new Error('Invalid grant response from Federated Wireless');
    } catch (error) {
      console.error('[Federated Wireless] Grant request error:', error);
      throw error;
    }
  }

  /**
   * Send heartbeat with enhanced monitoring
   */
  async sendHeartbeat(request: HeartbeatRequest): Promise<HeartbeatResponse> {
    try {
      const heartbeatRequest = {
        heartbeatRequest: [
          {
            cbsdId: request.cbsdId,
            grantId: request.grantId,
            operationState: request.operationState,
            measReport: request.measReport,
            // Federated Wireless enhancements
            requestInterferenceAnalysis: this.enhancements.interferenceMonitoring || false
          }
        ]
      };

      const response = await this.makeRequest('/heartbeat', heartbeatRequest);
      
      if (response.heartbeatResponse && response.heartbeatResponse[0]) {
        const hbResponse = response.heartbeatResponse[0];
        return {
          cbsdId: hbResponse.cbsdId,
          grantId: hbResponse.grantId,
          responseCode: hbResponse.response.responseCode,
          responseMessage: hbResponse.response.responseMessage,
          transmitExpireTime: hbResponse.transmitExpireTime ? new Date(hbResponse.transmitExpireTime) : undefined,
          grantExpireTime: hbResponse.grantExpireTime ? new Date(hbResponse.grantExpireTime) : undefined,
          heartbeatInterval: hbResponse.heartbeatInterval,
          operationParam: hbResponse.operationParam
        };
      }

      throw new Error('Invalid heartbeat response from Federated Wireless');
    } catch (error) {
      console.error('[Federated Wireless] Heartbeat error:', error);
      throw error;
    }
  }

  /**
   * Relinquish a grant
   */
  async relinquishGrant(request: RelinquishmentRequest): Promise<SASResponse> {
    try {
      const relinquishmentRequest = {
        relinquishmentRequest: [
          {
            cbsdId: request.cbsdId,
            grantId: request.grantId
          }
        ]
      };

      console.log('[Federated Wireless] Relinquishing grant:', request.grantId);
      
      const response = await this.makeRequest('/relinquishment', relinquishmentRequest);
      
      if (response.relinquishmentResponse && response.relinquishmentResponse[0]) {
        const relResponse = response.relinquishmentResponse[0];
        return {
          responseCode: relResponse.response.responseCode,
          responseMessage: relResponse.response.responseMessage
        };
      }

      throw new Error('Invalid relinquishment response from Federated Wireless');
    } catch (error) {
      console.error('[Federated Wireless] Relinquishment error:', error);
      throw error;
    }
  }

  /**
   * Deregister a CBSD
   */
  async deregisterDevice(request: DeregistrationRequest): Promise<SASResponse> {
    try {
      const deregistrationRequest = {
        deregistrationRequest: [
          {
            cbsdId: request.cbsdId
          }
        ]
      };

      console.log('[Federated Wireless] Deregistering CBSD:', request.cbsdId);
      
      const response = await this.makeRequest('/deregistration', deregistrationRequest);
      
      if (response.deregistrationResponse && response.deregistrationResponse[0]) {
        const deregResponse = response.deregistrationResponse[0];
        return {
          responseCode: deregResponse.response.responseCode,
          responseMessage: deregResponse.response.responseMessage
        };
      }

      throw new Error('Invalid deregistration response from Federated Wireless');
    } catch (error) {
      console.error('[Federated Wireless] Deregistration error:', error);
      throw error;
    }
  }

  /**
   * Get analytics data (Federated Wireless specific)
   */
  async getAnalytics(cbsdId: string, timeRange?: { start: Date; end: Date }): Promise<FederatedWirelessAnalytics[]> {
    try {
      const analyticsRequest = {
        cbsdId,
        customerId: this.config.customerId,
        timeRange
      };

      console.log('[Federated Wireless] Fetching analytics for CBSD:', cbsdId);
      
      const response = await this.makeRequest('/analytics', analyticsRequest);
      
      return response.analytics || [];
    } catch (error) {
      console.error('[Federated Wireless] Analytics fetch error:', error);
      throw error;
    }
  }

  /**
   * Configure multi-site coordination (Federated Wireless specific)
   */
  async configureMultiSiteCoordination(cbsdIds: string[]): Promise<SASResponse> {
    try {
      const coordinationRequest = {
        cbsdIds,
        customerId: this.config.customerId,
        enabled: this.enhancements.multiSiteCoordination || false
      };

      console.log('[Federated Wireless] Configuring multi-site coordination');
      
      const response = await this.makeRequest('/coordination', coordinationRequest);
      
      return {
        responseCode: response.responseCode || 0,
        responseMessage: response.responseMessage || 'Multi-site coordination configured'
      };
    } catch (error) {
      console.error('[Federated Wireless] Multi-site coordination error:', error);
      throw error;
    }
  }

  /**
   * Make HTTP request to Federated Wireless API
   */
  private async makeRequest(endpoint: string, data: any): Promise<any> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      
      console.log('[Federated Wireless] API Request:', {
        url,
        method: 'POST',
        customerId: this.config.customerId,
        tenantId: this.config.tenantId
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Customer-Id': this.config.customerId,
          'X-Tenant-Id': this.config.tenantId
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Federated Wireless API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[Federated Wireless] API request failed:', error);
      throw error;
    }
  }

  /**
   * Get SAS provider information
   */
  getProviderInfo() {
    return {
      provider: 'Federated Wireless',
      name: 'Federated Wireless Spectrum Access System',
      endpoint: this.baseUrl,
      customerId: this.config.customerId,
      enhancements: this.enhancements
    };
  }
}

/**
 * Factory function to create Federated Wireless client
 */
export function createFederatedWirelessClient(
  config: FederatedWirelessConfig,
  enhancements?: FederatedWirelessEnhancements
): FederatedWirelessClient {
  return new FederatedWirelessClient(config, enhancements);
}

