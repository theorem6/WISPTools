// LTE/5G Metrics Service
// Provides realistic mock data and future API integration

export interface LTEMetrics {
  timestamp: Date;
  rsrp: number;        // Reference Signal Received Power (-140 to -44 dBm)
  rsrq: number;        // Reference Signal Received Quality (-19.5 to -3 dB)
  sinr: number;        // Signal to Interference plus Noise Ratio (-10 to 30 dB)
  cqi: number;         // Channel Quality Indicator (0-15)
  throughputDL: number; // Downlink throughput (Mbps)
  throughputUL: number; // Uplink throughput (Mbps)
  ueCount: number;     // Connected UE count
  prbUtilization: number; // Physical Resource Block utilization (0-100%)
}

export interface LTEKPIs {
  handoverSuccessRate: number;  // % (0-100)
  bearerSetupSuccessRate: number; // % (0-100)
  packetLossRate: number;       // % (0-100)
  latency: number;              // ms
  jitter: number;               // ms
  activeUEs: number;
  maxUEsSupported: number;
}

/**
 * Generate realistic LTE/5G metrics time series data
 */
export function generateLTEMetricsHistory(hours: number = 24): LTEMetrics[] {
  const metrics: LTEMetrics[] = [];
  const now = new Date();
  const intervalsPerHour = 12; // 5-minute intervals
  
  for (let i = hours * intervalsPerHour; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - (i * 5 * 60 * 1000));
    
    // Time of day variations
    const hour = timestamp.getHours();
    const isPeakHours = (hour >= 18 && hour <= 22) || (hour >= 8 && hour <= 10);
    const isNightHours = hour >= 0 && hour <= 6;
    
    // Base values with realistic variations
    const baseRSRP = -75 + (Math.random() * 10 - 5); // -80 to -70 dBm
    const baseRSRQ = -10 + (Math.random() * 4 - 2); // -12 to -8 dB
    const baseSINR = 15 + (Math.random() * 10 - 5); // 10 to 20 dB
    
    // Peak hours have more users, slightly degraded signal
    const loadFactor = isPeakHours ? 1.5 : (isNightHours ? 0.3 : 1.0);
    const ueCount = Math.round(50 * loadFactor + (Math.random() * 20 - 10));
    
    // Throughput correlates with signal quality and load
    const signalQuality = (baseRSRP + 140) / 96; // Normalize 0-1
    const congestion = Math.min(ueCount / 100, 1); // 0-1
    const throughputDL = Math.max(5, signalQuality * 150 * (1 - congestion * 0.5) + (Math.random() * 20 - 10));
    const throughputUL = Math.max(2, signalQuality * 50 * (1 - congestion * 0.5) + (Math.random() * 10 - 5));
    
    metrics.push({
      timestamp,
      rsrp: baseRSRP,
      rsrq: baseRSRQ,
      sinr: baseSINR,
      cqi: Math.round(Math.min(15, Math.max(1, (baseSINR + 10) / 2.5))),
      throughputDL,
      throughputUL,
      ueCount: Math.max(0, ueCount),
      prbUtilization: Math.min(100, Math.max(10, ueCount / 80 * 100 + (Math.random() * 20 - 10)))
    });
  }
  
  return metrics;
}

/**
 * Get current LTE/5G KPIs
 */
export function getCurrentLTEKPIs(): LTEKPIs {
  return {
    handoverSuccessRate: 98.5 + (Math.random() * 1.5 - 0.5),
    bearerSetupSuccessRate: 99.2 + (Math.random() * 0.8 - 0.4),
    packetLossRate: 0.5 + (Math.random() * 1.0),
    latency: 15 + (Math.random() * 10 - 5),
    jitter: 2 + (Math.random() * 3),
    activeUEs: Math.round(65 + (Math.random() * 30 - 15)),
    maxUEsSupported: 100
  };
}

/**
 * Get signal quality description
 */
export function getSignalQuality(rsrp: number): { label: string; color: string } {
  if (rsrp >= -65) return { label: 'Excellent', color: '#10b981' };
  if (rsrp >= -75) return { label: 'Good', color: '#3b82f6' };
  if (rsrp >= -85) return { label: 'Fair', color: '#f59e0b' };
  if (rsrp >= -95) return { label: 'Poor', color: '#ef4444' };
  return { label: 'Very Poor', color: '#991b1b' };
}

/**
 * Get SINR quality description
 */
export function getSINRQuality(sinr: number): { label: string; color: string } {
  if (sinr >= 20) return { label: 'Excellent', color: '#10b981' };
  if (sinr >= 13) return { label: 'Good', color: '#3b82f6' };
  if (sinr >= 0) return { label: 'Fair', color: '#f59e0b' };
  if (sinr >= -3) return { label: 'Poor', color: '#ef4444' };
  return { label: 'Very Poor', color: '#991b1b' };
}

/**
 * Calculate expected throughput based on CQI
 */
export function getExpectedThroughput(cqi: number, bandwidth: number = 20): number {
  // Simplified Shannon capacity calculation
  // CQI maps to modulation/coding scheme
  const cqiToEfficiency = [
    0.15, 0.23, 0.38, 0.60, 0.88, 1.18, 1.48, 1.91,
    2.41, 2.73, 3.32, 3.90, 4.52, 5.12, 5.55, 6.22
  ];
  
  const efficiency = cqiToEfficiency[Math.min(15, Math.max(0, cqi))];
  
  // Max throughput = Bandwidth (MHz) * 1000 * Efficiency
  // For 20MHz LTE: theoretical max ~150 Mbps downlink
  return Math.round(bandwidth * 1000 * efficiency / 50); // Simplified
}

