# 🏭 Platform Audit & Upgrade Implementation Plan
### Operations ERP + Storefront — Full System Review
> Audit Date: September 29, 2026 | Status: **READY FOR PLANNING SIGN-OFF**

---

## PART 1 — CURRENT STATE AUDIT

### System Architecture Overview

```
Frontend:  React + TypeScript (Vite) — ~18 lazy-loaded workspace modules
Backend:   Laravel PHP (Multi-Tenant SaaS) — /api/* REST endpoints
DB:        MySQL with soft-deletes, tenant-scoped tables
Auth:      JWT + RBAC with fine-grained permission strings
Routing:   Domain-based split: Platform | ERP Tenant | Public Storefront
State:     TanStack Query + Zustand (authStore, capabilityStore)
i18n:      react-i18next (EN + BN)
Printing:  Custom PDF/thermal print stack via useDocumentPrint
```

---

## MODULE-BY-MODULE AUDIT

---

### 🎯 `/dashboard` — Executive Dashboard (`TenantRoleDashboard.tsx` — 1024 lines)

**What Exists:**
- Role-aware 9-perspective switcher: executive, production, inventory, qc, sales, finance, workforce, purchasing, logistics
- 6 KPI cards: Today Revenue, Active Orders, Receivables Due, Production Rate, QC Pass Rate, Stock Valuation
- Revenue trend chart (7D/30D/90D/Year/Custom) + Production overlay
- Department Health cards (Sales, Factory, Stock, Quality)
- Operations Command Palette with 10 quick-action shortcuts
- Operations Pulse live sidebar (Active Orders, Batches, QC, Reorder Alerts, Output, Receivable Due)
- Recent Invoices panel
- Storefront button → opens public storefront

**Issues Found:**
- [ ] The "Business Reports & Analytics" nav item links to `/reports` which is a different page — no quick summary visible on dashboard
- [ ] Custom Date Range modal exists but is a basic date input, no preset ranges (This Week, Last Month, Q1, etc.)
- [ ] KPI cards have flat visual design — no contextual sparklines behind numbers
- [ ] Revenue Trend chart has no interactivity on data points (no tooltip detail on hover)
- [ ] Operations Pulse shows raw "0 pcs" / "৳ 0.00" with no empty state treatment
- [ ] Department Health cards have hardcoded progress bars — not actually using real %
- [ ] Quick Action shortcut cards have no keyboard shortcut labels visible (they have `⌨` icons but no labels)
- [ ] No "today's alerts" inbox (low stock, overdue invoices, QC failures) — only shown in Pulse
- [ ] Onboarding startup modal exists but fires on every login if data is empty — no dismissal tracking
- [ ] The dashboard header shows "PERSPECTIVE" badge but tab switching is not keyboard-accessible
- [ ] No PWA "Add to Home Screen" prompt integrated into the dashboard UX — buried in sidebar
- [ ] Mobile view is not audited — the dashboard likely overflows on small screens

**Severity:** 🟡 Medium — Functional but lacks polish and interactivity

---

### 📊 `/reports` — Reports Management System (`ReportsWorkspace.tsx` — 1800 lines, `reportCatalogue.ts` — 1213 lines)

**What Exists:**
- 84 report definitions across 13 module categories
- Hub-and-spoke navigation with category filter sidebar
- Grid vs list view toggle
- Report viewer with date range filters, pagination, column sorting
- Export to Excel (XLSX), Print preview
- Saved views / bookmarks
- Freshness tier labels (live, hourly, daily)
- Report search

**Duplicate/Redundant Reports Found:**
| Report A | Report B | Verdict |
|---|---|---|
| `daily_sales` (id:31) | `b2c_sales` (id:118) | Merge — both are daily revenue ledgers |
| `product_profit` (id:41) | `product_wise_production` (id:101) | Keep separate |
| `worker_production` (id:5) | `worker_piece_rate_summary` (id:131) | **EXACT DUPLICATE** — same description |
| `salesman_leaderboard` (id:63) | `salesman_sales` (id:117) | Merge — both rank sales reps by revenue |
| `salesman_profitability` (id:119) | `salesman_profit_contribution` (id:126) | **NEAR DUPLICATE** — merge |
| `pending_deliveries` (id:70) | `delivery_sla_history` (id:129) | Keep separate |
| `purchase_summary` (id:20) | `supplier_purchase` (id:110) | Overlapping but serve different pivots |

**After Deduplication: ~76 clean reports**

