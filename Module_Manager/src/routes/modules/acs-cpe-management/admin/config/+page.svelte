<script lang="ts">
  import { onMount } from 'svelte';
  import MainMenu from '../../components/MainMenu.svelte';
  
  let isLoading = false;
  
  onMount(async () => {
    console.log('Configuration page loaded');
  });
</script>

<svelte:head>
  <title>Configuration - ACS Administration</title>
  <meta name="description" content="System configuration and settings" />
</svelte:head>

<div class="config-page">
  <MainMenu />
  
  <div class="page-header">
    <div class="header-content">
      <h1 class="page-title">
        <span class="page-icon">🔨</span>
        System Configuration
      </h1>
      <p class="page-description">
        Configure ACS server settings and system parameters
      </p>
    </div>
  </div>

  <div class="content">
    <div class="placeholder">
      <div class="placeholder-icon">🔨</div>
      <h2>System Configuration</h2>
      <p>This section will contain ACS server settings, database configuration, authentication methods, and security settings.</p>
      <div class="features">
        <div class="feature">🖥️ ACS server configuration</div>
        <div class="feature">🗄️ Database settings</div>
        <div class="feature">🔐 Authentication methods</div>
      </div>
    </div>
  </div>
</div>

<style>
  .config-page {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
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
