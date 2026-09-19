# 13 — Performance, Scalability & Realtime Audit

**Status:** Completed  
**Date:** September 2026  
**Focus:** Database Indexing, Caching Strategy, Frontend Code Splitting & Async Queues

---

## 1. Database Indexing & Compound Tenancy Keys

Because the database uses a shared-table multi-tenant architecture, query efficiency depends entirely on **compound indexes prefixed by `tenant_id`**.

### 1.1 Index Audit Findings
- **Positive:** Migrations for `sales_orders`, `invoices`, `stock_movements`, and `attendances` feature compound indexes on `(tenant_id, created_at)` and `(tenant_id, status)`.
- **Gaps Identified:**
  - `worker_production_entries`: Frequently queried by date range and worker ID; needs index on `(tenant_id, entry_date, worker_id)`.
  - `journal_entry_lines`: Needs compound index on `(tenant_id, gl_account_id, entry_date)` for high-speed General Ledger aggregation.
  - `courier_shipments`: Needs compound index on `(tenant_id, delivery_status, courier_provider_id)`.

---

## 2. Caching Strategy & Multi-Tenant Cache Pollution

### 2.1 Cache Key Isolation
All cache entries in `App\Core\Tenancy` and services enforce tenant namespacing:
```php
Cache::remember("t{$tenantId}:user:{$userId}:scopes", 300, ...);
```
This strictly prevents Cache Bleed across tenants.

### 2.2 Cache Busting & Invalidation
- Changing a tenant's module configuration in `TenantModuleController` flushes `"t{$tenantId}:modules"`.
- Modifying a user's role or scopes increments `perm_version` on the `User` model, triggering a silent client-side permissions refresh on the next request.

---

## 3. Frontend Bundle Budget & Code-Splitting

### 3.1 Vite Bundling Architecture
- React 19 router in `src/router/` uses dynamic imports (`React.lazy(() => import(...))`) for all domain workspaces.
- Chunk size is bounded: heavy visualization libraries (`recharts`, `bwip-js`, `xlsx`) are isolated into standalone vendor chunks.
- Typecheck (`tsc -b --noEmit`) executes in < 15 seconds.

---

## 4. Realtime Strategy: WebSockets vs. Polling

The platform must avoid introducing persistent WebSocket connections everywhere unnecessarily:

| Subsystem | Realtime Requirement | Recommended Implementation | Rationale |
|---|---|---|---|
| **POS Counter Terminal** | Low | Local Storage / IndexedDB Sync | Offline-first counter resilience |
| **Kitchen / Assembly Line Bell** | Medium | Server-Sent Events (SSE) | Unidirectional order notifications |
| **Online Order Notification** | Medium | Short Polling (30s) or SSE | Lightweight, works across standard cPanel Apache |
| **Reports Generation** | Low | Async Queue Job + Notification | Large exports (10k+ rows) must not block HTTP FPM |
| **Storefront Stock Counter** | None | Cache with 60s TTL | Prevents database overload during flash sales |
