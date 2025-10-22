# Frontend Component Documentation

## Overview

The LTE WISP Management Platform frontend is built with SvelteKit and features a modular component architecture. Components are organized by domain and functionality for better maintainability and developer experience.

## Component Architecture

### Directory Structure

```
src/lib/components/
├── common/                    # Reusable common components
│   ├── ActionsDropdown.svelte
│   ├── ActionsModal.svelte
│   ├── APKDownload.svelte
│   ├── DarkModeToggle.svelte
│   ├── ThemeSwitcher.svelte
│   └── Tooltip.svelte
├── forms/                     # Form-related components
│   ├── CellEditor.svelte
│   ├── ImportWizard.svelte
│   ├── ManualImport.svelte
│   ├── SiteEditor.svelte
│   └── site-editor/
│       ├── SectorEditor.svelte
│       ├── SectorList.svelte
│       └── SiteForm.svelte
├── navigation/                # Navigation components
│   ├── SettingsMenu.svelte
│   ├── TopBrand.svelte
│   └── VerticalMenu.svelte
├── data-display/              # Data visualization components
│   ├── Chart.svelte
│   ├── ConflictReportExport.svelte
│   └── PCIStatusWidget.svelte
├── maps/                      # Map and geographic components
│   ├── BasemapSwitcher.svelte
│   ├── NetworkManager.svelte
│   ├── NetworkSelector.svelte
│   └── TowerManager.svelte
├── pci/                       # PCI resolution specific components
│   ├── AnalysisModal.svelte
│   ├── ConflictsModal.svelte
│   ├── ContextMenu.svelte
│   ├── OptimizationResultModal.svelte
│   └── RecommendationsModal.svelte
├── acs/                       # ACS CPE management components
│   ├── CPEPerformanceModal.svelte
│   └── NokiaConfig.svelte
├── admin/                     # Administrative components
│   ├── TenantGuard.svelte
│   └── UserProfile.svelte
└── modals/                    # Modal dialog components
    ├── AuthModal.svelte
    └── HelpModal.svelte
```

## Component Categories

### Common Components
Reusable components used across multiple modules.

#### ActionsDropdown.svelte
- **Purpose**: Dropdown menu for action buttons
- **Props**: `actions`, `item`, `onAction`
- **Usage**: Used in tables and lists for item actions

#### ActionsModal.svelte
- **Purpose**: Modal for confirming actions
- **Props**: `title`, `message`, `onConfirm`, `onCancel`
- **Usage**: Confirmation dialogs for destructive actions

#### APKDownload.svelte
- **Purpose**: Android APK download component
- **Props**: `version`, `downloadUrl`
- **Usage**: Mobile app download functionality

#### DarkModeToggle.svelte
- **Purpose**: Dark/light mode toggle
- **Props**: None
- **Usage**: Theme switching in navigation

#### ThemeSwitcher.svelte
- **Purpose**: Theme selection component
- **Props**: `themes`, `currentTheme`, `onChange`
- **Usage**: Theme customization

#### Tooltip.svelte
- **Purpose**: Tooltip display component
- **Props**: `content`, `position`, `trigger`
- **Usage**: Help text and additional information

### Form Components
Components for data input and form handling.

#### CellEditor.svelte
- **Purpose**: Cell site data editing form
- **Props**: `cellData`, `onSave`, `onCancel`
- **Usage**: PCI resolution module for editing cell parameters

#### ImportWizard.svelte
- **Purpose**: Multi-step data import wizard
- **Props**: `importType`, `onComplete`
- **Usage**: Data import workflows

#### ManualImport.svelte
- **Purpose**: Manual data entry form
- **Props**: `fields`, `onSubmit`
- **Usage**: Manual data input

#### SiteEditor.svelte
- **Purpose**: Cell site editing interface
- **Props**: `siteData`, `onSave`, `onDelete`
- **Usage**: Site management and editing

#### Site Editor Subcomponents
- **SectorEditor.svelte**: Individual sector editing
- **SectorList.svelte**: List of sectors for a site
- **SiteForm.svelte**: Site information form

### Navigation Components
Components for application navigation and layout.

#### SettingsMenu.svelte
- **Purpose**: Settings and configuration menu
- **Props**: `settings`, `onChange`
- **Usage**: Application settings interface

#### TopBrand.svelte
- **Purpose**: Application branding header
- **Props**: `tenantName`, `logo`
- **Usage**: Top navigation branding

#### VerticalMenu.svelte
- **Purpose**: Vertical navigation menu
- **Props**: `items`, `currentPath`
- **Usage**: Side navigation menu

### Data Display Components
Components for visualizing and displaying data.

#### Chart.svelte
- **Purpose**: Data visualization charts
- **Props**: `data`, `type`, `options`
- **Usage**: Performance metrics and analytics

#### ConflictReportExport.svelte
- **Purpose**: Export conflict analysis reports
- **Props**: `conflicts`, `format`
- **Usage**: PCI conflict reporting

