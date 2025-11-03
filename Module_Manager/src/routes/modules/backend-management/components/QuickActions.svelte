<script lang="ts">
  import { auth } from '$lib/firebase';
  
  let isExecuting = false;
  
  async function handleAction(action: string, confirmMessage: string) {
    if (!confirm(`⚠️ ${confirmMessage}\n\nThis is a critical operation. Are you sure?`)) {
      return;
    }
    
    isExecuting = true;
    
    try {
      const user = auth().currentUser;
      if (!user) throw new Error('Not authenticated');
      
      const token = await user.getIdToken();
      
      const response = await fetch(`https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/apiProxy/api/system/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`✅ ${action} successful!\n${data.message || ''}`);
      } else {
        throw new Error(data.error || `Failed to ${action}`);
      }
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      isExecuting = false;
    }
  }
  
  function handleRestartAll() {
    handleAction('restart-all', 'This will restart ALL services on the backend server.\n\nAll users will be temporarily disconnected.');
  }
  
  function handleRebootVM() {
    handleAction('reboot', 'This will REBOOT the entire backend VM.\n\nThe system will be offline for 1-2 minutes.\n\nAll active connections will be dropped.');
  }
  
  function handleViewLogs() {
    window.open('https://console.cloud.google.com/logs', '_blank');
  }
</script>

<div class="quick-actions">
  <h2>⚡ Quick Actions</h2>
  
  <div class="actions-grid">
    <button 
      class="action-card action-warning" 
      on:click={handleRestartAll}
      disabled={isExecuting}
    >
      <div class="action-icon">🔄</div>
      <div class="action-content">
        <div class="action-title">Restart All Services</div>
        <div class="action-description">Restart all PM2 services</div>
      </div>
    </button>
    
    <button 
      class="action-card action-danger" 
      on:click={handleRebootVM}
      disabled={isExecuting}
    >
      <div class="action-icon">🔴</div>
      <div class="action-content">
        <div class="action-title">Reboot VM</div>
        <div class="action-description">Full system reboot (1-2 min downtime)</div>
      </div>
    </button>
    
    <button 
      class="action-card action-info" 
      on:click={handleViewLogs}
      disabled={isExecuting}
    >
      <div class="action-icon">📋</div>
      <div class="action-content">
        <div class="action-title">View Cloud Logs</div>
        <div class="action-description">Open Google Cloud Logging</div>
      </div>
    </button>
  </div>
  
  <div class="warning-box">
    <strong>⚠️ Important:</strong> These actions affect the entire backend server.
    All users will be impacted. Use with caution during active operations.
  </div>
</div>

<style>
  .quick-actions h2 {
    margin: 0 0 var(--spacing-lg) 0;
    color: var(--text-primary);
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .actions-grid {
    display: grid;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }
  
  .action-card {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-lg);
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    cursor: pointer;
    transition: var(--transition);
    text-align: left;
    width: 100%;
  }
  
  .action-card:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }
  
  .action-card:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .action-warning {
    border-color: var(--warning-color);
  }
  
  .action-warning:hover:not(:disabled) {
    border-color: var(--warning-color);
    background: var(--warning-light);
  }
  
  .action-danger {
    border-color: var(--danger-color);
  }
  
  .action-danger:hover:not(:disabled) {
    border-color: var(--danger-color);
    background: var(--danger-light);
  }
  
  .action-info {
    border-color: var(--info-color);
  }
  
  .action-info:hover:not(:disabled) {
    border-color: var(--info-color);
    background: var(--info-light);
  }
  
  .action-icon {
    font-size: 2rem;
  }
  
  .action-content {
    flex: 1;
  }
  
  .action-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--spacing-xs);
  }
  
  .action-description {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  .warning-box {
    background: var(--warning-light);
    border: 1px solid var(--warning-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-md);
    color: #92400e;
  }
  
  .warning-box strong {
    display: block;
    margin-bottom: var(--spacing-xs);
  }
</style>

