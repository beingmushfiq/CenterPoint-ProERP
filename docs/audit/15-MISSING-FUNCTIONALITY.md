# 15 - Missing Functionality & SaaS Capability Gaps

This document identifies features that are either advertised in architecture specifications, implied by database schemas, or expected in an enterprise multi-tenant SaaS ERP, but are currently **missing**, **partially implemented**, or **orphaned** in the `slicemart-fms` codebase.

---

## 1. Summary of Identified Gaps

| Capability Area | Status | Database Schema | Backend API | Frontend UI | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tenant Onboarding & Provisioning Defaults** | Partial | Exists | Partial | Incomplete | High |
| **Webhook Management & Delivery Engine** | Orphaned | Exists (`Wave 24`) | **Missing (0 Routes)** | **Missing** | High |
| **Tenant Data Export & Backup (GDPR)** | Missing | None | **Missing** | **Missing** | High |
| **Granular Plan Feature Gating Middleware** | Incomplete | Exists (`plans`) | 2 Routes Only | Client-only checks | Critical |
| **Document Numbering Sequence Management UI**| Backend-Only | Exists (`Wave 4`) | Exists (3 Routes) | **Missing** | Medium |
| **Tenant Audit Log Viewer UI** | Backend-Only | Exists (`Wave 4`) | Exists | **Missing** | Medium |
| **Offline Notification & Fallback Queue** | Partial | Exists | Partial | Incomplete | Medium |
| **Multi-Currency & Tax Localization Engine** | Hardcoded | Partial | Hardcoded BDT | Hardcoded BDT | High |
| **Inventory Cycle Count & Multi-Level Approvals**| Partial | Exists | Partial | Missing Workflow | High |
| **Storefront Maintenance Mode Page** | Missing | None | Missing | Missing | Medium |

---

## 2. In-Depth Gap Analysis

### 2.1 Webhook Management & Integration Gateway (Orphaned Schema)
- **Current State:** Migrations `2026_08_24_121000_create_webhook_endpoints_table.php` and `2026_08_24_121100_create_webhook_deliveries_table.php` define an append-only webhook delivery log and endpoint table with retry timestamps, secrets, and tenant foreign keys.
- **The Defect:** There are **zero routes** in `api_tenant.php` under `Route::prefix('webhooks')`. No controller exists for tenants to register webhook URLs, select event triggers (e.g. `order.created`, `shipment.delivered`, `stock.low`), view delivery attempt logs, or trigger manual retries.
- **Required Fix:**
  - Create `WebhookEndpointController` and `WebhookDeliveryController` in `App\Modules\Integrations\Controllers`.
  - Expose CRUD endpoints under `/api/v1/integrations/webhooks`.
  - Dispatch asynchronous jobs (`DeliverWebhookPayloadJob`) on core events with HMAC-SHA256 signature headers (`X-ProERP-Signature`).

---

### 2.2 Granular Plan Feature Gating Middleware
- **Current State:** The database holds `plans` and `subscriptions` tables with module definitions. However:
  - `tenant.quota` middleware is applied to **only 2 routes** (`catalog.product.store` and `inventory.warehouse.store`).
  - No `CheckModuleEnabled` or `EnsureFeatureSubscribed` middleware exists to protect entire module route groups (e.g., `/api/v1/hrm/*`, `/api/v1/manufacturing/*`, `/api/v1/accounting/*`).
- **The Risk:** A tenant on a "Basic" plan that only pays for Inventory and POS can make direct HTTP API requests to HRM, Manufacturing, or General Ledger endpoints and bypass subscription gating completely because only RBAC permissions (which can be granted in roles) are evaluated.
- **Required Fix:**
  - Introduce `EnsureModuleActive` middleware:
    ```php
    Route::prefix('manufacturing')
        ->middleware(['module.active:manufacturing', 'permission:manufacturing.view'])
        ->group(...);
    ```
  - Return HTTP `402 Payment Required` or `403 Forbidden (Module Not Subscribed)` when a tenant attempts to access unpurchased modules.

---

