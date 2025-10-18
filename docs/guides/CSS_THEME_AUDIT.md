# CSS Theme Audit and Unification Plan

## 🚨 **Critical Issues Found:**

### 1. **Duplicate CSS Files**
- `Module_Manager/src/app.css` - Main theme file
- `Module_Manager/src/styles/theme.css` - Duplicate theme file
- **Conflict**: Different variable names and values

### 2. **Hardcoded Colors**
- **1,197 hardcoded colors** across 90 files
- Colors like `#3b82f6`, `#10b981`, `#ef4444` scattered throughout
- No consistent theming system

### 3. **Inconsistent Variable Names**
- `app.css`: `--primary-color`, `--bg-primary`
- `theme.css`: `--brand-primary`, `--bg-primary`
- Different naming conventions

## 🎯 **Unification Strategy:**

### Phase 1: Consolidate CSS Files
1. **Keep `app.css`** as the main theme file (more comprehensive)
2. **Remove `theme.css`** (duplicate)
3. **Update all imports** to use single CSS file

### Phase 2: Standardize Variables
```css
:root {
  /* Core Colors */
  --primary: #3b82f6;
  --primary-hover: #2563eb;
  --secondary: #64748b;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --info: #06b6d4;
  
  /* Backgrounds */
  --bg-primary: #f1f5f9;
  --bg-secondary: #e2e8f0;
  --bg-tertiary: #cbd5e1;
  --card-bg: #ffffff;
  
  /* Text */
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;
  
  /* Borders */
  --border-color: #cbd5e1;
  --border-light: #e2e8f0;
}

[data-theme="dark"] {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-tertiary: #334155;
  --card-bg: #1e293b;
  --text-primary: #f8fafc;
  --text-secondary: #cbd5e1;
  --text-muted: #94a3b8;
  --border-color: #334155;
  --border-light: #475569;
}
```

### Phase 3: Replace Hardcoded Colors
- Replace all `#3b82f6` with `var(--primary)`
- Replace all `#10b981` with `var(--success)`
- Replace all `#ef4444` with `var(--danger)`
- Replace all `#f59e0b` with `var(--warning)`

### Phase 4: Component Audit
- **ServiceStatus.svelte**: ✅ Already using CSS variables
- **Backend Management**: ✅ Already using CSS variables
- **ACS Components**: ❌ Many hardcoded colors
- **HSS Components**: ❌ Many hardcoded colors
- **CBRS Components**: ❌ Many hardcoded colors

## 📋 **Action Items:**

1. **Remove duplicate CSS file**
2. **Create unified variable system**
3. **Replace hardcoded colors in components**
4. **Test light/dark mode switching**
5. **Verify consistency across all pages**

## 🎨 **Expected Result:**
- ✅ Consistent light/dark mode across all pages
- ✅ Single source of truth for colors
- ✅ Easy theme customization
- ✅ Better maintainability
