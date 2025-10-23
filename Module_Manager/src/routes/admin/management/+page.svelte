<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  import { isPlatformAdmin } from '$lib/services/adminService';

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
      path: '/modules/tenant-management'
    }
  ];

  let isAdmin = false;
  let currentUser: any = null;

  onMount(async () => {
    if (browser) {
      currentUser = await authService.getCurrentUser();
      isAdmin = isPlatformAdmin(currentUser?.email || null);
    }
  });

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

      <!-- Quick Actions -->
      <div class="quick-actions">
        <h2>Quick Actions</h2>
        <div class="actions-grid">
          <button class="action-btn" on:click={() => goto('/admin/tenant-management')}>
            <span class="action-icon">🏢</span>
            <span class="action-text">Manage Tenants</span>
          </button>
          <button class="action-btn" on:click={() => goto('/modules/user-management')}>
            <span class="action-icon">👥</span>
            <span class="action-text">Manage Users</span>
          </button>
          <button class="action-btn" on:click={() => goto('/modules/backend-management')}>
            <span class="action-icon">⚙️</span>
            <span class="action-text">System Settings</span>
          </button>
          <button class="action-btn" on:click={() => goto('/modules/tenant-management')}>
            <span class="action-icon">💳</span>
            <span class="action-text">Billing</span>
          </button>
        </div>
      </div>

      <!-- System Status -->
      <div class="system-status">
        <h2>System Status</h2>
        <div class="status-grid">
          <div class="status-card">
            <div class="status-icon">🟢</div>
            <div class="status-info">
              <h4>System Health</h4>
              <p>All systems operational</p>
            </div>
          </div>
          <div class="status-card">
            <div class="status-icon">📊</div>
            <div class="status-info">
              <h4>Active Tenants</h4>
              <p>Multiple tenants active</p>
            </div>
          </div>
          <div class="status-card">
            <div class="status-icon">👥</div>
            <div class="status-info">
              <h4>Total Users</h4>
              <p>Users across all tenants</p>
            </div>
          </div>
          <div class="status-card">
            <div class="status-icon">💾</div>
            <div class="status-info">
              <h4>Database</h4>
              <p>MongoDB Atlas connected</p>
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

  .quick-actions {
    margin-bottom: 2rem;
  }

  .quick-actions h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: white;
    margin: 0 0 1.5rem 0;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
    border-color: #6b7280;
  }

  .action-icon {
    font-size: 1.5rem;
  }

  .action-text {
    font-size: 0.875rem;
    font-weight: 500;
    color: #1f2937;
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
  }

  .status-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
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

    .actions-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .status-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
