# SYSTEM CHANGELOG & PROJECT HISTORY

> **Status:** Canonical Historical Ledger of Project Modifications.
> **Repository:** `SliceMartFMS` (`d:\SliceMartFMS`)
> **Last updated:** 2026-08-27

---

## [Unreleased] - Operations AI Brain & Custom Model Backend Upgrade (2026-10-17)

### Added
- **Tenant-Scoped Custom LLM Configuration**:
  - `tenant_ai_settings` table and `TenantAISetting` Eloquent model with automatic encryption at rest (`Crypt::encryptString`) and masked exposure (`sk-****`).
  - `TenantAISettingsController` providing endpoints for retrieving, saving, testing live latency, and resetting LLM backend configurations.
  - Settings UI tab (`ai_model`) in `SettingsCenterWorkspace` and `AiModelSettingsSection` with presets for Anthropic Direct, AgentRouter / OpenRouter, and DeepSeek Gateway.
- **Unified Multi-Tenant LLM Client**:
  - `UnifiedLLMClient` dynamically resolves tenant-specific API keys, custom base URLs, and model IDs with fallback to platform `.env`.
- **System-Wide Agentic Reasoning & Tools**:
  - `BrainOrchestrator` agentic reasoning loop with persistent conversation history via `AgentConversation` (`context_type: brain`) and `AgentMessage`.
  - `BrainToolRegistry` incorporating 20 system-wide ERP tools spanning Finance, Sales, Inventory, Production, HR, QC, Purchasing, and Data Recovery.
  - Real-time SSE streaming and deterministic offline fallback preserved.
- **Upgraded Operations AI Brain Drawer UI**:
  - `SliceMartBrainModal` upgraded with live model indicator badge, quick financial advisor prompt chips, Tier 2 supervised action confirmation dialog, and 6 interactive data cards (`CashPositionCard`, `PLSummaryCard`, `CashFlowRiskCard`, `OverdueInvoicesCard`, `FinancingMatchCard`, `InventoryValueCard`).
- **Comprehensive Automated Test Coverage**:
  - Backend feature tests: `TenantAISettingsTest`, `BrainOrchestratorTest`, `UnifiedLLMClientTest` (10/10 passed).
  - Frontend Vitest tests: `aiModelApi.test.ts`, `copilotApi.test.ts`, `SliceMartBrainModal.test.tsx` (15/15 passed).

---

## [Unreleased] - Phase 2 Master Data & Catalogue Expansion

### Added
- Created complete master data models (`Unit`, `UnitConversion`, `Category`, `Brand`, `TaxProfile`, `ReasonCode`, `Product`, `ProductVariant`, `ProductImage`, `BillOfMaterial`, `BillOfMaterialItem`, `Warehouse`, `WarehouseLocation`, `Party`, `PartyAddress`, `PartyContact`, `PriceList`, `PriceListItem`, `DiscountRule`) with `BelongsToTenant` and composite relationships.
- Implemented Catalogue module controllers and actions:
  - `UnitController` (`index`, `options`, `store`, `show`, `update`, `destroy`).
  - `CategoryController` (`index`, `options`, `store`, `show`, `update`, `destroy`).
  - `BrandController` (`index`, `options`, `store`, `show`, `update`, `destroy`).
  - `ProductController` (`index`, `options`, `store`, `show`, `update`, `destroy`).
  - `BillOfMaterialController` (`index`, `store`, `show`, `update`, `destroy`).
  - `WarehouseController` and `WarehouseLocationController` (`index`, `options`, `store`, `show`, `update`, `destroy`).
  - `PartyController` (`index`, `options`, `store`, `show`, `update`, `destroy`) with nested address and contact management and relational deletion guards.
- Implemented and wired Pricing module controllers and actions:
  - `PriceListController` (`index`, `options`, `store`, `show`, `update`, `destroy`).
  - `DiscountRuleController` (`index`, `store`, `show`, `update`, `destroy`).
  - `TaxProfileController` (`index`, `options`, `store`, `show`, `update`, `destroy`).
- Implemented complete Authenticated Frontend Application Shell & Catalogue Management Workspace:
  - Full authentication runtime & Zustand store with in-memory JWT handling, dual-token rotation, and proactive session recovery (`authStore.ts`).
  - Authenticated layout shell (`AppShell.tsx`, `AppHeader.tsx`, `Sidebar.tsx`) with dark/light themes, branch switcher, and capability-based navigation gating.
  - Route architecture & guards (`ProtectedRoute.tsx`, `PermissionGuard.tsx`, `routes/index.tsx`) in React Router v7.
  - Modern sign-in portal (`LoginPage.tsx`) with React Hook Form, Zod schema validation, and server error banners.
  - Full Catalogue & Master Data workspace (`CatalogueWorkspace.tsx`) with 7 domain management sections: `ProductsSection`, `UnitsSection`, `CategoriesSection`, `BrandsSection`, `BillOfMaterialsSection`, `WarehousesSection`, and `PartiesSection`.
  - Frontend test suite 100% green (128 passing tests) and clean production bundle build (`npm run build`).
