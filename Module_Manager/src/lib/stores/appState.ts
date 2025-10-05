// Centralized state management for the PCI Mapper application
import { writable, derived, type Writable, type Readable } from 'svelte/store';
import type { Cell, PCIConflict, PCIConflictAnalysis } from '../pciMapper';
import type { OptimizationResult } from '../pciOptimizer';

// ============================================================================
// State Interfaces - Clear contracts for state shape
// ============================================================================

export interface CellsState {
  items: Cell[];
  isLoading: boolean;
  error: string | null;
}

export interface ConflictsState {
  items: PCIConflict[];
  analysis: PCIConflictAnalysis | null;
  isLoading: boolean;
  error: string | null;
}

export interface OptimizationState {
  result: OptimizationResult | null;
  isOptimizing: boolean;
  error: string | null;
}

export interface AnalysisState {
  geminiAnalysis: string;
  recommendations: string[];
  isLoading: boolean;
  error: string | null;
}

export interface UIState {
  showActionsModal: boolean;
  showAnalysisModal: boolean;
  showConflictsModal: boolean;
  showRecommendationsModal: boolean;
  showOptimizationResultModal: boolean;
}

export interface AppState {
  cells: CellsState;
  conflicts: ConflictsState;
  optimization: OptimizationState;
  analysis: AnalysisState;
  ui: UIState;
}

// ============================================================================
// Initial State - Predictable defaults
// ============================================================================

const initialCellsState: CellsState = {
  items: [],
  isLoading: false,
  error: null,
};

const initialConflictsState: ConflictsState = {
  items: [],
  analysis: null,
  isLoading: false,
  error: null,
};

const initialOptimizationState: OptimizationState = {
  result: null,
  isOptimizing: false,
  error: null,
};

const initialAnalysisState: AnalysisState = {
  geminiAnalysis: '',
  recommendations: [],
  isLoading: false,
  error: null,
};

const initialUIState: UIState = {
  showActionsModal: false,
  showAnalysisModal: false,
  showConflictsModal: false,
  showRecommendationsModal: false,
  showOptimizationResultModal: false,
};

// ============================================================================
// Stores - Isolated state management
// ============================================================================

export const cellsStore: Writable<CellsState> = writable(initialCellsState);
export const conflictsStore: Writable<ConflictsState> = writable(initialConflictsState);
export const optimizationStore: Writable<OptimizationState> = writable(initialOptimizationState);
export const analysisStore: Writable<AnalysisState> = writable(initialAnalysisState);
export const uiStore: Writable<UIState> = writable(initialUIState);

// ============================================================================
// Derived Stores - Computed values for better separation
// ============================================================================

export const cellCount: Readable<number> = derived(
  cellsStore,
  ($cellsStore) => $cellsStore.items.length
);

export const conflictCount: Readable<number> = derived(
  conflictsStore,
  ($conflictsStore) => $conflictsStore.items.length
);

export const criticalConflictCount: Readable<number> = derived(
  conflictsStore,
  ($conflictsStore) => $conflictsStore.items.filter(c => c.severity === 'CRITICAL').length
);

export const highConflictCount: Readable<number> = derived(
  conflictsStore,
  ($conflictsStore) => $conflictsStore.items.filter(c => c.severity === 'HIGH').length
);

export const mediumConflictCount: Readable<number> = derived(
  conflictsStore,
  ($conflictsStore) => $conflictsStore.items.filter(c => c.severity === 'MEDIUM').length
);

export const lowConflictCount: Readable<number> = derived(
  conflictsStore,
  ($conflictsStore) => $conflictsStore.items.filter(c => c.severity === 'LOW').length
);

export const hasData: Readable<boolean> = derived(
  cellsStore,
  ($cellsStore) => $cellsStore.items.length > 0
);

export const hasConflicts: Readable<boolean> = derived(
  conflictsStore,
  ($conflictsStore) => $conflictsStore.items.length > 0
);

export const isAnyLoading: Readable<boolean> = derived(
  [cellsStore, conflictsStore, optimizationStore, analysisStore],
  ([$cells, $conflicts, $optimization, $analysis]) =>
    $cells.isLoading || $conflicts.isLoading || $optimization.isOptimizing || $analysis.isLoading
);

// ============================================================================
// Store Actions - Encapsulated state mutations
// ============================================================================

export const cellsActions = {
  set: (cells: Cell[]) => {
    cellsStore.update(state => ({ ...state, items: cells, error: null }));
  },
  
  add: (cells: Cell[]) => {
    cellsStore.update(state => ({
      ...state,
      items: [...state.items, ...cells],
      error: null
    }));
  },
  
  clear: () => {
    cellsStore.set(initialCellsState);
  },
  
  setLoading: (isLoading: boolean) => {
    cellsStore.update(state => ({ ...state, isLoading }));
  },
  
  setError: (error: string) => {
    cellsStore.update(state => ({ ...state, error, isLoading: false }));
  },
};

export const conflictsActions = {
  set: (conflicts: PCIConflict[], analysis: PCIConflictAnalysis | null = null) => {
    conflictsStore.update(state => ({
      ...state,
      items: conflicts,
      analysis,
      error: null
    }));
  },
  
  clear: () => {
    conflictsStore.set(initialConflictsState);
  },
  
  setLoading: (isLoading: boolean) => {
    conflictsStore.update(state => ({ ...state, isLoading }));
  },
  
  setError: (error: string) => {
    conflictsStore.update(state => ({ ...state, error, isLoading: false }));
  },
};

export const optimizationActions = {
  setResult: (result: OptimizationResult | null) => {
    optimizationStore.update(state => ({
      ...state,
      result,
      error: null,
      isOptimizing: false
    }));
  },
  
  setOptimizing: (isOptimizing: boolean) => {
    optimizationStore.update(state => ({ ...state, isOptimizing }));
  },
  
  clear: () => {
    optimizationStore.set(initialOptimizationState);
  },
  
  setError: (error: string) => {
    optimizationStore.update(state => ({
      ...state,
      error,
      isOptimizing: false
    }));
  },
};

export const analysisActions = {
  setGeminiAnalysis: (geminiAnalysis: string) => {
    analysisStore.update(state => ({ ...state, geminiAnalysis, error: null }));
  },
  
  setRecommendations: (recommendations: string[]) => {
    analysisStore.update(state => ({ ...state, recommendations }));
  },
  
  setLoading: (isLoading: boolean) => {
    analysisStore.update(state => ({ ...state, isLoading }));
  },
  
  clear: () => {
    analysisStore.set(initialAnalysisState);
  },
  
  setError: (error: string) => {
    analysisStore.update(state => ({ ...state, error, isLoading: false }));
  },
};

export const uiActions = {
  openModal: (modalName: keyof UIState) => {
    uiStore.update(state => ({ ...state, [modalName]: true }));
  },
  
  closeModal: (modalName: keyof UIState) => {
    uiStore.update(state => ({ ...state, [modalName]: false }));
  },
  
  closeAllModals: () => {
    uiStore.set(initialUIState);
  },
  
  toggleModal: (modalName: keyof UIState) => {
    uiStore.update(state => ({ ...state, [modalName]: !state[modalName] }));
  },
};

// ============================================================================
// Reset All - Utility to reset entire application state
// ============================================================================

export const resetAllStores = () => {
  cellsStore.set(initialCellsState);
  conflictsStore.set(initialConflictsState);
  optimizationStore.set(initialOptimizationState);
  analysisStore.set(initialAnalysisState);
  uiStore.set(initialUIState);
};

