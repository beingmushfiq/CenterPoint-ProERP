# Deployment Guide — Production ERP & Storefront

This guide covers deployment procedures for staging and production environments on cPanel shared hosting, VPS, and CI/CD environments.

---

## 🏗️ Architecture & Server Layout

| Component | Path / Location | Purpose |
|---|---|---|
| **Backend API** | `$HOME/projects/proerp/backend/` | Laravel 11/12 application (strictly private, outside web root) |
| **Document Root** | `$HOME/projects/proerp/public/` | Public entry point (`index.php`, `.htaccess`, static assets, SPA bundle) |
| **Portfolio / Main Site** | `$HOME/public_html/` | Main agency portfolio (devcenterpoint.com — strictly preserved) |
| **Log Directory** | `$HOME/logs/` | Centralized deployment, queue, and schedule logs |
| **Subdomains** | `proerp.devcenterpoint.com`, `*.devcenterpoint.com` | Document root mapped to `$HOME/projects/proerp/public` |

---

## 🚀 Deployment Workflows

### Method 1: Master Deployment Runner (`bash deploy.sh` in cPanel Terminal)

This is the recommended one-step deployment method. Run `deploy.sh` directly in the cPanel Terminal or via SSH. It automatically:
1. Detects the best available PHP CLI version (MultiPHP `ea-php85`, `ea-php84`, `ea-php83`, `ea-php82`) and prepends it to `$PATH`.
2. Syncs pre-built production assets from `public_html/` into the document root (`$HOME/projects/proerp/public/`).
3. Writes the dynamic `.backend_path` routing pointer for `index.php`.
4. Synchronizes Laravel backend files while preserving `.env`.
5. Scaffolds storage directories, creates `storage/logs/laravel.log`, sets 775/664 permissions, and creates the public storage symlink.
6. Installs Composer dependencies (`composer install --no-dev --prefer-dist --optimize-autoloader`) with automatic platform requirements fallback.
7. Executes database migrations (`php artisan migrate --force`) and seeds essential system catalogs.
8. Rebuilds production caches (`config:cache`, `route:cache`, `view:cache`, `event:cache`) and restarts queue workers.

```bash
# 1. Log in to cPanel -> Terminal (or SSH)
# 2. Navigate to your repository directory:
cd ~/slicemart-fms   # or ~/projects/proerp or ~/repositories/proerp

# 3. Run master deployment:
bash deploy.sh

# Advanced options:
# bash deploy.sh --in-place               # Deploy within current repository (backend/ & public_html/)
# bash deploy.sh --seed                    # Run full database seeders (Platform & Flagship tenant)
# bash deploy.sh --skip-migrate            # Skip migrations
# bash deploy.sh --target-backend=PATH    # Custom backend destination
# bash deploy.sh --target-frontend=PATH   # Custom document root destination
```

---

### Method 2: Automated cPanel Git Versioning (`.cpanel.yml`)

When code is pushed to your Git repository (e.g. GitHub or cPanel Git Repo), cPanel Git Versioning automatically triggers deployment tasks defined in `.cpanel.yml`:

```bash
# To trigger manually on the server via SSH / cPanel Terminal:
bash scripts/deploy-cpanel.sh
```

---

### Method 3: Local Build & Manual Sync (`npm run deploy:prepare`)

Because cPanel shared hosting servers typically lack Node.js 22+, frontend assets are pre-compiled and tracked in `public_html/`:

1. **On your local development machine:**
   ```bash
   # Compiles frontend, syncs dist/ into public_html/, and validates readiness:
   npm run deploy:prepare
   ```
2. **Commit and push:**
   ```bash
   git add public_html/
   git commit -m "chore: build and sync frontend distribution assets"
   git push origin main
   ```
3. **On cPanel Terminal:**
   ```bash
   cd ~/slicemart-fms
   git pull origin main
   bash deploy.sh
   ```

---

## 🔒 Environment Configuration (`.env`)

Before running database migrations in production, ensure `$HOME/projects/proerp/backend/.env` is configured:

```ini
APP_NAME="Operations ERP"
APP_ENV=production
APP_KEY=base64:kRuMt2muBz1vtVd+gKhU/Fo5Dyp+5dzOBrHoLPLtryA=
APP_DEBUG=false
APP_URL=https://proerp.devcenterpoint.com

PLATFORM_NAME="DevCenterPoint"
MASTER_DOMAIN=proerp.devcenterpoint.com
TENANT_BASE_DOMAIN=devcenterpoint.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=devcente_proerp
DB_USERNAME=devcente_proerpusr
DB_PASSWORD="<STRONG_PASSWORD>"
DB_STRICT=false

CACHE_STORE=database
QUEUE_CONNECTION=database
SESSION_DRIVER=file

JWT_SECRET=<32_BYTE_SECRET>
```

---

## ⏰ cPanel Cron Jobs Configuration

Configure these two cron jobs in **cPanel → Cron Jobs**:

1. **Task Scheduler (Runs every minute):**
   ```bash
   * * * * * /opt/cpanel/ea-php84/root/usr/bin/php /home/devcente/projects/proerp/backend/artisan schedule:run >> /home/devcente/logs/proerp-schedule.log 2>&1
   ```

2. **Queue Worker (Runs every minute with graceful timeout):**
   ```bash
   * * * * * /opt/cpanel/ea-php84/root/usr/bin/php /home/devcente/projects/proerp/backend/artisan queue:work --stop-when-empty --max-time=55 >> /home/devcente/logs/proerp-queue.log 2>&1
   ```

---

## ✅ Post-Deployment Verification Checklist

1. [ ] Check health probe: `curl -I https://proerp.devcenterpoint.com/up` (Expected: HTTP 200)
2. [ ] Check API manifest: `curl -s https://proerp.devcenterpoint.com/api/v1/tenant/manifest | grep "success"`
3. [ ] Check SPA frontend: Navigate to `https://proerp.devcenterpoint.com/login` and verify zero asset 404s in DevTools Console.
4. [ ] Check scheduler log: `tail -n 20 ~/logs/proerp-schedule.log`
5. [ ] Check queue worker log: `tail -n 20 ~/logs/proerp-queue.log`
6. [ ] Check application log: `tail -n 20 ~/projects/proerp/backend/storage/logs/laravel.log`

