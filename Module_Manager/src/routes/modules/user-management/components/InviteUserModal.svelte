<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { inviteUser } from '$lib/services/userManagementService';
  import { ROLE_NAMES, ROLE_DESCRIPTIONS, type UserRole } from '$lib/models/userRole';
  
  const dispatch = createEventDispatcher();
  
  let email = '';
  let role: UserRole = 'viewer';
  let sendEmail = false; // Email sending is optional - tenant admin decides
  let loading = false;
  let error = '';
  let success = false;
  
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
      await inviteUser($currentTenant.id, email, role, undefined, sendEmail);
      success = true;
      setTimeout(() => {
        dispatch('close');
      }, 1500);
    } catch (err: any) {
      error = err.message || 'Failed to invite user';
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
  aria-label="Invite user dialog"
  on:click={handleBackdropClick}
  on:keydown={handleBackdropKeydown}
>
  <div class="modal-content" role="document">
    <div class="modal-header">
      <h2>Invite User</h2>
      <button class="close-btn" on:click={handleClose} disabled={loading}>✕</button>
    </div>
    
    {#if success}
      <div class="success-message">
        <span class="success-icon">✅</span>
        <h3>User {sendEmail ? 'Invited' : 'Added'}!</h3>
        <p>
          {#if sendEmail}
            An invitation email has been sent to {email}
          {:else}
            User {email} has been added. {#if !sendEmail}You can manually notify them or send an invitation email later.{/if}
          {/if}
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
        
        <div class="form-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              bind:checked={sendEmail}
              disabled={loading}
            />
            <span>Send invitation email (optional - email systems may not be configured)</span>
          </label>
          <p class="hint">If unchecked, you can manually notify the user or send the invitation later.</p>
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" on:click={handleClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={loading}>
            {#if loading}
              <span class="spinner-sm"></span>
              Sending...
            {:else}
              {sendEmail ? 'Send Invitation' : 'Add User'}
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
    background: white;
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
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    opacity: 0.5;
    padding: 0.5rem;
    line-height: 1;
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
  }
  
  input:focus, select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
  
  .role-description {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    cursor: pointer;
    user-select: none;
  }

  .checkbox-label input[type="checkbox"] {
    width: auto;
    margin-top: 0.25rem;
    cursor: pointer;
  }

  .checkbox-label span {
    flex: 1;
    color: var(--text-primary);
  }

  .hint {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
    font-style: italic;
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
    background: var(--primary);
    color: white;
  }
  
  .btn-secondary {
    background: var(--secondary);
    color: white;
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
    background: #fee;
    border: 1px solid #fcc;
    color: #c00;
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

