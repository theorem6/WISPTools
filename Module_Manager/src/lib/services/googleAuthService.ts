/**
 * Google OAuth Service for Authentication
 * Handles direct Google OAuth 2.0 flow (bypasses Firebase auth handler)
 * Uses implicit flow with ID token for direct Firebase authentication
 */

import { browser } from '$app/environment';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { getFirebaseAuth } from '$lib/firebase';

// Get Google OAuth Client ID from Firebase config
// This should match the OAuth client ID configured in Firebase Console
// For wisptools-production, we need to get this from Firebase project settings
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_AUTH_CLIENT_ID || 
                        import.meta.env.PUBLIC_GOOGLE_AUTH_CLIENT_ID || 
                        // Default: This should be configured in environment variables
                        // Get from Firebase Console > Project Settings > Your apps > Web app config
                        '1048161130237-kehquaq56fcubedupb34611c0hm1ctob.apps.googleusercontent.com';

// OAuth scopes for authentication
const GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
].join(' ');

// Redirect URI for OAuth callback
const REDIRECT_URI = browser ? `${window.location.origin}/auth/google/callback` : '';

/**
 * Generate a random state string for OAuth security
 */
function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a random nonce for ID token validation
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Initiate Google OAuth sign-in
 * Redirects directly to Google (not through Firebase)
 * Uses implicit flow to get ID token directly
 */
export async function initiateGoogleSignIn(context: 'login' | 'signup' = 'login'): Promise<void> {
  if (!browser) {
    throw new Error('Google sign-in can only run in browser');
  }

  // Generate state and nonce for security
  const state = generateState();
  const nonce = generateNonce();
  
  // Store context, state, and nonce in sessionStorage
  sessionStorage.setItem('google_auth_context', context);
  sessionStorage.setItem('google_auth_state', state);
  sessionStorage.setItem('google_auth_nonce', nonce);
  sessionStorage.setItem('google_auth_return_url', window.location.pathname + window.location.search);

  // Construct Google OAuth URL with implicit flow (response_type=id_token)
  // This gives us the ID token directly in the URL hash, which we can use with Firebase
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'id_token'); // Get ID token directly
  authUrl.searchParams.set('scope', GOOGLE_SCOPES);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', nonce);
  authUrl.searchParams.set('prompt', 'select_account');

  console.log('[Google Auth] Redirecting to Google OAuth...', {
    clientId: GOOGLE_CLIENT_ID.substring(0, 20) + '...',
    redirectUri: REDIRECT_URI,
    context
  });

  // Redirect to Google (same window - standard OAuth flow)
  window.location.href = authUrl.toString();
}

/**
 * Handle OAuth callback with ID token in URL hash
 * Authenticate with Firebase using the Google ID token
 */
export async function handleGoogleCallback(): Promise<{ success: boolean; user?: User; error?: string }> {
  if (!browser) {
    return { success: false, error: 'OAuth callback can only run in browser' };
  }

  try {
    // Parse ID token from URL hash (implicit flow)
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    
    const idToken = params.get('id_token');
    const state = params.get('state');
    const errorParam = params.get('error');

    if (errorParam) {
      const errorDesc = params.get('error_description') || errorParam;
      return { success: false, error: errorDesc };
    }

    if (!idToken || !state) {
      return { success: false, error: 'Missing ID token or state parameter' };
    }

    // Verify state to prevent CSRF attacks
    const storedState = sessionStorage.getItem('google_auth_state');
    const storedNonce = sessionStorage.getItem('google_auth_nonce');
    
    if (!storedState || storedState !== state) {
      console.error('[Google Auth] State mismatch - possible CSRF attack');
      return { success: false, error: 'Invalid state parameter' };
    }

    const context = sessionStorage.getItem('google_auth_context') || 'login';
    console.log('[Google Auth] Processing OAuth callback...', { context });

    // Use Firebase to sign in with the Google ID token
    const auth = getFirebaseAuth();
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);

    // Clear stored state
    sessionStorage.removeItem('google_auth_state');
    sessionStorage.removeItem('google_auth_nonce');
    sessionStorage.removeItem('google_auth_context');

    console.log('[Google Auth] ✅ Sign-in successful:', result.user.email);

    return {
      success: true,
      user: result.user
    };
  } catch (error: any) {
    console.error('[Google Auth] Error processing callback:', error);
    
    // Clear stored state on error
    sessionStorage.removeItem('google_auth_state');
    sessionStorage.removeItem('google_auth_nonce');
    sessionStorage.removeItem('google_auth_context');
    
    return {
      success: false,
      error: error.message || 'Failed to complete Google sign-in'
    };
  }
}

