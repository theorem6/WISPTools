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
   * Get a specific network by ID (with cells from subcollection)
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
      
      // Load cells from subcollection
      const cellsResult = await this.getNetworkCells(networkId);
      if (cellsResult.success && cellsResult.data) {
        network.cells = cellsResult.data;
      }
      
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
   * Get all networks for a user (with cells from subcollections)
   */
  async getUserNetworks(userId: string): Promise<NetworkResult<Network[]>> {
    if (!browser) {
      return { success: false, error: 'Not in browser environment' };
    }

    try {
      // Simple query without orderBy to avoid composite index requirement
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('ownerId', '==', userId)
      );

      const querySnapshot = await getDocs(q);
      const networks: Network[] = [];

      // Load networks
      querySnapshot.forEach((doc) => {
        networks.push(this.fromFirestoreDoc(doc.id, doc.data()));
      });

      // Load cells for each network from subcollections
      await Promise.all(
        networks.map(async (network) => {
          const cellsResult = await this.getNetworkCells(network.id);
          if (cellsResult.success && cellsResult.data) {
            network.cells = cellsResult.data;
          }
        })
      );

      // Sort locally by updatedAt (descending)
      networks.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

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
   * Update network cells in subcollection
   */
  async updateNetworkCells(
    networkId: string,
    cells: Cell[]
  ): Promise<NetworkResult<void>> {
    if (!browser) {
      return { success: false, error: 'Not in browser environment' };
    }

    try {
      // Store cells in a subcollection, not as an array
      const cellsCollectionRef = collection(db, this.COLLECTION_NAME, networkId, 'cells');
      
      // Delete all existing cells first
      const existingCells = await getDocs(cellsCollectionRef);
      const deletePromises = existingCells.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Add new cells
      const addPromises = cells.map(cell => 
        setDoc(doc(cellsCollectionRef, cell.id), cell)
      );
      await Promise.all(addPromises);
      
      // Update the network's updatedAt timestamp
      await updateDoc(doc(db, this.COLLECTION_NAME, networkId), {
        updatedAt: Timestamp.now()
      });
      
      return { success: true };
    } catch (error: any) {
      console.error('[NetworkService] Update cells error:', error);
      return {
        success: false,
        error: error?.message || 'Failed to update cells'
      };
    }
  }

  /**
   * Get cells for a network from subcollection
   */
  async getNetworkCells(networkId: string): Promise<NetworkResult<Cell[]>> {
    if (!browser) {
      return { success: false, error: 'Not in browser environment' };
    }

    try {
      const cellsCollectionRef = collection(db, this.COLLECTION_NAME, networkId, 'cells');
      const querySnapshot = await getDocs(cellsCollectionRef);
      
      const cells: Cell[] = [];
      querySnapshot.forEach((doc) => {
        cells.push(doc.data() as Cell);
      });
      
      return { success: true, data: cells };
    } catch (error: any) {
      console.error('[NetworkService] Get cells error:', error);
      return {
        success: false,
        error: error?.message || 'Failed to load cells'
      };
    }
  }

  /**
   * Delete a network and all its cells
   */
  async deleteNetwork(networkId: string): Promise<NetworkResult<void>> {
    if (!browser) {
      return { success: false, error: 'Not in browser environment' };
    }

    try {
      // Delete all cells in the subcollection first
      const cellsCollectionRef = collection(db, this.COLLECTION_NAME, networkId, 'cells');
      const cellsSnapshot = await getDocs(cellsCollectionRef);
      const deleteCellPromises = cellsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteCellPromises);
      
      // Then delete the network document
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
   * Search networks by market (with cells from subcollections)
   */
  async searchNetworksByMarket(
    userId: string,
    market: string
  ): Promise<NetworkResult<Network[]>> {
    if (!browser) {
      return { success: false, error: 'Not in browser environment' };
    }

    try {
      // Simple query without orderBy to avoid composite index requirement
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('ownerId', '==', userId),
        where('market', '==', market)
      );

      const querySnapshot = await getDocs(q);
      const networks: Network[] = [];

      // Load networks
      querySnapshot.forEach((doc) => {
        networks.push(this.fromFirestoreDoc(doc.id, doc.data()));
      });

      // Load cells for each network from subcollections
      await Promise.all(
        networks.map(async (network) => {
          const cellsResult = await this.getNetworkCells(network.id);
          if (cellsResult.success && cellsResult.data) {
            network.cells = cellsResult.data;
          }
        })
      );

      // Sort locally by updatedAt (descending)
      networks.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

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
   * Note: Firestore doesn't support undefined values, so we filter them out
   * Cells are stored in a subcollection, not in the network document
   */
  private toFirestoreDoc(network: Network): any {
    const doc: any = {
      name: network.name,
      market: network.market,
      description: network.description || '',
      // cells are stored in subcollection, not in document
      createdAt: Timestamp.fromDate(network.createdAt),
      updatedAt: Timestamp.fromDate(network.updatedAt),
      ownerId: network.ownerId,
      ownerEmail: network.ownerEmail,
      isShared: network.isShared || false,
      tags: network.tags || [],
    };

    // Add location (filter out undefined values)
    if (network.location) {
      const location: any = {
        latitude: network.location.latitude,
        longitude: network.location.longitude
      };
      
      if (network.location.address) location.address = network.location.address;
      if (network.location.city) location.city = network.location.city;
      if (network.location.state) location.state = network.location.state;
      if (network.location.country) location.country = network.location.country;
      if (network.location.zoom) location.zoom = network.location.zoom;
      
      doc.location = location;
    }

    // Only include metadata if it has actual values (no undefined)
    if (network.metadata) {
      const metadata: any = {};
      if (network.metadata.region) metadata.region = network.metadata.region;
      if (network.metadata.operator) metadata.operator = network.metadata.operator;
      if (network.metadata.deploymentPhase) metadata.deploymentPhase = network.metadata.deploymentPhase;
      if (network.metadata.notes) metadata.notes = network.metadata.notes;
      
      // Only add metadata if it has at least one field
      if (Object.keys(metadata).length > 0) {
        doc.metadata = metadata;
      }
    }

    return doc;
  }

  /**
   * Convert Firestore document to Network
   * Cells are loaded separately from subcollection
   */
  private fromFirestoreDoc(id: string, data: any): Network {
    return {
      id,
      name: data.name,
      market: data.market,
      location: data.location || {
        latitude: 40.7128,
        longitude: -74.0060,
        zoom: 12
      },
      description: data.description,
      cells: [], // Cells loaded from subcollection
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

