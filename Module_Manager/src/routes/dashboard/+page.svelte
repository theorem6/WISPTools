<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/TenantGuard.svelte';
  import { tenantStore, currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  import { isPlatformAdmin } from '$lib/services/adminService';
  import { availableModules, modulePermissions } from '$lib/stores/modulePermissions';

  interface Module {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    status: 'active' | 'coming-soon';
    path: string;
    adminOnly?: boolean;
  }

  const modules: Module[] = [
    {
      id: 'tenant-management',
      name: 'Tenant Management',
      description: 'Manage all customer organizations and tenant accounts (Admin Only)',
      icon: '🏢',
      color: 'var(--danger)',
      status: 'active',
      path: '/modules/tenant-management',
      adminOnly: true
    },
    {
      id: 'pci-resolution',
      name: 'PCI Resolution & Network Optimization',
      description: 'Physical Cell ID conflict detection, SON optimization, and network self-organization',
      icon: '📊',
      color: 'var(--primary)',
      status: 'active',
      path: '/modules/pci-resolution'
    },
    {
      id: 'acs-cpe-management',
      name: 'ACS CPE Management',
      description: 'TR-069 device management and CPE monitoring with GPS mapping',
      icon: '📡',
      color: 'var(--success)',
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
      id: 'coverage-map',
      name: 'Coverage Map',
      description: 'Comprehensive network asset mapping with towers, sectors, CPE, and equipment inventory management',
      icon: '🗺️',
      color: '#7c3aed',
      status: 'active',
      path: '/modules/coverage-map'
    },
    {
      id: 'inventory',
      name: 'Inventory Management',
      description: 'Centralized asset tracking with location management, maintenance history, and warranty tracking',
      icon: '📦',
      color: '#10b981',
      status: 'active',
      path: '/modules/inventory'
    },
    {
      id: 'hss-management',
      name: 'HSS & Subscriber Management',
      description: 'Home Subscriber Server management with IMSI/Ki/OPc, groups, and bandwidth plans',
      icon: '🔐',
      color: 'var(--warning)',
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
      color: 'var(--danger)',
      status: 'active',
      path: '/modules/backend-management',
      adminOnly: true
    }
  ];

  let isDarkMode = false;
  let userEmail = '';
  let tenantName = '';
  let isAdmin = false;

  // Subscribe to tenant store
  $: if ($currentTenant) {
    tenantName = $currentTenant.displayName;
  }
  
  // Filter modules based on permissions and admin status
  $: displayedModules = modules.filter(module => {
    // Admin-only modules
    if (module.adminOnly) {
      return isAdmin;
    }
    
    // Check module permissions
    const permissionKey = getPermissionKey(module.id);
    if (permissionKey && $modulePermissions) {
      return $modulePermissions[permissionKey];
    }
    
    // Default: show module
    return true;
  });
  
  function getPermissionKey(moduleId: string): keyof typeof $modulePermissions | null {
    const map: Record<string, string> = {
      'pci-resolution': 'pciResolution',
      'acs-cpe-management': 'acsManagement',
      'cbrs-management': 'cbrsManagement',
      'coverage-map': 'coverageMap',
      'inventory': 'inventory',
      'hss-management': 'hssManagement',
      'monitoring': 'monitoring',
      'backend-management': 'backendManagement'
    };
    return map[moduleId] as any || null;
  }

  onMount(async () => {
    if (!browser) return;
    
    console.log('[Dashboard] Mounted');
    
    // Get user email
    const currentUser = authService.getCurrentUser();
    userEmail = currentUser?.email || localStorage.getItem('userEmail') || 'user@example.com';

    // Check if user is platform admin
    isAdmin = isPlatformAdmin(userEmail);
    
    // Admins don't need a tenant
      if (isAdmin) {
        tenantName = 'Platform Admin';
    }

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    isDarkMode = savedTheme === 'dark';
    updateTheme();
    
    console.log('[Dashboard] Initialization complete');
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

  async function handleLogout() {
    await authService.signOut();
    tenantStore.clear(); // Clear all tenant state
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userEmail');
    goto('/login');
  }

  function handleTenantSettings() {
    goto('/tenant-admin');
  }

  function handleSwitchTenant() {
    goto('/tenant-selector');
  }
</script>

<TenantGuard requireTenant={!isAdmin}>
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
          {#if tenantName}
            <div class="tenant-info">
              <span class="tenant-icon">🏢</span>
              <div class="tenant-details">
                <span class="tenant-label">Organization</span>
                <span class="tenant-name">{tenantName}</span>
              </div>
              <button class="tenant-menu-btn" on:click={handleSwitchTenant} title="Switch Organization">
                ⚙️
              </button>
            </div>
          {/if}

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

  <!-- Modules Grid -->
  <section class="modules-section">
    <div class="container">
      
      <div class="modules-grid">
        {#each displayedModules as module}
            <div 
              class="module-card {module.status}"
              class:clickable={module.status === 'active'}
              class:admin-module={module.adminOnly}
              on:click={() => handleModuleClick(module)}
              on:keydown={(e) => e.key === 'Enter' && handleModuleClick(module)}
              role="button"
              tabindex="0"
              style="--module-color: {module.color}"
            >
              <div class="module-header">
                <div class="module-icon">{module.icon}</div>
                {#if module.adminOnly}
                  <span class="status-badge admin">Admin Only</span>
                {:else if module.status === 'coming-soon'}
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
        
        {#if displayedModules.length === 0 && !isAdmin}
          <div class="empty-modules">
            <div class="empty-icon">📦</div>
            <h3>No Modules Available</h3>
            <p>Your subscription doesn't include any modules yet.</p>
            <p class="help-text">Contact support to activate modules for your account.</p>
          </div>
        {/if}
      </div>
    </div>
  </section>
</div>
</TenantGuard>

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

  .tenant-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    background-color: rgba(124, 58, 237, 0.1);
    border-radius: 0.5rem;
    border: 1px solid rgba(124, 58, 237, 0.2);
  }

  .tenant-icon {
    font-size: 1.25rem;
  }

  .tenant-details {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .tenant-label {
    font-size: 0.625rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .tenant-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--brand-primary);
  }

  .tenant-menu-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    padding: 0.25rem;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .tenant-menu-btn:hover {
    opacity: 1;
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

  /* Modules Section */
  .modules-section {
    padding: 2rem 0;
    flex: 1;
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

  .status-badge.admin {
    background-color: rgba(239, 68, 68, 0.1);
    color: var(--danger);
  }

  .module-card.admin-module {
    border: 2px solid rgba(239, 68, 68, 0.3);
  }

  .module-card.admin-module:hover {
    border-color: var(--danger);
    box-shadow: 0 10px 30px rgba(239, 68, 68, 0.2);
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

  /* Responsive */
  @media (max-width: 768px) {
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

    .tenant-details {
      display: none;
    }

    .tenant-info {
      padding: 0.5rem;
    }
  }
</style>

