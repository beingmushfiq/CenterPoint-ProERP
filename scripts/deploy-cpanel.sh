#!/usr/bin/env bash
# ==============================================================================
# DevCenterPoint ProERP — cPanel / Shared Hosting Automated Deployment Script
# ==============================================================================
# Triggered by: .cpanel.yml after every git push (backend deployment)
# Manual use:   bash scripts/deploy-cpanel.sh
#
# Server Directory Layout:
#   /home/devcente/public_html/             → devcenterpoint.com (PORTFOLIO — never touch)
#   /home/devcente/projects/proerp/public/  → Document Root for *.devcenterpoint.com
#   /home/devcente/projects/proerp/backend/ → Laravel app (not web-accessible)
#
# cPanel Subdomains (configure ONCE in cPanel → Domains → Subdomains):
#   proerp.devcenterpoint.com  → /home/devcente/projects/proerp/public
#   demoerp.devcenterpoint.com → /home/devcente/projects/proerp/public
#   *.devcenterpoint.com       → /home/devcente/projects/proerp/public  (wildcard)
#
# cPanel Cron Jobs (configure ONCE in cPanel → Cron Jobs):
#   Queue worker  (every min): * * * * * /opt/cpanel/ea-php84/root/usr/bin/php /home/devcente/projects/proerp/backend/artisan queue:work --stop-when-empty --max-time=55 >> /home/devcente/logs/proerp-queue.log 2>&1
#   Task scheduler(every min): * * * * * /opt/cpanel/ea-php84/root/usr/bin/php /home/devcente/projects/proerp/backend/artisan schedule:run >> /home/devcente/logs/proerp-schedule.log 2>&1
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Path Resolution
# Priority: projects/proerp/ (correct multi-project layout)
#           → /home/devcente/backend (legacy single-project fallback)
#           → repo-relative (local dev fallback)
# ------------------------------------------------------------------------------
CPANEL_USER="${CPANEL_USER:-devcente}"
HOME_DIR="${HOME:-/home/${CPANEL_USER}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Backend: prefer projects/proerp/backend (canonical multi-project path)
if [ -d "${HOME_DIR}/projects/proerp/backend" ]; then
    BACKEND_DIR="${HOME_DIR}/projects/proerp/backend"
elif [ -d "${HOME_DIR}/backend" ]; then
    # Legacy single-project layout — still works but deprecated
    BACKEND_DIR="${HOME_DIR}/backend"
    echo "WARNING: Using legacy /home/devcente/backend path. Migrate to /home/devcente/projects/proerp/backend."
else
    BACKEND_DIR="${REPO_DIR}/backend"
fi

# Document root for ProERP SPA + API: prefer projects/proerp/public
if [ -d "${HOME_DIR}/projects/proerp/public" ]; then
    PUBLIC_HTML_DIR="${HOME_DIR}/projects/proerp/public"
elif [ -d "${HOME_DIR}/public_html" ]; then
    # Legacy fallback — but note public_html is now reserved for the portfolio
    PUBLIC_HTML_DIR="${HOME_DIR}/public_html"
    echo "WARNING: Using legacy /home/devcente/public_html as ProERP document root."
    echo "         This conflicts with the portfolio at devcenterpoint.com."
    echo "         Migrate ProERP to /home/devcente/projects/proerp/public."
else
    PUBLIC_HTML_DIR="${REPO_DIR}/public_html"
fi

# Frontend source (pre-built dist is uploaded manually; repo dist is fallback)
if [ -d "${REPO_DIR}/frontend" ]; then
    FRONTEND_DIR="${REPO_DIR}/frontend"
elif [ -d "${HOME_DIR}/frontend" ]; then
    FRONTEND_DIR="${HOME_DIR}/frontend"
else
    FRONTEND_DIR="${BACKEND_DIR}/frontend"
fi

# Centralized log directory
LOG_DIR="${HOME_DIR}/logs"
mkdir -p "${LOG_DIR}"

