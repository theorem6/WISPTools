# Phase 2: Content Migration - IN PROGRESS

**Date:** 2025-12-19  
**Status:** 🔄 In Progress

---

## Phase 2 Goals

1. Review all existing documentation
2. Categorize by type (guide, reference, tutorial, etc.)
3. Migrate to new structure
4. Add frontmatter to all files
5. Fix broken links
6. Update cross-references
7. Create documentation index

---

## Current Documentation Structure

### Existing Categories:
- `docs/guides/` - Feature & module guides (24 files)
- `docs/deployment/` - Deployment guides (50+ files)
- `docs/fixes/` - Historical fixes (archive)
- `docs/status/` - Status reports (archive)
- `docs/hss/` - HSS documentation (3 files)
- `docs/setup/` - Setup guides (4 files)
- `docs/workflows/` - Workflow documentation (1 file)

### Target Structure:
```
docs/
├── getting-started/          # Quick start guides
├── guides/
│   ├── user-guides/          # End-user documentation
│   ├── developer-guides/     # Developer documentation
│   ├── admin-guides/         # Administrator documentation
│   └── integration-guides/   # Integration documentation
├── api/                      # API reference
├── reference/                # Reference documentation
├── tutorials/                # Step-by-step tutorials
└── deployment/               # Deployment guides (keep existing)
```

---

## Migration Tasks

### Task 1: Review and Categorize ✅ Starting
- [x] List all existing documentation files
- [ ] Categorize each file by audience (user, developer, admin)
- [ ] Identify files that need reorganization

### Task 2: Add Frontmatter
- [ ] Create frontmatter template
- [ ] Add frontmatter to all files
- [ ] Include metadata (title, description, category, tags, etc.)

### Task 3: Fix Links
- [ ] Scan for broken internal links
- [ ] Update links to new file locations
- [ ] Test all links

### Task 4: Create Index
- [ ] Create main documentation index
- [ ] Add navigation structure
- [ ] Create category indexes

---

## Frontmatter Template

```yaml
---
title: "Documentation Title"
description: "Brief description of the content"
category: "guides" | "api" | "reference" | "tutorial" | "deployment"
subcategory: "user-guides" | "developer-guides" | "admin-guides" | "integration-guides"
tags: ["tag1", "tag2", "tag3"]
last_updated: "2025-12-19"
author: "Documentation Team"
difficulty: "beginner" | "intermediate" | "advanced"
audience: "users" | "developers" | "administrators" | "all"
---
```

---

## Progress Tracking

**Files Reviewed:** 0 / 100+  
**Files with Frontmatter:** 0 / 100+  
**Links Fixed:** 0  
**Categories Created:** 0 / 4

---

**Last Updated:** 2025-12-19

