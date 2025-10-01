<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { networkStore, currentNetwork, allNetworks, isNetworkLoading } from '../stores/networkStore';
  import { currentUser } from '../stores/authStore';
  import { networkService } from '../services/networkService';
  import type { CreateNetworkDTO } from '../models/network';
  
  export let show = false;
  
  const dispatch = createEventDispatcher();
  
  let view: 'list' | 'create' = 'list';
  let isCreating = false;
  let error = '';
  
  // New network form
  let networkName = '';
  let networkMarket = '';
  let networkDescription = '';
  let networkRegion = '';
  let networkOperator = '';
  
  // Location fields
  let locationMode: 'address' | 'coordinates' = 'address';
  let address = '';
  let city = '';
  let state = '';
  let country = 'USA';
  let latitude = 40.7128;
  let longitude = -74.0060;
  let zoom = 12;
  
  function handleClose() {
    view = 'list';
    resetForm();
    dispatch('close');
  }
  
  function resetForm() {
    networkName = '';
    networkMarket = '';
    networkDescription = '';
    networkRegion = '';
    networkOperator = '';
    address = '';
    city = '';
    state = '';
    country = 'USA';
    latitude = 40.7128;
    longitude = -74.0060;
    zoom = 12;
    locationMode = 'address';
    error = '';
  }
  
  function showCreateView() {
    view = 'create';
  }
  
  function showListView() {
    view = 'list';
    resetForm();
  }
  
  async function handleCreateNetwork() {
    if (!networkName || !networkMarket) {
      error = 'Network name and market are required';
      return;
    }
    
    // Validate location
    if (locationMode === 'address' && !city) {
      error = 'City is required';
      return;
    }
    
    if (locationMode === 'coordinates' && (!latitude || !longitude)) {
      error = 'Coordinates are required';
      return;
    }
    
    if (!$currentUser) {
      error = 'You must be logged in to create a network';
      return;
    }
    
    isCreating = true;
    error = '';
    
    const createData: CreateNetworkDTO = {
      name: networkName,
      market: networkMarket,
      location: {
        address: locationMode === 'address' ? address : undefined,
        city: locationMode === 'address' ? city : undefined,
        state: locationMode === 'address' ? state : undefined,
        country: locationMode === 'address' ? country : undefined,
        latitude,
        longitude,
        zoom
      },
      description: networkDescription,
      tags: [],
      metadata: {
        region: networkRegion || undefined,
        operator: networkOperator || undefined,
        deploymentPhase: 'Planning'
      }
    };
    
    const result = await networkService.createNetwork(
      $currentUser.uid,
      $currentUser.email,
      createData
    );
    
    if (result.success && result.data) {
      networkStore.addNetwork(result.data);
      networkStore.setCurrentNetwork(result.data);
      handleClose();
      dispatch('networkCreated', result.data);
    } else {
      error = result.error || 'Failed to create network';
    }
    
    isCreating = false;
  }
  
  function handleSelectNetwork(networkId: string) {
    networkStore.setCurrentNetworkById(networkId);
    dispatch('networkSelected', networkId);
    handleClose();
  }
  
  async function handleDeleteNetwork(networkId: string, event: Event) {
    event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this network? This cannot be undone.')) {
      return;
    }
    
    const result = await networkService.deleteNetwork(networkId);
    
    if (result.success) {
      networkStore.deleteNetwork(networkId);
    } else {
      alert(result.error || 'Failed to delete network');
    }
  }
  
  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="network-overlay" on:click={handleClose}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="network-modal" on:click|stopPropagation>
      <div class="network-header">
        <h2>
          {#if view === 'list'}
            My Networks
          {:else}
            Create New Network
          {/if}
        </h2>
        <button class="close-btn" on:click={handleClose}>×</button>
      </div>
      
      <div class="network-body">
        {#if view === 'list'}
          <div class="network-list">
            {#if $isNetworkLoading}
              <div class="loading-state">
                <div class="spinner-small"></div>
                <p>Loading networks...</p>
              </div>
            {:else if $allNetworks.length === 0}
              <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <h3>No Networks Yet</h3>
                <p>Create your first network to start planning your LTE deployment.</p>
                <button class="create-btn" on:click={showCreateView}>
                  ➕ Create Network
                </button>
              </div>
            {:else}
              <div class="network-grid">
                {#each $allNetworks as network}
                  <!-- svelte-ignore a11y-click-events-have-key-events -->
                  <!-- svelte-ignore a11y-no-static-element-interactions -->
                  <div 
                    class="network-card" 
                    class:active={$currentNetwork?.id === network.id}
                    on:click={() => handleSelectNetwork(network.id)}
                  >
                    <div class="network-card-header">
                      <div class="network-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                          <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                      </div>
                      <button 
                        class="delete-network-btn" 
                        on:click={(e) => handleDeleteNetwork(network.id, e)}
                        title="Delete network"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                    <h3>{network.name}</h3>
                    <p class="market">{network.market}</p>
                    {#if network.description}
                      <p class="description">{network.description}</p>
                    {/if}
                    <div class="network-stats">
                      <span class="stat">{network.cells.length} cells</span>
                      <span class="stat-dot">•</span>
                      <span class="stat-date">{formatDate(network.updatedAt)}</span>
                    </div>
                  </div>
                {/each}
              </div>
              
              <button class="create-new-btn" on:click={showCreateView}>
                ➕ Create New Network
              </button>
            {/if}
          </div>
        {:else}
          <div class="create-form">
            {#if error}
              <div class="error-message">{error}</div>
            {/if}
            
            <div class="form-group">
              <label for="networkName">Network Name *</label>
              <input 
                type="text" 
                id="networkName"
                bind:value={networkName} 
                placeholder="Manhattan Downtown LTE"
                required
                disabled={isCreating}
              />
            </div>
            
            <div class="form-group">
              <label for="networkMarket">Market *</label>
              <input 
                type="text" 
                id="networkMarket"
                bind:value={networkMarket} 
                placeholder="New York Metro"
                required
                disabled={isCreating}
              />
            </div>
            
            <div class="form-group">
              <label for="networkRegion">Region (Optional)</label>
              <input 
                type="text" 
                id="networkRegion"
                bind:value={networkRegion} 
                placeholder="Northeast"
                disabled={isCreating}
              />
            </div>
            
            <div class="form-group">
              <label for="networkOperator">Operator (Optional)</label>
              <input 
                type="text" 
                id="networkOperator"
                bind:value={networkOperator} 
                placeholder="Verizon, AT&T, T-Mobile..."
                disabled={isCreating}
              />
            </div>
            
            <div class="form-group">
              <label for="networkDescription">Description (Optional)</label>
              <textarea 
                id="networkDescription"
                bind:value={networkDescription} 
                placeholder="Network deployment notes..."
                rows="3"
                disabled={isCreating}
              ></textarea>
            </div>
            
            <div class="location-section">
              <h4>📍 Network Location *</h4>
              <div class="location-mode-toggle">
                <button 
                  type="button"
                  class="mode-btn" 
                  class:active={locationMode === 'address'}
                  on:click={() => locationMode = 'address'}
                  disabled={isCreating}
                >
                  Address
                </button>
                <button 
                  type="button"
                  class="mode-btn" 
                  class:active={locationMode === 'coordinates'}
                  on:click={() => locationMode = 'coordinates'}
                  disabled={isCreating}
                >
                  Coordinates
                </button>
              </div>
              
              {#if locationMode === 'address'}
                <div class="form-group">
                  <label for="city">City *</label>
                  <input 
                    type="text" 
                    id="city"
                    bind:value={city} 
                    placeholder="New York"
                    required
                    disabled={isCreating}
                  />
                </div>
                
                <div class="location-grid">
                  <div class="form-group">
                    <label for="state">State</label>
                    <input 
                      type="text" 
                      id="state"
                      bind:value={state} 
                      placeholder="NY"
                      disabled={isCreating}
                    />
                  </div>
                  
                  <div class="form-group">
                    <label for="country">Country</label>
                    <input 
                      type="text" 
                      id="country"
                      bind:value={country} 
                      placeholder="USA"
                      disabled={isCreating}
                    />
                  </div>
                </div>
                
                <div class="form-group">
                  <label for="address">Full Address (Optional)</label>
                  <input 
                    type="text" 
                    id="address"
                    bind:value={address} 
                    placeholder="123 Main St, New York, NY"
                    disabled={isCreating}
                  />
                </div>
              {/if}
              
              <div class="location-grid">
                <div class="form-group">
                  <label for="latitude">Latitude *</label>
                  <input 
                    type="number" 
                    id="latitude"
                    step="0.000001"
                    bind:value={latitude} 
                    placeholder="40.7128"
                    required
                    disabled={isCreating}
                  />
                </div>
                
                <div class="form-group">
                  <label for="longitude">Longitude *</label>
                  <input 
                    type="number" 
                    id="longitude"
                    step="0.000001"
                    bind:value={longitude} 
                    placeholder="-74.0060"
                    required
                    disabled={isCreating}
                  />
                </div>
              </div>
              
              <div class="form-group">
                <label for="zoom">Default Zoom Level</label>
                <input 
                  type="range" 
                  id="zoom"
                  min="8"
                  max="16"
                  bind:value={zoom} 
                  disabled={isCreating}
                />
                <span class="zoom-value">Zoom: {zoom}</span>
              </div>
            </div>
            
            <div class="form-actions">
              <button class="cancel-btn" on:click={showListView} disabled={isCreating}>
                Cancel
              </button>
              <button class="submit-btn" on:click={handleCreateNetwork} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Network'}
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .network-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    animation: fadeIn 0.2s;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .network-modal {
    background: var(--card-bg);
    border-radius: var(--border-radius-xl);
    width: 100%;
    max-width: 700px;
    max-height: 85vh;
    box-shadow: var(--shadow-2xl);
    border: 1px solid var(--border-color);
    animation: slideUp 0.3s;
    display: flex;
    flex-direction: column;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .network-header {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .network-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: none;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 1.75rem;
    line-height: 1;
    cursor: pointer;
    transition: all var(--transition);
  }

  .close-btn:hover {
    background: var(--danger-light);
    color: var(--danger-color);
  }

  .network-body {
    padding: 2rem;
    overflow-y: auto;
    max-height: calc(85vh - 100px);
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem;
    color: var(--text-secondary);
  }

  .setup-banner {
    display: flex;
    gap: 1rem;
    padding: 1.5rem;
    background: var(--warning-light);
    border: 1px solid var(--warning-color);
    border-radius: var(--border-radius-lg);
    margin-bottom: 2rem;
  }

  .setup-banner svg {
    color: var(--warning-color);
    flex-shrink: 0;
  }

  .banner-content {
    flex: 1;
  }

  .banner-content strong {
    display: block;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .banner-content p {
    font-size: 0.9rem;
    color: var(--text-primary);
    margin: 0 0 1rem 0;
  }

  .banner-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .banner-link {
    display: inline-block;
    padding: 0.5rem 1rem;
    background: var(--warning-color);
    color: white;
    border-radius: var(--border-radius);
    text-decoration: none;
    font-weight: 600;
    font-size: 0.875rem;
    transition: all var(--transition);
    align-self: flex-start;
  }

  .banner-link:hover {
    background: var(--warning-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .banner-or {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .banner-actions code {
    display: block;
    padding: 0.5rem 0.75rem;
    background: var(--surface-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--text-primary);
  }

  .banner-note {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin: 0.75rem 0 0 0;
    font-style: italic;
  }

  .spinner-small {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-state {
    text-align: center;
    padding: 3rem 2rem;
  }

  .empty-state svg {
    color: var(--text-tertiary);
    margin-bottom: 1.5rem;
  }

  .empty-state h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .empty-state p {
    margin: 0 0 2rem 0;
    color: var(--text-secondary);
  }

  .create-btn {
    padding: 0.875rem 2rem;
    border: none;
    border-radius: var(--border-radius);
    background: var(--primary-color);
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition);
  }

  .create-btn:hover {
    background: var(--button-primary-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .network-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .network-card {
    background: var(--surface-secondary);
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    padding: 1.25rem;
    text-align: left;
    cursor: pointer;
    transition: all var(--transition);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .network-card:hover {
    border-color: var(--primary-color);
    background: var(--hover-bg);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .network-card.active {
    border-color: var(--primary-color);
    background: var(--primary-light);
  }

  .network-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .network-icon {
    color: var(--primary-color);
  }

  .delete-network-btn {
    background: none;
    border: none;
    color: var(--text-tertiary);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: var(--border-radius);
    transition: all var(--transition);
  }

  .delete-network-btn:hover {
    color: var(--danger-color);
    background: var(--danger-light);
  }

  .network-card h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .market {
    margin: 0;
    font-size: 0.9rem;
    color: var(--primary-color);
    font-weight: 500;
  }

  .description {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-secondary);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .network-stats {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-color);
    font-size: 0.8rem;
    color: var(--text-tertiary);
  }

  .stat-dot {
    color: var(--border-color);
  }

  .create-new-btn {
    width: 100%;
    padding: 0.875rem;
    border: 2px dashed var(--border-color);
    border-radius: var(--border-radius);
    background: transparent;
    color: var(--text-secondary);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition);
  }

  .create-new-btn:hover {
    border-color: var(--primary-color);
    color: var(--primary-color);
    background: var(--primary-light);
  }

  .create-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .error-message {
    padding: 1rem;
    background: var(--danger-light);
    border-left: 4px solid var(--danger-color);
    border-radius: var(--border-radius);
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 1rem;
    font-family: inherit;
    transition: all var(--transition);
  }

  .form-group textarea {
    resize: vertical;
    min-height: 80px;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--focus-ring);
  }

  .form-group input:disabled,
  .form-group textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .location-section {
    margin-top: 1.5rem;
    padding: 1.5rem;
    background: var(--surface-secondary);
    border-radius: var(--border-radius-lg);
    border: 1px solid var(--border-color);
  }

  .location-section h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .location-mode-toggle {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }

  .mode-btn {
    flex: 1;
    padding: 0.625rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--card-bg);
    color: var(--text-secondary);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition);
  }

  .mode-btn:hover:not(:disabled) {
    background: var(--hover-bg);
  }

  .mode-btn.active {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
  }

  .mode-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .location-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .zoom-value {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
    text-align: center;
  }

  input[type="range"] {
    width: 100%;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }

  .cancel-btn,
  .submit-btn {
    flex: 1;
    padding: 0.875rem;
    border: none;
    border-radius: var(--border-radius);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition);
  }

  .cancel-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .cancel-btn:hover:not(:disabled) {
    background: var(--hover-bg);
  }

  .submit-btn {
    background: var(--primary-color);
    color: white;
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--button-primary-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .network-grid {
      grid-template-columns: 1fr;
    }

    .network-modal {
      max-width: 95%;
    }
  }
</style>

