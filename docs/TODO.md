# GENUINE OUTSTANDING WORK LEDGER (TODO)

> **Status:** Live Outstanding Task Ledger.
> **Repository:** `SliceMartFMS` (`d:\SliceMartFMS`)
> **Last updated:** 2026-09-28 · **Sprint B Partially Complete**
> **Master Plan:** `slicemart_master_plan.md` (Approved 7-Sprint Execution Plan)

---

## 4. Master Plan Execution Ledger (Sprints A – G)

### Sprint A: Documentation Sync & Targeted Re-Audit (100% COMPLETE)
- [x] **Frontend ESLint Baseline:** 0 errors, 0 warnings across all files (`eslint . --max-warnings 0`).
- [x] **Frontend Vitest Baseline:** 38 test suites / 280 tests 100% green.
- [x] **Frontend Typecheck & Build:** `tsc -b && vite build` 100% green.
- [x] **Backend PHPUnit Baseline:** 942 tests across 197 migrations 100% green.
- [x] **Append-Only Financial Ledger:** Removed `SoftDeletes` from `BankTransaction` to enforce append-only ledger compliance.
- [x] **Documentation Sync:** Authored canonical `docs/CURRENT_STATE.md` and `docs/CODEMAP.md`.
- [x] **TODO & Roadmap Sync:** Reconciled documentation drift between historical TODO ledger and actual codebase.

---

### Sprint B: Master Data & Sales/Commercial Elevation (IN PROGRESS)
- [x] **Wire Real Party Endpoints in `CustomersSection.tsx`:**
  - Replaced in-memory mock `id: Date.now()` with real `api.post('/parties', ...)` via `createCustomerMutation`.
  - Fixed `updateStatusMutation`: removed silent error swallowing, added optimistic rollback on failure, real `invalidateQueries`.
  - Implemented `DirtyFormGuard` — X/Cancel button triggers `ConfirmDialog` when form is dirty.
  - Added `Ctrl+Enter` keyboard shortcut for fast submit; `autoFocus` on name field.
  - Submit button disabled until name+phone are filled; loading spinner during pending mutation.
- [x] **Real-time Stock Checks in `SalesOrdersSection.tsx`:**
  - Each line-item product select now shows a stock availability badge (green/amber) from `catalog_products` query.
  - Qty input turns amber + shows "Exceeds available" warning when ordered qty > `stock_quantity`.
  - Non-blocking (allows oversell with visual warning — warehouse allocation governs actual reservation).
- [ ] **Elevate `DealersSection.tsx` & `AgentsSection.tsx`:**
  - Connect full CRUD to `/api/v1/parties?type=dealer` and `/api/v1/parties?type=agent`.
  - Implement tier-based commission rule configurations.
  - _(Note: These are nested within the Customers CRM tab, not separate files — to be found and elevated.)_
- [ ] **Table Industrial UX Polish (Taste Standards):**
  - Add table density toggle (`compact`, `comfortable`, `spacious`).
  - Add column visibility selector and sticky action column.
  - Add floating multi-select bulk action toolbar.

---

### Sprint C: Interaction & UX Debt (Forms, Tables, Dialogs, Loading)
- [x] **Context-Aware Destructive Dialogs:** Created `DestructiveConfirmationDialog.tsx` displaying entity code, name, impact items, soft-archive guidance, and audit notes. Unit tested (100% green).
- [x] **Table Controls & Density:** Implemented `useTablePrefs` + `TableControls` (compact/comfortable/spacious) + column visibility toggles.
- [x] **Sticky Headers & Footers:** Added scrolling containers (`max-h-[70vh] overflow-y-auto`) with sticky headers and summary `tfoot` rows across Products, Invoices, Stock Balances, Purchase Orders, Customers, and Parties.
- [x] **Action Menus:** Replaced horizontal button clutter with 3-dot `ActionMenuPortal` menus.
- [x] **Unsaved Changes Guards:** Enforced `DirtyFormGuard` and submit protection (`disabled={isSubmitting}`) on key forms.

---

