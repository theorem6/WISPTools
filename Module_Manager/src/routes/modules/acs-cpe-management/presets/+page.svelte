<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import MainMenu from '../components/MainMenu.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';

  interface Preset {
    _id: string;
    name: string;
    description: string;
    weight: number;
    configurations: Array<{
      type: string;
      path?: string;
      name?: string;
      value: any;
    }>;
    preCondition: string;
    events: string[];
    tags: string[];
    enabled: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }

  let presets: Preset[] = [];
  let isLoading = false;
  let showCreateModal = false;
  let showEditModal = false;
  let showApplyModal = false;
  let selectedPreset: Preset | null = null;
  let error = '';
  let success = '';

  // Form state
  let formData: Partial<Preset> = {
    name: '',
    description: '',
    weight: 0,
    configurations: [],
    preCondition: '',
    events: ['0 BOOTSTRAP', '1 BOOT'],
    tags: [],
    enabled: true
  };

  let newConfig = { type: 'value', path: '', value: '' };
  let newTag = '';

  onMount(async () => {
    await loadPresets();
  });

  async function loadPresets() {
    if (!$currentTenant?.id) return;
    
    isLoading = true;
    error = '';
    try {
      const user = authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      
      const token = await authService.getAuthTokenForApi();
      
      const response = await fetch('/api/tr069/presets', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        presets = data.presets || [];
      } else {
        error = data.error || 'Failed to load presets';
      }
    } catch (err: any) {
      console.error('Failed to load presets:', err);
      error = err.message || 'Failed to load presets';
    } finally {
      isLoading = false;
    }
  }

  function openCreateModal() {
    formData = {
      name: '',
      description: '',
      weight: 0,
      configurations: [],
      preCondition: '',
      events: ['0 BOOTSTRAP', '1 BOOT'],
      tags: [],
      enabled: true
    };
    newConfig = { type: 'value', path: '', value: '' };
    showCreateModal = true;
  }

  function openEditModal(preset: Preset) {
    selectedPreset = preset;
    formData = { ...preset };
    newConfig = { type: 'value', path: '', value: '' };
    showEditModal = true;
  }

  function openApplyModal(preset: Preset) {
    selectedPreset = preset;
    showApplyModal = true;
  }

  function addConfiguration() {
    if (!newConfig.path || newConfig.value === '') return;
    
    if (!formData.configurations) {
      formData.configurations = [];
    }
    
    formData.configurations.push({
      type: newConfig.type,
      path: newConfig.path,
      value: newConfig.value
    });
    
    newConfig = { type: 'value', path: '', value: '' };
  }

  function removeConfiguration(index: number) {
    if (formData.configurations) {
      formData.configurations.splice(index, 1);
      formData.configurations = formData.configurations; // Trigger reactivity
    }
  }

  function addTag() {
    if (!newTag.trim()) return;
    
    if (!formData.tags) {
      formData.tags = [];
    }
    
    if (!formData.tags.includes(newTag.trim())) {
      formData.tags.push(newTag.trim());
      formData.tags = formData.tags; // Trigger reactivity
    }
    
    newTag = '';
  }

  function removeTag(tag: string) {
    if (formData.tags) {
      formData.tags = formData.tags.filter(t => t !== tag);
      formData.tags = formData.tags; // Trigger reactivity
    }
  }

  async function savePreset() {
    if (!formData.name?.trim()) {
      error = 'Preset name is required';
      return;
    }

    if (!$currentTenant?.id) {
      error = 'No tenant selected';
      return;
    }

    error = '';
    success = '';
    isLoading = true;

    try {
      const user = authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      
      const token = await authService.getAuthTokenForApi();
      
      const endpoint = selectedPreset 
        ? `/api/tr069/presets/${selectedPreset._id}`
        : '/api/tr069/presets';
      
      const response = await fetch(endpoint, {
        method: selectedPreset ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (data.success) {
        success = selectedPreset ? 'Preset updated successfully' : 'Preset created successfully';
        showCreateModal = false;
        showEditModal = false;
        selectedPreset = null;
        await loadPresets();
        setTimeout(() => success = '', 3000);
      } else {
        error = data.error || 'Failed to save preset';
      }
    } catch (err: any) {
      console.error('Failed to save preset:', err);
      error = err.message || 'Failed to save preset';
    } finally {
      isLoading = false;
    }
  }

  async function deletePreset(preset: Preset) {
    if (!confirm(`Delete preset "${preset.name}"? This cannot be undone.`)) {
      return;
    }

    if (!$currentTenant?.id) {
      error = 'No tenant selected';
      return;
    }

    error = '';
    isLoading = true;

    try {
      const user = authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      
      const token = await authService.getAuthTokenForApi();
      
      const response = await fetch(`/api/tr069/presets/${preset._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        success = 'Preset deleted successfully';
        await loadPresets();
        setTimeout(() => success = '', 3000);
      } else {
        error = data.error || 'Failed to delete preset';
      }
    } catch (err: any) {
      console.error('Failed to delete preset:', err);
      error = err.message || 'Failed to delete preset';
    } finally {
      isLoading = false;
    }
  }

  async function togglePreset(preset: Preset) {
    if (!$currentTenant?.id) return;

    try {
      const user = authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      
      const token = await authService.getAuthTokenForApi();
      
      const response = await fetch(`/api/tr069/presets/${preset._id}/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        await loadPresets();
      }
    } catch (err: any) {
      console.error('Failed to toggle preset:', err);
    }
  }

  async function applyPresetToDevices(deviceIds: string[]) {
    if (!selectedPreset || deviceIds.length === 0) return;

    if (!$currentTenant?.id) {
      error = 'No tenant selected';
      return;
    }

    error = '';
    success = '';
    isLoading = true;

    try {
      const user = authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      
      const token = await authService.getAuthTokenForApi();
      
      const response = await fetch('/api/tr069/bulk-tasks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deviceIds,
          action: 'applyPreset',
          presetId: selectedPreset._id
        })
      });

      const data = await response.json();
      if (data.success) {
        success = `Preset applied to ${data.results.success} device(s)`;
        showApplyModal = false;
        selectedPreset = null;
        setTimeout(() => success = '', 5000);
      } else {
        error = data.error || 'Failed to apply preset';
      }
    } catch (err: any) {
      console.error('Failed to apply preset:', err);
      error = err.message || 'Failed to apply preset';
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Preset Management - ACS CPE Management</title>
</svelte:head>

<div class="presets-page">
  <MainMenu />
  
  <div class="page-header">
    <div class="header-content">
      <a href="/modules/acs-cpe-management" class="back-button">← Back to ACS Management</a>
      <h1>⚙️ Preset Management</h1>
      <p>Create and manage configuration presets for CPE devices</p>
    </div>
    <button class="btn btn-primary" on:click={openCreateModal}>
      ➕ Create Preset
    </button>
  </div>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if success}
    <div class="alert alert-success">{success}</div>
  {/if}

  {#if isLoading && presets.length === 0}
    <div class="loading">Loading presets...</div>
  {:else if presets.length === 0}
    <div class="empty-state">
      <p>No presets found. Create your first preset to get started.</p>
      <button class="btn btn-primary" on:click={openCreateModal}>Create Preset</button>
    </div>
  {:else}
    <div class="presets-grid">
      {#each presets as preset}
        <div class="preset-card" class:disabled={!preset.enabled}>
          <div class="preset-header">
            <h3>{preset.name}</h3>
            <div class="preset-actions">
              <button 
                class="btn-icon" 
                on:click={() => togglePreset(preset)}
                title={preset.enabled ? 'Disable' : 'Enable'}
              >
                {preset.enabled ? '✅' : '⏸️'}
              </button>
              <button class="btn-icon" on:click={() => openEditModal(preset)} title="Edit">✏️</button>
              <button class="btn-icon" on:click={() => openApplyModal(preset)} title="Apply">▶️</button>
              <button class="btn-icon danger" on:click={() => deletePreset(preset)} title="Delete">🗑️</button>
            </div>
          </div>
          
          <p class="preset-description">{preset.description || 'No description'}</p>
          
          <div class="preset-meta">
            <span class="meta-item">Weight: {preset.weight}</span>
            <span class="meta-item">Configs: {preset.configurations?.length || 0}</span>
            <span class="meta-item">Events: {preset.events?.join(', ') || 'None'}</span>
          </div>

          {#if preset.tags && preset.tags.length > 0}
            <div class="preset-tags">
              {#each preset.tags as tag}
                <span class="tag">{tag}</span>
              {/each}
            </div>
          {/if}

          {#if preset.configurations && preset.configurations.length > 0}
            <div class="preset-configs">
              <strong>Configurations:</strong>
              <ul>
                {#each preset.configurations.slice(0, 3) as config}
                  <li>{config.path || config.name}: {String(config.value)}</li>
                {/each}
                {#if preset.configurations.length > 3}
                  <li class="more">... and {preset.configurations.length - 3} more</li>
                {/if}
              </ul>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Create/Edit Modal -->
{#if showCreateModal || showEditModal}
  <div class="modal-overlay" on:click={() => { showCreateModal = false; showEditModal = false; }}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>{selectedPreset ? 'Edit Preset' : 'Create Preset'}</h2>
        <button class="close-btn" on:click={() => { showCreateModal = false; showEditModal = false; }}>×</button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label>Preset Name *</label>
          <input type="text" bind:value={formData.name} placeholder="e.g., Standard CPE Config" />
        </div>

        <div class="form-group">
          <label>Description</label>
          <textarea bind:value={formData.description} placeholder="Describe what this preset does..." rows="3"></textarea>
        </div>

        <div class="form-group">
          <label>Weight</label>
          <input type="number" bind:value={formData.weight} />
          <small>Lower weights are applied first</small>
        </div>

        <div class="form-group">
          <label>Precondition</label>
          <input type="text" bind:value={formData.preCondition} placeholder="e.g., InternetGatewayDevice.DeviceInfo.Manufacturer = 'Nokia'" />
        </div>

        <div class="form-group">
          <label>Events</label>
          <div class="checkbox-group">
            <label><input type="checkbox" checked={formData.events?.includes('0 BOOTSTRAP')} on:change={(e) => {
              if (!formData.events) formData.events = [];
              if (e.currentTarget.checked && !formData.events.includes('0 BOOTSTRAP')) {
                formData.events.push('0 BOOTSTRAP');
              } else if (!e.currentTarget.checked) {
                formData.events = formData.events.filter(e => e !== '0 BOOTSTRAP');
              }
            }} /> BOOTSTRAP</label>
            <label><input type="checkbox" checked={formData.events?.includes('1 BOOT')} on:change={(e) => {
              if (!formData.events) formData.events = [];
              if (e.currentTarget.checked && !formData.events.includes('1 BOOT')) {
                formData.events.push('1 BOOT');
              } else if (!e.currentTarget.checked) {
                formData.events = formData.events.filter(e => e !== '1 BOOT');
              }
            }} /> BOOT</label>
            <label><input type="checkbox" checked={formData.events?.includes('2 PERIODIC')} on:change={(e) => {
              if (!formData.events) formData.events = [];
              if (e.currentTarget.checked && !formData.events.includes('2 PERIODIC')) {
                formData.events.push('2 PERIODIC');
              } else if (!e.currentTarget.checked) {
                formData.events = formData.events.filter(e => e !== '2 PERIODIC');
              }
            }} /> PERIODIC</label>
          </div>
        </div>

        <div class="form-group">
          <label>Configurations</label>
          <div class="config-input">
            <input type="text" bind:value={newConfig.path} placeholder="Parameter path (e.g., InternetGatewayDevice.ManagementServer.URL)" />
            <input type="text" bind:value={newConfig.value} placeholder="Value" />
            <button class="btn btn-secondary" on:click={addConfiguration}>Add</button>
          </div>
          {#if formData.configurations && formData.configurations.length > 0}
            <div class="config-list">
              {#each formData.configurations as config, index}
                <div class="config-item">
                  <span>{config.path || config.name}: {String(config.value)}</span>
                  <button class="btn-icon" on:click={() => removeConfiguration(index)}>×</button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="form-group">
          <label>Tags</label>
          <div class="tag-input">
            <input type="text" bind:value={newTag} placeholder="Add tag" on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} />
            <button class="btn btn-secondary" on:click={addTag}>Add</button>
          </div>
          {#if formData.tags && formData.tags.length > 0}
            <div class="tag-list">
              {#each formData.tags as tag}
                <span class="tag">
                  {tag}
                  <button class="tag-remove" on:click={() => removeTag(tag)}>×</button>
                </span>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={() => { showCreateModal = false; showEditModal = false; }}>Cancel</button>
        <button class="btn btn-primary" on:click={savePreset} disabled={isLoading || !formData.name?.trim()}>
          {isLoading ? 'Saving...' : selectedPreset ? 'Update' : 'Create'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Apply Preset Modal -->
{#if showApplyModal && selectedPreset}
  <div class="modal-overlay" on:click={() => showApplyModal = false}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Apply Preset: {selectedPreset.name}</h2>
        <button class="close-btn" on:click={() => showApplyModal = false}>×</button>
      </div>
      
      <div class="modal-body">
        <p>This preset will be applied to selected devices. Navigate to the Devices page to select devices and apply this preset.</p>
        <p><strong>Note:</strong> Use bulk operations on the Devices page to apply presets to multiple devices at once.</p>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={() => showApplyModal = false}>Close</button>
        <button class="btn btn-primary" on:click={() => { showApplyModal = false; goto('/modules/acs-cpe-management/devices'); }}>Go to Devices</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .presets-page {
    min-height: 100vh;
    background: var(--bg-primary);
    padding: 2rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }

  .back-button {
    color: var(--brand-primary);
    text-decoration: none;
    margin-bottom: 0.5rem;
    display: inline-block;
  }

  .presets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .preset-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    transition: all 0.2s;
  }

  .preset-card:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .preset-card.disabled {
    opacity: 0.6;
  }

  .preset-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .preset-header h3 {
    margin: 0;
    font-size: 1.25rem;
  }

  .preset-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    font-size: 1.25rem;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .btn-icon:hover {
    opacity: 1;
  }

  .btn-icon.danger:hover {
    color: #ef4444;
  }

  .preset-description {
    color: var(--text-secondary);
    margin-bottom: 1rem;
  }

  .preset-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 1rem;
  }

  .preset-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .tag {
    background: var(--bg-secondary);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }

  .preset-configs {
    font-size: 0.875rem;
  }

  .preset-configs ul {
    margin: 0.5rem 0 0 0;
    padding-left: 1.5rem;
  }

  .preset-configs li.more {
    font-style: italic;
    color: var(--text-secondary);
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: var(--card-bg);
    border-radius: 0.5rem;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-body {
    padding: 1.5rem;
    flex: 1;
  }

  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
  }

  .config-input,
  .tag-input {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .config-input input {
    flex: 1;
  }

  .config-list {
    margin-top: 0.5rem;
  }

  .config-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem;
    background: var(--bg-secondary);
    border-radius: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .tag-remove {
    margin-left: 0.25rem;
    cursor: pointer;
  }

  .checkbox-group {
    display: flex;
    gap: 1rem;
  }

  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .alert {
    padding: 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
  }

  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .alert-success {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
  }
</style>