echo "=================================================================="
echo " Starting ProERP Deployment: $(date '+%Y-%m-%d %H:%M:%S')"
echo " Backend Directory:      ${BACKEND_DIR}"
echo " ProERP Document Root:   ${PUBLIC_HTML_DIR}"
echo " Frontend Source:        ${FRONTEND_DIR}"
echo " Log Directory:          ${LOG_DIR}"
echo "=================================================================="


# ------------------------------------------------------------------------------
# 1. PHP CLI Binary Resolution (MultiPHP 8.4 Support)
# ------------------------------------------------------------------------------
if [ -x "/opt/cpanel/ea-php84/root/usr/bin/php" ]; then
    PHP_BIN="/opt/cpanel/ea-php84/root/usr/bin/php"
elif command -v php &> /dev/null; then
    PHP_BIN="$(command -v php)"
elif [ -x "/usr/local/bin/php" ]; then
    PHP_BIN="/usr/local/bin/php"
else
    echo "ERROR: PHP CLI binary not found. Please ensure PHP 8.4 is selected in cPanel MultiPHP Manager."
    exit 1
fi
echo "Using PHP: $(${PHP_BIN} -v | head -n 1)"

# ------------------------------------------------------------------------------
# 2. Storage & Cache Directory Scaffolding & Permissions
# ------------------------------------------------------------------------------
echo "--- Ensuring Storage & Cache Directories Exist ---"
mkdir -p "${BACKEND_DIR}/storage/app/public"
mkdir -p "${BACKEND_DIR}/storage/framework/cache/data"
mkdir -p "${BACKEND_DIR}/storage/framework/sessions"
mkdir -p "${BACKEND_DIR}/storage/framework/views"
mkdir -p "${BACKEND_DIR}/storage/framework/testing"
mkdir -p "${BACKEND_DIR}/storage/logs"
mkdir -p "${BACKEND_DIR}/bootstrap/cache"

chmod -R 775 "${BACKEND_DIR}/storage" "${BACKEND_DIR}/bootstrap/cache" 2>/dev/null || true

# ------------------------------------------------------------------------------
# 3. Backend Dependencies (Composer)
# ------------------------------------------------------------------------------
echo "--- Installing Backend Dependencies (Composer) ---"
cd "${BACKEND_DIR}"

COMPOSER_BIN=""
if command -v composer &> /dev/null; then
    COMPOSER_BIN="$(command -v composer)"
elif [ -x "/opt/cpanel/composer/bin/composer" ]; then
    COMPOSER_BIN="${PHP_BIN} /opt/cpanel/composer/bin/composer"
elif [ -x "/usr/local/bin/composer" ]; then
    COMPOSER_BIN="/usr/local/bin/composer"
elif [ -x "/usr/bin/composer" ]; then
    COMPOSER_BIN="/usr/bin/composer"
elif [ -f "${BACKEND_DIR}/composer.phar" ]; then
    COMPOSER_BIN="${PHP_BIN} ${BACKEND_DIR}/composer.phar"
elif [ -f "${HOME_DIR}/composer.phar" ]; then
    COMPOSER_BIN="${PHP_BIN} ${HOME_DIR}/composer.phar"
fi

# If composer binary is not found and vendor is missing, attempt to download composer.phar
if [ -z "${COMPOSER_BIN}" ] && [ ! -f "${BACKEND_DIR}/vendor/autoload.php" ]; then
    echo "Composer not found in standard paths. Attempting to download composer.phar..."
    ${PHP_BIN} -r "copy('https://getcomposer.org/installer', 'composer-setup.php');" 2>/dev/null || true
    if [ -f "composer-setup.php" ]; then
        ${PHP_BIN} composer-setup.php --quiet 2>/dev/null || true
        rm -f composer-setup.php
        if [ -f "${BACKEND_DIR}/composer.phar" ]; then
            COMPOSER_BIN="${PHP_BIN} ${BACKEND_DIR}/composer.phar"
        fi
    fi
fi

