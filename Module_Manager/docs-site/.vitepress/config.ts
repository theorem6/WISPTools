import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'WISPTools Documentation',
  description: 'Complete documentation for WISPTools - LTE WISP Management Platform',
  
  // Base URL (adjust if deploying to subdirectory)
  base: '/',
  
  // Theme configuration
  themeConfig: {
    // Logo (optional)
    // logo: '/logo.png',
    
    // Navigation
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started/' },
      { text: 'Guides', link: '/guides/' },
      { text: 'API Reference', link: '/api/' },
      { text: 'Deployment', link: '/deployment/' }
    ],
    
    // Sidebar
    sidebar: {
      '/getting-started/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/getting-started/' },
            { text: 'Quick Start', link: '/getting-started/quick-start' },
            { text: 'Installation', link: '/getting-started/installation' },
            { text: 'Configuration', link: '/getting-started/configuration' }
          ]
        }
      ],
      '/guides/': [
        {
          text: 'User Guides',
          items: [
            { text: 'Authentication', link: '/guides/user-guides/authentication' },
            { text: 'Tenant Management', link: '/guides/user-guides/tenant-management' }
          ]
        },
        {
          text: 'Administrator Guides',
          items: [
            { text: 'Multi-Tenant Setup', link: '/guides/admin-guides/multi-tenant-setup' },
            { text: 'HSS Production Guide', link: '/guides/admin-guides/hss-production' },
            { text: 'Admin & User Management', link: '/guides/admin-guides/admin-user-management' }
          ]
        },
        {
          text: 'Developer Guides',
          items: [
            { text: 'Architecture', link: '/guides/developer-guides/architecture' },
            { text: 'API Reference', link: '/guides/developer-guides/api-reference' },
            { text: 'Database Structure', link: '/guides/developer-guides/database-structure' }
          ]
        }
      ],
      '/deployment/': [
        {
          text: 'Deployment',
          items: [
            { text: 'Overview', link: '/deployment/' },
            { text: 'Backend Deployment', link: '/deployment/backend' },
            { text: 'Frontend Deployment', link: '/deployment/frontend' }
          ]
        }
      ]
    },
    
    // Social links
    socialLinks: [
      // { icon: 'github', link: 'https://github.com/yourorg/wisptools' }
    ],
    
    // Footer
    footer: {
      message: 'WISPTools Documentation',
      copyright: 'Copyright © 2025 WISPTools'
    },
    
    // Search
    search: {
      provider: 'local'
    },
    
    // Edit link
    editLink: {
      // pattern: 'https://github.com/yourorg/wisptools/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    }
  },
  
  // Markdown configuration
  markdown: {
    lineNumbers: true,
    config: (md) => {
      // You can add markdown plugins here
    }
  }
})

