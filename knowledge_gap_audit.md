# CODEBASE KNOWLEDGE GAP AUDIT
### Production ERP + Storefront — Deep Verification Pass

> Conducted per Missing_Analysis.md methodology  
> Audit Date: 2026-09-29 | Status: GAPS VERIFIED

---

## 1. DOCUMENTATION COVERAGE ASSESSMENT

| Area | Coverage | Key Missing |
|---|---|---|
| Architecture | HIGH | Multi-shell routing, domain split logic |
| Backend | MEDIUM | 4 scheduled cron jobs not in audit, middleware stack |
| Frontend | MEDIUM | 3-layer CSS token system, barcode engine, capability store |
| Database | LOW | Models exist, relationships mapped, but migration order unknown |
| API | MEDIUM | 1433-line route file structure, permission naming convention |
| Business Logic | LOW | Subscription lifecycle, grace period rules, permission inheritance |
| UI/UX | MEDIUM | Dark mode fully implemented (not "partial" as previously stated) |
| Security | LOW | Tenant isolation middleware chain, JWT + refresh token lifecycle |
| Integrations | UNKNOWN | Only 1 queue job: `DeliverWebhookPayloadJob` |
| Deployment | LOW | No deploy documentation found |
| Testing | LOW | 1 test file found (`ProductionHardeningTest.php`) |
| Operations | MEDIUM | 4 cron jobs confirmed, no monitoring/health check docs |
| AI Navigation | MEDIUM | File → feature map partially done in initial audit |

---

## 2. VERIFIED ARCHITECTURAL FACTS (correcting initial audit)

### 2.1 Dark Mode — PREVIOUSLY MISREPORTED [CONFLICT FIXED]

**Initial audit stated:** "Dark mode: partially implemented (some `dark:` classes)"

**Verification result:** `[CONFLICT]` — This is WRONG. The dark mode system is **fully architected** and production-ready:

- `tokens.primitive.css` — Raw color primitives (navy, slate, blue, amber, green, red, cyan)
- `tokens.semantic.css` — Semantic light-mode mappings (`--color-bg`, `--color-surface`, etc.)
- `tokens.semantic.dark.css` — Full dark-mode re-mapping under `html.dark, :root.dark, [data-theme='dark']`
- **Binding rule enforced:** `dark:` Tailwind variants are **FORBIDDEN in component files** (§3.2 of UI_SYSTEM.md). Components only read semantic tokens. This means dark mode is correct in both modes automatically.
- **Theme toggle:** `lib/theme/themeTransition.ts` implements a **circular ripple View Transitions API animation** from the exact click coordinates. Falls back to instant toggle if reduced motion is preferred.
- **Persistence:** Stored in `localStorage` as both `'ui.theme'` AND `'theme'` (two keys — legacy compatibility).
- **No-FOUC:** An inline script in `index.html` applies the class before first paint.

**Gap for implementation:** System-auto (OS preference) is NOT yet wired up. The user requested `light default + system-auto with toggler`. Currently only manual toggle exists. Must add `prefers-color-scheme: dark` media query listener on boot.

---

### 2.2 Permission System — Hidden Business Rules [CRITICAL DISCOVERY]

From `authStore.ts` `hasPermission()`:

```typescript
// Permission check priority:
// 1. user.is_platform_admin → always true (bypass ALL permissions)
// 2. permissions.has('*') → wildcard grant (super admin role)
// 3. permissions.has(exactPermission) → direct match
// 4. permissions.has(modulePrefix + '.*') → module-level wildcard
```

**Hidden rule:** Permission strings follow a dot-notation pattern `{module}.{entity}.{action}`:
- e.g., `catalog.product.view`, `inventory.stock.update`, `sales.invoice.delete`
- Module-level wildcard `catalog.*` grants all catalog permissions
- `*` grants everything
- Platform admins bypass all permission checks entirely

This is only visible by reading `authStore.ts` + `api_tenant.php` route middleware. Not documented anywhere in the knowledge base.

---

### 2.3 Authentication Token Lifecycle [CRITICAL DISCOVERY]

