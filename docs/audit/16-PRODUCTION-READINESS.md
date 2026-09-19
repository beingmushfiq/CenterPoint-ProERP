# 16 - Production Readiness & Deployment Architecture

This document provides a technical evaluation and operational runbook for deploying the `slicemart-fms` multi-tenant SaaS ERP platform to production on the target Linux/cPanel environment (`devcenterpoint.com`).

---

## 1. Production Architecture Overview

The target production infrastructure is structured around a shared or dedicated cPanel / CloudLinux host with Cloudflare edge proxying:

```
[ Incoming HTTPS Requests ]
          │
          ▼
   [ Cloudflare CDN & Edge Proxy ]
   (SSL Termination, WAF, DDoS Protection, Wildcard *.devcenterpoint.com, Custom CNAMEs)
          │
          ▼
   [ Apache 2.4 / LiteSpeed Web Server ]
   (cPanel User: devcente, Multi-Project Document Root Routing)
          │
   ┌──────┴────────────────────────────────────────────────┐
   │                                                       │
   ▼                                                       ▼
[ Storefront / Client Web App ]                 [ ProERP Backend API ]
/home/devcente/projects/proerp/public           /home/devcente/projects/proerp/backend
(Static SPA Build + index.html SPA Router)      (Laravel 11.x REST API Engine)
                                                           │
                                                           ▼
                                                [ MariaDB 10.6+ / MySQL 8.0 ]
                                                (Single DB with Discriminator Multi-Tenancy)
```

---

## 2. Server Prerequisites & PHP Extensions

| Component | Required Version | Status / Notes |
| :--- | :--- | :--- |
| **PHP Runtime** | `^8.2.0` (8.2 or 8.3 Recommended) | Must be configured with `memory_limit >= 512M` |
| **Required Extensions** | `bcmath`, `ctype`, `curl`, `fileinfo`, `gd`, `intl`, `json`, `mbstring`, `openssl`, `pdo_mysql`, `redis`, `tokenizer`, `xml`, `zip` | Verify via `php -m` |
| **Database Engine** | MySQL `8.0+` or MariaDB `10.6+` | InnoDB engine, charset `utf8mb4`, collation `utf8mb4_unicode_ci` |
| **Node.js** | `v20.x` LTS + `npm 10.x` | Required for building Vite SPA assets (`npm run build`) |
| **Redis Server** | Redis `7.x` | Required for tenant cache isolation, session store, and queue dispatching |

---

## 3. Directory Layout & Document Root Mapping

To ensure strict security and prevent source code leaks, **the backend directory must never reside inside `public_html`**.

```
/home/devcente/
├── logs/                                    # Deployment and artisan logs
├── repositories/
│   └── proerp/                              # Clean Git mirror (cloned from origin/main)
├── projects/
│   └── proerp/
│       ├── backend/                         # Laravel codebase (PRIVATE - NO HTTP ACCESS)
│       │   ├── app/
│       │   ├── bootstrap/
│       │   ├── config/
│       │   ├── database/
│       │   ├── storage/
│       │   └── .env                         # Production environment secrets
│       └── public/                          # Public document root for proerp.devcenterpoint.com
│           ├── index.html                   # Compiled Vite SPA entry
│           ├── assets/                      # JS, CSS, fonts, SVG icons
│           ├── index.php                    # Laravel API entrypoint
│           └── storage -> ../backend/storage/app/public # Symbolic link for public uploads
└── scripts/
    ├── auto-deploy.sh                       # One-click deployment script
    └── deploy-cpanel.sh                     # Migrations, caches, permission fixer
```

---

## 4. Production Environment Configuration (`.env`)

Critical production settings that must be enforced:

```dotenv
APP_NAME="ProERP"
APP_ENV=production
APP_KEY=base64:GENERATE_VIA_ARTISAN_KEY_GENERATE
APP_DEBUG=false
APP_URL=https://proerp.devcenterpoint.com

# Multi-Tenant Domain Configuration
CENTRAL_DOMAIN=devcenterpoint.com
STOREFRONT_DOMAIN_PATTERN=*.devcenterpoint.com
SANCTUM_STATEFUL_DOMAINS="proerp.devcenterpoint.com,devcenterpoint.com,.devcenterpoint.com"

# Database Configuration
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=devcente_proerp
DB_USERNAME=devcente_erpuser
DB_PASSWORD="STRONG_UNGUESSABLE_PASSWORD"
DB_STRICT_MODE=true

# Cache, Sessions & Queues
CACHE_STORE=redis
SESSION_DRIVER=redis
SESSION_LIFETIME=120
SESSION_SECURE_COOKIE=true
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=lax
QUEUE_CONNECTION=redis

# Redis Credentials
REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

# Logging
LOG_CHANNEL=daily
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=warning

# JWT Auth Secret
JWT_SECRET=GENERATE_VIA_ARTISAN_JWT_SECRET
JWT_TTL=60
JWT_REFRESH_TTL=20160
```

