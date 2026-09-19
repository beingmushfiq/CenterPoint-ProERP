# 07 — Multi-Tenant Architecture & Isolation Audit

**Status:** Completed  
**Date:** September 2026  
**Tenancy Pattern:** Shared Database, Shared Process, Strict Discriminator Scoping (`tenant_id`)

---

## 1. Tenancy Model Overview

The platform uses a **single-database, multi-tenant discriminator model**:
- Every tenant-owned row in MySQL/MariaDB contains a `tenant_id` foreign key.
- The active tenant is identified per request by `ResolveTenant` middleware and bound into a static, thread-safe request context: `TenantContext::bind($tenantData, $scopes)`.
- Eloquent models enforce automatic read filtering and write stamping via `App\Core\Tenancy\Concerns\BelongsToTenant`.

---

## 2. Global Scope & Write Stamping Audit

### 2.1 The `BelongsToTenant` Trait
When implemented, `BelongsToTenant` provides two critical security layers:
1. **Layer 2 (Query):** Attaches a GlobalScope `static::addGlobalScope('tenant', ...)` which automatically appends `WHERE {table}.tenant_id = {current_tenant_id}` to every query.
2. **Layer 3 (Write):** Attaches a model `creating` hook that stamps `tenant_id = TenantContext::current()->tenantId()` before inserting the record into the database.

### 2.2 Critical Omission: Unscoped Operational Models
Out of **165 Eloquent models**, 141 correctly use `BelongsToTenant`. However, **5 critical tenant-owned operational models omit the trait**:
1. `App\Models\TenantProductionStage` — Manufacturing stages (cutting, sewing, finishing, packaging).
2. `App\Models\TenantQcTemplate` — Quality control checklist templates.
3. `App\Models\TenantQcCheck` — Specific inspection items and defect standards.
4. `App\Models\TenantModule` — Per-tenant module enablement flags and configuration.
5. `App\Models\TenantUsageCounter` — Tier usage metrics and quota enforcement.

**Security Risk:** Any direct Eloquent query (e.g. `TenantProductionStage::all()`, `TenantQcTemplate::where('is_active', true)->get()`) returns records belonging to **ALL tenants** across the platform!

---

## 3. High-Severity IDOR Vulnerability in Reports

In all 5 active report query classes (`SalesPerformanceReportQuery`, `StockValuationReportQuery`, `ProductionYieldReportQuery`, `GeneralLedgerSummaryReportQuery`, `PayrollSummaryReportQuery`), tenant resolution is written as:

```php
// VULNERABLE CODE:
$tenantId = $filters['tenant_id'] ?? auth()->user()?->tenant_id ?? 1;
```

### Exploit Scenario
1. An attacker logs in as an authenticated user of **Tenant B** (`tenant_id = 42`).
2. The attacker navigates to `/api/v1/reports/sales_performance/data?tenant_id=1` or `/api/v1/reports/gl_summary/data?tenant_id=1`.
3. Because the query inspects `$filters['tenant_id']` first, it executes raw database queries against `tenant_id = 1` (`DB::table('sales_orders')->where('tenant_id', $tenantId)`).
4. **Tenant B successfully exfiltrates Tenant A's full general ledger, payroll data, and sales revenue.**

### Mandatory Remediation
Remove all acceptance of `tenant_id` from `$filters`. Tenant ID must **always and exclusively** be resolved from the authenticated session context:
```php
$tenantId = TenantContext::current()->tenantId();
```

---

## 4. Route Model Binding Middleware Ordering

In `backend/bootstrap/app.php` (lines 73–79):
```php
// SubstituteBindings runs inside the api group BEFORE route middleware,
// so tenant scope is not yet bound during route model binding.
```
When a route is defined with implicit binding (e.g. `api/v1/boms/{billOfMaterial:uuid}`), Laravel resolves the model from the database **before** `tenant.resolve` has bound the `TenantContext`.

### Consequences
- Global scopes do not apply during route model binding resolution.
- If a controller fails to perform an explicit tenant check (`if ($model->tenant_id !== TenantContext::current()->tenantId())`), an attacker can access another tenant's entity by providing its UUID.
- **Remediation:** Move `tenant.resolve` and `auth.jwt` into the primary `api` middleware group so they run *before* `SubstituteBindings`.
