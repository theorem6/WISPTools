// Tenant Management Service
// Handles tenant CRUD operations and user-tenant associations

import { browser } from '$app/environment';
import { db, type Firestore } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  type Timestamp
} from 'firebase/firestore';
import type {
  Tenant,
  UserTenantAssociation,
  TenantRole,
  TenantInvitation,
  TenantSettings,
  TenantLimits
} from '../models/tenant';
import {
  DEFAULT_PERMISSIONS,
  DEFAULT_TENANT_SETTINGS,
  DEFAULT_TENANT_LIMITS,
  getCWMPUrl
} from '../models/tenant';

export class TenantService {
  private baseUrl: string;

  constructor() {
    // Get base URL from environment or construct it
    this.baseUrl = browser ? window.location.origin : 
      process.env.VITE_CWMP_BASE_URL || 'https://your-domain.com';
  }

  /**
   * Get Firestore instance (lazy)
   */
  private getDb(): Firestore {
    return db(); // Call as function
  }

  /**
   * Create a new tenant
   */
  async createTenant(
    name: string,
    displayName: string,
    contactEmail: string,
    createdBy: string,
    subdomain?: string,
    createOwnerAssociation: boolean = true
  ): Promise<{ success: boolean; tenantId?: string; error?: string }> {
    try {
      // IMPORTANT: Enforce one tenant per user (unless they're platform admin creating for others)
      if (createOwnerAssociation) {
        const userTenants = await this.getUserTenants(createdBy);
        if (userTenants.length > 0) {
          return { 
            success: false, 
            error: 'You already have an organization. Each account can only create one organization.' 
          };
        }
      }

      // Generate unique subdomain if not provided
      if (!subdomain) {
        subdomain = this.generateSubdomain(name);
      }

      // Check if subdomain is already taken
      const existingTenant = await this.getTenantBySubdomain(subdomain);
      if (existingTenant) {
        return { success: false, error: 'Subdomain already taken' };
      }

      const tenantId = `tenant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const tenant: Tenant = {
        id: tenantId,
        name,
        displayName,
        subdomain,
        cwmpUrl: getCWMPUrl({ subdomain } as Tenant, this.baseUrl),
        contactEmail,
        settings: DEFAULT_TENANT_SETTINGS,
        limits: DEFAULT_TENANT_LIMITS,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy,
        status: 'active'
      };

      // Save to Firestore
      await setDoc(doc(this.getDb(), 'tenants', tenantId), {
        ...tenant,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Only associate creator as owner if requested
      // Platform admins should NOT be associated with tenants they create
      if (createOwnerAssociation) {
        await this.addUserToTenant(createdBy, tenantId, 'owner');
      }

      return { success: true, tenantId };
    } catch (error) {
      console.error('Error creating tenant:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    try {
      const tenantDoc = await getDoc(doc(this.getDb(), 'tenants', tenantId));
      if (!tenantDoc.exists()) return null;
      
      const data = tenantDoc.data();
      return {
        ...data,
        id: tenantDoc.id,
        createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date()
      } as Tenant;
    } catch (error) {
      console.error('Error getting tenant:', error);
      return null;
    }
  }

  /**
   * Get tenant by subdomain
   */
  async getTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
    try {
      const q = query(
        collection(this.getDb(), 'tenants'),
        where('subdomain', '==', subdomain)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return null;
      
      const doc = snapshot.docs[0];
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date()
      } as Tenant;
    } catch (error) {
      console.error('Error getting tenant by subdomain:', error);
      return null;
    }
  }

  /**
   * Get all tenants for a user
   */
  async getUserTenants(userId: string): Promise<Tenant[]> {
    try {
      // Get user-tenant associations
      const q = query(
        collection(this.getDb(), 'user_tenants'),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      
      const tenantIds = snapshot.docs.map(doc => doc.data().tenantId);
      
      // Get all tenants
      const tenants: Tenant[] = [];
      for (const tenantId of tenantIds) {
        const tenant = await this.getTenant(tenantId);
        if (tenant) tenants.push(tenant);
      }
      
      return tenants;
    } catch (error) {
      console.error('Error getting user tenants:', error);
      return [];
    }
  }

  /**
   * Get ALL tenants (admin only)
   */
  async getAllTenants(): Promise<Tenant[]> {
    try {
      const tenantsCollection = collection(this.getDb(), 'tenants');
      const snapshot = await getDocs(tenantsCollection);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date()
        } as Tenant;
      });
    } catch (error) {
      console.error('Error getting all tenants:', error);
      return [];
    }
  }

  /**
   * Get user's role in a tenant
   */
  async getUserRole(userId: string, tenantId: string): Promise<TenantRole | null> {
    try {
      const associationId = `${userId}_${tenantId}`;
      const associationDoc = await getDoc(
        doc(this.getDb(), 'user_tenants', associationId)
      );
      
      if (!associationDoc.exists()) return null;
      return associationDoc.data().role as TenantRole;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  }

  /**
   * Add user to tenant
   */
  async addUserToTenant(
    userId: string,
    tenantId: string,
    role: TenantRole,
    invitedBy?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const associationId = `${userId}_${tenantId}`;
      
      const association: any = {
        userId,
        tenantId,
        role,
        permissions: DEFAULT_PERMISSIONS[role],
        createdAt: serverTimestamp()
      };

      // Only add invitedBy if it's provided
      if (invitedBy) {
        association.invitedBy = invitedBy;
      }

      await setDoc(doc(this.getDb(), 'user_tenants', associationId), association);

      return { success: true };
    } catch (error) {
      console.error('Error adding user to tenant:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Remove user from tenant
   */
  async removeUserFromTenant(
    userId: string,
    tenantId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const associationId = `${userId}_${tenantId}`;
      await deleteDoc(doc(this.getDb(), 'user_tenants', associationId));
      return { success: true };
    } catch (error) {
      console.error('Error removing user from tenant:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Update user role in tenant
   */
  async updateUserRole(
    userId: string,
    tenantId: string,
    newRole: TenantRole
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const associationId = `${userId}_${tenantId}`;
      await updateDoc(doc(this.getDb(), 'user_tenants', associationId), {
        role: newRole,
        permissions: DEFAULT_PERMISSIONS[newRole]
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating user role:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get all users in a tenant
   */
  async getTenantUsers(tenantId: string): Promise<UserTenantAssociation[]> {
    try {
      const q = query(
        collection(this.getDb(), 'user_tenants'),
        where('tenantId', '==', tenantId)
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate() || new Date()
        } as UserTenantAssociation;
      });
    } catch (error) {
      console.error('Error getting tenant users:', error);
      return [];
    }
  }

  /**
   * Update tenant settings
   */
  async updateTenantSettings(
    tenantId: string,
    settings: Partial<TenantSettings>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await updateDoc(doc(this.getDb(), 'tenants', tenantId), {
        settings: settings,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating tenant settings:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Update tenant limits
   */
  async updateTenantLimits(
    tenantId: string,
    limits: Partial<TenantLimits>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await updateDoc(doc(this.getDb(), 'tenants', tenantId), {
        limits: limits,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating tenant limits:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Create tenant invitation
   */
  async createInvitation(
    tenantId: string,
    email: string,
    role: TenantRole,
    invitedBy: string
  ): Promise<{ success: boolean; invitationId?: string; error?: string }> {
    try {
      const invitationId = `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry
      
      const invitation: TenantInvitation = {
        id: invitationId,
        tenantId,
        email,
        role,
        invitedBy,
        invitedAt: new Date(),
        expiresAt,
        status: 'pending'
      };

      await setDoc(doc(this.getDb(), 'tenant_invitations', invitationId), {
        ...invitation,
        invitedAt: serverTimestamp(),
        expiresAt: expiresAt
      });

      return { success: true, invitationId };
    } catch (error) {
      console.error('Error creating invitation:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Accept tenant invitation
   */
  async acceptInvitation(
    invitationId: string,
    userId: string
  ): Promise<{ success: boolean; tenantId?: string; error?: string }> {
    try {
      const invitationDoc = await getDoc(
        doc(this.getDb(), 'tenant_invitations', invitationId)
      );
      
      if (!invitationDoc.exists()) {
        return { success: false, error: 'Invitation not found' };
      }
      
      const invitation = invitationDoc.data() as TenantInvitation;
      
      if (invitation.status !== 'pending') {
        return { success: false, error: 'Invitation already used or expired' };
      }
      
      if (new Date() > invitation.expiresAt) {
        return { success: false, error: 'Invitation has expired' };
      }
      
      // Add user to tenant
      await this.addUserToTenant(userId, invitation.tenantId, invitation.role, invitation.invitedBy);
      
      // Update invitation status
      await updateDoc(doc(this.getDb(), 'tenant_invitations', invitationId), {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
        acceptedBy: userId
      });
      
      return { success: true, tenantId: invitation.tenantId };
    } catch (error) {
      console.error('Error accepting invitation:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Generate a unique subdomain from tenant name
   */
  private generateSubdomain(name: string): string {
    // Convert to lowercase, remove special chars, replace spaces with hyphens
    let subdomain = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    // Add random suffix to ensure uniqueness
    subdomain += `-${Math.random().toString(36).substr(2, 6)}`;
    
    return subdomain;
  }

  /**
   * Check if user has permission in tenant
   */
  async checkPermission(
    userId: string,
    tenantId: string,
    permission: keyof import('../models/tenant').TenantPermissions
  ): Promise<boolean> {
    try {
      const associationId = `${userId}_${tenantId}`;
      const associationDoc = await getDoc(
        doc(this.getDb(), 'user_tenants', associationId)
      );
      
      if (!associationDoc.exists()) return false;
      
      const association = associationDoc.data() as UserTenantAssociation;
      return association.permissions[permission];
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Delete a tenant and all associated data (ADMIN ONLY)
   * This performs a hard delete and removes:
   * - The tenant document
   * - All user-tenant associations
   * - All pending invitations
   * Note: Tenant-specific data (devices, configs) should be deleted separately if needed
   */
  async deleteTenant(tenantId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`Starting deletion of tenant: ${tenantId}`);
      
      // Verify tenant exists
      const tenant = await this.getTenant(tenantId);
      if (!tenant) {
        return { success: false, error: 'Tenant not found' };
      }

      // Delete all user-tenant associations
      const userAssociations = await this.getTenantUsers(tenantId);
      console.log(`Deleting ${userAssociations.length} user associations...`);
      
      for (const association of userAssociations) {
        const associationId = `${association.userId}_${tenantId}`;
        await deleteDoc(doc(this.getDb(), 'user_tenants', associationId));
      }

      // Delete all pending invitations for this tenant
      const invitationsQuery = query(
        collection(this.getDb(), 'tenant_invitations'),
        where('tenantId', '==', tenantId)
      );
      const invitationsSnapshot = await getDocs(invitationsQuery);
      console.log(`Deleting ${invitationsSnapshot.docs.length} invitations...`);
      
      for (const invDoc of invitationsSnapshot.docs) {
        await deleteDoc(invDoc.ref);
      }

      // Delete the tenant document itself
      console.log(`Deleting tenant document...`);
      await deleteDoc(doc(this.getDb(), 'tenants', tenantId));

      console.log(`Tenant ${tenantId} deleted successfully`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting tenant:', error);
      return { success: false, error: String(error) };
    }
  }
}

// Singleton instance
export const tenantService = new TenantService();

