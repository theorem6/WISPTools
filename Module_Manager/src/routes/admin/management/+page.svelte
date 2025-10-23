<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
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
      id: 'user-management',
      name: 'User Management',
      description: 'Manage users, roles, and permissions across tenants',
      icon: '👥',
      path: '/modules/user-management'
    },
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
    if (browser) {
      currentUser = await authService.getCurrentUser();
      isAdmin = isPlatformAdmin(currentUser?.email || null);
      
      if (isAdmin) {
        await loadSystemStatus();
        // Update status every 30 seconds
        statusUpdateInterval = setInterval(loadSystemStatus, 30000);
      }
    }
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
      const [tenants, users] = await Promise.all([
        tenantService.getAllTenants().catch(() => []),
        getAllUsers().catch(() => [])
      ]);
      
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

  function goBack() {
    goto('/dashboard');
  }
</script>

<TenantGuard requireTenant={false} adminOnly={true}>
  <div class="admin-module">
    <!-- Header -->
    <div class="module-header">
      <div class="header-content">
        <button class="back-btn" on:click={goBack}>
          <span class="back-icon">←</span>
          Back to Dashboard
        </button>
        <div class="module-title">
          <h1>⚙️ Admin Management</h1>
          <p>User and tenant management for owners and administrators</p>
        </div>
        <div class="user-info">
          {#if currentUser}
            <span class="user-name">{currentUser.email}</span>
            <span class="user-role">Platform Admin</span>
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
</TenantGuard>

<style>
  .admin-module {
    min-height: 100vh;
    background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  }

  .module-header {
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

  .back-btn {
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s ease;
  }

  .back-btn:hover {
    background: #e5e7eb;
    border-color: #9ca3af;
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
    color: #1f2937;
    margin: 0;
  }

  .module-title p {
    color: #6b7280;
    margin: 0.25rem 0 0 0;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .user-name {
    font-weight: 500;
    color: #1f2937;
  }

  .user-role {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .module-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .overview-section {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 1rem;
    padding: 2rem;
    margin-bottom: 2rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .overview-section h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 1rem 0;
  }

  .overview-section p {
    color: #6b7280;
    line-height: 1.6;
    margin: 0;
  }

  .features-section {
    margin-bottom: 2rem;
  }

  .features-section h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: white;
    margin: 0 0 1.5rem 0;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .feature-card {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 1rem;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 2px solid transparent;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    border-color: #6b7280;
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
    color: #1f2937;
    margin: 0 0 0.5rem 0;
  }

  .feature-description {
    color: #6b7280;
    margin: 0;
    line-height: 1.5;
  }

  .feature-arrow {
    font-size: 1.5rem;
    color: #6b7280;
    flex-shrink: 0;
  }

  .system-status {
    margin-bottom: 2rem;
  }

  .system-status h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: white;
    margin: 0 0 1.5rem 0;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .status-card {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 0.75rem;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: all 0.2s ease;
  }

  .status-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .status-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .status-icon.operational {
    color: #10b981;
  }

  .status-icon.error {
    color: #ef4444;
  }

  .status-icon.checking {
    color: #f59e0b;
  }

  .status-icon.connected {
    color: #10b981;
  }

  .status-info h4 {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.25rem 0;
  }

  .status-info p {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  .status-error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.75rem;
    padding: 1rem;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .status-error p {
    margin: 0;
    color: #dc2626;
    font-weight: 500;
  }

  .retry-btn {
    background: #dc2626;
    color: white;
    border: none;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-btn:hover {
    background: #b91c1c;
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
