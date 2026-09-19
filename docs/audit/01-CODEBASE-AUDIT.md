# 01 — Full Codebase & Architecture Audit

**Status:** Completed  
**Date:** September 2026  
**Auditor:** Principal Software Architect & Technical Audit Team  
**Scope:** Multi-Tenant SaaS Platform (Master Panel, Tenant ERP, Headless Storefront)

---

## 1. Executive Summary

This audit assesses the structural integrity, technology stack, package dependencies, multi-tenant isolation, routing patterns, and production viability of the platform.

The system is architected as an **omnichannel multi-tenant ERP & SaaS platform** comprising three connected layers:
1. **Master SaaS Control Plane** (`proerp.devcenterpoint.com`) — Tenant registration, billing, subscriptions, feature gates, platform monitoring.
2. **Tenant ERP Management** (`{tenant}.devcenterpoint.com/login`) — Manufacturing, Inventory, Sales, HR, QC, POS, Finance, Assets, and Storefront Management.
3. **Tenant Headless E-Commerce Storefront** (`{tenant}.devcenterpoint.com` or `{customdomain}.com`) — Public catalog, cart, checkout, customer self-service, dynamic CMS blocks, and search engine discoverability.

---

## 2. Technology Stack & Environment

| Component | Technology | Version | Purpose | Health / Status |
|---|---|---|---|---|
| **Backend Runtime** | PHP (CLI & FPM) | 8.5.5 | Server-side execution | Modern, OPcache enabled |
| **Backend Framework** | Laravel Framework | 13.26.1 | REST API, Tenancy, Jobs, ORM | Production-ready, modern |
| **Frontend Runtime** | Node.js | v25.1.0 | Build system & tooling | Modern LTS equivalent |
| **Frontend Framework** | React + TypeScript | React 19.2.8 / TS 5.x | Single Page Application (SPA) | Fully type-checked (`tsc -b` passes) |
| **Build Tooling** | Vite | 6.x | Bundling, HMR, Code-splitting | ESM native, fast builds |
| **State Management** | TanStack Query + Zustand | 5.101.4 / 5.0.15 | Server cache + client store | Clean separation of concerns |
| **Database** | MySQL / MariaDB (Dev: SQLite) | 8.0+ / 10.6+ | Relational storage | 207 migrations, 165 models |
| **Queue / Cache** | Database / Redis | Driver-configurable | Async jobs, rate limiting | Queue workers required |
| **Deployment Target** | Linux cPanel / Nginx / Apache | Apache 2.4 + mod_rewrite | Production hosting | Requires proper `.cpanel.yml` & `.htaccess` |

---

## 3. Backend Architecture Analysis (Laravel 13)

### 3.1 Modular Directory Structure
The backend is organized into 19 functional domain modules under `app/Modules/`:
- `Assets` (Fixed asset registry, depreciation, maintenance)
- `Audit` (Tamper-evident audit logging, entity diff history)
- `Auth` (JWT issuance, refresh rotation, password reset)
- `Catalogue` (Products, variants, BOMs, units, brands, categories)
- `Delivery` (Couriers, shipments, run sheets, COD reconciliations, webhooks)
- `Documents` (Invoice, slip, and barcode PDF rendering)
- `Ecommerce` (Cart, catalog, checkout, coupons, redirects, domains, SEO)
- `Finance` (GL accounts, journal entries, trial balance, AR/AP ledgers)
- `HR` (Employees, attendance, shifts, leave requests, payroll periods)
- `Inventory` (Warehouses, stock movements, bin tracking, transfers)
- `Notifications` (System notifications, alerts)
- `Platform` (Tenant provisioning, plans, subscriptions, feature flags, health, support)
- `Pos` (Counter sales, register shifts, cash float, split tender)
- `Pricing` (Price books, tier discounts, customer-specific pricing)
- `Production` (Plans, batches, stage routing, inputs/outputs, scrap tracking)
- `Purchasing` (Vendors, POs, Goods Receipts / GRN, bills)
- `QC` (Inspection checks, templates, AQL 2.5 defect audits)
- `Reports` (Reporting registry, saved views, async export jobs)
- `Sales` (Sales orders, invoices, payments, CRM leads, commissions)

### 3.2 Routing Topology
Routes are separated into dedicated route files in `backend/routes/`:
- `api_tenant.php` (123 KB): 529 tenant-scoped API endpoints.
- `api_platform.php` (11 KB): 72 master panel platform endpoints.
- `api_storefront.php` (3.7 KB): 59 headless e-commerce endpoints.
- `api_public.php` (4.7 KB): Public health, industry profiles, webhooks.
- `web.php` (2.6 KB): Root redirects, sitemaps, robots.txt, fallback routes.
- `console.php`: Artisan command definitions.

---

## 4. Frontend Architecture Analysis (React 19 / TypeScript)

### 4.1 Modular Layout
The frontend resides in `frontend/src/`:
- `app/`: Application shell, providers, navigation layout.
- `components/`: Atomic UI design system (buttons, inputs, modals, drawers, data tables).
- `modules/`: Feature-aligned domain workspaces (e.g. `reports/ReportsWorkspace.tsx`, `platform/PlatformAdminWorkspace.tsx`, `catalogue/`, `production/`).
- `pages/`: Route-level entry points for ERP, Platform, Auth, and Storefront.
- `lib/api/`: Centralized `apiClient` (`api.get`, `api.post`, `api.patch`, `api.put`, `api.delete`) with correlation IDs, timeout handling, and automatic token refresh.
- `store/`: Zustand stores for auth, cart, UI preferences, and theme.

### 4.2 Type Safety & Compilation
- TypeScript typecheck (`tsc -b --noEmit`) executes cleanly with **0 errors**.
- Strict typing is enforced across API contracts in `src/types/api/`.

---

## 5. Critical Codebase Anomalies Discovered

1. **Route Bloat & Duplication:** 692 routes exist, but **51 actions are registered multiple times across 115 route entries**.
2. **Defensive Frontend Retries:** Frontend code frequently contains fallback chains like `.catch(() => api.xxx(...))` due to route uncertainty.
3. **Mock Data in Production Reporting:** 79 out of 84 reports return static mock arrays rather than querying the database.
4. **IDOR in Report Queries:** Report query classes blindly trust `$filters['tenant_id']` from request parameters.
5. **Missing Tenant Trait:** Operational models (`TenantProductionStage`, `TenantQcTemplate`, `TenantQcCheck`, `TenantModule`, `TenantUsageCounter`) omit the `BelongsToTenant` trait.
6. **Hardcoded Brand Assumption:** "Slice Mart" is hardcoded into `SeoMetadataService`, `RefreshTokenService`, and default templates.
