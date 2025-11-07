export type MapModuleMode = 'plan' | 'deploy' | 'monitor';

export interface MapCapabilities {
  mode: MapModuleMode;
  canAddTemporary: boolean;
  canEditTemporary: boolean;
  canDeleteTemporary: boolean;
  canApprove: boolean;
  canAssignTasks: boolean;
  canMarkProgress: boolean;
  readOnly: boolean;
}

export const DEFAULT_CAPABILITIES: Record<MapModuleMode, MapCapabilities> = {
  plan: {
    mode: 'plan',
    canAddTemporary: true,
    canEditTemporary: true,
    canDeleteTemporary: true,
    canApprove: true,
    canAssignTasks: false,
    canMarkProgress: false,
    readOnly: false
  },
  deploy: {
    mode: 'deploy',
    canAddTemporary: false,
    canEditTemporary: false,
    canDeleteTemporary: false,
    canApprove: false,
    canAssignTasks: true,
    canMarkProgress: true,
    readOnly: false
  },
  monitor: {
    mode: 'monitor',
    canAddTemporary: false,
    canEditTemporary: false,
    canDeleteTemporary: false,
    canApprove: false,
    canAssignTasks: false,
    canMarkProgress: false,
    readOnly: true
  }
};

export function getCapabilitiesForMode(mode: MapModuleMode): MapCapabilities {
  return DEFAULT_CAPABILITIES[mode];
}


