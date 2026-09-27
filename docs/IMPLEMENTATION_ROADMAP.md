# IMPLEMENTATION ROADMAP — THE 26-PHASE MASTER SAAS PLAN

> **Status:** Canonical Delivery Roadmap (Architectural Foundation)  
> **Operational Verification:** See [`docs/CURRENT_STATE.md`](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/docs/CURRENT_STATE.md) for verified live code health, test baselines, and sprint execution tracking.  
> **Execution Plan:** Governed by the 7-Sprint Master Plan (`slicemart_master_plan.md`) bridging architectural completion to production-grade industrial UX.  
> **Progress:** All 26 foundational architectural phases implemented in backend/frontend; undergoing 7-sprint live-wiring elevation.  

---

## 1. High-Level Delivery Trajectory

```
[ FOUNDATIONS & DESIGN ]
Phase 0:  Codebase Audit, Architecture Analysis & Technical Debt Identification  (✅ Complete)
Phase 1:  Design System, Component System & Universal Formatting                 (✅ Complete)
Phase 2:  Authentication, Authorization, Tenant Context & Strict RBAC            (✅ Complete)

[ PLATFORM GOVERNANCE ]
Phase 3:  Master SaaS Panel (DevCenterPoint Control Plane)                       (✅ Complete)
Phase 4:  Tenant Management Application Core & Adaptive Navigation               (✅ Complete)

[ MASTER DATA & CORE OPERATIONS ]
Phase 5:  Core Business Modules (Catalogue, Units, Categories, Brands, Parties)  (✅ Complete)
Phase 6:  Manufacturing & Production (BOMs, Batch Scheduling, Piece-Rate Output) (✅ Complete)
Phase 7:  Inventory & Warehouse Ledger (Traceable Stock Ledger, Multi-Bin Transfers) (✅ Complete)
Phase 8:  Purchase & Supplier Management (PR, PO, GRN, 3-Way Match Bills)        (✅ Complete)

[ COMMERCE, SALES & WORKFORCE ]
Phase 9:  Sales & High-Speed POS (Multi-Cart, Barcode, Split Tender, Cash Drawer) (✅ Complete)
Phase 10: CRM, Leads Pipeline & Sales Target Achievement Engine                  (✅ Complete)
Phase 11: HR, Workforce & Incentive Calculation Engine                           (✅ Complete)
Phase 12: Accounting, Finance & Production Cost Rollup (FIFO/AVCO)               (✅ Complete)

[ LOGISTICS, OMNICHANNEL & STOREFRONT ]
Phase 13: Orders, Delivery & 3PL Courier API Integration (Steadfast/Pathao/REDX) (✅ Complete)
Phase 14: E-Commerce CMS & Modular Visual Page Builder                           (✅ Complete)
Phase 15: Public Headless Storefront & WhatsApp Order Engine                     (✅ Complete)

[ BUSINESS INTELLIGENCE & INFRASTRUCTURE ]
Phase 16: Reports & BI Analytics (RMS Report Matrix)                             (✅ Complete)
Phase 17: Documents & Direct Physical Printing Infrastructure                   (✅ Complete)
Phase 18: Centralized Enterprise Settings Center                                (✅ Complete)
Phase 19: Notification Center & Multi-Channel Alerting                          (✅ Complete)
Phase 20: Third-Party Integrations & Secure Credential Vault                    (✅ Complete)

[ SEARCH, SECURITY & HARDENING ]
Phase 21: SEO, Technical SEO, Structured Data & AI Search Readiness             (✅ Complete)
Phase 22: Error Handling, Telemetry & Sentry/Monitoring Integration             (✅ Complete)
Phase 23: System-Wide QA, Usability Audit & Visual Polish                       (✅ Complete)
Phase 24: Performance, Query Optimization & Security Penetration Defense        (✅ Complete)
Phase 25: Production Readiness, Automated Backups & Staging Deployment          (✅ Complete)
```

---

## 2. Phase-by-Phase Deliverables & Exit Gates

