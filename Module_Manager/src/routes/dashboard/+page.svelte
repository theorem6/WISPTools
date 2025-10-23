<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { tenantStore, currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  import { isPlatformAdmin } from '$lib/services/adminService';

  interface Module {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    status: 'active' | 'coming-soon';
    path: string;
    adminOnly?: boolean;
    features: string[];
  }

  const modules: Module[] = [
    {
      id: 'coverage-map',
      name: '🗺️ Coverage Map',
      description: 'Network coverage visualization and site management',
      icon: '🗺️',
      color: '#3b82f6', // Blue
      status: 'active',
      path: '/modules/coverage-map',
      features: ['Site Management', 'Coverage Visualization', 'Inventory Tracking', 'Network Planning']
    },
    {
      id: 'acs-cpe-management',
      name: '📡 ACS CPE Management',
      description: 'Customer Premises Equipment management and monitoring',
      icon: '📡',
      color: '#10b981', // Green
      status: 'active',
      path: '/modules/acs-cpe-management',
      features: ['Device Management', 'Performance Monitoring', 'TR069 Configuration', 'Fault Management']
    },
    {
      id: 'monitoring',
      name: '📊 Network Monitoring',
      description: 'Real-time network monitoring and performance management',
      icon: '📊',
      color: '#f59e0b', // Amber
      status: 'active',
      path: '/modules/monitoring',
      features: ['Network Monitoring', 'Device Health', 'Performance Analytics', 'Alert Management']
    },
    {
      id: 'work-orders',
      name: '📋 Work Orders',
      description: 'Comprehensive work order and maintenance management',
      icon: '📋',
      color: '#ef4444', // Red
      status: 'active',
      path: '/modules/work-orders',
      features: ['Work Order Management', 'Maintenance Scheduling', 'Field Operations', 'Task Tracking']
    }
  ];

  const adminModules: Module[] = [
    {
      id: 'admin-management',
      name: '⚙️ Admin Management',
      description: 'User and tenant management for owners and administrators',
      icon: '⚙️',
      color: '#6b7280', // Gray
      status: 'active',
      path: '/admin/management',
      adminOnly: true,
      features: ['User Management', 'Tenant Management', 'System Settings', 'Billing & Subscriptions']
    }
  ];

  let isAdmin = false;
  let currentUser: any = null;
  let isLoggedIn = false;

  onMount(async () => {
    if (browser) {
      currentUser = await authService.getCurrentUser();
      isAdmin = isPlatformAdmin(currentUser?.email || null);
      isLoggedIn = !!currentUser;
    }
  });

  function handleModuleClick(module: Module) {
    if (module.status === 'active') {
      goto(module.path);
    }
  }

  async function handleLogout() {
    try {
      await authService.signOut();
      
      // Clear all localStorage data
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('selectedTenantId');
      localStorage.removeItem('selectedTenantName');
      localStorage.removeItem('tenantSetupCompleted');
      
      // Clear tenant store
      tenantStore.clearTenantData();
      
      await goto('/login', { replaceState: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
</script>

<TenantGuard requireTenant={false}>
  <div class="dashboard-container">
    <!-- Header -->
    <div class="header">
      <div class="header-content">
        <div class="logo-section">
          <h1 class="app-title">WispTools.io</h1>
          <p class="app-subtitle">Comprehensive WISP Management Platform</p>
        </div>
        <!-- Minimal User Info and Power Button -->
        <div class="user-controls">
          {#if isLoggedIn && currentUser}
            <div class="user-status">
              {#if isAdmin}
                <span class="admin-indicator">Admin</span>
              {/if}
            </div>
            <button class="power-btn" on:click={handleLogout} title="Logout">
              <svg class="power-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                <line x1="12" y1="2" x2="12" y2="12"></line>
              </svg>
            </button>
          {:else}
            <button class="login-btn" on:click={() => goto('/login')}>
              <span class="login-icon">🔑</span>
              Login
            </button>
          {/if}
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Core Modules -->
      <div class="modules-section">
        <h2 class="section-title">Core Modules</h2>
        <div class="modules-grid">
          {#each modules as module}
            <div 
              class="module-card" 
              class:active={module.status === 'active'}
              class:coming-soon={module.status === 'coming-soon'}
              on:click={() => handleModuleClick(module)}
              on:keydown={(e) => e.key === 'Enter' && handleModuleClick(module)}
              role="button"
              tabindex="0"
            >
              <div class="module-header">
                <div class="module-icon" style="background-color: {module.color}20; color: {module.color}">
                  {module.icon}
                </div>
                <div class="module-info">
                  <h3 class="module-name">{module.name}</h3>
                  <p class="module-description">{module.description}</p>
                </div>
              </div>
              
              <div class="module-features">
                <h4>Key Features:</h4>
                <ul>
                  {#each module.features as feature}
                    <li>{feature}</li>
                  {/each}
                </ul>
              </div>

              <div class="module-status">
                {#if module.status === 'active'}
                  <span class="status-badge active">Active</span>
                {:else}
                  <span class="status-badge coming-soon">Coming Soon</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Admin Modules -->
      {#if isAdmin}
        <div class="admin-section">
          <h2 class="section-title">Administration</h2>
          <div class="admin-modules">
            {#each adminModules as module}
              <div 
                class="admin-card" 
                on:click={() => handleModuleClick(module)}
                on:keydown={(e) => e.key === 'Enter' && handleModuleClick(module)}
                role="button"
                tabindex="0"
              >
                <div class="admin-icon" style="background-color: {module.color}20; color: {module.color}">
                  {module.icon}
                </div>
                <div class="admin-info">
                  <h3 class="admin-name">{module.name}</h3>
                  <p class="admin-description">{module.description}</p>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Quick Actions -->
      <div class="quick-actions">
        <h2 class="section-title">Quick Actions</h2>
        <div class="actions-grid">
          <button class="action-btn" on:click={() => goto('/modules/coverage-map')}>
            <span class="action-icon">🗺️</span>
            <span class="action-text">Coverage Map</span>
          </button>
          <button class="action-btn" on:click={() => goto('/modules/acs-cpe-management')}>
            <span class="action-icon">📡</span>
            <span class="action-text">CPE Management</span>
          </button>
          <button class="action-btn" on:click={() => goto('/modules/monitoring')}>
            <span class="action-icon">📊</span>
            <span class="action-text">Network Monitoring</span>
          </button>
          <button class="action-btn" on:click={() => goto('/modules/work-orders')}>
            <span class="action-icon">📋</span>
            <span class="action-text">Work Orders</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</TenantGuard>

<style>
  .dashboard-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 0;
  }

  .header {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    padding: 1rem 0;
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .logo-section {
    text-align: left;
  }

  .app-title {
    font-size: 2.5rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .app-subtitle {
    font-size: 1rem;
    color: #6b7280;
    margin: 0.25rem 0 0 0;
  }

  .user-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .user-status {
    display: flex;
    align-items: center;
  }

  .admin-indicator {
    background: #dcfce7;
    color: #166534;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .power-btn {
    background: #6b7280;
    color: white;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .power-btn:hover {
    background: #ef4444;
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  .power-icon {
    width: 18px;
    height: 18px;
    stroke-width: 2.5;
  }

  .login-btn {
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .login-btn:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .login-icon {
    font-size: 1rem;
  }

  .main-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .section-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: white;
    margin: 0 0 1.5rem 0;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-bottom: 3rem;
  }

  .module-card {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 1rem;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 2px solid transparent;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .module-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .module-card.active {
    border-color: #3b82f6;
  }

  .module-card.coming-soon {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .module-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .module-icon {
    width: 3rem;
    height: 3rem;
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .module-info {
    flex: 1;
  }

  .module-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
  }

  .module-description {
    color: #6b7280;
    margin: 0;
    line-height: 1.5;
  }

  .module-features {
    margin-bottom: 1rem;
  }

  .module-features h4 {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 0.5rem 0;
  }

  .module-features ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .module-features li {
    font-size: 0.875rem;
    color: #6b7280;
    padding: 0.25rem 0;
    position: relative;
    padding-left: 1rem;
  }

  .module-features li::before {
    content: '•';
    color: #3b82f6;
    position: absolute;
    left: 0;
  }

  .module-status {
    display: flex;
    justify-content: flex-end;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .status-badge.active {
    background: #dcfce7;
    color: #166534;
  }

  .status-badge.coming-soon {
    background: #fef3c7;
    color: #92400e;
  }

  .admin-section {
    margin-bottom: 3rem;
  }

  .admin-modules {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .admin-card {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 0.75rem;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 2px solid transparent;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .admin-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: #6b7280;
  }

  .admin-icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .admin-name {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.25rem 0;
  }

  .admin-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  .quick-actions {
    margin-bottom: 2rem;
  }

  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .action-btn {
    background: rgba(255, 255, 255, 0.9);
    border: 2px solid transparent;
    border-radius: 0.75rem;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .action-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: #3b82f6;
  }

  .action-icon {
    font-size: 1.5rem;
  }

  .action-text {
    font-size: 0.875rem;
    font-weight: 500;
    color: #1f2937;
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }

    .app-title {
      font-size: 2rem;
    }

    .main-content {
      padding: 1rem;
    }

    .modules-grid {
      grid-template-columns: 1fr;
    }

    .actions-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>