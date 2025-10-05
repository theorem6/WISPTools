<script lang="ts">
  import { 
    cellCount,
    conflictCount,
    criticalConflictCount,
    highConflictCount,
    mediumConflictCount,
    lowConflictCount
  } from '$lib/stores/appState';
  
  // Debug reactive updates
  $: if ($cellCount !== undefined) {
    console.log('[PCIStatusWidget] Cell count updated:', $cellCount);
  }
  
  $: if ($conflictCount !== undefined) {
    console.log('[PCIStatusWidget] Conflict count updated:', $conflictCount);
  }
</script>

<div class="pci-status-widget">
  <div class="status-header">
    <h2 class="status-title">PCI Status</h2>
    <div class="cell-count">{$cellCount} Cells</div>
  </div>
  
  <div class="status-grid">
    <div class="status-item total {$conflictCount > 0 ? 'has-conflicts' : 'no-conflicts'}">
      <span class="status-value">{$conflictCount}</span>
      <span class="status-label">Total</span>
    </div>
    
    <div class="status-item critical">
      <span class="status-value">{$criticalConflictCount}</span>
      <span class="status-label">Critical</span>
    </div>
    
    <div class="status-item high">
      <span class="status-value">{$highConflictCount}</span>
      <span class="status-label">High</span>
    </div>
    
    <div class="status-item medium">
      <span class="status-value">{$mediumConflictCount}</span>
      <span class="status-label">Medium</span>
    </div>
    
    <div class="status-item low">
      <span class="status-value">{$lowConflictCount}</span>
      <span class="status-label">Low</span>
    </div>
  </div>
</div>

<style>
  .pci-status-widget {
    position: fixed;
    top: 20px;
    right: 40px;
    z-index: 200;
    background: var(--card-bg);
    backdrop-filter: blur(16px);
    border-radius: 12px;
    padding: 1rem;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-color);
    min-width: 200px;
  }

  .status-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }

  .status-title {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .cell-count {
    font-size: 0.8rem;
    color: var(--text-tertiary);
    font-weight: 500;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .status-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5rem;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .status-item.total {
    grid-column: 1 / -1;
  }

  .status-value {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1;
  }

  .status-label {
    font-size: 0.7rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .status-item.total .status-value {
    color: var(--text-primary);
  }

  .status-item.total.has-conflicts .status-value {
    color: var(--warning-color);
  }

  .status-item.total.no-conflicts .status-value {
    color: var(--success-color);
  }

  .status-item.critical .status-value {
    color: var(--danger-color);
  }

  .status-item.high .status-value {
    color: var(--warning-color);
  }

  .status-item.medium .status-value {
    color: var(--info-color);
  }

  .status-item.low .status-value {
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .pci-status-widget {
      top: 20px;
      right: 10px;
      min-width: 160px;
      padding: 0.75rem;
    }

    .status-title {
      font-size: 0.75rem;
    }

    .cell-count {
      font-size: 0.7rem;
    }

    .status-value {
      font-size: 1.2rem;
    }

    .status-label {
      font-size: 0.65rem;
    }
  }
</style>