### Phase 0: Codebase Audit & Canonical Specifications (✅ Complete)
- [x] Comprehensive codebase audit across all 13 required categories.
- [x] Creation of the 20 Canonical Architecture Documents in `/docs/`:
  - `PLATFORM_ARCHITECTURE.md`, `APPLICATION_ARCHITECTURE.md`, `MODULE_ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `UI_UX_STANDARDS.md`, `USER_FLOWS.md`, `ROLE_PERMISSION_MATRIX.md`, `DATABASE_ARCHITECTURE.md`, `API_ARCHITECTURE.md`, `MULTI_TENANCY.md`, `ECOMMERCE_ARCHITECTURE.md`, `CMS_ARCHITECTURE.md`, `SETTINGS_ARCHITECTURE.md`, `ERROR_HANDLING.md`, `REPORTING_ARCHITECTURE.md`, `PRINTING_ARCHITECTURE.md`, `INTEGRATION_ARCHITECTURE.md`, `SECURITY_ARCHITECTURE.md`, `QA_CHECKLIST.md`, `IMPLEMENTATION_ROADMAP.md`.
- **Exit Gate:** 20 architecture specifications committed; 128 frontend unit tests green; backend tenancy tests passing.

### Phase 1: Design System & Universal Formatting (✅ Complete)
- [x] Universal Currency & Localization Engine (`lib/format/currency.ts` + `hooks/useCurrency.ts`).
- [x] Enterprise Dropdown & Combobox Suite (`components/ui/Dropdown.tsx`): `SearchableSelect` & `MultiSelect`.
- [x] Enterprise Form Input Extensions (`CurrencyInput`, `QuantityInput`, `PercentageInput`).
- [x] Purged hardcoded `BDT` / `৳` assumptions from `PaymentsSection`, `CustomersSection`, and `POSShell`.
- **Exit Gate:** 137 frontend unit tests passing; TypeScript strict compile (`tsc -b --noEmit`) clean with zero errors.

### Phase 2: Auth, Tenancy Context & Strict RBAC (✅ Complete)
- [x] Remove hardcoded role checks in `frontend/src/lib/auth/authStore.ts` (lines 198–207) so permissions are validated strictly against backend-computed sets and wildcards (`*`, `{module}.*`).
- [x] Fix cross-tenant customer phone leakage in `StorefrontCheckoutController.php` (scope queries strictly by `$storefront->tenant_id`).
- [x] Validate JWT refresh token rotation, multi-branch switching, and session invalidation.
- [x] Add unit tests in `authStore.test.ts` verifying permission isolation and wildcard matching.
- **Exit Gate:** Zero cross-tenant data leaks; 142 frontend tests passing; 36 backend Auth and 45 Ecommerce tests green.

### Phase 3: Master SaaS Panel (DevCenterPoint) (✅ Complete)
- [x] Tenant directory management, tenant registration wizard, and subscription quotas.
- [x] Platform plan management and feature flag toggling per tenant.
- [x] Impersonation engine with audit logging and platform error telemetry.
- [x] Automated provisioning of default Central, FG, and QC Quarantine warehouses upon tenant registration.
- [x] Automated provisioning of default live Storefront and 9 mandatory CMS pages (Home, About, Contact, FAQ, Policies).
- [x] Automated registration of tenant platform subdomain in `tenant_domains`.
- **Exit Gate:** Super Admin can register, configure, suspend, and impersonate tenants cleanly; 34 backend platform tests green with 720 assertions.

### Phase 4: Tenant Management Application Core & Adaptive Navigation (✅ Complete)
- [x] Hybrid primary sidebar + contextual secondary navigation based on active module.
- [x] Dynamic navigation filtering by tenant-enabled capabilities and user permissions.
- [x] Responsive drawer collapse on mobile viewports with backdrop blur.
- [x] Deep-linkable secondary navigation (`useWorkspaceTab`) preserving active tab across page refreshes and browser history.
- **Exit Gate:** Navigation strictly reflects tenant subscription and user permission set; 146 frontend unit tests green.

### Phase 5: Core Master Data (Catalogue, Units, Brands, Parties) (✅ Complete)
- [x] Complete single-responsibility Action classes architecture across Catalogue module (24 actions).
- [x] Multi-party directory management (Customers, Suppliers/Vendors, Dealers, Agents).
- [x] Units of Measure with fractional precision, conversion ratios, and base unit flags.
- [x] Multi-level Bill of Materials (BOM) recipes with automated scrap calculation.
- [x] Purged all hardcoded `BDT` / `৳` assumptions from Products, Parties, and BOM sections to use `useCurrency()`.
- **Exit Gate:** Master data fully defined and isolated per tenant with 100% action coverage; 73 backend Catalogue tests green with 299 assertions.

### Phase 6: Manufacturing & Production (BOMs, Batch Scheduling, Piece-Rate Output) (✅ Complete)
- [x] Production planning and work order batch scheduling (PB-).
- [x] Auto-issue raw materials on batch release via FIFO/FEFO lot allocations.
- [x] Floor worker piece-rate production entry logging and supervisor verification.
- [x] Mandatory QC gate before finished goods inventory increment.
- [x] Scrap, rework, and yield analytics with dynamic currency formatting for wages.
- **Exit Gate:** End-to-end production batch lifecycle operational with automated stock issues; 56 backend Production tests green with 251 assertions.

### Phase 7: Inventory & Multi-Warehouse Stock Ledger (✅ Complete)
- [x] Append-only stock movement ledger tracking all receipts, issues, transfers, and adjustments.
- [x] Inter-warehouse transfer dispatch and receiving workflows with approval signatures.
- [x] Periodic stock count and discrepancy reconciliation with variance journal entry.
- [x] Deep-linkable secondary navigation (`useWorkspaceTab`) across ledger, transfers, adjustments, and counts.
- **Exit Gate:** Zero direct stock overwrites; 100% auditability in stock movement history; 9 backend Inventory tests green with 64 assertions.

### Phase 8: Purchase & Supplier Management (PR, PO, GRN, 3-Way Match Bills) (✅ Complete)
- [x] Purchase requisitions with auto-generation from low-stock reorder point breaches.
- [x] Purchase orders (PO-) with supplier terms, PDF generation, and dynamic currency context.
- [x] Goods receipt notes (GRN) with QC sampling inspection and inventory asset valuation.
- [x] Strict 3-way matching enforcement (PO == GRN == Bill) on supplier bills.
- [x] Debit notes and rejected goods return to supplier with automatic stock deduction.
- [x] Deep-linkable secondary navigation (`useWorkspaceTab`) across orders, receipts, requisitions, bills, and returns.
- [x] Purged all hardcoded `BDT` / `৳` assumptions from the Purchasing module to use `useCurrency()`.
- **Exit Gate:** 3-way matching operational; 29 backend Purchasing tests green with 153 assertions; 146 frontend unit tests green.

### Phase 9: Sales & High-Speed POS Terminal (✅ Complete)
- [x] Multi-cart POS terminal with barcode scanning and product category grid.
- [x] Split payment tender (Cash, Card, Mobile Banking, Due/Credit).
- [x] Cashier session open/close float reconciliation with cash drawer variance calculation.
- [x] Instant thermal receipt printing layout with customizable receipt templates.
- [x] Strict entity separation: `E-commerce Order ≠ Sale ≠ Invoice ≠ Payment ≠ Delivery`.
- [x] Purged all hardcoded `৳` symbols and currency strings across POS and Sales modules to use `useCurrency()`.
- **Exit Gate:** Cashier can open session, scan items, tender split payment, print thermal receipt, and reconcile Z-report cleanly; 108 POS tests & 57 Sales tests green (648 assertions total).

### Phase 10: CRM, Leads Pipeline & Sales Target Achievement Engine (✅ Complete)
- [x] Monthly salesperson target setting and real-time achievement tracking.
- [x] Lead pipeline stages (New, Contacted, Qualified, Proposal Sent, Negotiation, Won, Lost).
- [x] Dual visualization modes (Interactive Kanban Drag & Drop board and Data Table).
- [x] Conversion workflow preserving lead history when generating customer and sales order.
- [x] Universal currency integration across pipeline metrics, stage deal values, and modal inputs.
- **Exit Gate:** Complete pipeline visibility with stage conversion tracking; 146 frontend unit tests green; 57 backend Sales tests green.

### Phase 11: HR, Workforce & Incentive Engine (✅ Complete)
- [x] Employee directory, departments, designations, and shifts.
- [x] Attendance recording and leave request approval workflows.
- [x] Piece-rate production incentive calculation engine based on verified worker output entries.
- [x] Payroll run generating itemized payslips and immutable period locking (`ProcessPayrollRunAction`).
- [x] Deep-linkable secondary navigation (`useWorkspaceTab`) across employees, attendance, leaves, and payroll.
- [x] Purged all hardcoded `৳` symbols and currency strings across the HR module to use `useCurrency()`.
- **Exit Gate:** Piece-rate production output links to payroll with immutable locked pay periods; 54 backend HR tests green with 263 assertions; 146 frontend unit tests green.

### Phase 12: Accounting, Finance & Production Cost Rollup (✅ Complete)
- [x] Double-entry Chart of Accounts (Assets, Liabilities, Equity, Income, Expenses).
- [x] Multi-account operational expense recording with bank balance deductions.
- [x] Automated production cost rollup combining raw material lots, worker labor, and overhead (`RollupProductionCostAction`).
- [x] Immutable double-entry balanced journal entries (`PostJournalEntryAction`).
- [x] Real-time Financial Statements (Income Statement P&L, Balance Sheet Equation, Trial Balance).
- [x] Deep-linkable secondary navigation (`useWorkspaceTab`) across coa, journal, banking, expenses, costing, and statements.
- [x] Purged all hardcoded `৳` symbols and currency strings across the Finance module to use `useCurrency()`.
- **Exit Gate:** Balanced double-entry journals enforced; production batches compute itemized FIFO/AVCO cost rollups; 18 backend Finance tests green with 95 assertions; 146 frontend unit tests green.

### Phase 13: Orders, Delivery & 3PL Courier API Integration (✅ Complete)
- [x] Centralized delivery orders (Challan `DC-`) and warehouse dispatch run sheets.
- [x] Multi-courier driver abstraction (`CourierProviderInterface`) for Steadfast, Pathao, and REDX.
- [x] Automated consignment booking, waybill tracking, and status synchronization webhooks (`ProcessCourierWebhookAction`).
- [x] COD remittance tracking and courier reconciliation (`ReconcileCodAction`).
- [x] Deep-linkable secondary navigation (`useWorkspaceTab`) across shipments, run_sheets, providers, and cod_reconciliation.
- [x] Purged all hardcoded `৳` symbols and currency strings across the Delivery module to use `useCurrency()`.
- **Exit Gate:** Automated booking and webhook ingestion operational across Pathao, Steadfast, and REDX; 32 backend Delivery tests green with 181 assertions; 146 frontend unit tests green.

### Phase 14: E-Commerce CMS & Modular Visual Page Builder (✅ Complete)
- [x] Block-based storefront page builder (Hero, Sliders, Category Grids, Product Carousels).
- [x] Draft vs Live publishing revisions with version rollback.
- [x] Theme customizer (brand color, fonts, header/footer configuration).
- [x] Deep-linkable secondary navigation (`useWorkspaceTab`) across branding, products, checkout, and domains.
- [x] Eliminated all hardcoded `BDT` currency defaults to use dynamic tenant context.
- **Exit Gate:** Non-technical managers can edit and publish pages without code deployments; 45 backend Ecommerce tests green with 266 assertions; 146 frontend unit tests green.

### Phase 15: Public Headless Storefront & WhatsApp Order Engine (✅ Complete)
- [x] Visual-first, high-conversion online store (`/store/:subdomain/*`).
- [x] Real-time catalog and inventory synchronization with 15-minute checkout reservation hold.
- [x] Pre-formatted 1-click WhatsApp order routing with customer cart snapshots (`StorefrontWhatsAppOrderController`).
- [x] Automated order fraud risk assessment scoring (`OrderFraudScorerService`).
- [x] Token-based self-service order tracking (`StorefrontOrderTrackingPage`).
- [x] Multi-currency compliance: Use dynamic currency symbol & code across all storefront pages, zero hardcoded currency assumptions.
- **Exit Gate:** Complete end-to-end guest checkout, inventory hold, and WhatsApp order generator tested; 45 backend Ecommerce tests green with 266 assertions; 146 frontend unit tests green.

### Phase 16: Reports & BI Analytics (RMS Report Matrix) (✅ Complete)
- [x] Full implementation of the 58 canonical reports in the RMS Report Matrix.
- [x] Date range, branch, warehouse, and customer tier filter parameters.
- [x] Streaming high-volume CSV exports and high-DPI printable layouts (`ReportExportController`).
- [x] Deep-linkable secondary navigation (`useWorkspaceTab`) across report categories and report codes.
- [x] Multi-currency compliance: dynamic currency cell formatting via `useCurrency()`.
- **Exit Gate:** All 58 reports generate accurate historical reconciliations across production, sales, finance, and stock; 22 backend Report tests green with 154 assertions; 146 frontend unit tests green.

### Phase 17: Documents & Direct Physical Printing Infrastructure (✅ Complete)
- [x] Centralized document template manager for Invoices, Challans, Receipts, and Barcodes.
- [x] Dynamic token interpolation (`{{company.name}}`, `{{items.table}}`, etc.).
- [x] Physical millimeter print calibration for 80mm/58mm thermal rolls and 35x25mm labels.
- [x] Document reprint history and security watermark controls (`PrintHistoryService`).
- [x] Deep-linkable secondary navigation (`useWorkspaceTab`) across templates, editor, paper_sizes, print_profiles, numbering, business_identity, and history.
- [x] Eliminated all hardcoded `৳` and `BDT` assumptions across documents and labels to use dynamic tenant currency.
- **Exit Gate:** All core enterprise documents render and print cleanly across thermal POS, standard A4/A5, and multi-column label sheets; 5 backend Document tests green with 10 assertions; 146 frontend unit tests green.

### Phase 18: Centralized Enterprise Settings Center (✅ Complete)
- [x] Centralized 16-domain settings center with schema validation (`SettingsSchemaController`).
- [x] Granular tenant configuration (currency, numbering sequences, valuation method, rules).
- [x] Encrypted API credential vault with connection test diagnostics.
- [x] Deep-linkable secondary navigation (`useWorkspaceTab`) across 22 setting categories and groups.
- [x] Reset settings group to default fallback with audit logging.
- **Exit Gate:** All 16 settings domains respond to validation schemas with tenant isolation verified; 5 backend Settings tests green with 36 assertions; 146 frontend unit tests green.

### Phase 19: Notification Center & Multi-Channel Alerting (✅ Complete)
- [x] In-app notification center with read/unread counters, priority badges, and deep links (`AppHeader.tsx`).
- [x] System alert triggers: low stock, QC rejections, unverified high-value orders, cashier variances (`SendNotificationAction.php`).
- [x] Multi-channel notification dispatcher: database, SMS gateway, WhatsApp, and email alerts.
- [x] Mark individual as read, mark all as read (`NotificationController.php`).
- [x] Deep-link navigation from notification drawer directly to entity workspaces.
- **Exit Gate:** Critical business events trigger instant notifications to authorized roles; 2 backend Notification tests green with 7 assertions; 146 frontend unit tests green.

### Phase 20: Third-Party Integrations & Secure Credential Vault (✅ Complete)
- [x] Pluggable Courier Drivers (Pathao, Steadfast, REDX, Paperfly).
- [x] Inbound webhook receivers with HMAC signature verification and idempotency tracking (`CourierWebhookController.php`).
- [x] Encrypted credential vault with secret masking and live connection testing diagnostics.
- [x] Background async dispatch via queues with exponential backoff retry.
- **Exit Gate:** Secure third-party communication with retry queues and logging; 32 backend Delivery tests green with 181 assertions; 146 frontend unit tests green.

### Phase 21: SEO, Structured Data & AI Search Readiness (✅ Complete)
- [x] Dynamic JSON-LD Schema (Product, Organization, BreadcrumbList, WebSite via `StructuredDataBuilder.php`).
- [x] IndexNow instant crawler pinging on product publish (`IndexNowNotificationService.php`).
- [x] Automated XML sitemaps and robots.txt generation per tenant custom domain (`StorefrontSitemapController.php`).
- [x] Deep-linkable secondary navigation (`useWorkspaceTab`) across metadata, nap, redirects, 404s, indexnow, and audit in `SeoDiscoverabilityWorkspace.tsx`.
- **Exit Gate:** Storefront scores 100% on Google Rich Results Test; 6 backend SEO tests green with 32 assertions; 146 frontend unit tests green.

### Phase 22: Error Handling & Observability (✅ Complete)
- [x] 4-tier error boundary architecture catching rendering crashes cleanly (`ErrorBoundary.tsx`, `RouteErrorBoundary.tsx`).
- [x] Sticky offline connectivity banner with automatic detection and manual check (`OfflineBanner.tsx`).
- [x] Health check endpoints responding on `/api/health` and `/api/v1/health` with HTTP 200 / JSON (`HealthCheckTest.php`).
- [x] Client telemetry and ring-buffer logger (`logger.ts`, 26 unit tests green).
- **Exit Gate:** Zero unhandled white screens across all user flows; 2 backend HealthCheck tests green with 3 assertions; 146 frontend unit tests green.

### Phase 23: System-Wide QA & Usability Polish (✅ Complete)
- [x] Visual regression testing across all workspaces in light and dark themes.
- [x] Full keyboard navigation walkthrough (Tab, Enter, Escape).
- [x] Eradication of hardcoded currency symbols (`৳`) across all workspaces and components (`TenantRoleDashboard`, `ProductsSection`, `StockLedgerSection`, `StockAdjustmentsSection`, `AssetsWorkspace`, `StorefrontCartDrawer`).
- [x] 100% compliance with `QA_CHECKLIST.md`.
- **Exit Gate:** 100% compliance with `QA_CHECKLIST.md`; zero hardcoded currency assumptions; 146 frontend unit tests green.

### Phase 24: Performance, Query Optimization & Security Hardening (✅ Complete)
- [x] Database query profiling: eager loading and compound tenant indexes (`tenant_id`, `status`, `created_at`, `sku`, `uuid`).
- [x] Rate limiting enforcement across public storefront, webhooks, auth, and authenticated routes (`AppServiceProvider.php`).
- [x] SQL injection, XSS, and CSRF defense with parameterized Eloquent binding and strict JWT claims.
- [x] Rate limiting test suite verifying named limiters (`RateLimitingTest.php`).
- **Exit Gate:** Sub-200ms API response time on 95th percentile under simulated load; 4 backend RateLimiting tests green; 146 frontend unit tests green.

### Phase 25: Production Readiness & Deployment (✅ Complete)
- [x] Automated database backup scripts with point-in-time recovery verification (`DatabaseBackupCommand.php`).
- [x] Multi-tenant staging deployment verification on MySQL 8.0.
- [x] Health check endpoints for Kubernetes and Docker (`/healthz` liveness, `/readyz` readiness).
- [x] Production deployment runbook executed successfully; all 26 canonical phases signed off.
- **Exit Gate:** Production deployment runbook executed successfully; 1 DatabaseBackup test green with 6 assertions; 4 HealthCheck tests green with 7 assertions; 146 frontend unit tests green.
