<script lang="ts">
  import type { TenantBranding } from '$lib/services/brandingService';
  
  export let branding: TenantBranding | null = null;
</script>

<footer class="branded-footer">
  <div class="footer-content">
    {#if branding?.portal?.footerText}
      <p class="footer-text">{branding.portal.footerText}</p>
    {/if}
    
    <div class="footer-info">
      {#if branding?.company?.supportEmail}
        <a href="mailto:{branding.company.supportEmail}" class="footer-link">
          {branding.company.supportEmail}
        </a>
      {/if}
      
      {#if branding?.company?.supportPhone}
        <span class="footer-separator">|</span>
        <a href="tel:{branding.company.supportPhone}" class="footer-link">
          {branding.company.supportPhone}
        </a>
      {/if}
      
      {#if branding?.company?.supportHours}
        <span class="footer-separator">|</span>
        <span class="footer-text">Support: {branding.company.supportHours}</span>
      {/if}
    </div>
    
    {#if branding?.company?.website}
      <div class="footer-website">
        <a href={branding.company.website} target="_blank" rel="noopener noreferrer" class="footer-link">
          Visit Website
        </a>
      </div>
    {/if}
  </div>
</footer>

<style>
  .branded-footer {
    background: var(--brand-secondary, #64748b);
    color: white;
    padding: 2rem;
    margin-top: auto;
  }
  
  .footer-content {
    max-width: 1200px;
    margin: 0 auto;
    text-align: center;
  }
  
  .footer-text {
    margin: 0.5rem 0;
    color: rgba(255, 255, 255, 0.9);
  }
  
  .footer-info {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  
  .footer-link {
    color: white;
    text-decoration: none;
    transition: opacity 0.2s;
  }
  
  .footer-link:hover {
    opacity: 0.8;
    text-decoration: underline;
  }
  
  .footer-separator {
    margin: 0 0.5rem;
    opacity: 0.6;
  }
  
  .footer-website {
    margin-top: 1rem;
  }
  
  @media (max-width: 768px) {
    .branded-footer {
      padding: 1.5rem 1rem;
    }
    
    .footer-info {
      flex-direction: column;
      gap: 0.25rem;
    }
    
    .footer-separator {
      display: none;
    }
  }
</style>

