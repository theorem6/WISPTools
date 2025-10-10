// TR-069 (CWMP) LTE/5G Metrics Service
// Based on TR-196 Data Model for LTE/5G CPE devices

/**
 * TR-069 Cellular Interface Parameters (TR-196 Data Model)
 * Device.Cellular.Interface.{i}.* parameters
 */
export interface TR069CellularMetrics {
  timestamp: Date;
  deviceId: string;
  
  // Signal Strength Measurements
  rssi: number;        // Received Signal Strength Indicator (-120 to -25 dBm)
  rsrp: number;        // Reference Signal Received Power (-140 to -44 dBm)
  rsrq: number;        // Reference Signal Received Quality (-20 to -3 dB)
  sinr: number;        // Signal to Interference plus Noise Ratio (-20 to 30 dB)
  rscp: number;        // Received Signal Code Power (-120 to -25 dBm)
  
  // Network Information  
  pci: number;         // Physical Cell ID (0-503)
  earfcn: number;      // E-UTRA Absolute Radio Frequency Channel Number
  band: number;        // LTE Band number (e.g., 2, 4, 12, 66, 71)
  cellId: number;      // Cell ID
  plmn: string;        // PLMN (MCC+MNC, e.g., "310410")
  
  // Connection Status
  status: 'Connected' | 'Connecting' | 'Disconnected';
  uptime: number;      // Connection uptime in seconds
  
  // Data Usage
  bytesSent: number;
  bytesReceived: number;
  
  // Additional Metrics
  currentTechnology: 'LTE' | '5G NR' | 'UMTS' | 'GSM';
  connectionMode: 'LTE' | '5G NSA' | '5G SA';
}

/**
 * TR-069 parameter paths for LTE metrics
 */
export const TR069_PATHS = {
  // Device.Cellular.Interface.{i}.*
  RSSI: 'Device.Cellular.Interface.1.RSSI',
  RSRP: 'Device.Cellular.Interface.1.RSRP',
  RSRQ: 'Device.Cellular.Interface.1.RSRQ',
  SINR: 'Device.Cellular.Interface.1.SINR',
  RSCP: 'Device.Cellular.Interface.1.RSCP',
  
  // Network Info (vendor extensions commonly used)
  PCI: 'Device.Cellular.Interface.1.X_VENDOR_PhysicalCellID',
  EARFCN: 'Device.Cellular.Interface.1.X_VENDOR_EARFCN',
  BAND: 'Device.Cellular.Interface.1.X_VENDOR_Band',
  CELL_ID: 'Device.Cellular.Interface.1.X_VENDOR_CellID',
  PLMN: 'Device.Cellular.Interface.1.PLMN',
  
  // Status
  STATUS: 'Device.Cellular.Interface.1.Status',
  UPTIME: 'Device.DeviceInfo.UpTime',
  
  // Stats
  BYTES_SENT: 'Device.Cellular.Interface.1.Stats.BytesSent',
  BYTES_RECEIVED: 'Device.Cellular.Interface.1.Stats.BytesReceived',
  
  // Alternative paths for different vendors
  ALT: {
    // Teltonika
    TELTONIKA_RSRP: 'Device.X_TELTONIKA_MobileInfo.RSRP',
    TELTONIKA_RSRQ: 'Device.X_TELTONIKA_MobileInfo.RSRQ',
    TELTONIKA_SINR: 'Device.X_TELTONIKA_MobileInfo.SINR',
    
    // MikroTik
    MIKROTIK_RSRP: 'Device.Cellular.Interface.1.X_MIKROTIK_CarrierInfo.1.RSRP',
    MIKROTIK_RSRQ: 'Device.Cellular.Interface.1.X_MIKROTIK_CarrierInfo.1.RSRQ',
    MIKROTIK_SINR: 'Device.Cellular.Interface.1.X_MIKROTIK_CarrierInfo.1.SINR',
    
    // Huawei
    HUAWEI_RSRP: 'Device.X_HUAWEI_MobileInfo.RSRP',
    HUAWEI_RSRQ: 'Device.X_HUAWEI_MobileInfo.RSRQ'
  }
};

/**
 * Generate historical TR-069 metrics from mock/sample data
 * In production, this would fetch from MongoDB where GenieACS stores periodic values
 */
