/**
 * Theme CSS Variables Generator
 * Generates CSS custom properties from centralized theme configuration
 */

import { THEME } from './theme';

/**
 * Generate CSS variables string for injection into :root
 */
export function generateThemeCSS(): string {
  let css = ':root {\n';
  
  // Colors
  Object.entries(THEME.colors).forEach(([key, value]) => {
    if (typeof value === 'string') {
      css += `  --color-${key}: ${value};\n`;
    } else if (typeof value === 'object' && value !== null) {
      Object.entries(value).forEach(([subKey, subValue]) => {
        css += `  --color-${key}-${subKey}: ${subValue};\n`;
      });
    }
  });
  
  // Spacing
  Object.entries(THEME.spacing).forEach(([key, value]) => {
    css += `  --spacing-${key}: ${value};\n`;
  });
  
  // Border radius
  Object.entries(THEME.borderRadius).forEach(([key, value]) => {
    css += `  --radius-${key}: ${value};\n`;
  });
  
  // Shadows
  Object.entries(THEME.shadows).forEach(([key, value]) => {
    css += `  --shadow-${key}: ${value};\n`;
  });
  
  // Z-index
  Object.entries(THEME.zIndex).forEach(([key, value]) => {
    css += `  --z-${key}: ${value};\n`;
  });
  
  // Transitions
  css += `  --transition-duration-fast: ${THEME.transitions.duration.fast};\n`;
  css += `  --transition-duration-normal: ${THEME.transitions.duration.normal};\n`;
  css += `  --transition-duration-slow: ${THEME.transitions.duration.slow};\n`;
  css += `  --transition-timing-ease: ${THEME.transitions.timing.ease};\n`;
  css += `  --transition-timing-ease-in: ${THEME.transitions.timing.easeIn};\n`;
  css += `  --transition-timing-ease-out: ${THEME.transitions.timing.easeOut};\n`;
  css += `  --transition-timing-ease-in-out: ${THEME.transitions.timing.easeInOut};\n`;
  
  // Typography
  Object.entries(THEME.typography.fontSize).forEach(([key, value]) => {
    css += `  --font-size-${key}: ${value};\n`;
  });
  Object.entries(THEME.typography.fontWeight).forEach(([key, value]) => {
    css += `  --font-weight-${key}: ${value};\n`;
  });
  Object.entries(THEME.typography.lineHeight).forEach(([key, value]) => {
    css += `  --line-height-${key}: ${value};\n`;
  });
  
  // Breakpoints
  Object.entries(THEME.breakpoints).forEach(([key, value]) => {
    css += `  --breakpoint-${key}: ${value};\n`;
  });
  
  css += '}\n';
  
  // Dark mode
  css += '\n[data-theme="dark"] {\n';
  
  // Dark mode color overrides (simplified - you can expand this)
  css += `  --color-primary: ${THEME.colors.primaryDark || '#60a5fa'};\n`;
  css += `  --color-background-primary: ${THEME.colors.dark};\n`;
  css += `  --color-background-secondary: ${THEME.colors.gray[800]};\n`;
  css += `  --color-text-primary: ${THEME.colors.text.inverse};\n`;
  css += `  --color-text-secondary: ${THEME.colors.gray[400]};\n`;
  css += `  --color-border: ${THEME.colors.gray[700]};\n`;
  
  css += '}\n';
  
  return css;
}

/**
 * Legacy CSS variable mappings for backward compatibility
 */
export const LEGACY_VAR_MAPPINGS = {
  // Colors
  '--primary': '--color-primary',
  '--primary-color': '--color-primary',
  '--primary-hover': '--color-primary-hover',
  '--secondary': '--color-secondary',
  '--success': '--color-success',
  '--warning': '--color-warning',
  '--danger': '--color-danger',
  '--info': '--color-info',
  '--brand-primary': '--color-primary',
  
  // Backgrounds
  '--bg-primary': '--color-background-primary',
  '--bg-secondary': '--color-background-secondary',
  '--bg-tertiary': '--color-background-tertiary',
  '--card-bg': '--color-background-primary',
  '--input-bg': '--color-background-secondary',
  
  // Text
  '--text-primary': '--color-text-primary',
  '--text-secondary': '--color-text-secondary',
  '--text-muted': '--color-text-secondary',
  '--text-inverse': '--color-text-inverse',
  
  // Borders
  '--border-color': '--color-border',
  '--border-light': '--color-border-light',
  '--border-dark': '--color-border-dark',
  
  // Spacing (already using --spacing-*)
  '--spacing-xs': '--spacing-xs',
  '--spacing-sm': '--spacing-sm',
  '--spacing-md': '--spacing-md',
  '--spacing-lg': '--spacing-lg',
  '--spacing-xl': '--spacing-xl',
  
  // Border radius
  '--border-radius': '--radius-md',
  '--border-radius-sm': '--radius-sm',
  '--border-radius-lg': '--radius-lg',
  
  // Shadows
  '--shadow-xs': '--shadow-sm',
  '--shadow-sm': '--shadow-sm',
  '--shadow-md': '--shadow-md',
  '--shadow-lg': '--shadow-lg',
  '--shadow-xl': '--shadow-xl',
  
  // Transitions
  '--transition': 'var(--transition-duration-normal) var(--transition-timing-ease-in-out)',
  
  // Hover states
  '--hover-bg': '--color-background-secondary',
  '--focus-bg': '--color-background-tertiary',
} as const;

