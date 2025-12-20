// Firebase Authentication Service
import { browser } from '$app/environment';
import { auth as getAuth } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  confirmPasswordReset,
  applyActionCode,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type User,
  type UserCredential,
  type Auth
} from 'firebase/auth';
import type { UserProfile } from '../models/network';

// ============================================================================
// Auth Service Result Types
// ============================================================================

export interface AuthResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Auth Service Class
// ============================================================================

export class AuthService {
  private currentUser: User | null = null;
  private authStateListeners: ((user: User | null) => void)[] = [];
  private tokenRefreshInterval: NodeJS.Timeout | null = null;

  private redirectResultChecked = false; // Track if we've checked redirect result
  private redirectResultPromise: Promise<UserCredential | null> | null = null; // Track the promise

  constructor() {
    if (browser) {
      // CRITICAL: Check redirect result BEFORE initializing auth listener
      // getRedirectResult() can only be called once, and must be called before
      // the auth state listener processes the redirect
      // We call it synchronously (the function call itself is sync, it returns a Promise)
      this.checkRedirectResultSyncImmediate();
      this.initializeAuthListener();
      this.setupTokenRefresh();
    }
  }

  /**
   * Check redirect result synchronously during initialization
   * This MUST happen before auth state listener is set up
   * The key is that getRedirectResult() is CALLED synchronously (before listener),
   * even though it returns a Promise that resolves asynchronously
   */
  private checkRedirectResultSyncImmediate(): void {
    try {
      const auth = getAuth();
      const currentUrl = typeof window !== 'undefined' ? window.location.href : 'N/A';
      const urlSearch = typeof window !== 'undefined' ? window.location.search : '';
      const urlHash = typeof window !== 'undefined' ? window.location.hash : '';
      
      console.log('[AuthService] 🔍 Calling getRedirectResult() SYNCHRONOUSLY (before auth listener)...', {
        currentUrl,
        urlSearch,
        urlHash,
        authDomain: auth.app.options.authDomain
      });
      
      // CRITICAL: Call getRedirectResult() synchronously - this is what matters!
      // Even though it returns a Promise, calling it here ensures Firebase processes
      // the redirect result before the auth state listener fires
      this.redirectResultPromise = getRedirectResult(auth);
      
      // Handle the result asynchronously
      this.redirectResultPromise.then((result) => {
        console.log('[AuthService] 📋 getRedirectResult() promise resolved:', {
          hasResult: !!result,
          hasUser: !!result?.user,
          userEmail: result?.user?.email,
          providerId: result?.providerId,
          operationType: result?.operationType
        });
        
        if (result && result.user) {
          console.log('[AuthService] ✅✅✅ Redirect result found during init!', {
            email: result.user.email,
            uid: result.user.uid,
            providerId: result.providerId
          });
          this.currentUser = result.user;
          this.notifyListeners(result.user);
          this.redirectResultChecked = true;
        } else {
          console.log('[AuthService] ℹ️ No redirect result during init (normal for non-redirect visits)');
          this.redirectResultChecked = true;
        }
      }).catch((error: any) => {
        console.error('[AuthService] ❌ Error in redirect result promise:', {
          code: error?.code,
          message: error?.message,
          name: error?.name
        });
        this.redirectResultChecked = true;
      });
      
      console.log('[AuthService] getRedirectResult() called, promise created, waiting for result...');
    } catch (error: any) {
      console.error('[AuthService] ❌ Failed to initiate redirect result check:', error);
      this.redirectResultChecked = true; // Mark as checked to prevent retries
    }
  }