if [ -n "${COMPOSER_BIN}" ]; then
    echo "Using Composer: ${COMPOSER_BIN}"
    ${COMPOSER_BIN} install --no-dev --prefer-dist --optimize-autoloader --no-interaction || {
        echo "WARNING: Composer install encountered an error. Continuing if vendor/autoload.php exists..."
    }
else
    echo "Notice: Composer not available."
fi

# ------------------------------------------------------------------------------
# 4. Storage Symlink
# ------------------------------------------------------------------------------
echo "--- Linking Public Storage ---"
if [ ! -L "${PUBLIC_HTML_DIR}/storage" ] && [ ! -e "${PUBLIC_HTML_DIR}/storage" ]; then
    ln -s "${BACKEND_DIR}/storage/app/public" "${PUBLIC_HTML_DIR}/storage" || true
    echo "Symlinked ${BACKEND_DIR}/storage/app/public to ${PUBLIC_HTML_DIR}/storage"
fi

# ------------------------------------------------------------------------------
# 5. Artisan Pre-flight Validation & Migrations
# ------------------------------------------------------------------------------
CAN_RUN_ARTISAN=true
if [ ! -f "${BACKEND_DIR}/vendor/autoload.php" ]; then
    echo "=================================================================="
    echo " NOTICE: ${BACKEND_DIR}/vendor/autoload.php not found."
    echo " Laravel commands cannot run without Composer vendor dependencies."
    echo " Action Required:"
    echo "   Option A: Run composer install in /home/devcente/backend via cPanel Terminal"
    echo "   Option B: Upload your local 'backend/vendor' folder to '/home/devcente/backend/vendor'"
    echo " Skipping artisan migrations and cache rebuild to prevent deployment crash."
    echo "=================================================================="
    CAN_RUN_ARTISAN=false
fi

CAN_RUN_MIGRATIONS=true
if [ ! -f "${BACKEND_DIR}/.env" ]; then
    echo "=================================================================="
    echo " NOTICE: ${BACKEND_DIR}/.env not found."
    echo " Action Required:"
    echo "   Copy .env.production.example to .env in /home/devcente/backend"
    echo "   and configure your database credentials (DB_DATABASE, DB_USERNAME, DB_PASSWORD)."
    echo " Skipping migrations and config cache until .env is created."
    echo "=================================================================="
    CAN_RUN_MIGRATIONS=false
fi

if [ "${CAN_RUN_ARTISAN}" = "true" ]; then
    ${PHP_BIN} artisan storage:link 2>/dev/null || true

    if [ "${CAN_RUN_MIGRATIONS}" = "true" ]; then
        echo "--- Running Database Migrations ---"
        ${PHP_BIN} -d display_errors=1 artisan migrate --force --no-interaction

        echo "--- Ensuring Database Seeded (Platform Super Admin & SliceMart Flagship Tenant) ---"
        ${PHP_BIN} -d display_errors=1 artisan db:seed --force --no-interaction

        echo "--- Rebuilding Production Caches ---"
        ${PHP_BIN} artisan config:clear
        ${PHP_BIN} artisan config:cache
        ${PHP_BIN} artisan route:cache
        ${PHP_BIN} artisan view:cache
        ${PHP_BIN} artisan event:cache
        echo "--- Restarting Queue Workers ---"
        ${PHP_BIN} artisan queue:restart 2>/dev/null || true
    else
        echo "--- Skipping Migrations, Config Cache & Queue Restart (.env is pending) ---"
    fi
else
    echo "--- Skipping Artisan Commands (vendor/autoload.php is pending) ---"
fi

# ------------------------------------------------------------------------------
# 7. Frontend SPA — Note on Manual Upload
# ------------------------------------------------------------------------------
# The frontend dist/ is gitignored and is NOT built by this script on the cPanel
# server (no Node.js available via Git VC).
#
# Workflow:
#   1. On your LOCAL machine: cd frontend && npm run build
#   2. Upload the contents of frontend/dist/ to:
#      /home/devcente/projects/proerp/public/
#      (via FTP/FileZilla or cPanel File Manager)
#
# The script below will sync any pre-built dist if it is present in the repo,
# which covers the local dev / manual trigger case.
if [ -d "${REPO_DIR}/frontend/dist" ] && [ "$(ls -A ${REPO_DIR}/frontend/dist)" ]; then
    echo "--- Syncing pre-built frontend dist to ProERP document root ---"
    cp -r "${REPO_DIR}/frontend/dist/"* "${PUBLIC_HTML_DIR}/"
    echo "Synced frontend/dist to ${PUBLIC_HTML_DIR}/"
