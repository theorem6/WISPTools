<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { authService } from '$lib/services/authService';
  import { tenantService } from '$lib/services/tenantService';
  import { createPaymentMethod } from '$lib/services/billingService';

  let step = 1; // 1: Email Verification, 2: Tenant Info, 3: Payment, 4: Success
  let isLoading = false;
  let error = '';
  let success = '';

  // Step 1: Email Verification
  let email = '';
  let verificationCode = '';
  let verificationCodeSent = false;
  let canResendCode = false;
  let resendCountdown = 0;

  // Step 2: Tenant Information
  let tenantName = '';
  let displayName = '';
  let contactPhone = '';
  let subdomain = '';

  // Step 3: Payment Information
  let paymentMethodType: 'paypal' | 'credit_card' | null = null;
  let paypalEmail = '';
  let creditCardInfo = {
    email: '',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    name: ''
  };
  let paymentMethodCreated = false;

  // Created tenant ID
  let createdTenantId: string = '';

  onMount(() => {
    if (!browser) return;
    
    console.log('[Signup Page] 🔄 Page mounted');
    console.log('[Signup Page] Current URL:', window.location.href);
    
    // Check if user is already authenticated
    const currentUser = authService.getCurrentUser();
    console.log('[Signup Page] Auth check:', { hasUser: !!currentUser, email: currentUser?.email });
    
    if (currentUser) {
      // User is already logged in, redirect to dashboard
      console.log('[Signup Page] User already authenticated, redirecting to dashboard');
      goto('/dashboard');
      return;
    }
    
    console.log('[Signup Page] ✅ Ready to show signup wizard, step:', step);
  });

  // Email Verification Functions
  async function sendVerificationCode() {
    if (!email || !email.includes('@')) {
      error = 'Please enter a valid email address';
      return;
    }

    isLoading = true;
    error = '';

    try {
      const apiPath = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
        ? 'http://localhost:3001/api'
        : '/api';
      
      const response = await fetch(`${apiPath}/auth/verification/send-verification-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      verificationCodeSent = true;
      canResendCode = false;
      resendCountdown = 60; // 60 second countdown

      // Start countdown timer
      const countdownInterval = setInterval(() => {
        resendCountdown--;
        if (resendCountdown <= 0) {
          canResendCode = true;
          clearInterval(countdownInterval);
        }
      }, 1000);

      success = 'Verification code sent to your email!';
      setTimeout(() => success = '', 5000);
    } catch (err: any) {
      error = err.message || 'Failed to send verification code';
    } finally {
      isLoading = false;
    }
  }

  async function verifyCode() {
    if (!verificationCode || verificationCode.length !== 6) {
      error = 'Please enter the 6-digit verification code';
      return;
    }

    isLoading = true;
    error = '';

    try {
      const apiPath = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
        ? 'http://localhost:3001/api'
        : '/api';
      
      const response = await fetch(`${apiPath}/auth/verification/verify-email-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      // Code verified - create Firebase account and move to next step
      // For now, we'll create the account in step 2, so just move forward
      step = 2;
      success = 'Email verified successfully!';
      setTimeout(() => success = '', 3000);
    } catch (err: any) {
      error = err.message || 'Verification failed';
    } finally {
      isLoading = false;
    }
  }

  // Tenant Setup Functions
  async function handleTenantSubmit() {
    if (!tenantName || !displayName || !contactPhone) {
      error = 'Please fill in all required fields';
      return;
    }

    // Validate subdomain
    if (!subdomain) {
      subdomain = tenantName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    }

    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      error = 'Subdomain can only contain lowercase letters, numbers, and hyphens';
      return;
    }

    isLoading = true;
    error = '';

    let userCreated = false;
    let firebaseUser: any = null;

    try {
      // First, check if user is already authenticated or try to create account
      firebaseUser = authService.getCurrentUser();
      if (!firebaseUser) {
        // Create account with temporary password - user will set password later
        const tempPassword = `Temp${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
        const signUpResult = await authService.signUp(email, tempPassword);
        
        if (!signUpResult.success || !signUpResult.data) {
          // Check if error is due to email already existing
          if (signUpResult.error && signUpResult.error.includes('already in use')) {
            throw new Error('This email address is already registered. Please <a href="/login" style="color: #00d9ff; text-decoration: underline;">sign in instead</a>. If you forgot your password, use the "Forgot password?" link on the login page.');
          }
          throw new Error(signUpResult.error || 'Failed to create account');
        }

        firebaseUser = authService.getCurrentUser();
        if (!firebaseUser) {
          throw new Error('Account created but user not found');
        }

        userCreated = true; // Track that we created this user

        // Send password reset email so user can set their own password
        const resetResult = await authService.resetPassword(email);
        if (!resetResult.success) {
          console.warn('Failed to send password reset email:', resetResult.error);
          // Continue anyway - user can reset password later
        }
      }

      // Create tenant
      // Note: createTenant expects individual parameters, not an object
      // The backend automatically creates the user-tenant association as owner
      const createResult = await tenantService.createTenant(
        tenantName,
        displayName,
        email,
        firebaseUser.uid,
        subdomain,
        true, // createOwnerAssociation
        email // ownerEmail
      );

      if (!createResult.success || !createResult.tenantId) {
        throw new Error(createResult.error || 'Failed to create tenant');
      }

      createdTenantId = createResult.tenantId;

      success = 'Tenant created successfully!';
      step = 3; // Move to payment step
    } catch (err: any) {
      // If we created a Firebase user but tenant creation failed, delete the user
      if (userCreated && firebaseUser) {
        console.log('Tenant creation failed, cleaning up Firebase user...');
        try {
          await authService.deleteCurrentUser();
          console.log('Firebase user deleted successfully');
        } catch (deleteError: any) {
          console.error('Failed to delete Firebase user:', deleteError);
          // Continue with error handling
        }
      }

      // Handle email already exists error specially
      if (err.message && err.message.includes('already in use')) {
        error = 'This email address is already registered. Please sign in to your existing account instead.';
        // Show error for 5 seconds, then suggest going to login
        setTimeout(() => {
          if (error.includes('already registered')) {
            error = 'Redirecting to login page...';
            setTimeout(() => {
              goto('/login');
            }, 1000);
          }
        }, 5000);
      } else {
        error = err.message || 'Failed to create tenant';
      }
      console.error('Tenant creation error:', err);
    } finally {
      isLoading = false;
    }
  }

  // Payment Functions
  async function handlePaymentSubmit() {
    if (!paymentMethodType) {
      error = 'Please select a payment method';
      return;
    }

    if (paymentMethodType === 'paypal' && !paypalEmail) {
      error = 'Please enter your PayPal email address';
      return;
    }

    if (paymentMethodType === 'credit_card') {
      if (!creditCardInfo.cardNumber || !creditCardInfo.expiryDate || !creditCardInfo.cvv || !creditCardInfo.name || !creditCardInfo.email) {
        error = 'Please fill in all credit card fields';
        return;
      }
    }

    isLoading = true;
    error = '';

    try {
      if (!createdTenantId) {
        throw new Error('Tenant ID not found. Please go back and complete tenant setup.');
      }

      // Create payment method
      await createPaymentMethod(
        createdTenantId,
        paymentMethodType,
        paymentMethodType === 'paypal' ? paypalEmail : undefined,
        paymentMethodType === 'credit_card' ? creditCardInfo : undefined
      );

      paymentMethodCreated = true;
      step = 4; // Success step
    } catch (err: any) {
      error = err.message || 'Failed to create payment method';
      console.error('Payment method creation error:', err);
    } finally {
      isLoading = false;
    }
  }

</script>

<div class="signup-wizard">
  <div class="wizard-container">
    <div class="wizard-header">
      <h1>Create Your Account</h1>
      <p class="subtitle">Get started with WISPTools in just a few steps</p>
    </div>

    <div class="progress-bar">
      <div class="progress" style="width: {step * 25}%"></div>
    </div>

    <div class="wizard-content">
      {#if error}
        <div class="error-message">
          <span class="error-icon">⚠️</span>
          {error}
        </div>
      {/if}

      {#if success}
        <div class="success-message">
          <span class="success-icon">✅</span>
          {success}
        </div>
      {/if}

      <!-- Step 1: Email Verification -->
      {#if step === 1}
        <div class="step-content">
          <h2>Step 1: Verify Your Email</h2>
          <p class="step-description">We'll send a verification code to your email address to ensure it's valid.</p>

          <div class="form-group">
            <label for="email">Email Address <span class="required">*</span></label>
            <input
              id="email"
              type="email"
              bind:value={email}
              placeholder="your@email.com"
              disabled={isLoading || verificationCodeSent}
              required
            />
          </div>

          {#if !verificationCodeSent}
            <button 
              type="button" 
              class="btn-primary" 
              onclick={sendVerificationCode}
              disabled={isLoading || !email}
            >
              {#if isLoading}
                <span class="spinner"></span>
                Sending...
              {:else}
                Send Verification Code
              {/if}
            </button>
          {:else}
            <div class="verification-sent">
              <p class="success-text">✅ Verification code sent to {email}</p>
              {#if !canResendCode}
                <p class="resend-countdown">You can resend in {resendCountdown} seconds</p>
              {/if}
            </div>

            <div class="form-group">
              <label for="verificationCode">Verification Code <span class="required">*</span></label>
              <input
                id="verificationCode"
                type="text"
                bind:value={verificationCode}
                placeholder="Enter 6-digit code"
                maxlength="6"
                disabled={isLoading}
                required
              />
              <p class="help-text">Check your email for the 6-digit verification code</p>
            </div>

            <div class="form-actions">
              {#if canResendCode}
                <button 
                  type="button" 
                  class="btn-secondary" 
                  onclick={sendVerificationCode}
                  disabled={isLoading}
                >
                  Resend Code
                </button>
              {/if}
              <button 
                type="button" 
                class="btn-primary" 
                onclick={verifyCode}
                disabled={isLoading || !verificationCode}
              >
                {#if isLoading}
                  <span class="spinner"></span>
                  Verifying...
                {:else}
                  Verify Email
                {/if}
              </button>
            </div>
          {/if}
        </div>

      <!-- Step 2: Tenant Information -->
      {:else if step === 2}
        <div class="step-content">
          <h2>Step 2: Organization Information</h2>
          <p class="step-description">Tell us about your organization.</p>

          <div class="form-group">
            <label for="tenantName">Organization Name <span class="required">*</span></label>
            <input
              id="tenantName"
              type="text"
              bind:value={tenantName}
              placeholder="Acme WISP"
              disabled={isLoading}
              required
            />
          </div>

          <div class="form-group">
            <label for="displayName">Display Name <span class="required">*</span></label>
            <input
              id="displayName"
              type="text"
              bind:value={displayName}
              placeholder="Acme Wireless Internet"
              disabled={isLoading}
              required
            />
            <p class="help-text">This is how your organization will appear in the system</p>
          </div>

          <div class="form-group">
            <label for="contactPhone">Contact Phone <span class="required">*</span></label>
            <input
              id="contactPhone"
              type="tel"
              bind:value={contactPhone}
              placeholder="+1 (555) 123-4567"
              disabled={isLoading}
              required
            />
          </div>

          <div class="form-group">
            <label for="subdomain">Subdomain (Optional)</label>
            <input
              id="subdomain"
              type="text"
              bind:value={subdomain}
              placeholder="acme-wisp"
              disabled={isLoading}
              pattern="[a-z0-9\-]+"
            />
            <p class="help-text">Custom subdomain for your organization (auto-generated if left blank)</p>
          </div>

          <div class="form-group">
            <label>Primary Location (Optional)</label>
            <p class="help-text">You can create your primary location (NOC/HQ/Tower) after completing setup from the coverage map.</p>
          </div>

          <div class="form-actions">
            <button 
              type="button" 
              class="btn-secondary" 
              onclick={() => step = 1}
              disabled={isLoading}
            >
              ← Back
            </button>
            <button 
              type="button" 
              class="btn-primary" 
              onclick={handleTenantSubmit}
              disabled={isLoading}
            >
              {#if isLoading}
                <span class="spinner"></span>
                Creating...
              {:else}
                Continue to Payment
              {/if}
            </button>
          </div>
        </div>

      <!-- Step 3: Payment Information -->
      {:else if step === 3}
        <div class="step-content">
          <h2>Step 3: Payment Method</h2>
          <p class="step-description">Add a payment method for your account (required)</p>

          <div class="beta-disclaimer">
            <div class="beta-badge">BETA</div>
            <p><strong>WISPTools.io is currently in beta.</strong> No charges will be made without prior notice. Adding a payment method now ensures uninterrupted service when billing begins.</p>
          </div>

          <div class="form-group">
            <label>Payment Method <span class="required">*</span></label>
            <div class="payment-method-options">
              <label class="payment-option">
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="paypal"
                  bind:group={paymentMethodType}
                  disabled={isLoading}
                />
                <div class="payment-option-content">
                  <div class="payment-icon">💳</div>
                  <div>
                    <strong>PayPal</strong>
                    <p>Pay with PayPal account</p>
                  </div>
                </div>
              </label>
              <label class="payment-option">
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="credit_card"
                  bind:group={paymentMethodType}
                  disabled={isLoading}
                />
                <div class="payment-option-content">
                  <div class="payment-icon">💳</div>
                  <div>
                    <strong>Credit Card</strong>
                    <p>Pay with credit or debit card</p>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {#if paymentMethodType === 'paypal'}
            <div class="form-group">
              <label for="paypalEmail">
                PayPal Email Address <span class="required">*</span>
              </label>
              <input
                id="paypalEmail"
                type="email"
                bind:value={paypalEmail}
                placeholder="your-email@example.com"
                disabled={isLoading}
                required
              />
              <p class="help-text">The email address associated with your PayPal account</p>
            </div>
          {/if}

          {#if paymentMethodType === 'credit_card'}
            <div class="form-group">
              <label for="cardEmail">
                Billing Email <span class="required">*</span>
              </label>
              <input
                id="cardEmail"
                type="email"
                bind:value={creditCardInfo.email}
                placeholder="billing@example.com"
                disabled={isLoading}
                required
              />
            </div>
            <div class="form-group">
              <label for="cardNumber">
                Card Number <span class="required">*</span>
              </label>
              <input
                id="cardNumber"
                type="text"
                bind:value={creditCardInfo.cardNumber}
                placeholder="XXXX XXXX XXXX XXXX"
                disabled={isLoading}
                maxlength="19"
                oninput={(e) => {
                  let value = e.currentTarget.value.replace(/\s/g, '');
                  if (value.length > 16) value = value.substring(0, 16);
                  value = value.replace(/(.{4})/g, '$1 ').trim();
                  creditCardInfo.cardNumber = value;
                }}
                required
              />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="expiryDate">
                  Expiry Date <span class="required">*</span>
                </label>
                <input
                  id="expiryDate"
                  type="text"
                  bind:value={creditCardInfo.expiryDate}
                  placeholder="MM/YY"
                  disabled={isLoading}
                  maxlength="5"
                  oninput={(e) => {
                    let value = e.currentTarget.value.replace(/\D/g, '');
                    if (value.length >= 2) {
                      value = value.substring(0, 2) + '/' + value.substring(2, 4);
                    }
                    creditCardInfo.expiryDate = value;
                  }}
                  required
                />
              </div>
              <div class="form-group">
                <label for="cvv">
                  CVV <span class="required">*</span>
                </label>
                <input
                  id="cvv"
                  type="text"
                  bind:value={creditCardInfo.cvv}
                  placeholder="XXX"
                  disabled={isLoading}
                  maxlength="4"
                  required
                />
              </div>
            </div>
            <div class="form-group">
              <label for="cardName">
                Name on Card <span class="required">*</span>
              </label>
              <input
                id="cardName"
                type="text"
                bind:value={creditCardInfo.name}
                placeholder="John Doe"
                disabled={isLoading}
                required
              />
            </div>
          {/if}

          <div class="form-actions">
            <button 
              type="button" 
              class="btn-secondary" 
              onclick={() => step = 2}
              disabled={isLoading}
            >
              ← Back
            </button>
            <button 
              type="button" 
              class="btn-primary" 
              onclick={handlePaymentSubmit}
              disabled={isLoading || !paymentMethodType || (paymentMethodType === 'paypal' && !paypalEmail) || (paymentMethodType === 'credit_card' && (!creditCardInfo.cardNumber || !creditCardInfo.expiryDate || !creditCardInfo.cvv || !creditCardInfo.name || !creditCardInfo.email))}
            >
              {#if isLoading}
                <span class="spinner"></span>
                Saving...
              {:else}
                Complete Setup
              {/if}
            </button>
          </div>
        </div>

      <!-- Step 4: Success -->
      {:else if step === 4}
        <div class="step-content success-step">
          <div class="success-icon-large">✅</div>
          <h2>Account Created Successfully!</h2>
          <p class="success-message">
            Your WISPTools account has been created. You can now start using the platform.
          </p>
          <div class="success-details">
            <p><strong>Organization:</strong> {displayName}</p>
            <p><strong>Email:</strong> {email}</p>
            {#if paymentMethodCreated}
              <p><strong>Payment Method:</strong> {paymentMethodType === 'paypal' ? 'PayPal' : 'Credit Card'} ✓</p>
            {/if}
          </div>
          <button 
            type="button" 
            class="btn-primary" 
            onclick={() => goto('/dashboard')}
          >
            Go to Dashboard →
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>


<style>
  .signup-wizard {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary, #f3f4f6);
    padding: 2rem;
  }

  .wizard-container {
    background: var(--card-bg, white);
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    max-width: 600px;
    width: 100%;
    padding: 2rem;
  }

  .wizard-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .wizard-header h1 {
    color: var(--text-primary, #1f2937);
    margin: 0 0 0.5rem;
    font-size: 2rem;
  }

  .subtitle {
    color: var(--text-secondary, #6b7280);
    margin: 0;
  }

  .progress-bar {
    height: 4px;
    background: var(--bg-secondary, #e5e7eb);
    border-radius: 2px;
    margin-bottom: 2rem;
    overflow: hidden;
  }

  .progress {
    height: 100%;
    background: var(--primary-color, #8b5cf6);
    transition: width 0.3s ease;
  }

  .step-content {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .step-content h2 {
    color: var(--text-primary, #1f2937);
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
  }

  .step-description {
    color: var(--text-secondary, #6b7280);
    margin: 0 0 2rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    color: var(--text-primary, #1f2937);
    font-weight: 500;
    margin-bottom: 0.5rem;
  }

  .required {
    color: var(--danger-color, #ef4444);
  }

  .form-group input[type="text"],
  .form-group input[type="email"],
  .form-group input[type="tel"] {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color, #d1d5db);
    border-radius: 6px;
    font-size: 1rem;
    transition: border-color 0.2s;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--primary-color, #8b5cf6);
  }

  .help-text {
    font-size: 0.875rem;
    color: var(--text-secondary, #6b7280);
    margin: 0.25rem 0 0;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 2rem;
  }

  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-primary {
    background: var(--primary-color, #8b5cf6);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--primary-dark, #7c3aed);
  }

  .btn-secondary {
    background: var(--bg-secondary, #e5e7eb);
    color: var(--text-primary, #1f2937);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--hover-bg, #d1d5db);
  }

  .btn-primary:disabled,
  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-message,
  .success-message {
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .error-message {
    background: var(--danger-light, #fee2e2);
    color: var(--danger-dark, #991b1b);
  }

  .success-message {
    background: var(--success-light, #d1fae5);
    color: var(--success-dark, #065f46);
  }

  .verification-sent {
    background: var(--success-light, #d1fae5);
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .success-text {
    color: var(--success-dark, #065f46);
    margin: 0 0 0.5rem;
  }

  .resend-countdown {
    color: var(--text-secondary, #6b7280);
    font-size: 0.875rem;
    margin: 0;
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .radio-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .payment-method-options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .payment-option {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border: 2px solid var(--border-color, #d1d5db);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .payment-option:hover {
    border-color: var(--primary-color, #8b5cf6);
    background: var(--hover-bg, #f9fafb);
  }

  .payment-option input[type="radio"]:checked + .payment-option-content {
    color: var(--primary-color, #8b5cf6);
  }

  .payment-option-content {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
  }

  .payment-icon {
    font-size: 1.5rem;
  }

  .beta-disclaimer {
    background: var(--warning-light, #fef3c7);
    border: 1px solid var(--warning-color, #f59e0b);
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .beta-badge {
    display: inline-block;
    background: var(--warning-color, #f59e0b);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .beta-disclaimer p {
    margin: 0;
    color: var(--warning-dark, #92400e);
    font-size: 0.875rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .success-step {
    text-align: center;
  }

  .success-icon-large {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .success-details {
    background: var(--bg-secondary, #f3f4f6);
    padding: 1.5rem;
    border-radius: 8px;
    margin: 2rem 0;
    text-align: left;
  }

  .success-details p {
    margin: 0.5rem 0;
    color: var(--text-primary, #1f2937);
  }
</style>
