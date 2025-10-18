<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  
  onMount(() => {
    // Redirect to services page (only admin page now)
    goto('/modules/acs-cpe-management/admin/services');
  });
</script>

<svelte:head>
  <title>ACS Administration - LTE WISP Management Platform</title>
</svelte:head>

<div class="redirect-page">
  <p>Redirecting to Service Management...</p>
</div>

<style>
  .acs-admin-module {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
  }

  .back-button:hover {
    color: var(--accent-color);
    background: var(--bg-tertiary);
    border-color: var(--accent-color);
  }

  .back-button svg {
    flex-shrink: 0;
  }

  .header-top {
    margin-bottom: 1rem;
  }

  .module-header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 1.5rem 2rem;
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
  }

  .module-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .module-icon {
    font-size: 1.25rem;
  }

  .module-description {
    color: var(--text-secondary);
    margin: 0;
  }

  .module-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
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
  }

  .stat-icon {
    font-size: 2rem;
  }

  .stat-number {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--accent-color);
  }

  .stat-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .system-info {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 2rem;
  }

  .info-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  .info-card h3 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    color: var(--text-primary);
  }

  .status-items,
  .config-items {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .status-item,
  .config-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
  }

  .status-item:last-child,
  .config-item:last-child {
    border-bottom: none;
  }

  .status-label,
  .config-label {
    font-weight: 500;
    color: var(--text-secondary);
  }

  .status-value {
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }

  .status-value.online {
    background: #dcfce7;
    color: #166534;
  }

  .config-value {
    font-family: monospace;
    background: var(--bg-tertiary);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .module-content {
      padding: 1rem;
    }

    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .system-info {
      grid-template-columns: 1fr;
    }

    .status-item,
    .config-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
  }
</style>
