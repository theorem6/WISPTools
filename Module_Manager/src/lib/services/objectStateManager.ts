/**
 * Object State Management Service
 * Manages object permissions and states across different modules
 */

export interface ObjectState {
  id: string;
  type: 'tower' | 'sector' | 'cpe' | 'backhaul' | 'equipment' | 'noc' | 'warehouse' | 'vehicle';
  status: 'planning' | 'deployed' | 'active' | 'maintenance' | 'decommissioned';
  source: 'manual' | 'acs' | 'pci-optimized' | 'frequency-optimized' | 'imported';
  projectId?: string;
  isReadOnly: boolean;
  allowedActions: string[];
  restrictedActions: string[];
  hasIssues?: boolean;
}

export interface ModuleContext {
  module: 'plan' | 'deploy' | 'maintain' | 'coverage-map' | 'pci' | 'frequency';
  projectId?: string;
  userRole: 'admin' | 'operator' | 'viewer';
}

export class ObjectStateManager {
  private static instance: ObjectStateManager;
  
  public static getInstance(): ObjectStateManager {
    if (!ObjectStateManager.instance) {
      ObjectStateManager.instance = new ObjectStateManager();
    }
    return ObjectStateManager.instance;
  }

  /**
   * Get object permissions based on module context and object state
   */
  getObjectPermissions(object: any, context: ModuleContext): ObjectState {
    const state: ObjectState = {
      id: object.id,
      type: object.type || 'tower',
      status: this.determineObjectStatus(object),
      source: this.determineObjectSource(object),
      projectId: object.projectId,
      isReadOnly: false,
      allowedActions: [],
      restrictedActions: []
    };

    // Apply module-specific rules
    switch (context.module) {
      case 'plan':
        this.applyPlanModuleRules(state, context);
        break;
      case 'deploy':
        this.applyDeployModuleRules(state, context);
        break;
      case 'maintain':
        this.applyMaintainModuleRules(state, context);
        break;
      case 'pci':
      case 'frequency':
        this.applyOptimizationModuleRules(state, context);
        break;
      default:
        this.applyDefaultRules(state, context);
    }

    return state;
  }

  /**
   * Determine object status based on object properties
   */
  private determineObjectStatus(object: any): ObjectState['status'] {
    if (object.status) return object.status;
    if (object.projectId && !object.deployed) return 'planning';
    if (object.deployed) return 'deployed';
    if (object.active === false) return 'maintenance';
    return 'active';
  }

  /**
   * Determine object source based on object properties
   */
  private determineObjectSource(object: any): ObjectState['source'] {
    if (object.acsId || object.deviceId) return 'acs';
    if (object.pciOptimized) return 'pci-optimized';
    if (object.frequencyOptimized) return 'frequency-optimized';
    if (object.imported) return 'imported';
    return 'manual';
  }

  /**
   * Apply Plan module rules
   * Rule 1: All objects should be seen on the Plan map. Anything not in the planning stage and is in a project should be read-only.
   */
  private applyPlanModuleRules(state: ObjectState, context: ModuleContext): void {
    state.allowedActions = ['view', 'select'];
    
    // Objects in planning stage can be edited
    if (state.status === 'planning' && state.projectId === context.projectId) {
      state.allowedActions.push('edit', 'move', 'delete', 'add-sector', 'add-backhaul', 'add-equipment');
      state.isReadOnly = false;
    } else {
      // All other objects are read-only
      state.isReadOnly = true;
      state.restrictedActions = ['edit', 'move', 'delete', 'add-sector', 'add-backhaul', 'add-equipment'];
    }

    // ACS objects have special restrictions
    if (state.source === 'acs') {
      state.allowedActions = ['view', 'edit-gps', 'edit-customer'];
      state.restrictedActions = ['delete', 'move', 'edit-technical'];
    }
  }

  /**
   * Apply Deploy module rules
   * Rule 2: All objects in the deploy stage should be in a similar state, but once deployed move to read-only on the Plan map.
   */
  private applyDeployModuleRules(state: ObjectState, context: ModuleContext): void {
    state.allowedActions = ['view', 'select'];
    
    // Objects in deploy stage can be managed
    if (state.status === 'planning' && state.projectId === context.projectId) {
      state.allowedActions.push('deploy', 'configure', 'test');
      state.isReadOnly = false;
    } else if (state.status === 'deployed') {
      // Deployed objects become read-only
      state.isReadOnly = true;
      state.restrictedActions = ['edit', 'move', 'delete'];
    } else {
      state.isReadOnly = true;
      state.restrictedActions = ['edit', 'move', 'delete', 'deploy'];
    }

    // ACS objects have special restrictions
    if (state.source === 'acs') {
      state.allowedActions = ['view', 'edit-gps', 'edit-customer'];
      state.restrictedActions = ['delete', 'move', 'edit-technical'];
    }
  }

