// Network Management Service with Firestore Integration
import { browser } from '$app/environment';
import { db } from '../firebase';
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
  orderBy,
  limit,
  Timestamp,
  type QueryConstraint
} from 'firebase/firestore';
import type { Network, NetworkSummary, CreateNetworkDTO, UpdateNetworkDTO } from '../models/network';
import { createNetwork, toNetworkSummary } from '../models/network';
import type { Cell } from '../pciMapper';

// ============================================================================
// Service Result Type
// ============================================================================

export interface NetworkResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Network Service Class
// ============================================================================

export class NetworkService {
  private readonly COLLECTION_NAME = 'networks';

  /**
   * Create a new network
   */
  async createNetwork(
    userId: string,
    userEmail: string,
    data: CreateNetworkDTO
  ): Promise<NetworkResult<Network>> {
    if (!browser) {
      return { success: false, error: 'Not in browser environment' };
    }

    try {
      const network = createNetwork(userId, userEmail, data);
      
      // Convert dates to Firestore Timestamps
      const networkDoc = this.toFirestoreDoc(network);
      
      await setDoc(doc(db, this.COLLECTION_NAME, network.id), networkDoc);
      
      return { success: true, data: network };
    } catch (error: any) {
      console.error('[NetworkService] Create error:', error);
      return {
        success: false,
        error: error?.message || 'Failed to create network'
      };
    }
  }

  /**
   * Get a specific network by ID
   */
  async getNetwork(networkId: string): Promise<NetworkResult<Network>> {
    if (!browser) {
      return { success: false, error: 'Not in browser environment' };
    }

    try {
      const docRef = doc(db, this.COLLECTION_NAME, networkId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return { success: false, error: 'Network not found' };
      }

      const network = this.fromFirestoreDoc(docSnap.id, docSnap.data());
      return { success: true, data: network };
    } catch (error: any) {
      console.error('[NetworkService] Get error:', error);
      return {
        success: false,
        error: error?.message || 'Failed to load network'
      };
    }
  }

  /**
   * Get all networks for a user
   */
  async getUserNetworks(userId: string): Promise<NetworkResult<Network[]>> {
    if (!browser) {
      return { success: false, error: 'Not in browser environment' };
    }

    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('ownerId', '==', userId),
        orderBy('updatedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const networks: Network[] = [];

      querySnapshot.forEach((doc) => {
        networks.push(this.fromFirestoreDoc(doc.id, doc.data()));
      });

      return { success: true, data: networks };
    } catch (error: any) {
      console.error('[NetworkService] Get user networks error:', error);
      return {
        success: false,
        error: error?.message || 'Failed to load networks'
      };
    }
  }

  /**
   * Update network data
   */
  async updateNetwork(
    networkId: string,
    updates: UpdateNetworkDTO
  ): Promise<NetworkResult<void>> {
    if (!browser) {
      return { success: false, error: 'Not in browser environment' };
    }

    try {
      const docRef = doc(db, this.COLLECTION_NAME, networkId);
      
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.now()
      };

      await updateDoc(docRef, updateData);
      
      return { success: true };
    } catch (error: any) {
      console.error('[NetworkService] Update error:', error);
      return {
        success: false,
        error: error?.message || 'Failed to update network'
      };
    }
  }

  /**
   * Update network cells
   */
  async updateNetworkCells(
    networkId: string,
    cells: Cell[]
  ): Promise<NetworkResult<void>> {
    return this.updateNetwork(networkId, { cells });
  }

  /**
   * Delete a network
   */
  async deleteNetwork(networkId: string): Promise<NetworkResult<void>> {
    if (!browser) {
      return { success: false, error: 'Not in browser environment' };
    }

    try {
      await deleteDoc(doc(db, this.COLLECTION_NAME, networkId));
      return { success: true };
    } catch (error: any) {
      console.error('[NetworkService] Delete error:', error);
      return {
        success: false,
        error: error?.message || 'Failed to delete network'
      };
    }
  }

  /**
   * Get network summaries for list view
   */
  async getUserNetworkSummaries(userId: string): Promise<NetworkResult<NetworkSummary[]>> {
    const result = await this.getUserNetworks(userId);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const summaries = result.data.map(network => 
      toNetworkSummary(network, 0, 0)
    );

    return { success: true, data: summaries };
  }

  /**
   * Search networks by market
   */
  async searchNetworksByMarket(
    userId: string,
    market: string
  ): Promise<NetworkResult<Network[]>> {
    if (!browser) {
      return { success: false, error: 'Not in browser environment' };
    }

    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('ownerId', '==', userId),
        where('market', '==', market),
        orderBy('updatedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const networks: Network[] = [];

      querySnapshot.forEach((doc) => {
        networks.push(this.fromFirestoreDoc(doc.id, doc.data()));
      });

      return { success: true, data: networks };
    } catch (error: any) {
      console.error('[NetworkService] Search error:', error);
      return {
        success: false,
        error: error?.message || 'Failed to search networks'
      };
    }
  }

  // =========================================================================
  // Helper Methods - Firestore Conversion
  // =========================================================================

  /**
   * Convert Network to Firestore document
   */
  private toFirestoreDoc(network: Network): any {
    return {
      name: network.name,
      market: network.market,
      description: network.description || '',
      cells: network.cells,
      createdAt: Timestamp.fromDate(network.createdAt),
      updatedAt: Timestamp.fromDate(network.updatedAt),
      ownerId: network.ownerId,
      ownerEmail: network.ownerEmail,
      isShared: network.isShared || false,
      tags: network.tags || [],
      metadata: network.metadata || {}
    };
  }

  /**
   * Convert Firestore document to Network
   */
  private fromFirestoreDoc(id: string, data: any): Network {
    return {
      id,
      name: data.name,
      market: data.market,
      description: data.description,
      cells: data.cells || [],
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      ownerId: data.ownerId,
      ownerEmail: data.ownerEmail,
      isShared: data.isShared || false,
      tags: data.tags || [],
      metadata: data.metadata || {}
    };
  }
}

// Singleton instance
export const networkService = new NetworkService();

