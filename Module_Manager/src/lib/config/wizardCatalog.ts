/**
 * All wizard entries for the global Wizards pulldown and /wizards page.
 * Paths use only the 6 main modules (Plan, Deploy, Monitor, Maintain, Customers, Hardware);
 * ACS, CBRS, HSS, Work Orders, PCI Resolution, Inventory, etc. are tabs under those modules.
 */
export interface WizardCatalogEntry {
  id: string;
  label: string;
  icon: string;
  path: string;
}

/** The 6 main modules (dashboard). All wizards are assigned to one of these. */
export const MAIN_MODULE_PATHS = [
  '/modules/plan',
  '/modules/deploy',
  '/modules/monitor',
  '/modules/maintain',
  '/modules/customers',
  '/modules/hardware'
] as const;

export const ALL_WIZARDS: WizardCatalogEntry[] = [
  { id: 'first-time-setup', label: 'First-Time Setup', icon: '🚀', path: '/onboarding' },
  { id: 'organization-setup', label: 'Organization Setup', icon: '🏢', path: '/wizards' },
  { id: 'initial-configuration', label: 'Initial Configuration', icon: '⚙️', path: '/wizards' },
  // Plan
  { id: 'marketing-discovery', label: 'Marketing Discovery', icon: '📍', path: '/modules/plan' },
  // Deploy (includes PCI Resolution, ACS, CBRS, Work Orders as tabs)
  { id: 'site-deployment', label: 'Add Site', icon: '📍', path: '/modules/deploy' },
  { id: 'deploy-equipment', label: 'Deploy Equipment', icon: '📦', path: '/modules/deploy' },
  { id: 'pci-planner', label: 'PCI Planner', icon: '📊', path: '/modules/deploy' },
  { id: 'frequency-planner', label: 'Frequency Planner', icon: '📡', path: '/modules/deploy' },
  { id: 'conflict-resolution', label: 'Conflict Resolution (PCI)', icon: '📊', path: '/modules/deploy' },
  { id: 'pci-import', label: 'Import Wizard', icon: '📥', path: '/modules/deploy' },
  { id: 'acs-setup', label: 'ACS/TR-069 Setup', icon: '⚙️', path: '/modules/deploy' },
  { id: 'device-onboarding', label: 'Device Onboarding', icon: '👋', path: '/modules/deploy' },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: '🔧', path: '/modules/deploy' },
  { id: 'preset-creation', label: 'Preset Creation', icon: '⚙️', path: '/modules/deploy' },
  { id: 'bulk-operations', label: 'Bulk Operations', icon: '📦', path: '/modules/deploy' },
  { id: 'firmware-update', label: 'Firmware Update', icon: '💾', path: '/modules/deploy' },
  { id: 'device-registration', label: 'Device Registration (ACS)', icon: '📱', path: '/modules/deploy' },
  { id: 'cbrs-setup', label: 'CBRS Setup', icon: '📡', path: '/modules/deploy' },
  { id: 'cbrs-device-registration', label: 'CBRS Device Registration', icon: '📡', path: '/modules/deploy' },
  { id: 'work-order-creation', label: 'Work Order Creation', icon: '📋', path: '/modules/deploy' },
  // Monitor (includes Monitoring, HSS as tabs)
  { id: 'monitoring-setup', label: 'Monitoring Setup', icon: '📊', path: '/modules/monitor' },
  { id: 'subscriber-creation', label: 'Subscriber Creation', icon: '🔐', path: '/modules/monitor' },
  { id: 'bandwidth-plan', label: 'Bandwidth Plan', icon: '📶', path: '/modules/monitor' },
  { id: 'subscriber-group', label: 'Subscriber Group', icon: '📦', path: '/modules/monitor' },
  // Maintain – add wizards here when needed
  // Customers
  { id: 'customer-onboarding', label: 'Customer Onboarding', icon: '👋', path: '/modules/customers' },
  // Hardware (includes Inventory as tab)
  { id: 'inventory-checkin', label: 'Check-in Wizard', icon: '📦', path: '/modules/hardware' },
  { id: 'rma-tracking', label: 'Track RMA', icon: '📋', path: '/modules/hardware' },
  { id: 'epc-deployment', label: 'EPC Deployment', icon: '🔧', path: '/modules/hardware' },
];

/**
 * Get wizards for a module path (for ModuleWizardMenu). Use this so pulldowns stay in sync with the catalog.
 */
export function getWizardsForPath(modulePath: string): Array<{ id: string; label: string; icon: string }> {
  return ALL_WIZARDS.filter((w) => w.path === modulePath).map((w) => ({ id: w.id, label: w.label, icon: w.icon }));
}
