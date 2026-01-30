# Customer Portal: Access and All Pages

This document describes how customers reach the portal and lists every page, URL, and how to access it.

---

## Can customers access all of these pages?

**Yes.** Once a customer is logged in, they can reach every enabled page in three ways:

1. **Header navigation** – The portal header (BrandedHeader) shows links for Dashboard, Tickets, Billing, Service Status, FAQ, Knowledge Base, and Live Chat. Each link is shown only when that feature is enabled for the tenant.
2. **Dashboard quick links** – The dashboard shows support cards (Billing, Service Status, FAQ, Knowledge Base, Live Chat) with direct links to each section.
3. **Direct URLs** – Customers can bookmark or open any portal URL directly (see table below). If they are not logged in, they are redirected to login, then can continue to the page after signing in.

---

## How customers get to the portal

### Entry points

| Who | How |
|-----|-----|
| **WISP staff** | In the app: **Modules → Customers → Portal** tab → **View Portal**. Opens `/modules/customers/portal/login` (optionally with current tenant). |
| **Customer (shared link)** | You share the portal login URL with the tenant ID: `https://<your-app>/modules/customers/portal/login?tenant=<tenantId>`. |
| **Customer (custom domain)** | If you use a custom domain for the portal (e.g. `portal.yourwisp.com`), the layout calls `/api/portal/domain/<hostname>` to resolve the tenant; no `?tenant=` needed. |
| **Customer (bookmark)** | Customer bookmarks the login URL (with `?tenant=` if not using custom domain) and returns anytime. |

### Tenant detection (which WISP they see)

- **URL param:** `?tenant=<tenantId>` (MongoDB ObjectId or portal subdomain).
- **Custom domain:** Backend resolves tenant from `branding.portal.customDomain` (e.g. `portal.yourwisp.com`).
- **Subdomain:** Backend can resolve from `branding.portal.portalSubdomain` (e.g. `wisptools.io` + subdomain).
- **From main app:** If staff opens “View Portal” from the Customers module, the current tenant context can be used (e.g. from `currentTenant` store).

### Auth flow

- **Login:** `/modules/customers/portal/login` – Firebase Auth (email/password or your configured methods). Customer record is matched by Firebase UID or by identifier (customer ID, phone, email) when linking.
- **Sign up:** `/modules/customers/portal/signup` – Links an existing customer record to a new Firebase account (customer must already exist in your system).
- **After login:** User is redirected to `/modules/customers/portal/dashboard`. Any visit to a portal path while not logged in (except login/signup) redirects to login, then they can navigate to the intended page.

---

## All portal pages (documented)

| Page | Path | Description | When visible |
|------|------|-------------|--------------|
| **Portal root** | `/modules/customers/portal` | Redirects to dashboard if logged in, else to login. | Always. |
| **Login** | `/modules/customers/portal/login` | Customer sign-in (Firebase). Optional `?tenant=<id>`. | Always (no auth required). |
| **Sign up** | `/modules/customers/portal/signup` | Link existing customer to Firebase account. | Always (no auth required). |
| **Dashboard** | `/modules/customers/portal/dashboard` | Welcome, ticket stats, service status, and quick links to Billing, Service Status, FAQ, Knowledge Base, Live Chat, Tickets. | When logged in. |
| **Tickets list** | `/modules/customers/portal/tickets` | List of customer’s support tickets (from work orders). | When logged in and `enableTickets` is not false. |
| **New ticket** | `/modules/customers/portal/tickets/new` | Create a new support ticket. | When logged in and tickets enabled. |
| **Ticket detail** | `/modules/customers/portal/tickets/[id]` | Single ticket: status, history, add comment. | When logged in and tickets enabled; customer must own ticket. |
| **Billing** | `/modules/customers/portal/billing` | Plan, billing cycle, balance, invoices, payment history, Pay now (Stripe when configured). | When logged in and `enableBilling` is not false. |
| **Service status** | `/modules/customers/portal/service` | Service info, status, and outage/maintenance messaging. | When logged in and `enableServiceStatus` is not false. |
| **FAQ** | `/modules/customers/portal/faq` | Tenant-managed FAQ (from portal-content API); fallback to default FAQs. | When logged in and `enableFAQ` is not false. |
| **Knowledge base** | `/modules/customers/portal/knowledge` | List of published KB articles (from portal-content API). | When logged in and `enableKnowledgeBase` is true. |
| **Knowledge article** | `/modules/customers/portal/knowledge/[id]` | Single KB article by id. | When logged in and knowledge base enabled. |
| **Live chat** | `/modules/customers/portal/live-chat` | Placeholder for live chat; shows contact info and hours when enabled. | When logged in and `enableLiveChat` is true. |

