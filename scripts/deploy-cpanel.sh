#!/usr/bin/env bash
# ==============================================================================
# DevCenterPoint ProERP — cPanel / Shared Hosting Automated Deployment Script
# ==============================================================================
# Usage:
#   bash scripts/deploy-cpanel.sh
# Or trigger automatically via .cpanel.yml Git Version Control deployment hook.
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Path Resolution (cPanel /devcente defaults with local/custom fallback)
# ------------------------------------------------------------------------------
CPANEL_USER="${CPANEL_USER:-devcente}"
HOME_DIR="${HOME:-/home/${CPANEL_USER}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# If deployed in /home/devcente/backend, use that; otherwise fallback to repo/backend
if [ -d "${HOME_DIR}/backend" ]; then
    BACKEND_DIR="${HOME_DIR}/backend"
else
    BACKEND_DIR="${REPO_DIR}/backend"
fi

# Web document root
if [ -d "${HOME_DIR}/public_html" ]; then
    PUBLIC_HTML_DIR="${HOME_DIR}/public_html"
else
    PUBLIC_HTML_DIR="${REPO_DIR}/public_html"
fi

# Frontend source
if [ -d "${REPO_DIR}/frontend" ]; then
    FRONTEND_DIR="${REPO_DIR}/frontend"
elif [ -d "${HOME_DIR}/frontend" ]; then
    FRONTEND_DIR="${HOME_DIR}/frontend"
else
    FRONTEND_DIR="${BACKEND_DIR}/frontend"
fi

echo "=================================================================="
echo " Starting ProERP Deployment: $(date '+%Y-%m-%d %H:%M:%S')"
echo " Backend Directory:     ${BACKEND_DIR}"
echo " Public HTML Directory: ${PUBLIC_HTML_DIR}"
echo " Frontend Directory:    ${FRONTEND_DIR}"
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

if command -v composer &> /dev/null; then
    composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction
elif [ -f "composer.phar" ]; then
    ${PHP_BIN} composer.phar install --no-dev --prefer-dist --optimize-autoloader --no-interaction
else
    echo "Notice: Composer not found in PATH or local directory. Skipping composer install."
fi

# ------------------------------------------------------------------------------
# 4. Storage Symlink
# ------------------------------------------------------------------------------
echo "--- Linking Public Storage ---"
if [ ! -L "${PUBLIC_HTML_DIR}/storage" ] && [ ! -e "${PUBLIC_HTML_DIR}/storage" ]; then
    ln -s "${BACKEND_DIR}/storage/app/public" "${PUBLIC_HTML_DIR}/storage" || true
    echo "Symlinked ${BACKEND_DIR}/storage/app/public to ${PUBLIC_HTML_DIR}/storage"
fi
${PHP_BIN} artisan storage:link 2>/dev/null || true

# ------------------------------------------------------------------------------
# 5. Database Migrations
# ------------------------------------------------------------------------------
echo "--- Running Database Migrations ---"
${PHP_BIN} artisan migrate --force --no-interaction

# ------------------------------------------------------------------------------
# 6. Production Cache Optimizations
# ------------------------------------------------------------------------------
echo "--- Rebuilding Production Caches ---"
${PHP_BIN} artisan config:clear
${PHP_BIN} artisan config:cache
${PHP_BIN} artisan route:cache
${PHP_BIN} artisan view:cache
${PHP_BIN} artisan event:cache

# ------------------------------------------------------------------------------
# 7. Frontend SPA Build & Asset Deployment
# ------------------------------------------------------------------------------
if [ -d "${FRONTEND_DIR}" ] && command -v npm &> /dev/null; then
    echo "--- Building Frontend SPA ---"
    cd "${FRONTEND_DIR}"
    npm ci --prefer-offline --no-audit || npm install --no-audit
    npm run build

    echo "--- Syncing SPA build to public_html ---"
    if [ -d "${FRONTEND_DIR}/dist" ]; then
        cp -r "${FRONTEND_DIR}/dist/"* "${PUBLIC_HTML_DIR}/"
        echo "Successfully deployed frontend dist to ${PUBLIC_HTML_DIR}/"
    fi
else
    echo "Notice: npm not available on server or frontend build skipped. Ensuring dist from repo or manual build is in place."
    if [ -d "${REPO_DIR}/frontend/dist" ]; then
        cp -r "${REPO_DIR}/frontend/dist/"* "${PUBLIC_HTML_DIR}/"
        echo "Copied pre-built frontend/dist to ${PUBLIC_HTML_DIR}/"
    fi
fi

# Ensure web root entry point & .htaccess exist in public_html
if [ -f "${REPO_DIR}/public_html/index.php" ] && [ ! -f "${PUBLIC_HTML_DIR}/index.php" ]; then
    cp "${REPO_DIR}/public_html/index.php" "${PUBLIC_HTML_DIR}/index.php"
fi
if [ -f "${REPO_DIR}/public_html/.htaccess" ] && [ ! -f "${PUBLIC_HTML_DIR}/.htaccess" ]; then
    cp "${REPO_DIR}/public_html/.htaccess" "${PUBLIC_HTML_DIR}/.htaccess"
fi

# ------------------------------------------------------------------------------
# 8. Restart Background Queue Workers
# ------------------------------------------------------------------------------
echo "--- Restarting Queue Workers ---"
cd "${BACKEND_DIR}"
${PHP_BIN} artisan queue:restart || true

echo "=================================================================="
echo " ProERP Deployment Completed Successfully: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=================================================================="
