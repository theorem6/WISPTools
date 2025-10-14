/**
 * Google OAuth Service for CBRS/Google SAS Authentication
 * Handles OAuth 2.0 flow with Google Sign-In popup
 */

import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';

interface GoogleOAuthToken {
  accessToken: string;
  expiresAt: number;
  email: string;
  refreshToken?: string;
}

interface GoogleAuthState {
  isAuthenticated: boolean;
  googleEmail: string | null;
  accessToken: string | null;
  expiresAt: number | null;
  error: string | null;
}

// Google OAuth configuration - from environment variables
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || 
                        import.meta.env.PUBLIC_GOOGLE_OAUTH_CLIENT_ID || 
                        '1044782186913-kehquaq56fcubedupb34611c0hm1ctob.apps.googleusercontent.com';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cloud-platform', // For Google SAS API access
].join(' ');

const REDIRECT_URI = browser ? `${window.location.origin}/oauth/google/callback` : '';

// Debug logging
if (browser) {
  console.log('[Google OAuth] Client ID configured:', GOOGLE_CLIENT_ID ? '✅ Yes' : '❌ No');
  console.log('[Google OAuth] Client ID value:', GOOGLE_CLIENT_ID.substring(0, 20) + '...');
}

// Store for Google OAuth state
const initialState: GoogleAuthState = {
  isAuthenticated: false,
  googleEmail: null,
  accessToken: null,
  expiresAt: null,
  error: null
};

function createGoogleAuthStore() {
  const { subscribe, set, update } = writable<GoogleAuthState>(initialState);

  return {
    subscribe,
    
    /**
     * Initialize Google OAuth - check for existing token
     */
    async initialize(tenantId: string): Promise<void> {
      if (!browser) return;
      
      // Check localStorage for saved token
      const savedToken = localStorage.getItem(`google_oauth_${tenantId}`);
      
      if (savedToken) {
        try {
          const token: GoogleOAuthToken = JSON.parse(savedToken);
          
          // Check if token is still valid
          if (token.expiresAt > Date.now()) {
            update(state => ({
              ...state,
              isAuthenticated: true,
              googleEmail: token.email,
              accessToken: token.accessToken,
              expiresAt: token.expiresAt
            }));
            
            console.log('[Google OAuth] Loaded existing token for:', token.email);
            return;
          } else {
            // Token expired
            console.log('[Google OAuth] Token expired, clearing');
            localStorage.removeItem(`google_oauth_${tenantId}`);
          }
        } catch (error) {
          console.error('[Google OAuth] Error loading saved token:', error);
          localStorage.removeItem(`google_oauth_${tenantId}`);
        }
      }
      
      update(state => ({ ...state, isAuthenticated: false }));
    },
    
    /**
     * Sign in with Google (popup flow)
     */
    async signInWithPopup(tenantId: string): Promise<GoogleOAuthToken> {
      if (!browser) throw new Error('OAuth can only run in browser');
      
      return new Promise((resolve, reject) => {
        // Construct OAuth URL
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
        authUrl.searchParams.set('response_type', 'token');
        authUrl.searchParams.set('scope', GOOGLE_SCOPES);
        authUrl.searchParams.set('state', tenantId); // Pass tenant ID as state
        
        console.log('[Google OAuth] Opening sign-in popup...');
        
        // Open popup
        const width = 500;
        const height = 600;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        
        const popup = window.open(
          authUrl.toString(),
          'Google Sign-In',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
        );
        
        if (!popup) {
          reject(new Error('Failed to open popup. Please allow popups for this site.'));
          return;
        }
        
        // Listen for OAuth callback
        const handleMessage = (event: MessageEvent) => {
          // Verify origin
          if (event.origin !== window.location.origin) return;
          
          if (event.data.type === 'google_oauth_success') {
            window.removeEventListener('message', handleMessage);
            
            const token: GoogleOAuthToken = event.data.token;
            
            // Save to localStorage
            localStorage.setItem(`google_oauth_${tenantId}`, JSON.stringify(token));
            
            // Update store
            update(state => ({
              ...state,
              isAuthenticated: true,
              googleEmail: token.email,
              accessToken: token.accessToken,
              expiresAt: token.expiresAt,
              error: null
            }));
            
            console.log('[Google OAuth] Sign-in successful:', token.email);
            resolve(token);
          } else if (event.data.type === 'google_oauth_error') {
            window.removeEventListener('message', handleMessage);
            
            const error = event.data.error || 'OAuth failed';
            update(state => ({ ...state, error }));
            
            console.error('[Google OAuth] Sign-in failed:', error);
            reject(new Error(error));
          }
        };
        
        window.addEventListener('message', handleMessage);
        
        // Check if popup was closed
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            reject(new Error('Sign-in cancelled'));
          }
        }, 500);
      });
    },
    
    /**
     * Sign out from Google OAuth
     */
    signOut(tenantId: string): void {
      if (!browser) return;
      
      localStorage.removeItem(`google_oauth_${tenantId}`);
      set(initialState);
      console.log('[Google OAuth] Signed out');
    },
    
    /**
     * Get current access token
     */
    getAccessToken(): string | null {
      const state = get({ subscribe });
      
      // Check if token is still valid
      if (state.expiresAt && state.expiresAt <= Date.now()) {
        return null;
      }
      
      return state.accessToken;
    },
    
    /**
     * Check if authenticated
     */
    isAuthenticated(): boolean {
      const state = get({ subscribe });
      return state.isAuthenticated && !!state.accessToken && (state.expiresAt || 0) > Date.now();
    }
  };
}

export const googleAuthStore = createGoogleAuthStore();

