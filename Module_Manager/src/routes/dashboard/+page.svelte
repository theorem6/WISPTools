<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

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
      name: 'PCI Resolution',
      description: 'Automated Physical Cell ID conflict detection and optimization for LTE networks',
      icon: '📊',
      color: '#2563eb',
      status: 'active',
      path: '/modules/pci-resolution'
    },
    {
      id: 'coverage-planning',
      name: 'Coverage Planning',
      description: 'RF coverage analysis and site planning tools',
      icon: '📡',
      color: '#10b981',
      status: 'coming-soon',
      path: '/modules/coverage-planning'
    },
    {
      id: 'spectrum-management',
      name: 'Spectrum Management',
      description: 'Frequency planning and interference analysis',
      icon: '🌐',
      color: '#7c3aed',
      status: 'coming-soon',
      path: '/modules/spectrum-management'
    },
    {
      id: 'network-optimization',
      name: 'Network Optimization',
      description: 'SON/CSON algorithms for network self-optimization',
      icon: '⚡',
      color: '#f59e0b',
      status: 'coming-soon',
      path: '/modules/network-optimization'
    }
  ];

  let isDarkMode = false;
  let userEmail = '';

  onMount(() => {
    if (!browser) return;
    
    console.log('Dashboard mounted');
    
    // Check authentication
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    console.log('Auth check in dashboard:', isAuthenticated);
    
    if (isAuthenticated !== 'true') {
      console.log('Not authenticated, redirecting to login');
      goto('/login');
      return;
    }

    // Get user email
    userEmail = localStorage.getItem('userEmail') || 'user@example.com';
    console.log('User email:', userEmail);

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    isDarkMode = savedTheme === 'dark';
    updateTheme();
  });

  function toggleTheme() {
    isDarkMode = !isDarkMode;
    updateTheme();
  }

  function updateTheme() {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }

  function handleModuleClick(module: Module) {
    if (module.status === 'active') {
      goto(module.path);
    }
  }

  function handleLogout() {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userEmail');
    goto('/login');
  }
</script>

