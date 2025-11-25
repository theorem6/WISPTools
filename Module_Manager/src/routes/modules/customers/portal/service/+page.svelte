<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { customerPortalService } from '$lib/services/customerPortalService';
  import { customerAuthService } from '$lib/services/customerAuthService';
  import { portalBranding } from '$lib/stores/portalBranding';
  
  let serviceInfo: any = null;
  let loading = true;
  let error = '';
  let featureEnabled = true;

  $: featureEnabled = ($portalBranding?.features?.enableServiceStatus !== false);
  $: supportEmail = $portalBranding?.company?.supportEmail || 'support@example.com';
  $: supportPhone = $portalBranding?.company?.supportPhone || '';
  
  onMount(async () => {
    try {
      const customer = await customerAuthService.getCurrentCustomer();
      if (!customer) {
        goto('/modules/customers/portal/login');
        return;
      }
      
      if (!featureEnabled) {
        loading = false;
        return;
      }
      
      serviceInfo = await customerPortalService.getCustomerServiceInfo();
    } catch (err: any) {
      error = err.message || 'Failed to load service information';
    } finally {
      loading = false;
    }
  });
</script>

{#if loading}
  <div class="loading">Loading service information...</div>
{:else if !featureEnabled}
  <div class="feature-disabled">
    <h1>Service Status Unavailable</h1>
    <p>This tenant has disabled the Service Status &amp; Outages module for customer access.</p>
    <p class="contact">
      Please reach out to our support team for real-time updates:
      <br />
      <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
      {#if supportPhone}
        <span> • </span>
        <a href={`tel:${supportPhone}`}>{supportPhone}</a>
      {/if}
    </p>
  </div>
{:else if error}
  <div class="error">{error}</div>
{:else}
  <div class="service-page">
    <h1>Service Information</h1>
    
    <div class="service-details">
      <div class="info-section">
        <h2>Service Status</h2>
        <div class="info-card">
          <div class="info-row">
            <span class="info-label">Status:</span>
            <span class="info-value status-{serviceInfo?.serviceStatus || 'unknown'}">
              {serviceInfo?.serviceStatus || 'N/A'}
            </span>
          </div>
          {#if serviceInfo?.servicePlan}
            <div class="info-row">
              <span class="info-label">Service Plan:</span>
              <span class="info-value">{serviceInfo.servicePlan}</span>
            </div>
          {/if}
        </div>
      </div>
      
      {#if serviceInfo?.serviceAddress}
        <div class="info-section">
          <h2>Service Address</h2>
          <div class="info-card">
            <div class="info-row">
              <span class="info-label">Address:</span>
              <span class="info-value">
                {serviceInfo.serviceAddress.street || ''}
                {serviceInfo.serviceAddress.city || ''}, {serviceInfo.serviceAddress.state || ''} {serviceInfo.serviceAddress.zipCode || ''}
              </span>
            </div>
          </div>
        </div>
      {/if}
      
      {#if serviceInfo?.equipment && serviceInfo.equipment.length > 0}
        <div class="info-section">
          <h2>Equipment</h2>
          <div class="equipment-list">
            {#each serviceInfo.equipment as equipment}
              <div class="equipment-card">
                <div class="equipment-header">
                  <span class="equipment-type">{equipment.type || 'Equipment'}</span>
                  {#if equipment.serialNumber}
                    <span class="equipment-serial">SN: {equipment.serialNumber}</span>
                  {/if}
                </div>
                {#if equipment.model}
                  <div class="equipment-detail">Model: {equipment.model}</div>
                {/if}
                {#if equipment.installDate}
                  <div class="equipment-detail">
                    Installed: {new Date(equipment.installDate).toLocaleDateString()}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .service-page {
    max-width: 900px;
    margin: 0 auto;
  }
  
  .service-page h1 {
    font-size: 2rem;
    color: var(--brand-text, #111827);
    margin-bottom: 2rem;
  }
  
  .service-details {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  
  .info-section h2 {
    font-size: 1.5rem;
    color: var(--brand-text, #111827);
    margin-bottom: 1rem;
  }
  
  .info-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
  }
  
  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid #f3f4f6;
  }
  
  .info-row:last-child {
    border-bottom: none;
  }
  
  .info-label {
    font-weight: 500;
    color: var(--brand-text-secondary, #6b7280);
  }
  
  .info-value {
    color: var(--brand-text, #111827);
    text-align: right;
  }
  
  .status-active {
    color: #10b981;
    font-weight: 600;
  }
  
  .status-suspended {
    color: #f59e0b;
    font-weight: 600;
  }
  
  .status-cancelled {
    color: #ef4444;
    font-weight: 600;
  }
  
  .equipment-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .equipment-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
  }
  
  .equipment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  
  .equipment-type {
    font-weight: 600;
    color: var(--brand-text, #111827);
  }
  
  .equipment-serial {
    font-size: 0.875rem;
    color: var(--brand-text-secondary, #6b7280);
  }
  
  .equipment-detail {
    font-size: 0.875rem;
    color: var(--brand-text-secondary, #6b7280);
    margin-top: 0.5rem;
  }
  
  .loading, .error {
    text-align: center;
    padding: 3rem;
    color: var(--brand-text-secondary, #6b7280);
  }
  
  .error {
    color: #dc2626;
  }

  .feature-disabled {
    max-width: 700px;
    margin: 0 auto;
    text-align: center;
    padding: 3rem 2rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  }

  .feature-disabled h1 {
    font-size: 1.75rem;
    margin-bottom: 1rem;
    color: var(--brand-text, #111827);
  }

  .feature-disabled p {
    color: var(--brand-text-secondary, #6b7280);
    line-height: 1.6;
  }

  .feature-disabled .contact {
    margin-top: 1rem;
  }

  .feature-disabled a {
    color: var(--brand-primary, #3b82f6);
    text-decoration: none;
    font-weight: 500;
  }
  
  @media (max-width: 768px) {
    .info-row {
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .info-value {
      text-align: left;
    }
  }
</style>