From `authStore.ts` bootstrap():

```
Token lifecycle:
1. On page load: read access_token from memory (not localStorage)
2. If no access_token: attempt refreshOnce() (silent refresh via /auth/refresh)
3. If refresh succeeds: proceed with /auth/me to validate and sync user state
4. On 401/402/403 or TENANT_INACTIVE code: clear all localStorage + unauthenticated
5. On network blip (other errors): PRESERVE existing cached user (stay authenticated)
```

**Hidden rule:** A network failure does NOT log the user out. Only explicit 401/402/403 or `TENANT_INACTIVE` code triggers logout. This is intentional to prevent factory-floor workers from being logged out during brief network drops.

**Hidden error code:** `TENANT_INACTIVE` → maps to "Your organization account is suspended." The code `TENANT_INACTIVE` must match the backend's response format exactly.

---

### 2.4 Tenant Capability Manifest — The Module Gate [CRITICAL]

From `tenantCapabilityStore.ts`:

```
Bootstrap: fetches /tenant/manifest (cached in localStorage as 'tenant_capability_manifest')
Contains:
  - modules: { [key]: { enabled: bool, plan_allowed: bool } }
  - feature_flags: { [key]: bool }
  - terminology: { [key]: string } ← custom label overrides
  - production_stages: ProductionStageConfig[]
  - custom_fields: { [module.entity]: CustomFieldDefinitionRecord[] }
  - nav_order: { sections?: string[], items?: Record<string, string[]> }
```

**Hidden rules:**
- If `manifest` is null (bootstrapping): `isModuleEnabled()` returns `true` (optimistic)
- If module key is UNKNOWN in manifest: returns `true` (accessible by default)
- Module must have BOTH `enabled === true` AND `plan_allowed === true` to be accessible
- `getTerm()` provides per-tenant label overrides (e.g., "Batch" might be called "Production Run")
- `production_stages` fallback: 4 hardcoded stages if not configured
- Nav order can be customized per tenant and is persisted in localStorage manifest

**Consequence for implementation:** When building any new module feature, ALWAYS gate it with `isModuleEnabled('module_key')`. When displaying labels, ALWAYS use `getTerm()` not hardcoded strings.

---

### 2.5 Subscription Lifecycle State Machine [HIGH]

From `Tenant.php` + `ProcessSubscriptionLifecycleCommand.php`:

```
Tenant status values: 'trial' | 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'archived'

Status transitions (cron: daily at 00:05):
  trial/trialing → past_due (trial_ends_at passed)
  past_due → suspended (trial + 7 grace days passed)
  active → past_due (subscription ends_at passed)
  past_due → suspended (subscription grace_period_ends_at passed, default 7 days)

isActive() returns TRUE for: 'active', 'trial', 'trialing' (AND not suspended)
isSuspended() returns TRUE for: 'suspended', 'cancelled', 'archived' OR grace expired

TENANT_INACTIVE error code triggers when tenant is suspended → frontend shows suspension message
```

**Cache keys flushed on auto-suspend:** `t{id}:tenant:profile` and `tenant:{id}:profile` — two different cache key patterns (suggests cache key inconsistency risk).

---

### 2.6 Barcode Engine — Output Only, NOT Scanner Input [HIGH]

**Initial audit implied:** Barcode scanner integration exists but scanner input focus is missing.

**Verified reality:** `lib/barcode/engine.ts` is a **barcode OUTPUT generator** (uses `bwip-js` to render SVG barcodes for printing labels). It handles EAN-13, EAN-8, UPC-A, QR, Code128, Code39 with graceful fallbacks.

**Scanner INPUT is truly missing:** No scanner input listener exists anywhere in the codebase. For USB HID keyboard-emulation scanners, implementation needs a hidden input that auto-focuses and captures rapid keystrokes terminated by Enter key.

---

### 2.7 Scheduled Cron Jobs [HIGH — Previously Undocumented]