<div class="dashboard-page">
  <!-- Header -->
  <header class="header">
    <div class="container">
      <div class="header-content">
        <div class="logo-section">
          <div class="logo-icon">📶</div>
          <div class="logo-text">
            <h1>LTE WISP Management Platform</h1>
            <p class="tagline">Professional Network Planning & Optimization</p>
          </div>
        </div>
        
        <div class="header-actions">
          <button class="theme-toggle" on:click={toggleTheme} aria-label="Toggle theme">
            {#if isDarkMode}
              ☀️
            {:else}
              🌙
            {/if}
          </button>
          
          <div class="user-menu">
            <div class="user-info">
              <span class="user-icon">👤</span>
              <span class="user-email">{userEmail}</span>
            </div>
            <button class="btn-logout" on:click={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>

  <!-- Welcome Section -->
  <section class="welcome">
    <div class="container">
      <div class="welcome-content">
        <h2 class="welcome-title">Welcome to Your Dashboard</h2>
        <p class="welcome-description">
          Select a module below to begin managing your LTE network
        </p>
      </div>
    </div>
  </section>

  <!-- Modules Grid -->
  <section class="modules-section">
    <div class="container">
      <h3 class="section-title">Your Modules</h3>
      
      <div class="modules-grid">
        {#each modules as module}
          <div 
            class="module-card {module.status}"
            class:clickable={module.status === 'active'}
            on:click={() => handleModuleClick(module)}
            on:keydown={(e) => e.key === 'Enter' && handleModuleClick(module)}
            role="button"
            tabindex="0"
            style="--module-color: {module.color}"
          >
            <div class="module-header">
              <div class="module-icon">{module.icon}</div>
              {#if module.status === 'coming-soon'}
                <span class="status-badge">Coming Soon</span>
              {:else}
                <span class="status-badge active">Active</span>
              {/if}
            </div>
            
            <h4 class="module-name">{module.name}</h4>
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
        {/each}
      </div>
    </div>
  </section>

  <!-- Quick Stats -->
  <section class="stats-section">
    <div class="container">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-content">
            <div class="stat-value">1</div>
            <div class="stat-label">Active Module</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🚀</div>
          <div class="stat-content">
            <div class="stat-value">3</div>
            <div class="stat-label">Coming Soon</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⚡</div>
          <div class="stat-content">
            <div class="stat-value">∞</div>
            <div class="stat-label">Possibilities</div>
          </div>
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  .dashboard-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* Header */
  .header {
    background-color: var(--card-bg);
    border-bottom: 1px solid var(--border-color);
    padding: 1.5rem 0;
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(10px);
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .logo-section {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .logo-icon {
    font-size: 2.5rem;
  }

  .logo-text h1 {
    font-size: 1.5rem;
    margin-bottom: 0.25rem;
  }

  .tagline {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .theme-toggle {
    font-size: 1.5rem;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.5rem;
    transition: background-color 0.2s;
  }

  .theme-toggle:hover {
    background-color: var(--bg-hover);
  }

  .user-menu {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: var(--bg-tertiary);
    border-radius: 0.5rem;
  }

  .user-icon {
    font-size: 1.25rem;
  }

  .user-email {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .btn-logout {
    padding: 0.5rem 1rem;
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-logout:hover {
    background-color: var(--bg-hover);
  }

  /* Welcome Section */
  .welcome {
    background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%);
    color: white;
    padding: 3rem 0;
    text-align: center;
  }

  .welcome-title {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    color: white;
  }

  .welcome-description {
    font-size: 1.125rem;
    opacity: 0.95;
  }

  /* Modules Section */
  .modules-section {
    padding: 4rem 0;
    flex: 1;
  }

  .section-title {
    text-align: center;
    margin-bottom: 3rem;
    font-size: 2rem;
  }

  .modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .module-card {
    background-color: var(--card-bg);
    border-radius: 1rem;
    padding: 2rem;
    border: 2px solid var(--border-color);
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .module-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background-color: var(--module-color);
    transform: scaleX(0);
    transition: transform 0.3s ease;
  }

  .module-card.clickable {
    cursor: pointer;
  }

  .module-card.clickable:hover {
    transform: translateY(-4px);
    box-shadow: var(--card-shadow-hover);
    border-color: var(--module-color);
  }

  .module-card.clickable:hover::before {
    transform: scaleX(1);
  }

  .module-card.coming-soon {
    opacity: 0.7;
  }

  .module-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .module-icon {
    font-size: 3rem;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    background-color: var(--bg-tertiary);
    color: var(--text-secondary);
  }

  .status-badge.active {
    background-color: rgba(16, 185, 129, 0.1);
    color: var(--status-success);
  }

  .module-name {
    font-size: 1.5rem;
    margin-bottom: 0.75rem;
  }

  .module-description {
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: 1.5rem;
    min-height: 3rem;
  }

  .module-footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--module-color);
    font-weight: 600;
  }

  .module-footer.disabled {
    color: var(--text-tertiary);
  }

  .launch-text {
    font-size: 0.875rem;
  }

  /* Stats Section */
  .stats-section {
    background-color: var(--bg-secondary);
    padding: 3rem 0;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 2rem;
    max-width: 800px;
    margin: 0 auto;
  }

  .stat-card {
    background-color: var(--card-bg);
    border-radius: 0.75rem;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    border: 1px solid var(--border-color);
  }

  .stat-icon {
    font-size: 2.5rem;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .welcome-title {
      font-size: 2rem;
    }

    .welcome-description {
      font-size: 1rem;
    }

    .modules-grid {
      grid-template-columns: 1fr;
    }

    .logo-text h1 {
      font-size: 1.25rem;
    }

    .header-actions {
      gap: 0.75rem;
    }

    .user-email {
      display: none;
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

