/**
 * All wizard entries for the global Wizards pulldown and /wizards page.
 * Keep in sync with actual wizard components in lib/components/wizards/index.ts
 */
export interface WizardCatalogEntry {
  id: string;
  label: string;
  icon: string;
  path: string;
}

export const ALL_WIZARDS: WizardCatalogEntry[] = [
  { id: 'first-time-setup', label: 'First-Time Setup', icon: '🚀', path: '/onboarding' },
  { id: 'organization-setup', label: 'Organization Setup', icon: '🏢', path: '/wizards' },
  { id: 'initial-configuration', label: 'Initial Configuration', icon: '⚙️', path: '/wizards' },
  { id: 'site-deployment', label: 'Add Site', icon: '📍', path: '/modules/deploy' },
  { id: 'deploy-equipment', label: 'Deploy Equipment', icon: '📦', path: '/modules/deploy' },
  { id: 'acs-setup', label: 'ACS/TR-069 Setup', icon: '⚙️', path: '/modules/acs-cpe-management' },
  { id: 'device-onboarding', label: 'Device Onboarding', icon: '👋', path: '/modules/acs-cpe-management' },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: '🔧', path: '/modules/acs-cpe-management' },
  { id: 'preset-creation', label: 'Preset Creation', icon: '⚙️', path: '/modules/acs-cpe-management' },
  { id: 'bulk-operations', label: 'Bulk Operations', icon: '📦', path: '/modules/acs-cpe-management' },
  { id: 'firmware-update', label: 'Firmware Update', icon: '💾', path: '/modules/acs-cpe-management' },
  { id: 'device-registration', label: 'Device Registration (ACS)', icon: '📱', path: '/modules/acs-cpe-management' },
  { id: 'cbrs-setup', label: 'CBRS Setup', icon: '📡', path: '/modules/cbrs-management' },
  { id: 'cbrs-device-registration', label: 'CBRS Device Registration', icon: '📡', path: '/modules/cbrs-management' },
  { id: 'work-order-creation', label: 'Work Order Creation', icon: '📋', path: '/modules/work-orders' },
  { id: 'subscriber-creation', label: 'Subscriber Creation', icon: '🔐', path: '/modules/hss-management' },
  { id: 'bandwidth-plan', label: 'Bandwidth Plan', icon: '📶', path: '/modules/hss-management' },
  { id: 'subscriber-group', label: 'Subscriber Group', icon: '📦', path: '/modules/hss-management' },
  { id: 'customer-onboarding', label: 'Customer Onboarding', icon: '👋', path: '/modules/customers' },
  { id: 'inventory-checkin', label: 'Check-in Wizard', icon: '📦', path: '/modules/inventory' },
  { id: 'rma-tracking', label: 'Track RMA', icon: '📋', path: '/modules/inventory' },
  { id: 'monitoring-setup', label: 'Monitoring Setup', icon: '📊', path: '/modules/monitoring' },
  { id: 'conflict-resolution', label: 'Conflict Resolution (PCI)', icon: '📊', path: '/modules/pci-resolution' },
  { id: 'epc-deployment', label: 'EPC Deployment', icon: '🔧', path: '/modules/hardware' },
];