From `routes/console.php`:
```
Schedule::command('idempotency:purge-expired')     → hourly, no-overlap
Schedule::command('tenants:sync-usage')            → hourly, no-overlap  
Schedule::command('subscriptions:process-lifecycle')→ daily at 00:05, no-overlap
Schedule::command('backup:database')               → daily at 02:00
```

**Artisan Commands found:**
- `DatabaseBackupCommand.php` — database backup (2064 bytes)
- `ProcessSubscriptionLifecycleCommand.php` — subscription lifecycle (12220 bytes — 336 lines)
- `PurgeExpiredIdempotencyKeys.php` — idempotency key cleanup (902 bytes)
- `SyncTenantUsageCountersCommand.php` — usage counter sync (5946 bytes)

**Queue Jobs found:**
- `DeliverWebhookPayloadJob.php` — webhook delivery (3779 bytes, single job)

**Critical operational knowledge:** A Laravel scheduler must be running (`php artisan schedule:work` or cron tab with `schedule:run` every minute). Without it, subscriptions never auto-suspend. This is not documented anywhere in the repo.

---

### 2.8 API Route Architecture [HIGH]

From `routes/` directory:
```
api_platform.php  (11282 bytes) — Platform admin routes
api_public.php    (5320 bytes)  — Public unauthenticated routes
api_storefront.php(3839 bytes)  — Public storefront API
api_tenant.php    (129175 bytes, 1433 lines) — ALL tenant ERP routes
web.php           (4064 bytes)  — SPA shell + storefront rendering
```

**Middleware pipeline (verified from route file header):**
```
EnsureHttps → CorrelationId → auth:api → ResolveTenant 
→ EnsureTenantActive → [permission:{string}] → [RateLimit] → [Idempotency] → Handler
```

**Permission middleware:** Per-route, using `permission:{module}.{entity}.{action}` format  
**Route binding:** All entities bound via UUID (e.g., `{product:uuid}`) — integer IDs never exposed in URLs  
**Quota middleware:** `tenant.quota:products` — product creation is quota-gated  
**Versioning:** All routes under `/api/v1/` prefix

---

### 2.9 Frontend Observability System [MEDIUM]

From `lib/observability/logger.ts` (319 lines, 13kb):

- **Ring buffer:** In-memory + localStorage mirror for crash recovery
- **Capacity-capped:** Hard limit on log entries to prevent memory leak from render loops
- **Context-injected:** User ID, tenant ID, route, correlation ID pushed into entries
- **No network calls:** Deliberately local-only (remote shipping tagged as "Phase 10")
- **Boundary levels:** 4 error boundary levels tracked per §8.4 of UI_SYSTEM.md
- **Sources:** `boundary | api | app | boot`

**AI navigation:** Log Inspector is accessible via the UI (not documented where — search for `LogInspector` component).

---

### 2.10 CSS Design System — 3-Layer Architecture [MEDIUM]

```
Layer 1: tokens.primitive.css    → Raw values (--navy-800, --green-500)
                                   RULE: Components NEVER read from here
Layer 2: tokens.semantic.css     → Light-mode semantic names (--color-bg, --color-primary)
Layer 2: tokens.semantic.dark.css → Dark-mode re-mapping (same names, dark values)
Layer 3: tokens.component.css    → Component-specific tokens (--btn-bg, --input-border)
         tokens.motion.css       → Animation tokens

Binding rule (enforced by lint): No component file may import/use Layer 1 tokens.
Tailwind dark: variants FORBIDDEN in component files.
Base type size: 14px (--text-base: 0.875rem) — intentionally smaller for dense back-office.
Input exception: 16px at mobile breakpoints to prevent iOS zoom-on-focus.
Z-index scale: base(0), sticky(100), dropdown(200), overlay(300), modal(400), toast(500), tooltip(600), boot(700)
Sidebar width: 256px / 64px collapsed
Header height: 56px
```

---

### 2.11 Branch System [MEDIUM — Previously Unknown]

From `authStore.ts` and `AppHeader.tsx`:

- Users can belong to multiple **branches** within a tenant
- `switchBranch(branchId)` → POST `/auth/switch-branch` → returns updated branch
- Active branch stored in `localStorage.auth_active_branch`
- Branch shown in AppHeader dropdown

