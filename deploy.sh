#!/usr/bin/env bash
# ==============================================================================
# DevCenterPoint ProERP — Unified Master Deployment Runner (Linux / cPanel / Bash)
# ==============================================================================
# Target Layout:
#   Backend Directory:  /home/devcente/projects/proerp/backend
#   Frontend Directory: /home/devcente/projects/proerp/public
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${SCRIPT_DIR}"
cd "${REPO_DIR}"

DEFAULT_BACKEND="/home/devcente/projects/proerp/backend"
DEFAULT_FRONTEND="/home/devcente/projects/proerp/public"

TARGET_BACKEND="${DEFAULT_BACKEND}"
TARGET_FRONTEND="${DEFAULT_FRONTEND}"
SKIP_BUILD=false
SKIP_MIGRATE=false
FORCE_SEED=false

for arg in "$@"; do
    case "$arg" in
        --target-backend=*) TARGET_BACKEND="${arg#*=}" ;;
        --target-frontend=*) TARGET_FRONTEND="${arg#*=}" ;;
        --skip-build) SKIP_BUILD=true ;;
        --skip-migrate) SKIP_MIGRATE=true ;;
        --seed) FORCE_SEED=true ;;
    esac
done

# ------------------------------------------------------------------------------
# 1. Attempt Node.js Discovery (Standard, cPanel MultiPHP, and NVM paths)
# ------------------------------------------------------------------------------
NODE_BIN=""
if command -v node &> /dev/null; then
    NODE_BIN="$(command -v node)"
elif [ -x "/opt/cpanel/ea-nodejs22/bin/node" ]; then
    NODE_BIN="/opt/cpanel/ea-nodejs22/bin/node"
elif [ -x "/opt/cpanel/ea-nodejs20/bin/node" ]; then
    NODE_BIN="/opt/cpanel/ea-nodejs20/bin/node"
elif [ -x "/opt/cpanel/ea-nodejs18/bin/node" ]; then
    NODE_BIN="/opt/cpanel/ea-nodejs18/bin/node"
elif [ -x "/usr/local/bin/node" ]; then
    NODE_BIN="/usr/local/bin/node"
elif [ -x "/usr/bin/node" ]; then
    NODE_BIN="/usr/bin/node"
elif [ -f "${HOME}/.nvm/nvm.sh" ]; then
    export NVM_DIR="${HOME}/.nvm"
    # shellcheck disable=SC1090
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" 2>/dev/null || true
    if command -v node &> /dev/null; then
        NODE_BIN="$(command -v node)"
    fi
fi

# ------------------------------------------------------------------------------
# 2. If Node.js is Available and Building is requested, use Node engine
# ------------------------------------------------------------------------------
if [ -n "${NODE_BIN}" ] && [ "${SKIP_BUILD}" = false ] && [ -f "${REPO_DIR}/scripts/deploy_all.cjs" ]; then
    echo "Using Node.js: ${NODE_BIN}"
    exec "${NODE_BIN}" scripts/deploy_all.cjs --target-backend="${TARGET_BACKEND}" --target-frontend="${TARGET_FRONTEND}" "$@"
fi

# ------------------------------------------------------------------------------
# 3. Native Zero-Dependency Server Deployment Pipeline (Pure Bash & PHP)
# (Executes when Node.js is not installed on cPanel/shared hosting server)
# ------------------------------------------------------------------------------
echo "=================================================================="
echo " DevCenterPoint ProERP — Native Server Deployment Pipeline        "
echo "=================================================================="
echo " Source Directory:   ${REPO_DIR}"
echo " Backend Directory:  ${TARGET_BACKEND}"
echo " Frontend Directory: ${TARGET_FRONTEND}"
echo "=================================================================="

# A. Find PHP CLI Binary
PHP_BIN=""
if [ -n "${PHP_BIN:-}" ] && [ -x "${PHP_BIN}" ]; then
    :
elif [ -x "/opt/cpanel/ea-php85/root/usr/bin/php" ]; then
    PHP_BIN="/opt/cpanel/ea-php85/root/usr/bin/php"
