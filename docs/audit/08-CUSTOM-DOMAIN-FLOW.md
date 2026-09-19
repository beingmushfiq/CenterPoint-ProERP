# 08 — Custom Domain & Subdomain Architecture

**Status:** Completed  
**Date:** September 2026  
**Default Host:** `{tenant}.devcenterpoint.com`  
**Custom Host:** `{customdomain}.com` (e.g. `slicemart.tech`)

---

## 1. Separation of Responsibilities

A critical SaaS requirement is separating **Application Logic** from **Hosting / DNS / SSL Infrastructure**:

```
┌──────────────────────────────────────────────────────────┐
│             HOSTING & INFRASTRUCTURE LAYER               │
│  - DNS Management (Route 53 / Cloudflare / GoDaddy)      │
│  - Edge SSL Termination (Cloudflare Universal SSL / Let's│
│    Encrypt via cPanel UAPI)                              │
│  - Web Server VirtualHost / ServerAlias                  │
└────────────────────────────┬─────────────────────────────┘
                             │ Forwarded HTTP Request
                             ▼
┌──────────────────────────────────────────────────────────┐
│                 APPLICATION LAYER (LARAVEL)              │
│  - Domain ownership validation (TXT token challenge)     │
│  - Google DNS-over-HTTPS (DoH) verification queries      │
│  - Tenant resolution (`TenantResolver::resolveFromRequest│
│  - Routing between Headless Storefront and ERP (/login)  │
│  - Dynamic canonical SEO URLs, robots.txt, sitemaps      │
└──────────────────────────────────────────────────────────┘
```

Laravel cannot natively create DNS A/CNAME records on external name servers or provision TLS private keys on the web server without an API integration (e.g. Cloudflare for SaaS or cPanel UAPI).

---

## 2. The 20-Step Custom Domain Lifecycle

1. **Domain Request:** Tenant enters custom domain (e.g. `slicemart.tech`) in Tenant Settings.
2. **Format Normalization:** Protocol (`https://`) and trailing slashes stripped; lowercase forced.
3. **Format Validation:** RFC-1123 regex check.
4. **Platform Reserved Check:** Blocks `devcenterpoint.com`, `localhost`, and reserved SaaS subdomains.
5. **Global Uniqueness Check:** Checks `tenant_domains` without tenant scope to ensure no other tenant claims this domain.
6. **Token Generation:** Generates verification token: `dcp-verify-{random32}`.
7. **DNS Guidance Presentation:** User receives required DNS records:
   - **TXT Record:** `_dcp-challenge.{domain}` → `{token}`
   - **CNAME Record:** `shop.{domain}` (or `www`) → `{tenant}.devcenterpoint.com`
   - **A Record:** `@` (Apex) → Platform Ingress IP
8. **Verification Trigger:** User clicks "Verify Domain" in UI (`POST /api/v1/tenant/domains/{id}/verify`).
9. **DNS Lookup (DoH):** Backend queries Google DNS-over-HTTPS (`https://dns.google/resolve`) to bypass local DNS caching.
10. **Challenge Validation:** Confirms TXT record matches token OR CNAME points to tenant subdomain.
11. **Hosting Mapping:** Signals cPanel UAPI or Cloudflare Custom Hostname API to bind domain.
12. **SSL Provisioning:** Edge certificate provisioned by Cloudflare or AutoSSL.
13. **Domain Activation:** `verification_status` updated to `verified`; `activated_at` timestamp recorded.
14. **Primary Designation:** If selected, sets `is_primary = true` and updates storefront configuration.
15. **Storefront Resolution:** Requests to `https://slicemart.tech/` resolve to `Storefront` model for Tenant #1.
16. **ERP /login Resolution:** Requests to `https://slicemart.tech/login` resolve to the tenant's ERP login screen.
17. **Canonical SEO URLs:** Metadata, Open Graph, and JSON-LD schema dynamically use `https://slicemart.tech`.
18. **Sitemap & Robots:** `/sitemap.xml` and `/robots.txt` output absolute URLs under `https://slicemart.tech`.
19. **Tenant Status Enforcement:** If tenant is suspended (`status = 'suspended'`), custom domain serves standard 402/maintenance screen.
20. **Domain Removal / Replacement:** Tenant can remove domain; system unlinks domain and resets primary to `{tenant}.devcenterpoint.com`.

---

## 3. Findings & Risks in Current Implementation

### 3.1 Hardcoded Cloudflare IP
In `App\Modules\Ecommerce\Services\TenantDomainService.php` (line 83):
```php
'value' => '104.21.45.10', // Hardcoded apex fallback IP!
```
**Risk:** If the server or Cloudflare proxy IP changes, all tenants configuring apex A records will point their traffic to the wrong IP.  
**Fix:** Move this to `config('platform.ingress_ip')` and read from `.env`.

### 3.2 Premature SSL Status Flag
In `TenantDomainService.php` (line 277):
```php
$tenantDomain->ssl_status = 'active';
```
Setting `ssl_status = 'active'` as soon as DNS TXT matches is premature. If the user accesses the domain before SSL certificates have been issued at the edge, their browser will show an `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` or self-signed certificate error.  
**Fix:** Maintain `ssl_status = 'issuing'` until an HTTP probe confirms HTTPS connectivity, or query the Cloudflare / cPanel SSL API.

### 3.3 Production Subdomain Header Bypass
In `App\Core\Tenancy\TenantResolver.php` (line 35):
```php
if (app()->environment('local', 'testing')) {
    $override = $request->header('X-Tenant-Subdomain') ?: $request->header('X-Storefront-Subdomain');
}
```
In production, `X-Storefront-Subdomain` is **ignored**. Therefore, API requests from the storefront must carry the correct `Host` header (matching `{tenant}.devcenterpoint.com` or the custom domain).
