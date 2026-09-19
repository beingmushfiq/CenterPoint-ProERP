# 12 — Security & Vulnerability Audit

**Status:** Completed  
**Date:** September 2026  
**Auditor:** DevSecOps & Application Security Lead  
**Compliance Standards:** OWASP Top 10 API Security Risks (2023), SOC2 Multi-Tenancy Principles

---

## 1. Vulnerability Findings & Severity Matrix

| ID | Vulnerability | Severity | Vector / Location | Remediation |
|---|---|---|---|---|
| **SEC-01** | BOLA / IDOR in Reporting Queries | **CRITICAL** | `SalesPerformanceReportQuery`, `gl_summary`, etc. accept `$filters['tenant_id']` | Eradicate `$filters['tenant_id']`; force `TenantContext::current()->tenantId()` |
| **SEC-02** | Missing Tenant Isolation Trait on 5 Models | **HIGH** | `TenantProductionStage`, `TenantQcTemplate`, `TenantQcCheck`, `TenantModule`, `TenantUsageCounter` omit `BelongsToTenant` | Add `use BelongsToTenant;` to all 5 models |
| **SEC-03** | Route Model Binding Tenant Bypass | **MEDIUM** | `SubstituteBindings` executes before `tenant.resolve` in `bootstrap/app.php` | Reorder middleware chain or enforce explicit controller ownership checks |
| **SEC-04** | Hardcoded Apex IP Address | **LOW** | `TenantDomainService.php` hardcodes `104.21.45.10` | Move to environment configuration (`.env`) |
| **SEC-05** | Production Subdomain Header Override | **LOW** | `TenantResolver.php` disables header overrides in prod, but needs strict Host validation | Ensure reverse proxy does not forward untrusted Host headers |

---

## 2. Authentication Architecture Review

### 2.1 Short-Lived JWT + httpOnly Refresh Token (ADR-007)
The platform implements an exemplary, enterprise-grade authentication pattern:
- **Access Token:** Stored **in memory only** (`accessToken` in `client.ts`), expiring in 15 minutes. It is never stored in `localStorage`, eliminating token exfiltration via Cross-Site Scripting (XSS).
- **Refresh Token:** Stored in an `httpOnly`, `Secure`, `SameSite=Strict` cookie (`slicemart_refresh_token`). JavaScript cannot read this cookie.
- **Reuse Detection & Revocation Families:** If an expired or already-used refresh token is presented, `RefreshTokenService` detects token replay, revokes the entire token family, and terminates the session immediately.

---

## 3. RBAC & Permission Scoping

### 3.1 Permission Architecture
- System defines granular permissions (e.g. `sales.order.create`, `inventory.stock.view`, `hr.payroll.disburse`) registered in `App\Core\Auth\PermissionCatalogue`.
- Middleware `permission:{key}` guards 349 backend routes.
- Super Administrators (`is_platform_admin = true` or `Super Administrator` role) possess wildcard `*` permissions.
- In `ReportRegistryController`, reports are dynamically filtered against `hasPermission($report->required_permission)`.

---

## 4. Dynamic CORS Configuration

In `App\Core\Http\Middleware\HandleCors.php`:
- Wildcard CORS (`*`) is strictly forbidden on authenticated routes.
- Permitted origins are dynamically evaluated against:
  1. Platform base domain (`devcenterpoint.com`).
  2. Active tenant subdomains (`{tenant}.devcenterpoint.com`).
  3. Verified custom domains from `tenant_domains` table where `verification_status = 'verified'`.
  4. Local development ports (`localhost:5173`) only when `app()->environment('local')`.

---

## 5. File Upload Security

- File uploads in `AssetController`, `EmployeeController`, and `StorefrontCustomizerController` validate MIME types (`jpg, png, webp, pdf`), restrict maximum upload size (10 MB), and store files under tenant-isolated paths:
  `storage/app/tenants/{tenant_id}/{module}/...`
- Direct PHP script execution in upload directories is blocked by `.htaccess` rules.
