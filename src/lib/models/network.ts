// Network Data Model
import type { Cell } from '../pciMapper';

export interface Network {
  id: string;
  name: string;
  market: string;              // Geographic market (e.g., "New York Metro", "Los Angeles")
  description?: string;
  cells: Cell[];
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;             // Firebase User ID
  ownerEmail: string;          // User email for display
  isShared?: boolean;          // Allow other users to view (future feature)
  tags?: string[];             // Categorization tags
  metadata?: {
    region?: string;           // Region/State
    operator?: string;         // Network operator name
    deploymentPhase?: string;  // Planning, Active, Decommissioned
    notes?: string;
  };
}

export interface NetworkSummary {
  id: string;
  name: string;
  market: string;
  cellCount: number;
  conflictCount: number;
  criticalCount: number;
  updatedAt: Date;
  ownerId: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Date;
  lastLoginAt: Date;
  networkCount?: number;
}

// Network creation/update DTOs
export interface CreateNetworkDTO {
  name: string;
  market: string;
  description?: string;
  tags?: string[];
  metadata?: Network['metadata'];
}

export interface UpdateNetworkDTO extends Partial<CreateNetworkDTO> {
  cells?: Cell[];
}

// Helper to create new network
export function createNetwork(
  userId: string,
  userEmail: string,
  data: CreateNetworkDTO
): Network {
  const now = new Date();
  return {
    id: generateNetworkId(),
    name: data.name,
    market: data.market,
    description: data.description,
    cells: [],
    createdAt: now,
    updatedAt: now,
    ownerId: userId,
    ownerEmail: userEmail,
    isShared: false,
    tags: data.tags || [],
    metadata: data.metadata || {}
  };
}

// Helper to generate unique network ID
function generateNetworkId(): string {
  return `net_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Helper to convert Network to NetworkSummary
export function toNetworkSummary(network: Network, conflictCount: number = 0, criticalCount: number = 0): NetworkSummary {
  return {
    id: network.id,
    name: network.name,
    market: network.market,
    cellCount: network.cells.length,
    conflictCount,
    criticalCount,
    updatedAt: network.updatedAt,
    ownerId: network.ownerId
  };
}

