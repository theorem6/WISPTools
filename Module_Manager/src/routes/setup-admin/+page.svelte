<script lang="ts">
  import { auth, db } from '$lib/firebase';
  import { authService } from '$lib/services/authService';
  import { collection, getDocs } from 'firebase/firestore';
  import { onMount } from 'svelte';
  
  let loading = false;
  let result = '';
  let error = '';
  let success = false;
  
  async function setupAdmin() {
    loading = true;
    error = '';
    result = '';
    success = false;
    
    try {
      const user = auth().currentUser;
      if (!user) {
        error = 'Not logged in. Please go to the dashboard first to login, then come back here.';
        loading = false;
        return;
      }
      
      result = `Logged in as: ${user.email}\n\n`;
      result += 'Finding your tenants...\n';
      
      // Get all tenants
      const tenantsSnapshot = await getDocs(collection(db(), 'tenants'));
      const tenantIds = tenantsSnapshot.docs.map(doc => doc.id);
      
      result += `Found ${tenantIds.length} tenant(s): ${tenantIds.join(', ')}\n\n`;
      result += 'Calling setup-admin endpoint...\n';
      
      const token = await authService.getAuthTokenForApi();
      
      const response = await fetch('https://us-central1-wisptools-production.cloudfunctions.net/apiProxy/setup-admin', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tenantIds
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        success = true;
        result += '\n✅ SUCCESS!\n\n';
        result += data.message + '\n\n';
        result += 'Your tenants:\n';
        data.tenants.forEach((t: any) => {
          result += `  - ${t.tenantName}: ${t.status} (${t.role})\n`;
        });
        result += '\n';
        result += 'Next steps:\n';
        data.nextSteps.forEach((step: string) => {
          result += `  ✓ ${step}\n`;
        });
      } else {
        error = `Error: ${data.error}\n${data.message || ''}`;
      }
      
    } catch (err: any) {
      error = `Error: ${err.message}`;
    } finally {
      loading = false;
    }
  }
</script>

<div class="setup-container">
  <div class="setup-card">
    <h1>🔧 Setup Admin Access</h1>
    <p class="subtitle">Grant yourself owner access to your tenants</p>
    
    <div class="info-box">
      <p><strong>This will:</strong></p>
      <ul>
        <li>✅ Grant you owner role in all your tenants</li>
        <li>✅ Enable User Management module</li>
        <li>✅ Enable Help Desk module</li>
        <li>✅ Allow you to invite other users</li>
        <li>✅ Give you full administrative access</li>
      </ul>
    </div>
    
    {#if error}
      <div class="alert alert-error">
        <span>❌</span>
        <pre>{error}</pre>
      </div>
    {/if}
    
    {#if result}
      <div class="alert" class:alert-success={success} class:alert-info={!success}>
        <pre>{result}</pre>
      </div>
    {/if}
    
    <button class="btn btn-primary btn-large" on:click={setupAdmin} disabled={loading}>
      {#if loading}
        <span class="spinner"></span>
        Setting up...
      {:else if success}
        ✅ Setup Complete
      {:else}
        🚀 Setup Admin Access
      {/if}
    </button>
    
    {#if success}
      <div class="next-steps">
        <h3>🎉 Success!</h3>
        <p>You are now an owner of your tenants.</p>
        <a href="/dashboard" class="btn btn-secondary">
          ← Back to Dashboard
        </a>
        <p class="hint">Refresh the page (Ctrl+Shift+R) to see User Management and Help Desk modules</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .setup-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 2rem;
  }
  
  .setup-card {
    background: white;
    border-radius: 1rem;
    padding: 3rem;
    max-width: 600px;
    width: 100%;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
  }
  
  h1 {
    margin: 0 0 0.5rem;
    color: #8b5cf6;
    font-size: 2rem;
  }
  
  .subtitle {
    color: #6b7280;
    margin-bottom: 2rem;
  }
  
  .info-box {
    background: #f3f4f6;
    padding: 1.5rem;
    border-radius: 0.5rem;
    margin-bottom: 2rem;
  }
  
  .info-box ul {
    margin: 1rem 0 0;
    padding-left: 1.5rem;
  }
  
  .info-box li {
    margin-bottom: 0.5rem;
    color: #374151;
  }
  
  .alert {
    padding: 1.5rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
  }
  
  .alert-error {
    background: #fee2e2;
    border-left: 4px solid #ef4444;
    color: #991b1b;
  }
  
  .alert-success {
    background: #d1fae5;
    border-left: 4px solid #10b981;
    color: #065f46;
  }
  
  .alert-info {
    background: #e0e7ff;
    border-left: 4px solid #6366f1;
    color: #3730a3;
  }
  
  .alert pre {
    margin: 0;
    font-family: monospace;
    font-size: 0.875rem;
    white-space: pre-wrap;
  }
  
  .btn {
    padding: 1rem 2rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: all 0.2s;
    text-decoration: none;
  }
  
  .btn-large {
    width: 100%;
    font-size: 1.125rem;
    padding: 1.25rem 2rem;
  }
  
  .btn-primary {
    background: #8b5cf6;
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: #7c3aed;
    transform: translateY(-2px);
  }
  
  .btn-secondary {
    background: #6b7280;
    color: white;
    margin-top: 1rem;
  }
  
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .spinner {
    width: 20px;
    height: 20px;
    border: 3px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .next-steps {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 2px solid #e5e7eb;
    text-align: center;
  }
  
  .next-steps h3 {
    margin: 0 0 1rem;
    color: #10b981;
  }
  
  .hint {
    margin-top: 1rem;
    font-size: 0.875rem;
    color: #6b7280;
  }
</style>