#### PCIStatusWidget.svelte
- **Purpose**: PCI status display widget
- **Props**: `status`, `counts`
- **Usage**: PCI resolution dashboard

### Map Components
Components for geographic and map functionality.

#### BasemapSwitcher.svelte
- **Purpose**: Map basemap selection
- **Props**: `basemaps`, `currentBasemap`, `onChange`
- **Usage**: Map interface controls

#### NetworkManager.svelte
- **Purpose**: Network topology management
- **Props**: `network`, `onUpdate`
- **Usage**: Network configuration interface

#### NetworkSelector.svelte
- **Purpose**: Network selection component
- **Props**: `networks`, `selected`, `onSelect`
- **Usage**: Network switching interface

#### TowerManager.svelte
- **Purpose**: Tower site management interface
- **Props**: `towers`, `onUpdate`
- **Usage**: Tower site management

### PCI Components
Components specific to PCI resolution functionality.

#### AnalysisModal.svelte
- **Purpose**: PCI analysis results modal
- **Props**: `analysis`, `onClose`
- **Usage**: Display PCI analysis results

#### ConflictsModal.svelte
- **Purpose**: PCI conflict details modal
- **Props**: `conflicts`, `onResolve`
- **Usage**: PCI conflict management

#### ContextMenu.svelte
- **Purpose**: Right-click context menu
- **Props**: `items`, `position`
- **Usage**: Map and table context actions

#### OptimizationResultModal.svelte
- **Purpose**: PCI optimization results display
- **Props**: `results`, `onApply`
- **Usage**: PCI optimization workflow

#### RecommendationsModal.svelte
- **Purpose**: PCI recommendations display
- **Props**: `recommendations`, `onAccept`
- **Usage**: PCI improvement suggestions

### ACS Components
Components for ACS CPE management.

#### CPEPerformanceModal.svelte
- **Purpose**: CPE performance monitoring modal
- **Props**: `deviceId`, `metrics`
- **Usage**: Device performance analysis

#### NokiaConfig.svelte
- **Purpose**: Nokia device configuration interface
- **Props**: `device`, `config`, `onSave`
- **Usage**: Nokia-specific device configuration

### Admin Components
Components for administrative functions.

#### TenantGuard.svelte
- **Purpose**: Tenant access control wrapper
- **Props**: `requireTenant`, `adminOnly`
- **Usage**: Route protection and access control

#### UserProfile.svelte
- **Purpose**: User profile management
- **Props**: `user`, `onUpdate`
- **Usage**: User account management

### Modal Components
Reusable modal dialog components.

#### AuthModal.svelte
- **Purpose**: Authentication modal dialog
- **Props**: `type`, `onSuccess`
- **Usage**: Login and authentication flows

#### HelpModal.svelte
- **Purpose**: Help and documentation modal
- **Props**: `content`, `title`
- **Usage**: Contextual help and documentation

## Component Usage Guidelines

### Importing Components

```typescript
// Import from organized directories
import ActionsDropdown from '$lib/components/common/ActionsDropdown.svelte';
import CellEditor from '$lib/components/forms/CellEditor.svelte';
import Chart from '$lib/components/data-display/Chart.svelte';
import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
```

### Component Props

All components follow consistent prop naming:
- **Data props**: `data`, `item`, `items`
- **Event props**: `onClick`, `onSave`, `onCancel`
- **Configuration props**: `options`, `settings`, `config`
- **State props**: `loading`, `disabled`, `visible`

### Styling

Components use CSS custom properties for theming:
```css
:root {
  --primary-color: #7c3aed;
  --secondary-color: #a855f7;
  --background-color: #ffffff;
  --text-color: #1f2937;
}
```

### Accessibility

All components include:
- ARIA labels and roles
- Keyboard navigation support
- Screen reader compatibility
- Focus management

## Best Practices

### 1. Component Organization
- Group related components in domain-specific directories
- Use descriptive component names
- Keep components focused on single responsibility

### 2. Props Design
- Use consistent prop naming conventions
- Provide default values where appropriate
- Document all props with JSDoc comments

### 3. Event Handling
- Use descriptive event handler names
- Emit events with meaningful data
- Handle errors gracefully

### 4. Performance
- Use Svelte's reactivity efficiently
- Implement proper key handling for lists
- Lazy load heavy components

### 5. Testing
- Write unit tests for component logic
- Test user interactions and events
- Verify accessibility compliance

## Migration from Legacy Structure

The component reorganization addresses:
- **Cursor IDE Performance**: Smaller directories improve IDE responsiveness
- **Developer Experience**: Easier to find and understand components
- **Maintainability**: Clear separation of concerns
- **Scalability**: Easy to add new components in appropriate categories

## Future Enhancements

1. **Component Library**: Create a comprehensive component library
2. **Storybook Integration**: Add Storybook for component documentation
3. **Automated Testing**: Implement component testing automation
4. **Design System**: Establish consistent design tokens
5. **Performance Monitoring**: Add component performance tracking
