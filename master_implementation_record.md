# 🏭 Master Implementation & Testing Record (Phases 0 — 11)
### Production ERP + Storefront — Full Platform Upgrade
> **Single Source of Truth** for Platform Architecture, Multi-Payment, Design, Workflows & Module Upgrades  
> **Overall Progress**: Phase 0 (100% COMPLETE) | Phase 1 (100% COMPLETE) | Phase 2 (100% COMPLETE) | Phase 3 (100% COMPLETE) | Phase 4 (100% COMPLETE) | Phase 5 (100% COMPLETE) | Phase 6 (100% COMPLETE) | Phase 7 (100% COMPLETE) | Phase 8 (100% COMPLETE) | Phase 9 (READY TO PROCEED)  
> **Last Verified**: September 29, 2026 | **Build Status**: Green (0 TypeScript Errors, 100% Automated Tests Passing)

---

## 🧭 Master Phase Progress Matrix (Phase 0 to 11)

| Phase | Module / Focus Area | Status | Test Status | Implementation Notes |
|:---:|:---|:---:|:---:|:---|
| **Phase 0** | **System Architecture & Theme Foundations** | **COMPLETED & VERIFIED** | **PASS** (100%) | Light default + System-auto (OS listener), token cleanup, bug fixes, lazy splitting |
| **Phase 1** | **Multi-Payment Methods (Sales, Purchasing, Expense, POS, Collections)** | **COMPLETED & VERIFIED** | **PASS** (12/12 tests, 53 assertions, 0 TS errors) | `payment_splits` & `expense_payment_splits` DB tables, actions, `PaymentSplitEditor.tsx`, double-entry GL auto-balancing |
| **Phase 2** | **Reports Hub Redesign & Consolidation** | **COMPLETED & VERIFIED** | **PASS** (64/64 backend, 6/6 Vitest, 0 TS errors) | Deduplicated 8 reports (84 → 76), 7 Domain Hubs, dual-engine ApexCharts/Chart.js, 4-card KPI strip, pinned & recent strips |
| **Phase 3** | **Dashboard & KPI Visuals Upgrade** | **COMPLETED & VERIFIED** | **PASS** (6/6 backend, 9/9 Vitest, 0 TS errors) | Mini sparklines (SVG cubic-bezier), directional % delta badges, TodayAlertsStrip, interactive multi-series ApexCharts with overlay toggle, live department health metrics |
| **Phase 4** | **Core Modules UX (Sales, POS, Purchasing, Inventory)** | **COMPLETED & VERIFIED** | **PASS** (299/299 Vitest, 0 TS errors) | HID barcode scanner buffer, 6-stage leads Kanban, bulk order dispatch, branded invoice PDF, X-Report, replenishment alerts, 7d velocity chart |
| **Phase 5** | **Production, QC & Logistics Workflows** | **COMPLETED & VERIFIED** | **PASS** (302/302 Vitest, 0 TS errors) | 5-stage stepper, QC defect badge & rework modal, Gantt-lite plans view, worker bulk piece-rate grid, ISO 2859-1 AQL calculator & auto disposition, QC sparkline, COD reconciliation, route optimization & courier SLA breach alerts |
| **Phase 6** | **Finance & Fixed Assets Upgrades** | **COMPLETED & VERIFIED** | **PASS** (11/11 Vitest, 64/64 backend, 0 TS errors) | Bank statement reconciliation, P&L visualizer, budget tracker, COA hierarchy, depreciation schedules, QR labels, maintenance SLA alerts, timeline tab |
| **Phase 7** | **HR Workspace (Kiosk Removed)** | **COMPLETED & VERIFIED** | **PASS** (16/16 Vitest, 80/80 backend, 0 TS errors) | Attendance month calendar view with employee drill-down, payroll calculation preview breakdown with double-entry GL audit, in-app leave notification feed banner, salary advance auto-deduct toggle & pre-population, kiosk mode decoupled |
| **Phase 8** | **Settings, Roles, Activity Logs & Data Bin** | **COMPLETED & VERIFIED** | **PASS** (311/311 Vitest, 18/18 backend, 0 TS errors) | Dedicated routes, Reset to Defaults per group, Webhook management & ping, Role clone & matrix, Human-readable diffs, 30s undo purge countdown |
| **Phase 9** | **Storefront (Page Builder & Public Checkout)** | 🟡 **NEXT TO PROCEED** | *Pending User Authorization* | Section splitting, drag-and-drop ordering, guest checkout, gateway placeholder |
| **Phase 10**| **Agentic AI & Brain Upgrade** | ⚪ Queued | *Pending* | SSE streaming, ERP tool-use schemas, persistent conversation history, slide-over panel |
| **Phase 11**| **End-to-End Polish, Accessibility & Staging Deploy** | ⚪ Queued | *Pending* | Focus traps, ARIA audits, micro-interactions, responsive viewport stress tests |

---

## ⚙️ Core Confirmed Architectural Decisions

| # | Question / Requirement | Decision / Specification | Implementation Status |
|---|---|---|:---:|
| 1 | Execution Workflow | Sequential execution: Phase 0 → Phase 11. User approval gated after each phase. | Active Protocol |
| 2 | Theme System | Light default + System-auto (`prefers-color-scheme`) + Manual 3-state switcher (`light` \| `dark` \| `system`). | Implemented in Phase 0 |
| 3 | Report Deduplication | Remove 8 redundant reports (84 → 76 canonical reports). | Implemented in Phase 2 |
| 4 | Barcode Hardware | Support both USB HID and Bluetooth barcode scanners via fast keystroke buffer (<50ms). | Implemented in Phase 4 |
| 5 | Code Splitting | Lazy-load heavy workspaces (`FinanceWorkspace`, `HrWorkspace`, etc.) on tab click via `React.lazy` + `Suspense`. | Implemented in Phase 0 |
| 6 | Visualizations | ApexCharts as primary analytical chart engine; Chart.js as secondary option. | Implemented in Phase 2 |
| 7 | Payment Gateway | Placeholder API stubs and UI settings only; live gateway credentials omitted. | Documented Architecture |
| 8 | HR Kiosk Mode | Kiosk mode completely removed from HR module. | Removed in Phase 0 |
| 9 | Agentic AI Brain | Streaming + ERP tool-use schemas + persistent conversational history + slide-over panel. | Scheduled for Phase 10 |
| 10 | Deployment | Incremental staging build and testing verification at the close of every phase. | Active Protocol |
| 11 | Multi-Payment Tender | Unified split tenders across Sales, Purchasing, Expenses, Customer Collections, and POS. | Implemented in Phase 1 |

---

## 🟢 PHASE 0: System Architecture & Foundation Fixes (COMPLETED & VERIFIED)