else
    echo "Notice: No pre-built frontend/dist found in repo. Upload frontend/dist/ contents manually."
fi

# ------------------------------------------------------------------------------
# 8. Ensure ProERP document root has the PHP bootstrap and .htaccess
# ------------------------------------------------------------------------------
echo "--- Ensuring ProERP entry point files are in place ---"
# Copy index.php (always overwrite to pick up changes)
if [ -f "${REPO_DIR}/public_html/index.php" ]; then
    cp "${REPO_DIR}/public_html/index.php" "${PUBLIC_HTML_DIR}/index.php"
    echo "Deployed: ${PUBLIC_HTML_DIR}/index.php"
fi
# Copy .htaccess (always overwrite to pick up changes)
if [ -f "${REPO_DIR}/public_html/.htaccess" ]; then
    cp "${REPO_DIR}/public_html/.htaccess" "${PUBLIC_HTML_DIR}/.htaccess"
    echo "Deployed: ${PUBLIC_HTML_DIR}/.htaccess"
fi

# ------------------------------------------------------------------------------
# 9. Bootstrap portfolio at devcenterpoint.com (public_html)
PORTFOLIO_DIR="${HOME_DIR}/public_html"
mkdir -p "${PORTFOLIO_DIR}"

# Install portfolio .htaccess (always keep updated to preserve subdomain routing rules)
if [ -f "${REPO_DIR}/portfolio_public_html/.htaccess" ]; then
    cp "${REPO_DIR}/portfolio_public_html/.htaccess" "${PORTFOLIO_DIR}/.htaccess"
    echo "Installed portfolio .htaccess to ${PORTFOLIO_DIR}/.htaccess"
fi

# Install portfolio index.html
if [ -f "${REPO_DIR}/portfolio_public_html/index.html" ]; then
    cp "${REPO_DIR}/portfolio_public_html/index.html" "${PORTFOLIO_DIR}/index.html"
    echo "Installed portfolio index.html to ${PORTFOLIO_DIR}/index.html"
elif [ -f "${REPO_DIR}/scripts/portfolio-placeholder.html" ]; then
    cp "${REPO_DIR}/scripts/portfolio-placeholder.html" "${PORTFOLIO_DIR}/index.html"
    echo "Installed portfolio placeholder to ${PORTFOLIO_DIR}/index.html"
fi

# Create proerp-app symlink in public_html as fail-safe for subdomains
if [ -d "${PUBLIC_HTML_DIR}" ] && [ "${PUBLIC_HTML_DIR}" != "${PORTFOLIO_DIR}" ]; then
    ln -sfn "${PUBLIC_HTML_DIR}" "${PORTFOLIO_DIR}/proerp-app" 2>/dev/null || true
    echo "Created proerp-app routing symlink in ${PORTFOLIO_DIR}/"
fi

# Ensure portfolio root has NO index.php (so subdomain requests pass via .htaccess to proerp-app)
if [ -f "${PORTFOLIO_DIR}/index.php" ]; then
    rm -f "${PORTFOLIO_DIR}/index.php"
    echo "Removed legacy/shadow index.php from ${PORTFOLIO_DIR}/"
fi

echo "=================================================================="
echo " ProERP Deployment Completed Successfully: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo " Next steps (if first deploy):"
echo "   1. Upload frontend/dist/ contents to: ${PUBLIC_HTML_DIR}/"
echo "      (run: npm run build  in the frontend/ directory locally)"
echo "   2. Verify: curl https://proerp.devcenterpoint.com/up"
echo "   3. Verify: curl https://devcenterpoint.com"
echo "=================================================================="