- Full test suites: Backend (562 tests, 3,223 assertions, PHPStan Level 9) + Frontend (128 tests, Vite production build).
- Created comprehensive persistent documentation suite:
  - `docs/CODEBASE_CONTEXT.md` (Persistent project memory).
  - `docs/IMPLEMENTATION_PLAN.md` (Phased task plan).
  - `docs/REQUIREMENTS.md` (Traceable requirements REQ-001 onwards).
  - `docs/DATABASE.md` (Authoritative database schema reference).
  - `docs/API.md` (Authoritative API specification).
  - `docs/WORKFLOWS.md` (Authoritative business workflows).
  - `docs/UI_UX_SPECIFICATION.md` (Interaction design system & token guide).
  - `docs/SECURITY.md` (Threat model & multi-tenant security architecture).
  - `docs/TESTING.md` (Testing strategy & quality gates).
  - `docs/DEPLOYMENT.md` (Deployment guide & environment topology).
  - `docs/CHANGELOG.md` (This file).
  - `docs/TODO.md` (Outstanding task ledger).

---

## [Phase 1 Closed] - 2026-08-24: Auth, Tenancy Runtime & Wave 1–25 Schema

### Added
- Authored and verified all 25 database migration waves (170 migration files, 169 database tables, and all deferred foreign key closures).
- Tenancy runtime engine in `app/Core/Tenancy`:
  - `TenantContext.php` (Thread-safe tenant container).
  - `BelongsToTenant.php` (Eloquent global tenant scoping trait).
  - `ResolveTenant.php`, `EnsureTenantActive.php` (Tenancy middleware).
  - Tenancy exceptions: `TenantMismatch`, `TenantSuspended`, `OutOfScope`.
- Complete Dual-Token JWT and RBAC Authentication Pipeline:
  - `JwtService.php` (Cryptographic JWT signing/verification).
  - `RefreshTokenService.php` (14-day rotating refresh tokens with token family reuse revocation).
  - `PermissionCatalogue.php` (Compiled permission registry).
  - `AuthenticateJwt.php` and `AuthorizePermission.php` (Authentication and authorization middleware).
  - `AuthController.php` and 12 Auth Actions (`LoginAction`, `RefreshTokenAction`, `LogoutAction`, `LogoutAllAction`, `GetAuthMeAction`, `GetPermissionsCatalogueAction`, `SelectTenantAction`, `SwitchBranchAction`, `UpdatePreferencesAction`, `ChangePasswordAction`, `ForgotPasswordAction`, `ResetPasswordAction`).
- Standardized Error Handling:
  - `ErrorResponse.php` builder conforming to `API_CONTRACT.md` §2.3.
  - Centralized exception mapping in `bootstrap/app.php`.
- Test suite expanded to 492 passing backend tests / 2575 assertions at 100% PHPStan Level 9 and Pint compliance.

---

## [Phase 0 Closed] - 2026-08-23: Foundation, Architecture & Reliability Layer

### Added
- Monorepo restructure: root workspace coordinating `/backend` (Laravel 13 on PHP 8.5) and `/frontend` (React 19 on TypeScript strict).
- Canonical documentation suite created: 7 canonical documents + 5 supporting documents (12 total), 31 ADRs accepted in `docs/DECISIONS.md`. Archived 14 legacy files to `docs/_legacy/`.
- Frontend design token cascade (`tokens.primitive.css`, `tokens.semantic.css`, `tokens.semantic.dark.css`, `tokens.component.css`, `tokens.motion.css`, `base.css`, `index.css`).
- 9 Token-hardened UI primitives: `Button`, `Badge`, `Modal` (all 12 legacy defects fixed), `Feedback`, `Navigation`, `Tabs`, `FormElements`, `KPICard`, `PWAInstallBanner`, `AsyncButton`, `Toast`.
- Reliability and §8 state-matrix primitives:
  - `ErrorBoundary.tsx` (4-level fault isolation model: Global, Route, Section, Widget).
  - `QueryBoundary.tsx` and `StateView.tsx` (Declarative TanStack Query states).
  - `LogInspector.tsx` (In-memory ring buffer log viewer).
  - `client.ts` (Single HTTP transport seam with automatic correlation ID injection and transparent 401 refresh queuing).
  - `queryClient.ts` (Configured TanStack Query retry and freshness policies).
- Tooling configuration: `phpstan.neon` (Level 9), `pint.json` (strict rules), `vitest.config.ts`, `eslint.config.js`, `.dependency-cruiser.cjs`, `check-bundle-budget.mjs`.
- CI pipeline: `.github/workflows/ci.yml` (3 parallel jobs, 9 verified execution legs).
