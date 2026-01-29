# Wizard System Documentation

## Overview

The wizard system provides a comprehensive, user-friendly interface for guiding users through complex multi-step processes across the WISP Tools platform. The system consists of:

1. **BaseWizard** - Reusable base component for creating wizards
2. **Individual Wizards** - Feature-specific wizards for ACS operations
3. **ModuleWizardManager** - Centralized wizard orchestration

## Architecture

### BaseWizard Component

The `BaseWizard` component provides the common structure, navigation, and styling for all wizards. It handles:

- Step navigation (next/previous)
- Progress indicators
- Error/success messaging
- Keyboard shortcuts (Escape to close)
- Responsive layout

**Usage:**

```svelte
<script>
  import BaseWizard from '$lib/components/wizards/BaseWizard.svelte';
  
  let show = false;
  let currentStep = 0;
  const steps = [
    { id: 'step1', title: 'Step 1', icon: '📝' },
    { id: 'step2', title: 'Step 2', icon: '✅' }
  ];
</script>

<BaseWizard {show} title="My Wizard" {steps} {currentStep}>
  <div slot="content">
    <!-- Step content here -->
  </div>
  
  <div slot="footer" let:currentStep let:nextStep let:prevStep>
    <!-- Footer buttons -->
  </div>
</BaseWizard>
```

## Module Entry Points

Every wizard has at least one starting point in a module or the dashboard:

| Wizard | Module / Route | How to open |
|--------|-----------------|-------------|
| **FirstTimeSetupWizard** | Dashboard, `/onboarding` | Shown when onboarding not complete; or go to `/onboarding` |
| **MonitoringSetupWizard** | `/modules/monitoring` | "Get Started with Setup Wizard" button, empty-state CTA, or module-control wizard button |
| **ACSSetupWizard** | `/modules/acs-cpe-management` | "⚙️ Setup ACS" button, or empty-state "Run ACS Setup" |
| **CBRSSetupWizard** | `/modules/cbrs-management` | "Run Setup Wizard" (banner or toolbar), or DeviceList "Get Started" |
| **DeploymentWizard** | `/modules/deploy` | "Deploy Equipment Wizard" / deployment wizard trigger |
| **WorkOrderCreationWizard** | `/modules/work-orders` | "Create" button opens wizard |
| **InventoryCheckInWizard** | `/modules/inventory` | "Check in" button |
| **DeviceOnboardingWizard** | `/modules/acs-cpe-management` | "👋 Onboard Device" button |
| **TroubleshootingWizard** | `/modules/acs-cpe-management` | "🔍 Troubleshoot" button (when a device is selected) |
| **PresetCreationWizard** | `/modules/acs-cpe-management` | "🧙 More wizards" → "⚙️ Preset Creation" |
| **BulkOperationsWizard** | `/modules/acs-cpe-management` | "🧙 More wizards" → "📦 Bulk Operations" |
| **FirmwareUpdateWizard** | `/modules/acs-cpe-management` | "🧙 More wizards" → "💾 Firmware Update" |
| **DeviceRegistrationWizard** | `/modules/acs-cpe-management` | "🧙 More wizards" → "📱 Device Registration" |

## ACS Wizards

### Device Registration Wizard

**Purpose:** Guides users through registering CPE devices with GenieACS/TR-069.

**Features:**
- Manual device registration
- Bulk CSV import
- Auto-registration configuration
- Device information collection

**Usage:**

```svelte
<script>
  import { DeviceRegistrationWizard } from '$lib/components/wizards';
  
  let showWizard = false;
</script>

<DeviceRegistrationWizard bind:show={showWizard} />
```

### Preset Creation Wizard

**Purpose:** Guides users through creating TR-069 configuration presets.

**Features:**
- Preset name and description
- Configuration parameters
- Tags for organization
- Weight/priority settings

**Usage:**

```svelte
<script>
  import { PresetCreationWizard } from '$lib/components/wizards';
  
  let showWizard = false;
</script>

<PresetCreationWizard bind:show={showWizard} />
```

### Bulk Operations Wizard

**Purpose:** Guides users through performing bulk operations on multiple devices.

**Features:**
- Device selection
- Operation type selection (preset, reboot, refresh, firmware)
- Operation configuration
- Execution and results tracking

**Usage:**

