<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { SASUserID } from '$lib/services/googleSASUserService';
  
  export let show = false;
  export let userIds: SASUserID[] = [];
  export let googleEmail = '';
  
  const dispatch = createEventDispatcher();
  
  function selectUserId(userId: SASUserID) {
    dispatch('select', userId);
  }
  
  function handleClose() {
    dispatch('close');
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={handleClose}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h3>Select Your Google SAS User ID</h3>
        <button class="modal-close" on:click={handleClose}>✕</button>
      </div>
      
      <div class="modal-body">
        <div class="signin-info">
          <span class="info-icon">✅</span>
          <div>
            <strong>Signed in as:</strong> {googleEmail}
          </div>
        </div>
        
        <p class="instruction">
          Select the SAS User ID you want to use for this organization:
        </p>
        
        {#if userIds.length === 0}
          <div class="no-userids">
            <p>No SAS User IDs found for your Google account.</p>
            <p class="hint">You can manually enter your User ID in the configuration form.</p>
            <button class="btn-primary" on:click={handleClose}>
              Continue to Configuration
            </button>
          </div>
        {:else}
          <div class="userids-list">
            {#each userIds as userId}
              <button class="userid-card" on:click={() => selectUserId(userId)}>
                <div class="userid-header">
                  <span class="userid-icon">🆔</span>
                  <div class="userid-info">
                    <h4>{userId.userId}</h4>
                    {#if userId.displayName}
                      <p class="display-name">{userId.displayName}</p>
                    {/if}
                  </div>
                  {#if userId.isPrimary}
                    <span class="primary-badge">Primary</span>
                  {/if}
                </div>
                
                {#if userId.organizationName}
                  <div class="userid-meta">
                    <span class="meta-label">Organization:</span>
                    <span class="meta-value">{userId.organizationName}</span>
                  </div>
                {/if}
                
                {#if userId.registrationStatus}
                  <div class="userid-meta">
                    <span class="meta-label">Status:</span>
                    <span class="meta-value status-{userId.registrationStatus}">
                      {userId.registrationStatus}
                    </span>
                  </div>
                {/if}
              </button>
            {/each}
          </div>
          
          <div class="manual-entry">
            <p>Don't see your User ID?</p>
            <button class="btn-secondary" on:click={handleClose}>
              Enter manually
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    animation: fadeIn 0.2s ease-out;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .modal-content {
    background: var(--bg-primary);
    border-radius: 0.75rem;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.3s ease-out;
  }
  
  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
    border-radius: 0.75rem 0.75rem 0 0;
  }
  
  .modal-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
  }
  
  .modal-close {
    background: none;
    border: none;
    font-size: 1.75rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
    line-height: 1;
  }
  
  .modal-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  
  .modal-body {
    padding: 2rem;
  }
  
  .signin-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: rgba(34, 197, 94, 0.05);
    border: 1px solid rgba(34, 197, 94, 0.2);
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
  }
  
  .info-icon {
    font-size: 1.5rem;
  }
  
  .instruction {
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
    font-size: 0.9375rem;
  }
  
  .userids-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .userid-card {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 0.75rem;
    padding: 1.25rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }
  
  .userid-card:hover {
    border-color: var(--accent-color);
    background: rgba(139, 92, 246, 0.05);
    transform: translateX(4px);
  }
  
  .userid-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }
  
  .userid-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }
  
  .userid-info {
    flex: 1;
  }
  
  .userid-info h4 {
    margin: 0 0 0.25rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .display-name {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  .primary-badge {
    padding: 0.25rem 0.75rem;
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .userid-meta {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem 0;
    border-top: 1px solid var(--border-color);
    font-size: 0.875rem;
  }
  
  .userid-meta:first-of-type {
    margin-top: 0.75rem;
  }
  
  .meta-label {
    color: var(--text-secondary);
    font-weight: 500;
  }
  
  .meta-value {
    color: var(--text-primary);
  }
  
  .meta-value.status-active {
    color: #22c55e;
  }
  
  .no-userids {
    text-align: center;
    padding: 2rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
  }
  
  .hint {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 0.5rem;
  }
  
  .manual-entry {
    text-align: center;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }
  
  .manual-entry p {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
  }
  
  .btn-primary, .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--accent-color);
    color: white;
  }
  
  .btn-primary:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
  }
  
  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--bg-hover);
    border-color: var(--accent-color);
  }
</style>

