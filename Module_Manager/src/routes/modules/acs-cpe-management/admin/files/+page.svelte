<script lang="ts">
  import { onMount } from 'svelte';
  import MainMenu from '../../components/MainMenu.svelte';
  
  let isLoading = false;
  
  onMount(async () => {
    console.log('Files page loaded');
  });
</script>

<svelte:head>
  <title>Files - ACS Administration</title>
  <meta name="description" content="Firmware and configuration file management" />
</svelte:head>

<div class="files-page">
  <!-- Exit Button -->
  <a href="/modules/acs-cpe-management/admin" class="exit-button" aria-label="Exit to Admin">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  </a>

  <MainMenu />
  
  <div class="page-header">
    <div class="header-content">
      <h1 class="page-title">
        <span class="page-icon">📁</span>
        File Management
      </h1>
      <p class="page-description">
        Manage firmware and configuration files for device provisioning
      </p>
    </div>
  </div>

  <div class="content">
    <div class="placeholder">
      <div class="placeholder-icon">📁</div>
      <h2>File Management System</h2>
      <p>This section will contain firmware files, configuration files, and file distribution management.</p>
      <div class="features">
        <div class="feature">📦 Firmware file management</div>
        <div class="feature">⚙️ Configuration file distribution</div>
        <div class="feature">🔄 File versioning and updates</div>
      </div>
    </div>
  </div>
</div>

<style>
  .files-page {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .exit-button {
    position: fixed;
    top: 1rem;
    left: 1rem;
    z-index: 1000;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    border: 2px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
  }

  .exit-button:hover {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
  }

  .page-header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 1.5rem 2rem;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .page-icon {
    font-size: 1.25rem;
  }

  .page-description {
    color: var(--text-secondary);
    margin: 0;
  }

  .content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .placeholder {
    text-align: center;
    padding: 4rem 2rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
  }

  .placeholder-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .placeholder h2 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }

  .placeholder p {
    color: var(--text-secondary);
    margin-bottom: 2rem;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }

  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    max-width: 600px;
    margin: 0 auto;
  }

  .feature {
    background: var(--bg-primary);
    padding: 1rem;
    border-radius: 0.25rem;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }
</style>
