#!/usr/bin/env bash
# ==============================================================================
# DevCenterPoint ProERP — cPanel / Shared Hosting Automated Deployment Script
# ==============================================================================
# Usage:
#   bash scripts/deploy-cpanel.sh
# Or trigger via cPanel Git Version Control post-receive hook.
# ==============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"

echo "=================================================================="
echo " Starting ProERP Deployment: $(date '+%Y-%m-%d %H:%M:%S')"
echo " Working directory: ${PROJECT_ROOT}"
echo "=================================================================="

# 1. Check PHP CLI availability
PHP_BIN="$(which php || echo "/usr/local/bin/php")"
if [ ! -x "${PHP_BIN}" ]; then
    echo "ERROR: PHP CLI binary not found at ${PHP_BIN}. Please set PHP_BIN manually."
    exit 1
fi
echo "Using PHP: $(${PHP_BIN} -v | head -n 1)"

# 2. Deploy Backend Dependencies
echo "--- Installing Backend Dependencies (Composer) ---"
cd "${BACKEND_DIR}"

if command -v composer &> /dev/null; then
    composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction
elif [ -f "composer.phar" ]; then
    ${PHP_BIN} composer.phar install --no-dev --prefer-dist --optimize-autoloader --no-interaction
else
    echo "Notice: Composer not found in PATH or directory. Assuming vendor is pre-installed or updated via Git."
fi

# 3. Environment & Migrations
echo "--- Running Database Migrations ---"
${PHP_BIN} artisan migrate --force --no-interaction

# 4. Optimization & Cache Rebuild
echo "--- Rebuilding Production Caches ---"
${PHP_BIN} artisan config:clear
${PHP_BIN} artisan config:cache
${PHP_BIN} artisan route:cache
${PHP_BIN} artisan view:cache

# 5. Build and Sync Frontend Assets
if [ -d "${FRONTEND_DIR}" ] && command -v npm &> /dev/null; then
    echo "--- Building Frontend SPA ---"
    cd "${FRONTEND_DIR}"
    npm ci --prefer-offline --no-audit || npm install --no-audit
    npm run build

    echo "--- Syncing SPA build to public directory ---"
    if [ -d "${FRONTEND_DIR}/dist" ]; then
        cp -r "${FRONTEND_DIR}/dist/"* "${BACKEND_DIR}/public/"
        echo "Copied frontend dist to backend/public/"
    fi
else
    echo "Notice: npm not found or frontend directory skipped. Ensure dist is built prior to deployment."
fi

# 6. Restart Queue Worker
echo "--- Restarting Queue Workers ---"
cd "${BACKEND_DIR}"
${PHP_BIN} artisan queue:restart || true

echo "=================================================================="
echo " ProERP Deployment Completed Successfully: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=================================================================="