  /**
   * Initialize Firebase auth state listener with error recovery
   */
  private initializeAuthListener(): void {
    try {
      const auth = getAuth();
      console.log('[AuthService] Initializing auth listener with:', {
        app: auth.app.name,
        projectId: auth.app.options.projectId,
        authDomain: auth.app.options.authDomain,
        redirectResultChecked: this.redirectResultChecked
      });
      
      onAuthStateChanged(auth, async (user) => {
        // Don't overwrite user if we already set it from redirect result
        if (!this.currentUser || this.currentUser.uid !== user?.uid) {
          this.currentUser = user;
        }
        
        // Log auth state changes for debugging
        if (user) {
          console.log('[AuthService] 🔵 Auth state: User signed in', user.email);
          console.log('[AuthService] User metadata:', {
            uid: user.uid,
            email: user.email,
            lastSignInTime: user.metadata.lastSignInTime,
            providerData: user.providerData.map(p => p.providerId),
            isGoogleUser: user.providerData.some(p => p.providerId === 'google.com'),
            isEmailUser: user.providerData.some(p => p.providerId === 'password')
          });
          
          // If this is a Google user and we're on the login page, trigger a custom event
          // This helps the login page detect the sign-in even if getRedirectResult() didn't work
          const isGoogleUser = user.providerData.some(p => p.providerId === 'google.com');
          if (isGoogleUser && typeof window !== 'undefined' && window.location.pathname === '/login') {
            console.log('[AuthService] 🔵✅ Google user detected on login page - dispatching event');
            
            // Wait a moment to ensure the user is fully loaded
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Double-check the user is still there
            const currentAuth = getAuth();
            const currentUser = currentAuth.currentUser;
            if (currentUser && currentUser.uid === user.uid) {
              console.log('[AuthService] ✅ Confirmed user still authenticated, dispatching event');
              window.dispatchEvent(new CustomEvent('google-signin-complete', { 
                detail: { user: this.mapUserToProfile(user) } 
              }));
            } else {
              console.warn('[AuthService] ⚠️ User disappeared before event dispatch');
            }
          }
        } else {
          console.log('[AuthService] Auth state: User signed out');
        }
        
        this.notifyListeners(this.currentUser);
      }, (error: unknown) => {
        console.error('[AuthService] Auth state change error:', error);
        if (error instanceof Error) {
          console.error('[AuthService] Error message:', error.message);
          // Some Firebase errors include code property
          const firebaseError = error as Error & { code?: string };
          if (firebaseError.code) {
            console.error('[AuthService] Error code:', firebaseError.code);
          }
        }
        // Handle auth errors (expired tokens, etc.)
        this.currentUser = null;
        this.notifyListeners(null);
      });
      
      console.log('[AuthService] Auth listener initialized successfully');
    } catch (error) {
      console.error('[AuthService] Failed to initialize auth listener:', error);
      throw error;
    }
  }

  /**
   * Setup automatic token refresh every 50 minutes (tokens expire after 1 hour)
   */
  private setupTokenRefresh(): void {
    // Clear any existing interval
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
    }
    
