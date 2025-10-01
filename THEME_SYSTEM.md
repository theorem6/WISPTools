# Centralized Theme System Documentation

## Overview

The PCI Mapper application features a comprehensive, centralized CSS theming system that supports:
- 🌞 **Light Mode**: Clean, bright interface
- 🌙 **Dark Mode**: Easy on the eyes for low-light environments
- 💻 **System Mode**: Automatically follows OS theme preference

## Architecture

```
┌──────────────────────────────────────────────────┐
│        Theme Switcher Component (UI)             │
│     - User selects: Light / Dark / System        │
└────────────────┬─────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────┐
│          Theme Store (State Management)           │
│  - Manages theme mode and resolved theme         │
│  - Persists user preference to localStorage      │
│  - Listens to system theme changes               │
└────────────────┬─────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────┐
│         Theme Manager (DOM Application)           │
│  - Applies data-theme attribute to <html>        │
│  - Updates CSS custom properties                 │
│  - Syncs with ArcGIS map theme                   │
└──────────────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────┐
│           Theme CSS (Styling Layer)               │
│  - Centralized CSS variables for all colors      │
│  - Light and dark color schemes                  │
│  - Smooth transitions between themes             │
└──────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── lib/
│   ├── stores/
│   │   └── themeStore.ts           # Theme state management
│   └── components/
│       └── ThemeSwitcher.svelte    # Theme picker UI
├── routes/
│   └── +layout.svelte              # Theme initialization
└── styles/
    └── theme.css                   # Centralized theme variables
```

## Key Features

### 1. **Theme Modes**

- **Light Mode**: Explicit light theme
- **Dark Mode**: Explicit dark theme
- **System Mode**: Follows OS preference and updates automatically

### 2. **State Management**

Theme state is managed through a Svelte store (`themeStore`):

```typescript
interface ThemeState {
  mode: 'light' | 'dark' | 'system';    // User preference
  resolved: 'light' | 'dark';            // Actual theme applied
  systemPreference: 'light' | 'dark';    // OS preference
}
```

### 3. **Persistence**

User's theme preference is saved to `localStorage` and restored on page load.

### 4. **System Integration**

Automatically detects and responds to OS theme changes using the `prefers-color-scheme` media query.

## Usage Guide

### Using the Theme Switcher Component

```svelte
<script>
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
</script>

<ThemeSwitcher />
```

The component displays a dropdown with three options:
- ☀️ Light
- 🌙 Dark
- 💻 System

### Programmatic Theme Control

```typescript
import { themeStore, setTheme, toggleTheme } from '$lib/stores/themeStore';

// Set specific theme mode
setTheme('light');    // Light mode
setTheme('dark');     // Dark mode
setTheme('system');   // System mode

// Toggle between light and dark (skips system)
toggleTheme();

// Subscribe to theme changes
themeStore.subscribe(state => {
  console.log('Theme mode:', state.mode);
  console.log('Resolved theme:', state.resolved);
});
```

### Using Derived Stores

```svelte
<script>
  import { isDarkMode, isLightMode, isSystemMode } from '$lib/stores/themeStore';
</script>

{#if $isDarkMode}
  <p>Dark mode is active</p>
{/if}

{#if $isSystemMode}
  <p>Following system preference</p>
{/if}
```

## CSS Variables Reference

### Color Variables

All colors are defined as CSS custom properties in `theme.css`:

#### Background Colors
```css
--bg-primary        /* Main background */
--bg-secondary      /* Secondary background */
--bg-tertiary       /* Tertiary background */
--bg-elevated       /* Elevated surfaces */
--bg-overlay        /* Modal overlays */
```

#### Text Colors
```css
--text-primary      /* Primary text */
--text-secondary    /* Secondary text */
--text-tertiary     /* Tertiary text */
--text-disabled     /* Disabled text */
--text-inverse      /* Inverse text (on dark backgrounds) */
--text-link         /* Link text */
```

