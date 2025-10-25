<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  import { isPlatformAdmin } from '$lib/services/adminService';
  import { iframeCommunicationService, type ModuleContext } from '$lib/services/iframeCommunicationService';

  interface MaintainFeature {
    id: string;
    name: string;
    description: string;
    icon: string;
    path: string;
    status: 'active' | 'coming-soon';
    features: string[];
  }

  const maintainFeatures: MaintainFeature[] = [
    {
      id: 'ticketing-system',
      name: 'Ticketing System',
      description: 'Customer support and issue tracking',
      icon: '🎫',
      path: '/modules/help-desk',
      status: 'active',
      features: ['Issue Tracking', 'Customer Support', 'Ticket Management', 'Priority Handling']
    },
    {
      id: 'preventive-maintenance',
      name: 'Preventive Maintenance',
      description: 'Scheduled maintenance and inspections',
      icon: '🔧',
      path: '/modules/work-orders', // Link to work orders for maintenance
      status: 'active',
      features: ['Scheduled Maintenance', 'Equipment Inspections', 'Preventive Tasks', 'Maintenance History']
    },
    {
      id: 'incident-management',
      name: 'Incident Management',
      description: 'Outage response and resolution',
      icon: '🚨',
      path: '/modules/help-desk', // Link to help desk for incidents
      status: 'active',
      features: ['Outage Response', 'Incident Tracking', 'Resolution Management', 'Post-Incident Analysis']
    },
    {
      id: 'customer-support',
      name: 'Customer Support',
      description: 'Help desk and support ticket management',
      icon: '🎧',
      path: '/modules/help-desk',
      status: 'active',
      features: ['Help Desk', 'Support Tickets', 'Customer Communication', 'Knowledge Base']
    },
    {
      id: 'vendor-management',
      name: 'Vendor Management',
      description: 'Third-party service coordination',
      icon: '🤝',
      path: '/modules/work-orders', // Link to work orders for vendor management
      status: 'active',
      features: ['Vendor Coordination', 'Service Contracts', 'Third-party Management', 'Service Level Tracking']
    },
    {
      id: 'knowledge-base',
      name: 'Knowledge Base',
      description: 'Documentation and troubleshooting guides',
      icon: '📚',
      path: '/modules/help-desk', // Link to help desk for knowledge base
      status: 'active',
      features: ['Documentation', 'Troubleshooting Guides', 'Best Practices', 'Training Materials']
    },
    {
      id: 'sla-management',
      name: 'SLA Management',
      description: 'Service level tracking and reporting',
      icon: '📋',
      path: '/modules/monitoring', // Link to monitoring for SLA management
      status: 'active',
      features: ['SLA Tracking', 'Service Level Reporting', 'Compliance Monitoring', 'Performance Metrics']
    },
    {
      id: 'asset-management',
      name: 'Asset Management',
      description: 'Hardware inventory and equipment tracking',
      icon: '📦',
      path: '/modules/inventory',
      status: 'active',
      features: ['Hardware Upload', 'Equipment Tracking', 'Asset Tagging', 'Inventory Management']
    }
  ];

  let isAdmin = false;
  let currentUser: any = null;
  let mapContainer: HTMLDivElement;

  // Module context for object state management
  let moduleContext: ModuleContext = {
    module: 'maintain',
    userRole: 'admin' // This should be determined from user permissions
  };

  onMount(async () => {
    if (browser) {
      currentUser = await authService.getCurrentUser();
      isAdmin = isPlatformAdmin(currentUser?.email || null);
      
      // Initialize iframe communication
      const iframe = mapContainer?.querySelector('iframe') as HTMLIFrameElement;
      if (iframe) {
        iframeCommunicationService.initialize(iframe, moduleContext);
        
        // Listen for iframe object actions
        window.addEventListener('iframe-object-action', handleIframeObjectAction);
      }
    }
    
    return () => {
      window.removeEventListener('iframe-object-action', handleIframeObjectAction);
      iframeCommunicationService.destroy();
    };
  });

  // Handle iframe object actions
  function handleIframeObjectAction(event: CustomEvent) {
    const { objectId, action, allowed, message, state } = event.detail;
    
    if (!allowed) {
      // Show user-friendly error message
      console.warn(`Action '${action}' denied for object ${objectId}: ${message}`);
      // In maintain module, we might want to show this differently
    } else {
      // Handle allowed actions
      console.log(`Action '${action}' allowed for object ${objectId}`);
      // Add specific handling for different actions here
    }
  }

  function handleFeatureClick(feature: MaintainFeature) {
    if (feature.status === 'active') {
      goto(feature.path);
    }
  }

  function goBack() {
    goto('/dashboard');
  }
</script>

