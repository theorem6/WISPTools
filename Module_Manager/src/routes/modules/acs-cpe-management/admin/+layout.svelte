<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  
  // Module metadata
  let moduleInfo = {
    title: 'ACS Administration',
    description: 'ACS system configuration and management',
    icon: '⚙️',
    category: 'Device Management',
    version: '1.0.0'
  };

  onMount(() => {
    // Set page metadata
    document.title = `${moduleInfo.title} - LTE WISP Management Platform`;
  });
</script>

<svelte:head>
  <title>{moduleInfo.title} - LTE WISP Management Platform</title>
  <meta name="description" content={moduleInfo.description} />
  <meta name="keywords" content="TR-069, ACS, administration, device management, LTE, WISP" />
</svelte:head>

<!-- Module Layout -->
<div class="module-layout">
  <!-- Module Content -->
  <main class="module-main">
    <slot />
  </main>

  <!-- Module Footer -->
  <footer class="module-footer">
    <div class="footer-content">
      <div class="module-info">
        <span class="module-name">{moduleInfo.title}</span>
        <span class="module-version">v{moduleInfo.version}</span>
      </div>
      <div class="module-category">
        <span class="category-label">Category:</span>
        <span class="category-value">{moduleInfo.category}</span>
      </div>
    </div>
  </footer>
</div>

<style>
  .module-layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .module-main {
    flex: 1;
    background: var(--bg-primary);
  }

  .module-footer {
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
    padding: 1rem 2rem;
  }

  .footer-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1200px;
    margin: 0 auto;
    font-size: 0.875rem;
  }

  .module-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .module-name {
    font-weight: 500;
    color: var(--text-primary);
  }

  .module-version {
    color: var(--text-secondary);
    font-size: 0.75rem;
  }

  .module-category {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .category-label {
    color: var(--text-secondary);
  }

  .category-value {
    color: var(--accent-color);
    font-weight: 500;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .module-footer {
      padding: 1rem;
    }

    .footer-content {
      flex-direction: column;
      gap: 0.5rem;
      align-items: flex-start;
    }
  }
</style>