#### Border Colors
```css
--border-color      /* Default border */
--border-hover      /* Hover state border */
--border-focus      /* Focus state border */
--border-error      /* Error state border */
```

#### Component Colors
```css
--card-bg           /* Card background */
--card-border       /* Card border */
--input-bg          /* Input background */
--button-primary-bg /* Primary button background */
```

#### Semantic Colors
```css
--primary-color     /* Primary accent */
--success-color     /* Success state */
--warning-color     /* Warning state */
--danger-color      /* Danger/error state */
--info-color        /* Info state */
```

### Using CSS Variables

```css
.my-component {
  background: var(--card-bg);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  padding: var(--spacing-md);
  box-shadow: var(--shadow-md);
  transition: var(--transition);
}

.my-component:hover {
  background: var(--hover-bg);
  box-shadow: var(--shadow-lg);
}
```

### Spacing Variables

```css
--spacing-xs        /* 0.25rem (4px) */
--spacing-sm        /* 0.5rem (8px) */
--spacing-md        /* 1rem (16px) */
--spacing-lg        /* 1.5rem (24px) */
--spacing-xl        /* 2rem (32px) */
--spacing-2xl       /* 3rem (48px) */
--spacing-3xl       /* 4rem (64px) */
```

### Typography Variables

```css
--font-sans         /* Sans-serif font stack */
--font-mono         /* Monospace font stack */

--font-size-xs      /* 0.75rem */
--font-size-sm      /* 0.875rem */
--font-size-base    /* 1rem */
--font-size-lg      /* 1.125rem */
--font-size-xl      /* 1.25rem */

--font-weight-normal    /* 400 */
--font-weight-medium    /* 500 */
--font-weight-semibold  /* 600 */
--font-weight-bold      /* 700 */
```

### Border Radius Variables

```css
--border-radius-sm   /* 0.25rem */
--border-radius      /* 0.5rem */
--border-radius-md   /* 0.75rem */
--border-radius-lg   /* 1rem */
--border-radius-xl   /* 1.5rem */
--border-radius-full /* 9999px (fully rounded) */
```

### Shadow Variables

```css
--shadow-xs         /* Minimal shadow */
--shadow-sm         /* Small shadow */
--shadow-md         /* Medium shadow */
--shadow-lg         /* Large shadow */
--shadow-xl         /* Extra large shadow */
--shadow-2xl        /* 2X large shadow */
```

### Transition Variables

```css
--transition-fast   /* 150ms cubic-bezier(0.4, 0, 0.2, 1) */
--transition        /* 200ms cubic-bezier(0.4, 0, 0.2, 1) */
--transition-slow   /* 300ms cubic-bezier(0.4, 0, 0.2, 1) */
```

## Theme Customization

### Modifying Light Mode Colors

Edit `src/styles/theme.css`:

```css
:root {
  --primary-color: #your-color;
  --bg-primary: #your-background;
  /* ... other variables */
}
```

### Modifying Dark Mode Colors

Edit the dark theme section:

```css
[data-theme="dark"] {
  --primary-color: #your-dark-color;
  --bg-primary: #your-dark-background;
  /* ... other variables */
}
```

### Adding New Theme Variables

1. Add to both light and dark sections in `theme.css`
2. Use consistent naming: `--category-property`
3. Document the variable purpose

Example:
```css
/* Light mode */
:root {
  --sidebar-bg: #f8fafc;
  --sidebar-text: #0f172a;
}

/* Dark mode */
[data-theme="dark"] {
  --sidebar-bg: #1e293b;
  --sidebar-text: #f8fafc;
}
```

## Best Practices

### 1. **Always Use CSS Variables**

✅ **Good:**
```css
.button {
  background: var(--primary-color);
  color: var(--text-inverse);
}
```

❌ **Bad:**
```css
.button {
  background: #3b82f6;
  color: white;
}
```

