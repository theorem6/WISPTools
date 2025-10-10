<script lang="ts">
  export let stats: {
    total: number;
    online: number;
    offline: number;
    onlinePercentage: number;
  };
</script>

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-icon">📊</div>
    <div class="stat-content">
      <div class="stat-number">{stats.total}</div>
      <div class="stat-label">Total Devices</div>
    </div>
  </div>
  
  <div class="stat-card online">
    <div class="stat-icon">✅</div>
    <div class="stat-content">
      <div class="stat-number">{stats.online}</div>
      <div class="stat-label">Online</div>
    </div>
  </div>
  
  <div class="stat-card offline">
    <div class="stat-icon">❌</div>
    <div class="stat-content">
      <div class="stat-number">{stats.offline}</div>
      <div class="stat-label">Offline</div>
    </div>
  </div>
  
  <div class="stat-card">
    <div class="stat-icon">📈</div>
    <div class="stat-content">
      <div class="stat-number">{stats.onlinePercentage}%</div>
      <div class="stat-label">Uptime</div>
    </div>
  </div>
</div>

<style>
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: all 0.2s;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .stat-card.online {
    border-color: #10b981;
    background: linear-gradient(135deg, var(--bg-secondary) 0%, rgba(16, 185, 129, 0.1) 100%);
  }

  .stat-card.offline {
    border-color: #ef4444;
    background: linear-gradient(135deg, var(--bg-secondary) 0%, rgba(239, 68, 68, 0.1) 100%);
  }

  .stat-icon {
    font-size: 2rem;
    line-height: 1;
  }

  .stat-content {
    flex: 1;
  }

  .stat-number {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  @media (max-width: 768px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }

    .stat-card {
      padding: 1rem;
    }

    .stat-icon {
      font-size: 1.5rem;
    }

    .stat-number {
      font-size: 1.5rem;
    }
  }
</style>

