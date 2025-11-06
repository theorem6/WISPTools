/**
 * Centralized Theme and Design Tokens
 * All CSS values, colors, spacing, typography should be defined here
 */

export const THEME = {
  // Colors
  colors: {
    // Brand colors
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    primaryLight: '#93c5fd',
    primaryDark: '#1e40af',
    
    secondary: '#64748b',
    secondaryHover: '#475569',
    
    // Status colors
    success: '#10b981',
    successHover: '#059669',
    successLight: '#6ee7b7',
    
    warning: '#f59e0b',
    warningHover: '#d97706',
    warningLight: '#fcd34d',
    
    danger: '#ef4444',
    dangerHover: '#dc2626',
    dangerLight: '#fca5a5',
    
    info: '#3b82f6',
    infoHover: '#2563eb',
    infoLight: '#93c5fd',
    
    // Neutral colors
    light: '#f8f9fa',
    dark: '#1f2937',
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827'
    },
    
    // UI element colors
    border: '#e5e7eb',
    borderLight: '#f3f4f6',
    borderDark: '#d1d5db',
    
    background: {
      primary: '#ffffff',
      secondary: '#f9fafb',
      tertiary: '#f3f4f6'
    },
    
    text: {
      primary: '#111827',
      secondary: '#6b7280',
      tertiary: '#9ca3af',
      inverse: '#ffffff'
    }
  },
  
  // Spacing scale (in px)
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    xxl: '3rem',     // 48px
    xxxl: '4rem'     // 64px
  },
  
  // Border radius
  borderRadius: {
    none: '0',
    sm: '0.25rem',   // 4px
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem',      // 16px
    full: '9999px'
  },
  
  // Typography
  typography: {
    fontFamily: {
      sans: 'system-ui, -apple-system, sans-serif',
      mono: 'monospace'
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem'  // 36px
    },
    fontWeight: {
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700'
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75'
    }
  },
  
  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
  },
  
  // Z-index layers
  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070
  },
  
  // Transitions
  transitions: {
    duration: {
      fast: '150ms',
      normal: '200ms',
      slow: '300ms'
    },
    timing: {
      ease: 'ease',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out'
    }
  },
  
  // Breakpoints (for responsive design)
  breakpoints: {
    mobile: '768px',
    tablet: '1024px',
    desktop: '1280px',
    wide: '1536px'
  },
  
  // Animation durations
  animation: {
    duration: {
      fast: 150,
      normal: 200,
      slow: 300
    }
  }
} as const;

/**
 * CSS variable helpers - generates CSS custom properties
 */
export function getThemeCSSVariables(): Record<string, string> {
  const cssVars: Record<string, string> = {};
  
  // Colors
  Object.entries(THEME.colors).forEach(([key, value]) => {
    if (typeof value === 'string') {
      cssVars[`--color-${key}`] = value;
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([subKey, subValue]) => {
        cssVars[`--color-${key}-${subKey}`] = subValue as string;
      });
    }
  });
  
  // Spacing
  Object.entries(THEME.spacing).forEach(([key, value]) => {
    cssVars[`--spacing-${key}`] = value;
  });
  
  // Border radius
  Object.entries(THEME.borderRadius).forEach(([key, value]) => {
    cssVars[`--radius-${key}`] = value;
  });
  
  return cssVars;
}