### 2. **Use Semantic Variables**

✅ **Good:**
```css
.success-message {
  background: var(--success-light);
  color: var(--success-color);
}
```

❌ **Bad:**
```css
.success-message {
  background: var(--primary-100);
  color: var(--primary-600);
}
```

### 3. **Respect Theme Transitions**

```css
.animated-element {
  background: var(--card-bg);
  color: var(--text-primary);
  transition: background var(--transition), color var(--transition);
}
```

### 4. **Test in Both Themes**

Always test your UI changes in both light and dark modes to ensure proper contrast and readability.

### 5. **Use Spacing Variables**

✅ **Good:**
```css
.container {
  padding: var(--spacing-lg);
  gap: var(--spacing-md);
}
```

❌ **Bad:**
```css
.container {
  padding: 24px;
  gap: 16px;
}
```

## Integration with Existing Components

### Updating Legacy CSS

If you have hardcoded colors in existing components:

**Before:**
```css
.my-component {
  background: #ffffff;
  color: #000000;
  border: 1px solid #e5e7eb;
}
```

**After:**
```css
.my-component {
  background: var(--card-bg);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}
```

## Accessibility

The theme system includes accessibility features:

### Color Contrast

All color combinations meet WCAG AA standards for contrast ratios:
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum

### Reduced Motion

Respects user's motion preferences:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Focus Indicators

Clear focus states for keyboard navigation:

```css
:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
```

## Troubleshooting

### Theme Not Changing

1. Check browser console for errors
2. Verify `theme.css` is imported in layout
3. Clear localStorage: `localStorage.removeItem('theme-mode')`
4. Hard refresh browser (Ctrl+Shift+R)

### Colors Not Updating

1. Ensure you're using CSS variables: `var(--variable-name)`
2. Check variable is defined in both light and dark sections
3. Verify no inline styles overriding the colors

### Flash of Wrong Theme

The theme is applied immediately on load. If you see a flash:
1. Theme initialization happens in `+layout.svelte`
2. Ensure theme manager is initialized in `onMount`
3. Check localStorage is accessible

### System Theme Not Detected

1. Check browser supports `prefers-color-scheme`
2. Verify OS theme settings are correct
3. Try switching to explicit light/dark first

## Performance

The theme system is optimized for performance:

- **CSS Variables**: Native browser feature, extremely fast
- **No JavaScript Recalculation**: Themes applied via CSS only
- **Minimal Bundle Size**: ~15KB for entire theme system
- **No Runtime Cost**: Theme switching is instant
- **Persisted Preference**: Instant load from localStorage

## Browser Support

The theme system supports all modern browsers:

- ✅ Chrome/Edge 88+
- ✅ Firefox 85+
- ✅ Safari 14+
- ✅ Opera 74+

Features gracefully degrade in older browsers:
- CSS variables fallback to light mode
- System theme detection skipped if not supported

## Future Enhancements

Potential improvements:

1. **Custom Themes**: Allow users to create custom color schemes
2. **Theme Preview**: Preview themes before applying
3. **Schedule**: Auto-switch themes based on time of day
4. **High Contrast Mode**: Additional accessibility theme
5. **Color Blind Modes**: Specialized palettes for color blindness
6. **Theme Export/Import**: Share themes between users

## Summary

The centralized theme system provides:

✅ **Three theme modes**: Light, Dark, and System  
✅ **Persistent preferences**: Saved to localStorage  
✅ **Automatic sync**: Follows OS theme changes  
✅ **Comprehensive variables**: 100+ CSS custom properties  
✅ **Smooth transitions**: Animated theme changes  
✅ **Accessible**: WCAG AA compliant  
✅ **Performant**: Native CSS with no runtime cost  
✅ **Easy to use**: Simple API for developers  

The theme system is production-ready and provides a professional theming experience for users while being easy to maintain and extend for developers.

