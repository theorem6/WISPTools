# Orphaned or Candidate-for-Removal Files

This document lists files and directories that appear **unused**, **deprecated**, or **duplicated** and may be removed or consolidated when moving to open source. Review before deleting.

---

## 1. Deprecated directory (safe to remove)

| Path | Reason |
|------|--------|
| `src-OLD-standalone-pci-DEPRECATED/` | Explicitly deprecated; old standalone PCI manager. See `README_DEPRECATED.md` inside. Replaced by Module_Manager. |

---

## 2. Backup files (safe to remove)

| Path | Reason |
|------|--------|
| `scripts/epc-ping-monitor.js.backup` | Backup; canonical in backend-services/scripts or scripts/ |
| `backend-services/scripts/epc-ping-monitor.js.backup` | Backup |
| `wisp-field-app/android/app/.../MainActivity.java.backup` | Backup |

---

## 3. Root-level notes / one-off command files

These are loose `.txt` or one-liner docs. Consider moving to `docs/` or deleting after open-source cleanup.

| Path | Note |
|------|------|
| `COMPLETE_EPC_UPDATE_COMMAND.txt` | Command snippet |
| `COMPLETE_EPC_UPDATE_ONE_LINER.txt` | Command snippet |
| `CORRECT_CHECKIN_COMMAND.txt` | Command snippet |
| `VERIFY_UPDATE.txt` | Verification notes |
| `QUICK_EPC_UPDATE.txt` | Command snippet |
| `FORCE_COMPLETE_EPC_UPDATE_ONE_LINE.txt` | Command snippet |
| `FORCE_COMPLETE_EPC_UPDATE.txt` | Command snippet |
| `deployment-log.txt` | Log; usually gitignored or ephemeral |
| `auth-logcat.txt` | Log; ephemeral |

---

## 4. Duplicate script locations

Many scripts exist in **two** places: `scripts/` and `backend-services/scripts/`. The **canonical** set for deployment is usually `backend-services/scripts/` (copied to GCE). The copies in root `scripts/` are often for local or CI use. Prefer consolidating to one location (e.g. `scripts/` at repo root) and having deployment copy from there, or document which is source of truth.

| scripts/ | backend-services/scripts/ | Suggestion |
|----------|---------------------------|------------|
| `epc-checkin-agent.sh` | same | Keep one; reference from docs |
| `fix-nginx-api-routing.sh` | (nginx fix is in scripts/) | Keep in scripts/ |
| `deploy-iso-helpers-from-git.sh` | same | Keep one |
| `configure-local-hss-failover.sh` | same | Keep one |
| `install-nodejs-npm.sh`, `setup-*.sh`, etc. | same | Keep one (e.g. backend-services/scripts as canonical for EPC/GCE) |

---

## 5. Root-level legacy or single-use assets

| Path | Note |
|------|------|
| `call-setup-admin.html` | One-off HTML; may be obsolete |
| `create-tenant-manual.cjs` | Manual tenant creation; consider moving to scripts/ or docs |
| `fix-customer-api.py` | One-off fix script |
| `fix-import.py` | One-off fix script |
| `fix-inventory-category.js` | One-off fix; run once then archive |

---

## 6. Root-level server/API duplication

The repo has **two** API surfaces:

- **`backend-services/`** – Main API (server.js, used on GCE).
- **Root** – `server.js`, `config/`, `routes/`, `middleware/`, `models/`, `services/`, `billing-api.js`, etc.

Root `package.json` points to `billing-api.js` and root `server.js` exists; some CI or local runs may still use root. For open source, prefer **one** backend: `backend-services/`. If root is no longer used, these are candidates for removal or archival:

- Root: `server.js`, `config/`, `routes/`, `middleware/`, `models/`, `services/`
- Root: `billing-api.js`, `billing-schema.js`, `email-service.js`, `monitoring-service.js`, `monitoring-backend-server.js`, `start-server.js`, `ecosystem.config.js`

Verify no GitHub Actions or docs reference root server before removing.

---

## 7. Documentation and markdown sprawl

- **`docs/archive/`** and **`docs/archived/`** – Archived docs; keep for history or move to a single `docs/archive/`.
- Many **`docs/*.md`** and **`docs/**/*.md`** – Status and fix docs. Consider a single **`docs/README.md`** that indexes by topic and marks obsolete ones.

---

## Summary

- **Safe to remove:** `src-OLD-standalone-pci-DEPRECATED/`, `*.backup` files.
- **Consolidate:** Duplicate scripts between `scripts/` and `backend-services/scripts/`; document canonical location.
- **Review before remove:** Root-level API (server, config, routes, etc.) and one-off `.txt` / `.py` / `.cjs` / `.html` files.
- **Keep but organize:** Loose command `.txt` files → move to `docs/` or delete after commands are in README or runbooks.
