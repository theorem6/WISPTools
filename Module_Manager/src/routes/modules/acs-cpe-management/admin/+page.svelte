<script lang="ts">
  import { onMount } from 'svelte';
  import AdminMenu from '../components/AdminMenu.svelte';
  
  // Module data
  let moduleData = {
    title: 'ACS Administration',
    description: 'System configuration and device management',
    icon: '⚙️'
  };

  onMount(async () => {
    console.log('ACS Administration module loaded');
  });
</script>

<svelte:head>
  <title>ACS Administration - LTE WISP Management Platform</title>
  <meta name="description" content="ACS system configuration and management" />
</svelte:head>

<div class="acs-admin-module">
  <!-- Exit Button -->
  <a href="/modules/acs-cpe-management" class="exit-button" aria-label="Exit to ACS CPE Management">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  </a>

  <!-- Module Header -->
  <div class="module-header">
    <div class="header-content">
      <div class="module-info">
        <h1 class="module-title">
          <span class="module-icon">⚙️</span>
          {moduleData.title}
        </h1>
        <p class="module-description">{moduleData.description}</p>
      </div>
    </div>
  </div>

  <!-- Module Content -->
  <div class="module-content">
    <!-- Administration Menu -->
    <AdminMenu />
    
    <!-- Quick Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">⚙️</div>
        <div class="stat-content">
          <div class="stat-number">8</div>
          <div class="stat-label">Admin Modules</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">📜</div>
        <div class="stat-content">
          <div class="stat-number">12</div>
          <div class="stat-label">Active Presets</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">🔧</div>
        <div class="stat-content">
          <div class="stat-number">8</div>
          <div class="stat-label">Virtual Parameters</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">📁</div>
        <div class="stat-content">
          <div class="stat-number">24</div>
          <div class="stat-label">Configuration Files</div>
        </div>
      </div>
    </div>

    <!-- System Information -->
    <div class="system-info">
      <div class="info-card">
        <h3>System Status</h3>
        <div class="status-items">
          <div class="status-item">
            <span class="status-label">ACS Server:</span>
            <span class="status-value online">Online</span>
          </div>
          <div class="status-item">
            <span class="status-label">Database:</span>
            <span class="status-value online">Connected</span>
          </div>
          <div class="status-item">
            <span class="status-label">TR-069 Service:</span>
            <span class="status-value online">Running</span>
          </div>
          <div class="status-item">
            <span class="status-label">File Server:</span>
            <span class="status-value online">Active</span>
          </div>
        </div>
      </div>
      
      <div class="info-card">
        <h3>Configuration Summary</h3>
        <div class="config-items">
          <div class="config-item">
            <span class="config-label">Management Server URL:</span>
            <span class="config-value">https://acs.example.com/cwmp</span>
          </div>
          <div class="config-item">
            <span class="config-label">Authentication Method:</span>
            <span class="config-value">Digest + SSL</span>
          </div>
          <div class="config-item">
            <span class="config-label">Default Provisioning:</span>
            <span class="config-value">Enabled</span>
          </div>
          <div class="config-item">
            <span class="config-label">Firmware Management:</span>
            <span class="config-value">Automated</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .acs-admin-module {
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