**Navigation Issues:**
- 84 cards in a flat grid is overwhelming — users struggle to find reports
- Scrolling through the category sidebar + grid simultaneously is cognitively heavy
- No "recently viewed" or "most used" quick-access section
- No report favoriting/pinning at the top
- Filter by category + tier + date range all work independently — should be combined
- Report viewer itself is a table with no visualization — critical for executive reports
- No scheduled export / email delivery feature
- ID collision: `id:100` assigned to both `fixed_asset_register` and `total_input_output`

**Recommended Architecture — Report Hub Redesign:**
```
Reports Home
├── 📌 Pinned & Recently Viewed (top strip)
├── 🏠 Hub Navigator (8 domain hubs, not 13 module categories)
│   ├── Operations Hub  (Production + QC + Inventory)
│   ├── Commercial Hub  (Sales + POS + CRM)
│   ├── Procurement Hub (Purchasing + Delivery)
│   ├── Finance Hub     (Finance + Profitability)
│   ├── People Hub      (HR + Salesmen)
│   ├── Asset Hub       (Fixed Assets)
│   └── Compliance Hub  (Audit + QC Compliance)
└── 🔍 Search + Contextual Filters (date, tier, category)
```

**Severity:** 🔴 High — Navigation is the #1 usability problem

---

### 🛒 `/sales` — Sales Workspace (`SalesWorkspace.tsx` — 888 lines)

**What Exists:**
- 13 tabs: orders, invoices, deliveries, payments, returns, exchanges, customers, leads, pricelists, salesmen, targets, incentives, dashboard
- Category grouping: Operations | CRM | Performance
- Tab sections fully implemented as separate files

**Tabs Audit:**
| Tab | Status | Issues |
|---|---|---|
| Orders | ✅ Working | |
| Invoices | ✅ Working | |
| Deliveries | ✅ Working | Duplicates `/logistics` |
| Payments | ✅ Working | |
| Returns | ✅ Working | |
| Exchanges | ✅ Working | |
| Customers | ✅ Working | |
| Leads | ✅ Working | |
| Pricelists | ✅ Working | |
| Salesmen | ✅ Working | |
| Targets | ✅ Working | |
| Incentives | ✅ Working | |
| Dashboard | ✅ Working | Redundant with main `/dashboard` sales view |

**Issues:**
- [ ] "Deliveries" tab inside Sales is a duplicate of `/logistics` — confusing
- [ ] "Dashboard" tab inside Sales is a third dashboard — three levels of sales analytics (Main → Sales perspective → Sales tab dashboard)
- [ ] No bulk actions on Orders list (no "Mark as Packed" for multiple)
- [ ] Invoice PDF print layout — needs visual branding improvement
- [ ] Tab URL sync works (via `useWorkspaceTab`) but browser back doesn't restore scroll position
- [ ] Leads tab shows a basic table — no Kanban/pipeline view option
- [ ] Category tabs use keyboard shortcuts (O/C/P) but not documented anywhere

**Severity:** 🟡 Medium — Functional, needs tab rationalization

---

### 🖥️ `/pos` — Point of Sale (`POSShell.tsx` — 2411 lines)

**What Exists:**
- Full-screen POS interface (separate from app shell)
- Multi-slot cart system (parallel customer sessions)
- Split tender: cash + card + mobile banking + credit adjustment
- Customer lookup with phone search
- Hold/resume sales
- Thermal receipt printing
- Sales invoice printing
- POS return & exchange modals
- Session open/close workflow

**Issues:**
- [ ] Product search is text-only — no barcode scanner integration (API endpoint exists but no scanner input focus)
- [ ] Category filter exists but is a flat list — no visual category tiles
- [ ] Hold sales are stored in state only — lost on page refresh (should be persisted via API)
- [ ] Cash drawer summary in shift close shows ৳ totals but no denomination breakdown
- [ ] No quick-access "recent products" panel for repeat items
- [ ] Keyboard mode exists but key bindings are not shown on screen
- [ ] Customer credit balance display needs to show credit limit vs available credit
- [ ] No coupon/discount code entry field in checkout
- [ ] The "exit" button at top-left is too small — accidental exits possible
- [ ] No shift performance summary visible mid-shift (only at close)

**Severity:** 🟠 Medium-High — Core flow works, edge cases and UX gaps exist

---

### 🌐 `/storefront` (ERP side — `StorefrontSettingsWorkspace.tsx` — 2418 lines)

**What Exists:**
- 7 tabs: branding, header, footer, products, checkout, coupons, domains
- Theme presets with live preview sync
- Product publish/feature management
- Coupon management
- Domain configuration
- Page builder (separate `/storefront/builder` workspace at 181k lines)