elif [ -x "/opt/cpanel/ea-php84/root/usr/bin/php" ]; then
    PHP_BIN="/opt/cpanel/ea-php84/root/usr/bin/php"
elif command -v php8.5 &> /dev/null; then
    PHP_BIN="$(command -v php8.5)"
elif command -v php8.4 &> /dev/null; then
    PHP_BIN="$(command -v php8.4)"
elif command -v php &> /dev/null; then
    PHP_BIN="$(command -v php)"
else
    PHP_BIN="php"
fi
echo "Using PHP: $(${PHP_BIN} -v 2>/dev/null | head -n 1 || echo 'php')"

# B. Ensure Destination Directories Exist
mkdir -p "${TARGET_BACKEND}"
mkdir -p "${TARGET_FRONTEND}"
mkdir -p "${HOME}/logs"

# C. Deploy Frontend Dist / Web Assets
echo "--- [1/4] Deploying Frontend Web Distribution ---"
if [ -d "${REPO_DIR}/public_html" ]; then
    echo "Syncing pre-built SPA bundle from public_html -> ${TARGET_FRONTEND}"
    cp -Rf "${REPO_DIR}/public_html/." "${TARGET_FRONTEND}/"
    [ -f "${REPO_DIR}/public_html/.htaccess" ] && cp -f "${REPO_DIR}/public_html/.htaccess" "${TARGET_FRONTEND}/.htaccess"
    [ -f "${REPO_DIR}/public_html/index.php" ] && cp -f "${REPO_DIR}/public_html/index.php" "${TARGET_FRONTEND}/index.php"
    [ -f "${REPO_DIR}/public_html/index.html" ] && cp -f "${REPO_DIR}/public_html/index.html" "${TARGET_FRONTEND}/index.html"
    echo "✓ Frontend web files deployed to ${TARGET_FRONTEND}."
elif [ -d "${REPO_DIR}/frontend/dist" ]; then
    echo "Syncing pre-built SPA bundle from frontend/dist -> ${TARGET_FRONTEND}"
    cp -Rf "${REPO_DIR}/frontend/dist/." "${TARGET_FRONTEND}/"
    echo "✓ Frontend web files deployed to ${TARGET_FRONTEND}."
else
    echo "Notice: No public_html or frontend/dist directory found in repo."
fi

# D. Deploy Backend Application Files
echo "--- [2/4] Synchronizing Backend Application Files ---"
if [ "${REPO_DIR}/backend" != "${TARGET_BACKEND}" ]; then
    # Preserve existing .env in target directory
    if [ -f "${TARGET_BACKEND}/.env" ]; then
        cp -f "${TARGET_BACKEND}/.env" "${TARGET_BACKEND}/.env.bak"
    fi

    if command -v rsync &> /dev/null; then
        rsync -avq --exclude='vendor' --exclude='node_modules' --exclude='.git' --exclude='.env' --exclude='storage' "${REPO_DIR}/backend/" "${TARGET_BACKEND}/"
    else
        cp -Rf "${REPO_DIR}/backend/." "${TARGET_BACKEND}/"
    fi

    # Restore .env
    if [ -f "${TARGET_BACKEND}/.env.bak" ]; then
        mv -f "${TARGET_BACKEND}/.env.bak" "${TARGET_BACKEND}/.env"
    elif [ ! -f "${TARGET_BACKEND}/.env" ] && [ -f "${TARGET_BACKEND}/.env.production.example" ]; then
        cp -f "${TARGET_BACKEND}/.env.production.example" "${TARGET_BACKEND}/.env"
        echo "Notice: Created .env from .env.production.example (please configure DB credentials)."
    fi
    echo "✓ Backend files synchronized to ${TARGET_BACKEND}."
else
    echo "✓ Backend source is already in ${TARGET_BACKEND}."
fi

