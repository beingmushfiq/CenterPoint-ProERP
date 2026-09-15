# Websuru cPanel Deployment Guide — DevCenterPoint ProERP

**Platform:** DevCenterPoint ProERP  
**Hosting Provider:** Websuru (cPanel / Apache / MySQL)  
**Base Domain:** `devcenterpoint.com`  
**Master Domain:** `proerp.devcenterpoint.com`  

---

## 1. Directory Structure on Server

In cPanel, placing sensitive backend code (application logic, `.env`, SQLite files, storage) directly inside `public_html` is a major security risk. 

Follow this strict directory structure:

```
/home/devcente/
├── backend/                         <-- Non-public Laravel application root
│   ├── app/
│   ├── bootstrap/
│   ├── config/
│   ├── database/
│   ├── routes/
│   ├── storage/
│   ├── vendor/
│   ├── artisan
│   ├── composer.json
│   └── .env                         <-- Production environment file
│
└── public_html/                     <-- Web-accessible document root
    ├── assets/                      <-- Compiled Vite JS/CSS
    ├── index.html                   <-- Frontend SPA entry
    ├── index.php                    <-- Laravel entry point (routes to ../backend)
    ├── .htaccess                    <-- Apache routing & security rules
    ├── favicon.ico
    └── robots.txt
```

---

## 2. Step-by-Step Deployment Instructions

### Step 0: Set PHP 8.4 in cPanel MultiPHP Manager
1. In cPanel, search for and open **MultiPHP Manager**.
2. Select your domains: `devcenterpoint.com` and `proerp.devcenterpoint.com`.
3. In the **PHP Version** dropdown at the top right, select **`ea-php84`** (PHP 8.4).
4. Click **Apply**.

### Step 1: Database Setup
1. Log into your **Websuru cPanel Dashboard**.
2. Navigate to **MySQL® Databases** (or **MySQL® Database Wizard**).
3. Create a new database: e.g., `cpaneluser_proerp`.
4. Create a new database user: e.g., `cpaneluser_proerpusr` with a secure 32+ character password.
5. Add the user to the database with **ALL PRIVILEGES**.
6. Verify connection parameters:
   - **DB_HOST:** `localhost`
   - **DB_PORT:** `3306`
   - **DB_DATABASE:** `cpaneluser_proerp`
   - **DB_USERNAME:** `cpaneluser_proerpusr`
   - **DB_PASSWORD:** `<your_password>`

---

### Step 2: Upload Application Files
1. Open the cPanel **File Manager** or connect via **SFTP / SSH**.
2. Create a folder named `backend` directly in your user root (`/home/devcente/backend`).
3. Upload all contents of the project's `backend/` directory into `/home/devcente/backend/`, **except** the `public/` directory and `vendor/`.
4. Run composer install (via cPanel Terminal or SSH):
   ```bash
   cd /home/devcente/backend
   composer install --no-dev --optimize-autoloader
   ```
5. Set write permissions for storage and cache:
   ```bash
   chmod -R 775 /home/devcente/backend/storage
   chmod -R 775 /home/devcente/backend/bootstrap/cache
   ```

---

### Step 3: Configure Environment
1. In `/home/devcente/backend`, create `.env` from `.env.production.example`:
   ```bash
   cp .env.production.example .env
   ```
2. Generate the application encryption key:
   ```bash
   php artisan key:generate
   ```
3. Generate a 64-character JWT secret:
   ```bash
   # On your local machine or terminal:
   openssl rand -base64 48
   ```
4. Edit `.env` and fill in:
   - `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
   - `JWT_SECRET`
   - `APP_URL=https://proerp.devcenterpoint.com`
   - `MASTER_DOMAIN=proerp.devcenterpoint.com`
   - `TENANT_BASE_DOMAIN=devcenterpoint.com`
   - `MAIL_*` credentials

---

### Step 4: Run Migrations & Production Seeder
In terminal:
```bash
cd /home/devcente/backend

# 1. Run migrations
php artisan migrate --force

# 2. Run structural production seeder (DO NOT run DevelopmentSeeder)
php artisan db:seed --class=ProductionSeeder --force

# 3. Optimize configuration caching
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

---

### Step 5: Build & Deploy Frontend SPA
On your development machine:
1. Ensure `frontend/.env.production` contains:
   ```env
   VITE_API_BASE_URL=/api/v1
   VITE_APP_TITLE="DevCenterPoint ProERP"
   VITE_ENABLE_MOCK=false
   VITE_MASTER_DOMAIN=proerp.devcenterpoint.com
   VITE_TENANT_BASE_DOMAIN=devcenterpoint.com
   ```
2. Build the production bundle:
   ```bash
   cd frontend
   npm run build
   ```
3. Upload all files from `frontend/dist/` into `/home/devcente/public_html/`.

---

### Step 6: Link Public Entry Point
In `/home/devcente/public_html/`, verify that `index.php` correctly points to the `backend/` folder outside of webroot:
```php
<?php

