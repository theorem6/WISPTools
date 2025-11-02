<script lang="ts">
  import { onMount } from 'svelte';
  import { authService } from '$lib/services/authService';
  import { currentTenant } from '$lib/stores/tenantStore';
  import InstallationApprovalPanel from './InstallationApprovalPanel.svelte';

  export let workOrderId: string;
  
  let documentation: any = null;
  let loading = true;
  let error: string | null = null;

  onMount(async () => {
    await loadDocumentation();
  });

  async function loadDocumentation() {
    try {
      loading = true;
      const token = await authService.getIdToken();
      const tenantId = $currentTenant?.id;

      const response = await fetch(
        `/api/installation-documentation?workOrderId=${workOrderId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId
          }
        }
      );

      if (response.ok) {
        const docs = await response.json();
        documentation = docs[0] || null;
      } else {
        error = 'Failed to load documentation';
      }
    } catch (err: any) {
      console.error('Error loading documentation:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'pending': '#6b7280',
      'submitted': '#3b82f6',
      'under-review': '#f59e0b',
      'approved': '#10b981',
      'rejected': '#ef4444',
      'requires-revision': '#f59e0b'
    };
    return colors[status] || '#6b7280';
  }
</script>

<div class="documentation-view">
  {#if loading}
    <div class="loading">Loading documentation...</div>
  {:else if error}
    <div class="error">Error: {error}</div>
  {:else if !documentation}
    <div class="no-docs">
      <p>No documentation found for this installation.</p>
      <p class="help-text">Documentation must be created from the mobile app during installation.</p>
    </div>
  {:else}
    <div class="doc-header">
      <h2>Installation Documentation</h2>
      <div class="status-badge" style="background-color: {getStatusColor(documentation.approvalStatus)}">
        {documentation.approvalStatus}
      </div>
    </div>

    <div class="doc-info">
      <div class="info-grid">
        <div class="info-item">
          <span class="label">Site:</span>
          <span class="value">{documentation.siteName || documentation.siteId}</span>
        </div>
        <div class="info-item">
          <span class="label">Type:</span>
          <span class="value">{documentation.installationType}</span>
        </div>
        <div class="info-item">
          <span class="label">Photos:</span>
          <span class="value">{documentation.photoCount} / {documentation.requiredPhotos?.minCount || 3}</span>
        </div>
        <div class="info-item">
          <span class="label">Installed By:</span>
          <span class="value">{documentation.installedByName || 'N/A'}</span>
        </div>
        {#if documentation.isSubcontractor}
          <div class="info-item">
            <span class="label">Subcontractor:</span>
            <span class="value">{documentation.subcontractor?.companyName || 'N/A'}</span>
          </div>
        {/if}
      </div>
    </div>

    {#if documentation.photos && documentation.photos.length > 0}
      <div class="photos-section">
        <h3>Photos ({documentation.photos.length})</h3>
        <div class="photos-grid">
          {#each documentation.photos as photo}
            <div class="photo-card">
              <img src={photo.thumbnailUrl || photo.url} alt={photo.description} class="photo-img" />
              <div class="photo-info">
                <p class="photo-category">{photo.category || 'other'}</p>
                {#if photo.description}
                  <p class="photo-description">{photo.description}</p>
                {/if}
                <p class="photo-date">{new Date(photo.uploadedAt).toLocaleDateString()}</p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if documentation.documentation?.equipmentList?.length > 0}
      <div class="equipment-section">
        <h3>Equipment Installed ({documentation.documentation.equipmentList.length})</h3>
        <table class="equipment-table">
          <thead>
            <tr>
              <th>Serial Number</th>
              <th>Manufacturer</th>
              <th>Model</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {#each documentation.documentation.equipmentList as eq}
              <tr>
                <td>{eq.serialNumber}</td>
                <td>{eq.manufacturer || 'N/A'}</td>
                <td>{eq.model || 'N/A'}</td>
                <td>{eq.installationLocation || 'N/A'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    {#if documentation.documentation?.notes}
      <div class="notes-section">
        <h3>Notes</h3>
        <p class="notes-text">{documentation.documentation.notes}</p>
      </div>
    {/if}

    <InstallationApprovalPanel {documentation} />
  {/if}
</div>

<style>
  .documentation-view {
    padding: 2rem;
    background: var(--background-color);
    min-height: 100vh;
  }

  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .status-badge {
    padding: 0.5rem 1rem;
    border-radius: var(--border-radius-sm);
    color: white;
    font-weight: 600;
    text-transform: capitalize;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    background: var(--card-bg);
    border-radius: var(--border-radius-sm);
  }

  .label {
    font-size: 0.75rem;
    color: var(--text-color-light);
    margin-bottom: 0.25rem;
  }

  .value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-color);
  }

  .photos-section, .equipment-section, .notes-section {
    margin: 2rem 0;
    padding: 1.5rem;
    background: var(--card-bg);
    border-radius: var(--border-radius-md);
  }

  .photos-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  .photo-card {
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    overflow: hidden;
  }

  .photo-img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    background: var(--secondary-bg);
  }

  .photo-info {
    padding: 0.75rem;
  }

  .photo-category {
    font-size: 0.75rem;
    color: var(--text-color-light);
    text-transform: capitalize;
    margin-bottom: 0.25rem;
  }

  .photo-description {
    font-size: 0.9rem;
    color: var(--text-color);
    margin-bottom: 0.25rem;
  }

  .photo-date {
    font-size: 0.75rem;
    color: var(--text-color-light);
  }

  .equipment-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
  }

  .equipment-table th,
  .equipment-table td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }

  .equipment-table th {
    background: var(--secondary-bg);
    font-weight: 600;
  }

  .notes-text {
    color: var(--text-color);
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .loading, .error, .no-docs {
    text-align: center;
    padding: 3rem;
    color: var(--text-color);
  }

  .help-text {
    color: var(--text-color-light);
    font-size: 0.9rem;
    margin-top: 0.5rem;
  }
</style>