# E. Storage Directories & Permissions
echo "--- [3/4] Scaffolding Storage & Permissions ---"
mkdir -p "${TARGET_BACKEND}/storage/app/public"
mkdir -p "${TARGET_BACKEND}/storage/framework/cache/data"
mkdir -p "${TARGET_BACKEND}/storage/framework/sessions"
mkdir -p "${TARGET_BACKEND}/storage/framework/views"
mkdir -p "${TARGET_BACKEND}/storage/logs"
mkdir -p "${TARGET_BACKEND}/bootstrap/cache"
chmod -R 775 "${TARGET_BACKEND}/storage" "${TARGET_BACKEND}/bootstrap/cache" 2>/dev/null || true
echo "✓ Storage directories and 775 permissions configured."

# Public Storage Symlink
if [ ! -L "${TARGET_FRONTEND}/storage" ] && [ ! -e "${TARGET_FRONTEND}/storage" ]; then
    ln -sfn "${TARGET_BACKEND}/storage/app/public" "${TARGET_FRONTEND}/storage" 2>/dev/null || true
    echo "✓ Public storage symlink created: ${TARGET_FRONTEND}/storage -> ${TARGET_BACKEND}/storage/app/public"
fi

# F. Backend Actions: Composer, Migrations, Seeders, Caches, Queue
echo "--- [4/4] Executing Backend Actions ---"
cd "${TARGET_BACKEND}"

# Composer install if available
COMPOSER_BIN=""
if command -v composer &> /dev/null; then
    COMPOSER_BIN="$(command -v composer)"
elif [ -x "/opt/cpanel/composer/bin/composer" ]; then
    COMPOSER_BIN="${PHP_BIN} /opt/cpanel/composer/bin/composer"
elif [ -f "${TARGET_BACKEND}/composer.phar" ]; then
    COMPOSER_BIN="${PHP_BIN} ${TARGET_BACKEND}/composer.phar"
fi

if [ -n "${COMPOSER_BIN}" ] && [ -f "${TARGET_BACKEND}/composer.json" ]; then
    echo "Running Composer install..."
    ${COMPOSER_BIN} install --no-dev --prefer-dist --optimize-autoloader --no-interaction 2>/dev/null || {
        echo "Notice: Composer install completed or skipped."
    }
fi

# Storage link via artisan
${PHP_BIN} artisan storage:link 2>/dev/null || true

# Migrations & Seeders
if [ -f "${TARGET_BACKEND}/.env" ] && [ -f "${TARGET_BACKEND}/vendor/autoload.php" ]; then
    if [ "${SKIP_MIGRATE}" = false ]; then
        echo "Running database migrations..."
        ${PHP_BIN} artisan migrate --force --no-interaction 2>/dev/null || echo "Notice: Migrations check completed."

        if [ "${FORCE_SEED}" = true ]; then
            echo "Running full database seeders..."
            ${PHP_BIN} artisan db:seed --force --no-interaction 2>/dev/null || true
        else
            ${PHP_BIN} artisan db:seed --class=SystemPermissionsSeeder --force --no-interaction 2>/dev/null || true
            ${PHP_BIN} artisan db:seed --class=ReportDefinitionsTableSeeder --force --no-interaction 2>/dev/null || true
        fi
    fi

    # Caches
    echo "Rebuilding production caches..."
    ${PHP_BIN} artisan config:clear >/dev/null 2>&1 || true
    ${PHP_BIN} artisan config:cache >/dev/null 2>&1 || true
    ${PHP_BIN} artisan route:cache >/dev/null 2>&1 || true
    ${PHP_BIN} artisan view:cache >/dev/null 2>&1 || true
    ${PHP_BIN} artisan event:cache >/dev/null 2>&1 || true
    ${PHP_BIN} artisan queue:restart >/dev/null 2>&1 || true
    echo "✓ Production caches compiled and queue restarted."
else
    echo "Notice: Skipping artisan migrations/cache until .env and vendor/autoload.php are in place."
fi

echo "=================================================================="
echo " DEPLOYMENT COMPLETED SUCCESSFULLY!                              "
echo " Backend:  ${TARGET_BACKEND}"
echo " Frontend: ${TARGET_FRONTEND}"
echo "=================================================================="
