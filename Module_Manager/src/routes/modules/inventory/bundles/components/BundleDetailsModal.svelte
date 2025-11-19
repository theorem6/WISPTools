<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { bundleService, type HardwareBundle } from '$lib/services/bundleService';
  
  export let bundle: HardwareBundle;
  export let show = true;
  
  const dispatch = createEventDispatcher();
  
  let loading = false;
  let error = '';
  
  function formatCurrency(amount: number | undefined): string {
    if (!amount) return 'N/A';
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  function formatDate(date: string | Date | undefined): string {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString();
  }
  
  function close() {
    dispatch('close');
  }
  
  async function useBundle() {
    if (!confirm(`Use bundle "${bundle.name}"? This will increment the usage count.`)) {
      return;
    }
    
    loading = true;
    error = '';
    
    try {
      await bundleService.useBundle(bundle._id!);
      dispatch('used', { bundle });
      close();
    } catch (err: any) {
      error = err.message || 'Failed to use bundle';
    } finally {
      loading = false;
    }
  }
  
  function getBundleTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'standard': 'Standard',
      'custom': 'Custom',
      'site-deployment': 'Site Deployment',
      'cpe-installation': 'CPE Installation',
      'maintenance-kit': 'Maintenance Kit',
      'emergency-kit': 'Emergency Kit'
    };
    return labels[type] || type;
  }
  
  function getBundleTypeEmoji(type: string): string {
    const emojis: Record<string, string> = {
      'standard': '📦',
      'custom': '🔧',
      'site-deployment': '🏗️',
      'cpe-installation': '📡',
      'maintenance-kit': '🔧',
      'emergency-kit': '🚨'
    };
    return emojis[type] || '📦';
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={close}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <div class="header-left">
          <span class="bundle-icon">{getBundleTypeEmoji(bundle.bundleType)}</span>
          <div>
            <h2>{bundle.name}</h2>
            <p class="bundle-type">{getBundleTypeLabel(bundle.bundleType)}</p>
          </div>
        </div>
        <button class="close-btn" on:click={close}>✕</button>
      </div>
      
      <div class="modal-body">
        {#if error}
          <div class="alert alert-error">
            <span>❌</span>
            <span>{error}</span>
          </div>
        {/if}
        
        {#if bundle.description}
          <div class="section">
            <h3>Description</h3>
            <p>{bundle.description}</p>
          </div>
        {/if}
        
        <div class="section">
          <h3>Bundle Statistics</h3>
          <div class="stats-grid">
            <div class="stat">
              <span class="stat-label">Items</span>
              <span class="stat-value">{bundle.items?.length || 0}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Total Cost</span>
              <span class="stat-value">{formatCurrency(bundle.estimatedTotalCost)}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Status</span>
              <span class="stat-value badge badge-{bundle.status}">{bundle.status}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Used</span>
              <span class="stat-value">{bundle.usageCount || 0} times</span>
            </div>
            <div class="stat">
              <span class="stat-label">Last Used</span>
              <span class="stat-value">{formatDate(bundle.lastUsedAt)}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Updated</span>
              <span class="stat-value">{formatDate(bundle.updatedAt)}</span>
            </div>
          </div>
        </div>
        
        {#if bundle.items && bundle.items.length > 0}
          <div class="section">
            <h3>Bundle Items ({bundle.items.length})</h3>
            <div class="items-table">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Equipment Type</th>
                    <th>Qty</th>
                    <th>Manufacturer</th>
                    <th>Model</th>
                    <th>Cost per Unit</th>
                    <th>Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {#each bundle.items as item}
                    <tr>
                      <td>{item.category}</td>
                      <td>{item.equipmentType}</td>
                      <td>{item.quantity}</td>
                      <td>{item.manufacturer || '-'}</td>
                      <td>{item.model || '-'}</td>
                      <td>{formatCurrency(item.estimatedCost)}</td>
                      <td>{formatCurrency((item.estimatedCost || 0) * (item.quantity || 1))}</td>
                    </tr>
                  {/each}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="6" style="text-align: right; font-weight: 600;">Total:</td>
                    <td style="font-weight: 600;">{formatCurrency(bundle.estimatedTotalCost)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        {/if}
        
        {#if bundle.tags && bundle.tags.length > 0}
          <div class="section">
            <h3>Tags</h3>
            <div class="tags-list">
              {#each bundle.tags as tag}
                <span class="tag">{tag}</span>
              {/each}
            </div>
          </div>
        {/if}
        
        {#if bundle.notes}
          <div class="section">
            <h3>Notes</h3>
            <p class="notes">{bundle.notes}</p>
          </div>
        {/if}
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={close}>
          Close
        </button>
        {#if bundle.status === 'active'}
          <button class="btn-primary" on:click={useBundle} disabled={loading}>
            {loading ? 'Using...' : '✓ Use Bundle'}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  
  .modal-content {
    background: var(--card-bg, var(--bg-primary));
    border-radius: 0.75rem;
    box-shadow: var(--shadow-xl);
    max-width: 900px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .bundle-icon {
    font-size: 2.5rem;
    flex-shrink: 0;
  }
  
  .modal-header h2 {
    margin: 0 0 0.25rem;
    font-size: 1.5rem;
    color: var(--text-primary);
  }
  
  .bundle-type {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem 0.5rem;
  }
  
  .close-btn:hover {
    color: var(--text-primary);
  }
  
  .modal-body {
    padding: 1.5rem;
    flex: 1;
    overflow-y: auto;
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
  
  .alert {
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    color: #ef4444;
  }
  
  .section {
    margin-bottom: 2rem;
  }
  
  .section h3 {
    margin: 0 0 1rem;
    font-size: 1.25rem;
    color: var(--text-primary);
    border-bottom: 2px solid var(--border-color);
    padding-bottom: 0.5rem;
  }
  
  .section p {
    margin: 0;
    color: var(--text-secondary);
    line-height: 1.6;
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
  }
  
  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .stat-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .stat-value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    font-weight: 500;
  }
  
  .badge-active {
    background: #10b981;
    color: white;
  }
  
  .badge-archived {
    background: #6b7280;
    color: white;
  }
  
  .badge-draft {
    background: #f59e0b;
    color: white;
  }
  
  .items-table {
    overflow-x: auto;
  }
  
  .items-table table {
    width: 100%;
    border-collapse: collapse;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    overflow: hidden;
  }
  
  .items-table thead {
    background: var(--bg-tertiary);
  }
  
  .items-table th {
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.875rem;
    border-bottom: 2px solid var(--border-color);
  }
  
  .items-table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
  }
  
  .items-table tbody tr:hover {
    background: var(--bg-tertiary);
  }
  
  .items-table tfoot {
    background: var(--bg-tertiary);
  }
  
  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .tag {
    padding: 0.25rem 0.75rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 1rem;
    font-size: 0.875rem;
    color: var(--text-primary);
  }
  
  .notes {
    background: var(--bg-secondary);
    padding: 1rem;
    border-radius: 0.5rem;
    white-space: pre-wrap;
  }
  
  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--primary);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }
  
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }
</style>

