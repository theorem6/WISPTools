// Authentication Store
import { writable, derived, type Writable, type Readable } from 'svelte/store';
import { browser } from '$app/environment';
import { authService } from '../services/authService';
import type { User } from 'firebase/auth';
import type { UserProfile } from '../models/network';

// ============================================================================
// Auth State Interface
// ============================================================================

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null
};

// ============================================================================
// Auth Store
// ============================================================================

function createAuthStore() {
  const { subscribe, set, update }: Writable<AuthState> = writable(initialState);

  // Initialize auth listener
  if (browser) {
    authService.onAuthStateChange((firebaseUser: User | null) => {
      if (firebaseUser) {
        const userProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || undefined,
          photoURL: firebaseUser.photoURL || undefined,
          createdAt: firebaseUser.metadata.creationTime 
            ? new Date(firebaseUser.metadata.creationTime) 
            : new Date(),
          lastLoginAt: firebaseUser.metadata.lastSignInTime 
            ? new Date(firebaseUser.metadata.lastSignInTime) 
            : new Date()
        };

        set({
          user: userProfile,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null
        });
      }
    });
  }

  return {
    subscribe,
    
    setLoading: (isLoading: boolean) => {
      update(state => ({ ...state, isLoading }));
    },
    
    setError: (error: string | null) => {
      update(state => ({ ...state, error, isLoading: false }));
    },
    
    clearError: () => {
      update(state => ({ ...state, error: null }));
    }
  };
}

export const authStore = createAuthStore();

// ============================================================================
// Derived Stores
// ============================================================================

export const currentUser: Readable<UserProfile | null> = derived(
  authStore,
  ($auth) => $auth.user
);

export const isAuthenticated: Readable<boolean> = derived(
  authStore,
  ($auth) => $auth.isAuthenticated
);

export const isAuthLoading: Readable<boolean> = derived(
  authStore,
  ($auth) => $auth.isLoading
);

export const userEmail: Readable<string | null> = derived(
  authStore,
  ($auth) => $auth.user?.email || null
);

export const userId: Readable<string | null> = derived(
  authStore,
  ($auth) => $auth.user?.uid || null
);

