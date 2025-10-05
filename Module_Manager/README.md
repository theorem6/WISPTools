# LTE WISP Management Platform - Module Manager

The main landing page and module orchestration system for the LTE WISP Management Platform.

## 🎯 Overview

The Module Manager serves as:
- **Landing Page** - Professional dashboard for accessing all modules
- **Theme System** - Unified design system across all modules
- **Module Orchestration** - Coordinates between independent module forks
- **Navigation Hub** - Central access point for all platform features

## 🚀 Getting Started

### Installation

```bash
cd Module_Manager
npm install
```

### Development

```bash
npm run dev
```

Visit `http://localhost:5173` to see the landing page.

### Build

```bash
npm run build
npm run preview
```

## 📦 Current Modules

### Active Modules

1. **PCI Resolution** (`/modules/pci-resolution`)
   - Physical Cell ID conflict detection and optimization
   - Integrates the PCI fork
   - Status: Active ✅

### Coming Soon

2. **Coverage Planning** (`/modules/coverage-planning`)
   - RF coverage analysis and site planning
   - Status: In Development 🚧

3. **Spectrum Management** (`/modules/spectrum-management`)
   - Frequency planning and interference analysis
   - Status: Planned 📋

4. **Network Optimization** (`/modules/network-optimization`)
   - SON/CSON algorithms for network self-optimization
   - Status: Planned 📋

## 🎨 Theme System

### Shared Theme

The platform uses a consistent theme defined in `src/styles/theme.css`:

- **Brand Colors**: Primary blue (#2563eb), Secondary purple (#7c3aed)
- **Dark Mode**: Full dark mode support with automatic persistence
- **Module Colors**: Each module has a unique accent color
- **Consistent Components**: Buttons, cards, inputs styled uniformly

### Theme Variables

```css
--brand-primary: #2563eb
--brand-secondary: #7c3aed
--brand-accent: #10b981

--module-pci: #2563eb
--module-coverage: #10b981
--module-spectrum: #7c3aed
--module-network: #f59e0b
```

### Using the Theme

All modules should import the shared theme:

```svelte
<script>
  import '../styles/theme.css';
</script>
```

## 🏗️ Architecture

### File Structure

```
Module_Manager/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte          # Root layout (imports theme)
│   │   ├── +page.svelte             # Landing page
│   │   └── modules/
│   │       └── pci-resolution/
│   │           └── +page.svelte     # PCI module page
│   ├── styles/
│   │   └── theme.css                # Shared theme system
│   └── app.html                     # HTML template
├── package.json
├── svelte.config.js
├── vite.config.ts
└── tsconfig.json
```

### Module Integration Pattern

Each module follows this pattern:

1. **Route**: `/modules/[module-name]/+page.svelte`
2. **Theme Import**: Use shared theme CSS
3. **Navigation**: Back button to dashboard
4. **Module Header**: Consistent header with icon and title
5. **Content Area**: Module-specific functionality

## 🔗 Integration with Forks

### Fork Structure

```
Downloads/
├── Module_Manager/      # This project (main landing page)
├── PCI/                # PCI algorithms and logic
├── Login_Logic/        # Authentication and database
├── ARCGIS/            # Map visualization
└── ACS/               # Legacy main application (being replaced)
```

### How Modules Load

1. User clicks module card on landing page
2. Navigation to `/modules/[module-name]`
3. Module page loads with shared theme
4. Module-specific logic from fork is integrated
5. Consistent UX maintained across all modules

## 🎯 Adding a New Module

### 1. Create Module Route

```bash
mkdir -p src/routes/modules/your-module
touch src/routes/modules/your-module/+page.svelte
```

### 2. Add Module Definition

Edit `src/routes/+page.svelte`:

```typescript
const modules: Module[] = [
  // ... existing modules
  {
    id: 'your-module',
    name: 'Your Module Name',
    description: 'Module description',
    icon: '🎯',
    color: '#yourcolor',
    status: 'active',
    path: '/modules/your-module'
  }
];
```

### 3. Create Module Page

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  // Your module logic here
</script>

<div class="module-page">
  <!-- Use consistent module header -->
  <header class="module-header">
    <div class="container">
      <button on:click={() => goto('/')}>← Back</button>
      <h1>Your Module</h1>
    </div>
  </header>
  
  <!-- Your module content -->
</div>

<style>
  /* Use theme variables */
  .module-page {
    background-color: var(--bg-primary);
  }
</style>
```

## 🎨 Design Guidelines

### Colors

- Use theme variables, not hard-coded colors
- Each module has a unique accent color
- Maintain contrast for accessibility

### Typography

- Headers: Use `<h1>` through `<h6>` with theme font-weights
- Body: Use theme text colors (`--text-primary`, `--text-secondary`)
- Size: Responsive font sizes

### Components

- Cards: Use `.card` class from theme
- Buttons: Use `.btn-primary`, `.btn-secondary` classes
- Inputs: Styled automatically via theme

### Spacing

- Use consistent gaps: 1rem, 1.5rem, 2rem
- Padding: 1.5rem for cards, 2rem for sections
- Container: Max-width 1400px, centered

## 📊 Features

### Landing Page Features

- ✅ Module cards with status badges
- ✅ Hero section with platform stats
- ✅ Feature highlights
- ✅ Dark mode toggle with persistence
- ✅ Responsive design
- ✅ Smooth animations

### Theme System Features

- ✅ CSS custom properties (variables)
- ✅ Dark mode support
- ✅ Consistent colors across modules
- ✅ Unified component styling
- ✅ Accessibility-friendly contrast
- ✅ Responsive breakpoints

## 🔧 Configuration

### Environment Variables

Create `.env` file if needed:

```env
# Add any platform-wide environment variables here
PUBLIC_PLATFORM_NAME="LTE WISP Management Platform"
```

### Theme Customization

Edit `src/styles/theme.css` to customize:

- Brand colors
- Module colors
- Font families
- Spacing scales
- Border radius values

## 📚 Documentation

- [Project Reorganization](../PCI_mapper/PROJECT_REORGANIZATION.md)
- [Documentation Overview](../PCI_mapper/DOCUMENTATION_OVERVIEW.md)
- [Theme System](../PCI_mapper/THEME_SYSTEM.md)

## 🎯 Next Steps

1. **Integrate PCI Fork** - Connect actual PCI resolution logic
2. **Add Authentication** - Integrate Login_Logic fork
3. **Map Visualization** - Integrate ARCGIS fork
4. **Build New Modules** - Coverage planning, spectrum management
5. **User Settings** - Profile, preferences, themes
6. **Module Marketplace** - Allow users to enable/disable modules

## 🤝 Contributing

When adding new modules:

1. Follow the module integration pattern
2. Use shared theme variables
3. Maintain consistent UX
4. Document module-specific features
5. Test dark mode support

## 📈 Roadmap

- [x] Landing page design
- [x] Theme system
- [x] Module routing
- [x] PCI module placeholder
- [ ] Integrate PCI fork logic
- [ ] Add authentication
- [ ] Coverage planning module
- [ ] Spectrum management module
- [ ] Network optimization module

---

**Part of**: LTE WISP Management Platform
**Related Forks**: [PCI](../PCI) | [Login_Logic](../Login_Logic) | [ARCGIS](../ARCGIS)

