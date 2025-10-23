<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  import { isPlatformAdmin } from '$lib/services/adminService';

  interface PlanFeature {
    id: string;
    name: string;
    description: string;
    icon: string;
    path: string;
    status: 'active' | 'coming-soon';
    features: string[];
  }

  const planFeatures: PlanFeature[] = [
    {
      id: 'coverage-mapping',
      name: 'Coverage Mapping',
      description: 'Interactive coverage visualization and network planning',
      icon: '🗺️',
      path: '/modules/coverage-map',
      status: 'active',
      features: ['Site Management', 'Coverage Visualization', 'Network Planning', 'Asset Tracking']
    },
    {
      id: 'inventory-management',
      name: 'Inventory Management',
      description: 'Equipment tracking and asset management',
      icon: '📦',
      path: '/modules/inventory',
      status: 'active',
      features: ['Equipment Tracking', 'Asset Management', 'Purchase Orders', 'Warranty Tracking']
    },
    {
      id: 'cbrs-management',
      name: 'CBRS Management',
      description: 'Spectrum planning and device registration',
      icon: '📡',
      path: '/modules/cbrs-management',
      status: 'active',
      features: ['Device Registration', 'Spectrum Planning', 'Grant Management', 'SAS Integration']
    },
    {
      id: 'site-planning',
      name: 'Site Planning',
      description: 'Tower placement and sector optimization',
      icon: '🏗️',
      path: '/modules/coverage-map', // Reuse coverage map for site planning
      status: 'active',
      features: ['Tower Placement', 'Sector Optimization', 'RF Planning', 'Site Documentation']
    },
    {
      id: 'capacity-planning',
      name: 'Capacity Planning',
      description: 'Bandwidth and user capacity analysis',
      icon: '📊',
      path: '/modules/monitoring', // Link to monitoring for capacity data
      status: 'active',
      features: ['Bandwidth Analysis', 'User Capacity', 'Growth Planning', 'Resource Allocation']
    },
    {
      id: 'cost-analysis',
      name: 'Cost Analysis',
      description: 'ROI calculations and budget planning',
      icon: '💰',
      path: '/modules/inventory/reports', // Link to inventory reports
      status: 'active',
      features: ['ROI Calculations', 'Budget Planning', 'Cost Tracking', 'Financial Analysis']
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

  function handleFeatureClick(feature: PlanFeature) {
    if (feature.status === 'active') {
      goto(feature.path);
    }
  }

  function goBack() {
    goto('/dashboard');
  }
</script>

<TenantGuard requireTenant={false}>
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
        <div class="user-info">
          {#if currentUser}
            <span class="user-name">{currentUser.email}</span>
            <span class="user-role">{$currentTenant?.name || 'No Tenant'}</span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="module-content">
      <!-- Overview -->
      <div class="overview-section">
        <h2>Planning Overview</h2>
        <p>The Plan module provides comprehensive tools for strategic network planning, including coverage mapping, inventory management, CBRS spectrum planning, site planning, capacity analysis, and cost optimization. This module helps you design and optimize your network infrastructure before deployment.</p>
      </div>

      <!-- Features Grid -->
      <div class="features-section">
        <h2>Planning Features</h2>
        <div class="features-grid">
          {#each planFeatures as feature (feature.id)}
            <div class="feature-card" on:click={() => handleFeatureClick(feature)}>
              <div class="feature-header">
                <span class="feature-icon">{feature.icon}</span>
                <div class="feature-info">
                  <h3 class="feature-name">{feature.name}</h3>
                  <p class="feature-description">{feature.description}</p>
                </div>
                <span class="feature-status {feature.status}">
                  {feature.status === 'active' ? '✅' : '🚧'}
                </span>
              </div>
              <div class="feature-features">
                <h4>Key Features:</h4>
                <ul>
                  {#each feature.features as feat}
                    <li>{feat}</li>
                  {/each}
                </ul>
              </div>
              <div class="feature-arrow">→</div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Planning Workflow -->
      <div class="workflow-section">
        <h2>Planning Workflow</h2>
        <div class="workflow-steps">
          <div class="workflow-step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h3>Coverage Analysis</h3>
              <p>Analyze current coverage gaps and identify expansion opportunities</p>
            </div>
          </div>
          <div class="workflow-step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h3>Site Planning</h3>
              <p>Plan new tower locations and optimize existing sites</p>
            </div>
          </div>
          <div class="workflow-step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h3>Spectrum Planning</h3>
              <p>Register CBRS devices and plan frequency allocation</p>
            </div>
          </div>
          <div class="workflow-step">
            <div class="step-number">4</div>
            <div class="step-content">
              <h3>Capacity Planning</h3>
              <p>Analyze bandwidth requirements and user capacity</p>
            </div>
          </div>
          <div class="workflow-step">
            <div class="step-number">5</div>
            <div class="step-content">
              <h3>Cost Analysis</h3>
              <p>Calculate ROI and budget for network expansion</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</TenantGuard>

<style>
  /* General Module Styling */
  .plan-module {
    background: var(--background-color);
    min-height: 100vh;
    padding: 2rem;
    color: var(--text-color);
  }

  .module-header {
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    border-radius: var(--border-radius-lg);
    padding: 1.5rem 2rem;
    margin-bottom: 2rem;
    box-shadow: var(--shadow-md);
    color: white;
    position: relative;
    overflow: hidden;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .back-btn {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: none;
    border-radius: var(--border-radius-md);
    padding: 0.5rem 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: background 0.2s ease;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .back-icon {
    font-size: 1.2rem;
  }

  .module-title h1 {
    font-size: 2rem;
    margin: 0;
    font-weight: 700;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .module-title p {
    font-size: 0.9rem;
    margin: 0;
    opacity: 0.8;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-size: 0.85rem;
    opacity: 0.9;
  }

  .user-name {
    font-weight: 600;
  }

  .user-role {
    font-style: italic;
  }

  .module-content {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    padding: 2rem;
    box-shadow: var(--shadow-lg);
  }

  .overview-section, .features-section, .workflow-section {
    margin-bottom: 2rem;
  }

  h2 {
    font-size: 1.8rem;
    color: var(--primary-color);
    margin-bottom: 1.5rem;
    border-bottom: 2px solid var(--border-color);
    padding-bottom: 0.5rem;
  }

  /* Features Grid */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .feature-card {
    background: var(--secondary-bg);
    border-radius: var(--border-radius-md);
    padding: 1.5rem;
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    transition: all 0.2s ease;
    border: 2px solid transparent;
  }

  .feature-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
    border-color: var(--primary-color);
  }

  .feature-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .feature-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .feature-info {
    flex-grow: 1;
  }

  .feature-name {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--primary-color);
    margin: 0 0 0.5rem 0;
  }

  .feature-description {
    font-size: 0.9rem;
    color: var(--text-color-light);
    margin: 0;
  }

  .feature-status {
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .feature-features {
    margin-bottom: 1rem;
  }

  .feature-features h4 {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 0.5rem 0;
  }

  .feature-features ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .feature-features li {
    font-size: 0.8rem;
    color: var(--text-color-light);
    margin-bottom: 0.25rem;
    padding-left: 1rem;
    position: relative;
  }

  .feature-features li::before {
    content: '•';
    color: var(--primary-color);
    position: absolute;
    left: 0;
  }

  .feature-arrow {
    text-align: right;
    font-size: 1.2rem;
    color: var(--primary-color);
    opacity: 0.7;
  }

  /* Workflow Section */
  .workflow-steps {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .workflow-step {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--secondary-bg);
    border-radius: var(--border-radius-md);
    box-shadow: var(--shadow-sm);
  }

  .step-number {
    background: var(--primary-color);
    color: white;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    flex-shrink: 0;
  }

  .step-content h3 {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--primary-color);
    margin: 0 0 0.25rem 0;
  }

  .step-content p {
    font-size: 0.9rem;
    color: var(--text-color-light);
    margin: 0;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: flex-start;
    }

    .user-info {
      align-items: flex-start;
    }

    .features-grid {
      grid-template-columns: 1fr;
    }

    .module-content {
      padding: 1rem;
    }

    .workflow-step {
      flex-direction: column;
      text-align: center;
    }
  }
</style>