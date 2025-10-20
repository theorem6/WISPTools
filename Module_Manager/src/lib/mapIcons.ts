// Custom SVG Icons for Map Markers
// Used in Coverage Map for different location types

// NOC (Network Operations Center) - Building icon - Red
export const nocIcon = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <!-- Building base -->
  <rect x="12" y="20" width="40" height="40" fill="#ef4444" stroke="white" stroke-width="3"/>
  <!-- Windows row 1 -->
  <rect x="18" y="26" width="8" height="8" fill="white" opacity="0.8"/>
  <rect x="28" y="26" width="8" height="8" fill="white" opacity="0.8"/>
  <rect x="38" y="26" width="8" height="8" fill="white" opacity="0.8"/>
  <!-- Windows row 2 -->
  <rect x="18" y="36" width="8" height="8" fill="white" opacity="0.8"/>
  <rect x="28" y="36" width="8" height="8" fill="white" opacity="0.8"/>
  <rect x="38" y="36" width="8" height="8" fill="white" opacity="0.8"/>
  <!-- Windows row 3 -->
  <rect x="18" y="46" width="8" height="8" fill="white" opacity="0.8"/>
  <rect x="28" y="46" width="8" height="8" fill="white" opacity="0.8"/>
  <rect x="38" y="46" width="8" height="8" fill="white" opacity="0.8"/>
  <!-- Server icon on top -->
  <rect x="24" y="8" width="16" height="10" fill="#dc2626" stroke="white" stroke-width="2"/>
  <circle cx="28" cy="13" r="1.5" fill="white"/>
  <circle cx="36" cy="13" r="1.5" fill="white"/>
</svg>
`)}`;

// Warehouse - Storage building icon - Orange
export const warehouseIcon = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <!-- Warehouse roof -->
  <polygon points="32,8 8,24 56,24" fill="#f97316" stroke="white" stroke-width="3"/>
  <!-- Warehouse body -->
  <rect x="10" y="24" width="44" height="32" fill="#f59e0b" stroke="white" stroke-width="3"/>
  <!-- Large door -->
  <rect x="22" y="36" width="20" height="20" fill="#7c2d12" stroke="white" stroke-width="2"/>
  <!-- Door handle -->
  <circle cx="38" cy="46" r="2" fill="white"/>
  <!-- Roof detail -->
  <line x1="32" y1="8" x2="32" y2="24" stroke="white" stroke-width="2"/>
</svg>
`)}`;

// Vehicle - Truck icon - Green
export const vehicleIcon = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <!-- Truck cab -->
  <rect x="10" y="28" width="16" height="18" fill="#10b981" stroke="white" stroke-width="3"/>
  <!-- Truck bed/cargo -->
  <rect x="26" y="22" width="26" height="24" fill="#059669" stroke="white" stroke-width="3"/>
  <!-- Cab window -->
  <rect x="12" y="30" width="12" height="8" fill="#d1fae5" stroke="white" stroke-width="1"/>
  <!-- Wheels -->
  <circle cx="18" cy="48" r="6" fill="#1f2937" stroke="white" stroke-width="2"/>
  <circle cx="18" cy="48" r="3" fill="#6b7280"/>
  <circle cx="44" cy="48" r="6" fill="#1f2937" stroke="white" stroke-width="2"/>
  <circle cx="44" cy="48" r="3" fill="#6b7280"/>
  <!-- Headlight -->
  <rect x="8" y="34" width="2" height="4" fill="#fef3c7"/>
</svg>
`)}`;

// RMA Center - Wrench/Tools icon - Dark Orange
export const rmaIcon = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <!-- Toolbox base -->
  <rect x="14" y="30" width="36" height="24" fill="#f97316" stroke="white" stroke-width="3" rx="2"/>
  <!-- Toolbox top -->
  <rect x="16" y="26" width="32" height="6" fill="#ea580c" stroke="white" stroke-width="2" rx="1"/>
  <!-- Handle -->
  <path d="M 26 26 Q 32 18 38 26" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"/>
  <!-- Wrench -->
  <g transform="translate(20, 36)">
    <rect x="0" y="4" width="3" height="12" fill="white" stroke="#dc2626" stroke-width="1"/>
    <circle cx="1.5" cy="3" r="3" fill="white" stroke="#dc2626" stroke-width="1"/>
  </g>
  <!-- Screwdriver -->
  <g transform="translate(34, 36)">
    <rect x="0" y="6" width="2" height="10" fill="white" stroke="#dc2626" stroke-width="1"/>
    <polygon points="0,6 2,6 1.5,2 0.5,2" fill="#fef3c7" stroke="#dc2626" stroke-width="1"/>
  </g>
</svg>
`)}`;

// Vendor - Store icon - Indigo
export const vendorIcon = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <!-- Store awning -->
  <path d="M 8 24 L 12 16 L 52 16 L 56 24 Z" fill="#6366f1" stroke="white" stroke-width="3"/>
  <!-- Store front -->
  <rect x="12" y="24" width="40" height="30" fill="#818cf8" stroke="white" stroke-width="3"/>
  <!-- Door -->
  <rect x="26" y="36" width="12" height="18" fill="#4338ca" stroke="white" stroke-width="2"/>
  <!-- Window -->
  <rect x="16" y="28" width="10" height="10" fill="#c7d2fe" stroke="white" stroke-width="1"/>
  <rect x="38" y="28" width="10" height="10" fill="#c7d2fe" stroke="white" stroke-width="1"/>
  <!-- Door handle -->
  <circle cx="35" cy="45" r="1.5" fill="white"/>
</svg>
`)}`;

// Helper function to create picture marker symbol
export function createLocationIcon(type: string, size: number = 40): any {
  const iconMap: Record<string, string> = {
    'noc': nocIcon,
    'warehouse': warehouseIcon,
    'vehicle': vehicleIcon,
    'rma': rmaIcon,
    'vendor': vendorIcon
  };
  
  const iconUrl = iconMap[type];
  
  if (!iconUrl) {
    return null; // Use default marker
  }
  
  return {
    url: iconUrl,
    width: `${size}px`,
    height: `${size}px`
  };
}

