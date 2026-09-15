# CenterPoint ProERP — Multi-Tenant Enterprise Operating System

[![Build & Test Status](https://img.shields.io/badge/tests-146%20frontend%20%7C%20730%2B%20backend%20passing-emerald.svg?style=flat-square)](#automated-testing--quality-gates)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20Clean-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![Laravel](https://img.shields.io/badge/Laravel-13.x%20REST%20API-red.svg?style=flat-square)](https://laravel.com/)
[![PHP](https://img.shields.io/badge/PHP-8.5%2B-purple.svg?style=flat-square)](https://www.php.net/)
[![React](https://img.shields.io/badge/React-19%20%2B%20Vite%208-cyan.svg?style=flat-square)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4%20Tokens-38bdf8.svg?style=flat-square)](https://tailwindcss.com/)
[![Architecture](https://img.shields.io/badge/Architecture-Three--Tier%20SaaS-indigo.svg?style=flat-square)](#three-tier-system-architecture)
[![Roadmap](https://img.shields.io/badge/Roadmap-26%2F26%20Phases%20Signed%20Off-emerald.svg?style=flat-square)](docs/IMPLEMENTATION_ROADMAP.md)

---

## 📖 Executive Summary

**CenterPoint ProERP** is an enterprise-grade, multi-tenant Factory Management & Omnichannel Retail Operating System designed for modern manufacturing, wholesale distribution, and direct-to-consumer commerce.

Engineered under the **Master System Prompt** and the **Autonomous Implementation Protocol**, SliceMart cleanly decouples platform governance, tenant operations, and public consumer touchpoints into three unified yet strictly isolated layers.

---

## 🏛️ Three-Tier System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 MASTER SAAS CONTROL PLANE (DevCenterPoint)                  │
│   Tenant Provisioning · Plan Limits · Global Metrics · Master Audit Trail   │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │ (Tenant Scope & RBAC)
┌───────────────────────────────────────▼─────────────────────────────────────┐
│                   TENANT MANAGEMENT APPLICATION (ERP / FMS)                 │
│  Manufacturing · Inventory Ledger · 3-Way Match · High-Speed POS · HR & CRM │
│    FIFO/AVCO Finance · 3PL Couriers · RMS Matrix · Physical Printing        │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │ (Storefront API & Custom Domains)
┌───────────────────────────────────────▼─────────────────────────────────────┐
│                     PUBLIC HEADLESS E-COMMERCE STOREFRONT                   │
│   Dynamic Catalog · Shopping Bag · WhatsApp Checkout · Order Tracking · SEO │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **Master Platform (`DevCenterPoint`):** Global superadmin surface for cross-tenant provisioning, subscription plans, platform telemetry, error diagnostics, and system-wide audit logging (`*/login`).
2. **Tenant Management ERP (`CenterPoint ProERP`):** The primary operational hub for day-to-day business operations across manufacturing, warehousing, sales, finance, workforce, and courier dispatch (`*devcenterpoint.com/login`).
3. **Public Headless Storefront:** Lightning-fast, mobile-first consumer storefront featuring instant cart synchronization, direct WhatsApp order routing, order status tracking, and dynamic SEO structured data (`*devcenterpoint.com`).

---

## ⚡ Core Operational Workspaces

| Workspace | Domain & Capabilities | Primary Components / Routes |
|---|---|---|
| **🏢 Master Data & Catalogue** | Global product catalog, variable SKUs, multi-level units of measure, categories, brands, business parties (customers/suppliers), and warehouses. | `CatalogueWorkspace.tsx` (`/catalogue`) |
| **🏭 Manufacturing Chain** | Multi-level Bills of Materials (BOM), batch work orders, worker piece-rate logging, material issue tracking, and production output yields. | `ProductionWorkspace.tsx` (`/production`) |
| **🔬 Quality Control (QC)** | Quality inspection gates, parameter test templates, defect logging, and scrap & wastage governance (Pass / Rework / Scrap / Wastage). | `QcWorkspace.tsx` (`/qc`) |
| **📦 Perpetual Inventory Ledger** | Strict append-only FIFO/AVCO inventory ledger (`stock_balances` cache), multi-warehouse stock allocations, adjustments, movements, and physical stock counting. | `InventoryWorkspace.tsx` (`/inventory`) |
| **🛒 Purchasing & 3-Way Match** | Vendor RFQs, purchase requisitions, PO approval workflows, Goods Receipt Notes (GRN), and 3-way discrepancy validation (PO vs. GRN vs. Bill). | `PurchasingWorkspace.tsx` (`/purchasing`) |
| **⚡ High-Speed POS Terminal** | Offline-resilient dual-session cashier point-of-sale terminal, barcode scanner integration, quick cash presets, thermal receipt printing, and float reconciliation. | `POSShell.tsx`, `PosWorkspace.tsx` (`/pos`) |
| **🤝 CRM & Sales Pipeline** | B2B lead capture, kanban sales pipeline stages, interaction history, corporate account credit limits, and sales rep commission targets. | `SalesWorkspace.tsx` (`/sales`) |
| **🚚 Delivery & Courier 3PL** | Multi-courier integration (Steadfast, Pathao, REDX), consignment dispatch, delivery run sheets, and automated COD reconciliation. | `DeliveryWorkspace.tsx` (`/logistics`) |
| **🛡️ Order Fraud Verification** | Courier delivery performance scoring, customer return risk assessment, phone number verification, and blacklist fraud protection. | `OrderFraudVerificationWorkspace.tsx` (`/fraud-verification`) |
| **👥 HR & Workforce** | Employee directory, shift scheduling, piece-rate incentive rollups, biometric attendance sync, and monthly salary disbursement. | `HrWorkspace.tsx` (`/hr`) |
| **📊 Accounting & Finance** | Double-entry general ledger, automated journal entries from operational events, chart of accounts, banking, expense tracking, and real-time trial balance. | `FinanceWorkspace.tsx` (`/finance`) |
| **🏗️ Fixed Assets & Maintenance** | Asset registry, straight-line and declining depreciation calculation, maintenance work orders, and service logs. | `AssetsWorkspace.tsx` (`/assets`) |
| **🛍️ Storefront CMS & Page Builder** | Dynamic page builder, hero sliders, collection grids, order tracking, and one-click WhatsApp order dispatch. | `StorefrontSettingsWorkspace.tsx`, `StorefrontPageBuilderWorkspace.tsx` (`/storefront`) |
| **📈 RMS Reports Matrix** | 58 canonical analytical reports covering financial statements, inventory aging, sales velocity, production wastage, and courier commissions. | `ReportsWorkspace.tsx` (`/reports`) |
| **🖨️ Document Printing** | Pixel-perfect document generation for Sales Invoices, POs, Challans, Receipts, and thermal barcode labels (A4, A5, 80mm, 58mm). | `DocumentsSection.tsx`, `BarcodeGeneratorModal.tsx` |
| **🛡️ Activity Log & Audit Trail** | Immutable audit logs with before/after JSON diffs, actor attribution, IP/user-agent tracking, and security event auditing. | `ActivityLogWorkspace.tsx` (`/activity-logs`) |
| **🔐 Roles & RBAC Management** | Granular Spatie-compatible Role-Based Access Control matrix with module, resource, and action permissions. | `RolesManagementWorkspace.tsx` (`/settings/roles`) |
| **⚙️ Centralized Settings Center** | 16-domain configuration registry with atomic batch updates, tenant credential vault, and reset-to-default audit tracking. | `SettingsCenterWorkspace.tsx` (`/settings`) |
| **🔔 Notification Center** | Real-time multi-channel notification dispatcher (In-app, SMS, WhatsApp, Email) with deep-link navigation to operational workspaces. | `AppHeader.tsx`, `NotificationController.php` |
| **🌐 SEO & Discoverability** | Dynamic JSON-LD structured data (Product, Organization, Breadcrumbs), IndexNow crawler pings, XML sitemaps, and robots.txt. | `SeoDiscoverabilityWorkspace.tsx` (`/settings/seo`) |
| **👑 Master SaaS Control Plane** | Cross-tenant provisioning, subscription tiers, plan limits, error telemetry, and tenant suspension/activation (`DevCenterPoint`). | `PlatformDashboardWorkspace.tsx` (`/platform`) |

---

## 🛠️ Technology Stack

### Backend Framework & Architecture
- **Framework:** Laravel 13.x (`13.26+`)
- **Runtime:** PHP 8.5+ (strict types enabled across all domain modules)
- **Architecture:** Domain-Driven Design (DDD) with modular monolith boundaries
- **Multi-Tenancy:** Single-database multi-tenancy with tenant identification via subdomain / header and global query scopes (`TenantScope`)
- **Authentication:** Stateless JWT (`firebase/php-jwt` 7.x) with rotating refresh token family tracking and automated theft detection
- **Authorization:** Granular Spatie-compatible Role-Based Access Control (RBAC) with user scope restrictions (branch, factory, warehouse)
- **Database:** SQLite (default zero-config in-memory/file) / MySQL 8.0+ with ACID transactions and compound indexing
- **Queue & Cache:** Database / Redis-backed async job dispatching with exponential backoff retries
- **Code Quality & Testing:** PHPUnit 12.x, Laravel Pint, PHPStan / Larastan 3.x (730+ tests)

### Frontend Application Architecture
- **Framework:** React 19 + TypeScript (Strict Mode, `typescript ~6.0`)
- **Build Tool:** Vite 8.x with fast HMR and tree-shaken bundling
- **State Management:** TanStack React Query v5 (server cache) + Zustand v5 (client UI state)
- **Styling & Tokens:** Tailwind CSS v4 with semantic CSS design tokens supporting seamless Dark & Light theme switching
- **Routing:** React Router v7 with protected routes, platform isolation, and route error boundaries
- **Component Patterns:** Hierarchical 4-Tier Error Boundaries, `useWorkspaceTab` deep-link preservation, and Universal Currency Formatter (`useCurrency()`)
- **Icons & Visuals:** Lucide React icons, Recharts interactive data visualization, Framer Motion, GSAP, Sonner toast notifications, BWIP-js barcodes
- **Code Quality & Testing:** Vitest 4.x + Testing Library (146 unit/component tests passing), ESLint 10.x, Oxlint, Dependency Cruiser

---

## 🚀 Quickstart & Local Setup

### Prerequisites
- **PHP:** 8.4 or higher (PHP CLI, Laragon, or Docker)
- **Composer:** 2.x
- **Node.js:** 22.x LTS or higher (`package.json` specifies `"engines": { "node": ">=22" }`)
- **Git**

### 1. Clone the Repository
```bash
git clone https://github.com/beingmushfiq/SliceMartFMS.git
cd SliceMartFMS/slicemart-fms
```

### 2. Backend Setup
```bash
cd backend
composer install
copy .env.example .env     # On Linux/macOS: cp .env.example .env
php artisan key:generate
php artisan migrate --seed
```

> **Note:** By default, `.env.example` is configured with `DB_CONNECTION=sqlite`, creating a local database automatically with zero database server setup required. For MySQL 8.0+, configure `DB_CONNECTION=mysql` and your database credentials in `.env`.

### 3. Frontend Setup
From the repository root (or inside the `frontend` folder):
```bash
npm install
```

> **Note:** No `.env` file is required for frontend local development. Vite's dev server is preconfigured to automatically proxy `/api` requests to `http://127.0.0.1:8000`.

### 4. Running the Development Servers

**Start Laravel Backend Server (Port 8000):**
```powershell
cd backend
php artisan serve --host=127.0.0.1 --port=8000
```

**Start React Frontend Vite Server (Port 5173):**
```powershell
# From the slicemart-fms workspace root:
npm run dev

# Or directly from the frontend directory:
cd frontend
npm run dev
```

---

## 🌐 Application Access & Endpoints

| Portal / Surface | URL | Description |
|---|---|---|
| **Tenant ERP Workspace** | `http://localhost:5173` | Operational ERP workspace for SliceMart (Tenant #1) |
| **Tenant ERP Dashboard** | `http://localhost:5173/dashboard` | Role-aware operations dashboard & KPI metrics |
| **Public Headless Storefront** | `http://localhost:5173/store/slicemart` | Customer e-commerce catalog with WhatsApp checkout |
| **Master SaaS Control Plane** | `http://localhost:5173/platform` | `DevCenterPoint` global tenant management panel |
| **Master Platform Login** | `http://localhost:5173/platform/login` | Superadmin authentication gateway |
| **Backend REST API** | `http://127.0.0.1:8000/api/v1` | Public and tenant-scoped REST API surfaces |
| **Liveness Health Probe** | `http://127.0.0.1:8000/healthz` | Container liveness check for Kubernetes/Docker |
| **Readiness Health Probe** | `http://127.0.0.1:8000/readyz` | Database & queue connectivity readiness check |

---

### Default Credentials (Seed Data)

#### 👑 Master Platform Superadmin (DevCenterPoint Staff)
Access at: `http://localhost:5173/platform/login`
- **Email:** `admin@devcenterpoint.com`
- **Password:** `PlatformAdmin123!`

#### 🏢 Tenant #1 (SliceMart) Seeded Accounts
Access at: `http://localhost:5173/login`

| Role | Name | Email | Password |
|---|---|---|---|
| **Super Administrator** | System Administrator | `admin@slicemart.test` | `Password123!` |
| **Production Manager** | Hasan Production Lead | `production@slicemart.test` | `Password123!` |
| **QC Inspector** | Farhana QC Lead | `qc@slicemart.test` | `Password123!` |
| **Warehouse Storekeeper** | Rafiq Store In-Charge | `store@slicemart.test` | `Password123!` |
| **Sales Officer** | Tanvir Sales Lead | `sales@slicemart.test` | `Password123!` |

---

## 🧪 Automated Testing & Quality Gates

SliceMart maintains a strict 100% green test policy. No feature or refactor is merged without passing all unit, integration, and typecheck gates.

### Frontend Unit & Component Tests
```bash
# Run Vitest test suite (146 unit & component tests passing)
npm run test --workspace frontend

# Strict TypeScript typechecking (zero errors)
npm run typecheck --workspace frontend

# Dependency cycle validation
npm run depcruise --workspace frontend

# Complete frontend verification suite
npm run verify
```

### Backend Feature & Contract Tests
```bash
cd backend

# Run the complete test suite (730+ tests passing)
php artisan test

# Run specific domain test suites
php artisan test --filter=HealthCheckTest             # Container health probes
php artisan test --filter=RateLimitingTest            # Named rate limiters
php artisan test --filter=DatabaseBackupTest          # Automated backup routine
php artisan test --filter=StorefrontSeoAndDiscoverabilityTest  # Sitemaps & robots
php artisan test --filter=Delivery                   # Courier 3PL & webhooks
php artisan test --filter=Report                     # RMS analytical matrix
php artisan test --filter=DocumentPrintingTest       # Document & thermal labels
php artisan test --filter=TenantSettingsTest         # Centralized enterprise settings
php artisan test --filter=NotificationTest           # Real-time multi-channel alerts
php artisan test --filter=AuthMeTest                 # JWT identity & RBAC resolution
php artisan test --filter=AssetDepreciationTest      # Fixed asset depreciation engine
```

---

## 📚 Canonical Architecture Documentation

Detailed architectural blueprints and module contracts are available in the [`docs/`](docs/) directory:

- [**IMPLEMENTATION_ROADMAP.md**](docs/IMPLEMENTATION_ROADMAP.md) — 26-phase canonical delivery roadmap and sign-off status.
- [**PLATFORM_ARCHITECTURE.md**](docs/PLATFORM_ARCHITECTURE.md) — Multi-tier SaaS architecture and tenant isolation boundaries.
- [**MODULE_ARCHITECTURE.md**](docs/MODULE_ARCHITECTURE.md) — Module taxonomy, domain boundaries, and event lifecycles.
- [**DATABASE_ARCHITECTURE.md**](docs/DATABASE_ARCHITECTURE.md) — ERD definitions, composite indexing, and schema rules.
- [**API_ARCHITECTURE.md**](docs/API_ARCHITECTURE.md) — RESTful envelope standard (`RFC 7807`) and JWT authentication.
- [**DESIGN_SYSTEM.md**](docs/DESIGN_SYSTEM.md) — UI tokens, responsive layouts, and universal currency formatting.
- [**ROLE_PERMISSION_MATRIX.md**](docs/ROLE_PERMISSION_MATRIX.md) — Granular RBAC permissions catalog.
- [**QA_CHECKLIST.md**](docs/QA_CHECKLIST.md) — 10-point mandatory enterprise quality assurance gates.
- [**RMS_REPORT_MATRIX.md**](docs/RMS_REPORT_MATRIX.md) — Registry of 58 analytical enterprise reports.
- [**SETTINGS_ARCHITECTURE.md**](docs/SETTINGS_ARCHITECTURE.md) — 16-domain centralized settings architecture.
- [**DOCUMENT_PRINTING_ARCHITECTURE.md**](docs/DOCUMENT_PRINTING_ARCHITECTURE.md) — Thermal label & invoice printing specification.
- [**SEO_ARCHITECTURE.md**](docs/SEO_ARCHITECTURE.md) — Dynamic JSON-LD structured data and search indexation.
- [**DECISIONS.md**](docs/DECISIONS.md) — Architectural Decision Records (ADRs).

---

## 🔒 Security & Data Integrity Standards

1. **Multi-Tenant Data Isolation:** Every database entity is constrained by `tenant_id` and enforced through Eloquent global query scopes (`TenantScope`). Cross-tenant access strictly returns `404 Not Found` rather than `403 Forbidden` to guarantee tenant existence confidentiality.
2. **Brute-Force & Rate Limiting:** Named rate limiters for login (5 attempts / 5 mins), public storefront (120 req/min), and webhooks (600 req/min).
3. **Sensitive Data Redaction:** API credentials, webhook secrets, and private keys are encrypted at rest with AES-256 and masked in UI views.
4. **Resilient Error Handling:** 4-tier error boundary architecture catches runtime errors gracefully without white screens, maintaining state preservation and diagnostic references.
5. **Strict Monetary & Quantity Precision:** Financial and inventory quantities are stored in `DECIMAL(18,4)` and transmitted over the API wire as precise JSON strings.

---

## 📄 License & Maintainer

Maintained by **Mushfiqur Rahman** (`beingmushfiq@gmail.com`).  
All rights reserved. Designed and developed as a modern enterprise SaaS platform.