---

## Feature flags (tenant-controlled)

Visibility of Tickets, Billing, Service Status, FAQ, Knowledge Base, and Live Chat is controlled by tenant branding/features (Portal setup in the app):

| Feature key | Default | Effect |
|-------------|---------|--------|
| `enableTickets` | true (not false) | Shows Tickets in nav and dashboard; allows list/new/detail. |
| `enableBilling` | true (not false) | Shows Billing in nav and dashboard. |
| `enableServiceStatus` | true (not false) | Shows Service Status in nav and dashboard. |
| `enableFAQ` | true (not false) | Shows FAQ in nav and dashboard. |
| `enableKnowledgeBase` | false | Shows Knowledge Base in nav and dashboard; must be true to see. |
| `enableLiveChat` | false | Shows Live Chat in nav and dashboard; must be true to see. |

Configure these under **Modules → Customers → Customize Portal** (portal-setup).

---

## Navigation summary

- **Header (when logged in):** Dashboard, then (if enabled) Tickets, Billing, Service Status, FAQ, Knowledge Base, Live Chat, plus user name and Logout.
- **Dashboard:** Same sections as cards with “View Billing”, “View Status”, “Visit FAQ”, “Browse Articles”, “Start Chat”, plus “Create New Ticket” / “View All Tickets” when tickets are enabled.
- **Back links:** Ticket detail → “Back to Tickets”; Knowledge article → “Back to Knowledge Base”; New ticket → “Back to Tickets” / “Cancel”.

---

## URLs quick reference (base path)

Assume base URL is your app (e.g. `https://wisptools-production.web.app` or your custom domain). Tenant is set by `?tenant=<id>` or by custom domain.

```
/modules/customers/portal
/modules/customers/portal/login
/modules/customers/portal/signup
/modules/customers/portal/dashboard
/modules/customers/portal/tickets
/modules/customers/portal/tickets/new
/modules/customers/portal/tickets/<ticketId>
/modules/customers/portal/billing
/modules/customers/portal/service
/modules/customers/portal/faq
/modules/customers/portal/knowledge
/modules/customers/portal/knowledge/<articleId>
/modules/customers/portal/live-chat
```

---

## Related docs and code

- **Portal setup (admin):** `Module_Manager/src/routes/modules/customers/portal-setup/+page.svelte` – branding, features, **Billing Portal Admin** (payment gateways, invoice customization), FAQ/KB/alerts, chat settings.
- **Billing Portal Admin:** In Portal setup, open the **Billing Portal** tab to configure Stripe/PayPal and invoice customization (company name, logo, address, footer, terms, due days, currency). Stored in tenant `branding.billingPortal`.
- **Portal layout / tenant + auth:** `Module_Manager/src/routes/modules/customers/portal/+layout.svelte` – tenant from domain or `?tenant=`, branding load, redirect to login when not authenticated.
- **Header nav:** `Module_Manager/src/routes/modules/customers/portal/components/BrandedHeader.svelte` – all nav links and feature flags.
- **Domain/tenant API:** `backend-services/routes/portal-domain.js` – `/api/portal/domain/:domain`, `/api/portal/tenant/:tenantId`.
- **Portal content API:** `backend-services/routes/portal-content.js` – FAQ, knowledge base (published), alerts, chat settings.
