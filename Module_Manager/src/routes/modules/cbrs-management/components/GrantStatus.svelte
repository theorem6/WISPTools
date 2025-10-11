<script lang="ts">
  import type { CBSDDevice, Grant } from '../lib/models/cbsdDevice';
  
  export let device: CBSDDevice;
  export let onRequestGrant: (device: CBSDDevice) => void;
  export let onRelinquishGrant: (device: CBSDDevice, grantId: string) => void;
  
  $: activeGrants = device.activeGrants || [];
  $: hasGrants = activeGrants.length > 0;
  
  function formatFrequency(hz: number): string {
    return `${(hz / 1000000).toFixed(1)} MHz`;
  }
  
  function getTimeRemaining(expireTime: Date): string {
    const now = new Date();
    const diff = expireTime.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  }
  
  function getGrantStateColor(state: string): string {
    switch (state) {
      case 'IDLE': return '#9ca3af';
      case 'GRANTED': return '#3b82f6';
      case 'AUTHORIZED': return '#10b981';
      case 'SUSPENDED': return '#f59e0b';
      case 'TERMINATED': return '#ef4444';
      default: return '#6b7280';
    }
  }
</script>

<div class="grant-status">
  <div class="grant-header">
    <h3>Grant Status</h3>
    {#if device.state === 'REGISTERED' || device.state === 'GRANTED'}
      <button class="btn btn-primary" on:click={() => onRequestGrant(device)}>
        + Request New Grant
      </button>
    {/if}
  </div>
  
  {#if hasGrants}
    <div class="grants-container">
      {#each activeGrants as grant}
        <div class="grant-card">
          <div class="grant-card-header">
            <div class="grant-id">
              <span class="grant-label">Grant ID</span>
              <span class="grant-value">{grant.grantId}</span>
            </div>
            <span class="grant-state-badge" style="--state-color: {getGrantStateColor(grant.grantState)}">
              {grant.grantState}
            </span>
          </div>
          
          <div class="grant-details">
            <div class="grant-detail-row">
              <div class="detail-item">
                <span class="detail-label">Channel Type</span>
                <span class="detail-value channel-{grant.channelType.toLowerCase()}">
                  {grant.channelType}
                </span>
              </div>
              
              <div class="detail-item">
                <span class="detail-label">Max EIRP</span>
                <span class="detail-value">{grant.operationParam.maxEirp} dBm/MHz</span>
              </div>
            </div>
            
            <div class="grant-detail-row">
              <div class="detail-item">
                <span class="detail-label">Frequency Range</span>
                <span class="detail-value frequency">
                  {formatFrequency(grant.operationParam.operationFrequencyRange.lowFrequency)} - 
                  {formatFrequency(grant.operationParam.operationFrequencyRange.highFrequency)}
                </span>
              </div>
            </div>
            
            <div class="grant-detail-row">
              <div class="detail-item">
                <span class="detail-label">Grant Expires</span>
                <span class="detail-value time-remaining">
                  {getTimeRemaining(grant.grantExpireTime)}
                </span>
              </div>
              
              <div class="detail-item">
                <span class="detail-label">Heartbeat Interval</span>
                <span class="detail-value">{grant.heartbeatInterval}s</span>
              </div>
            </div>
            
            {#if grant.lastHeartbeat}
              <div class="grant-detail-row">
                <div class="detail-item">
                  <span class="detail-label">Last Heartbeat</span>
                  <span class="detail-value">
                    {new Date(grant.lastHeartbeat).toLocaleString()}
                  </span>
                </div>
              </div>
            {/if}
          </div>
          
          <div class="grant-actions">
            <button 
              class="btn btn-sm btn-danger" 
              on:click={() => onRelinquishGrant(device, grant.grantId)}
            >
              Relinquish Grant
            </button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="no-grants">
      <div class="no-grants-icon">📊</div>
      <p class="no-grants-text">No Active Grants</p>
      <p class="no-grants-subtext">
        {#if device.state === 'REGISTERED'}
          Request a grant to start transmitting
        {:else if device.state === 'UNREGISTERED'}
          Register the device first to request grants
        {:else}
          Device must be in REGISTERED or GRANTED state
        {/if}
      </p>
    </div>
  {/if}
</div>

<style>
  .grant-status {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .grant-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .grant-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--accent-color);
    color: white;
  }
  
  .btn-primary:hover {
    background: var(--accent-hover);
  }
  
  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }
  
  .btn-danger {
    background: #ef4444;
    color: white;
  }
  
  .btn-danger:hover {
    background: #dc2626;
  }
  
  .grants-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .grant-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .grant-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .grant-id {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .grant-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .grant-value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    font-family: monospace;
  }
  
  .grant-state-badge {
    padding: 0.375rem 0.75rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    background: color-mix(in srgb, var(--state-color) 10%, transparent);
    color: var(--state-color);
    text-transform: uppercase;
  }
  
  .grant-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .grant-detail-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }
  
  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .detail-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .detail-value {
    font-size: 0.875rem;
    color: var(--text-primary);
    font-weight: 500;
  }
  
  .detail-value.frequency {
    font-family: monospace;
  }
  
  .detail-value.time-remaining {
    color: var(--accent-color);
    font-weight: 600;
  }
  
  .channel-gaa {
    color: #3b82f6;
  }
  
  .channel-pal {
    color: #8b5cf6;
  }
  
  .grant-actions {
    display: flex;
    justify-content: flex-end;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }
  
  .no-grants {
    padding: 4rem 2rem;
    text-align: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
  }
  
  .no-grants-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }
  
  .no-grants-text {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }
  
  .no-grants-subtext {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
  
  @media (max-width: 768px) {
    .grant-detail-row {
      grid-template-columns: 1fr;
    }
    
    .grant-card-header {
      flex-direction: column;
      gap: 0.75rem;
      align-items: flex-start;
    }
  }
</style>