export function generateTR069MetricsHistory(hours: number = 24, deviceId: string = 'CPE-001'): TR069CellularMetrics[] {
  const metrics: TR069CellularMetrics[] = [];
  const now = new Date();
  const intervalsPerHour = 12; // 5-minute intervals (GenieACS default inform interval)
  
  for (let i = hours * intervalsPerHour; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - (i * 5 * 60 * 1000));
    const hour = timestamp.getHours();
    
    // Time-based variations for realism
    const isPeakHours = (hour >= 18 && hour <= 22) || (hour >= 8 && hour <= 10);
    const isNightHours = hour >= 0 && hour <= 6;
    const loadFactor = isPeakHours ? 1.5 : (isNightHours ? 0.3 : 1.0);
    
    // Signal metrics with realistic noise
    const baseRSSI = -65 + (Math.random() * 10 - 5);
    const baseRSRP = -75 + (Math.random() * 8 - 4);
    const baseRSRQ = -10 + (Math.random() * 3 - 1.5);
    const baseSINR = 15 + (Math.random() * 8 - 4);
    
    // Network might hand over between cells occasionally
    const handoverEvent = Math.random() < 0.02; // 2% chance per interval
    const currentPCI = handoverEvent ? Math.floor(Math.random() * 504) : 156;
    const currentEARFCN = handoverEvent ? (Math.random() < 0.5 ? 5230 : 66486) : 5230;
    
    metrics.push({
      timestamp,
      deviceId,
      rssi: baseRSSI,
      rsrp: baseRSRP,
      rsrq: baseRSRQ,
      sinr: baseSINR,
      rscp: baseRSSI - 5,
      pci: currentPCI,
      earfcn: currentEARFCN,
      band: currentEARFCN < 10000 ? 2 : 66, // Band 2 or Band 66
      cellId: 12345 + (handoverEvent ? Math.floor(Math.random() * 10) : 0),
      plmn: '310410', // AT&T
      status: baseRSRP > -95 ? 'Connected' : 'Connecting',
      uptime: (hours * intervalsPerHour - i) * 5 * 60, // Seconds
      bytesSent: Math.floor(Math.random() * 1000000000),
      bytesReceived: Math.floor(Math.random() * 5000000000),
      currentTechnology: currentEARFCN < 10000 ? 'LTE' : '5G NR',
      connectionMode: currentEARFCN < 10000 ? 'LTE' : '5G NSA'
    });
  }
  
  return metrics;
}

/**
 * Get signal quality from RSSI (different scale than RSRP)
 */
export function getRSSIQuality(rssi: number): { label: string; color: string } {
  if (rssi >= -50) return { label: 'Excellent', color: '#10b981' };
  if (rssi >= -60) return { label: 'Good', color: '#3b82f6' };
  if (rssi >= -70) return { label: 'Fair', color: '#f59e0b' };
  if (rssi >= -80) return { label: 'Poor', color: '#ef4444' };
  return { label: 'Very Poor', color: '#991b1b' };
}

/**
 * Get RSRP quality (3GPP standard thresholds)
 */
export function getRSRPQuality(rsrp: number): { label: string; color: string } {
  if (rsrp >= -65) return { label: 'Excellent', color: '#10b981' };
  if (rsrp >= -75) return { label: 'Good', color: '#3b82f6' };
  if (rsrp >= -85) return { label: 'Fair', color: '#f59e0b' };
  if (rsrp >= -95) return { label: 'Poor', color: '#ef4444' };
  return { label: 'Very Poor', color: '#991b1b' };
}

/**
 * Get SINR quality (3GPP standards)
 */
export function getSINRQuality(sinr: number): { label: string; color: string } {
  if (sinr >= 20) return { label: 'Excellent', color: '#10b981' };
  if (sinr >= 13) return { label: 'Good', color: '#3b82f6' };
  if (sinr >= 0) return { label: 'Fair', color: '#f59e0b' };
  if (sinr >= -3) return { label: 'Poor', color: '#ef4444' };
  return { label: 'Very Poor', color: '#991b1b' };
}

/**
 * Get LTE Band name
 */
export function getLTEBandName(band: number): string {
  const bands: Record<number, string> = {
    2: 'Band 2 (1900 MHz)',
    4: 'Band 4 (1700/2100 MHz AWS)',
    5: 'Band 5 (850 MHz)',
    12: 'Band 12 (700 MHz)',
    13: 'Band 13 (700 MHz)',
    14: 'Band 14 (700 MHz FirstNet)',
    17: 'Band 17 (700 MHz)',
    25: 'Band 25 (1900 MHz)',
    26: 'Band 26 (850 MHz)',
    41: 'Band 41 (2500 MHz)',
    66: 'Band 66 (1700/2100 MHz AWS-3)',
    71: 'Band 71 (600 MHz)'
  };
  return bands[band] || `Band ${band}`;
}

/**
 * Format uptime from seconds
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) {
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  } else if (bytes >= 1048576) {
    return `${(bytes / 1048576).toFixed(2)} MB`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
}

/**
 * Calculate data rate from byte deltas
 */
export function calculateDataRate(currentBytes: number, previousBytes: number, intervalSeconds: number): number {
  const bytesPerSecond = (currentBytes - previousBytes) / intervalSeconds;
  return (bytesPerSecond * 8) / 1000000; // Convert to Mbps
}

