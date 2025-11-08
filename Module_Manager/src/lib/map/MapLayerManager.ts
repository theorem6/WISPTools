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
  private localFeatureCache: Map<string, PlanLayerFeature[]> = new Map();

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
      const [{ features }] = await Promise.all([
        planService.getPlanFeatures(plan.id),
        this.ensureProductionLoaded(tenantId)
      ]);

      const combinedFeatures = this.mergeWithLocalFeatures(plan.id, features);
      const summary = this.computeSummaryFromFeatures(combinedFeatures);

      this.updateState({
        activePlan: plan,
        stagedFeatures: combinedFeatures,
        summary,
        isLoading: false
      });

      setMapData({
        activePlan: plan,
        stagedFeatures: combinedFeatures,
        stagedSummary: summary,
        isLoading: false
      });
    } catch (error: any) {
      const message = error?.message || 'Failed to load plan features';
      const localFeatures = this.getLocalFeaturesForPlan(plan.id);
      const summary = this.computeSummaryFromFeatures(localFeatures);

      this.updateState({
        activePlan: plan,
        stagedFeatures: localFeatures,
        summary,
        isLoading: false,
        error: message
      });

      setMapData({
        activePlan: plan,
        stagedFeatures: localFeatures,
        stagedSummary: summary,
        isLoading: false,
        error: message
      });
      setMapError(message);
    }
  }

  async refreshPlan(planId: string) {
    const current = this.getSnapshot();
    if (!current.activePlan || current.activePlan.id !== planId) return;

    try {
      const { features } = await planService.getPlanFeatures(planId);
      const combinedFeatures = this.mergeWithLocalFeatures(planId, features);
      const summary = this.computeSummaryFromFeatures(combinedFeatures);
      this.updateState({ stagedFeatures: combinedFeatures, summary });
      setMapData({ stagedFeatures: combinedFeatures, stagedSummary: summary });
    } catch (error: any) {
      const message = error?.message || 'Failed to refresh plan';
      const localFeatures = this.getLocalFeaturesForPlan(planId);
      const summary = this.computeSummaryFromFeatures(localFeatures);
      this.updateState({ stagedFeatures: localFeatures, summary, error: message });
      setMapData({ stagedFeatures: localFeatures, stagedSummary: summary, error: message });
      setMapError(message);
    }
  }

  async addFeature(planId: string, payload: Parameters<typeof planService.createPlanFeature>[1]) {
    try {
      const { feature, summary } = await planService.createPlanFeature(planId, payload);
      const current = this.getSnapshot();
      const stagedFeatures = [...current.stagedFeatures, feature];
      this.saveRemoteSync(planId, stagedFeatures);
      this.updateState({ stagedFeatures, summary });
      setMapData({ stagedFeatures, stagedSummary: summary });
      return feature;
    } catch (error: any) {
      if (!this.shouldFallbackToLocal(error)) {
        throw error;
      }

      console.warn('[MapLayerManager] Falling back to local staged feature cache (create)', error);
      const current = this.getSnapshot();
      const feature = this.createLocalFeature(planId, payload);
      const stagedFeatures = [...current.stagedFeatures, feature];
      this.saveLocalFeature(planId, feature);
      const summary = this.computeSummaryFromFeatures(stagedFeatures);
      this.updateState({ stagedFeatures, summary });
      setMapData({ stagedFeatures, stagedSummary: summary });
      return feature;
    }
  }

  async updateFeature(planId: string, featureId: string, updates: Partial<PlanLayerFeature>) {
    try {
      const { feature, summary } = await planService.updatePlanFeature(planId, featureId, updates);
      const current = this.getSnapshot();
      const stagedFeatures = current.stagedFeatures.map(f => (f.id === feature.id ? feature : f));
      this.saveRemoteSync(planId, stagedFeatures);
      this.updateState({ stagedFeatures, summary });
      setMapData({ stagedFeatures, stagedSummary: summary });
      return feature;
    } catch (error: any) {
      if (!this.shouldFallbackToLocal(error)) {
        throw error;
      }

      console.warn('[MapLayerManager] Falling back to local staged feature cache (update)', error);
      const updated = this.updateLocalFeature(planId, featureId, updates);
      if (!updated) {
        throw error;
      }

      const current = this.getSnapshot();
      const stagedFeatures = current.stagedFeatures.map(f => (f.id === updated.id ? updated : f));
      const summary = this.computeSummaryFromFeatures(stagedFeatures);
      this.updateState({ stagedFeatures, summary });
      setMapData({ stagedFeatures, stagedSummary: summary });
      return updated;
    }
  }

  async deleteFeature(planId: string, featureId: string) {
    try {
      const summary = await planService.deletePlanFeature(planId, featureId);
      const current = this.getSnapshot();
      const stagedFeatures = current.stagedFeatures.filter(f => f.id !== featureId);
      this.removeLocalFeature(planId, featureId);
      this.saveRemoteSync(planId, stagedFeatures);
      this.updateState({ stagedFeatures, summary });
      setMapData({ stagedFeatures, stagedSummary: summary });
      return summary;
    } catch (error: any) {
      if (!this.shouldFallbackToLocal(error)) {
        throw error;
      }

      console.warn('[MapLayerManager] Falling back to local staged feature cache (delete)', error);
      this.removeLocalFeature(planId, featureId);
      const current = this.getSnapshot();
      const stagedFeatures = current.stagedFeatures.filter(f => f.id !== featureId);
      const summary = this.computeSummaryFromFeatures(stagedFeatures);
      this.updateState({ stagedFeatures, summary });
      setMapData({ stagedFeatures, stagedSummary: summary });
      return summary;
    }
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

  private shouldFallbackToLocal(error: any): boolean {
    const message = (error?.message || '').toLowerCase();
    return message.includes('404') || message.includes('not found') || message.includes('request failed') || message.includes('failed to fetch');
  }

  private getLocalFeaturesForPlan(planId: string): PlanLayerFeature[] {
    return this.localFeatureCache.get(planId) ?? [];
  }

  private saveLocalFeature(planId: string, feature: PlanLayerFeature) {
    const existing = this.getLocalFeaturesForPlan(planId);
    this.localFeatureCache.set(planId, [...existing, feature]);
  }

  private updateLocalFeature(planId: string, featureId: string, updates: Partial<PlanLayerFeature>): PlanLayerFeature | null {
    const local = this.getLocalFeaturesForPlan(planId);
    const index = local.findIndex(feature => feature.id === featureId);
    if (index === -1) {
      return null;
    }

    const updated: PlanLayerFeature = {
      ...local[index],
      ...updates,
      updatedAt: new Date()
    };

    if ((updates as any)?.geometry) {
      (updated as any).geometry = this.toEsriGeometry((updates as any).geometry);
    }

    local[index] = updated;
    this.localFeatureCache.set(planId, [...local]);
    return updated;
  }

  private removeLocalFeature(planId: string, featureId: string) {
    const local = this.getLocalFeaturesForPlan(planId);
    if (!local.length) {
      return;
    }
    const filtered = local.filter(feature => feature.id !== featureId);
    this.localFeatureCache.set(planId, filtered);
  }

  private saveRemoteSync(planId: string, stagedFeatures: PlanLayerFeature[]) {
    const remoteIds = new Set(stagedFeatures.map(feature => feature.id));
    const local = this.getLocalFeaturesForPlan(planId).filter(feature => !remoteIds.has(feature.id));
    if (local.length) {
      this.localFeatureCache.set(planId, local);
    } else if (this.localFeatureCache.has(planId)) {
      this.localFeatureCache.delete(planId);
    }
  }

  private mergeWithLocalFeatures(planId: string, remoteFeatures: PlanLayerFeature[]): PlanLayerFeature[] {
    const remoteIds = new Set(remoteFeatures.map(feature => feature.id));
    const local = this.getLocalFeaturesForPlan(planId).filter(feature => !remoteIds.has(feature.id));
    return [...remoteFeatures, ...local];
  }

  private computeSummaryFromFeatures(features: PlanLayerFeature[]): PlanFeatureSummary {
    const summary: PlanFeatureSummary = {
      total: features.length,
      byType: {},
      byStatus: {}
    };

    for (const feature of features) {
      const typeKey = feature.featureType || (feature as any).type || 'unknown';
      const statusKey = feature.status || 'draft';

      summary.byType[typeKey] = (summary.byType[typeKey] ?? 0) + 1;
      summary.byStatus[statusKey] = (summary.byStatus[statusKey] ?? 0) + 1;
    }

    return summary;
  }

  private createLocalFeature(planId: string, payload: Parameters<typeof planService.createPlanFeature>[1]): PlanLayerFeature {
    const current = this.getSnapshot();
    const tenantId = current.activePlan?.tenantId ?? '';
    const now = new Date();
    const id = `local-${planId}-${crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
    const esriGeometry = this.toEsriGeometry(payload.geometry);

    const feature: PlanLayerFeature = {
      id,
      tenantId,
      planId,
      featureType: payload.featureType,
      geometry: esriGeometry,
      properties: payload.properties ?? {},
      status: payload.status ?? 'draft',
      metadata: {
        ...(payload.metadata ?? {}),
        local: true,
        originalGeometry: payload.geometry ?? null
      },
      createdAt: now,
      updatedAt: now
    };

    (feature as any).type = payload.featureType;
    return feature;
  }

  private toEsriGeometry(geometry: any): any {
    if (!geometry) return undefined;

    const type = (geometry.type || '').toLowerCase();
    switch (type) {
      case 'point': {
        const [longitude, latitude] = geometry.coordinates || [0, 0];
        return {
          type: 'point',
          longitude,
          latitude,
          spatialReference: { wkid: 4326 }
        };
      }
      case 'linestring': {
        const paths = Array.isArray(geometry.coordinates) ? [geometry.coordinates] : [];
        return {
          type: 'polyline',
          paths,
          spatialReference: { wkid: 4326 }
        };
      }
      case 'polygon': {
        const rings = geometry.coordinates || [];
        return {
          type: 'polygon',
          rings,
          spatialReference: { wkid: 4326 }
        };
      }
      default:
        return geometry;
    }
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