### 2.3 Automated Tenant Onboarding & Provisioning Defaults
- **Current State:** `TenantOnboardingController` creates the initial tenant record and an admin user. However, automated seeding of default operational structures is incomplete:
  - No standard Chart of Accounts (COA) is automatically seeded for the tenant's chosen industry (Garments vs Retail vs Electronics).
  - Default warehouses, primary branch, default unit conversions (PCS, DOZ, KG), and standard tax rates (VAT 5%, 7.5%, 15%) are not idempotently initialized.
- **The Consequence:** A new tenant is dropped into an empty database where creating an invoice fails because there is no warehouse, tax rate, or default accounting ledger account configured.
- **Required Fix:**
  - Build `ProvisionTenantDefaultsAction` dispatched asynchronously upon tenant registration:
    - Creates "Main Warehouse" and "Head Office Branch".
    - Seeds default unit types (`PCS`, `BOX`, `MTR`, `ROLL`).
    - Seeds industry-specific Chart of Accounts (Assets, Liabilities, Equity, Revenue, COGS, Expenses).
    - Seeds default Document Numbering Sequences.

---

### 2.4 Document Numbering Sequence Generator UI
- **Current State:** Backend migration `2026_08_23_102300_create_document_sequences_table.php` and controller `DocumentNumberingController` exist with routes at `/api/v1/documents/numbering`.
- **The Defect:** In the frontend settings area, there is no dedicated visual interface for tenants to customize document prefixes, padding, reset cycles (e.g. annual reset `INV-2026-00001` vs perpetual `INV-00001`), or branch-specific prefixes (`DHK-INV-001` vs `CTG-INV-001`).
- **Required Fix:**
  - Add `<DocumentNumberingSettings />` tab in `TenantSettingsView.tsx`.
  - Connect to `/api/v1/documents/numbering` to allow configuring templates for Invoices, Orders, Deliveries, POs, and Production Batches.

---

### 2.5 Tenant Data Export, Backup & Portability (GDPR & Data Freedom)
- **Current State:** Zero backup or export routes exist in `api_tenant.php` or `api_platform.php`.
- **The Defect:** Enterprise tenants cannot perform on-demand data backups or exports of their customer lists, transaction history, inventory ledgers, or production journals in a standardized format (JSON/CSV/SQL dump).
- **Required Fix:**
  - Implement `TenantDataExportJob` allowing tenant administrators to trigger a background export.
  - Generates an AES-256 encrypted `.zip` archive containing CSV exports of all tenant-scoped tables.
  - Delivers a time-limited signed S3/local download URL valid for 24 hours.

---

### 2.6 Tenant Maintenance Mode & Suspension Interception
- **Current State:** `EnsureTenantActive` throws `TenantSuspended` if the tenant status is `suspended` or `cancelled`.
- **The Defect:**
  - The API returns an unhandled JSON error or 500 error if the frontend does not specifically intercept `TenantSuspended`.
  - For storefront visitors (`storefront.devcenterpoint.com` or custom domains), accessing a suspended tenant results in an ugly API error rather than a styled "Store Currently Offline for Scheduled Maintenance" page.
- **Required Fix:**
  - Register a dedicated `TenantSuspendedExceptionHandler` returning HTTP `423 Locked` with a clean error contract.
  - Storefront router interceptor that renders a dedicated maintenance page when receiving HTTP 423.

---

### 2.7 Multi-Currency & Regional Tax Localization
- **Current State:** Currency symbols (`৳` BDT) and tax structures are hardcoded across several frontend tables and backend calculations.
- **The Defect:** For international or export-oriented garment manufacturers selling in USD or EUR, exchange rates, foreign currency invoicing, and multi-currency bank ledgers are absent.
- **Required Fix:**
  - Pull active currency formatting from `tenant.settings.currency` (`symbol`, `code`, `decimal_places`, `symbol_position`).
  - Introduce an exchange rate table (`currency_rates`) for multi-currency transactions.

---

### 2.8 Inventory Cycle Count & Discrepancy Approval Workflow
- **Current State:** Stock adjustments allow directly setting stock quantities without a mandatory maker-checker approval hierarchy.
- **The Defect:** A warehouse operator can adjust high-value inventory without a manager or finance officer review, introducing theft/fraud vulnerability.
- **Required Fix:**
  - Implement `StockAuditSession` with states: `Draft` → `Counting` → `Pending_Review` → `Approved` → `Posted`.
  - Only users with `inventory.adjustment.approve` can post discrepancy adjustments to the ledger.
