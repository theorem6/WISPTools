<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { authService } from '$lib/services/authService';
  import { isPlatformAdmin } from '$lib/services/adminService';
  import { goto } from '$app/navigation';
  
  let isAdmin = false;
  let isChecking = true;
  
  onMount(async () => {
    if (!browser) return;
    
    const user = await authService.getCurrentUser();
    isAdmin = isPlatformAdmin(user?.email || null);
    
    if (!isAdmin) {
      // Redirect non-admins away from admin pages
      // Use replaceState to avoid adding to history
      await goto('/dashboard', { replaceState: true });
      return;
    }
    
    // Hide dashboard and modules only after confirming we're admin and on admin route
    setTimeout(() => {
      const dashboardElement = document.querySelector('.dashboard-container');
      const modulesSection = document.querySelector('.modules-section');
      const modulesGrid = document.querySelector('.modules-grid');
      if (dashboardElement) {
        (dashboardElement as HTMLElement).style.display = 'none';
      }
      if (modulesSection) {
        (modulesSection as HTMLElement).style.display = 'none';
      }
      if (modulesGrid) {
        (modulesGrid as HTMLElement).style.display = 'none';
      }
    }, 100);
    
    isChecking = false;
  });
</script>

{#if isChecking}
  <div class="admin-checking">
    <div class="spinner"></div>
    <p>Verifying admin access...</p>
  </div>
{:else if isAdmin}
  <!-- Admin pages - no module navigation, just content -->
  <!-- This layout completely isolates admin pages from dashboard/modules -->
  <div class="admin-layout-wrapper">
    <div class="admin-layout">
      <slot />
    </div>
  </div>
{:else}
  <div class="access-denied">
    <h2>Access Denied</h2>
    <p>You must be a platform administrator to access this page.</p>
  </div>
{/if}

<style>
  .admin-checking,
  .access-denied {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: var(--spacing-md);
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .admin-layout-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 99999;
    background: var(--bg-primary);
    overflow-y: auto;
  }
  
  .admin-layout {
    min-height: 100vh;
    width: 100%;
    background: var(--bg-primary);
  }
</style>

