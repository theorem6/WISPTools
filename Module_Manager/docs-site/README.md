# WISPTools Documentation Site

This is the interactive documentation site for WISPTools, built with VitePress.

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Structure

```
docs-site/
├── .vitepress/
│   └── config.ts          # VitePress configuration
├── getting-started/        # Getting started guides
├── guides/                 # User, admin, and developer guides
├── api/                    # API reference
├── deployment/             # Deployment documentation
└── index.md                # Homepage
```

## Adding Documentation

1. Create or move markdown files to appropriate directories
2. Add frontmatter with metadata (see template below)
3. Update sidebar navigation in `.vitepress/config.ts`

### Frontmatter Template

```yaml
---
title: "Page Title"
description: "Brief description"
category: "guides" | "api" | "reference" | "tutorial"
subcategory: "user-guides" | "admin-guides" | "developer-guides"
tags: ["tag1", "tag2"]
last_updated: "2025-12-19"
difficulty: "beginner" | "intermediate" | "advanced"
audience: "users" | "administrators" | "developers" | "all"
---
```

## Deployment

The documentation site can be deployed to:
- Firebase Hosting (recommended, integrates with main app)
- GitHub Pages
- Netlify
- Vercel
- Any static hosting service

