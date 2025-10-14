<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import UserIDSelector from './UserIDSelector.svelte';
  import type { SASUserID } from '$lib/services/googleSASUserService';
  
  export let show = false;
  export let config: any = {};
  export let tenantId: string = '';
  
  const dispatch = createEventDispatcher();
  let googleAuthState: any = null;
  let unsubscribe: any = null;
  let showUserIDSelector = false;
  let availableUserIDs: SASUserID[] = [];
  
  // Fixed to shared platform mode with Google SAS only
  let formData = {
    deploymentModel: 'shared-platform', // Fixed
    provider: 'google', // Fixed
    googleUserId: config.googleUserId || '',
    googleEmail: config.googleEmail || '',
    googleCertificate: config.googleCertificate || '',
    googlePrivateKey: config.googlePrivateKey || '',
    googleCertificateName: config.googleCertificateName || '',
    googlePrivateKeyName: config.googlePrivateKeyName || '',
    
    // Enhanced features
    enableAnalytics: config.enableAnalytics || false,
    enableOptimization: config.enableOptimization || false,
    enableMultiSite: config.enableMultiSite || false,
    enableInterferenceMonitoring: config.enableInterferenceMonitoring || false
  };
  
  let certificateFile: File | null = null;
  let privateKeyFile: File | null = null;
  
  let isSaving = false;
  let isSigningIn = false;
  
  onMount(async () => {
    // Dynamically import googleAuthStore to avoid circular dependency
    const { googleAuthStore } = await import('$lib/services/googleOAuthService');
    
    // Subscribe to Google auth state
    unsubscribe = googleAuthStore.subscribe(state => {
      googleAuthState = state;
      
      // Auto-fill email if Google authenticated
      if (state.isAuthenticated && state.googleEmail) {
        formData.googleEmail = state.googleEmail;
      }
    });
    
    // Initialize Google OAuth for this tenant
    await googleAuthStore.initialize(tenantId);
    
    // Check if we just returned from OAuth redirect
    const oauthCompleted = sessionStorage.getItem('google_oauth_completed');
    if (oauthCompleted === 'true') {
      sessionStorage.removeItem('google_oauth_completed');
      console.log('[Settings] Returned from Google OAuth - reloading auth state');
      await googleAuthStore.initialize(tenantId);
      
      // Fetch available SAS User IDs after successful OAuth
      if (googleAuthState?.isAuthenticated && googleAuthState?.accessToken) {
        await fetchAndShowUserIDs();
      }
    }
  });
  
  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });
  
  async function handleGoogleSignIn() {
    try {
      isSigningIn = true;
      // Dynamically import to avoid circular dependency
      const { googleAuthStore } = await import('$lib/services/googleOAuthService');
      // Use redirect flow instead of popup (no COOP issues!)
      await googleAuthStore.signInWithRedirect(tenantId);
      // This will redirect away - no need to handle response here
    } catch (error: any) {
      console.error('[Settings] Google sign-in failed:', error);
      alert(`Google sign-in failed: ${error.message}`);
      isSigningIn = false;
    }
  }
  
  async function fetchAndShowUserIDs() {
    try {
      console.log('[Settings] Fetching authorized SAS User IDs...');
      
      const { fetchAuthorizedSASUserIDs } = await import('$lib/services/googleSASUserService');
      
      availableUserIDs = await fetchAuthorizedSASUserIDs(
        tenantId,
        googleAuthState.googleEmail,
        googleAuthState.accessToken
      );
      
      console.log('[Settings] Found', availableUserIDs.length, 'User IDs');
      
      if (availableUserIDs.length === 1) {
        // Auto-select if only one User ID
        console.log('[Settings] Auto-selecting single User ID:', availableUserIDs[0].userId);
        formData.googleUserId = availableUserIDs[0].userId;
      } else if (availableUserIDs.length > 1) {
        // Show selector for multiple User IDs
        console.log('[Settings] Showing User ID selector');
        showUserIDSelector = true;
      } else {
        console.log('[Settings] No User IDs found - user will enter manually');
      }
      
    } catch (error: any) {
      console.error('[Settings] Error fetching User IDs:', error);
      // Allow user to continue and enter manually
    }
  }
  
  function handleUserIDSelect(event: CustomEvent<SASUserID>) {
    const selectedUserId = event.detail;
    console.log('[Settings] User ID selected:', selectedUserId.userId);
    
    formData.googleUserId = selectedUserId.userId;
    showUserIDSelector = false;
    
    // Dispatch event so parent component can load devices for this User ID
    dispatch('userIdSelected', {
      userId: selectedUserId.userId,
      googleEmail: googleAuthState?.googleEmail,
      accessToken: googleAuthState?.accessToken
    });
  }
  
  async function handleSignOut() {
    try {
      const { googleAuthStore } = await import('$lib/services/googleOAuthService');
      googleAuthStore.signOut(tenantId);
      googleAuthState = null;
      formData.googleEmail = '';
      formData.googleUserId = '';
    } catch (error: any) {
      console.error('[Settings] Sign out failed:', error);
    }
  }
  
  function handleClose() {
    dispatch('close');
  }
  
  async function handleCertificateUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      certificateFile = file;
      formData.googleCertificateName = file.name;
      
      // Read file as base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        formData.googleCertificate = result.split(',')[1]; // Get base64 part
      };
      reader.readAsDataURL(file);
    }
  }
  
  async function handlePrivateKeyUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      privateKeyFile = file;
      formData.googlePrivateKeyName = file.name;
      
      // Read file as base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        formData.googlePrivateKey = result.split(',')[1]; // Get base64 part
      };
      reader.readAsDataURL(file);
    }
  }
  
  async function handleSave() {
    isSaving = true;
    try {
      dispatch('save', formData);
    } catch (error: any) {
      console.error('Error saving settings:', error);
    } finally {
      isSaving = false;
    }
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={handleClose}>
    <div class="modal-content settings-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>⚙️ CBRS Configuration</h3>
        <button class="modal-close" on:click={handleClose}>✕</button>
      </div>
      
      <div class="modal-body">
        <form on:submit|preventDefault={handleSave}>
          <!-- Platform Info -->
          <div class="info-banner">
            <span class="info-icon">🏢</span>
            <div class="info-content">
              <strong>Shared Platform Mode - Google SAS</strong>
              <p>You're using the platform's shared Google SAS API key. Provide your Google account credentials and User ID. Certificates are optional but recommended for enhanced security.</p>
            </div>
          </div>
          
          <!-- Google SAS Configuration -->
          <div class="form-section">
            <h4>🔵 Google SAS Authentication</h4>
            
            <!-- Google Sign-In Button -->
            {#if !googleAuthState?.isAuthenticated}
              <div class="google-signin-section">
                <button 
                  type="button"
                  class="btn-google-signin"
                  on:click={handleGoogleSignIn}
                  disabled={isSigningIn}
                >
                  {#if isSigningIn}
                    <span class="spinner"></span>
                    Signing in...
                  {:else}
                    <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign in with Google
                  {/if}
                </button>
                <p class="signin-hint">
                  Sign in with your Google account registered for SAS API access
                </p>
              </div>
            {:else}
              <div class="google-signed-in">
                <div class="signed-in-badge">
                  ✅ Signed in as: <strong>{googleAuthState.googleEmail}</strong>
                </div>
                <button 
                  type="button"
                  class="btn-signout"
                  on:click={handleSignOut}
                >
                  Sign out
                </button>
              </div>
            {/if}
            
            <div class="form-group">
              <label>
                Google User ID
                <span class="required">*</span>
              </label>
              {#if formData.googleUserId}
                <div class="user-id-display">
                  <div class="user-id-value">
                    <span class="user-id-icon">🆔</span>
                    <strong>{formData.googleUserId}</strong>
                  </div>
                  <button 
                    type="button"
                    class="btn-change-user-id"
                    on:click={async () => {
                      if (googleAuthState?.isAuthenticated && googleAuthState?.accessToken) {
                        await fetchAndShowUserIDs();
                      } else {
                        alert('Please sign in with Google first to select a User ID');
                      }
                    }}
                  >
                    Change
                  </button>
                </div>
              {:else}
                <button 
                  type="button"
                  class="btn-select-user-id"
                  on:click={async () => {
                    if (googleAuthState?.isAuthenticated && googleAuthState?.accessToken) {
                      await fetchAndShowUserIDs();
                    } else {
                      alert('Please sign in with Google first to select a User ID');
                    }
                  }}
                  disabled={!googleAuthState?.isAuthenticated}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4M12 8h.01"/>
                  </svg>
                  Select User ID from Your SAS Account
                </button>
              {/if}
              <span class="form-hint">
                {#if googleAuthState?.isAuthenticated}
                  Click the button above to select from your authorized SAS User IDs
                {:else}
                  Sign in with Google above, then select your User ID
                {/if}
              </span>
            </div>
            
            <div class="form-group">
              <label>
                Google Account Email
                <span class="required">*</span>
              </label>
              <input 
                type="email" 
                bind:value={formData.googleEmail}
                placeholder="your-google-account@gmail.com"
                required
                readonly={googleAuthState?.isAuthenticated}
              />
              <span class="form-hint">
                {#if googleAuthState?.isAuthenticated}
                  ✅ Auto-filled from Google sign-in
                {:else}
                  Sign in with Google above to auto-fill this field
                {/if}
              </span>
            </div>
            
            <div class="form-group">
              <label>Client Certificate (.pem or .crt)</label>
              <input 
                type="file" 
                accept=".pem,.crt,.cer"
                on:change={handleCertificateUpload}
                class="file-input"
              />
              {#if formData.googleCertificateName}
                <span class="file-status">✅ {formData.googleCertificateName}</span>
              {/if}
              <span class="form-hint">
                Client certificate for mTLS authentication with Google SAS (optional but recommended).
              </span>
            </div>
            
            <div class="form-group">
              <label>Private Key (.key or .pem)</label>
              <input 
                type="file" 
                accept=".key,.pem"
                on:change={handlePrivateKeyUpload}
                class="file-input"
              />
              {#if formData.googlePrivateKeyName}
                <span class="file-status">✅ {formData.googlePrivateKeyName}</span>
              {/if}
              <span class="form-hint">
                Private key corresponding to the client certificate (optional but recommended).
              </span>
            </div>
          </div>
          
          <!-- Enhanced Features -->
          <div class="form-section enhancement-section">
            <h4>Enhanced Features</h4>
            
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={formData.enableAnalytics} />
                <span>Enable Advanced Analytics</span>
              </label>
              <p class="checkbox-hint">Get detailed performance metrics and insights</p>
            </div>
            
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={formData.enableOptimization} />
                <span>Enable Automated Optimization</span>
              </label>
              <p class="checkbox-hint">Let SAS automatically optimize spectrum assignments</p>
            </div>
            
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={formData.enableMultiSite} />
                <span>Enable Multi-Site Coordination</span>
              </label>
              <p class="checkbox-hint">Coordinate spectrum across multiple sites</p>
            </div>
            
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={formData.enableInterferenceMonitoring} />
                <span>Enable Interference Monitoring</span>
              </label>
              <p class="checkbox-hint">Real-time interference detection and alerts</p>
            </div>
          </div>
          
          <!-- Security Notice -->
          <div class="security-notice">
            <div class="notice-icon">🔒</div>
            <div class="notice-content">
              <strong>Security:</strong> The platform administrator manages the shared Google SAS API key.
              Your credentials (email, certificates, private keys) are encrypted and stored securely in Firestore.
              Your data is isolated using your unique User ID.
            </div>
          </div>
          
          <!-- Actions -->
          <div class="form-actions">
            <button 
              type="button" 
              class="btn btn-secondary" 
              on:click={handleClose}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              class="btn btn-primary" 
              disabled={isSaving}
            >
              {#if isSaving}
                <span class="spinner"></span>
                Saving...
              {:else}
                💾 Save Settings
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<!-- User ID Selector Modal (shows after OAuth sign-in) -->
<UserIDSelector
  show={showUserIDSelector}
  userIds={availableUserIDs}
  googleEmail={googleAuthState?.googleEmail || ''}
  on:select={handleUserIDSelect}
  on:close={() => showUserIDSelector = false}
/>

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
    z-index: 1000;
    animation: fadeIn 0.2s ease-out;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .settings-modal {
    background: var(--bg-primary);
    border-radius: 0.75rem;
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
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
    font-size: 1.5rem;
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
  
  .form-section {
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .form-section:last-of-type {
    border-bottom: none;
  }
  
  .form-section h4 {
    margin: 0 0 1.5rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .info-banner {
    background: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 2rem;
    display: flex;
    gap: 0.75rem;
  }
  
  .info-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }
  
  .info-content {
    flex: 1;
  }
  
  .info-content strong {
    display: block;
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
    color: var(--text-primary);
  }
  
  .info-content p {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }
  
  .form-group {
    margin-bottom: 1.5rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--text-primary);
  }
  
  .required {
    color: #ef4444;
    margin-left: 0.25rem;
  }
  
  .form-group input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.875rem;
    transition: all 0.2s;
  }
  
  .form-group input:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
  
  .form-hint {
    display: block;
    margin-top: 0.375rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-style: italic;
  }
  
  .file-input {
    padding: 0.5rem;
    border: 2px dashed var(--border-color);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .file-input:hover {
    border-color: var(--accent-color);
    background: rgba(139, 92, 246, 0.05);
  }
  
  .file-status {
    display: inline-block;
    margin-top: 0.5rem;
    padding: 0.375rem 0.75rem;
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
  }
  
  .google-signin-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    text-align: center;
  }
  
  .btn-google-signin {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.5rem;
    background: white;
    color: #1f2937;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .btn-google-signin:hover:not(:disabled) {
    background: #f9fafb;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  
  .btn-google-signin:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .google-icon {
    flex-shrink: 0;
  }
  
  .signin-hint {
    margin-top: 0.75rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  
  .google-signed-in {
    padding: 1rem 1.5rem;
    background: rgba(34, 197, 94, 0.05);
    border: 1px solid rgba(34, 197, 94, 0.2);
    border-radius: 0.5rem;
    margin-bottom: 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .signed-in-badge {
    font-size: 0.875rem;
    color: var(--text-primary);
  }
  
  .signed-in-badge strong {
    color: #22c55e;
  }
  
  .btn-signout {
    padding: 0.5rem 1rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-signout:hover {
    background: var(--bg-hover);
    border-color: #ef4444;
    color: #ef4444;
  }
  
  .btn-select-user-id {
    width: 100%;
    padding: 0.875rem 1rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  
  .btn-select-user-id:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
  }
  
  .btn-select-user-id:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .user-id-display {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--bg-secondary);
    border: 2px solid #10b981;
    border-radius: 0.5rem;
  }
  
  .user-id-value {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .user-id-icon {
    font-size: 1.25rem;
  }
  
  .btn-change-user-id {
    padding: 0.5rem 1rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-change-user-id:hover {
    background: var(--bg-hover);
    border-color: #667eea;
    color: #667eea;
  }
  
  .enhancement-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.25rem;
  }
  
  .checkbox-group {
    margin-bottom: 1rem;
  }
  
  .checkbox-group:last-child {
    margin-bottom: 0;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.875rem;
  }
  
  .checkbox-label input[type="checkbox"] {
    width: auto;
    cursor: pointer;
    width: 1.125rem;
    height: 1.125rem;
  }
  
  .checkbox-hint {
    margin: 0.25rem 0 0 1.75rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  
  .security-notice {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
  }
  
  .notice-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }
  
  .notice-content {
    font-size: 0.8125rem;
    line-height: 1.5;
    color: var(--text-secondary);
  }
  
  .notice-content strong {
    color: var(--text-primary);
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
  
  .btn {
    padding: 0.625rem 1.25rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .btn-primary {
    background: var(--accent-color);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  }
  
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
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
  
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  /* Scrollbar styling */
  .settings-modal::-webkit-scrollbar {
    width: 8px;
  }
  
  .settings-modal::-webkit-scrollbar-track {
    background: var(--bg-secondary);
  }
  
  .settings-modal::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
  }
  
  .settings-modal::-webkit-scrollbar-thumb:hover {
    background: var(--text-secondary);
  }
  
  @media (max-width: 768px) {
    .settings-modal {
      width: 95%;
      max-height: 95vh;
    }
    
    .modal-header {
      padding: 1rem 1.5rem;
    }
    
    .modal-header h3 {
      font-size: 1.25rem;
    }
    
    .modal-body {
      padding: 1.5rem;
    }
    
    .form-actions {
      flex-direction: column;
    }
    
    .btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>
