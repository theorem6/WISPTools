# The WispTools Architectural Playbook

This document outlines the **orchestration logic** used to build wisptools.io. In the world of **Vibe Coding**, these prompts serve as the "blueprints" that guided the AI to build an enterprise-grade stack including ArcGIS, MongoDB Atlas, Firebase, and GCE.

---

## 1. The Global Architecture Prompt

**Objective:** Establishing the "Three-Legged Stool" of Data, Auth, and Compute.

> I am architecting a high-performance utility suite called WispTools. I need a foundational Next.js project structure.
>
> **Requirements:**
> - **Auth:** Integrate Firebase Authentication for client-side user sessions.
> - **Database:** Establish a connection to MongoDB Atlas for persistent storage of geospatial metadata.
> - **Compute:** Prepare a Dockerized Node.js environment to be deployed on Google Compute Engine (GCE) for heavy-duty background processing.
> - **Design:** Use Tailwind CSS with a "Cyber-Grid" dark theme (Neon Cyan and Slate).
>
> Please generate the dbConnect utility for MongoDB and the firebase-config client initialization.

---

## 2. Geospatial Intelligence (ArcGIS)

**Objective:** Bridging complex mapping data with a React UI.

> Using the @arcgis/core library, create a custom React component **WispMap**.
>
> **Logic:**
> - Initialize a WebMap with a dark-gray-canvas vector basemap.
> - Create a dynamic FeatureLayer that fetches GeoJSON data points from my MongoDB Atlas "Nodes" collection.
> - Implement a popup template that displays signal strength and latency metrics stored in the database.
> - Ensure the map handles window resizing and disposes of the view properly to prevent memory leaks.

---

## 3. The "Legacy to Cloud" Logic (WiMAX Transition)

**Objective:** Creating tools that translate hardware-level engineering into software.

> I need to build a **Signal Propagation Calculator** tool.
>
> - **Formula:** Use the Hata Model for suburban areas to calculate path loss.
> - **Input:** Frequency (MHz), Antenna Height (m), and Distance (km).
> - **Output:** Display the result in a clean, animated gauge component.
> - **Integration:** If the user is logged in via Firebase, save their calculation history to their MongoDB profile.

---

## 4. Infrastructure Troubleshooting & Optimization

**Objective:** Showing "Human-in-the-Loop" senior-level engineering.

> The current GCE deployment is timing out when processing large ArcGIS datasets.
>
> **Task:** Refactor the backend worker to use a messaging queue logic. When a request comes in, save the task to MongoDB with a "pending" status. Use a Node.js cluster on GCE to pick up the task, process the spatial data, and update the status to "complete".
>
> Provide the code for the worker listener and the API endpoint to poll for status updates.

---

## 5. Final Polishing & "Vibe"

**Objective:** Ensuring the UI/UX matches the high-end technical backend.

> Review the current landing page for WispTools.io. It needs to feel like a high-end engineering tool.
>
> **Changes:**
> - Add a framer-motion reveal effect for the grid layout.
> - Add a glowing "Live System Status" indicator that pings my GCE health check endpoint.
> - Ensure all ArcGIS widgets (Zoom, Compass, Search) are styled to match the site's neon-cyan-on-black aesthetic.

---

## 6. Frontend: SvelteKit Module Manager

**Objective:** A single app for all WISP modules with a consistent UX.

> Build the main WispTools frontend as a **SvelteKit** app (Module_Manager).
>
> **Requirements:**
> - Route structure: `/` (dashboard), `/login`, `/modules/<module>` (customers, deploy, monitoring, inventory, etc.), `/wizards`, `/docs`.
> - All API calls go through a configurable base URL (getApiUrl / API_CONFIG) that points to the backend (via Firebase Hosting rewrites or Cloud Functions proxy).
> - Use Tailwind; keep the Cyber-Grid dark theme (neon cyan, slate).
> - Wizards and module tips are driven by a central catalog (wizardCatalog, moduleTips) so we can add modules without hardcoding routes everywhere.

---

## 7. Multi-Tenant Data & Auth

**Objective:** Every API and UI must be tenant-aware.

> Implement **multi-tenancy** for WispTools.
>
> **Requirements:**
> - **Storage:** MongoDB holds a `tenants` collection; each tenant has subdomain, name, and settings. All business data (sites, devices, customers, plans) is scoped by `tenantId`.
> - **Auth:** Firebase Authentication for users. Maintain a `userTenants` (or equivalent) store that maps users to tenants and roles (e.g. admin, operator).
> - **API:** Backend accepts `X-Tenant-ID` (or tenant from JWT/custom claims). Every route that reads or writes business data must validate the user’s access to that tenant and filter by `tenantId`.
> - **Frontend:** After login, resolve the user’s tenants and either show a tenant selector or default to the first tenant. Send the chosen tenant ID on every API request.

---

## 8. Firebase Hosting, Rewrites & Cloud Functions

**Objective:** Single origin (wisptools.io) with API and auth proxied to GCE and Firebase.

> Set up **Firebase Hosting** so that the app and API are served from one domain.
>
> **Requirements:**
> - Hosting serves the SvelteKit static/build output (or a pre-rendered export) at `/`.
> - Rewrites: `/api/**` and `/health` go to a **Cloud Function** (e.g. apiProxy) that forwards the request to the GCE backend, preserving path and method. Forward the Firebase ID token in `Authorization` (or a dedicated header) so the backend can verify the user.
> - Optional: authProxy (or similar) for auth-only routes. Environment for the Cloud Function: backend base URL, and (if needed) Firebase Admin SDK for token verification or for adding custom claims.
> - Do not expose GCE IP publicly; all traffic goes Firebase → Cloud Function → GCE (or VPC connector if used).

