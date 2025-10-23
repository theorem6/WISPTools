<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  import { isPlatformAdmin } from '$lib/services/adminService';

  interface MonitorFeature {
    id: string;
    name: string;
    description: string;
    icon: string;
    path: string;
    status: 'active' | 'coming-soon';
    features: string[];
  }

  const monitorFeatures: MonitorFeature[] = [
    {
      id: 'network-monitoring',
      name: 'Network Monitoring',
      description: 'Real-time performance metrics and alerts',
      icon: '📊',
      path: '/modules/monitoring',
      status: 'active',
      features: ['Real-time Metrics', 'Performance Monitoring', 'Network Health', 'Status Dashboard']
    },
    {
      id: 'device-health',
      name: 'Device Health',
      description: 'Equipment status and diagnostics',
      icon: '🏥',
      path: '/modules/acs-cpe-management', // Link to ACS for device health
      status: 'active',
      features: ['Device Diagnostics', 'Health Monitoring', 'Fault Detection', 'Performance Metrics']
    },
    {
      id: 'traffic-analysis',
      name: 'Traffic Analysis',
      description: 'Bandwidth utilization and user behavior',
      icon: '📈',
      path: '/modules/monitoring', // Link to monitoring for traffic analysis
      status: 'active',
      features: ['Bandwidth Analysis', 'User Behavior', 'Traffic Patterns', 'Utilization Reports']
    },
    {
      id: 'performance-analytics',
      name: 'Performance Analytics',
      description: 'KPIs and trend analysis',
      icon: '📉',
      path: '/modules/monitoring', // Link to monitoring for analytics
      status: 'active',
      features: ['KPI Tracking', 'Trend Analysis', 'Performance Reports', 'Historical Data']
    },
    {
      id: 'alert-management',
      name: 'Alert Management',
      description: 'Automated notifications and escalation',
      icon: '🚨',
      path: '/modules/monitoring', // Link to monitoring for alerts
      status: 'active',
      features: ['Automated Alerts', 'Escalation Rules', 'Notification Management', 'Alert History']
    },
    {
      id: 'sla-monitoring',
      name: 'SLA Monitoring',
      description: 'Service level agreement compliance',
      icon: '📋',
      path: '/modules/monitoring', // Link to monitoring for SLA
      status: 'active',
      features: ['SLA Compliance', 'Service Metrics', 'Uptime Tracking', 'Performance Targets']
    },
    {
      id: 'hss-management',
      name: 'HSS Management',
      description: 'LTE core subscriber database management',
      icon: '🗄️',
      path: '/modules/hss-management',
      status: 'active',
      features: ['Subscriber Management', 'SIM Card Tracking', 'User Provisioning', 'Database Monitoring']
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

  function handleFeatureClick(feature: MonitorFeature) {
    if (feature.status === 'active') {
      goto(feature.path);
    }
  }

  function goBack() {
    goto('/dashboard');
  }
</script>

<TenantGuard requireTenant={false}>
  <div class="monitor-module">
    <!-- Header -->
    <div class="module-header">
      <div class="header-content">
        <button class="back-btn" on:click={goBack}>
          <span class="back-icon">←</span>
          Back to Dashboard
        </button>
        <div class="module-title">
          <h1>📊 Monitor Module</h1>
          <p>Real-time network monitoring and performance management</p>
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
        <h2>Monitoring Overview</h2>
        <p>The Monitor module provides comprehensive real-time monitoring capabilities for your network infrastructure, including network performance metrics, device health monitoring, traffic analysis, performance analytics, alert management, SLA monitoring, and HSS subscriber database management. This module ensures optimal network performance and reliability.</p>
      </div>

      <!-- Features Grid -->
      <div class="features-section">
        <h2>Monitoring Features</h2>
        <div class="features-grid">
          {#each monitorFeatures as feature (feature.id)}
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

      <!-- Monitoring Dashboard Preview -->
      <div class="dashboard-preview">
        <h2>Live Monitoring Dashboard</h2>
        <div class="dashboard-grid">
          <div class="dashboard-card">
            <h3>Network Status</h3>
            <div class="status-indicators">
              <div class="status-item">
                <span class="status-dot operational"></span>
                <span>Operational</span>
              </div>
              <div class="status-item">
                <span class="status-dot warning"></span>
                <span>Warning</span>
              </div>
              <div class="status-item">
                <span class="status-dot critical"></span>
                <span>Critical</span>
              </div>
            </div>
          </div>
          <div class="dashboard-card">
            <h3>Active Alerts</h3>
            <div class="alert-count">3</div>
            <p>Active alerts requiring attention</p>
          </div>
          <div class="dashboard-card">
            <h3>Uptime</h3>
            <div class="uptime-value">99.9%</div>
            <p>Network availability</p>
          </div>
          <div class="dashboard-card">
            <h3>Active Users</h3>
            <div class="user-count">1,247</div>
            <p>Currently connected</p>
          </div>
        </div>
      </div>

      <!-- Monitoring Workflow -->
      <div class="workflow-section">
        <h2>Monitoring Workflow</h2>
        <div class="workflow-steps">
          <div class="workflow-step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h3>Data Collection</h3>
              <p>Collect metrics from network devices and systems</p>
            </div>
          </div>
          <div class="workflow-step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h3>Analysis</h3>
              <p>Analyze performance data and identify trends</p>
            </div>
          </div>
          <div class="workflow-step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h3>Alerting</h3>
              <p>Generate alerts for anomalies and issues</p>
            </div>
          </div>
          <div class="workflow-step">
            <div class="step-number">4</div>
            <div class="step-content">
              <h3>Reporting</h3>
              <p>Create reports and dashboards for stakeholders</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</TenantGuard>

<style>
  /* General Module Styling */
  .monitor-module {
    background: var(--background-color);
    min-height: 100vh;
    padding: 2rem;
    color: var(--text-color);
  }

  .module-header {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
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

  .overview-section, .features-section, .dashboard-preview, .workflow-section {
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

  .status-indicators {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .status-dot.operational {
    background: #10b981;
  }

  .status-dot.warning {
    background: #f59e0b;
  }

  .status-dot.critical {
    background: #ef4444;
  }

  .alert-count, .uptime-value, .user-count {
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

    .dashboard-grid {
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