    // Refresh token every 50 minutes to prevent expiration
    this.tokenRefreshInterval = setInterval(async () => {
      if (this.currentUser) {
        try {
          // Check if token is still valid before refreshing
          const token = await this.currentUser.getIdToken(false);
          if (token) {
            // Token is still valid, force refresh
            await this.currentUser.getIdToken(true);
            console.log('Auth token refreshed successfully');
          }
        } catch (error) {
          console.error('Token refresh failed:', error);
          // Don't immediately log out - let Firebase handle auth state changes
          // The onAuthStateChanged listener will handle the logout
        }
      }
    }, 50 * 60 * 1000); // 50 minutes in milliseconds
  }
  
  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (user: User | null) => void): () => void {
    this.authStateListeners.push(callback);
    
    // Immediately call with current user
    callback(this.currentUser);
    
    // Return unsubscribe function
    return () => {
      this.authStateListeners = this.authStateListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all listeners of auth state change
   */
  private notifyListeners(user: User | null): void {
    this.authStateListeners.forEach(listener => listener(user));
  }

  /**
   * Sign up with email and password
   */
  async signUp(
    email: string,
    password: string,
    displayName?: string
  ): Promise<AuthResult<UserProfile>> {
    try {
      const userCredential = await createUserWithEmailAndPassword(getAuth(), email, password);
      const user = userCredential.user;

      // Update display name if provided
      if (displayName) {
        await updateProfile(user, { displayName });
      }

      return {
        success: true,
        data: this.mapUserToProfile(user)
      };
    } catch (error: any) {
      return {
        success: false,
        error: this.getAuthErrorMessage(error)
      };
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<AuthResult<UserProfile>> {
    try {
      console.log('[AuthService] Attempting sign in with:', { email, projectId: 'wisptools-production' });
      const auth = getAuth();
      console.log('[AuthService] Auth instance:', { app: auth.app.name, config: auth.app.options });
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('[AuthService] Sign in successful:', { email: userCredential.user.email, uid: userCredential.user.uid });
      return {
        success: true,
        data: this.mapUserToProfile(userCredential.user)
      };
    } catch (error: any) {
      console.error('[AuthService] Sign in error:', error);
      console.error('[AuthService] Error code:', error?.code);
      console.error('[AuthService] Error message:', error?.message);
      return {
        success: false,
        error: this.getAuthErrorMessage(error)
      };
    }
  }

  /**
   * Sign in with Google using popup (keeps flow within app, avoids Firebase redirect pages)
   * Falls back to redirect if popup fails (e.g., due to popup blockers)
   */
  async signInWithGoogle(): Promise<AuthResult<UserProfile>> {
    try {
      const auth = getAuth();
      const provider = new GoogleAuthProvider();
      
      // Add custom parameters if needed
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      // Try popup first - this keeps the flow within our app and avoids Firebase redirect pages
      try {
        console.log('[AuthService] Attempting Google sign-in with popup...');
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        console.log('[AuthService] ✅ Google popup sign-in successful:', user.email);
        
        // Update current user immediately
        this.currentUser = user;
        this.notifyListeners(user);
        
        return {
          success: true,
          data: this.mapUserToProfile(user)
        };
      } catch (popupError: any) {
        // If popup fails (usually due to popup blockers), fall back to redirect
        if (popupError.code === 'auth/popup-blocked' || 
            popupError.code === 'auth/popup-closed-by-user' ||
            popupError.message?.includes('popup')) {
          console.warn('[AuthService] Popup blocked or closed, falling back to redirect...');
          
          // Store the current URL so we can redirect back to it
          const currentUrl = typeof window !== 'undefined' ? window.location.href : '/login';
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('google_signin_redirect_url', currentUrl);
            sessionStorage.setItem('google_signin_initiated', Date.now().toString());
            console.log('[AuthService] Stored redirect URL:', currentUrl);
          }
          
          // Use redirect as fallback - this will redirect to Firebase auth handler, then to Google, then back
          // The redirect happens synchronously - this function won't return normally
          await signInWithRedirect(auth, provider);
          
          // This code should not execute - redirect happens immediately
          console.error('[AuthService] ❌ signInWithRedirect returned without redirecting (UNEXPECTED!)');
          
          // Redirect will happen, so return a pending result
          return {
            success: true,
            data: null as any // Will be set after redirect
          };
        } else {
          // Re-throw other popup errors
          throw popupError;
        }
      }
    } catch (error: any) {
      console.error('[AuthService] ❌ Error initiating Google sign-in:', error);
      console.error('[AuthService] Error details:', {
        code: error?.code,
        message: error?.message,
        name: error?.name,
        stack: error?.stack?.substring(0, 500)
      });
      
      // Clear stored redirect URL on error
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('google_signin_redirect_url');
        sessionStorage.removeItem('google_signin_initiated');
      }
      
      // If user cancels or error occurs before redirect
      return {
        success: false,
        error: this.getAuthErrorMessage(error)
      };
    }
  }

  /**
   * Check for Google Sign-In redirect result
   * Call this on page load to handle OAuth redirect
   * NOTE: Redirect result is already checked during initialization, but this provides
   * a way for pages to check if redirect was successful
   */
  async checkRedirectResult(): Promise<AuthResult<UserProfile> | null> {
    try {
      const auth = getAuth();
      console.log('[AuthService] Checking for redirect result (page-level check)...', {
        currentUrl: typeof window !== 'undefined' ? window.location.href : 'N/A',
        search: typeof window !== 'undefined' ? window.location.search : 'N/A',
        hash: typeof window !== 'undefined' ? window.location.hash : 'N/A',
        authDomain: auth.app.options.authDomain,
        redirectResultChecked: this.redirectResultChecked,
        hasCurrentUser: !!this.currentUser,
        currentUserEmail: this.currentUser?.email
      });
      
      // If we already checked during init and have a user, return that
      if (this.currentUser) {
        const isGoogleUser = this.currentUser.providerData.some(p => p.providerId === 'google.com');
        if (isGoogleUser) {
          console.log('[AuthService] ✅ User authenticated with Google (from init check):', this.currentUser.email);
          return {
            success: true,
            data: this.mapUserToProfile(this.currentUser)
          };
        }
      }
      
      // CRITICAL: Even if we checked during init, try checking again
      // The redirect might complete AFTER initialization
      // getRedirectResult() can be called multiple times, but only returns a result once per redirect
      console.log('[AuthService] 🔍 Checking getRedirectResult() again (redirect may have completed after init)...');
      try {
        const result = await getRedirectResult(auth);
        console.log('[AuthService] 📋 Second getRedirectResult() check:', {
          hasResult: !!result,
          hasUser: !!result?.user,
          userEmail: result?.user?.email,
          providerId: result?.providerId
        });
        
        if (result && result.user) {
          console.log('[AuthService] ✅✅✅ Redirect result found on second check!', result.user.email);
          this.currentUser = result.user;
          this.notifyListeners(result.user);
          this.redirectResultChecked = true;
          
          return {
            success: true,
            data: this.mapUserToProfile(result.user)
          };
        }
      } catch (redirectError: any) {
        console.log('[AuthService] Second getRedirectResult() check failed (may be normal):', redirectError?.code || redirectError?.message);
      }
      
      // Also check Firebase's current user directly (bypass our cached value)
      const firebaseCurrentUser = auth.currentUser;
      if (firebaseCurrentUser && firebaseCurrentUser !== this.currentUser) {
        console.log('[AuthService] 🔵 Found user in Firebase auth.currentUser:', firebaseCurrentUser.email);
        const isGoogleUser = firebaseCurrentUser.providerData.some(p => p.providerId === 'google.com');
        if (isGoogleUser) {
          console.log('[AuthService] ✅ User is Google user, updating our state');
          this.currentUser = firebaseCurrentUser;
          this.notifyListeners(firebaseCurrentUser);
          return {
            success: true,
            data: this.mapUserToProfile(firebaseCurrentUser)
          };
        }
      }
      
      console.log('[AuthService] No redirect result (already checked or none available)');
      return null; // No redirect result
    } catch (error: any) {
      console.error('[AuthService] ❌ Error checking redirect result:', error);
      console.error('[AuthService] Error details:', {
        code: error?.code,
        message: error?.message,
        name: error?.name
      });
      
      // If it's a user cancellation, don't treat as error
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
        console.log('[AuthService] User cancelled sign-in');
        return null;
      }
      
      return {
        success: false,
        error: this.getAuthErrorMessage(error)
      };
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<AuthResult<void>> {
    try {
      await signOut(getAuth());
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: this.getAuthErrorMessage(error)
      };
    }
  }

  /**
   * Send password reset email with custom action URL
   */
  async resetPassword(email: string): Promise<AuthResult<void>> {
    try {
      // Get the current origin (handles both localhost and production)
      const actionCodeSettings = {
        url: typeof window !== 'undefined' 
          ? `${window.location.origin}/reset-password`
          : 'https://wisptools.io/reset-password',
        handleCodeInApp: true // This keeps the reset flow within our app
      };
      
      await sendPasswordResetEmail(getAuth(), email, actionCodeSettings);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: this.getAuthErrorMessage(error)
      };
    }
  }

  /**
   * Confirm password reset with action code
   */
  async verifyPasswordReset(actionCode: string, newPassword: string): Promise<AuthResult<void>> {
    try {
      const auth = getAuth();
      await confirmPasswordReset(auth, actionCode, newPassword);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: this.getAuthErrorMessage(error)
      };
    }
  }

  /**
   * Apply action code (for email verification, etc.)
   */
  async verifyActionCode(code: string): Promise<AuthResult<void>> {
    try {
      const auth = getAuth();
      await applyActionCode(auth, code);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: this.getAuthErrorMessage(error)
      };
    }
  }

  /**
   * Delete the current user account
   */
  async deleteCurrentUser(): Promise<AuthResult<void>> {
    try {
      const user = getAuth().currentUser;
      if (!user) {
        return {
          success: false,
          error: 'No user is currently signed in'
        };
      }
      
      await user.delete();
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: this.getAuthErrorMessage(error)
      };
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Get current user profile
   */
  getCurrentUserProfile(): UserProfile | null {
    if (!this.currentUser) return null;
    return this.mapUserToProfile(this.currentUser);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  /**
   * Check if user is authenticated with retry logic
   * Useful for components that might load before auth state is fully initialized
   */
  async isAuthenticatedWithRetry(maxRetries: number = 3): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      if (this.currentUser) {
        return true;
      }
      
      // Wait a bit for auth state to initialize
      await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
    }
    
    return false;
  }

  /**
   * Check if user signed in with Google (OAuth provider)
   */
  isGoogleUser(user: User | null): boolean {
    if (!user) return false;
    // Check if user has Google as a provider
    return user.providerData.some(provider => provider.providerId === 'google.com');
  }

  /**
   * Check if user can use password authentication
   * Google OAuth users don't need passwords
   */
  canUsePassword(user: User | null): boolean {
    if (!user) return true; // New users can set passwords
    // If user only has Google provider, they don't need a password
    const hasGoogleOnly = user.providerData.length === 1 && this.isGoogleUser(user);
    return !hasGoogleOnly;
  }

  /**
   * Map Firebase User to UserProfile
   */
  private mapUserToProfile(user: User): UserProfile {
    return {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || undefined,
      photoURL: user.photoURL || undefined,
      createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date(),
      lastLoginAt: user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime) : new Date()
    };
  }

  /**
   * Get the current user's authentication token
   */
  async getAuthToken(): Promise<string | null> {
    if (!this.currentUser) {
      return null;
    }
    
    try {
      return await this.currentUser.getIdToken();
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  }

  /**
   * Get the current user's authentication token (alias for getAuthToken)
   * This method exists for backward compatibility with existing code
   */
  async getIdToken(): Promise<string | null> {
    return this.getAuthToken();
  }

  /**
   * Get user-friendly error messages
   */
  private getAuthErrorMessage(error: any): string {
    const code = error?.code || '';
    const message = error?.message || '';
    
    // Check if Firebase auth is not enabled
    if (message.includes('ADMIN_ONLY_OPERATION') || 
        message.includes('auth provider is disabled') ||
        code === 'auth/operation-not-allowed') {
      return 'Firebase Authentication not enabled. Please enable Email/Password provider in Firebase Console.';
    }
    
    switch (code) {
      case 'auth/email-already-in-use':
        return 'Email address is already in use';
      case 'auth/invalid-email':
        return 'Invalid email address';
      case 'auth/invalid-credential':
        // Provide more helpful error message
        return 'Invalid email or password. If you just signed up, you need to set your password using the "Forgot password?" link. If you forgot your password, use the "Forgot password?" link to reset it.';
      case 'auth/weak-password':
        return 'Password is too weak. Use at least 6 characters';
      case 'auth/user-disabled':
        return 'User account has been disabled';
      case 'auth/user-not-found':
        return 'No account found with this email. Please sign up first.';
      case 'auth/wrong-password':
        return 'Incorrect password';
      case 'auth/popup-closed-by-user':
        return 'Sign in cancelled';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      default:
        // Return generic message with hint about Firebase setup
        if (message.includes('400')) {
          return 'Bad Request - Firebase Authentication may not be properly configured. Check Firebase Console.';
        }
        return error?.message || 'Authentication error occurred';
    }
  }
}

// Singleton instance
export const authService = new AuthService();

