import { writable, type Writable } from 'svelte/store';
import type { PlanLayerFeature, PlanFeatureSummary, PlanProject, HardwareView } from '$lib/services/planService';
import { planService } from '$lib/services/planService';
import type { MapModuleMode, MapCapabilities } from './MapCapabilities';
import { getCapabilitiesForMode } from './MapCapabilities';
import { mapContext, setMapData, setMapError, setMapLoading, setMapMode } from './mapContext';

export interface MapLayerManagerState {
  mode: MapModuleMode;
  capabilities: MapCapabilities;
  activePlan: PlanProject | null;
  productionHardware: HardwareView[];
  stagedFeatures: PlanLayerFeature[];
  summary: PlanFeatureSummary;
  isLoading: boolean;
  error?: string;
}

const createState = (mode: MapModuleMode): MapLayerManagerState => ({
  mode,
  capabilities: getCapabilitiesForMode(mode),
  activePlan: null,
  productionHardware: [],
  stagedFeatures: [],
  summary: { total: 0, byType: {}, byStatus: {} },
  isLoading: false
});

export class MapLayerManager {
  private stateStore: Writable<MapLayerManagerState>;

  constructor(mode: MapModuleMode = 'plan') {
    this.stateStore = writable(createState(mode));
    setMapMode(mode);
  }

  subscribe(run: (value: MapLayerManagerState) => void) {
    return this.stateStore.subscribe(run);
  }

  async loadProductionHardware(tenantId: string) {
    this.updateState({ isLoading: true, error: undefined });
    setMapLoading(true);
    try {
      const hardware = await planService.getAllExistingHardware(tenantId);
      this.updateState({ productionHardware: hardware, isLoading: false });
      setMapData({ productionHardware: hardware, isLoading: false });
    } catch (error: any) {
      const message = error?.message || 'Failed to load hardware';
      this.updateState({ error: message, isLoading: false });
      setMapError(message);
    }
  }

  async loadPlan(tenantId: string, plan: PlanProject) {
    this.updateState({ activePlan: plan, isLoading: true, error: undefined });
    setMapLoading(true);
    setMapData({ activePlan: plan });
    try {
      const [{ features, summary }] = await Promise.all([
        planService.getPlanFeatures(plan.id),
        this.ensureProductionLoaded(tenantId)
      ]);

      this.updateState({
        activePlan: plan,
        stagedFeatures: features,
        summary,
        isLoading: false
      });

      setMapData({
        activePlan: plan,
        stagedFeatures: features,
        stagedSummary: summary,
        isLoading: false
      });
    } catch (error: any) {
      const message = error?.message || 'Failed to load plan features';
      this.updateState({ error: message, isLoading: false });
      setMapError(message);
    }
  }

  async refreshPlan(planId: string) {
    const current = this.getSnapshot();
    if (!current.activePlan || current.activePlan.id !== planId) return;

    try {
      const { features, summary } = await planService.getPlanFeatures(planId);
      this.updateState({ stagedFeatures: features, summary });
      setMapData({ stagedFeatures: features, stagedSummary: summary });
    } catch (error: any) {
      setMapError(error?.message || 'Failed to refresh plan');
    }
  }

  async addFeature(planId: string, payload: Parameters<typeof planService.createPlanFeature>[1]) {
    const { feature, summary } = await planService.createPlanFeature(planId, payload);
    const current = this.getSnapshot();
    const stagedFeatures = [...current.stagedFeatures, feature];
    this.updateState({ stagedFeatures, summary });
    setMapData({ stagedFeatures, stagedSummary: summary });
    return feature;
  }

  async updateFeature(planId: string, featureId: string, updates: Partial<PlanLayerFeature>) {
    const { feature, summary } = await planService.updatePlanFeature(planId, featureId, updates);
    const current = this.getSnapshot();
    const stagedFeatures = current.stagedFeatures.map(f => (f.id === feature.id ? feature : f));
    this.updateState({ stagedFeatures, summary });
    setMapData({ stagedFeatures, stagedSummary: summary });
    return feature;
  }

  async deleteFeature(planId: string, featureId: string) {
    const summary = await planService.deletePlanFeature(planId, featureId);
    const current = this.getSnapshot();
    const stagedFeatures = current.stagedFeatures.filter(f => f.id !== featureId);
    this.updateState({ stagedFeatures, summary });
    setMapData({ stagedFeatures, stagedSummary: summary });
    return summary;
  }

  setMode(mode: MapModuleMode) {
    this.updateState({
      mode,
      capabilities: getCapabilitiesForMode(mode)
    });
    setMapMode(mode);
  }

  setCapabilities(capabilities: MapCapabilities) {
    this.updateState({
      mode: capabilities.mode,
      capabilities
    });
  }

  private async ensureProductionLoaded(tenantId: string) {
    const current = this.getSnapshot();
    if (current.productionHardware.length === 0) {
      await this.loadProductionHardware(tenantId);
    }
  }

  private updateState(partial: Partial<MapLayerManagerState>) {
    this.stateStore.update(state => ({
      ...state,
      ...partial
    }));
  }

  private getSnapshot(): MapLayerManagerState {
    let snapshot: MapLayerManagerState = createState('plan');
    const unsubscribe = this.stateStore.subscribe(value => {
      snapshot = value;
    });
    unsubscribe();
    return snapshot;
  }
}

export const mapLayerManager = new MapLayerManager('plan');
mapLayerManager.subscribe(state => {
  mapContext.set({
    mode: state.mode,
    capabilities: state.capabilities,
    activePlan: state.activePlan,
    stagedFeatures: state.stagedFeatures,
    stagedSummary: state.summary,
    productionHardware: state.productionHardware,
    isLoading: state.isLoading,
    lastUpdated: new Date(),
    error: state.error
  });
});


