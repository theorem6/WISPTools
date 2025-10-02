// Firebase Authentication Service
import { browser } from '$app/environment';
import { auth } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  type User
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

  constructor() {
    if (browser) {
      this.initializeAuthListener();
      this.setupTokenRefresh();
    }
  }

  /**
   * Initialize Firebase auth state listener with error recovery
   */
  private initializeAuthListener(): void {
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      
      // Log auth state changes for debugging
      if (user) {
        console.log('Auth state: User signed in', user.email);
        console.log('Token expiration:', user.metadata.lastSignInTime);
      } else {
        console.log('Auth state: User signed out');
      }
      
      this.notifyListeners(user);
    }, (error) => {
      console.error('Auth state change error:', error);
      // Handle auth errors (expired tokens, etc.)
      this.currentUser = null;
      this.notifyListeners(null);
    });
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
          await this.currentUser.getIdToken(true); // Force refresh
          console.log('Auth token refreshed successfully');
        } catch (error) {
          console.error('Token refresh failed:', error);
          // User might need to re-authenticate
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
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
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
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return {
        success: true,
        data: this.mapUserToProfile(userCredential.user)
      };
    } catch (error: any) {
      return {
        success: false,
        error: this.getAuthErrorMessage(error)
      };
    }
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle(): Promise<AuthResult<UserProfile>> {
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      return {
        success: true,
        data: this.mapUserToProfile(userCredential.user)
      };
    } catch (error: any) {
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
      await signOut(auth);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: this.getAuthErrorMessage(error)
      };
    }
  }

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<AuthResult<void>> {
    try {
      await sendPasswordResetEmail(auth, email);
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
        return 'Invalid credentials. Please check your email and password.';
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

