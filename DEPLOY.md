# Deployment Guide — Production ERP & Storefront

This guide covers deployment procedures for staging and production environments, including automated cPanel deployment and manual release cycles.

---

## 🏗️ Architecture & Server Layout

| Component | Path / Location | Purpose |
|---|---|---|
| **Backend API** | `/home/devcente/projects/proerp/backend/` | Laravel 11/12 application (not directly web-accessible) |
| **Document Root** | `/home/devcente/projects/proerp/public/` | Public entry point (`index.php`, `.htaccess`, static assets) |
| **Frontend SPA** | Built locally (`npm run build`) | Uploaded to `/home/devcente/projects/proerp/public/` |
| **Log Directory** | `/home/devcente/logs/` | Centralized deployment, queue, and schedule logs |
| **Subdomains** | `proerp.devcenterpoint.com`, `*.devcenterpoint.com` | Routed to document root |

---

## 🚀 Deployment Workflows

### Method 1: Master Deployment Runner (`bash deploy.sh` in cPanel Terminal)
Run `deploy.sh` directly in the cPanel Terminal. It automatically resolves environment paths, PHP CLI version (MultiPHP 8.2–8.5), scaffolds permissions, links public storage, registers `.backend_path`, runs composer, migrations, seeders, and compiles production caches:

```bash
# Navigate to repository directory in cPanel Terminal:
cd ~/slicemart-fms   # or ~/projects/proerp or ~/repositories/proerp

# Run master deployment:
bash deploy.sh

# Advanced options:
# bash deploy.sh --in-place               # Deploy within current repository
# bash deploy.sh --seed                    # Run full database seeders
# bash deploy.sh --skip-migrate            # Skip migrations
# bash deploy.sh --target-frontend=PATH    # Custom document root
```

### Method 2: Automated cPanel Git Deployment (`.cpanel.yml`)
When code is pushed to the repository, cPanel triggers `scripts/deploy-cpanel.sh` automatically.

```bash
# To trigger manually on the server via SSH / cPanel Terminal:
bash scripts/deploy-cpanel.sh
```

#### What `deploy-cpanel.sh` executes:
1. Detects PHP binary (PHP 8.4+ / `ea-php84`).
2. Creates necessary storage directories (`storage/framework/{cache,sessions,views}`, `bootstrap/cache`) and sets 775 permissions.
3. Installs backend dependencies (`composer install --no-dev --prefer-dist --optimize-autoloader`).
4. Runs database migrations (`php artisan migrate --force`).
5. Updates seeders (`SystemPermissionsSeeder`, `PlansAndTenantsSeeder`, `RolesAndPermissionsSeeder`, `ReportDefinitionsTableSeeder`).
6. Rebuilds framework caches (`config:cache`, `route:cache`, `view:cache`, `event:cache`).
7. Restarts queue workers (`php artisan queue:restart`).
8. Symlinks `storage/app/public` to `public/storage`.

---

### Method 2: Frontend SPA Build & Release
Because shared hosting servers typically lack modern Node.js 22+, frontend builds are compiled on the developer machine or CI runner and synced:

1. **Build the production bundle locally:**
   ```bash
   cd frontend
   npm run build
   ```
2. **Verify bundle budgets:**
   ```bash
   npm run budget
   ```
3. **Upload `frontend/dist/` contents:**
   - Copy all files from `frontend/dist/*` into `/home/devcente/projects/proerp/public/` via SFTP or cPanel File Manager.
   - Ensure `index.html` and assets folder (`assets/index-*.js`, `assets/index-*.css`) are present at the root of `public/`.

---

## 🔒 Environment Configuration (`.env`)

Before running in production, ensure `backend/.env` is configured:

```ini
APP_NAME="Operations ERP"
APP_ENV=production
APP_KEY=base64:...
APP_DEBUG=false
APP_URL=https://proerp.devcenterpoint.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=devcente_proerp
DB_USERNAME=devcente_dbuser
DB_PASSWORD="<STRONG_PASSWORD>"

CACHE_STORE=file
QUEUE_CONNECTION=database
SESSION_DRIVER=file

JWT_SECRET=<32_BYTE_SECRET>
```

---

## ✅ Post-Deployment Verification Checklist

1. [ ] Check health endpoint: `curl -I https://proerp.devcenterpoint.com/up` (Expected: HTTP 200)
2. [ ] Check API manifest: `curl -s https://proerp.devcenterpoint.com/api/v1/tenant/manifest | grep "success"`
3. [ ] Check assets: Load login screen in browser; verify console has 0 asset 404s.
4. [ ] Check cron logs: `tail -n 20 /home/devcente/logs/proerp-schedule.log`
5. [ ] Check queue logs: `tail -n 20 /home/devcente/logs/proerp-queue.log`
