<script lang="ts">
  import { customerAuthService } from '$lib/services/customerAuthService';
  import { goto } from '$app/navigation';
  import type { TenantBranding } from '$lib/services/brandingService';
  import { portalBranding } from '$lib/stores/portalBranding';
  
  export let branding: TenantBranding | null = null;
  
  let currentCustomer: any = null;
  let featureFlags = {
    faq: true,
    serviceStatus: true,
    knowledgeBase: false,
    liveChat: false
  };
  
  async function loadCustomer() {
    currentCustomer = await customerAuthService.getCurrentCustomer();
  }
  
  async function handleLogout() {
    const { authService } = await import('$lib/services/authService');
    await authService.signOut();
    goto('/modules/customers/portal/login');
  }
  
  $: if (branding) {
    loadCustomer();
  }

  $: featureFlags = {
    faq: $portalBranding?.features?.enableFAQ !== false,
    serviceStatus: $portalBranding?.features?.enableServiceStatus !== false,
    billing: $portalBranding?.features?.enableBilling !== false,
    tickets: $portalBranding?.features?.enableTickets !== false,
    knowledgeBase: !!$portalBranding?.features?.enableKnowledgeBase,
    liveChat: !!$portalBranding?.features?.enableLiveChat
  };
</script>

<header class="branded-header">
  <div class="header-content">
    <div class="logo-section">
      {#if branding?.logo?.url}
        <img src={branding.logo.url} alt={branding.logo.altText || 'Logo'} class="logo" />
      {:else}
        <div class="logo-placeholder">
          {branding?.company?.displayName || branding?.company?.name || 'Customer Portal'}
        </div>
      {/if}
    </div>
    
    {#if currentCustomer}
      <nav class="header-nav">
        <a href="/modules/customers/portal/dashboard" class="nav-link">Dashboard</a>
        {#if featureFlags.tickets}
          <a href="/modules/customers/portal/tickets" class="nav-link">Tickets</a>
        {/if}
        {#if featureFlags.billing}
          <a href="/modules/customers/portal/billing" class="nav-link">Billing</a>
        {/if}
        {#if featureFlags.serviceStatus}
          <a href="/modules/customers/portal/service" class="nav-link">Service Status</a>
        {/if}
        {#if featureFlags.faq}
          <a href="/modules/customers/portal/faq" class="nav-link">FAQ</a>
        {/if}
        {#if featureFlags.knowledgeBase}
          <a href="/modules/customers/portal/knowledge" class="nav-link">Knowledge Base</a>
        {/if}
        {#if featureFlags.liveChat}
          <a href="/modules/customers/portal/live-chat" class="nav-link">Live Chat</a>
        {/if}
        <div class="user-menu">
          <span class="user-name">{currentCustomer.fullName || currentCustomer.firstName}</span>
          <button on:click={handleLogout} class="logout-btn">Logout</button>
        </div>
      </nav>
    {/if}
  </div>
</header>

<style>
  .branded-header {
    background: var(--brand-primary);
    color: white;
    padding: 1rem 2rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .logo-section {
    display: flex;
    align-items: center;
  }
  
  .logo {
    max-height: 50px;
    max-width: 200px;
    object-fit: contain;
  }
  
  .logo-placeholder {
    font-size: 1.5rem;
    font-weight: 600;
  }
  
  .header-nav {
    display: flex;
    align-items: center;
    gap: 2rem;
  }
  
  .nav-link {
    color: white;
    text-decoration: none;
    font-weight: 500;
    transition: opacity 0.2s;
  }
  
  .nav-link:hover {
    opacity: 0.8;
  }
  
  .user-menu {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-left: 1rem;
    padding-left: 1rem;
    border-left: 1px solid rgba(255, 255, 255, 0.3);
  }
  
  .user-name {
    font-weight: 500;
  }
  
  .logout-btn {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background 0.2s;
  }
  
  .logout-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  
  @media (max-width: 768px) {
    .branded-header {
      padding: 1rem;
    }
    
    .header-content {
      flex-direction: column;
      gap: 1rem;
    }
    
    .header-nav {
      flex-wrap: wrap;
      gap: 1rem;
      justify-content: center;
    }
    
    .user-menu {
      border-left: none;
      border-top: 1px solid rgba(255, 255, 255, 0.3);
      padding-top: 1rem;
      padding-left: 0;
      margin-left: 0;
      width: 100%;
      justify-content: center;
    }
  }
</style>

