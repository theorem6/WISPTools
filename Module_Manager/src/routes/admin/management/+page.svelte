<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  import { isPlatformAdmin } from '$lib/services/adminService';
  import { getAllUsers } from '$lib/services/userManagementService';
  import { tenantService } from '$lib/services/tenantService';

  interface AdminFeature {
    id: string;
    name: string;
    description: string;
    icon: string;
    path: string;
    adminOnly?: boolean;
  }

  const adminFeatures: AdminFeature[] = [
    {
      id: 'tenant-management',
      name: 'Tenant Management',
      description: 'Create, configure, and manage organization tenants',
      icon: '🏢',
      path: '/admin/tenant-management'
    },
    {
      id: 'system-settings',
      name: 'System Settings',
      description: 'Configure system-wide settings and preferences',
      icon: '⚙️',
      path: '/modules/backend-management'
    },
    {
      id: 'billing-subscriptions',
      name: 'Billing & Subscriptions',
      description: 'Manage billing, subscriptions, and payment processing',
      icon: '💳',
      path: '/admin/billing'
    }
  ];

  let isAdmin = false;
  let currentUser: any = null;
  
  // Live status data
  let systemStatus = {
    health: 'checking',
    healthMessage: 'Checking system status...',
    activeTenants: 0,
    totalUsers: 0,
    databaseStatus: 'checking',
    databaseMessage: 'Checking database connection...'
  };
  
  let statusLoading = true;
  let statusError = '';
  let statusUpdateInterval: NodeJS.Timeout | null = null;

  onMount(async () => {
    if (!browser) return;
    
    // Wait a bit for auth state to be ready after page refresh
    await new Promise(resolve => setTimeout(resolve, 100));
    
    currentUser = await authService.getCurrentUser();
    
    if (!currentUser) {
      // Not authenticated - redirect to login
      goto('/login', { replaceState: true });
      return;
    }
    
    isAdmin = isPlatformAdmin(currentUser?.email || null);
    
    if (!isAdmin) {
      // Not admin - redirect to dashboard
      goto('/dashboard', { replaceState: true });
      return;
    }
    
    // Only load status if admin
    await loadSystemStatus();
    // Update status every 30 seconds
    statusUpdateInterval = setInterval(loadSystemStatus, 30000);
  });

  onDestroy(() => {
    if (statusUpdateInterval) {
      clearInterval(statusUpdateInterval);
    }
  });

  async function loadSystemStatus() {
    if (!isAdmin) return;
    
    try {
      statusLoading = true;
      statusError = '';
      
      // Load tenants and users in parallel
      // Wrap in Promise.allSettled to prevent one failure from blocking the other
      const [tenantsResult, usersResult] = await Promise.allSettled([
        tenantService.getAllTenants(),
        getAllUsers()
      ]);
      
      const tenants = tenantsResult.status === 'fulfilled' ? tenantsResult.value : [];
      const users = usersResult.status === 'fulfilled' ? usersResult.value : [];
      
      // Log errors but don't throw
      if (tenantsResult.status === 'rejected') {
        console.error('[Admin Management] Error loading tenants:', tenantsResult.reason);
      }
      if (usersResult.status === 'rejected') {
        console.error('[Admin Management] Error loading users:', usersResult.reason);
      }
      
      // Update system status
      systemStatus = {
        health: 'operational',
        healthMessage: 'All systems operational',
        activeTenants: tenants.length,
        totalUsers: users.length,
        databaseStatus: 'connected',
        databaseMessage: 'MongoDB Atlas connected'
      };
      
    } catch (error: any) {
      console.error('Error loading system status:', error);
      statusError = error.message || 'Failed to load system status';
      
      // Set error status
      systemStatus = {
        health: 'error',
        healthMessage: 'System status unavailable',
        activeTenants: 0,
        totalUsers: 0,
        databaseStatus: 'error',
        databaseMessage: 'Database connection failed'
      };
    } finally {
      statusLoading = false;
    }
  }

  function handleFeatureClick(feature: AdminFeature) {
    goto(feature.path);
  }

  // No back button needed - this is the main admin page
  
  async function handleLogout() {
    try {
      await authService.signOut();
      
      // Clear all localStorage data
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('selectedTenantId');
      localStorage.removeItem('selectedTenantName');
      localStorage.removeItem('tenantSetupCompleted');
      
      // Redirect to login
      goto('/login', { replaceState: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
</script>

<div class="admin-module">
    <!-- Header -->
    <div class="module-header">
      <div class="header-content">
        <div class="module-title">
          <h1>⚙️ Admin Management</h1>
          <p>User and tenant management for owners and administrators</p>
        </div>
        <div class="user-info">
          {#if currentUser}
            <span class="user-name">{currentUser.email}</span>
            <span class="user-role">Platform Admin</span>
            <button class="logout-btn" on:click={handleLogout} title="Logout">
              🚪 Logout
            </button>
          {/if}
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="module-content">
      <!-- Overview -->
      <div class="overview-section">
        <h2>Administration Overview</h2>
        <p>The Admin Management module provides comprehensive tools for managing users, tenants, system settings, and billing. This module is only accessible to platform owners and administrators.</p>
      </div>

      <!-- Features Grid -->
      <div class="features-section">
        <h2>Administration Features</h2>
        <div class="features-grid">
          {#each adminFeatures as feature}
            <div 
              class="feature-card" 
              on:click={() => handleFeatureClick(feature)}
              on:keydown={(e) => e.key === 'Enter' && handleFeatureClick(feature)}
              role="button"
              tabindex="0"
            >
              <div class="feature-icon">{feature.icon}</div>
              <div class="feature-info">
                <h3 class="feature-name">{feature.name}</h3>
                <p class="feature-description">{feature.description}</p>
              </div>
              <div class="feature-arrow">→</div>
            </div>
          {/each}
        </div>
      </div>

      <!-- System Status -->
      <div class="system-status">
        <h2>System Status</h2>
        {#if statusError}
          <div class="status-error">
            <p>⚠️ {statusError}</p>
            <button class="retry-btn" on:click={loadSystemStatus}>Retry</button>
          </div>
        {/if}
        <div class="status-grid">
          <div class="status-card">
            <div class="status-icon {systemStatus.health}">
              {#if systemStatus.health === 'operational'}
                🟢
              {:else if systemStatus.health === 'error'}
                🔴
              {:else}
                🟡
              {/if}
            </div>
            <div class="status-info">
              <h4>System Health</h4>
              <p>{systemStatus.healthMessage}</p>
            </div>
          </div>
          <div class="status-card">
            <div class="status-icon">📊</div>
            <div class="status-info">
              <h4>Active Tenants</h4>
              <p>
                {#if statusLoading}
                  Loading...
                {:else}
                  {systemStatus.activeTenants} tenant{systemStatus.activeTenants !== 1 ? 's' : ''} active
                {/if}
              </p>
            </div>
          </div>
          <div class="status-card">
            <div class="status-icon">👥</div>
            <div class="status-info">
              <h4>Total Users</h4>
              <p>
                {#if statusLoading}
                  Loading...
                {:else}
                  {systemStatus.totalUsers} users across all tenants
                {/if}
              </p>
            </div>
          </div>
          <div class="status-card">
            <div class="status-icon {systemStatus.databaseStatus}">
              {#if systemStatus.databaseStatus === 'connected'}
                💾
              {:else if systemStatus.databaseStatus === 'error'}
                ⚠️
              {:else}
                🔄
              {/if}
            </div>
            <div class="status-info">
              <h4>Database</h4>
              <p>{systemStatus.databaseMessage}</p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  
  <style>
  .admin-module {
    min-height: 100vh;
    background: var(--bg-primary);
  }

  .module-header {
    background: var(--card-bg);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border-color);
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

  .back-btn {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 0.5rem 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: var(--transition);
    color: var(--text-primary);
  }

  .back-btn:hover {
    background: var(--hover-bg);
    border-color: var(--primary-color);
  }

  .back-icon {
    font-size: 1.25rem;
  }

  .module-title {
    text-align: center;
    flex: 1;
  }

  .module-title h1 {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .module-title p {
    color: var(--text-secondary);
    margin: 0.25rem 0 0 0;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .user-name {
    font-weight: 500;
    color: var(--text-primary);
  }

  .user-role {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .logout-btn {
    margin-top: 0.5rem;
    background: var(--danger-color, #dc2626);
    color: white;
    border: none;
    border-radius: var(--radius-sm, 0.375rem);
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition, all 0.2s);
  }

  .logout-btn:hover {
    background: var(--danger-dark, #b91c1c);
    transform: translateY(-1px);
  }

  .module-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .overview-section {
    background: var(--card-bg);
    border-radius: var(--radius-lg);
    padding: 2rem;
    margin-bottom: 2rem;
    box-shadow: var(--shadow-sm);
  }

  .overview-section h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem 0;
  }

  .overview-section p {
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0;
  }

  .features-section {
    margin-bottom: 2rem;
  }

  .features-section h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1.5rem 0;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .feature-card {
    background: var(--card-bg);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    cursor: pointer;
    transition: var(--transition);
    border: 2px solid transparent;
    box-shadow: var(--shadow-sm);
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-md);
    border-color: var(--primary-color);
  }

  .feature-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .feature-info {
    flex: 1;
  }

  .feature-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
  }

  .feature-description {
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
  }

  .feature-arrow {
    font-size: 1.5rem;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .system-status {
    margin-bottom: 2rem;
  }

  .system-status h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1.5rem 0;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .status-card {
    background: var(--card-bg);
    border-radius: var(--radius-md);
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: var(--transition);
  }

  .status-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .status-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .status-icon.operational {
    color: var(--success-color);
  }

  .status-icon.error {
    color: var(--danger-color);
  }

  .status-icon.checking {
    color: var(--warning-color);
  }

  .status-icon.connected {
    color: var(--success-color);
  }

  .status-info h4 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.25rem 0;
  }

  .status-info p {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .status-error {
    background: var(--danger-light);
    border: 1px solid var(--danger-color);
    border-radius: var(--radius-md);
    padding: 1rem;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .status-error p {
    margin: 0;
    color: var(--danger-dark, #991b1b);
    font-weight: 500;
  }

  .retry-btn {
    background: var(--danger-color);
    color: var(--text-inverse);
    border: none;
    border-radius: var(--radius-md);
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
  }

  .retry-btn:hover {
    background: var(--danger-hover);
    transform: translateY(-1px);
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }

    .module-title h1 {
      font-size: 1.5rem;
    }

    .module-content {
      padding: 1rem;
    }

    .features-grid {
      grid-template-columns: 1fr;
    }

    .status-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
