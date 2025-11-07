import { writable, type Writable } from 'svelte/store';
import type { MapCapabilities, MapModuleMode } from './MapCapabilities';
import { getCapabilitiesForMode } from './MapCapabilities';
import type { PlanLayerFeature, PlanFeatureSummary, PlanProject, HardwareView } from '$lib/services/planService';

export interface MapLayerState {
  mode: MapModuleMode;
  capabilities: MapCapabilities;
  activePlan: PlanProject | null;
  stagedFeatures: PlanLayerFeature[];
  stagedSummary: PlanFeatureSummary;
  productionHardware: HardwareView[];
  isLoading: boolean;
  lastUpdated: Date | null;
  error?: string;
}

const createDefaultState = (mode: MapModuleMode): MapLayerState => ({
  mode,
  capabilities: getCapabilitiesForMode(mode),
  activePlan: null,
  stagedFeatures: [],
  stagedSummary: { total: 0, byType: {}, byStatus: {} },
  productionHardware: [],
  isLoading: false,
  lastUpdated: null
});

const mapContextStore: Writable<MapLayerState> = writable(createDefaultState('plan'));

export function setMapMode(mode: MapModuleMode) {
  mapContextStore.update(state => ({
    ...createDefaultState(mode),
    activePlan: state.activePlan,
    productionHardware: state.productionHardware
  }));
}

export function setMapCapabilities(capabilities: MapCapabilities) {
  mapContextStore.update(state => ({
    ...state,
    capabilities,
    mode: capabilities.mode
  }));
}

export function setMapLoading(isLoading: boolean) {
  mapContextStore.update(state => ({
    ...state,
    isLoading
  }));
}

export function setMapError(error?: string) {
  mapContextStore.update(state => ({
    ...state,
    error
  }));
}

export function setMapData(data: Partial<Omit<MapLayerState, 'capabilities' | 'mode'>>) {
  mapContextStore.update(state => ({
    ...state,
    ...data,
    lastUpdated: new Date()
  }));
}

export function resetMapContext(mode: MapModuleMode = 'plan') {
  mapContextStore.set(createDefaultState(mode));
}

export const mapContext = mapContextStore;