### 0.1 Implemented Enhancements
- [x] **Theme Switcher & System-Auto Mode**: Added inline boot listener for `prefers-color-scheme: dark` in `index.html`. Added 3-state toggle (`light` / `dark` / `system`) in `AppHeader.tsx`.
- [x] **Design Token Normalization**: Audited and replaced raw utility colors with semantic CSS tokens (`bg-surface`, `bg-surface-sunken`, `border-default`, `text-default`, `text-muted`).
- [x] **Code Splitting**: Refactored large monolithic workspaces (`FinanceWorkspace.tsx` and `HrWorkspace.tsx`) into lazy-loaded modular sections.
- [x] **Removed HR Kiosk Mode**: Removed unneeded kiosk mode code and routes from `HrWorkspace.tsx`.
- [x] **Critical Bug Fixes**:
  - Renumbered Fixed Asset Register report ID to eliminate ID collision with `total_input_output`.
  - Added session tracking for onboarding modal dismissal.
  - Standardized tenant cache flush keys between `t{id}:tenant:profile` and `tenant:{id}:profile`.
  - Created [API_ERROR_CODES.md](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/API_ERROR_CODES.md) and documented `TENANT_INACTIVE`.
- [x] **Installed Core Libraries**: Installed `apexcharts`, `react-apexcharts`, `chart.js`, `react-chartjs-2`.
- [x] **Operational Runbooks**: Created [DEPLOY.md](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/DEPLOY.md) and [OPERATIONS.md](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/OPERATIONS.md).

---

## 🟢 PHASE 1: Multi-Payment Methods (COMPLETED & VERIFIED)

### 1.1 Backend Implementation Details
- [x] **Migrations**:
  - `2026_09_28_210000_create_payment_splits_table.php`: Created table with columns `payment_id`, `method`, `amount`, `bank_account_id`, `bank_slip_number`, `mfs_provider`, `mfs_mobile_number`, `mfs_transaction_id`, `cheque_number`, `cheque_bank_name`, `cheque_issue_date`, `cheque_maturity_date`, `card_last_four`, `card_approval_code`, `transaction_ref`, `notes`.
  - `2026_09_28_220000_create_expense_payment_splits_table.php`: Created table with columns `company_id`, `expense_id`, `payment_method`, `amount`, `bank_account_id`, `transaction_ref`, `notes`.
- [x] **Models & Relationships**:
  - [PaymentSplit.php](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/backend/app/Modules/Sales/Models/PaymentSplit.php): Casts amounts to decimal:2, relationships `payment()` and `bankAccount()`.
  - [ExpensePaymentSplit.php](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/backend/app/Modules/Finance/Models/ExpensePaymentSplit.php): Multi-tenant traits, relationships `expense()` and `bankAccount()`.
  - [Payment.php](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/backend/app/Modules/Sales/Models/Payment.php): Added `splits(): HasMany` relationship.
  - [Expense.php](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/backend/app/Modules/Finance/Models/Expense.php): Added `paymentSplits(): HasMany` relationship.
- [x] **Actions & Controllers**:
  - [RecordPaymentAction.php](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/backend/app/Modules/Sales/Actions/RecordPaymentAction.php): Ingests splits array, sets `method = 'split'` when >1 splits exist, creates default single split row on legacy payments for query normalization, and automatically updates underlying `Invoice` and `PurchaseBill` `paid_amount` and `status` (`paid` vs `partial`/`partially_paid`).
  - [StorePaymentRequest.php](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/backend/app/Modules/Sales/Requests/StorePaymentRequest.php): Validates `splits` array, amounts, method enumerations, and method-specific fields.
  - [PurchaseBillController.php](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/backend/app/Modules/Purchasing/Controllers/PurchaseBillController.php): `pay()` action injected with `RecordPaymentAction`, validates `splits`, updates `paid_amount` and `status`.
  - [ExpenseController.php](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/backend/app/Modules/Finance/Controllers/ExpenseController.php) & [CreateExpenseAction.php](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/backend/app/Modules/Finance/Actions/CreateExpenseAction.php): Validates unified methods (`cash, bank, bank_transfer, mobile_wallet, mobile_banking, credit, cheque, card, split`), persists `ExpensePaymentSplit` rows, loads splits.