---

## 9. GCE Backend & Health Checks

**Objective:** Robust Node API on GCE with clear ownership of routes and health.

> The main API runs on **Google Compute Engine** as a Node.js app (e.g. Express).
>
> **Requirements:**
> - Single entry: `backend-services/server.js`, mounted routes from a config (e.g. config/routes.js). Use PM2 or similar for process management (ecosystem.config.js).
> - **Health:** Expose a `/health` endpoint that returns 200 and a small JSON payload (e.g. status, uptime). This is used by Firebase proxy and by the frontend "Live System Status" indicator.
> - **Auth:** Middleware that verifies the Firebase ID token (using Firebase Admin SDK) from the request. Extract tenant and user and attach to the request for route handlers.
> - **Secrets:** No credentials in repo; use env vars (e.g. from a secret manager or startup script) for MongoDB URI, Firebase Admin SDK, and any internal API keys.

---

## 10. Nginx Path Preservation (When Applicable)

**Objective:** If nginx sits in front of the Node app on GCE, API paths must be preserved.

> We have nginx in front of the Node backend on GCE. Some clients send the full path (e.g. /api/...) and expect the backend to see that path.
>
> **Requirements:**
> - Configure nginx so that requests to `/api/...` are proxied to the Node server with the **original path** preserved (no stripping). If we must use a different internal path, forward the original path in a header (e.g. `X-Original-Path`) and have the backend trust that header when present.
> - Ensure WebSocket or long-polling routes, if any, are also proxied correctly.

---

## 11. Customer Portal & White-Label Branding

**Objective:** Tenants can offer a customer-facing portal with their own branding.

> Build a **customer portal** that tenants can enable for their end customers.
>
> **Requirements:**
> - Portal routes (e.g. `/portal`, `/portal/dashboard`, `/portal/billing`, `/portal/tickets`) are part of the same SvelteKit app but render a different layout (no sidebar, tenant branding).
> - **Branding:** Store per-tenant branding (logo URL, primary color, name) in MongoDB or Firestore. An API (e.g. branding-api) returns this for the portal. The portal header and login page use this for a white-label experience.
> - **Auth:** Customers log in with Firebase (or a dedicated customer-auth flow). Backend validates that the customer belongs to the tenant implied by the request (subdomain or tenant ID).

---

## 12. EPC / HSS / Open5GS & Check-In Agents

**Objective:** Integrate LTE/EPC and HSS deployment with automated agent check-ins.

> Integrate **Open5GS HSS** and EPC deployment into WispTools.
>
> **Requirements:**
> - **Deployment:** Backend can generate EPC ISOs or register EPC nodes (e.g. via deployment routes). Store EPC/node metadata in MongoDB (tenant-scoped).
> - **HSS:** Subscriber and bandwidth plan management via backend APIs that talk to HSS or related services (e.g. Diameter, or internal APIs).
> - **Check-in agent:** A small script (e.g. epc-checkin-agent.sh) runs on EPC nodes. It periodically calls a backend endpoint (or downloads from a known URL) to report status. Backend records last check-in time and optionally version. No hardcoded secrets in the script; use env or signed URLs if needed.
> - **UI:** Module_Manager has modules for deploy, HSS management, and (if applicable) EPC monitoring, with wizards for subscriber creation, bandwidth plans, and site deployment.

---

## 13. Human-in-the-Loop and Operations

**Objective:** Senior engineers can fix and tune the system via scripts and docs.

> Document and script the **operational** side of WispTools for open source.
>
> **Requirements:**
> - **Scripts:** Provide both Windows (PowerShell) and Linux (Bash) scripts where relevant. Main entry points: full deploy (Firebase + GCE), backend-only deploy to GCE, Firebase Hosting deploy. Document in scripts/README.md which script to run from where (local vs on GCE).
> - **Secrets:** No passwords or API keys in the repo. Use environment variables (e.g. GITHUB_TOKEN, REMOTE_AGENT_HOST) or secret managers. Document required env vars in .env.example or docs.
> - **Orphaned files:** Maintain an ORPHANED_FILES.md (or similar) listing deprecated dirs, backup files, and duplicate script copies so maintainers can clean up safely.

---

## Summary Table

| # | Theme | Key outputs |
|---|--------|-------------|
| 1 | Global architecture | Firebase Auth, MongoDB, GCE Docker/Node, Tailwind Cyber-Grid, dbConnect, firebase-config |
| 2 | ArcGIS | WispMap, WebMap, FeatureLayer from MongoDB Nodes, popup, resize/cleanup |
| 3 | Legacy to cloud | Signal Propagation Calculator (Hata), gauge, save history to MongoDB when logged in |
| 4 | Infrastructure | Queue (MongoDB task status), Node worker, poll API |
| 5 | Vibe | Framer-motion, Live System Status (GCE health), ArcGIS widgets styled |
| 6 | Frontend | SvelteKit Module_Manager, routes, API config, wizards/tips catalog |
| 7 | Multi-tenant | Tenants collection, userTenants, X-Tenant-ID, tenant-scoped data |
| 8 | Firebase Hosting | Rewrites, apiProxy Cloud Function, token forwarding to GCE |
| 9 | GCE backend | server.js, PM2, /health, Firebase Admin verification, env-based secrets |
| 10 | Nginx | Preserve path or X-Original-Path |
| 11 | Customer portal | Portal routes, per-tenant branding API, customer auth |
| 12 | EPC/HSS | EPC deployment, HSS APIs, check-in agent script, UI modules |
| 13 | Ops & open source | Scripts README, no secrets in repo, ORPHANED_FILES.md |

Use these prompts as blueprints when extending or re-implementing parts of WispTools in a Vibe Coding workflow.
