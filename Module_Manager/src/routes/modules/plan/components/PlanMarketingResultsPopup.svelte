<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PlanMarketingAddress, PlanProject } from '$lib/services/planService';

  export let plan: PlanProject;
  export let addresses: PlanMarketingAddress[] = [];
  export let isLoading = false;

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }

  function exportToCSV() {
    if (!addresses.length) return;

    const headers = [
      'Address',
      'Address 2',
      'City',
      'State',
      'Postal Code',
      'Country',
      'Latitude',
      'Longitude',
      'Source'
    ];

    const rows = addresses.map(addr => {
      // Check if addressLine1 is just coordinates (format: "lat, lon")
      const isCoordinates = addr.addressLine1 && /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(addr.addressLine1.trim());
      
      // Extract latitude and longitude - prioritize existing fields, then extract from addressLine1 if needed
      let latitude = addr.latitude;
      let longitude = addr.longitude;
      
      // If lat/lon are missing, try to extract from addressLine1
      if ((latitude === undefined || latitude === null || longitude === undefined || longitude === null) && addr.addressLine1) {
        const coordMatch = addr.addressLine1.trim().match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
        if (coordMatch) {
          const lat = parseFloat(coordMatch[1]);
          const lon = parseFloat(coordMatch[2]);
          if (!isNaN(lat) && !isNaN(lon) && 
              lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            latitude = latitude ?? lat;
            longitude = longitude ?? lon;
          }
        }
      }
      
      // If addressLine1/addressLine2 are coordinates, leave address columns empty (use lat/lon columns instead)
      // Otherwise, use the actual address values
      const address = isCoordinates ? '' : (addr.addressLine1 || '');
      const address2 = isCoordinates ? '' : (addr.addressLine2 || '');
      
      return [
        address,
        address2,
        addr.city || '',
        addr.state || '',
        addr.postalCode || '',
        addr.country || '',
        latitude !== undefined && latitude !== null ? latitude.toFixed(7) : '',
        longitude !== undefined && longitude !== null ? longitude.toFixed(7) : '',
        addr.source || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma or quote
        const cellStr = String(cell).replace(/"/g, '""');
        return /[,"\n]/.test(cellStr) ? `"${cellStr}"` : cellStr;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safePlanName = plan.name ? plan.name.replace(/\s+/g, '_') : 'marketing-addresses';
    link.href = url;
    link.setAttribute('download', `${safePlanName}-addresses-${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
</script>

<div class="popup-overlay" on:click={close} on:keydown={(e) => e.key === 'Escape' && close()} role="presentation" tabindex="-1">
  <div class="popup-content" on:click|stopPropagation role="dialog" aria-modal="true" aria-label="Marketing Address Discovery Results">
    <div class="popup-header">
      <h2>🔍 Address Discovery Results</h2>
      <button class="close-btn" on:click={close} aria-label="Close">✕</button>
    </div>

    <div class="popup-body">
      {#if isLoading}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Discovering addresses...</p>
        </div>
      {:else if addresses.length === 0}
        <div class="empty-state">
          <p>No addresses found in the selected area.</p>
        </div>
      {:else}
        <div class="results-summary">
          <p><strong>{addresses.length}</strong> address{addresses.length !== 1 ? 'es' : ''} found</p>
        </div>

        <div class="results-list">
          {#each addresses.slice(0, 100) as addr (addr.latitude + ',' + addr.longitude)}
            <div class="result-item">
              <div class="result-address">
                {#if addr.addressLine1}
                  <strong>{addr.addressLine1}</strong>
                  {#if addr.addressLine2}
                    <br>{addr.addressLine2}
                  {/if}
                {:else}
                  <em>No address information</em>
                {/if}
              </div>
              <div class="result-location">
                {#if addr.city || addr.state || addr.postalCode}
                  {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')}
                {/if}
                {#if addr.latitude !== undefined && addr.longitude !== undefined}
                  <br><small>📍 {addr.latitude.toFixed(7)}, {addr.longitude.toFixed(7)}</small>
                {/if}
              </div>
              {#if addr.source}
                <div class="result-source">
                  <small>Source: {addr.source}</small>
                </div>
              {/if}
            </div>
          {/each}
          {#if addresses.length > 100}
            <div class="results-more">
              <p>... and {addresses.length - 100} more address{addresses.length - 100 !== 1 ? 'es' : ''}</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <div class="popup-footer">
      <button class="btn-secondary" on:click={close}>Close</button>
      {#if addresses.length > 0}
        <button class="btn-primary" on:click={exportToCSV}>
          📥 Download CSV ({addresses.length})
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .popup-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
  }

  .popup-content {
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    max-width: 800px;
    max-height: 90vh;
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    border-bottom: 1px solid #e0e0e0;
  }

  .popup-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #333;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #666;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .close-btn:hover {
    background: #f0f0f0;
  }

  .popup-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .loading-state,
  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #666;
  }

  .spinner {
    border: 3px solid #f3f3f3;
    border-top: 3px solid #3498db;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .results-summary {
    margin-bottom: 20px;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 4px;
  }

  .results-summary p {
    margin: 0;
    font-size: 1.1rem;
    color: #333;
  }

  .results-list {
    max-height: 400px;
    overflow-y: auto;
  }

  .result-item {
    padding: 15px;
    border-bottom: 1px solid #e0e0e0;
    transition: background 0.2s;
  }

  .result-item:hover {
    background: #f8f9fa;
  }

  .result-item:last-child {
    border-bottom: none;
  }

  .result-address {
    margin-bottom: 8px;
    color: #333;
    line-height: 1.5;
  }

  .result-location {
    color: #666;
    font-size: 0.9rem;
    line-height: 1.4;
    margin-bottom: 4px;
  }

  .result-source {
    color: #999;
    font-size: 0.85rem;
    margin-top: 4px;
  }

  .results-more {
    text-align: center;
    padding: 15px;
    color: #666;
    font-style: italic;
  }

  .popup-footer {
    display: flex;
    gap: 10px;
    padding: 20px;
    border-top: 1px solid #e0e0e0;
    justify-content: flex-end;
  }

  .btn-secondary,
  .btn-primary {
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .btn-secondary {
    background: #6c757d;
    color: white;
  }

  .btn-secondary:hover {
    background: #5a6268;
  }

  .btn-primary {
    background: #007bff;
    color: white;
  }

  .btn-primary:hover {
    background: #0056b3;
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .popup-overlay {
      padding: 10px;
    }

    .popup-content {
      max-height: 95vh;
    }

    .popup-header h2 {
      font-size: 1.25rem;
    }

    .results-list {
      max-height: 300px;
    }

    .popup-footer {
      flex-direction: column;
    }

    .btn-secondary,
    .btn-primary {
      width: 100%;
    }
  }
</style>

