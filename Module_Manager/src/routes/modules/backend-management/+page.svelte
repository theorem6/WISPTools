<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/firebase';
  import ServiceStatus from './components/ServiceStatus.svelte';
  import SystemResources from './components/SystemResources.svelte';
  import QuickActions from './components/QuickActions.svelte';
  import { isPlatformAdmin } from '$lib/services/adminService';
  
  // Platform admin check
  let hasPlatformAdminAccess = false;
  let isLoading = true;
  let user: any = null;
  
  onMount(async () => {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      goto('/login');
      return;
    }
    
    user = currentUser;
    
    // Check if user is platform admin
    hasPlatformAdminAccess = isPlatformAdmin(currentUser.email ?? null);
    
    if (!hasPlatformAdminAccess) {
      alert('⛔ Access Denied: Platform Admin only');
      goto('/dashboard');
      return;
    }
    
    isLoading = false;
  });
</script>

<svelte:head>
  <title>Backend Management - Platform Admin</title>
</svelte:head>

{#if isLoading}
  <div class="loading">
    <div class="spinner"></div>
    <p>Verifying admin access...</p>
  </div>
{:else if hasPlatformAdminAccess}
  <div class="backend-management">
    <!-- Admin Banner -->
    <div class="admin-banner">
      <span>🔐 Platform Administrator Mode</span>
      <span class="admin-user">{user?.email}</span>
    </div>
    
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1>🖥️ Backend Server Management</h1>
        <p class="subtitle">Monitor and control backend services on 136.112.111.167</p>
      </div>
      <a href="/dashboard" class="btn-back">
        ← Back to Dashboard
      </a>
    </div>
    
    <!-- Main Content -->
    <div class="content-grid">
      <!-- System Overview -->
      <div class="section full-width">
        <h2>🌐 System Overview</h2>
        <div class="systems-grid">
          <!-- Frontend -->
          <div class="system-card frontend">
            <div class="system-header">
              <h3>🌐 Frontend</h3>
              <span class="status-badge status-online">🟢 Online</span>
            </div>
            <div class="system-details">
              <div class="detail-item">
                <span class="label">Platform:</span>
                <span class="value">Firebase Hosting</span>
              </div>
              <div class="detail-item">
                <span class="label">URL:</span>
                <span class="value"><a href="https://wisptools.io" target="_blank">wisptools.io</a></span>
              </div>
              <div class="detail-item">
                <span class="label">Status:</span>
                <span class="value">Deployed & Active</span>
              </div>
            </div>
          </div>
          
          <!-- Backend -->
          <div class="system-card backend">
            <div class="system-header">
              <h3>🖥️ Backend API</h3>
              <span class="status-badge status-online">🟢 Online</span>
            </div>
            <div class="system-details">
              <div class="detail-item">
                <span class="label">Platform:</span>
                <span class="value">Google Cloud Functions</span>
              </div>
              <div class="detail-item">
                <span class="label">Region:</span>
                <span class="value">us-central1</span>
              </div>
              <div class="detail-item">
                <span class="label">Status:</span>
                <span class="value">Running</span>
              </div>
            </div>
          </div>
          
          <!-- Services -->
          <div class="system-card services">
            <div class="system-header">
              <h3>⚙️ Services</h3>
              <span class="status-badge status-online">🟢 Monitoring</span>
            </div>
            <div class="system-details">
              <div class="detail-item">
                <span class="label">Backend Server:</span>
                <span class="value">136.112.111.167</span>
              </div>
              <div class="detail-item">
                <span class="label">Services:</span>
                <span class="value">PM2 + systemd</span>
              </div>
              <div class="detail-item">
                <span class="label">Status:</span>
                <span class="value">See below</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Service Status -->
      <div class="section full-width">
        <ServiceStatus />
      </div>
      
      <!-- System Resources -->
      <div class="section">
        <SystemResources />
      </div>
      
      <!-- Quick Actions -->
      <div class="section">
        <QuickActions />
      </div>
    </div>
  </div>
{:else}
  <div class="access-denied">
    <div class="denied-icon">🔒</div>
    <h2>Access Denied</h2>
    <p>This module is restricted to platform administrators only.</p>
    <a href="/dashboard" class="btn-primary">← Back to Dashboard</a>
  </div>
{/if}

<style>
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    color: var(--text-secondary);
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color);
    border-top: 4px solid var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: var(--spacing-md);
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .backend-management {
    min-height: 100vh;
    background: var(--bg-primary);
  }
  
  .admin-banner {
    background: var(--danger-color);
    color: white;
    padding: var(--spacing-sm) var(--spacing-xl);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    font-size: 0.875rem;
  }
  
  .admin-user {
    font-family: monospace;
  }
  
  .page-header {
    background: var(--card-bg);
    border-bottom: 2px solid var(--border-color);
    padding: var(--spacing-xl);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .page-header h1 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.75rem;
    font-weight: 600;
  }
  
  .subtitle {
    margin: var(--spacing-xs) 0 0 0;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
  
  .btn-back {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    text-decoration: none;
    font-weight: 500;
    transition: var(--transition);
  }
  
  .btn-back:hover {
    background: var(--bg-tertiary);
    border-color: var(--primary-color);
    transform: translateY(-1px);
  }
  
  .content-grid {
    max-width: 1800px;
    margin: 0 auto;
    padding: var(--spacing-xl) var(--spacing-xl) var(--spacing-xxl) var(--spacing-xl);
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-xxl);
  }
  
  .section {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-xl);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
  
  .section.full-width {
    grid-column: 1 / -1;
  }
  
  .access-denied {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    padding: var(--spacing-xl);
    text-align: center;
  }
  
  .denied-icon {
    font-size: 4rem;
    margin-bottom: var(--spacing-lg);
  }
  
  .access-denied h2 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-primary);
  }
  
  .access-denied p {
    color: var(--text-secondary);
    margin-bottom: var(--spacing-xl);
  }
  
  .btn-primary {
    padding: var(--spacing-sm) var(--spacing-xl);
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--border-radius-sm);
    text-decoration: none;
    font-weight: 500;
    transition: var(--transition);
    display: inline-block;
  }
  
  .btn-primary:hover {
    background: var(--primary-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
  
  .systems-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--spacing-xl);
    margin-top: var(--spacing-lg);
  }
  
  .system-card {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-xl);
    transition: var(--transition);
  }
  
  .system-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  
  .system-card.frontend {
    border-color: #3b82f6;
  }
  
  .system-card.backend {
    border-color: #10b981;
  }
  
  .system-card.services {
    border-color: #8b5cf6;
  }
  
  .system-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--border-color);
  }
  
  .system-header h3 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--text-primary);
  }
  
  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  
  .status-online {
    background: #d1fae5;
    color: #065f46;
  }
  
  .system-details {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  
  .detail-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
  }
  
  .detail-item .label {
    color: var(--text-secondary);
    font-weight: 500;
  }
  
  .detail-item .value {
    color: var(--text-primary);
    font-weight: 600;
  }
  
  .detail-item a {
    color: var(--primary-color);
    text-decoration: none;
  }
  
  .detail-item a:hover {
    text-decoration: underline;
  }
  
  @media (max-width: 1024px) {
    .content-grid {
      grid-template-columns: 1fr;
    }
    
    .systems-grid {
      grid-template-columns: 1fr;
    }
  }
</style>