  /**
   * Apply Maintain module rules
   * Rule 5: Maintain should have a map showing ongoing issues and the fix state.
   */
  private applyMaintainModuleRules(state: ObjectState, context: ModuleContext): void {
    state.allowedActions = ['view', 'select'];
    
    // Objects with maintenance issues can be managed
    if (state.status === 'maintenance' || state.hasIssues) {
      state.allowedActions.push('fix', 'repair', 'update-status', 'create-work-order');
      state.isReadOnly = false;
    } else {
      state.isReadOnly = true;
      state.restrictedActions = ['edit', 'move', 'delete'];
    }

    // ACS objects have special restrictions
    if (state.source === 'acs') {
      state.allowedActions = ['view', 'edit-gps', 'edit-customer', 'create-work-order'];
      state.restrictedActions = ['delete', 'move', 'edit-technical'];
    }
  }

  /**
   * Apply PCI/Frequency optimization module rules
   * Rule 4: Objects subjected to pci and frequency conflict resolution should be able to be changed by the algorithms but not moved or deleted.
   */
  private applyOptimizationModuleRules(state: ObjectState, context: ModuleContext): void {
    state.allowedActions = ['view', 'select'];
    
    // Objects can be optimized by algorithms
    if (state.source === 'pci-optimized' || state.source === 'frequency-optimized') {
      state.allowedActions.push('optimize', 'recalculate', 'apply-changes');
      state.restrictedActions = ['move', 'delete'];
      state.isReadOnly = false;
    } else {
      state.allowedActions.push('optimize', 'analyze');
      state.isReadOnly = false;
    }

    // ACS objects have special restrictions
    if (state.source === 'acs') {
      state.allowedActions = ['view', 'analyze'];
      state.restrictedActions = ['optimize', 'move', 'delete', 'edit'];
    }
  }

  /**
   * Apply default rules for other modules
   */
  private applyDefaultRules(state: ObjectState, context: ModuleContext): void {
    state.allowedActions = ['view', 'select'];
    
    // Admin can do everything
    if (context.userRole === 'admin') {
      state.allowedActions.push('edit', 'move', 'delete', 'add-sector', 'add-backhaul', 'add-equipment', 'add-epc', 'deploy-epc', 'register-hss');
      state.isReadOnly = false;
    } else if (context.userRole === 'operator') {
      state.allowedActions.push('edit', 'add-sector', 'add-backhaul', 'add-equipment');
      state.restrictedActions = ['delete'];
      state.isReadOnly = false;
    } else {
      // Viewer can only view
      state.isReadOnly = true;
      state.restrictedActions = ['edit', 'move', 'delete', 'add-sector', 'add-backhaul', 'add-equipment'];
    }

    // ACS objects have special restrictions
    if (state.source === 'acs') {
      state.allowedActions = ['view', 'edit-gps', 'edit-customer'];
      state.restrictedActions = ['delete', 'move', 'edit-technical'];
    }
  }

  /**
   * Check if an action is allowed on an object
   */
  isActionAllowed(object: any, action: string, context: ModuleContext): boolean {
    const permissions = this.getObjectPermissions(object, context);
    return permissions.allowedActions.includes(action);
  }

  /**
   * Get restricted actions for an object
   */
  getRestrictedActions(object: any, context: ModuleContext): string[] {
    const permissions = this.getObjectPermissions(object, context);
    return permissions.restrictedActions;
  }

  /**
   * Check if an object is read-only
   */
  isReadOnly(object: any, context: ModuleContext): boolean {
    const permissions = this.getObjectPermissions(object, context);
    return permissions.isReadOnly;
  }

  /**
   * Update object status after deployment
   */
  updateObjectStatus(object: any, newStatus: ObjectState['status']): any {
    return {
      ...object,
      status: newStatus,
      deployed: newStatus === 'deployed',
      deployedAt: newStatus === 'deployed' ? new Date().toISOString() : object.deployedAt
    };
  }

  /**
   * Mark object as optimized by PCI/Frequency algorithms
   */
  markAsOptimized(object: any, optimizationType: 'pci' | 'frequency'): any {
    return {
      ...object,
      [`${optimizationType}Optimized`]: true,
      [`${optimizationType}OptimizedAt`]: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const objectStateManager = ObjectStateManager.getInstance();