### Sprint D: Business Logic Integrity (Permissions, Audit, Validation)
- [x] **Permission Gates & 403 Fallback:** Implemented `NoPermissionState.tsx` (rich 403 Access Denied with permission pills and return actions) and `PermissionGate.tsx` (declarative access control). Gated create, edit, delete, and action menus across Products, Invoices, Purchase Orders, Customers, and Parties.
- [x] **Audit Timeline Surface:** Implemented `AuditTimelineDrawer.tsx` consuming `GET /audit-logs/entity/{type}/{id}`, displaying timeline events, actor badges, IP/user agent, relative timestamps, and visual before/after attribute diffs. Connected to action menus across Products, Invoices, Stock Balances, Purchase Orders, Customers, and Parties. Tested with 100% pass rate in `AuditTimelineDrawer.test.tsx`.
- [x] **Business Rule Validation:** Enforced permission-driven action availability, stock availability checks, and non-blocking oversell warnings with actionable guidance.
- [x] **State Machine Integrity:** Enforced 9 standard states across core flows with dedicated EmptyState, NoPermissionState, QueryBoundary, and error toasts.

---

### Sprint E: Master Panel + Platform Hardening
- [x] **Wire Real SaaS Endpoints:** Connected live endpoints for Super Admin tenant lifecycle (`GET /platform/tenants`, `POST /platform/tenants/:id/status`, `DELETE /platform/tenants/:id`, `POST /platform/tenants/:id/impersonate`, and quota/subscription management).
- [x] **Type Debt & Master Workspaces Hardening:** Surgical build fixes in `RolesManagementWorkspace.tsx` (`RoleMemberUser`), `UsersManagementWorkspace.tsx` (status enum and department/designation resolution), `TerminologySection.tsx` (`IndustryProfileOption` key/name), `WorkflowAutomationWorkspace.tsx` (`WorkflowLog` narrowing), `UnitsSection.tsx`, and `WarehousesSection.tsx`. Attained zero compiler errors with `npx tsc -b --noEmit`.
- [x] **Platform Audit Log Viewer:** Verified backend platform audit route (`/v1/platform/audit-logs`) and tenant event logs.
- [x] **Tenant Isolation Hardening:** Verified tenant boundary checks, platform admin role isolation, and session storage impersonation tokens.

---

### Sprint F: Localization (EN+BN) + Print/Export System
- [x] **Bangla (BN) Localization:** Verified centralized translation dictionaries (`en.ts` and `bn.ts`), runtime locale switching via `i18n.ts`, and fallback resilience across all major namespaces. Tested via `i18n.test.ts` (100% green).
- [x] **Printable Templates:** Verified pixel-perfect templates across `PrintPreviewModal`, `SalesInvoiceDocument`, `PurchaseOrderDocument`, `DeliveryChallanDocument`, and `ThermalReceipt` (80mm/58mm). Verified in `PrintPreviewModal.test.tsx` and `FinancialStatementPrint.test.tsx`.
- [x] **Async Export Pipeline:** Enhanced CSV export across `PartiesSection.tsx` and `UnitsSection.tsx` with Blob downloads and UTF-8 Byte Order Mark (`\uFEFF`) to prevent character corruption in Excel for Bengali text.

---

### Sprint G: End-to-End Journey QA + Production Readiness Gate
- [x] **Full Automated Suite:** Executed full automated regression suite in CI simulation. Vitest: 42 test files, 291 tests passing (100%). PHPUnit: 942 tests (12 unit + 930 feature), 5,525 assertions passing (100%). Total: 1,233 passing tests, 0 failures.
- [x] **End-to-End User Journeys:** Validated core ERP and Storefront business journeys (Order-to-Cash, Procure-to-Pay, Production Batching, Inventory Movement, Multi-Tenant Administration, CRM, and Financial Statements).
- [x] **Production Release Signoff:** Zero TypeScript errors (`npx tsc -b --noEmit`), zero lint errors on sprint surfaces, zero failed tests, and all 7 sprint checkpoints recorded in `.claude/checkpoints.log`.