**Unknown:** Whether branches are multi-location warehouses, sales regions, or organizational units. The `Branch.php` model (963 bytes) is minimal — likely just `id, tenant_id, name`.

---

### 2.12 Brain / AI Feature [MEDIUM — Partially Documented]

From `AppHeader.tsx`:
- `SliceMartBrainModal` imported from `./SliceMartBrainModal` (42k lines)
- Keyboard shortcut: **Ctrl+Space** or **Ctrl+J** to open
- The Brain icon (`Brain` from lucide-react) is visible in the header

**User confirmed:** Already working, needs more behaviors + actual Agentic AI integration for future-proofing.

**Gaps:**
- No streaming response support documented
- No function-calling / tool-use integration
- No conversation history persistence
- No agent-to-ERP action bridges (e.g., "Create an invoice for customer X")

---

## 3. KNOWLEDGE GAP REGISTER

### CRITICAL Gaps

**GAP-001**
- Category: Security / Auth
- Missing: System-auto dark mode (OS preference) is not wired — user requested it
- Why it matters: Without `prefers-color-scheme` listener, theme reverts to manual only
- Required: Add media query listener in `themeTransition.ts` boot path
- Status: OPEN

**GAP-002**
- Category: Operations
- Missing: Laravel Scheduler must run for subscription lifecycle to work
- Why it matters: Without `php artisan schedule:work`, tenants never auto-suspend
- Required: Document deploy requirement; add health check for scheduler status
- Status: OPEN

**GAP-003**
- Category: Business Logic
- Missing: `TENANT_INACTIVE` error code contract between backend and frontend
- Why it matters: If backend changes this code, frontend silently shows wrong error message
- Required: Document the exact error code contract
- Status: OPEN [VERIFIED — code is `TENANT_INACTIVE`]

**GAP-004**
- Category: Data
- Missing: Cache key inconsistency — `t{id}:tenant:profile` vs `tenant:{id}:profile`
- Why it matters: Suspension may not flush all caches, leaving stale tenant data
- Required: Audit cache key usage and standardize
- Status: OPEN

---

### HIGH Priority Gaps

**GAP-005** — POS barcode scanner: No input listener exists (verified — barcode library is OUTPUT only)
**GAP-006** — `api_tenant.php` is 1433 lines / 129kb — entire API in one file, not split by module
**GAP-007** — No tests except `ProductionHardeningTest.php` — entire frontend has no test files
**GAP-008** — Report ID collision (id:100) is a data integrity bug needing migration fix
**GAP-009** — `FinanceWorkspace.tsx` + `HrWorkspace.tsx` file size — performance risk
**GAP-010** — `StorefrontPageBuilderWorkspace.tsx` ~180k bytes — needs splitting
**GAP-011** — No deploy documentation — how to ship to production is unknown
**GAP-012** — No environment variable documentation (`.env` keys not catalogued)
**GAP-013** — `tenant.quota:products` middleware — quota limits not visible in UI
**GAP-014** — Branch system purpose is undocumented (are branches locations/regions?)
**GAP-015** — Queue worker: `DeliverWebhookPayloadJob` — no documentation on what triggers it
**GAP-016** — Webhook system exists (WebhookEndpoint, WebhookDelivery models) — not surfaced in settings UI

---

### MEDIUM Priority Gaps

**GAP-017** — POS held sales in-state only (no server persistence)
**GAP-018** — Onboarding modal fires on every login if data is empty (no dismissal tracking)
**GAP-019** — `tenant_capability_manifest` localStorage key — stale manifest on plan upgrade
**GAP-020** — `nav_order` customization in manifest — no UI for drag-reorder of sidebar sections
**GAP-021** — `terminology` in manifest — custom labels not used everywhere (inconsistent)
**GAP-022** — `custom_fields` in manifest — which entities actually render custom fields?
**GAP-023** — Bank reconciliation import exists but statement-matching UI missing
**GAP-024** — QC fail → Rework not auto-triggered
**GAP-025** — No Gantt chart for production plans
**GAP-026** — Asset auto-depreciation not implemented (manual only)
**GAP-027** — Activity log diff modal shows raw JSON (not user-friendly)
**GAP-028** — Brain modal: no streaming, no tool-use, no history persistence
**GAP-029** — Currency stored as `currency_code` in fillable but doc says `currency` — naming drift
**GAP-030** — `SyncTenantUsageCountersCommand` — usage counters shown to users?

