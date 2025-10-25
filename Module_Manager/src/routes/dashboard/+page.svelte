<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { tenantStore, currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  import { isPlatformAdmin } from '$lib/services/adminService';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import SettingsButton from '$lib/components/SettingsButton.svelte';

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
              id: 'plan',
              name: '📋 Plan',
              description: 'Interactive map-based planning tools for network expansion',
              icon: '📋',
              color: 'var(--primary)', // Blue
              status: 'active',
              path: '/modules/plan',
              features: ['Coverage Analysis', 'Site Planning', 'Inventory Check', 'CBRS Spectrum', 'Capacity Planning', 'Cost Analysis']
            },
            {
              id: 'deploy',
              name: '🚀 Deploy',
              description: 'Interactive map-based deployment tools for network rollouts',
              icon: '🚀',
              color: 'var(--success)', // Green
              status: 'active',
              path: '/modules/deploy',
              features: ['PCI Resolution', 'ACS CPE Management', 'Work Orders', 'Installation Management', 'Equipment Configuration', 'Quality Assurance']
            },
            {
              id: 'monitor',
              name: '📊 Monitor',
              description: 'Interactive map-based monitoring tools for network oversight',
              icon: '📊',
              color: 'var(--warning)', // Amber
              status: 'active',
              path: '/modules/monitor',
              features: ['Network Monitoring', 'Device Health', 'Traffic Analysis', 'Performance Analytics', 'Alert Management', 'HSS Management']
            },
            {
              id: 'maintain',
              name: '🔧 Maintain',
              description: 'Traditional interface for ticketing and maintenance management',
              icon: '🔧',
              color: 'var(--danger)', // Red
              status: 'active',
              path: '/modules/maintain',
              features: ['Ticketing System', 'Preventive Maintenance', 'Incident Management', 'Customer Support', 'Vendor Management', 'Knowledge Base']
            }
  ];

  const adminModules: Module[] = [
    {
      id: 'admin-management',
      name: '⚙️ Admin Management',
      description: 'User and tenant management for owners and administrators',
      icon: '⚙️',
      color: 'var(--text-secondary)', // Gray
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
          <img src="/wisptools-logo.svg" alt="WISPTools.io" class="dashboard-logo" />
          <div class="branding">
            <h1 class="app-title">WISPTools.io</h1>
            <p class="app-subtitle">LTE WISP Management Platform</p>
          </div>
        </div>
        <!-- Minimal User Info and Power Button -->
        <div class="user-controls">
          {#if $currentTenant}
            <div class="tenant-info">
              <span class="tenant-icon">🏢</span>
              <span class="tenant-name">{$currentTenant.displayName || $currentTenant.name}</span>
            </div>
          {/if}
          <ThemeSwitcher />
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
      <!-- Module Launch Buttons -->
      <div class="module-launch-bar">
        <button class="launch-btn plan" on:click={() => goto('/modules/plan')}>
          Plan
        </button>
        <button class="launch-btn deploy" on:click={() => goto('/modules/deploy')}>
          Deploy
        </button>
        <button class="launch-btn monitor" on:click={() => goto('/modules/monitor')}>
          Monitor
        </button>
        <button class="launch-btn maintain" on:click={() => goto('/modules/maintain')}>
          Maintain
        </button>
      </div>

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
                <h3 class="module-name">{module.name}</h3>
              </div>
              
              <div class="module-features">
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

    </div>
  </div>
  
  <!-- Global Settings Button -->
  <SettingsButton />
</TenantGuard>

<style>
  .dashboard-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #0f1419 0%, #1a2332 50%, #1e3a4f 100%);
    padding: 0;
  }

  .header {
    background: linear-gradient(90deg, #1a2332 0%, #1e3a4f 100%);
    backdrop-filter: blur(10px);
    border-bottom: 2px solid #00d9ff;
    box-shadow: 0 4px 20px rgba(0, 217, 255, 0.2);
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
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .dashboard-logo {
    width: 60px;
    height: 60px;
    filter: drop-shadow(0 0 10px rgba(0, 217, 255, 0.5));
    transition: transform 0.3s ease;
  }

  .dashboard-logo:hover {
    transform: scale(1.05) rotate(5deg);
  }

  .branding {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .app-title {
    font-size: 1.8rem;
    font-weight: 700;
    margin: 0;
    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: 1px;
  }

  .app-subtitle {
    font-size: 0.85rem;
    color: #00d9ff;
    margin: 0;
    font-weight: 500;
    letter-spacing: 0.5px;
  }

  .tenant-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(0, 217, 255, 0.1);
    border: 1px solid #00d9ff;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .tenant-icon {
    font-size: 1.1rem;
  }

  .tenant-name {
    color: #00f2fe;
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
    background: var(--success-light);
    color: var(--success);
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .power-btn {
    background: var(--secondary);
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
    background: var(--danger);
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  .power-icon {
    width: 18px;
    height: 18px;
    stroke-width: 2.5;
  }

  .login-btn {
    background: var(--primary);
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
    background: var(--primary-hover);
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
    font-size: 1.8rem;
    font-weight: 600;
    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0 0 1.5rem 0;
    text-shadow: 0 0 20px rgba(0, 242, 254, 0.3);
  }

  /* Module Launch Bar */
  .module-launch-bar {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .launch-btn {
    padding: 1rem 3rem;
    font-size: 1.2rem;
    font-weight: 600;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    color: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 140px;
  }

  .launch-btn.plan {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: 2px solid rgba(102, 126, 234, 0.3);
  }

  .launch-btn.deploy {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    border: 2px solid rgba(240, 147, 251, 0.3);
  }

  .launch-btn.monitor {
    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
    border: 2px solid #00d9ff;
    box-shadow: 0 4px 20px rgba(0, 217, 255, 0.4);
  }

  .launch-btn.maintain {
    background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    border: 2px solid rgba(67, 233, 123, 0.3);
  }

  .launch-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  }

  .launch-btn:active {
    transform: translateY(0);
  }

  .modules-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
    margin-bottom: 3rem;
    max-width: 1200px;
  }

  .module-card {
    background: linear-gradient(135deg, #1e3a4f 0%, #1a2332 100%);
    border-radius: 1rem;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 2px solid rgba(0, 217, 255, 0.2);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .module-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 30px rgba(0, 217, 255, 0.4);
    border-color: #00d9ff;
  }

  .module-card.active {
    border-color: #00f2fe;
    box-shadow: 0 4px 20px rgba(0, 242, 254, 0.5);
  }

  .module-card.coming-soon {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .module-header {
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid rgba(0, 217, 255, 0.3);
  }

  .module-name {
    margin: 0;
    font-size: 1.5rem;
    color: #00f2fe;
    font-weight: 700;
    text-shadow: 0 0 10px rgba(0, 242, 254, 0.5);
  }

  .module-features {
    margin: 1rem 0;
  }

  .module-features ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .module-features li {
    padding: 0.6rem 0;
    color: #a0d9e8;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
  }

  .module-features li:before {
    content: "▸";
    color: #00d9ff;
    font-weight: bold;
    font-size: 1.2rem;
    margin-right: 0.75rem;
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