use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Maintenance mode check
if (file_exists($maintenance = __DIR__.'/../backend/storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register Composer autoloader
require __DIR__.'/../backend/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__.'/../backend/bootstrap/app.php';

$app->handleRequest(Request::capture());
```

---

### Step 7: Configure Apache Routing (`.htaccess`)
Ensure `/home/devcente/public_html/.htaccess` is configured to direct `/api/*` requests to `index.php` and all other web requests to `index.html`:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On

    # Force HTTPS
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

    # Route API requests to Laravel index.php
    RewriteCond %{REQUEST_URI} ^/api [NC]
    RewriteRule ^ index.php [L]

    # Route Health check to Laravel
    RewriteCond %{REQUEST_URI} ^/up$ [NC]
    RewriteRule ^ index.php [L]

    # Serve static assets directly if they exist
    RewriteCond %{REQUEST_FILENAME} -f [OR]
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteRule ^ - [L]

    # Route all other frontend requests to SPA index.html
    RewriteRule ^ index.html [L]
</IfModule>

# Security Headers
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>
```

---

### Step 8: Configure Cron Jobs in cPanel
Under **cPanel → Cron Jobs**, configure two jobs:

**Job 1: Laravel Task Scheduler (Every Minute)**
- Schedule: `* * * * *`
- Command:
  ```bash
  /usr/local/bin/php /home/devcente/backend/artisan schedule:run >> /dev/null 2>&1
  ```
  *This automatically executes:*
  - `subscriptions:process-lifecycle` daily at 00:05 (automated `trial → past_due → suspended` transitions)
  - `idempotency:purge-expired` hourly (cleans stale mutation keys)
  - `backup:database` daily at 02:00 (database backup with SHA-256 verification)

**Job 2: Queue Worker (Every Minute)**
- Schedule: `* * * * *`
- Command:
  ```bash
  /usr/local/bin/php /home/devcente/backend/artisan queue:work --stop-when-empty --max-time=50 --memory=128 >> /dev/null 2>&1
  ```
  *Runs with automatic TenantContext isolation (`Queue::looping`/`Queue::after` hooks) to prevent context bleeding between tenant tasks.*

---

### Step 9: Automated Deployment via cPanel Git Version Control & Shell Script

DevCenterPoint ProERP includes automated deployment configuration through `.cpanel.yml` at the repository root and `scripts/deploy-cpanel.sh`.

#### Method A: Automated Deployment via cPanel Git Version Control (Recommended)
1. In cPanel, navigate to **Git™ Version Control**.
2. If creating a new repository:
   - Clone URL: Your GitHub repository URL.
   - Repository Path: `/home/devcente/repositories/proerp` (or similar).
   - Working Branch: `main` (or `master`).
3. Under the repository's **Manage** tab:
   - Confirm **Deployment** is enabled.
   - Every time you click **Update from Remote** followed by **Deploy HEAD Commit** (or configure a GitHub Webhook to trigger `cpanel/git/deploy.cgi`), cPanel automatically executes `.cpanel.yml`.
4. `.cpanel.yml` automatically:
   - Syncs non-public backend files to `/home/devcente/backend/` (safeguarding `.env`).
   - Copies `public_html/index.php`, `.htaccess`, and `robots.txt` to `/home/devcente/public_html/`.
   - Triggers `/home/devcente/scripts/deploy-cpanel.sh` to install dependencies, run migrations, compile/deploy frontend SPA, rebuild caches, ensure storage links, and restart workers.

#### Method B: Manual Deployment via SSH
To manually deploy or update at any time via SSH or cPanel Terminal:
```bash
bash scripts/deploy-cpanel.sh
```
This runs composer install with optimized autoloader, executes pending migrations, rebuilds all production caches (`config:cache`, `route:cache`, `view:cache`, `event:cache`), links storage, and restarts queue workers.

---

### Step 10: DNS & SSL Configuration
1. In cPanel **Zone Editor**:
   - Create an **A Record** or **CNAME** for `proerp.devcenterpoint.com` pointing to the server IP.
   - Create a **Wildcard CNAME / A Record**: `*.devcenterpoint.com` pointing to the server IP.
2. In cPanel **Subdomains**:
   - Create a wildcard subdomain: `*.devcenterpoint.com` with Document Root set to `public_html`.
3. In cPanel **SSL/TLS Status**:
   - Run **AutoSSL** to generate Let's Encrypt certificates for `devcenterpoint.com`, `proerp.devcenterpoint.com`, and `*.devcenterpoint.com`.