---

### LOW Priority Gaps

**GAP-031** — `backup:database` command (2064 bytes) — backup goes where? Local disk? S3?

---

## 4. NEGATIVE KNOWLEDGE (What MUST NOT be done)

```
DO NOT read --navy-* or --slate-* tokens directly in components (use --color-* semantic tokens)
DO NOT use Tailwind dark: variants in component files (§3.2 — semantic tokens handle this)
DO NOT expose integer IDs in URLs — all routes use UUID binding
DO NOT bypass tenant.resolve + tenant.active middleware for any ERP route
DO NOT add new dark mode styles by duplicating in each component — add to tokens.semantic.dark.css
DO NOT call isModuleEnabled() with a hardcoded string that differs from backend module key
DO NOT modify tenant status directly — always go through service layer (cron handles lifecycle)
DO NOT import from tokens.primitive.css in any component file
DO NOT remove the 'auth_user' + 'auth_tenant' localStorage items without also removing 'auth_permissions', 'auth_branches', 'auth_active_branch' (logout must clear ALL 5 keys)
```

---

## 5. CROSS-MODULE DEPENDENCY MAP

```
[Auth] → bootstraps → [TenantCapabilityStore]
[TenantCapabilityStore] → gates → [Every Module's sidebar entry]
[TenantCapabilityStore] → provides → [Terminology for all labels]
[TenantCapabilityStore] → provides → [Production stages for QC + Production]
[TenantCapabilityStore] → provides → [Custom fields for Catalogue/HR/etc.]

[POS] → reads → [Catalogue:Products] (product search)
[POS] → reads → [Sales:Pricelists] (pricing)
[POS] → writes → [Sales:Invoices] (creates invoice on checkout)
[POS] → writes → [Inventory:StockLedger] (auto-deducts on sale) — VERIFY

[Production:Batch] → consumes → [Inventory:Stock] (raw materials)
[Production:Batch] → produces → [Inventory:Stock] (finished goods)
[Production:Batch] → triggers → [QC:Inspection] (manually, no auto-trigger yet)

[QC:Inspection FAIL] → should create → [QC:ReworkOrder] (gap — not auto-wired)
[QC:Inspection FAIL] → should write → [QC:WastageRecord] (gap)

[Purchasing:Bill] → should trigger → [Finance:Payable] (integration gap)
[Sales:Invoice] → should write → [Finance:Receivable] (verify integration)
[HR:Payroll] → should write → [Finance:Expense] (verify integration)

[Tenant Subscription Expiry] → (cron daily 00:05) → [Tenant:status=suspended]
[Tenant:suspended] → (on API request) → [TENANT_INACTIVE error] → [Auth:logout]

[Webhook trigger] → queues → [DeliverWebhookPayloadJob] → sends to [WebhookEndpoint:url]
```

---

## 6. CONFIRMED DECISIONS (User Answers Applied)

| # | Decision | Answer | Implementation Note |
|---|---|---|---|
| 1 | Phase order | Sequential as listed | Phase 0→9 in sequence |
| 2 | Dark mode | Light default + system-auto + toggler | Wire `prefers-color-scheme` on boot; persist override to localStorage |
| 3 | Report deduplication | Remove 8 duplicates | 84 → 76 reports |
| 4 | POS scanner | USB HID + Bluetooth | Both emit keyboard events — single hidden input listener covers both |
| 5 | Finance/HR split | Lazy-load on tab click | React.lazy() + Suspense per section file |
| 6 | Chart library | ApexCharts primary + Chart.js secondary | Install both: `react-apexcharts apexcharts chart.js react-chartjs-2` |
| 7 | Payment gateway | Placeholder only | Keep checkout UI, mark gateway as TODO |
| 8 | HR kiosk | Remove it | Delete kiosk modal from HR workspace |
| 9 | Brain/AI | Working, needs agentic integration | Add streaming + tool-use bridge + conversation history |
| 10 | Shipping | Incremental per phase | Deploy after each phase to staging |

