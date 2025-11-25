<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { inviteUser } from '$lib/services/userManagementService';
  import { ROLE_NAMES, ROLE_DESCRIPTIONS, type UserRole } from '$lib/models/userRole';
  
  const dispatch = createEventDispatcher();
  
  let email = '';
  let displayName = '';
  let role: UserRole = 'viewer';
  let loading = false;
  let error = '';
  let success = false;
  let addedUserEmail = '';
  
  const availableRoles: UserRole[] = ['admin', 'engineer', 'installer', 'helpdesk', 'support', 'viewer'];
  
  async function handleSubmit() {
    if (!$currentTenant) return;
    
    // Validate email
    if (!email || !email.includes('@')) {
      error = 'Please enter a valid email address';
      return;
    }
    
    loading = true;
    error = '';
    
    try {
      // Always send welcome email automatically
      await inviteUser($currentTenant.id, email, role, undefined, true, displayName);
      addedUserEmail = email;
      success = true;
      setTimeout(() => {
        dispatch('close');
        dispatch('userAdded');
      }, 2000);
    } catch (err: any) {
      error = err.message || 'Failed to add user';
    } finally {
      loading = false;
    }
  }
  
  function handleClose() {
    if (!loading) {
      dispatch('close');
    }
  }
  
  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleClose();
    }
  }
</script>

<div
  class="modal-backdrop"
  role="dialog"
  aria-modal="true"
  tabindex="0"
  aria-label="Add user dialog"
  on:click={handleBackdropClick}
  on:keydown={handleBackdropKeydown}
>
  <div class="modal-content" role="document">
    <div class="modal-header">
      <h2>➕ Add Team Member</h2>
      <button class="close-btn" on:click={handleClose} disabled={loading}>✕</button>
    </div>
    
    {#if success}
      <div class="success-message">
        <span class="success-icon">✅</span>
        <h3>User Added!</h3>
        <p>
          <strong>{addedUserEmail}</strong> has been added to your team.
        </p>
        <p class="email-note">
          📧 A welcome email with login instructions has been sent.
        </p>
      </div>
    {:else}
      <form on:submit|preventDefault={handleSubmit}>
        {#if error}
          <div class="alert alert-error">
            <span>❌</span>
            <span>{error}</span>
          </div>
        {/if}
        
        <div class="form-group">
          <label for="email">Email Address *</label>
          <input
            id="email"
            type="email"
            bind:value={email}
            placeholder="user@example.com"
            required
            disabled={loading}
          />
          <p class="hint">They'll receive login instructions at this email</p>
        </div>
        
        <div class="form-group">
          <label for="displayName">Display Name (optional)</label>
          <input
            id="displayName"
            type="text"
            bind:value={displayName}
            placeholder="John Smith"
            disabled={loading}
          />
        </div>
        
        <div class="form-group">
          <label for="role">Role *</label>
          <select id="role" bind:value={role} disabled={loading}>
            {#each availableRoles as roleOption}
              <option value={roleOption}>
                {ROLE_NAMES[roleOption]}
              </option>
            {/each}
          </select>
          {#if role}
            <p class="role-description">{ROLE_DESCRIPTIONS[role]}</p>
          {/if}
        </div>
        
        <div class="info-box">
          <span class="info-icon">ℹ️</span>
          <div class="info-content">
            <p><strong>What happens next:</strong></p>
            <ul>
              <li>User receives a welcome email at <strong>wisptools.io</strong></li>
              <li>They can sign in with Google or create a password</li>
              <li>Once signed in, they'll have access to your organization</li>
            </ul>
          </div>
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" on:click={handleClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={loading}>
            {#if loading}
              <span class="spinner-sm"></span>
              Adding...
            {:else}
              Add User
            {/if}
          </button>
        </div>
      </form>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  
  .modal-content {
    background: var(--card-bg, white);
    border-radius: 0.75rem;
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    opacity: 0.5;
    padding: 0.5rem;
    line-height: 1;
    color: var(--text-primary);
  }
  
  .close-btn:hover:not(:disabled) {
    opacity: 1;
  }
  
  form {
    padding: 1.5rem;
  }
  
  .form-group {
    margin-bottom: 1.5rem;
  }
  
  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary);
  }
  
  input, select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    font-size: 1rem;
    background: var(--input-bg, white);
    color: var(--text-primary);
  }
  
  input:focus, select:focus {
    outline: none;
    border-color: var(--brand-primary, #8b5cf6);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
  
  .hint {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  
  .role-description {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .info-box {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--bg-secondary, #f8f9fa);
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .info-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .info-content p {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .info-content ul {
    margin: 0;
    padding-left: 1.25rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .info-content li {
    margin-bottom: 0.25rem;
  }
  
  .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }
  
  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
  }
  
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-primary {
    background: var(--brand-primary, #8b5cf6);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  
  .btn-secondary {
    background: var(--bg-secondary, #6b7280);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-tertiary);
  }
  
  .alert {
    padding: 1rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  
  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #dc2626;
  }
  
  .success-message {
    padding: 3rem;
    text-align: center;
  }
  
  .success-icon {
    font-size: 4rem;
    display: block;
    margin-bottom: 1rem;
  }
  
  .success-message h3 {
    margin: 0 0 0.5rem;
    color: var(--text-primary);
  }
  
  .success-message p {
    color: var(--text-secondary);
    margin: 0.5rem 0;
  }

  .email-note {
    margin-top: 1rem !important;
    padding: 0.75rem 1rem;
    background: rgba(34, 197, 94, 0.1);
    border-radius: 0.5rem;
    color: #16a34a !important;
    font-weight: 500;
  }
  
  .spinner-sm {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
