<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';

  interface PlanFeature {
    id: string;
    name: string;
    description: string;
    icon: string;
    path: string;
    status: 'active' | 'coming-soon';
  }

  const planFeatures: PlanFeature[] = [
    {
      id: 'coverage-mapping',
      name: 'Coverage Mapping',
      description: 'Interactive coverage visualization and planning tools',
      icon: '🗺️',
      path: '/modules/coverage-map',
      status: 'active'
    },
    {
      id: 'inventory-management',
      name: 'Inventory Management',
      description: 'Equipment tracking and asset management',
      icon: '📦',
      path: '/modules/inventory',
      status: 'active'
    },
    {
      id: 'cbrs-management',
      name: 'CBRS Management',
      description: 'Spectrum planning and device registration',
      icon: '📡',
      path: '/modules/cbrs-management',
      status: 'active'
    },
    {
      id: 'site-planning',
      name: 'Site Planning',
      description: 'Tower placement and sector optimization',
      icon: '🏗️',
      path: '/modules/coverage-map',
      status: 'active'
    },
    {
      id: 'capacity-planning',
      name: 'Capacity Planning',
      description: 'Bandwidth and user capacity analysis',
      icon: '📊',
      path: '/modules/monitoring',
      status: 'active'
    },
    {
      id: 'cost-analysis',
      name: 'Cost Analysis',
      description: 'ROI calculations and budget planning',
      icon: '💰',
      path: '/modules/inventory/reports',
      status: 'active'
    }
  ];

  function handleFeatureClick(feature: PlanFeature) {
    if (feature.status === 'active') {
      goto(feature.path);
    }
  }

  function goBack() {
    goto('/dashboard');
  }
</script>

<TenantGuard>
  <div class="plan-module">
    <!-- Header -->
    <div class="module-header">
      <div class="header-content">
        <button class="back-btn" on:click={goBack}>
          <span class="back-icon">←</span>
          Back to Dashboard
        </button>
        <div class="module-title">
          <h1>📋 Plan Module</h1>
          <p>Strategic planning and design tools for network expansion and optimization</p>
        </div>
        <div class="tenant-info">
          {#if $currentTenant}
            <span class="tenant-name">{$currentTenant.displayName}</span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="module-content">
      <!-- Overview -->
      <div class="overview-section">
        <h2>Planning Overview</h2>
        <p>The Plan module provides comprehensive tools for strategic network planning, including coverage mapping, inventory management, CBRS spectrum planning, and capacity analysis. Use these tools to design and optimize your WISP network for maximum coverage and efficiency.</p>
      </div>

      <!-- Features Grid -->
      <div class="features-section">
        <h2>Planning Features</h2>
        <div class="features-grid">
          {#each planFeatures as feature}
            <div 
              class="feature-card" 
              class:active={feature.status === 'active'}
              class:coming-soon={feature.status === 'coming-soon'}
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
              <div class="feature-status">
                {#if feature.status === 'active'}
                  <span class="status-badge active">Active</span>
                {:else}
                  <span class="status-badge coming-soon">Coming Soon</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <h2>Quick Actions</h2>
        <div class="actions-grid">
          <button class="action-btn" on:click={() => goto('/modules/coverage-map')}>
            <span class="action-icon">🗺️</span>
            <span class="action-text">View Coverage Map</span>
          </button>
          <button class="action-btn" on:click={() => goto('/modules/inventory')}>
            <span class="action-icon">📦</span>
            <span class="action-text">Manage Inventory</span>
          </button>
          <button class="action-btn" on:click={() => goto('/modules/cbrs-management')}>
            <span class="action-icon">📡</span>
            <span class="action-text">CBRS Management</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</TenantGuard>

<style>
  .plan-module {
    min-height: 100vh;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
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

  .tenant-info {
    display: flex;
    align-items: center;
  }

  .tenant-name {
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    font-weight: 500;
    color: #1f2937;
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
    flex-direction: column;
    gap: 1rem;
  }

  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    border-color: #3b82f6;
  }

  .feature-card.active {
    border-color: #3b82f6;
  }

  .feature-card.coming-soon {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .feature-icon {
    font-size: 2rem;
    text-align: center;
  }

  .feature-info {
    text-align: center;
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

  .feature-status {
    display: flex;
    justify-content: center;
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
  }
</style>
