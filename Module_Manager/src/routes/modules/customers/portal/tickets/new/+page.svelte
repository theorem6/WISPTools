<script lang="ts">
  import { goto } from '$app/navigation';
  import { customerPortalService } from '$lib/services/customerPortalService';
  import { customerAuthService } from '$lib/services/customerAuthService';
  
  let title = '';
  let description = '';
  let category = 'other';
  let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  let loading = false;
  let error = '';
  
  async function handleSubmit(e: Event) {
    e.preventDefault();
    loading = true;
    error = '';
    
    try {
      const customer = await customerAuthService.getCurrentCustomer();
      if (!customer) {
        goto('/modules/customers/portal/login');
        return;
      }
      
      await customerPortalService.createCustomerTicket(
        { title, description, category, priority },
        customer.tenantId
      );
      
      goto('/modules/customers/portal/tickets');
    } catch (err: any) {
      error = err.message || 'Failed to create ticket';
    } finally {
      loading = false;
    }
  }
</script>

<div class="create-ticket-page">
  <div class="page-header">
    <h1>Create New Ticket</h1>
    <a href="/modules/customers/portal/tickets" class="btn-secondary">Back to Tickets</a>
  </div>
  
  <form on:submit={handleSubmit} class="ticket-form">
    {#if error}
      <div class="error-message">{error}</div>
    {/if}
    
    <div class="form-group">
      <label for="title">Title *</label>
      <input
        id="title"
        type="text"
        bind:value={title}
        placeholder="Brief description of the issue"
        required
        disabled={loading}
      />
    </div>
    
    <div class="form-group">
      <label for="category">Category</label>
      <select id="category" bind:value={category} disabled={loading}>
        <option value="slow-speed">Slow Speed</option>
        <option value="no-connection">No Connection</option>
        <option value="intermittent">Intermittent Connection</option>
        <option value="equipment-failure">Equipment Failure</option>
        <option value="billing-issue">Billing Issue</option>
        <option value="other">Other</option>
      </select>
    </div>
    
    <div class="form-group">
      <label for="priority">Priority</label>
      <select id="priority" bind:value={priority} disabled={loading}>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="critical">Critical</option>
      </select>
    </div>
    
    <div class="form-group">
      <label for="description">Description *</label>
      <textarea
        id="description"
        bind:value={description}
        placeholder="Please provide detailed information about the issue..."
        rows="6"
        required
        disabled={loading}
      ></textarea>
    </div>
    
    <div class="form-actions">
      <button type="submit" class="btn-primary" disabled={loading}>
        {loading ? 'Creating...' : 'Create Ticket'}
      </button>
      <a href="/modules/customers/portal/tickets" class="btn-secondary">Cancel</a>
    </div>
  </form>
</div>

<style>
  .create-ticket-page {
    max-width: 800px;
    margin: 0 auto;
  }
  
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }
  
  .page-header h1 {
    font-size: 2rem;
    color: var(--brand-text, #111827);
  }
  
  .btn-secondary {
    background: white;
    color: var(--brand-primary, #3b82f6);
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 500;
    border: 1px solid var(--brand-primary, #3b82f6);
    transition: background 0.2s;
  }
  
  .btn-secondary:hover {
    background: #f3f4f6;
  }
  
  .ticket-form {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 2rem;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }
  
  .form-group label {
    font-weight: 500;
    color: var(--brand-text, #111827);
  }
  
  .form-group input,
  .form-group select,
  .form-group textarea {
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 1rem;
    transition: border-color 0.2s;
  }
  
  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--brand-primary, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .form-group input:disabled,
  .form-group select:disabled,
  .form-group textarea:disabled {
    background: #f3f4f6;
    cursor: not-allowed;
  }
  
  .form-group textarea {
    resize: vertical;
    font-family: inherit;
  }
  
  .error-message {
    background: #fee2e2;
    color: #dc2626;
    padding: 0.75rem;
    border-radius: 6px;
    margin-bottom: 1.5rem;
  }
  
  .form-actions {
    display: flex;
    gap: 1rem;
    margin-top: 2rem;
  }
  
  .btn-primary {
    background: var(--brand-primary, #3b82f6);
    color: white;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--brand-accent, #10b981);
  }
  
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }
    
    .form-actions {
      flex-direction: column;
    }
  }
</style>