<script lang="ts">
  import { goto } from '$app/navigation';

  interface Module {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    status: 'active' | 'coming-soon';
    path: string;
  }

  const modules: Module[] = [
    {
      id: 'pci-resolution',
      name: 'PCI Resolution & Network Optimization',
      description: 'Physical Cell ID conflict detection, SON optimization, and network self-organization',
      icon: '📊',
      color: '#2563eb',
      status: 'active',
      path: '/modules/pci-resolution'
    },
    {
      id: 'acs-cpe-management',
      name: 'ACS CPE Management',
      description: 'TR-069 device management and CPE monitoring with GPS mapping',
      icon: '📡',
      color: '#10b981',
      status: 'active',
      path: '/modules/acs-cpe-management'
    },
    {
      id: 'cbrs-management',
      name: 'CBRS Management',
      description: 'Citizens Broadband Radio Service management with Google SAS and Federated Wireless API integration',
      icon: '📡',
      color: '#8b5cf6',
      status: 'active',
      path: '/modules/cbrs-management'
    },
    {
      id: 'coverage-planning',
      name: 'Coverage Planning',
      description: 'RF coverage analysis and site planning tools',
      icon: '📡',
      color: '#7c3aed',
      status: 'coming-soon',
      path: '/modules/coverage-planning'
    },
    {
      id: 'hss-management',
      name: 'HSS & Subscriber Management',
      description: 'Home Subscriber Server management with IMSI/Ki/OPc, groups, and bandwidth plans',
      icon: '🔐',
      color: '#f59e0b',
      status: 'active',
      path: '/modules/hss-management'
    },
    {
      id: 'monitoring',
      name: 'Monitoring & Alerts',
      description: 'Real-time system monitoring, alerting, and audit logging across all modules',
      icon: '🔍',
      color: '#06b6d4',
      status: 'active',
      path: '/modules/monitoring'
    },
    {
      id: 'backend-management',
      name: 'Backend Management',
      description: 'Platform admin only - Monitor and control backend services, system resources, and VM operations',
      icon: '🖥️',
      color: '#ef4444',
      status: 'active',
      path: '/modules/backend-management'
    }
  ];

  function navigateToModule(path: string) {
    goto(path);
  }
</script>

<svelte:head>
  <title>Modules - LTE WISP Management Platform</title>
  <meta name="description" content="Available modules for network management and optimization" />
</svelte:head>

<div class="modules-page">
  <!-- Header -->
  <header class="page-header">
    <div class="container">
      <div class="header-content">
        <a href="/dashboard" class="back-link">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to Dashboard
        </a>
        <h1>Available Modules</h1>
        <p class="subtitle">Choose a module to access its features</p>
      </div>
    </div>
  </header>

  <!-- Modules Grid -->
  <main class="modules-content">
    <div class="container">
      <div class="modules-grid">
        {#each modules as module}
          <div 
            class="module-card" 
            class:active={module.status === 'active'}
            class:coming-soon={module.status === 'coming-soon'}
            role="button"
            tabindex="0"
            on:click={() => module.status === 'active' && navigateToModule(module.path)}
            on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && module.status === 'active' && navigateToModule(module.path)}
            aria-label="Navigate to {module.name}"
            style="--module-color: {module.color}"
          >
            <div class="module-header">
              <div class="module-icon-large">{module.icon}</div>
              <div class="module-status" class:status-active={module.status === 'active'}>
                {module.status === 'active' ? 'Active' : 'Coming Soon'}
              </div>
            </div>
            
            <div class="module-body">
              <h2 class="module-name">{module.name}</h2>
              <p class="module-description">{module.description}</p>
              
              {#if module.status === 'active'}
                <div class="module-footer">
                  <span class="launch-text">Launch Module →</span>
                </div>
              {:else}
                <div class="module-footer disabled">
                  <span class="launch-text">In Development</span>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </main>
</div>

<style>
  .modules-page {
    min-height: 100vh;
    background: var(--bg-primary);
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
  }

  .page-header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 2rem 0;
  }

  .header-content {
    text-align: center;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.9rem;
    margin-bottom: 1rem;
    transition: color 0.2s;
  }

  .back-link:hover {
    color: var(--primary-color);
  }

  .header-content h1 {
    font-size: 2.5rem;
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }

  .subtitle {
    font-size: 1.125rem;
    color: var(--text-secondary);
  }

  .modules-content {
    padding: 4rem 0;
  }

  .modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 2rem;
  }

  .module-card {
    background: var(--card-bg);
    border: 2px solid var(--border-color);
    border-radius: 1rem;
    padding: 2rem;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
    cursor: pointer;
  }

  .module-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--module-color);
    transform: scaleX(0);
    transition: transform 0.3s;
  }

  .module-card.active:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    border-color: var(--module-color);
  }

  .module-card.active:hover::before {
    transform: scaleX(1);
  }

  .module-card.coming-soon {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .module-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
  }

  .module-icon-large {
    font-size: 4rem;
  }

  .module-status {
    padding: 0.375rem 0.875rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }

  .module-status.status-active {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
  }

  .module-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .module-name {
    font-size: 1.5rem;
    margin: 0;
    color: var(--text-primary);
  }

  .module-description {
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0;
    flex: 1;
  }

  .module-footer {
    display: flex;
    align-items: center;
    color: var(--module-color);
    font-weight: 600;
    font-size: 0.95rem;
  }

  .module-footer.disabled {
    color: var(--text-tertiary);
  }

  .launch-text {
    transition: transform 0.3s;
  }

  .module-card.active:hover .launch-text {
    transform: translateX(4px);
  }

  @media (max-width: 768px) {
    .modules-grid {
      grid-template-columns: 1fr;
    }

    .header-content h1 {
      font-size: 2rem;
    }

    .container {
      padding: 0 1rem;
    }
  }
</style>

