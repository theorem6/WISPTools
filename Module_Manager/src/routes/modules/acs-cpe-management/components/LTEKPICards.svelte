<script lang="ts">
  import type { LTEKPIs } from '../lib/lteMetricsService';

  export let kpis: LTEKPIs;

  function getKPIStatus(value: number, threshold: number, inverse: boolean = false): string {
    if (inverse) {
      return value <= threshold ? 'excellent' : value <= threshold * 2 ? 'good' : 'poor';
    }
    return value >= threshold ? 'excellent' : value >= threshold * 0.9 ? 'good' : 'poor';
  }
</script>

<div class="kpi-grid">
  <div class="kpi-card {getKPIStatus(kpis.handoverSuccessRate, 98)}">
    <div class="kpi-header">
      <span class="kpi-icon">🔄</span>
      <span class="kpi-label">Handover Success</span>
    </div>
    <div class="kpi-value">{kpis.handoverSuccessRate.toFixed(2)}%</div>
    <div class="kpi-subtitle">Target: ≥98%</div>
  </div>

  <div class="kpi-card {getKPIStatus(kpis.bearerSetupSuccessRate, 99)}">
    <div class="kpi-header">
      <span class="kpi-icon">📞</span>
      <span class="kpi-label">Bearer Setup</span>
    </div>
    <div class="kpi-value">{kpis.bearerSetupSuccessRate.toFixed(2)}%</div>
    <div class="kpi-subtitle">Target: ≥99%</div>
  </div>

  <div class="kpi-card {getKPIStatus(kpis.packetLossRate, 1, true)}">
    <div class="kpi-header">
      <span class="kpi-icon">📦</span>
      <span class="kpi-label">Packet Loss</span>
    </div>
    <div class="kpi-value">{kpis.packetLossRate.toFixed(2)}%</div>
    <div class="kpi-subtitle">Target: ≤1%</div>
  </div>

  <div class="kpi-card {getKPIStatus(kpis.latency, 50, true)}">
    <div class="kpi-header">
      <span class="kpi-icon">⚡</span>
      <span class="kpi-label">Latency</span>
    </div>
    <div class="kpi-value">{Math.round(kpis.latency)} ms</div>
    <div class="kpi-subtitle">Target: ≤50ms</div>
  </div>

  <div class="kpi-card">
    <div class="kpi-header">
      <span class="kpi-icon">👥</span>
      <span class="kpi-label">Active UEs</span>
    </div>
    <div class="kpi-value">{kpis.activeUEs} / {kpis.maxUEsSupported}</div>
    <div class="kpi-subtitle">{Math.round(kpis.activeUEs / kpis.maxUEsSupported * 100)}% Capacity</div>
  </div>

  <div class="kpi-card {getKPIStatus(kpis.jitter, 10, true)}">
    <div class="kpi-header">
      <span class="kpi-icon">📊</span>
      <span class="kpi-label">Jitter</span>
    </div>
    <div class="kpi-value">{kpis.jitter.toFixed(1)} ms</div>
    <div class="kpi-subtitle">Target: ≤10ms</div>
  </div>
</div>

<style>
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .kpi-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.25rem;
    transition: all 0.2s;
  }

  .kpi-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .kpi-card.excellent {
    border-color: #10b981;
    background: linear-gradient(135deg, var(--bg-secondary) 0%, rgba(16, 185, 129, 0.05) 100%);
  }

  .kpi-card.good {
    border-color: #3b82f6;
    background: linear-gradient(135deg, var(--bg-secondary) 0%, rgba(59, 130, 246, 0.05) 100%);
  }

  .kpi-card.poor {
    border-color: #ef4444;
    background: linear-gradient(135deg, var(--bg-secondary) 0%, rgba(239, 68, 68, 0.05) 100%);
  }

  .kpi-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .kpi-icon {
    font-size: 1.25rem;
  }

  .kpi-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .kpi-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1;
    margin-bottom: 0.5rem;
  }

  .kpi-subtitle {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .kpi-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .kpi-value {
      font-size: 1.5rem;
    }
  }
</style>