**Issues:**
- [ ] Live preview is broadcast via `broadcastThemeDraft` but the preview pane is external storefront — requires two browser windows
- [ ] Product publish toggle works but bulk publish is not implemented
- [ ] Featured product display_order drag-and-drop is not implemented (there's an `display_order` field but no drag UI)
- [ ] Storefront branding colors — no contrast checker / accessibility validator
- [ ] "Coupons" tab (54k lines) is enormous — has complex coupon engine but no analytics on coupon usage
- [ ] Domain tab (44k lines) — SSL status is displayed but not actionable from UI
- [ ] No social media share preview (OG tags preview) visible in the branding section
- [ ] Page Builder (`StorefrontPageBuilderWorkspace.tsx` — 180k lines) — likely has significant performance issues given size

**Severity:** 🟡 Medium — Functional but preview UX is awkward

---

### 📦 `/catalogue` — Product Catalog (`CatalogueWorkspace.tsx` — 34k lines)

**What Exists:**
- Tabs: products, categories, brands, attributes, recipes/BOMs
- Recipe/BOM management for production costing

**Issues:**
- [ ] `CataloguePage.tsx` in `/pages` is separate from `CatalogueWorkspace.tsx` in `/modules` — unclear which renders where
- [ ] Product image gallery uploader exists as test file but needs audit
- [ ] No bulk attribute assignment on products
- [ ] Product variants (size/color) — unclear if fully supported
- [ ] Price list integration with catalogue not visible in UI

**Severity:** 🟡 Medium

---

### 🛍️ `/purchasing` — Procurement Module

**What Exists (5 sections):**
- Purchase Requisitions (`PurchaseRequisitionsSection.tsx` — 45k)
- Purchase Orders (`PurchaseOrdersSection.tsx` — 101k — largest section)
- Goods Receipts / GRN (`GoodsReceiptsSection.tsx` — 46k)
- Purchase Bills (`PurchaseBillsSection.tsx` — 70k)
- Purchase Returns (`PurchaseReturnsSection.tsx` — 42k)

**Issues:**
- [ ] PO workflow: Requisition → PO → GRN → Bill — approval chain exists but no visual workflow diagram
- [ ] No auto-trigger from low-stock alerts → Create PO shortcut
- [ ] GRN quality inspection checkbox exists but doesn't link to QC module
- [ ] Supplier payment is done from Finance module but there's no "Pay Supplier" button on the Bill
- [ ] No supplier rating/performance tracking in this module

**Severity:** 🟡 Medium

---

### 📦 `/inventory` — Warehouse & Stock (`InventoryWorkspace.tsx` — 28k)

**What Exists (5 sections):**
- Stock Ledger (65k lines) — perpetual ledger
- Stock Adjustments (54k) — write-offs, corrections
- Stock Counts (53k) — physical count vs system
- Stock Transfers (50k) — inter-warehouse
- Stock Thresholds (22k) — reorder alerts

**Issues:**
- [ ] No visual stock movement graph (in vs out over time)
- [ ] Stock count approval workflow exists but is linear — no multi-approver support
- [ ] Transfer "in-transit" status — no ETA tracking
- [ ] Threshold alerts are visible in workspace but not surfaced to dashboard dynamically
- [ ] No bin location / shelf tracking (only warehouse-level granularity)

**Severity:** 🟡 Medium

---

### 🏭 `/production` — Factory Management

**What Exists (3 sections):**
- Production Plans (`ProductionPlansSection.tsx` — 54k)
- Production Batches (`ProductionBatchesSection.tsx` — 69k) — largest
- Worker Production (`WorkerProductionSection.tsx` — 52k)

**Issues:**
- [ ] No visual Gantt chart for production scheduling
- [ ] Batch status timeline (Created → Started → QC → Completed) is text-only, no visual stepper
- [ ] Worker daily output log entry is a form — no quick bulk entry (scanner-friendly UI missing)
- [ ] Machine/line assignment in batch is dropdown — no capacity visualization
- [ ] No integration callout when QC fails a batch (no "Send to Rework" button from Production)

**Severity:** 🟠 Medium-High — Core logic works, workflow visualization missing

---

### 🔍 `/qc` — Quality Control (`QcWorkspace.tsx` — 28k)

**What Exists (4 sections):**
- QC Inspections (`QcInspectionsSection.tsx` — 72k)
- QC Parameters (`QcParametersSection.tsx` — 40k)
- Rework (`ReworkSection.tsx` — 66k)
- Wastage Records (`WastageRecordsSection.tsx` — 44k)

**Issues:**
- [ ] AQL 2.5 sampling calculator exists in parameters but is not used interactively during inspections
- [ ] "Pass" / "Fail" decision in inspection is a button — no defect categorization checklist visible
- [ ] Rework section has no link back to the originating production batch
- [ ] Wastage records are separate from QC — should be a natural outcome of fail/reject action
- [ ] No QC trend chart (pass rate over time per product/line)

**Severity:** 🟡 Medium

---

### 💰 `/finance` — Finance & Accounts (`FinanceWorkspace.tsx` — 4043 lines — LARGEST MODULE)

**What Exists (7 tabs + category grouping):**
- Chart of Accounts (CoA)
- Journal Entries
- Banking
- Expenses
- Costing (Product Costs)
- Statements (P&L, Trial Balance)
- Due Collection

**Issues:**
- [ ] **4043-line single file** — massive performance concern, splitting needed
- [ ] Journal entry double-entry validation shows debit/credit balance but error messaging is inline text — no visual indicator
- [ ] Bank reconciliation — import bank statement exists (CSV) but matching UI is not implemented (just imports raw rows)
- [ ] Due Collection section exists but is a separate section rather than being surfaced to dashboard
- [ ] P&L statement is rendered as a print document — no interactive chart version
- [ ] Expense categories have no budget vs actual comparison
- [ ] CoA has account type (Asset/Liability/etc.) but no hierarchy depth indicator

**Severity:** 🔴 High — Critical module but overly large file and missing reconciliation flow

---

### 🏗️ `/assets` — Asset Management (`AssetsWorkspace.tsx` — 3065 lines)

**What Exists (5 tabs):**
- Machinery (Plant & Equipment)
- Maintenance Orders
- Assets (General)
- Depreciation
- Categories

**Issues:**
- [ ] Depreciation entry is manual — no auto-calculate from asset life & method
- [ ] Maintenance order "priority" field exists but no SLA-based escalation
- [ ] Asset interlock status (operational/service_due/maintenance_lock) is set manually
- [ ] No QR code / asset tag print for physical labeling
- [ ] No asset assignment history (who had this machine before?)

**Severity:** 🟡 Medium

---

### 👥 `/hr` — Human Resources (`HrWorkspace.tsx` — 5140 lines — 2nd LARGEST)

**What Exists (8 tabs):**
- Employees
- Attendance
- Leaves
- Payroll
- Performance (Worker Piece Rate)
- Departments
- Salary Structures
- Salary Advances

**Issues:**
- [ ] **5140-line single file** — serious maintenance and performance issue
- [ ] Badge punch terminal modal — QR/NFC based attendance scanning is modal-only, no dedicated kiosk mode
- [ ] Payroll generation — "Create Payslip" modal runs calculations locally, no breakdown preview before confirm
- [ ] Leave request approval chain — basic approve/reject, no escalation or multi-level
- [ ] No calendar view for attendance (only table)
- [ ] Salary advance deduction is manual — no auto-deduction from next payroll
- [ ] Performance section is worker piece-rate only — no KPI-based assessment for office staff

**Severity:** 🟠 Medium-High — Core HR works but very large file and payroll preview missing

---

### ⚙️ `/settings/users` — User Management (`UsersManagementWorkspace.tsx` — 1391 lines)

**What Exists:**
- User list with role badges
- Create user modal (email + password + role)
- Suspend/activate toggle
- Reset password
- Employee linkage

**Issues:**
- [ ] Role assignment is single-role only — no multi-role per user
- [ ] No user profile photo upload
- [ ] "Last login" shows datetime but no location/device info
- [ ] No bulk user import (only manual creation)
- [ ] Impersonation (super-admin) button exists in platform but not accessible from tenant user list

**Severity:** 🟡 Medium

---

### 🔐 `/settings/roles` — Roles Management (`RolesManagementWorkspace.tsx` — 50k lines)

**What Exists:**
- Role list with permission counts
- Permission matrix with grouped toggles
- Custom role creation

**Issues:**
- [ ] Permission groups are flat — no visual hierarchy showing module → feature → action
- [ ] No "Copy role" function to duplicate an existing role
- [ ] System roles (Super Admin, etc.) show greyed checkboxes but no explanation of why they can't be changed
- [ ] No role preview showing which users are assigned to each role

**Severity:** 🟡 Medium

---

### 📋 `/activity-logs` — Audit Trail (`ActivityLogWorkspace.tsx` — 589 lines)

**What Exists:**
- Paginated log table
- Filter by action, type, date range, search
- Version diff modal (JSON diff view)

**Issues:**
- [ ] Filter UI is basic dropdowns — no saved filter presets
- [ ] JSON diff modal works but is developer-facing (raw JSON) — not user-friendly for managers
- [ ] No export to CSV/Excel for compliance reporting
- [ ] No "revert" capability from audit trail (logs only, no rollback)
- [ ] Table is text-dense — no visual user avatar or color-coded action types

**Severity:** 🟡 Medium

---

### 🗑️ `/settings/bin` — Data Bin (`DataBinWorkspace.tsx` — 1036 lines)

**What Exists:**
- Soft-deleted records recovery
- Domain filter (Commercial, Supply, Inventory, Manufacturing, Workforce, Finance, System)
- Permanent delete (with confirm)
- Bulk restore

**Issues:**
- [ ] "Permanent delete" is irreversible — needs a 30-second countdown undo window
- [ ] No retention policy display (how long items stay in bin before auto-purge)
- [ ] Domain tab filter shows counts but no sorting by deletion date
- [ ] No search by the deleted item's name/code

**Severity:** 🟡 Low-Medium

---

### ⚡ `/settings/workflows` — Workflow Automation (`WorkflowAutomationWorkspace.tsx` — 35k lines)

**What Exists:**
- Visual workflow builder (drag-and-drop implied by name)
- Trigger + Action configuration

**Issues (not yet deeply read but based on size — 35k is moderate):**
- [ ] Need to verify if workflow execution is actually functional or just a UI shell
- [ ] No workflow run history / success/failure logs
- [ ] Workflow conditions (IF-THEN logic) — unclear depth of supported operators

**Severity:** ⚠️ To Be Verified

---

### ⚙️ `/settings` — Settings Center (`SettingsCenterWorkspace.tsx` — 1659 lines)

**What Exists (confirmed in file header):**
- Master Command Hub with Live Diagnostics
- Global Omni-Search (Ctrl+K or /)
- Business info, logo, currency, timezone
- Document prefixes with live preview
- Module manager (enable/disable modules)
- Production stages configuration
- Custom fields manager
- Terminology / label customization
- Keyboard shortcut: Ctrl+S to save
- Floating unsaved changes pill

**Issues:**
- [ ] Settings center embeds full Roles, ActivityLog, DataBin, Profile, SEO, Workflows as sub-sections — this creates a dual-access problem (same workspace accessible from sidebar AND from settings center)
- [ ] SEO settings (`SeoDiscoverabilityWorkspace.tsx` — 68k lines) is a standalone workspace AND embedded in settings — confusing
- [ ] Module manager can disable modules but nav doesn't dynamically hide disabled modules instantly on all tabs
- [ ] No "reset to defaults" button for settings
- [ ] No settings import/export for backup

**Severity:** 🟡 Medium

---

### 🏪 `/storefront` (Public) — E-Commerce Storefront Pages

**What Exists (10 pages):**
- StorefrontHomePage — 10k lines
- StorefrontCatalogPage — 16k
- StorefrontProductDetailPage — 31k
- StorefrontCheckoutPage — 15k
- StorefrontOrderConfirmationPage — 5k
- StorefrontOrderTrackingPage — 11k
- StorefrontDynamicPage — 47k (CMS pages)
- StorefrontAccountPage — 25k

**Issues:**
- [ ] No cart persistence (localStorage? session? — needs audit)
- [ ] Guest checkout vs account checkout — unclear flow
- [ ] Product reviews / ratings — UI exists? (unverified)
- [ ] Payment gateway integration on checkout — is this live or placeholder?
- [ ] Mobile storefront responsiveness — not audited

**Severity:** 🟠 Medium-High — Commerce critical path needs verification

---

## PART 2 — REPORT RATIONALIZATION (84 → 76)

### Reports to MERGE (eliminating 8 redundants):

| Remove | Merge Into | Reason |
|---|---|---|
| `worker_piece_rate_summary` (hr, id:131) | `worker_production` (production, id:5) | Exact same concept, different module assignment |
| `salesman_profitability` (profit, id:119) | `salesman_profit_contribution` (salesmen, id:126) | Same KPI, different label |
| `daily_sales` (sales, id:31) | `channel_sales` (sales, id:30) | Add date filter to channel report instead |
| `b2c_sales` (sales, id:118) | `product_sales` (sales, id:115) | Add channel=online filter |
| `salesman_leaderboard` (salesmen, id:63) | `salesman_sales` (sales, id:117) | Add ranking sort to attribution report |
| `delivery_sla_history` (delivery, id:129) | `courier_performance` (delivery, id:72) | Add historical tab |
| `converted_leads` (crm, id:124) | `lead_summary` (crm, id:50) | Add conversion filter tab |
| `lost_leads_analysis` (crm, id:125) | `lead_status_distribution` (crm, id:123) | Add lost filter |

### Fix: ID Collision
`id:100` is assigned to BOTH `fixed_asset_register` (assets) AND `total_input_output` (production) → Renumber assets report to `id:200+`

---

## PART 3 — DESIGN SYSTEM AUDIT

### Current Design Patterns (from image + code):
- **Primary palette:** Indigo/Blue with gradient accents for KPI cards
- **Card style:** Rounded-lg, shadow-sm, white background with colored icon badges
- **Typography:** System font stack (likely Inter via Tailwind) 
- **Sidebar:** Dark sidebar (bg-gray-900 or similar) with white text
- **Status badges:** Green/amber/red pill badges
- **Tables:** Zebra-striped with sticky header
- **Modals:** Centered overlay with backdrop blur

### Design Issues:
1. **Inconsistent card shadows** — some cards use shadow-sm, some shadow-md
2. **Tab bars vary per module** — Sales uses category-grouped tabs, Finance uses category buttons + tab bar, QC uses simple tab bar
3. **Empty states** — Some have illustrated empty states, many just show "No records found" in plain text
4. **Form validation errors** — Inline red text, but some use toast-only validation without field highlighting
5. **Loading states** — Spinner in some, skeleton in others — inconsistent
6. **Color overuse in sidebar** — 7+ different badge colors in sidebar make it visually noisy
7. **Mobile layout** — AppShell has MobileBottomNav but workspace content is not mobile-optimized
8. **Dark mode** — Partially implemented (some `dark:` classes) but not system-wide

---

## PART 4 — IMPLEMENTATION PLAN

### 📋 PHASE OVERVIEW

```
Phase 0: Foundation (Design System + Critical Bugfixes)      ≈ 3 days
Phase 1: Reports Hub Redesign                                 ≈ 2 days
Phase 2: Dashboard Upgrade                                    ≈ 2 days
Phase 3: Core Module UX (Sales, POS, Purchasing, Inventory)  ≈ 4 days
Phase 4: Production + QC + Logistics workflow UX             ≈ 3 days
Phase 5: Finance + Assets split & upgrade                    ≈ 3 days
Phase 6: HR split & upgrade                                  ≈ 2 days
Phase 7: Settings + Roles + Activity + Bin                   ≈ 2 days
Phase 8: Storefront (ERP side + Public)                      ≈ 3 days
Phase 9: Global polish (mobile, accessibility, animations)   ≈ 2 days
```

---

### PHASE 0: FOUNDATION

#### 0.1 — Shared Design Token Upgrade
- Consolidate Tailwind classes into a `design-tokens.ts` file
- Define standard: card shadows, table row styles, empty state components, loading skeleton component
- Create `<WorkspaceHeader>` component: consistent page title + action button area
- Create `<SectionEmptyState>` component: illustrated empty state with CTA
- Create `<DataTable>` wrapper: sticky header, sortable columns, bulk select, pagination — reusable across all modules

#### 0.2 — Critical Bug Fixes
- Fix ID collision in `reportCatalogue.ts` (id:100 duplicate)
- Fix `onboarding startup modal` — track dismissal in localStorage or user preference API
- Fix POS hold-sale persistence (save to API endpoint `/pos/sessions/{id}/holds`)

#### 0.3 — Code Splitting
- Split `FinanceWorkspace.tsx` (4043 lines) into section files matching the pattern of other modules
- Split `HrWorkspace.tsx` (5140 lines) into section files

---

### PHASE 1: REPORTS HUB REDESIGN

#### New Architecture:
```tsx
<ReportsWorkspace>
  <ReportsHomeView>           // Default landing
    <PinnedReports />          // User-pinned reports (up to 6)
    <RecentlyViewed />         // Last 5 opened reports
    <DomainHubGrid />          // 7 domain hub cards
  </ReportsHomeView>
  
  <ReportHubView hub="...">  // When a hub is selected
    <HubHeader />
    <ReportCategoryTabs />    // Sub-categories within hub
    <ReportCardGrid />        // Cards with tier badge, description
  </ReportHubView>
  
  <ReportViewerPanel>        // Full-screen report viewer
    <ReportToolbar />         // Date range, filters, export, print, pin
    <ReportSummaryStrip />    // Key metrics at top
    <ReportDataTable />       // Paginated data
    <ReportChart />           // Optional chart for analytical reports
  </ReportViewerPanel>
</ReportsWorkspace>
```

#### Report Hub Groups (7 hubs from 13 categories):
1. **Operations Hub** → Production + QC + Inventory (20 reports)
2. **Commercial Hub** → Sales + POS + CRM (18 reports)  
3. **Procurement Hub** → Purchasing + Delivery (12 reports)
4. **Finance Hub** → Finance + Profitability (12 reports)
5. **People Hub** → HR + Salesmen Performance (8 reports)
6. **Assets Hub** → Fixed Assets (4 reports)
7. **Compliance Hub** → QC Audit + System Audit (2 reports)

---

### PHASE 2: DASHBOARD UPGRADE

#### Changes:
- Add mini sparkline behind each KPI card number (7-day trend line)
- Add interactive tooltip to revenue chart data points
- Upgrade Department Health cards to use real % from API response
- Add "Today's Alerts" strip between KPI cards and chart (low stock items, overdue invoices, QC fails)
- Add keyboard shortcut labels on quick action cards (e.g., "N" for New Order)
- Add empty state treatment in Operations Pulse with actionable CTAs
- Replace flat trend period buttons with pill segmented control (Today | 7D | 30D | 90D | Year | Custom)
- Custom date range modal: add preset chips (This Week, Last Month, Last Quarter, This Year)
- PWA install prompt as a dismissible card in the dashboard action palette

---

### PHASE 3: CORE MODULE UX

#### Sales:
- Remove "Dashboard" tab (redirect to `/dashboard?view=sales`)
- Add Kanban view option on Leads tab (alongside table)
- Add "Deliveries" tab removal or clear label it as "Linked Deliveries" (not a logistics hub)
- Bulk actions on orders (mark packed, assign delivery)
- Document shortcut labels visible on category tabs

#### POS:
- Barcode scanner input: auto-focus a hidden input that listens for barcode scanner keystrokes
- Persist held sales to server API
- Add mid-shift summary panel (accessible without closing shift)
- Show coupon field in checkout flow
- Add denomination breakdown to shift close cash modal
- Better "Exit POS" confirmation dialog (large buttons, count of unsaved held sales)

#### Purchasing:
- Add workflow diagram strip at top (Requisition → PO → GRN → Bill → Paid)
- "Low Stock Alert → Create PO" quick action linkage
- "Pay Supplier" button on Bills tab that opens Finance MoneyOut modal pre-filled
- GRN → QC inspection bridge (button: "Send to QC")

#### Inventory:
- Stock movement visualization (area chart: in vs out per week)
- Transfer ETA field and in-transit tracking

---

### PHASE 4: PRODUCTION + QC + LOGISTICS

#### Production:
- Batch timeline stepper (visual: Created → Running → QC → Done)
- "QC Failed" badge on batch with "Send to Rework" action button
- Gantt-lite view for plans (week view with bar per plan)
- Worker output: quick bulk entry grid (date × worker × qty)

#### QC:
- AQL calculator shown inline during inspection creation
- Defect checklist during inspection (not just pass/fail button)
- QC fail → auto-create Rework record
- QC trend chart on workspace header (7-day pass rate)
- Link back to originating production batch from inspection record

#### Logistics:
- COD reconciliation: show matched vs unmatched automatically
- Run sheet printing: add route optimization indicator
- Courier performance: SLA breach highlighting in red
- Delivery status map (if geo data available)

---

### PHASE 5: FINANCE + ASSETS

#### Finance (after splitting):
- `FinanceWorkspace.tsx` → `CoaSection.tsx`, `JournalSection.tsx`, `BankingSection.tsx`, `ExpensesSection.tsx`, `CostingSection.tsx`, `StatementsSection.tsx`, `DueCollectionSection.tsx`
- Bank reconciliation: statement import → match against journal entries with confidence score
- P&L statement: interactive chart version alongside print version
- Expense budgets: budget vs actual comparison per category

#### Assets:
- Auto-depreciation calculation on asset creation (fill useful life + method → system computes)
- QR/barcode print label for each asset
- Maintenance SLA escalation (overdue maintenance → flag in red)
- Asset assignment history tab

---

### PHASE 6: HR

#### Split:
- `HrWorkspace.tsx` → `EmployeesSection.tsx`, `AttendanceSection.tsx`, `LeavesSection.tsx`, `PayrollSection.tsx`, `PerformanceSection.tsx`, `DepartmentsSection.tsx`, `SalaryStructuresSection.tsx`, `AdvancesSection.tsx`

#### UX:
- Attendance calendar view (month grid with color-coded present/absent/leave)
- Payroll: calculation breakdown preview BEFORE confirm (gross → deductions → net)
- Leave approval: manager approval with email/notification trigger
- Kiosk mode for badge punch (full-screen attendance terminal)
- Salary advance: auto-deduction flag when creating next payroll

---

### PHASE 7: SETTINGS + ROLES + ACTIVITY + BIN

#### Settings:
- Settings center: remove embedded sub-workspaces (Roles, Activity, Bin, Profile, SEO, Workflows) — use dedicated sidebar navigation instead
- Add "Reset to Defaults" button per settings group
- Settings import/export JSON

#### Roles:
- Permission matrix: add hierarchy depth (Module > Feature > Action)
- "Duplicate Role" button
- Role detail panel showing assigned users count + list

#### Activity Log:
- Make diff view human-readable (field name: "Invoice Status" changed from "Draft" to "Paid")
- Add export to CSV/Excel
- Color-coded action type badges (Create=green, Update=blue, Delete=red)

#### Data Bin:
- 30-second countdown before permanent delete executes
- Add search by item name/code
- Show retention policy per domain

---

### PHASE 8: STOREFRONT

#### ERP-side Storefront Settings:
- Split page builder into chunked sections (180k file is too large)
- Drag-and-drop display order for featured products
- Social preview (OG) simulator in branding tab
- Bulk publish/unpublish products
- Coupon usage analytics tab

#### Public Storefront:
- Verify cart persistence mechanism
- Audit payment gateway integration completeness
- Add product review/rating UI if not present
- Mobile layout audit on all 8 pages

---

### PHASE 9: GLOBAL POLISH

- Consistent empty state components across all modules
- Consistent loading skeleton (replace spinners)
- Micro-animations: tab transitions, modal entrance, table row additions
- Mobile layout: verify AppShell bottom nav matches all workspace tabs
- Keyboard accessibility: all modals trap focus, all buttons have aria-labels
- Framer Motion: stagger animations on list renders
- PWA: ensure offline fallback page is branded

---

## PART 5 — QUESTIONS FOR YOU BEFORE IMPLEMENTATION

> [!IMPORTANT]
> I need answers to these before writing a single line of code:

### Q1: Scope — What's the priority order?
Which phases do you want tackled first?
- A) Reports Hub (most visible UX problem)
- B) Dashboard upgrade (most-visited page)
- C) Finance split (largest code risk)
- D) All phases in sequence as listed

