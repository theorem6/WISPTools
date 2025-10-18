<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/firebase';
  import ServiceStatus from './components/ServiceStatus.svelte';
  import SystemResources from './components/SystemResources.svelte';
  import QuickActions from './components/QuickActions.svelte';
  
  // Platform admin check
  let isPlatformAdmin = false;
  let isLoading = true;
  let user: any = null;
  
  onMount(async () => {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      goto('/login');
      return;
    }
    
    user = currentUser;
    
    // Check if user is platform admin (david@david.com)
    isPlatformAdmin = currentUser.email === 'david@david.com';
    
    if (!isPlatformAdmin) {
      alert('⛔ Access Denied: Platform Admin only');
      goto('/modules');
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
{:else if isPlatformAdmin}
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
      <a href="/modules" class="btn-back">
        ← Back to Modules
      </a>
    </div>
    
    <!-- Main Content -->
    <div class="content-grid">
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
    <a href="/modules" class="btn-primary">Return to Modules</a>
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
    max-width: 1600px;
    margin: 0 auto;
    padding: var(--spacing-xl);
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-xl);
  }
  
  .section {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-lg);
    box-shadow: var(--shadow-sm);
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
  
  @media (max-width: 1024px) {
    .content-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