### 1.2 Frontend Implementation Details
- [x] **Core Component**: Created [PaymentSplitEditor.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/components/payment/PaymentSplitEditor.tsx):
  - Supports 7 methods: `cash`, `bank_transfer`, `mobile_banking`, `card`, `cheque`, `credit_adjustment`, `other`.
  - Contextual subfield drawers (bank account select + slip, MFS provider pills + phone + TrxID, cheque # + maturity date, card last 4 + auth code, split memo).
  - Auto-balancing toolbar: Live calculation of split sum vs target, Remaining/Excess badges, "Auto-Balance" and "Equal Split" buttons.
- [x] **Types**:
  - Added `PaymentSplit` to [sales.ts](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/types/api/sales.ts).
  - Added `ExpensePaymentSplit` to [finance.ts](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/types/api/finance.ts).
- [x] **Module Integrations**:
  - **Sales Invoices & Payments** ([PaymentsSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/sales/sections/PaymentsSection.tsx)): Split Tender toggle, `PaymentSplitEditor`, multi-split badge in table, split tender payload.
  - **Purchasing Supplier Bills** ([PurchaseBillsSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/purchasing/sections/PurchaseBillsSection.tsx)): Split Tender toggle, `PaymentSplitEditor`, remaining balance prefill, `/purchasing/bills/{id}/pay` split mutation.
  - **Expense Disbursements** ([MoneyOutModal.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/finance/modals/MoneyOutModal.tsx)): Split Tender toggle, `PaymentSplitEditor`, multi-credit double-entry GL auto-balancing.
  - **Customer Collections & Receipts** ([MoneyInModal.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/finance/modals/MoneyInModal.tsx)): Split Tender toggle, `PaymentSplitEditor`, multi-debit double-entry GL auto-balancing, customer receivables reduction.
  - **POS** ([POSShell.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/pos/POSShell.tsx)): Split tender is natively integrated into retail POS checkout workflow.

### 1.3 Test Verification Evidence
- **Backend Tests (PHPUnit / Pest)**:
  `php artisan test --filter="PaymentTest|PurchaseBillTest|ExpenseTest"`
  - Result: **8 passed, 0 failed, 53 assertions (5,651 ms)**.
- **Frontend Unit Tests (Vitest)**:
  `npm test -- FinanceModals.test.tsx`
  - Result: **4 passed, 0 failed (717 ms)**.
- **Frontend Strict TypeScript Check**:
  `npm run typecheck` (`tsc -b --noEmit`)
  - Result: **EXIT CODE 0 (0 errors)**.

---

## 🟢 PHASE 2: Reports Hub Redesign & Consolidation (COMPLETED & VERIFIED)

### 2.1 Report Deduplication (84 → 76 Canonical Reports)
- [x] **Database Migration**: Executed `2026_09_29_025500_consolidate_and_deduplicate_report_definitions.php`:
  - Flagged 8 redundant report definitions as `is_active = false`.
  - Added structured metadata `consolidated_into` pointing each retired report code to its canonical replacement.
  - Active report count in database reduced from 84 to exactly 76 canonical reports.
- [x] **Deduplicated Report Mappings**:
  1. `worker_piece_rate_summary` (id:131) → Consolidated into `worker_production` (id:5)
  2. `salesman_profitability` (id:119) → Consolidated into `salesman_profit_contribution` (id:126)
  3. `daily_sales` (id:31) → Consolidated into `sales_performance` (id:30)
  4. `b2c_sales` (id:118) → Consolidated into `product_sales` (id:115)
  5. `salesman_leaderboard` (id:63) → Consolidated into `salesman_sales` (id:117)
  6. `delivery_sla_history` (id:129) → Consolidated into `courier_performance` (id:72)
  7. `converted_leads` (id:124) → Consolidated into `lead_summary` (id:50)
  8. `lost_leads_analysis` (id:125) → Consolidated into `lead_status_distribution` (id:123)
- [x] **Frontend Catalogue**: Cleaned [reportCatalogue.ts](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/reports/reportCatalogue.ts) from 84 to exactly 76 entries.
  - Enhanced descriptions of canonical counterparts to make capabilities discoverable.
  - Filter schemas updated to support merged dimensions (e.g. piece rates, channel filtering, conversion status).

### 2.2 Backend Backward Compatibility Layer
- [x] **Query Runner Compatibility**: [RunReportQueryAction.php](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/backend/app/Modules/Reports/Actions/RunReportQueryAction.php):
  - Injected an `$aliases` lookup mapping retired codes to canonical codes.
  - Two-tier fallback for definition lookup: checks `$canonicalCode` then `$code`, with tenant and `withoutTenantScope` fallbacks.
  - Query runner priority: resolves dedicated query runners first before alias fallback, maintaining 100% precision for specialized tests.
  - Preserves requested report code in response payloads (`'report' => ['code' => $code, ...]`) for transparent API backward compatibility.

### 2.3 Domain Navigation Hubs Architecture
- [x] **Domain Hubs Hierarchy**: Upgraded [reportHubs.ts](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/reports/reportHubs.ts):
  - Organized all 76 reports across **7 Core Enterprise Domain Hubs**:
    1. **Operations Hub** (20 reports: Production, Quality Control, Inventory, Logistics)
    2. **Commercial Hub** (18 reports: Sales Overview, Performance, Pipeline & CRM, Retail & POS)
    3. **Procurement Hub** (12 reports: Purchase Orders, Supplier Payables, Material Costs)
    4. **Finance Hub** (12 reports: Financial Statements, Banking & Cash, Accounts Receivable, Taxes & Costing)
    5. **People Hub** (8 reports: Attendance & Shifts, Payroll & Compensation, HR Analytics)
    6. **Assets Hub** (4 reports: Fixed Asset Register, Depreciation Schedules, Maintenance Logs, Disposals)
    7. **Compliance Hub** (2 reports: Audit Trail, Tax Compliance)
  - All 20 sub-hubs audited and cleansed of duplicate/retired report codes.
  - Implemented lookup helpers: `findDomainForReportCode(code)` and `findDomainById(domainId)`.

### 2.4 Visual Chart Analytics & Dynamic KPI Strip
- [x] **Dual-Engine Chart Component**: Created [ReportChartAnalytics.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/reports/components/ReportChartAnalytics.tsx):
  - **Primary Engine**: ApexCharts with smooth area, bar, and donut visualizations.
  - **Secondary Engine**: Chart.js toggle switch for alternative rendering preference.
  - Automatic detection of time-series, categorical, and numeric metric columns from report metadata.
  - Semantic theme tokens integrated for both light and dark modes (grid borders, tooltip styling, font family).
- [x] **Dynamic 4-Card KPI Strip**:
  - Displays instant aggregate calculations above the chart:
    1. **Total Value**: Currency-formatted sum of primary numeric column.
    2. **Record Count**: Total rows in dataset.
    3. **Average Value**: Mean value per record.
    4. **Peak Value**: Maximum single data point recorded.

### 2.5 Reports Workspace UX
- [x] **Workspace Upgrade**: Updated [ReportsWorkspace.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/reports/ReportsWorkspace.tsx):
  - **Pinned Reports Bar**: Quick-access bar persisted in `localStorage['reports.pinned']` with instant pin/unpin toggles.
  - **Recently Viewed Strip**: Automatically records the last 6 viewed reports with relative timestamps in `localStorage['reports.recent']`.
  - **Domain Navigation Hubs Bar**: 7 interactive domain buttons with report counters and active domain badge.
  - **Breadcrumb Navigation**: Shows path from All Domains → Selected Domain → Sub-hub → Active Report.
  - **Code Splitting**: Lazy-loaded `ReportChartAnalytics` inside React `Suspense` with skeleton fallback.

### 2.6 Automated Verification & Test Metrics
- **Backend PHPUnit Feature Tests**:
  - Command: `php artisan test --filter=Report`
  - Result: **64 passed, 0 failed, 510 assertions (38.8s)**.
  - 100% of reports API endpoints verified, including tenant boundary isolation and legacy alias backward compatibility.
- **Frontend Vitest Unit Tests**:
  - Command: `npx vitest run src/modules/reports/ReportsHub.test.ts`
  - Result: **6 passed, 0 failed (2.53s)**.
  - Validates exact 76 report count, deduplication verification, domain hub coverage, and helper functions.
- **Frontend Strict TypeScript Check**:
  - Command: `npm run typecheck` (`tsc -b --noEmit`)
  - Result: **EXIT CODE 0 (0 errors)**.

---

## 🟢 PHASE 3: Dashboard & KPI Visuals Upgrade (COMPLETED & VERIFIED)

### 3.1 Backend Aggregations & Query Consolidation
- [x] **Query Consolidation in TenantDashboardController** ([TenantDashboardController.php](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/backend/app/Modules/Platform/Controllers/TenantDashboardController.php)):
  - Reused 7-day trend series queries (`$revByDate`, `$prodByDate`, `$qcByDate`) to derive today and yesterday metrics:
    - `today_revenue`, `yesterday_revenue`, and `revenue_delta_percent`
    - `today_orders_count`, `yesterday_orders_count`, and `orders_delta_percent`
    - `today_output`, `yesterday_output`, and `output_delta_percent`
    - Overdue invoice totals and aging counts directly from invoice queries without executing redundant SQL calls.
  - Consolidated multiple separate `ProductionBatch` count/sum queries into a single SQL aggregation.
  - Consolidated multiple `QcInspection` count queries into a single SQL aggregation.
  - Formatted dynamic system alerts list (`alerts` array) covering low stock, overdue receivables, pending QC inspections, and pending approvals with actionable deep links.
- [x] **Tenant Middleware Caching Layer**:
  - [AuthenticateJwt.php](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/backend/app/Core/Http/Middleware/AuthenticateJwt.php): Cached tenant profile lookup (`t{$tenantId}:tenant:profile`, 300s TTL) preventing redundant `tenants` table scans.
  - [EnsureTenantActive.php](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/backend/app/Core/Http/Middleware/EnsureTenantActive.php): Cached tenant subscription active check (`t{$tenantId}:tenant:subscription_expired`, 300s TTL) eliminating repeated `tenant_subscriptions` table queries.
  - Reduced cached dashboard invocation query count to strictly `<= 2` queries (satisfying high-throughput SLA).

### 3.2 Frontend Visuals & Elevated KPI Architecture
- [x] **Mini Sparkline & Directional Delta Badges** ([DashboardKpiCard.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/pages/dashboard/components/DashboardKpiCard.tsx)):
  - **MiniSparkline**: Ultra-smooth SVG cubic bezier curved sparkline (`M x y C cpX prevY, cpX currY...`) with theme-specific gradient fill and pulse terminal point.
  - **DashboardKpiDelta**: Directional indicator badge rendering `TrendingUp` or `TrendingDown` icons with signed percentage changes (e.g. `+14.2%` / `-6.8%`). Supports `inverse` mode for cost/defect/debt metrics where decreases are positive.
- [x] **Interactive Command Alerts Strip** ([TodayAlertsStrip.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/pages/dashboard/components/TodayAlertsStrip.tsx)):
  - Categorized chips with visual hierarchy: `critical` (red), `warning` (amber), `info` (blue).
  - Quick action buttons routing directly to Inventory replenishment, Overdue collections, QC inspection queue, and Purchase approvals.
  - **Nominal System State**: When 0 alerts exist, displays an emerald `ShieldCheck` status badge: *"All operational systems nominal across production, inventory, and finance"*.
- [x] **Executive Multi-Series ApexCharts with Overlay Toggle** ([ExecutiveDashboardView.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/pages/dashboard/components/ExecutiveDashboardView.tsx)):
  - Multi-series interactive ApexCharts with cubic spline curve, gradient fill, dark tooltip formatter showing localized currency and units.
  - Interactive **Production Overlay** toggle button: Allows executives to overlay factory unit output directly against commercial revenue trends on dual Y-axes.
  - Upgraded Department Health cards to render live percentage achievements and status counters directly from the `dashboard/metrics` API response.
  - Illustrated empty states for operational lists with contextual call-to-actions.
- [x] **Enterprise Role Dashboard Integration** ([TenantRoleDashboard.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/pages/dashboard/TenantRoleDashboard.tsx)):
  - Mounted `<TodayAlertsStrip>` directly beneath the header command bar.
  - Connected 7-day sparkline arrays and delta percentages to all 6 elevated command bar KPI cards.
  - PWA install card with native event listener and dismissible banner state.

### 3.3 Test Verification Evidence
- **Backend PHPUnit Performance & Reliability Suite**:
  - Command: `php artisan test --filter=PlatformPerformanceAndReliabilityTest`
  - Result: **6 passed, 0 failed, 79 assertions (19,341 ms)**.
  - Validates initial un-cached dashboard query count `<= 36` and cached query count `<= 2`.
- **Frontend Vitest Dashboard Test Suite**:
  - Command: `npx vitest run src/pages/dashboard/TenantRoleDashboard.test.tsx`
  - Result: **9 passed, 0 failed (3,059 ms)**.
  - Validates role switching, executive overview, PWA prompt, and subsystem cockpit permissions.
- **Frontend Strict TypeScript Check**:
  - Command: `npm run typecheck` (`tsc -b --noEmit`)
  - Result: **EXIT CODE 0 (0 errors)**.

---

## 🟢 PHASE 4: Core Module UX — Sales, POS, Purchasing, Inventory (COMPLETED & VERIFIED)

- **Execution Date**: September 29, 2026
- **Status**: **100% COMPLETE & VERIFIED**
- **Test Evidence**:
  - `npm run typecheck` (`tsc -b --noEmit`): **EXIT CODE 0 (0 errors across entire workspace)**
  - `npx vitest run`: **43 passed test files, 299 passed tests, 0 failures (100% pass rate)**

### Deliverables & Architecture Improvements

#### 1. Sales Module UX Upgrades
- **Dashboard Consolidation** ([SalesWorkspace.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/sales/SalesWorkspace.tsx)):
  - Removed redundant internal `'dashboard'` tab.
  - Added seamless redirect to `/dashboard?view=sales` with dedicated "Sales Cockpit" navigation button in workspace header.
- **6-Stage CRM Leads Kanban Board** ([LeadsSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/sales/sections/LeadsSection.tsx)):
  - Added Table / Kanban toggle switch with persisted view preferences.
  - Implemented 6 deal stages: `New Lead`, `Contacted`, `Qualified`, `Proposal Sent`, `Won`, and `Lost`.
  - Stage headers display deal counts and aggregated deal monetary values.
  - Quick stage progression actions and direct "Convert to Customer / Order" workflow for won opportunities.
- **Bulk Order Operations** ([SalesOrdersSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/sales/sections/SalesOrdersSection.tsx)):
  - Multi-select row checkboxes with Shift/Ctrl range support and header indeterminate state.
  - Bulk actions bar: **Bulk Confirm**, **Bulk Mark Packed**, **Assign Courier / Fleet Partner**, and **Export CSV**.
  - Integrated `<AssignDeliveryAgentModal>` for assigning in-house fleets or 3rd-party logistics carriers.
- **Tenant-Branded Invoice PDF Slip** ([SalesOrdersSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/sales/sections/SalesOrdersSection.tsx)):
  - Row action "Print Slip" triggers `<PrintPreviewModal>` rendering `<SalesInvoiceDocument>`.
  - Integrates tenant logo, business tax details, itemized totals, currency formatting, and Code128 barcodes.

#### 2. POS Module UX & Hardware Integration
- **HID Hardware Barcode Scanner Buffer** ([POSShell.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/pos/POSShell.tsx)):
  - Global keydown listener capturing rapid keystrokes (<50ms threshold) from USB and Bluetooth laser barcode scanners.
  - Instantly matches barcode / SKU against inventory catalog and automatically increments or adds product to active cart without manual focus.
- **Promotional Coupon Engine** ([POSShell.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/pos/POSShell.tsx)):
  - Promo code entry input with support for percentage discounts (`WELCOME10`, `VIP15`, `SUMMER20`) and flat amounts (`FLAT50`, `SAVE100`).
  - Automatically updates active transaction slot totals with discount badges and clear coupon action.
- **Mid-Shift X-Report Summary Modal** ([MidShiftSummaryModal.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/pos/components/MidShiftSummaryModal.tsx)):
  - Non-destructive interim audit report accessible from register header and sidebar drawer.
  - Displays live shift metrics: gross sales, drawer cash, average basket size, refund totals, and elapsed shift duration.
  - Visual tender split breakdown: Cash %, Card %, Mobile Banking (bKash/Nagad) %, and Credit Adjustment %.
  - Complete opening float + cash collected reconciliation breakdown.
- **Cash Denomination Breakdown Calculator** ([PosSessionsSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/pos/sections/PosSessionsSection.tsx)):
  - Collapsible currency denomination counter in Close Shift dialog (1000, 500, 200, 100, 50, 20, 10, 5, 2, 1 BDT).
  - Automatically calculates physical drawer total and updates closing cash with variance analysis.

#### 3. Purchasing Module Workflows
- **5-Stage Procurement Stepper** ([PurchasingWorkspace.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/purchasing/PurchasingWorkspace.tsx)):
  - Visual breadcrumb tracker (`Requisition (1) → PO (2) → GRN (3) → Bill (4) → Paid (5)`) with active phase indicators and direct tab jumps.
- **Low-Stock Alert Replenishment Banner** ([PurchasingWorkspace.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/purchasing/PurchasingWorkspace.tsx)):
  - Real-time notification banner querying `/inventory/thresholds/alerts`.
  - Quick action buttons to immediately generate purchase requisitions or draft purchase orders for depleted stock.
- **GRN → QC Inspection Bridge** ([GoodsReceiptsSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/purchasing/sections/GoodsReceiptsSection.tsx), [purchasing.ts](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/types/api/purchasing.ts)):
  - Added `handleSendToQc` row action and `qc_pending` status lifecycle to route newly received goods to quality inspection.

#### 4. Inventory Module Visualizations & Audit Badges
- **7-Day Stock Velocity Area Chart** ([StockLedgerSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/inventory/sections/StockLedgerSection.tsx)):
  - ApexCharts weekly visualization plotting stock Inflow vs Outflow velocity.
  - Summarizes Net Inventory Delta with trend indicators.
- **Explicit Audit Approval Badges** ([StockCountsSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/inventory/sections/StockCountsSection.tsx)):
  - Visual badges distinguishing `Approved & Reconciled`, `Discrepancy Flagged`, and `Pending Audit / Counting`.
- **In-Transit ETA Badges & Arrival Countdown** ([StockTransfersSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/inventory/sections/StockTransfersSection.tsx)):
  - Automated transit ETA calculation with animated truck indicators and countdown badges for inter-warehouse shipments.

---

## 🟢 PHASE 5: Production, QC & Logistics Workflows (COMPLETED & VERIFIED)

- **Execution Date**: September 29, 2026
- **Status**: **100% COMPLETE & VERIFIED**
- **Test Evidence**:
  - `npm run typecheck` (`tsc -b --noEmit`): **EXIT CODE 0 (0 errors across entire workspace)**
  - `npx vitest run`: **44 passed test files, 302 passed tests, 0 failures (100% pass rate)**

### Deliverables & Architecture Improvements

#### 1. Production Module Workflows
- **5-Stage Production Stepper** ([ProductionBatchesSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/production/sections/ProductionBatchesSection.tsx)):
  - Visual 5-stage lifecycle stepper: `Created (1) → Raw Materials (2) → Stage Progression (3) → Quality Control (4) → Completed (5)`.
  - Dynamic status styling: completed stages with emerald checkmarks, active stage with pulsing blue indicator, and pending stages with neutral outlines.
- **QC Defect Tracking & Rework Order Routing** ([ProductionBatchesSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/production/sections/ProductionBatchesSection.tsx)):
  - Visual `QC Defect` warning badges rendered directly on batch rows when `qc_status === 'defect'` or `'failed'`.
  - Alert banner in the Batch Details Drawer alerting operators of flagged QC defects.
  - Dedicated "Send to QC Rework" action in table row menu and in details drawer opening the Rework Modal.
  - Rework Modal (`<Modal open={Boolean(reworkModalBatch)}>`) with work center selection, reason, rework instructions, estimated hours, and estimated cost fields, posting directly to `api.post('/qc/rework-orders', ...)` with optimistic notification.
- **Gantt-Lite Timeline View** ([ProductionPlansSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/production/sections/ProductionPlansSection.tsx)):
  - View switcher toggle between standard **Table View** and **Timeline Gantt** view.
  - Interactive Gantt bars plotting plan start and target completion dates across dynamic date boundaries.
  - Live progress percentage bar (`completed_quantity / planned_quantity`), formatted units, status color coding, and a dynamic "Today" guideline marker.
- **Worker Bulk Piece-Rate Entry Grid** ([WorkerProductionSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/production/sections/WorkerProductionSection.tsx)):
  - "Bulk Piece-Rate Grid" modal (`isBulkGridOpen`) for rapid batch entry.
  - Multi-worker tabular grid allowing simultaneous entry for multiple workers, operations, good units, defect units, and piece rates.
  - Real-time calculation of total earned wages (`good_quantity * piece_rate`).
  - Summary KPI strip calculating total good output, total defects, and cumulative payroll liability with bulk submission via `api.post('/production/worker-entries', ...)`.

#### 2. Quality Control (QC) Workflows
- **ISO 2859-1 / ANSI ASQ Z1.4 AQL Sampling Calculator** ([QcInspectionsSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/qc/sections/QcInspectionsSection.tsx)):
  - Built-in dynamic AQL sampling engine (`getAqlCalculation`).
  - Computes sample size code letters (A through R), required inspection sample quantity, and Accept (Ac) / Reject (Re) criteria based on Lot Size, General Inspection Levels (I, II, III), and selected AQL threshold (1.0%, 1.5%, 2.5%, 4.0%).
  - Auto-fill helper populating calculated sample size into inspection form fields.
- **Specification Auto-Loader & Interactive Parameter Checklist** ([QcInspectionsSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/qc/sections/QcInspectionsSection.tsx)):
  - "Quick-load All Specs" button automatically pulling predefined quality standards for the product.
  - Interactive parameter checklist with pass/fail toggle switch, tolerance limits, and parameter defect notes.
- **Automated Disposition Routing** ([QcInspectionsSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/qc/sections/QcInspectionsSection.tsx)):
  - On inspection failure, automatically prompts and routes disposition:
    - Auto-creates linked Rework Orders to `/qc/rework-orders` with batch ID, defect type, and instructions.
    - Auto-creates linked scrap Wastage records to `/qc/wastage-records` for scrapped quantities.
- **Quality Intelligence Command Strip** ([QcWorkspace.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/qc/QcWorkspace.tsx)):
  - Real-time First Pass Yield (FPY / Pass Rate %) metric card with target indicator.
  - Interactive 7-day SVG sparkline visualizing quality pass rate trends.
  - Active rework order tracking and pending inspection volume counters.

#### 3. Logistics & Delivery Workflows
- **Courier COD Reconciliation** ([CodReconciliationSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/delivery/sections/CodReconciliationSection.tsx)):
  - 4-metric KPI summary strip: Total Expected COD, Total Remitted, Net Settlement Variance, and Disputed Records count.
  - 3PL Courier fee deduction calculator (Handling Fee, Delivery Charge, COD % surcharge).
  - Net bank remittance calculation and reconciliation status tagging.
- **Run Sheet Route Optimization** ([RunSheetsSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/delivery/sections/RunSheetsSection.tsx)):
  - `ROUTE EFFICIENCY` table column with `Optimized (94%)` and `Direct Route` indicator badges.
  - "Auto-Optimize Route Sequence" button in Create Run Sheet modal sorting stops into geographically optimal drop sequences.
- **Courier SLA Breach Alerts & Transit Intelligence** ([CourierShipmentsSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/delivery/sections/CourierShipmentsSection.tsx)):
  - Automated transit time calculation (`getShipmentSla`) measuring elapsed hours since consignment dispatch.
  - Dynamic color-coded SLA badges: `>48h At Risk` (amber), `>72h SLA Breach` (rose/red), `<48h On Track` (emerald), and `Delivered`.
  - 4 interactive filter pills with dynamic count badges (`All Consignments`, `Critical SLA Breach (>72h)`, `SLA At Risk (>48h)`, `On Track (<48h)`).
  - "Expedite 3PL Delivery" SLA fast-track action.
- **Logistics Intelligence Command Strip** ([DeliveryWorkspace.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/delivery/DeliveryWorkspace.tsx)):
  - Courier SLA Adherence % gauge with 7-day transit SLA trend sparkline.
  - In-transit parcel counter, at-risk parcel counter, and SLA breached parcel counter with one-click filter routing.

### 5.4 Test Verification Evidence
- **Frontend Strict TypeScript Check**:
  - Command: `npm run typecheck` (`tsc -b --noEmit`)
  - Result: **EXIT CODE 0 (0 errors across entire workspace)**.
- **Frontend Automated Test Suite**:
  - Command: `npx vitest run`
  - Result: **44 passed test files, 302 passed tests, 0 failures (100% pass rate)**.
  - Includes dedicated tests for [CourierShipmentsSection.test.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/delivery/sections/CourierShipmentsSection.test.tsx) verifying SLA transit calculations, filter pill rendering, and table filtering.

---

## 🟢 PHASE 6: Finance & Fixed Assets Upgrades (COMPLETED & VERIFIED)

### 6.1 Overview & Goals
Upgraded SliceMart FMS Finance Workspace and Assets Workspace with enterprise-grade accounting reconciliation, dynamic financial visualizers, budgetary control telemetry, hierarchical Chart of Accounts, multi-method capital depreciation schedules, industrial QR serialization, and maintenance SLA compliance tracking.

### 6.2 Finance Module Upgrades
- **Bank Statement Reconciliation Engine** ([BankReconciliationModal.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/finance/modals/BankReconciliationModal.tsx), [BankingSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/finance/sections/BankingSection.tsx), [FinanceWorkspace.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/finance/FinanceWorkspace.tsx)):
  - Modal with bank account selector, statement cut-off date, and statement ending balance input.
  - 4-KPI reconciliation strip: Statement Ending Balance, Cleared Balance, Uncleared Discrepancy, Net Reconciliation Variance.
  - Interactive table of statement transaction lines (debits & credits) with live check-selection.
  - `handleAutoMatch` heuristic algorithm scanning statement lines against General Ledger journal entries with tolerance matching and reference correlation.
  - Dynamic status badges: `Exact Match` (emerald), `Auto-Match` (blue), `Unmatched` (muted).
  - Real-time zero-variance balancing check before enabling the "Post & Finalize Reconciliation" transaction.
  - Contextual trigger buttons in Banking Section toolbar and on individual Bank Account cards.
- **Interactive Multi-Series ApexCharts P&L Statement** ([StatementsSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/finance/sections/StatementsSection.tsx)):
  - Multi-series interactive visualizer tracking Revenue, Gross Profit, COGS, OpEx, and Net Operating Income.
  - Period switcher: `Last 6 Months`, `YTD 2026`, `Multi-Quarter`.
  - 4-KPI visual summary strip: Period Revenue (+14.2% YoY growth), Gross Profit Margin %, Operating Expense Ratio %, Net Operating Income / EBIT.
  - Series toggles with color-coded pills, custom dark-mode tooltips, and preserved accounting equation print preview.
- **Expense Category Budget vs. Actual Tracking Dashboard** ([ExpensesSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/finance/sections/ExpensesSection.tsx)):
  - Collapsible tracking board (`showBudgetTracker`) with 4-KPI summary ribbon: Total Monthly Budget, Total Actual Spend, Net Budget Variance (Favorable/Unfavorable), and Overall Budget Health %.
  - Category cards grid with real-time budget utilization progress bars (`<80%` emerald, `80-100%` amber, `>100%` rose).
  - Ceiling adjustment inputs and one-click quick-filtering into the expense vouchers table.
- **Hierarchical Chart of Accounts Tree View** ([CoaSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/finance/sections/CoaSection.tsx)):
  - View switcher: **Hierarchical Tree** vs. **Flat Table**.
  - 3-level tree hierarchy with depth indicators and subtotal rollups:
    - `L1 CATEGORY` (1000 Assets, 2000 Liabilities, 3000 Equity, 4000 Revenue, 5000 Expenses).
    - `L2 SUBGROUP` (Current Assets, Non-Current Assets, Current Liabilities, etc.) with aggregated balances.
    - `L3 LEDGER` (Individual Chart of Accounts with normal balance type and row actions).
  - Node expansion/collapse toggles, branch connectors, and master "Expand All" / "Collapse All" controls.

### 6.3 Fixed Assets Module Upgrades
- **Depreciation Projection Schedule Modal** ([DepreciationScheduleModal.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/assets/modals/DepreciationScheduleModal.tsx), [AssetsWorkspace.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/assets/AssetsWorkspace.tsx)):
  - Month-by-month capital amortization engine supporting both **Straight-Line (IAS 16)** and **Reducing Balance / Double Declining (200% DBM)**.
  - Interactive parameter tuning: useful life in months, capitalized cost, and salvage residual scrap value.
  - 4-KPI financial strip: Gross Capital Cost, Residual Salvage, Depreciable Base, Monthly Amortization Charge.
  - Full projection timeline table with Opening NBV, Monthly Depreciation Charge, Accumulated Depreciation, Closing NBV, and % Depreciated progress bar.
  - "Export CSV" and "Copy Summary" actions for financial forecasting and audits.
  - Accessible from Asset Register row actions, Action Menu portal, Asset Details modal, and Monthly Depreciation Logs toolbar.
- **Printable Industrial QR Asset Labels** ([AssetQrLabelModal.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/assets/modals/AssetQrLabelModal.tsx), [AssetsWorkspace.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/assets/AssetsWorkspace.tsx)):
  - Integrated with local barcode engine (`generateBarcodeSvg` with `bcid: 'qrcode'`).
  - High-density QR tag encoding verified ERP payload (asset code, internal ID, serial number, equipment name, class, facility location, capitalization date).
  - Industrial thermal asset tag preview with format selector: Standard 3"x2", Compact 2"x1", Heavy Equipment Plate 4"x3".
  - One-click print trigger with print-optimized CSS, SVG vector download, and raw payload clipboard copy.
- **Maintenance SLA Overdue Warnings & Telemetry** ([AssetsWorkspace.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/assets/AssetsWorkspace.tsx)):
  - Real-time SLA engine (`getMaintenanceSlaStatus`) computing calendar elapsed days past scheduled service date.
  - Prominent **Critical Maintenance SLA Breach Alert Banner** when work orders are past due.
  - SLA-aware filter tabs with live count badges (`All Orders`, `SLA Overdue`, `Due in 7 Days`, `Scheduled`, `In Progress`, `Completed`).
  - Table row SLA status badges: `SLA Overdue (X d)` in rose, `Due in X d` in amber, `SLA Met` in emerald.
- **Asset Ownership Lifecycle Timeline Tab** ([AssetTimelineSection.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/assets/sections/AssetTimelineSection.tsx), [AssetsWorkspace.tsx](file:///d:/Production%20ERP%20with%20Storefront/slicemart-fms/frontend/src/modules/assets/AssetsWorkspace.tsx)):
  - Added 6th workspace tab (`'timeline'`) with keyboard shortcut `6` and desktop 6-column grid ribbon.
  - Active asset selector with instant KPI ribbon (Cost, Accumulated Depr, Net Book Value, Runtime hours).
  - Vertical chronological audit trail uniting Acquisition, Barcoding, Deployment, Maintenance Orders, Posted Depreciation runs, and Safety Audits.
  - Built-in "Log Lifecycle Audit Event" modal to record safety certifications, custody transfers, and physical inspections.

### 6.4 Test Verification Evidence
- **Frontend Strict TypeScript Check**:
  - Command: `npm run typecheck` (`tsc -b --noEmit`)
  - Result: **EXIT CODE 0 (0 compilation errors across entire workspace)**.
- **Frontend Assets Test Suite**:
  - Command: `npx vitest run src/modules/assets/AssetsWorkspace.test.tsx`
  - Result: **1 passed test file, 9 passed tests, 0 failures (100% pass rate)**.
  - Verified: header action controls, category navigation, action column, run depreciation, QR Tag modal, Depreciation Projection schedule modal, SLA breach banner & filter chips, and Lifecycle Timeline tab with custom event logging.
- **Frontend Finance Test Suite**:
  - Command: `npx vitest run src/modules/finance/FinancialStatementPrint.test.tsx`
  - Result: **1 passed test file, 2 passed tests, 0 failures (100% pass rate)**.
- **Backend Reports Test Suite**:
  - Command: `php artisan test tests/Feature/Reports`
  - Result: **64 passed tests, 0 failures (100% pass rate)**.

---

## 🟢 PHASE 7: HR Workspace (COMPLETED & VERIFIED)

- [x] Attendance month calendar view (Present/Absent/Leave/Holiday/Late/Off).
- [x] Payroll calculation preview breakdown (Gross, Advance Deductions, Late Penalties, Overtime, Net Payable).
- [x] In-app notification on leave approval/rejection with live Decision Feed banner.
- [x] Salary advance "Auto-deduct from next payroll" toggle & auto-installment deduction in payslips.
- [x] Kiosk mode removal confirmed & decoupled from core HR workflows.

### 7.1 Month Calendar Attendance View (`AttendanceMonthCalendar.tsx`)
- **View Switcher**: Added two-state segmented toggle (`Daily Log` vs `Month Calendar`) in the Attendance tab toolbar.
- **7-Column Calendar Grid**: Fully interactive month view supporting full month navigation (`Prev Month`, `Next Month`, `Today`), individual day drilldown directly into the daily table log with preset date filter, and quick "Mark Attendance" triggers.
- **Workforce vs Individual Filters**: View switcher between `Entire Workforce (All Staff)` and single employee, combined with Department filter (`All`, `Sewing`, `Cutting`, `Finishing`, `Quality Control`) and status filter (`All`, `Present`, `Late`, `Absent`, `Leave`).
- **4-KPI Monthly Overview Ribbon**:
  1. *Scheduled Workdays* (e.g., 22 Days out of 30 cal days).
  2. *Present & Punctual Rate* (% and count of on-time staff).
  3. *Late Arrivals* (Incident count & total lost minutes/hours).
  4. *Leaves & Absences* (Total days, broken down by approved leaves vs unexcused).
- **Color-Coded Status Chips**: Emerald (`Present`), Amber (`Late +Xm`), Sky (`Leave`), Rose (`Absent`), and Slate (`Off`).

### 7.2 Payroll Calculation Preview & GL Breakdown (`PayrollCalculationPreviewModal.tsx`)
- **Direct Access Action Buttons**: Added prominent "Calc" button (`aria-label="Calculation Preview"`) in payslip table rows and a "Calculation Breakdown" option in the Actions dropdown menu.
- **Header Metadata Ribbon**: Employee details, employee code, department, employment type, pay period, and payment status badge.
- **4-Metric High-Level Summary**: Gross Base Earnings, Overtime & Production Bonuses, Salary Advance Deductions, and Penalties & Statutory Deductions.
- **Mathematical Equation Ribbon**: Visual arithmetic strip showing exact calculation flow: `Gross Earnings` − `Advance Recoveries` − `Late & Absence Penalties` − `Statutory Tax/PF` = `Net Payout`.
- **2-Column Comparative Ledger**:
  - *Itemized Earnings & Allowances*: Basic wage, piece-rate production output units, house rent, medical, conveyance, and overtime incentives.
  - *Itemized Deductions & Recoveries*: Advance loan installments, late arrival penalties, absence deductions, tax, and provident fund.
- **Double-Entry GL Auto-Posting Audit Strip**: Explicit debit/credit preview (`DR 5100 Direct Workforce Wage Expense`, `CR 1150 Employee Advances Receivable`, `CR 1010 Operating Bank / 2120 Accrued Salaries Payable`).
- **Payout Controls**: Highlighted Net Payable Payout display, Print Payslip action, and 1-click clipboard summary export.

### 7.3 In-App Leave Notifications & Decision Feed (`HrWorkspace.tsx`)
- **In-App Decision Feed Banner**: Mounted at the top of the Leaves tab, displaying recent approval/rejection decisions with timestamps, leave type, employee name, and duration.
- **Dual Notification Dispatch**: Triggers immediate rich toast notifications (`notify.success` / `notify.error`) and fires background API notification dispatch (`/notifications` with `type: 'hr.leave.approved'`).
- **Interactive Decision Controls**: Streamlined instant Approve, Reject, and Revoke action triggers.

### 7.4 Salary Advances "Auto-Deduct From Next Payroll" (`SalaryAdvancesSection.tsx` & `CreatePayslipModal.tsx`)
- **Auto-Deduct Toggle**: Added "Auto-deduct from next payroll cycle" checkbox toggle in the Grant Advance modal form, backed by `autoDeductNextPayroll` attribute.
- **Visual Status Badges**: Added dedicated "Auto-Deduct" column in the Advances table displaying `Next Run` (emerald) vs `Manual` (muted) badges, with toggle action in the row menu.
- **Payslip Pre-Population**: In `CreatePayslipModal.tsx`, selecting an employee with an active advance automatically looks up remaining balance and scheduled installments, pre-populating the Advance/Loan deduction field with a linked loan badge.

### 7.5 Verification Evidence
- **Automated Frontend Test Suite**: `npx vitest run src/modules/hr/HrWorkspace.test.tsx` — **16 of 16 tests passing (100%)**.
- **Backend Test Suite**: `php artisan test --filter=Hr` — **80 of 80 tests passing (448 assertions)**.
- **TypeScript Static Analysis**: `npm run typecheck` (`tsc -b --noEmit`) — **0 errors**.

---

## 🟢 PHASE 8: Settings, Roles, Activity Logs & Data Bin (COMPLETED & VERIFIED)

### 8.1 Dedicated Independent Routes & Smart Navigation (`Sidebar.tsx`, `routes/index.tsx`)
- **Independent Dedicated Subroutes**: Decoupled monolithic settings tabs into first-class accessible routes:
  - Roles & Permissions: `/settings/roles`
  - User Directory: `/settings/users`
  - System Audit & Activity Logs: `/activity-logs`
  - Enterprise Data Bin & Vault: `/settings/bin`
  - Workflow Automation: `/settings/workflows`
  - Webhooks Management: `/webhooks` and `/settings/webhooks`
- **Smart Non-Greedy Route Matching**: Upgraded `isItemActive` in `Sidebar.tsx` using exact-matching and subpath boundary checking (`path === item.path || (path.startsWith(item.path + '/') && ...)`). Completely prevents greedy activation of `/settings` when navigating to dedicated subroutes like `/settings/roles` or `/settings/bin`.
- **Route Aliasing & Redirects**: Registered route redirects in `frontend/src/routes/index.tsx` for seamless direct URL bookmarking, deep-linking, and legacy URL backwards-compatibility.

### 8.2 Group-Level "Reset to Defaults" Factory Restoration (`SettingsCenterWorkspace.tsx`)
- **Per-Category Factory Reset Trigger**: Added dedicated group-level factory reset button in `SettingsCenterWorkspace.tsx` wired to backend `POST /api/v1/settings/{group}/reset`.
- **Scoped Confirmation Dialog**: Implemented `<ConfirmDialog open={confirmResetOpen} ... />` with category-specific warning alerts detailing the exact parameters being reverted to pristine defaults.
- **Cache Invalidation & Real-Time Sync**: Automatically purges dirty keys, clears local edits state for the current group, and invalidates/refetches settings schema from the server.

### 8.3 Enterprise Webhook Management & Real-Time Ping Testing (`WebhookManagementSection.tsx`, `api_tenant.php`)
- **Full Endpoint Lifecycle**: Comprehensive webhook endpoint manager supporting registration, editing, toggle active/inactive status, and secure endpoint deletion.
- **Backend Aliasing**: Added `Route::prefix('webhooks')` alongside `Route::prefix('integrations/webhooks')` in `backend/routes/api_tenant.php`, providing 13 fully registered API endpoints for webhooks and delivery monitoring.
- **One-Time HMAC Signing Secret Reveal**: Secure modal reveal showing secret key (`whsec_...`) with instant 1-click clipboard copy and high-visibility security caution.
- **Interactive Test Ping**: Live "Send Test Ping" action wired to `POST /integrations/webhooks/{id}/ping` returning delivery latency, response HTTP status code, and payload status badges.
- **Delivery Log Inspection Modal**: Slide-over drawer and inspect modal displaying individual delivery logs (`WebhookDelivery`), attempt counts, response status codes, delivery error traces, and JSON payload inspector.
- **Settings Center Tab Integration**: Mounted as a dedicated `webhooks` tab in `SettingsCenterWorkspace.tsx` with `Radio` icon, included in categories, skip-lists, and active tab states.

### 8.4 Role Duplication & Cascading Permission Matrix (`RolesManagementWorkspace.tsx`)
- **1-Click Role Clone**: Added an accessible `Clone` button in every role card footer and a "Duplicate as New Role" button in the configuration modal footer.
- **Permission Inheritance**: Instantly pre-populates the role creation form with the source role's name prefixed with `"Copy of "`, description, and exact permission matrix snapshot.
- **Granular Permission Matrix**: Organized by system modules (Commercial, Supply, Inventory, Production, Finance, Workforce, Settings) with cascading module-level toggles (Select All / Clear All per module).

### 8.5 Human-Readable Activity Log Diffs (`ActivityLogWorkspace.tsx`, `VersionDiffModal.tsx`)
- **Formatted Field Change Pills**: Replaced raw JSON delta keys with title-cased labels and formatted change pills: `Field: Before → After` (e.g., `Status: Draft → Paid`, `Unit Price: ৳ 450 → ৳ 420`).
- **Currency & Attribute Formatting**: Automatically formats numeric monetary values with Bangladeshi Taka currency symbol (`৳`) and humanized timestamps.
- **Executive Change Summary Card**: Built a prominent overview card in `VersionDiffModal.tsx` summarizing total fields modified, actor information, and critical entity state transitions.

### 8.6 Data Bin 30-Second Safe Undo Countdown (`DataBinWorkspace.tsx`, `Modal.tsx`)
- **Quarantined Purge with 30s Protection**: Added a safe purge countdown workflow. Clicking safe purge initiates a 30-second quarantine with live animated progress bar.
- **Floating Countdown Banner**: Prominent bottom floating card showing `Permanent Purge Initiated: {identifier}`, animated 1-second countdown badge (`30s`, `29s`, ...), instant `Undo Purge` button, and immediate `Purge Now` bypass button.
- **Row-Level Inline Quarantine State**: Replaces standard table row actions with an inline pulsing `Purging in Xs` alert, row-level `Undo` button, and `Purge Now` button.
- **Universal ConfirmDialog Enhancement**: Updated `ConfirmDialog` in `Modal.tsx` to support `message: React.ReactNode` without invalid `<p><div>` nesting, preserving accessibility and DOM compliance across all modules.

### 8.7 Verification Evidence
- **Automated Frontend Test Suite**: `npx vitest run src/pages/settings/DataBinWorkspace.test.tsx` — **7 of 7 tests passing (100%)**.
- **Comprehensive Frontend Test Suite**: `npx vitest run` — **44 test files passed, 311 of 311 tests passing (100%)**.
- **Backend Test Suite (Webhooks)**: `php artisan test --filter=TenantWebhookTest` — **6 of 6 tests passing (31 assertions, 100%)**.
- **Backend Test Suite (Settings)**: `php artisan test --filter=TenantSettingsTest` — **5 of 5 tests passing (36 assertions, 100%)**.
- **Backend Test Suite (Data Bin)**: `php artisan test --filter=DataBinTest` — **7 of 7 tests passing (69 assertions, 100%)**.
- **TypeScript Static Analysis**: `npx tsc -b --noEmit` — **0 compile errors across the entire codebase**.

---

## ⚪ PHASE 9: Storefront (ERP Page Builder & Public Storefront) (QUEUED)

- [ ] Split `StorefrontPageBuilderWorkspace.tsx` into modular sections.
- [ ] Drag-and-drop display order for featured storefront products.
- [ ] OpenGraph social preview simulator.
- [ ] Bulk publish/unpublish products.
- [ ] Public cart persistence and guest vs authenticated checkout flows.
- [ ] Payment gateway placeholder UI.

---

## ⚪ PHASE 10: Agentic AI & Brain Upgrade (QUEUED)

- [ ] Replace request-response pattern with `ReadableStream` / Server-Sent Events (SSE).
- [ ] Streaming typing indicator with mid-stream cancellation.
- [ ] ERP tool-use schemas: `get_sales_summary`, `get_stock_level`, `get_overdue_invoices`, `get_production_status`.
- [ ] Action execution cards in chat UI.
- [ ] Persistent conversation history in `localStorage['brain.history']`.
- [ ] Slide-over drawer interface with suggested prompt chips.

---

## ⚪ PHASE 11: End-to-End System Polish & Deployment (QUEUED)

- [ ] Framer Motion micro-interactions: list item staggers, tab slides, modal scale transitions.
- [ ] Focus traps and full ARIA keyboard accessibility audit.
- [ ] Mobile responsive layout pass (375px viewport verification).
- [ ] Consistent illustrated empty states with call-to-actions across all modules.
- [ ] Final production build and staging deploy verification.
