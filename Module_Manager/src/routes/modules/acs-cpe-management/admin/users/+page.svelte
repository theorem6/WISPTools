<script lang="ts">
  import { onMount } from 'svelte';
  import MainMenu from '../../components/MainMenu.svelte';
  
  let isLoading = false;
  
  onMount(async () => {
    console.log('Users page loaded');
  });
</script>

<svelte:head>
  <title>Users - ACS Administration</title>
  <meta name="description" content="User management and permissions" />
</svelte:head>

<div class="users-page">
  <MainMenu />
  
  <div class="page-header">
    <div class="header-content">
      <h1 class="page-title">
        <span class="page-icon">👥</span>
        User Management
      </h1>
      <p class="page-description">
        Manage user accounts, roles, and permissions
      </p>
    </div>
  </div>

  <div class="content">
    <div class="placeholder">
      <div class="placeholder-icon">👥</div>
      <h2>User Management System</h2>
      <p>This section will contain user accounts, role-based access control, and permission management.</p>
      <div class="features">
        <div class="feature">👤 User account management</div>
        <div class="feature">🔐 Role-based access control</div>
        <div class="feature">🛡️ Permission management</div>
      </div>
    </div>
  </div>
</div>

<style>
  .users-page {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .page-header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 1.5rem 2rem;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .page-icon {
    font-size: 1.25rem;
  }

  .page-description {
    color: var(--text-secondary);
    margin: 0;
  }

  .content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .placeholder {
    text-align: center;
    padding: 4rem 2rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
  }

  .placeholder-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .placeholder h2 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }

  .placeholder p {
    color: var(--text-secondary);
    margin-bottom: 2rem;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }

  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    max-width: 600px;
    margin: 0 auto;
  }

  .feature {
    background: var(--bg-primary);
    padding: 1rem;
    border-radius: 0.25rem;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }
</style>
