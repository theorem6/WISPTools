// Network Store - Manage multiple networks per user
import { writable, derived, get, type Writable, type Readable } from 'svelte/store';
import type { Network, NetworkSummary } from '../models/network';

// ============================================================================
// Network State Interface
// ============================================================================

export interface NetworkState {
  networks: Network[];              // All user's networks
  currentNetwork: Network | null;   // Active network being edited
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: NetworkState = {
  networks: [],
  currentNetwork: null,
  isLoading: false,
  error: null
};

// ============================================================================
// Network Store
// ============================================================================

function createNetworkStore() {
  const { subscribe, set, update }: Writable<NetworkState> = writable(initialState);

  return {
    subscribe,
    
    /**
     * Set all networks
     */
    setNetworks: (networks: Network[]) => {
      update(state => ({ ...state, networks, error: null }));
    },
    
    /**
     * Add a new network
     */
    addNetwork: (network: Network) => {
      update(state => ({
        ...state,
        networks: [network, ...state.networks],
        currentNetwork: network,
        error: null
      }));
    },
    
    /**
     * Update a network
     */
    updateNetwork: (networkId: string, updates: Partial<Network>) => {
      update(state => {
        const networks = state.networks.map(net =>
          net.id === networkId ? { ...net, ...updates, updatedAt: new Date() } : net
        );
        
        const currentNetwork = state.currentNetwork?.id === networkId
          ? { ...state.currentNetwork, ...updates, updatedAt: new Date() }
          : state.currentNetwork;
        
        return { ...state, networks, currentNetwork, error: null };
      });
    },
    
    /**
     * Delete a network
     */
    deleteNetwork: (networkId: string) => {
      update(state => {
        const networks = state.networks.filter(net => net.id !== networkId);
        const currentNetwork = state.currentNetwork?.id === networkId 
          ? null 
          : state.currentNetwork;
        
        return { ...state, networks, currentNetwork };
      });
    },
    
    /**
     * Set current active network
     */
    setCurrentNetwork: (network: Network | null) => {
      update(state => ({ ...state, currentNetwork: network, error: null }));
    },
    
    /**
     * Set current network by ID
     */
    setCurrentNetworkById: (networkId: string) => {
      update(state => {
        const network = state.networks.find(net => net.id === networkId) || null;
        return { ...state, currentNetwork: network, error: null };
      });
    },
    
    /**
     * Update current network's cells
     */
    updateCurrentNetworkCells: (cells: any[]) => {
      update(state => {
        if (!state.currentNetwork) return state;
        
        const updatedNetwork = {
          ...state.currentNetwork,
          cells,
          updatedAt: new Date()
        };
        
        const networks = state.networks.map(net =>
          net.id === updatedNetwork.id ? updatedNetwork : net
        );
        
        return {
          ...state,
          networks,
          currentNetwork: updatedNetwork,
          error: null
        };
      });
    },
    
    /**
     * Clear all networks
     */
    clear: () => {
      set(initialState);
    },
    
    /**
     * Set loading state
     */
    setLoading: (isLoading: boolean) => {
      update(state => ({ ...state, isLoading }));
    },
    
    /**
     * Set error
     */
    setError: (error: string | null) => {
      update(state => ({ ...state, error, isLoading: false }));
    },
    
    /**
     * Clear error
     */
    clearError: () => {
      update(state => ({ ...state, error: null }));
    }
  };
}

export const networkStore = createNetworkStore();

// ============================================================================
// Derived Stores
// ============================================================================

export const allNetworks: Readable<Network[]> = derived(
  networkStore,
  ($network) => $network.networks
);

export const currentNetwork: Readable<Network | null> = derived(
  networkStore,
  ($network) => $network.currentNetwork
);

export const currentNetworkCells: Readable<any[]> = derived(
  networkStore,
  ($network) => $network.currentNetwork?.cells || []
);

export const networkCount: Readable<number> = derived(
  networkStore,
  ($network) => $network.networks.length
);

export const hasCurrentNetwork: Readable<boolean> = derived(
  networkStore,
  ($network) => $network.currentNetwork !== null
);

export const isNetworkLoading: Readable<boolean> = derived(
  networkStore,
  ($network) => $network.isLoading
);

export const networkSummaries: Readable<NetworkSummary[]> = derived(
  networkStore,
  ($network) => $network.networks.map(net => ({
    id: net.id,
    name: net.name,
    market: net.market,
    cellCount: net.cells.length,
    conflictCount: 0, // Would need to calculate
    criticalCount: 0,
    updatedAt: net.updatedAt,
    ownerId: net.ownerId
  }))
);