```svelte
<script>
  import { BulkOperationsWizard } from '$lib/components/wizards';
  
  let showWizard = false;
  let selectedDevices = ['device1', 'device2'];
</script>

<BulkOperationsWizard bind:show={showWizard} {selectedDevices} />
```

### Firmware Update Wizard

**Purpose:** Guides users through updating firmware on CPE devices.

**Features:**
- Firmware file upload or URL
- Device selection
- Scheduling options (immediate, scheduled, maintenance window)
- Update progress tracking

**Usage:**

```svelte
<script>
  import { FirmwareUpdateWizard } from '$lib/components/wizards';
  
  let showWizard = false;
  let deviceIds = ['device1', 'device2'];
</script>

<FirmwareUpdateWizard bind:show={showWizard} {deviceIds} />
```

## Module Wizard Manager

The `ModuleWizardManager` provides centralized wizard orchestration for modules.

**Features:**
- Unified wizard launching interface
- Wizard state management
- Event dispatching
- Module-specific wizard registration

**Usage:**

```svelte
<script>
  import { ModuleWizardManager } from '$lib/components/wizards';
  
  let wizardManager: ModuleWizardManager;
  
  function openDeviceRegistration() {
    wizardManager.openWizard('device-registration');
  }
</script>

<ModuleWizardManager 
  bind:this={wizardManager}
  moduleId="acs"
/>
```

## Creating Custom Wizards

### Step 1: Create Wizard Component

Create a new Svelte component extending `BaseWizard`:

```svelte
<script lang="ts">
  import BaseWizard from '../BaseWizard.svelte';
  
  export let show = false;
  
  let currentStep = 0;
  const steps = [
    { id: 'welcome', title: 'Welcome', icon: '👋' },
    { id: 'configure', title: 'Configure', icon: '⚙️' },
    { id: 'complete', title: 'Complete', icon: '✅' }
  ];
  
  function handleClose() {
    show = false;
  }
</script>

<BaseWizard
  {show}
  title="My Custom Wizard"
  {steps}
  {currentStep}
  on:close={handleClose}
>
  <div slot="content">
    <!-- Your step content -->
  </div>
  
  <div slot="footer" let:currentStep let:nextStep let:prevStep>
    <!-- Footer buttons -->
  </div>
</BaseWizard>
```

### Step 2: Add to Module Wizard Manager

Register your wizard in the module's wizard manager:

```svelte
<script>
  import { ModuleWizardManager } from '$lib/components/wizards';
  import MyCustomWizard from './MyCustomWizard.svelte';
  
  const availableWizards = [
    {
      id: 'my-custom-wizard',
      name: 'My Custom Wizard',
      description: 'Does something cool',
      icon: '✨',
      component: MyCustomWizard
    }
  ];
</script>

<ModuleWizardManager 
  moduleId="my-module"
  {availableWizards}
/>
```

## Best Practices

1. **Step Validation:** Always validate step data before allowing navigation to the next step
2. **Error Handling:** Provide clear error messages and recovery options
3. **Loading States:** Show loading indicators during async operations
4. **Progress Feedback:** Keep users informed of progress and completion status
5. **Accessibility:** Ensure keyboard navigation and screen reader support
6. **Responsive Design:** Ensure wizards work on all screen sizes

## Styling

Wizards use the app’s global theme (see `app.css`, `lib/config/theme.css`). Prefer these variables so wizards stay readable in light and dark mode:

- `--text-primary`, `--text-secondary`, `--text-muted`, `--text-inverse` – text
- `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--card-bg`, `--input-bg`, `--hover-bg` – backgrounds
- `--border-color` – borders
- `--primary-color`, `--primary-hover` – primary actions; use `--text-inverse` for text on primary buttons
- `--success-color`, `--success-light` – success states
- `--danger-color`, `--danger-light` – errors/required (not `--error-color`)
- `--warning-color`, `--warning-light` – warnings
- `--info-color`, `--info-light` – info

Avoid hardcoded colors or light-only fallbacks (e.g. `#f9f9f9`, `#1a1a1a`).

## Events

Wizards dispatch the following events:

- `close` - Wizard closed
- `next` - Moved to next step
- `previous` - Moved to previous step
- `stepChange` - Step changed
- `complete` - Wizard completed

## Examples

See the ACS module (`Module_Manager/src/routes/modules/acs-cpe-management/`) for complete examples of wizard integration.