---

## 7. AI NAVIGATION MAPS

### Feature → File Map

| Feature | Primary File |
|---|---|
| Login / Auth flow | `lib/auth/authStore.ts` |
| Permission check | `authStore.hasPermission()` |
| Module visibility | `lib/capabilities/tenantCapabilityStore.ts` |
| Sidebar navigation | `components/layout/Sidebar.tsx` |
| Global search (Ctrl+K) | `components/layout/AppHeader.tsx` |
| Brain modal (Ctrl+J) | `components/layout/SliceMartBrainModal.tsx` |
| Dark mode toggle | `lib/theme/themeTransition.ts` |
| Barcode rendering (print) | `lib/barcode/engine.ts` |
| All tenant API routes | `backend/routes/api_tenant.php` |
| Platform admin routes | `backend/routes/api_platform.php` |
| Cron jobs | `backend/routes/console.php` |
| Subscription lifecycle | `backend/app/Console/Commands/ProcessSubscriptionLifecycleCommand.php` |
| Report definitions (84) | `frontend/src/modules/reports/reportCatalogue.ts` |
| Design tokens (layer 1) | `frontend/src/styles/tokens.primitive.css` |
| Design tokens (light) | `frontend/src/styles/tokens.semantic.css` |
| Design tokens (dark) | `frontend/src/styles/tokens.semantic.dark.css` |
| Motion tokens | `frontend/src/styles/tokens.motion.css` |
| Print styles | `frontend/src/styles/print.css` |
| Frontend error logging | `lib/observability/logger.ts` |

### Permission String Format

```
Pattern: {module}.{entity}.{action}
Actions: view | create | update | delete

Examples:
  catalog.product.view
  catalog.product.create
  inventory.stock.update
  sales.invoice.delete
  finance.journal.create
  hr.payroll.create
  qc.inspection.view
  pos.session.open

Module-wildcard: catalog.*  (grants all catalog permissions)
Super-wildcard:  *          (grants everything)
Platform admin:  is_platform_admin flag bypasses all permission checks
```

### localStorage Keys

```
auth_user              → User object (JSON)
auth_tenant            → TenantInfo object (JSON)
auth_permissions       → string[] of permission strings
auth_branches          → BranchInfo[] array
auth_active_branch     → BranchInfo | null
tenant_capability_manifest → TenantCapabilityManifest (entire module/feature manifest)
ui.theme               → 'light' | 'dark' (canonical theme key)
theme                  → 'light' | 'dark' (legacy compatibility duplicate)
```

### Cron Schedule

```
Hourly:     idempotency:purge-expired    (PurgeExpiredIdempotencyKeys)
Hourly:     tenants:sync-usage           (SyncTenantUsageCountersCommand)
Daily 00:05 subscriptions:process-lifecycle  (ProcessSubscriptionLifecycleCommand)
Daily 02:00 backup:database              (DatabaseBackupCommand)
```

---

## 8. FINAL AI-READINESS VERDICT

**READY** for implementation with the following constraints:

> ✅ Architecture understood  
> ✅ Dark mode system fully mapped (not partial as previously thought)  
> ✅ Permission system rules documented  
> ✅ Cross-module dependencies mapped  
> ✅ Cron jobs and operational requirements documented  
> ⚠️ GAP-002 (scheduler requirement) must be in deploy documentation  
> ⚠️ GAP-004 (cache key inconsistency) needs backend team attention  
> ⚠️ GAP-005 (POS scanner) implementation now clearly scoped (HID keyboard emulation listener)

---

*Knowledge base is substantially more complete than the initial audit. Institutional memory preserved.*
