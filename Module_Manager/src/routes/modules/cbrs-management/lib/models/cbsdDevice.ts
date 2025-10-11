/**
 * CBRS Device Models
 * Based on WinnForum SAS-CBSD Interface Specification
 */

/**
 * CBSD Device Registration State
 */
export enum CBSDState {
  UNREGISTERED = 'UNREGISTERED',
  REGISTERED = 'REGISTERED',
  AUTHORIZED = 'AUTHORIZED',
  GRANTED = 'GRANTED',
  SUSPENDED = 'SUSPENDED',
  DEREGISTERED = 'DEREGISTERED'
}

/**
 * CBSD Device Category
 */
export enum CBSDCategory {
  A = 'A', // Category A: Indoor, lower power
  B = 'B'  // Category B: Outdoor, higher power
}

/**
 * Installation Parameters
 */
export interface InstallationParams {
  latitude: number;
  longitude: number;
  height?: number; // Height above ground in meters
  heightType?: 'AGL' | 'AMSL'; // Above Ground Level or Above Mean Sea Level
  horizontalAccuracy?: number; // in meters
  verticalAccuracy?: number; // in meters
  indoorDeployment?: boolean;
  antennaAzimuth?: number; // 0-359 degrees
  antennaDowntilt?: number; // degrees
  antennaGain?: number; // dBi
  antennaBeamwidth?: number; // degrees
}

/**
 * Frequency Range
 */
export interface FrequencyRange {
  lowFrequency: number; // in Hz
  highFrequency: number; // in Hz
}

/**
 * CBSD Device
 */
export interface CBSDDevice {
  // Identification
  id: string; // Internal database ID
  cbsdSerialNumber: string;
  fccId: string;
  userId?: string;
  callSign?: string;
  
  // SAS Information
  cbsdId?: string; // Assigned by SAS upon registration
  sasProviderId: 'google' | 'federated-wireless' | 'other';
  
  // Device Information
  cbsdCategory: CBSDCategory;
  cbsdInfo?: {
    vendor?: string;
    model?: string;
    softwareVersion?: string;
    hardwareVersion?: string;
    firmwareVersion?: string;
  };
  
  // Installation
  installationParam: InstallationParams;
  measCapability?: string[];
  
  // State
  state: CBSDState;
  registrationTime?: Date;
  lastHeartbeatTime?: Date;
  
  // Grants
  activeGrants?: Grant[];
  
  // Tenant
  tenantId: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Grant Request
 */
export interface GrantRequest {
  cbsdId: string;
  operationParam: {
    maxEirp: number; // Maximum EIRP in dBm/MHz
    operationFrequencyRange: FrequencyRange;
  };
  requestedOperationParam?: {
    operationFrequencyRange?: FrequencyRange;
  };
}

/**
 * Grant
 */
export interface Grant {
  grantId: string;
  cbsdId: string;
  grantExpireTime: Date;
  heartbeatInterval: number; // in seconds
  channelType: 'GAA' | 'PAL'; // General Authorized Access or Priority Access License
  operationParam: {
    maxEirp: number;
    operationFrequencyRange: FrequencyRange;
  };
  grantState: 'IDLE' | 'GRANTED' | 'AUTHORIZED' | 'SUSPENDED' | 'TERMINATED';
  lastHeartbeat?: Date;
  transmitExpireTime?: Date;
}

/**
 * Spectrum Inquiry Request
 */
export interface SpectrumInquiryRequest {
  cbsdId: string;
  inquiredSpectrum: FrequencyRange[];
}

/**
 * Spectrum Inquiry Response
 */
export interface SpectrumInquiryResponse {
  cbsdId: string;
  availableChannel: {
    frequencyRange: FrequencyRange;
    channelType: 'GAA' | 'PAL';
    ruleApplied: string;
    maxEirp?: number;
  }[];
}

/**
 * Heartbeat Request
 */
export interface HeartbeatRequest {
  cbsdId: string;
  grantId: string;
  operationState: 'GRANTED' | 'AUTHORIZED';
  measReport?: {
    rcvdPowerMeasReports?: {
      measFrequency: number;
      measBandwidth: number;
      measRcvdPower: number;
    }[];
  };
}

/**
 * SAS Response Code
 */
export interface SASResponse {
  responseCode: number;
  responseMessage?: string;
  responseData?: any;
}

/**
 * Registration Response
 */
export interface RegistrationResponse extends SASResponse {
  cbsdId?: string;
}

/**
 * Grant Response
 */
export interface GrantResponse extends SASResponse {
  cbsdId: string;
  grantId?: string;
  grantExpireTime?: Date;
  heartbeatInterval?: number;
  channelType?: 'GAA' | 'PAL';
  operationParam?: {
    maxEirp: number;
    operationFrequencyRange: FrequencyRange;
  };
}

/**
 * Heartbeat Response
 */
export interface HeartbeatResponse extends SASResponse {
  cbsdId: string;
  grantId: string;
  transmitExpireTime?: Date;
  grantExpireTime?: Date;
  heartbeatInterval?: number;
  operationParam?: {
    maxEirp?: number;
    operationFrequencyRange?: FrequencyRange;
  };
}

/**
 * Deregistration Request
 */
export interface DeregistrationRequest {
  cbsdId: string;
}

/**
 * Relinquishment Request
 */
export interface RelinquishmentRequest {
  cbsdId: string;
  grantId: string;
}

/**
 * CBSD Measurement Report
 */
export interface CBSDMeasurement {
  cbsdId: string;
  timestamp: Date;
  measReport: {
    rcvdPowerMeasReports?: {
      measFrequency: number; // Hz
      measBandwidth: number; // Hz
      measRcvdPower: number; // dBm
    }[];
  };
}

/**
 * CBRS Band Information
 */
export const CBRS_BAND = {
  MIN_FREQUENCY: 3550000000, // 3550 MHz in Hz
  MAX_FREQUENCY: 3700000000, // 3700 MHz in Hz
  BANDWIDTH: 150000000 // 150 MHz
} as const;

/**
 * Helper function to validate CBRS frequency
 */
export function isValidCBRSFrequency(frequency: number): boolean {
  return frequency >= CBRS_BAND.MIN_FREQUENCY && frequency <= CBRS_BAND.MAX_FREQUENCY;
}

/**
 * Helper function to validate frequency range
 */
export function isValidFrequencyRange(range: FrequencyRange): boolean {
  return (
    isValidCBRSFrequency(range.lowFrequency) &&
    isValidCBRSFrequency(range.highFrequency) &&
    range.lowFrequency < range.highFrequency
  );
}