### Q2: Design Theme — Dark mode?
The dashboard image shows a light theme. Should I:
- A) Keep light theme only
- B) Add full dark mode toggle
- C) System-auto (match OS preference)

### Q3: Reports — Confirm deduplication?
Are you OK removing the 8 duplicate reports listed? Or do any have separate backend endpoint purposes I should keep?

### Q4: POS barcode scanner — Hardware context?
What scanner type? (USB HID keyboard-emulation? Bluetooth? IP-based scanner?) This determines the input capture approach.

### Q5: Finance split — Module naming?
When I split `FinanceWorkspace.tsx`, should sub-sections be:
- A) Lazy-loaded on tab click (better performance)
- B) Always mounted but hidden (faster tab switch)

### Q6: Charts — Which chart library?
The current code uses Recharts (visible in dashboard trend chart). Should I:
- A) Stay with Recharts
- B) Switch to ApexCharts (more features)
- C) Add Chart.js as secondary

### Q7: Storefront public — Payment gateway?
Is the checkout payment integration:
- A) Already connected (bKash/SSLCommerz/Stripe)
- B) Placeholder only — needs to be built
- C) Out of scope for this upgrade

### Q8: HR kiosk mode — Separate route?
Should the badge punch terminal be:
- A) A modal inside HR workspace (current)
- B) A full-screen dedicated route `/hr/kiosk`
- C) A PWA installed separately on a tablet

### Q9: AI/Brain feature — Keep or expand?
The `SliceMartBrainModal.tsx` exists (42k lines). Is this:
- A) Already working and just needs UI polish
- B) A shell that needs actual AI integration
- C) Out of scope

### Q10: Timeline pressure?
- A) Ship incrementally (phase by phase, staging deploy after each)
- B) Complete all phases then deploy once

---

## PART 6 — FILES THAT NEED TO BE SPLIT (Critical Risk)

| File | Lines | Action |
|---|---|---|
| `HrWorkspace.tsx` | 5,140 | Split into 8 section files |
| `FinanceWorkspace.tsx` | 4,043 | Split into 7 section files |
| `StorefrontPageBuilderWorkspace.tsx` | ~4,500 est | Split into builder sections |
| `StorefrontSettingsWorkspace.tsx` | 2,418 | Split branding/header/footer/products |
| `POSShell.tsx` | 2,411 | Extract checkout, product, session panels |
| `AssetsWorkspace.tsx` | 3,065 | Extract depreciation, maintenance panels |
| `ReportsWorkspace.tsx` | 1,800 | Refactor into hub navigator pattern |

---

*Audit completed — awaiting your answers to Part 5 questions before implementation begins.*