---

## 5. Background Process Management & Queue Workers

For a high-throughput ERP, PDF report generation, Excel exports, webhook deliveries, and inventory ledger reconciliations must execute asynchronously in background queues.

### 5.1 Systemd / Supervisor Queue Worker Configuration
If root or supervisor access is available on the VPS/server, configure `/etc/supervisor/conf.d/proerp-worker.conf`:

```ini
[program:proerp-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /home/devcente/projects/proerp/backend/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600 --queue=high,default,reports,webhooks,exports
autostart=true
autorestart=true
user=devcente
numprocs=2
redirect_stderr=true
stdout_logfile=/home/devcente/logs/worker.log
stopwaitsecs=3600
```

### 5.2 cPanel Cron Fallback (When Supervisor is Unavailable)
On standard shared/reseller cPanel hosts where background daemons cannot be supervised:
1. **Queue Runner Cron (Every minute):**
   ```cron
   * * * * * cd /home/devcente/projects/proerp/backend && php artisan queue:work redis --stop-when-empty --tries=3 >> /home/devcente/logs/queue-cron.log 2>&1
   ```
2. **Laravel Scheduler Cron (Every minute):**
   ```cron
   * * * * * cd /home/devcente/projects/proerp/backend && php artisan schedule:run >> /dev/null 2>&1
   ```

---

## 6. Zero-Downtime Deployment Runbook

The automated deployment pipeline in `scripts/auto-deploy.sh` executes the following sequence:

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Pull latest verified commits from origin/main
cd /home/devcente/repositories/proerp
git fetch origin main
git reset --hard origin/main

# 2. Sync backend files to live destination
rsync -av --delete --exclude='.env' --exclude='storage/' \
    /home/devcente/repositories/proerp/backend/ \
    /home/devcente/projects/proerp/backend/

# 3. Install composer dependencies without dev packages
cd /home/devcente/projects/proerp/backend
composer install --no-dev --optimize-autoloader --no-interaction

# 4. Execute atomic database migrations
php artisan migrate --force

# 5. Build production frontend assets
cd /home/devcente/repositories/proerp
npm ci
npm run build

# 6. Deploy frontend build to public destination
rsync -av --delete /home/devcente/repositories/proerp/dist/ /home/devcente/projects/proerp/public/

# 7. Rebuild configuration and route caches
cd /home/devcente/projects/proerp/backend
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# 8. Ensure proper storage symbolic links and permissions
php artisan storage:link || true
chmod -R 775 /home/devcente/projects/proerp/backend/storage
chmod -R 775 /home/devcente/projects/proerp/backend/bootstrap/cache
```

---

## 7. Pre-Launch Verification Checklist

Before opening registration to live commercial tenants, the following verification gates must pass:

- [ ] **No Route Closures Failing Route Cache:** `php artisan route:cache` runs and exits with code 0.
- [ ] **Debug Mode Disabled:** `APP_DEBUG=false` in `.env`. Accessing an invalid route returns clean JSON 404, never a Laravel stack trace.
- [ ] **Storage Permitted:** `storage/app/public` symlinked to `public/storage`, writable by PHP user.
- [ ] **Automated Daily Backups:** Automated `mysqldump` cron running at 02:00 UTC, uploaded to external cloud storage (S3/R2).
- [ ] **SSL / TLS Verification:** A+ rating on SSL Labs, HSTS headers active, TLS 1.2/1.3 enforced.
- [ ] **Report Fake Data Eliminated:** All reports return authentic tenant data or empty states; zero hardcoded garment arrays.
- [ ] **Tenant Isolation Verified:** Automated cross-tenant tests pass with 100% isolation; zero IDOR leaks in report filters.
