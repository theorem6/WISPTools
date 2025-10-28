import type { TowerSite, Sector, CPEDevice, NetworkEquipment } from './models';

export interface TowerActionContext {
  tower: TowerSite;
  action: string;
}

export interface ActionHandlers {
  onAddSector: (tower: TowerSite) => void;
  onAddBackhaul: (tower: TowerSite) => void;
  onAddInventory: (tower: TowerSite) => void;
  onViewInventory: (tower: TowerSite) => void;
  onDeployHardware: (tower: TowerSite) => void;
  onEditSite: () => void;
  onChangeSiteType: () => void;
  onViewDetails: (tower: TowerSite) => void;
  onDeleteSite: (tower: TowerSite) => void;
}

/**
 * Handle tower action events
 * Centralizes all tower action handling logic
 */
export function handleTowerAction(
  event: CustomEvent,
  handlers: ActionHandlers
): void {
  const { action, tower } = event.detail as TowerActionContext;
  
  // Guard: ensure tower exists
  if (!tower) {
    console.error('Tower action called without tower');
    return;
  }
  
  switch (action) {
    case 'edit-site':
      handlers.onEditSite();
      break;
      
    case 'add-sector':
      handlers.onAddSector(tower);
      break;
      
    case 'add-backhaul':
      handlers.onAddBackhaul(tower);
      break;
      
    case 'add-inventory':
      handlers.onAddInventory(tower);
      break;
      
    case 'view-inventory':
      handlers.onViewInventory(tower);
      break;
      
    case 'deploy-hardware':
      handlers.onDeployHardware(tower);
      break;
      
    case 'change-site-type':
      handlers.onChangeSiteType();
      break;
      
    case 'view-details':
      handlers.onViewDetails(tower);
      break;
      
    case 'delete-site':
      handlers.onDeleteSite(tower);
      break;
      
    default:
      console.warn(`Unknown action: ${action}`);
  }
}

