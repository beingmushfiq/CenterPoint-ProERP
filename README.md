<div align="center">

# ⚡ CenterPoint ProERP
### Next-Generation Industrial Manufacturing & Omnichannel Retail Operating System

[![Build & Test Status](https://img.shields.io/badge/Test%20Suite-730%2B%20PHPUnit%20%7C%20146%20Vitest%20Passing-10b981?style=for-the-badge&logo=githubactions&logoColor=white)](#-automated-testing--quality-gates)
[![API Verification](https://img.shields.io/badge/API%20Routes-706%20Wired%20%7C%200%20Unmatched%20Endpoints-10b981?style=for-the-badge&logo=fastapi&logoColor=white)](#-automated-testing--quality-gates)
[![Localization](https://img.shields.io/badge/Localization-100%25%20Bilingual%20(English%20%7C%20বাংলা)-10b981?style=for-the-badge&logo=googletranslate&logoColor=white)](#-bilingual-localization--globalization)
[![PHP](https://img.shields.io/badge/PHP-8.4%2B%20Strict-777BB4?style=for-the-badge&logo=php&logoColor=white)](https://www.php.net/)
[![Laravel](https://img.shields.io/badge/Laravel-13.x%20Modular-FF2D20?style=for-the-badge&logo=laravel&logoColor=white)](https://laravel.com/)
[![React](https://img.shields.io/badge/React-19.2%20Strict-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20Zero--Error-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4%20Design%20Tokens-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Engineered By](https://img.shields.io/badge/Engineered%20By-DevCenterPoint-4f46e5?style=for-the-badge&logo=cloud&logoColor=white)](https://devcenterpoint.com)

<br/>

<p align="center">
  <b>CenterPoint ProERP</b> is an enterprise-grade, high-throughput multi-tenant <b>Factory Management System (FMS)</b> and <b>Omnichannel Retail ERP</b>.<br/>
  Engineered with strict domain-driven modularity, it unifies factory-floor manufacturing with headless direct-to-consumer e-commerce, perpetual inventory accounting, multi-courier 3PL parcel logistics, and native bilingual (English / বাংলা) operations.
</p>

<p align="center">
  <a href="#-key-platform-metrics"><b>📊 Metrics</b></a> •
  <a href="#-quickstart--local-setup"><b>🚀 Quickstart Guide</b></a> •
  <a href="#-three-tier-system-architecture"><b>🏗️ Architecture</b></a> •
  <a href="#-core-feature-deep-dive--visual-workspaces"><b>✨ Feature Deep Dive</b></a> •
  <a href="#-demo--testing-credentials"><b>🔑 Demo Personas</b></a> •
  <a href="#-canonical-architecture-documentation"><b>📚 Docs</b></a>
</p>

</div>

---

## 📊 Key Platform Metrics

```
┌──────────────────────────┬──────────────────────────┬──────────────────────────┬──────────────────────────┐
│      17 WORKSPACES       │      84 RMS REPORTS      │     3 TOP 3PL CARRIERS   │     100% BILINGUAL       │
│  Full Manufacturing,     │ Financial P&L, Balance   │ Steadfast, Pathao, REDX  │ Pure English & বাংলা     │
│  POS, B2B, HR & Assets   │ Sheets & Inventory Aging │ Automated Consignments   │ All Modules & Documents  │
└──────────────────────────┴──────────────────────────┴──────────────────────────┴──────────────────────────┘
```

---

## 🧭 Table of Contents

- [🏛️ Executive Summary & Core Philosophy](#️-executive-summary--core-philosophy)
- [🌐 Bilingual Localization & Globalization](#-bilingual-localization--globalization)
- [🔄 End-to-End Operational Pipeline](#-end-to-end-operational-pipeline)
- [🏗️ Three-Tier System Architecture](#️-three-tier-system-architecture)
- [✨ Core Feature Deep Dive & Visual Workspaces](#-core-feature-deep-dive--visual-workspaces)
- [🛠️ Technology Stack & Engineering Standards](#️-technology-stack--engineering-standards)
- [🚀 Quickstart & Local Setup](#-quickstart--local-setup)
- [🌐 Application Portals & Endpoints](#-application-portals--endpoints)
- [🔑 Demo & Testing Credentials](#-demo--testing-credentials)
- [🧪 Automated Testing & Quality Gates](#-automated-testing--quality-gates)
- [🔒 Security & Data Confidentiality Standards](#-security--data-confidentiality-standards)
- [📚 Canonical Architecture Documentation](#-canonical-architecture-documentation)
- [👥 Authors & Maintainers](#-authors--maintainers)

---

## 🏛️ Executive Summary & Core Philosophy

**CenterPoint ProERP** was engineered by **[DevCenterPoint](https://devcenterpoint.com)** under the **Master Autonomous Implementation Protocol** to eliminate friction between industrial factory production, warehouse stock ledgers, and omnichannel consumer commerce.

> [!IMPORTANT]
> **The Golden Architectural Tenet:**  
> *Never hardcode tenant-specific assumptions into the SaaS platform. The system natively provides multi-tenant, multi-currency, and multi-industry scalability with absolute tenant isolation at the database, cache, storage, and API routing tiers. SliceMart is Tenant #1—demonstrating real-world industrial and retail capability.*

### Key Strategic Pillars:

| Pillar | Architectural Guarantee | Business Impact |
| :--- | :--- | :--- |
| **🔒 Strict Multi-Tenancy** | Single-database schema with automatic Eloquent query scoping (`TenantScope`), emitting `404 Not Found` for unauthorized tenant entities. | Eliminates cross-tenant data leakage while keeping operational database costs low. |
| **🌐 Native Bilingual** | First-class **English & Bengali (বাংলা)** language parity across all 12 workspaces, documents, receipts, and storefront. | Eliminates training barriers for factory-floor workers, cashiers, and native-speaking staff. |
| **⚡ Perpetual Ledger** | Append-only FIFO and AVCO (Average Cost) valuation with `DECIMAL(18,4)` precision, now supporting transactional balance deletions with balancing audit entries. | Guarantees audit-compliant financial reports and zero floating-point rounding errors. |
| **🛍️ Omnichannel Sync** | Instant inventory reservation across factory output, POS registers, wholesale B2B quotes, and headless storefronts. | Completely prevents overselling across digital storefronts and physical counters. |
| **📦 3PL Courier Integration** | Automated consignment booking, barcode shipping labels, and COD reconciliation for Steadfast, Pathao, and REDX. | Accelerates fulfillment from hours to seconds with live tracking webhooks. |
| **🛡️ Delivery Fraud Defense** | Machine-assisted delivery success scoring, return risk analysis, and customer phone blacklists. | Dramatically decreases costly returned consignments (RTO). |

---

## 🌐 Bilingual Localization & Globalization

CenterPoint ProERP features a complete, zero-compromise bilingual implementation:

- **Universal Language Switcher:** Accessible in the top navigation header, platform sidebars, e-commerce storefront navbar, and storefront footer.
- **Pure Typography Foundation:** Seamless integration of Google Fonts (`Hind Siliguri` and `Noto Sans Bengali`) ensuring crisp, beautiful Bengali rendering alongside standard Latin fonts.
- **Deep Translation Coverage:** All 12 operational modules, data tables, filter badges, confirmation modals, error alerts, print documents (Invoices, Challans, Goods Receipts, POs, Thermal Slips), and platform administrative tools seamlessly switch between **English** and **বাংলা**.
- **Context-Aware Date & Currency Formatting:** Native BDT (`৳`) and international currency representations formatted to locale standards.

---

## 🔄 End-to-End Operational Pipeline

CenterPoint ProERP natively tracks items through their entire lifecycle—from raw material purchase requisition to automated parcel dispatch and ledger reconciliation:

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                           CENTERPOINT PROERP OPERATIONAL PIPELINE                          │
└───────────────────────────────────────────────────────────────────────────────────────────┘

  [1. SOURCING & PROCUREMENT]
     ├── Purchase Requisitions (Dept. Approval Workflow)
     ├── Supplier RFQs & Comparative Quotes
     └── Purchase Orders (Multi-Tier Approval Gates)
              │
              ▼
  [2. RECEIPT & QUALITY CONTROL]
     ├── Goods Receipt Notes (GRN) with Multi-Bin Staging
     ├── 3-Way Discrepancy Matching (PO vs. Receipt vs. Invoice)
     └── Pre-Production & Final QC Gates (AQL Defect Disposition)
              │
              ▼
  [3. INDUSTRIAL MANUFACTURING]
     ├── Multi-Level Bill of Materials (BOM) with Scrap Ratios
     ├── Batch Production Work Orders (Machine & Shift Scheduling)
     └── Worker Piece-Rate Ledger (Biometric Attendance & Pay Rollup)
              │
              ▼
  [4. PERPETUAL INVENTORY LEDGER]
     ├── Append-Only Stock Movements (AVCO / FIFO Valuation)
     ├── Multi-Warehouse Bin Allocations & Inter-Branch Transfers
     ├── Barcode Scanner Cycle Counts & Discrepancy Adjustments
     └── Single & Bulk Balance Deletion with Offsetting Audit Movements
              │
              ▼
  [5. OMNICHANNEL SALES ENGINE]
     ├── B2B Wholesale CRM (Kanban Pipeline, Quotes, Credit Guards)
     ├── High-Speed POS Terminal (Offline Dual-Session, Thermal Slips)
     └── Headless DTC E-Commerce (CMS Builder, WhatsApp / COD Cart)
              │
              ▼
  [6. LOGISTICS & 3PL AUTOMATION]
     ├── One-Click Consignment Booking (Steadfast · Pathao · REDX)
     ├── Barcode Shipping Labels (A4, A5, 4x6 Thermal) & Courier Run Sheets
     └── Webhook Delivery Telemetry & Automated COD Balance Reconciliation
              │
              ▼
  [7. FINANCIAL SETTLEMENT & ANALYTICS]
     ├── Double-Entry General Ledger (Automated Real-Time Journals)
     ├── Multi-Bank Reconciliation & Petty Cash Vouchers
     └── 84 RMS Canonical Analytical Reports (P&L, Balance Sheet, Yield)
```

---

## 🏗️ Three-Tier System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                         MASTER PLATFORM CONTROL PLANE (DevCenterPoint)                    │
│   Tenant Provisioning · Subscription Plans · Quotas · Telemetry · Master Audit Trail     │
│   Domain: https://demoerp.devcenterpoint.com/platform                                    │
└────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │  (Tenant Scoping, RBAC & Quota Verification)
┌────────────────────────────────────────────▼─────────────────────────────────────────────┐
│                       TENANT MANAGEMENT WORKSPACE (ERP / FMS Suite)                      │
│   BOM & Batch Work Orders · Perpetual Inventory · 3-Way Match · High-Speed POS Terminal │
│   Sales Pipelines · Double-Entry Accounting · 3PL Couriers · 84 RMS Analytical Reports   │
│   Domain: https://demoerp.devcenterpoint.com/                                            │
└────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │  (Headless Storefront API & Custom Domains)
┌────────────────────────────────────────────▼─────────────────────────────────────────────┐
│                        PUBLIC HEADLESS E-COMMERCE STOREFRONT                             │
│   Dynamic CMS Page Builder · Live Cart Sync · WhatsApp Order Routing · Track Parcel      │
│   Domain: https://demoerp.devcenterpoint.com/store/:subdomain                            │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Master SaaS Control Plane (`DevCenterPoint`):** Global superadmin surface for managing tenant lifecycles, subscription quotas, feature flags, system health telemetry, and cross-platform audit trails.
2. **Tenant Operations Workspace (`CenterPoint ProERP`):** Core daily operations cockpit for production managers, warehouse storekeepers, QC inspectors, accountants, sales reps, and cashiers.
3. **Public Storefront Layer:** Lightning-fast, mobile-first consumer storefront with responsive layouts, JSON-LD structured metadata, server-side caching, bilingual locale selection, and frictionless one-click WhatsApp/COD checkout.

---

## ✨ Core Feature Deep Dive & Visual Workspaces

CenterPoint ProERP features **17 integrated operational workspaces**, accessible through a unified responsive shell with role-based visibility:

### 1. 🏭 Manufacturing & Production Chain
- **Multi-Level Bill of Materials (BOM):** Nested component hierarchy with yield percentage calculations, auxiliary scrap allowances, and dynamic raw material costing.
- **Batch Work Orders:** Real-time production tracking from staging to completion with automated raw material reservation and finished goods capitalization.
- **Worker Piece-Rate Ledger:** Track individual worker output per shift with tiered incentive pay computation and payroll integration.
- **Scrap & Waste Analytics:** Record component defects during manufacturing with scrap disposition analysis.
- **Entry File:** [`frontend/src/modules/production/ProductionWorkspace.tsx`](frontend/src/modules/production/ProductionWorkspace.tsx)

---

### 2. 🔬 Quality Control (QC) Inspection Gates
- **Three Inspection Gates:** Pre-production material validation, in-line assembly checkpoints, and finished-goods pre-dispatch testing.
- **Configurable Test Criteria:** Parameterized inspection templates with numeric ranges, boolean checks, and photo evidence uploads.
- **AQL Defect Disposition:** Instant quarantine routing for failed lots with rework or scrap disposition workflows.
- **Entry File:** [`frontend/src/modules/qc/QcWorkspace.tsx`](frontend/src/modules/qc/QcWorkspace.tsx)

---

### 3. 📦 Perpetual Inventory Ledger & Warehousing
- **Dual Costing Models:** Native AVCO (Average Cost) and FIFO stock valuation maintained in `DECIMAL(18,4)` precision.
- **Multi-Warehouse & Multi-Bin:** Organize inventory across physical factory warehouses, staging zones, and shelf bins.
- **Immutable Audit Trail:** Append-only ledger where every stock movement references its initiating transaction (PO, Work Order, Invoice, or Adjustment).
- **Barcode Cycle Counting:** Hardware scanner integration for physical stock audits with reconciliation discrepancy journals.
- **Single & Bulk Position Deletion:** Safely remove obsolete or zeroed inventory positions individually or in batch, with automated offsetting audit ledger movement entries to preserve ledger equilibrium.
- **Entry File:** [`frontend/src/modules/inventory/InventoryWorkspace.tsx`](frontend/src/modules/inventory/InventoryWorkspace.tsx)

---

### 4. 🛒 Purchasing & 3-Way Match Validation
- **Requisition Hierarchy:** Departmental purchase requests with multi-tier approval thresholds.
- **Supplier RFQs:** Send and compare quotation bids from multiple vendors with historical pricing trends.
- **3-Way Matching:** Automated discrepancy protection between Purchase Order, Goods Receipt Note (GRN), and Vendor Bill.
- **Debit Notes & Returns:** Manage vendor returns with automated debit note generation and credit ledger updates.
- **Entry File:** [`frontend/src/modules/purchasing/PurchasingWorkspace.tsx`](frontend/src/modules/purchasing/PurchasingWorkspace.tsx)

---

### 5. ⚡ High-Speed POS Terminal
- **Dual-Session Cashier Float:** Track opening cash floats, mid-shift drops, and closing drawer balances with variance reports.
- **Hardware Integration:** Compatible with USB/Bluetooth barcode scanners, thermal receipt printers (58mm, 80mm), and cash drawers.
- **Rapid Keyboard Shortcuts:** Instant cashier workflows for discounts, customer search, multiple tender types, and quick cash buttons.
- **Offline Resilience:** Local transaction queue ensuring sales continue smoothly even during intermittent network drops.
- **Entry File:** [`frontend/src/modules/pos/POSShell.tsx`](frontend/src/modules/pos/POSShell.tsx)

---

### 6. 🤝 B2B Sales & CRM Pipeline
- **Visual Kanban Pipeline:** Track leads from initial inquiry to negotiation, quotation, and contract closure.
- **Credit Limit Guards:** Automatic checkout locking for wholesale clients exceeding credit lines or with overdue invoices.
- **Challan & Invoice Lifecycle:** Pro-forma invoices, formal tax invoices, partial dispatches, and delivery challans.
- **Entry File:** [`frontend/src/modules/sales/SalesWorkspace.tsx`](frontend/src/modules/sales/SalesWorkspace.tsx)

---

### 7. 🚚 Logistics & 3PL Courier Hub
- **Integrated Couriers:** Native API integrations for **Steadfast**, **Pathao**, and **REDX**.
- **Automated Consignments:** Single-click consignment booking with automated barcode shipping label generation.
- **Webhook Status Sync:** Instant parcel status updates (Delivered, In Transit, Returned, Cancelled).
- **COD Reconciliation:** Track courier cash collections against bank deposits with automated discrepancy alerts.
- **Entry File:** [`frontend/src/modules/delivery/DeliveryWorkspace.tsx`](frontend/src/modules/delivery/DeliveryWorkspace.tsx)

---

### 8. 🛡️ Anti-Fraud & Risk Score Engine
- **Delivery Success Rate:** Phone-number intelligence scoring based on historical courier delivery success rates.
- **Return Risk Profiling:** Flag high-risk COD orders before dispatch to reduce Return to Origin (RTO) costs.
- **Automated Blacklist:** Centralized customer phone and address blacklist across all storefront channels.
- **Entry File:** [`frontend/src/modules/fraud/OrderFraudVerificationWorkspace.tsx`](frontend/src/modules/fraud/OrderFraudVerificationWorkspace.tsx)

---

### 9. 🛍️ Headless Storefront & CMS Builder
- **Drag-and-Drop Visual Page Builder:** Hero carousels, featured collections, banner grids, and marquee tickers.
- **One-Click WhatsApp Checkout:** Direct cart-to-WhatsApp order dispatch with pre-filled product SKU and customer details.
- **Interactive Language Switcher:** Sleek header and footer pills enabling instant toggle between English and Bengali without page refresh.
- **SEO & Search Feeds:** Direct portal controls for XML sitemaps, robots.txt, Google Search Console, Bing Webmaster tools, and JSON-LD Schema (`Product`, `BreadcrumbList`, `Organization`).
- **Mobile-First Responsive Layout:** Zero horizontal scroll overflow with high-speed sliding cart and wishlist drawers.
- **Entry File:** [`frontend/src/modules/storefront/StorefrontPageBuilderWorkspace.tsx`](frontend/src/modules/storefront/StorefrontPageBuilderWorkspace.tsx)

---

### 10. 📊 Accounting & Financial Ledger
- **Double-Entry General Ledger:** Automatic event-driven journal generation from sales, purchases, inventory, and payroll.
- **Multi-Bank Reconciliations:** Import bank statements, reconcile transactions, and audit petty cash vouchers.
- **Real-Time Financial Statements:** Instantly generate Trial Balances, Balance Sheets, and Profit & Loss (P&L) statements.
- **Entry File:** [`frontend/src/modules/finance/FinanceWorkspace.tsx`](frontend/src/modules/finance/FinanceWorkspace.tsx)

---

### 11. 📈 RMS Analytical Matrix (84 Reports across 12 Modules)
- **84 Canonical Reports:** Dedicated analytical reports across all 12 operational modules (Production: 12, Inventory: 11, Purchasing: 7, Sales: 10, Profit: 5, CRM: 7, Salesmen: 5, Delivery: 7, HR: 5, Finance: 7, Assets: 5, QC: 3).
- **Export Formats:** High-precision CSV, Excel, and pixel-perfect printable PDF reports.
- **Entry File:** [`frontend/src/modules/reports/ReportsWorkspace.tsx`](frontend/src/modules/reports/ReportsWorkspace.tsx)

---

### Complete Workspaces Summary Matrix

| Workspace | Scope & Enterprise Capabilities | Key Route / Workspace Entry |
| :--- | :--- | :--- |
| **🏢 Master Data & Catalogue** | Categories, brands, variable SKUs, multi-UOM conversions, customer/supplier profiles, bins. | [`/catalogue`](frontend/src/modules/catalogue/CatalogueWorkspace.tsx) |
| **🏭 Manufacturing Chain** | Multi-tier BOMs, batch production work orders, worker piece-rate tracking, scrap analysis. | [`/production`](frontend/src/modules/production/ProductionWorkspace.tsx) |
| **🔬 Quality Control (QC)** | Pre-production, in-line, final inspection gates, test parameter templates, defect logging. | [`/qc`](frontend/src/modules/qc/QcWorkspace.tsx) |
| **📦 Perpetual Inventory Ledger** | Immutable audit-logged stock balances, multi-bin allocations, stock transfers, barcode counts, position deletion. | [`/inventory`](frontend/src/modules/inventory/InventoryWorkspace.tsx) |
| **🛒 Purchasing & 3-Way Match** | Vendor RFQs, purchase requisitions, PO approval hierarchies, GRN, 3-way discrepancy validation. | [`/purchasing`](frontend/src/modules/purchasing/PurchasingWorkspace.tsx) |
| **⚡ High-Speed POS Terminal** | Offline-ready dual-session cashier POS, hardware scanner support, thermal receipts, shift audits. | [`/pos`](frontend/src/modules/pos/POSShell.tsx) |
| **🤝 CRM & B2B Sales** | Lead tracking, kanban opportunity pipeline, customer credit limit guards, quotations, challans. | [`/sales`](frontend/src/modules/sales/SalesWorkspace.tsx) |
| **🚚 Logistics & 3PL Couriers** | Automated dispatch via Steadfast, Pathao, REDX, digital courier run sheets, COD balance audits. | [`/logistics`](frontend/src/modules/delivery/DeliveryWorkspace.tsx) |
| **🛡️ Anti-Fraud & Risk Score** | Delivery success rate scoring, phone number authenticity checks, return risk profiling. | [`/fraud-verification`](frontend/src/modules/fraud/OrderFraudVerificationWorkspace.tsx) |
| **👥 HR & Payroll Engine** | Employee directory, shift scheduling, piece-rate incentive rollups, biometric attendance, slips. | [`/hr`](frontend/src/modules/hr/HrWorkspace.tsx) |
| **📊 Accounting & Finance** | Double-entry general ledger, automated event-based journal entries, multi-bank reconciliations. | [`/finance`](frontend/src/modules/finance/FinanceWorkspace.tsx) |
| **🏗️ Fixed Assets & Maintenance** | Asset capitalization, straight-line and reducing balance depreciation, maintenance schedules. | [`/assets`](frontend/src/modules/assets/AssetsWorkspace.tsx) |
| **🛍️ Storefront CMS Builder** | Visual block page builder, hero sliders, collection highlights, announcement tickers, SEO & feed controls. | [`/storefront`](frontend/src/modules/storefront/StorefrontPageBuilderWorkspace.tsx) |
| **📈 RMS Analytical Matrix** | 84 canonical analytical reports covering financial P&L, balance sheets, inventory aging. | [`/reports`](frontend/src/modules/reports/ReportsWorkspace.tsx) |
| **🖨️ Document & Barcode Engine** | Pixel-perfect printing for Tax Invoices, Challans, POs, Receipts, thermal barcode stickers. | [`Unified Document Modal`](frontend/src/components/documents/DocumentModal.tsx) |
| **🔐 RBAC & Security Center** | Granular module, resource, and action permissions with factory and warehouse scope boundaries. | [`/settings/roles`](frontend/src/modules/settings/RolesManagementWorkspace.tsx) |
| **⚙️ Central Settings Registry** | 16 configuration domains with atomic transactional persistence, secure credential encryption, branding by DevCenterPoint. | [`/settings`](frontend/src/modules/settings/SettingsCenterWorkspace.tsx) |
| **👑 SaaS Platform Control** | Master multi-tenant administration, tenant quotas, domain mapping, error telemetry. | [`/platform`](frontend/src/modules/platform/PlatformDashboardWorkspace.tsx) |

---

## 🛠️ Technology Stack & Engineering Standards

### Backend Engine
```
PHP 8.4+ Strict Types ──▶ Laravel 13.x Modular Monolith ──▶ MySQL 8.0 / SQLite ──▶ Redis Queues & Caching
```
- **Framework:** Laravel 13.x running under **PHP 8.4 or higher** with `declare(strict_types=1);` on every file.
- **Architecture:** Domain-Driven Design (DDD) modular monolith split into discrete feature modules (`Catalogue`, `Production`, `Qc`, `Inventory`, `Sales`, `Purchasing`, `Finance`, `Delivery`, `Pos`, `Hr`, `Ecommerce`, `Platform`).
- **Security & Tokens:** Stateless JWT authentication (`firebase/php-jwt`) with rotating refresh token family tracking, revocation cascades, and automated replay/theft detection.
- **Multi-Tenant Context:** `TenantContext` singleton auto-resolved via subdomain or `X-Tenant-ID` header, securing all Eloquent models via `BelongsToTenant` trait.
- **Database Engine:** MySQL 8.0+ (Production) / SQLite (Zero-config local development and testing) with atomic DB transactions across multi-step mutations.

### Frontend Architecture
```
React 19.2 (Strict) ──▶ Vite 8.x + Rolldown ──▶ Tailwind CSS v4 ──▶ TanStack Query v5 + Zustand v5
```
- **Framework & Language:** React 19.2 + TypeScript Strict Mode (`noImplicitAny: true`, clean typechecking).
- **Styling System:** Tailwind CSS v4 CSS-first design token architecture supporting high-contrast Dark & Light themes without visual flickering.
- **State Management:** TanStack React Query v5 for optimistic server synchronization + Zustand v5 for reactive client-side store isolation.
- **Resilience:** 4-Tier Hierarchical Error Boundaries preventing white-screen crashes, combined with graceful error toast dispatching.
- **Routing & Navigation:** React Router v7 with deep-linked workspace tab synchronization (`useWorkspaceTab`).

---

## 🚀 Quickstart & Local Setup

### System Prerequisites
Ensure the following tools are installed on your workstation:
- **PHP:** `8.4` or higher (CLI, Laragon, or Docker) with `pdo`, `mbstring`, `openssl`, and `gd` extensions enabled.
- **Composer:** `2.x`
- **Node.js:** `22.x LTS` or higher (`package.json` specifies `"engines": { "node": ">=22" }`)
- **Git**

---

### Step 1: Clone Repository
```bash
git clone https://github.com/beingmushfiq/CenterPoint-ProERP.git
cd CenterPoint-ProERP
```

---

### Step 2: Backend Initialization
```bash
cd backend

# Install PHP dependencies
composer install

# Environment configuration
cp .env.example .env

# Generate application encryption key
php artisan key:generate

# Execute migrations and seed demo data (defaults to SQLite zero-config)
php artisan migrate --seed
```

> [!TIP]
> By default, `.env.example` is pre-configured with `DB_CONNECTION=sqlite`, automatically provisioning `database/database.sqlite`. To use MySQL, update your `.env` credentials and run `php artisan migrate --seed`.

---

### Step 3: Frontend Initialization
From the repository root:
```bash
# Install NPM dependencies
npm install

# Build the frontend bundle
npm run build --workspace frontend

# Synchronize distribution files to public_html (for web server deployment)
node scripts/sync_public_html.cjs
```

> [!NOTE]
> No `.env` file is required for frontend local development! Vite is preconfigured to automatically reverse-proxy API queries from `http://localhost:5173/api` to `http://127.0.0.1:8000`.

---

### Step 4: Running Development Servers

Open two terminal sessions:

**Terminal 1 — Backend REST API:**
```bash
cd backend
php artisan serve --host=127.0.0.1 --port=8000
```

**Terminal 2 — Frontend Vite Application:**
```bash
# From repository root:
npm run dev

# Or from the frontend directory:
cd frontend
npm run dev
```

---

## 🌐 Application Portals & Endpoints

| Portal / Touchpoint | Local Access URL | Production Domain | Primary Description |
| :--- | :--- | :--- | :--- |
| **🏢 Tenant ERP Workspace** | `http://localhost:5173/` | `https://demoerp.devcenterpoint.com/` | Primary operational ERP dashboard and workspaces |
| **🛍️ Public Headless Storefront** | `http://localhost:5173/store/slicemart` | `https://demoerp.devcenterpoint.com/store/slicemart` | Headless e-commerce catalog with WhatsApp checkout |
| **👑 Master SaaS Control Plane** | `http://localhost:5173/platform` | `https://demoerp.devcenterpoint.com/platform` | Superadmin tenant provisioning & platform telemetry |
| **🔌 Backend API Surface** | `http://127.0.0.1:8000/api/v1` | `https://demoerp.devcenterpoint.com/api/v1` | Strict REST API with RFC 7807 envelope specifications |
| **🩺 Liveness Health Probe** | `http://127.0.0.1:8000/healthz` | `https://demoerp.devcenterpoint.com/healthz` | Container orchestration liveness health check |
| **⚡ Readiness Health Probe** | `http://127.0.0.1:8000/readyz` | `https://demoerp.devcenterpoint.com/readyz` | Database, cache, and queue readiness validation probe |

---

## 🔑 Demo & Testing Credentials

The automated database seeder provisions verified personas across all operational tiers:

### 👑 Master SaaS Platform Superadmin
- **Login Portal:** `http://localhost:5173/platform/login`
- **Email:** `admin@devcenterpoint.com`
- **Password:** `PlatformAdmin123!`

---

### 🏢 Tenant #1 (SliceMart Industrial) Personas
- **Login Portal:** `http://localhost:5173/login`

| Persona / Role | Email | Password | Primary Domain Area |
| :--- | :--- | :--- | :--- |
| **Super Administrator** | `admin@slicemart.test` | `Password123!` | Full enterprise tenant access & role management |
| **Production Manager** | `production@slicemart.test` | `Password123!` | BOMs, batch work orders, worker piece-rate logs |
| **Quality Inspector** | `qc@slicemart.test` | `Password123!` | Test inspection gates, defect records, scrap tracking |
| **Warehouse Storekeeper**| `store@slicemart.test` | `Password123!` | Inventory ledger, transfers, and Goods Receipts |
| **Sales Officer** | `sales@slicemart.test` | `Password123!` | B2B lead CRM, invoices, dispatch, and delivery orders |

---

## 🧪 Automated Testing & Quality Gates

CenterPoint ProERP maintains a **100% green build policy**. Every commit and pull request must satisfy frontend unit tests, strict TypeScript checks, dependency verification, and backend feature contract tests.

### Frontend Quality Commands
```bash
# Execute Vitest component and unit test suite (146 tests passing)
npm run test --workspace frontend

# Strict TypeScript typecheck (zero errors)
npm run typecheck --workspace frontend

# Complete frontend production build
npm run build --workspace frontend

# Synchronize build assets to public_html/
node scripts/sync_public_html.cjs
```

### Backend Quality Commands
```bash
cd backend

# Execute complete backend PHPUnit test suite (730+ tests passing)
php artisan test

# Verify specific domain feature suites
php artisan test --filter=DataBinTest                     # Soft-delete data bin & restore
php artisan test --filter=HealthCheckTest                 # Container liveness probes
php artisan test --filter=RateLimitingTest                # Named rate limiters
php artisan test --filter=StorefrontSeoAndDiscoverability # Dynamic XML sitemaps & SEO
php artisan test --filter=Delivery                        # 3PL courier consignment dispatch
php artisan test --filter=Report                          # 84 RMS canonical analytical reports
```

### API Connection Auditing & Full Route Coverage Verification
To verify that every frontend API call site aligns with compiled backend route signatures and that all backend endpoints are wired into frontend workspaces:
```bash
# 1. Verify 100% backend route wiring:
node scripts/find_uncalled_routes.cjs

# 2. Verify all frontend API call sites map to registered backend routes:
node scripts/audit_api.cjs
```
> **Audit Status:**  
> • **Route Coverage:** `706 registered backend routes` with 100% route alignment.  
> • **Endpoint Alignment:** `791+ frontend API call sites` with **0 unmatched endpoints**.  
> • **Type Safety:** `0 TypeScript errors` under `tsc -b` and clean production bundling (`npm run build`).

---

## 🔒 Security & Data Confidentiality Standards

1. **Strict Tenant Data Isolation:** All Eloquent models inherit `BelongsToTenant`. Every database query is automatically scoped with `tenant_id`. Any attempt to cross-access entities belonging to another tenant returns `404 Not Found` rather than `403 Forbidden`, safeguarding against tenant existence discovery.
2. **Rotating Refresh Token Security:** Refresh tokens are tracked in cryptographic families. Any replay of an already-used token triggers an instant family revocation cascade to protect against credential interception.
3. **AES-256 Secret Vault:** Courier API keys, webhook signing secrets, SMS gateway tokens, and payment credentials are encrypted at rest using AES-256 and masked in user interfaces.
4. **Adaptive Rate Limiting:** Granular throttling per route classification:
   - Login attempts: `5 requests / 5 minutes` per IP/email
   - Public headless storefront: `120 requests / minute`
   - Logistics webhooks: `600 requests / minute`
5. **Precision Monetary Standard:** Monetary totals and inventory counts are computed and persisted in `DECIMAL(18,4)` format and transmitted as JSON strings to avoid JavaScript floating-point rounding errors.

---

## 📚 Canonical Architecture Documentation

Comprehensive engineering blueprints, module lifecycles, and database schemas are maintained in the [`docs/`](docs/) directory:

- 📋 [**IMPLEMENTATION_ROADMAP.md**](docs/IMPLEMENTATION_ROADMAP.md) — 26-phase delivery roadmap and sign-off criteria.
- 🏛️ [**PLATFORM_ARCHITECTURE.md**](docs/PLATFORM_ARCHITECTURE.md) — Multi-tier SaaS architecture and boundary specifications.
- 📦 [**MODULE_ARCHITECTURE.md**](docs/MODULE_ARCHITECTURE.md) — Domain taxonomy, entity relations, and event lifecycles.
- 🗄️ [**DATABASE_ARCHITECTURE.md**](docs/DATABASE_ARCHITECTURE.md) — Complete ERDs, index catalogs, and ledger constraints.
- 🌐 [**API_ARCHITECTURE.md**](docs/API_ARCHITECTURE.md) — RESTful envelope standard (`RFC 7807`) and JWT lifecycle.
- 🎨 [**DESIGN_SYSTEM.md**](docs/DESIGN_SYSTEM.md) — Semantic design tokens, dark/light themes, and UI primitives.
- 🔐 [**ROLE_PERMISSION_MATRIX.md**](docs/ROLE_PERMISSION_MATRIX.md) — Role definitions and granular permission catalogue.
- 📊 [**RMS_REPORT_MATRIX.md**](docs/RMS_REPORT_MATRIX.md) — Registry and column specs for 84 analytical reports across 12 modules.
- 🖨️ [**DOCUMENT_PRINTING_ARCHITECTURE.md**](docs/DOCUMENT_PRINTING_ARCHITECTURE.md) — Thermal labels, invoices, and challan printing.
- ⚙️ [**SETTINGS_ARCHITECTURE.md**](docs/SETTINGS_ARCHITECTURE.md) — 16-domain transactional configuration registry.
- 🔍 [**SEO_ARCHITECTURE.md**](docs/SEO_ARCHITECTURE.md) — Dynamic JSON-LD structured schemas and search indexation.

---

## 👥 Authors & Maintainers

- **Lead Architect & Maintainer:** [Mushfiqur Rahman](https://github.com/beingmushfiq) (`beingmushfiq@gmail.com`)
- **Engineering Platform:** [DevCenterPoint](https://devcenterpoint.com) (Enterprise Cloud & ERP Systems)

<div align="center">
  <sub>Built with ❤️ for modern industrial manufacturing, omnichannel retail, and direct factory commerce.</sub>
</div>