<TenantGuard requireTenant={false}>
  <div class="maintain-module">
    <!-- Header -->
    <div class="module-header">
      <div class="header-content">
        <button class="back-btn" on:click={goBack}>
          <span class="back-icon">←</span>
          Back to Dashboard
        </button>
        <div class="module-title">
          <h1>🔧 Maintain Module</h1>
          <p>Traditional interface for ticketing and maintenance management</p>
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
        <h2>Maintenance Overview</h2>
        <p>The Maintain module provides comprehensive tools for managing customer support, maintenance operations, incident response, and service level agreements. This module ensures optimal service delivery and customer satisfaction through proactive maintenance and efficient issue resolution.</p>
      </div>

      <!-- Features Grid -->
      <div class="features-section">
        <h2>Maintenance Features</h2>
        <div class="features-grid">
          {#each maintainFeatures as feature (feature.id)}
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

      <!-- Maintenance Dashboard Preview -->
      <div class="dashboard-preview">
        <h2>Maintenance Dashboard</h2>
        <div class="dashboard-grid">
          <div class="dashboard-card">
            <h3>Open Tickets</h3>
            <div class="ticket-count">12</div>
            <p>Active support tickets</p>
          </div>
          <div class="dashboard-card">
            <h3>Scheduled Maintenance</h3>
            <div class="maintenance-count">5</div>
            <p>Upcoming maintenance tasks</p>
          </div>
          <div class="dashboard-card">
            <h3>Response Time</h3>
            <div class="response-time">2.3h</div>
            <p>Average ticket response</p>
          </div>
          <div class="dashboard-card">
            <h3>Customer Satisfaction</h3>
            <div class="satisfaction-score">4.8/5</div>
            <p>Support rating</p>
          </div>
        </div>
      </div>

      <!-- Maintenance Workflow -->
      <div class="workflow-section">
        <h2>Maintenance Workflow</h2>
        <div class="workflow-steps">
          <div class="workflow-step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h3>Issue Detection</h3>
              <p>Monitor systems and detect issues or receive customer reports</p>
            </div>
          </div>
          <div class="workflow-step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h3>Ticket Creation</h3>
              <p>Create support tickets and assign priority levels</p>
            </div>
          </div>
          <div class="workflow-step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h3>Resolution</h3>
              <p>Work on resolving issues and implementing fixes</p>
            </div>
          </div>
          <div class="workflow-step">
            <div class="step-number">4</div>
            <div class="step-content">
              <h3>Follow-up</h3>
              <p>Verify resolution and gather customer feedback</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Service Level Indicators -->
      <div class="sla-section">
        <h2>Service Level Indicators</h2>
        <div class="sla-grid">
          <div class="sla-card">
            <h3>Uptime SLA</h3>
            <div class="sla-value">99.9%</div>
            <div class="sla-bar">
              <div class="sla-progress" style="width: 99.9%"></div>
            </div>
            <p>Target: 99.5%</p>
          </div>
          <div class="sla-card">
            <h3>Response Time</h3>
            <div class="sla-value">2.3h</div>
            <div class="sla-bar">
              <div class="sla-progress" style="width: 85%"></div>
            </div>
            <p>Target: 4h</p>
          </div>
          <div class="sla-card">
            <h3>Resolution Time</h3>
            <div class="sla-value">8.5h</div>
            <div class="sla-bar">
              <div class="sla-progress" style="width: 70%"></div>
            </div>
            <p>Target: 24h</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</TenantGuard>

<style>
  /* General Module Styling */
  .maintain-module {
    background: var(--background-color);
    min-height: 100vh;
    padding: 2rem;
    color: var(--text-color);
  }

  .module-header {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
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

  .overview-section, .features-section, .dashboard-preview, .workflow-section, .sla-section {
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

  /* Dashboard Preview */
  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .dashboard-card {
    background: var(--secondary-bg);
    border-radius: var(--border-radius-md);
    padding: 1.5rem;
    box-shadow: var(--shadow-sm);
    text-align: center;
  }

  .dashboard-card h3 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--primary-color);
    margin: 0 0 1rem 0;
  }

  .ticket-count, .maintenance-count, .response-time, .satisfaction-score {
    font-size: 2rem;
    font-weight: 700;
    color: var(--primary-color);
    margin-bottom: 0.5rem;
  }

  .dashboard-card p {
    font-size: 0.8rem;
    color: var(--text-color-light);
    margin: 0;
  }

  /* SLA Section */
  .sla-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .sla-card {
    background: var(--secondary-bg);
    border-radius: var(--border-radius-md);
    padding: 1.5rem;
    box-shadow: var(--shadow-sm);
    text-align: center;
  }

  .sla-card h3 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--primary-color);
    margin: 0 0 1rem 0;
  }

  .sla-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--primary-color);
    margin-bottom: 1rem;
  }

  .sla-bar {
    background: var(--border-color);
    height: 8px;
    border-radius: 4px;
    margin-bottom: 0.5rem;
    overflow: hidden;
  }

  .sla-progress {
    background: var(--primary-color);
    height: 100%;
    transition: width 0.3s ease;
  }

  .sla-card p {
    font-size: 0.8rem;
    color: var(--text-color-light);
    margin: 0;
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

    .dashboard-grid, .sla-grid {
      grid-template-columns: repeat(2, 1fr);
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