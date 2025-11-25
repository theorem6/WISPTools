<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { brandingService, type TenantBranding } from '$lib/services/brandingService';
  import { customerAuthService } from '$lib/services/customerAuthService';
  import BrandedHeader from './components/BrandedHeader.svelte';
  import BrandedFooter from './components/BrandedFooter.svelte';
  
  let branding: TenantBranding | null = null;
  let loading = true;
  let isAuthenticated = false;
  
  onMount(async () => {
    // Check if customer is authenticated
    const customer = await customerAuthService.getCurrentCustomer();
    isAuthenticated = customer !== null;
    
    // Load branding
    if ($currentTenant) {
      try {
        branding = await brandingService.getTenantBranding($currentTenant.id);
        brandingService.applyBrandingToDocument(branding);
      } catch (error) {
        console.error('Error loading branding:', error);
        branding = brandingService.getDefaultBranding();
        brandingService.applyBrandingToDocument(branding);
      }
    } else {
      branding = brandingService.getDefaultBranding();
      brandingService.applyBrandingToDocument(branding);
    }
    
    loading = false;
    
    // Redirect to login if not authenticated and not on login/signup pages
    if (!isAuthenticated && !$page.url.pathname.includes('/login') && !$page.url.pathname.includes('/signup')) {
      goto('/modules/customers/portal/login');
    }
  });
</script>

{#if loading}
  <div class="loading-container">
    <div class="spinner"></div>
  </div>
{:else}
  <div class="portal-layout">
    <BrandedHeader {branding} />
    
    <main class="portal-main">
      <slot />
    </main>
    
    <BrandedFooter {branding} />
  </div>
{/if}

<style>
  :global(:root) {
    --brand-primary: var(--brand-primary, #3b82f6);
    --brand-secondary: var(--brand-secondary, #64748b);
    --brand-accent: var(--brand-accent, #10b981);
    --brand-background: var(--brand-background, #ffffff);
    --brand-text: var(--brand-text, #111827);
    --brand-text-secondary: var(--brand-text-secondary, #6b7280);
  }
  
  .loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: var(--brand-background);
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(59, 130, 246, 0.1);
    border-top-color: var(--brand-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .portal-layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--brand-background);
    color: var(--brand-text);
  }
  
  .portal-main {
    flex: 1;
    padding: 2rem;
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
  }
  
  @media (max-width: 768px) {
    .portal-main {
      padding: 1rem;
    }
  }
</style>

