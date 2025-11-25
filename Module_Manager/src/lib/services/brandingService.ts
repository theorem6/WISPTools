/**
 * Branding Service
 * Manages tenant branding for customer portal
 */

import { getApiUrl } from '$lib/config/api';

const API_URL = getApiUrl();

export interface TenantBranding {
  logo: {
    url?: string;
    altText?: string;
    favicon?: string;
  };
  colors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    textSecondary?: string;
  };
  company: {
    name?: string;
    displayName?: string;
    supportEmail?: string;
    supportPhone?: string;
    supportHours?: string;
    website?: string;
    address?: string;
  };
  portal: {
    welcomeMessage?: string;
    footerText?: string;
    customCSS?: string;
    enableCustomDomain?: boolean;
    customDomain?: string;
  };
  features: {
    enableFAQ?: boolean;
    enableServiceStatus?: boolean;
    enableLiveChat?: boolean;
    enableKnowledgeBase?: boolean;
  };
}

class BrandingService {
  /**
   * Get tenant branding
   */
  async getTenantBranding(tenantId: string): Promise<TenantBranding> {
    try {
      const response = await fetch(`${API_URL}/branding/${tenantId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch branding: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error: any) {
      console.error('Error fetching branding:', error);
      // Return default branding on error
      return this.getDefaultBranding();
    }
  }

  /**
   * Update tenant branding (admin only)
   */
  async updateTenantBranding(tenantId: string, branding: Partial<TenantBranding>): Promise<void> {
    try {
      const authService = await import('$lib/services/authService');
      const token = await authService.authService.getIdToken();
      
      const response = await fetch(`${API_URL}/branding/${tenantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(branding)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update branding');
      }
    } catch (error: any) {
      console.error('Error updating branding:', error);
      throw error;
    }
  }

  /**
   * Upload logo (admin only)
   */
  async uploadLogo(tenantId: string, logoUrl: string, altText?: string): Promise<void> {
    try {
      const authService = await import('$lib/services/authService');
      const token = await authService.authService.getIdToken();
      
      const response = await fetch(`${API_URL}/branding/${tenantId}/logo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ logoUrl, altText })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload logo');
      }
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      throw error;
    }
  }

  /**
   * Get default branding
   */
  getDefaultBranding(): TenantBranding {
    return {
      logo: {
        url: '',
        altText: 'Company Logo',
        favicon: ''
      },
      colors: {
        primary: '#3b82f6',
        secondary: '#64748b',
        accent: '#10b981',
        background: '#ffffff',
        text: '#111827',
        textSecondary: '#6b7280'
      },
      company: {
        name: '',
        displayName: '',
        supportEmail: '',
        supportPhone: '',
        supportHours: 'Mon-Fri 8am-5pm',
        website: '',
        address: ''
      },
      portal: {
        welcomeMessage: 'Welcome to Customer Portal',
        footerText: '',
        customCSS: '',
        enableCustomDomain: false,
        customDomain: ''
      },
      features: {
        enableFAQ: true,
        enableServiceStatus: true,
        enableLiveChat: false,
        enableKnowledgeBase: false
      }
    };
  }

  /**
   * Apply branding to document (CSS variables)
   */
  applyBrandingToDocument(branding: TenantBranding): void {
    if (typeof document === 'undefined') return;
    
    const root = document.documentElement;
    
    // Apply colors
    if (branding.colors.primary) {
      root.style.setProperty('--brand-primary', branding.colors.primary);
    }
    if (branding.colors.secondary) {
      root.style.setProperty('--brand-secondary', branding.colors.secondary);
    }
    if (branding.colors.accent) {
      root.style.setProperty('--brand-accent', branding.colors.accent);
    }
    if (branding.colors.background) {
      root.style.setProperty('--brand-background', branding.colors.background);
    }
    if (branding.colors.text) {
      root.style.setProperty('--brand-text', branding.colors.text);
    }
    if (branding.colors.textSecondary) {
      root.style.setProperty('--brand-text-secondary', branding.colors.textSecondary);
    }
    
    // Apply custom CSS if provided
    if (branding.portal.customCSS) {
      const styleId = 'branding-custom-css';
      let styleElement = document.getElementById(styleId);
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }
      styleElement.textContent = branding.portal.customCSS;
    }
  }
}

export const brandingService = new BrandingService();

