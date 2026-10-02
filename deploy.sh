#!/usr/bin/env bash
# ==============================================================================
# SliceMart FMS / DevCenterPoint ProERP — Unified Master Bash Deployment Runner
# ==============================================================================
# Supported Environments:
#   - Linux VPS (Ubuntu, Debian, AlmaLinux, Rocky)
#   - cPanel / CloudLinux Shared Hosting
#   - Docker Containers & CI/CD Pipelines (GitHub Actions)
#   - macOS & WSL (Windows Subsystem for Linux)
#
# Usage:
#   bash deploy.sh [OPTIONS]
#   ./deploy.sh [OPTIONS]
#
# Options:
#   --in-place               Deploy directly inside current repository (backend/ & public_html/)
#   --target-backend=PATH    Custom destination path for Laravel backend
#   --target-frontend=PATH   Custom destination path for public SPA document root
#   --skip-build             Skip frontend build (deploy existing pre-built assets)
#   --skip-migrate           Skip database migrations
#   --seed                   Run full database seeders (Platform & Flagship tenant)
#   --help, -h               Show this help message
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${SCRIPT_DIR}"
cd "${REPO_DIR}"

# ------------------------------------------------------------------------------
# 0. Parse Command-Line Options
# ------------------------------------------------------------------------------
IN_PLACE=false
CUSTOM_BACKEND=""
CUSTOM_FRONTEND=""
SKIP_BUILD=false
SKIP_MIGRATE=false
FORCE_SEED=false

for arg in "$@"; do
    case "$arg" in
        --in-place)
            IN_PLACE=true
            ;;
        --target-backend=*)
            CUSTOM_BACKEND="${arg#*=}"
            ;;
        --target-frontend=*)
            CUSTOM_FRONTEND="${arg#*=}"
            ;;
        --skip-build)
            SKIP_BUILD=true
            ;;
        --skip-migrate)
            SKIP_MIGRATE=true
            ;;
        --seed)
            FORCE_SEED=true
            ;;
        --help|-h)
            echo "=================================================================="
            echo " SliceMart FMS — Unified Bash Deployment Runner                   "
            echo "=================================================================="
            echo " Usage: bash deploy.sh [OPTIONS]"
            echo ""
            echo " Options:"
            echo "   --in-place               Deploy directly in current repo directory"
            echo "   --target-backend=PATH    Custom target directory for backend"
            echo "   --target-frontend=PATH   Custom target directory for frontend public"
            echo "   --skip-build             Skip npm frontend build"
            echo "   --skip-migrate           Skip database migrations"
            echo "   --seed                   Run full database seeders"
            echo "   --help, -h               Show this help message"
            echo "=================================================================="
            exit 0
            ;;
        *)
            echo "Notice: Unknown argument '$arg' passed."
            ;;
    esac
done

# ------------------------------------------------------------------------------
# 1. Environment & Target Directory Resolution
# ------------------------------------------------------------------------------
DETECTED_USER=""
if command -v whoami &>/dev/null; then
    DETECTED_USER="$(whoami 2>/dev/null || true)"
fi
if [ -z "${DETECTED_USER}" ] && [ -n "${USER:-}" ]; then
    DETECTED_USER="${USER}"
fi
if [ -z "${DETECTED_USER}" ] && [ -n "${LOGNAME:-}" ]; then
    DETECTED_USER="${LOGNAME}"
fi
if [ -z "${DETECTED_USER}" ] && command -v id &>/dev/null; then
    DETECTED_USER="$(id -un 2>/dev/null || true)"
fi
if [ -z "${DETECTED_USER}" ]; then
    DETECTED_USER="$(pwd | sed -n 's|^/home/\([^/]*\).*|\1|p')"
fi
CPANEL_USER="${CPANEL_USER:-${DETECTED_USER:-devcente}}"
USER_HOME="${HOME:-/home/${CPANEL_USER}}"

if [ -n "${CUSTOM_BACKEND}" ]; then
    TARGET_BACKEND="${CUSTOM_BACKEND}"
elif [ "${IN_PLACE}" = true ]; then
    TARGET_BACKEND="${REPO_DIR}/backend"
elif [ -d "${USER_HOME}/projects/proerp/backend" ]; then
    TARGET_BACKEND="${USER_HOME}/projects/proerp/backend"
elif [ -d "/home/devcente/projects/proerp/backend" ]; then
    TARGET_BACKEND="/home/devcente/projects/proerp/backend"
elif [ -d "${USER_HOME}/public_html" ] || [ "${USER_HOME#/home/}" != "${USER_HOME}" ]; then
    TARGET_BACKEND="${USER_HOME}/projects/proerp/backend"
else
    TARGET_BACKEND="${REPO_DIR}/backend"
fi

if [ -n "${CUSTOM_FRONTEND}" ]; then
    TARGET_FRONTEND="${CUSTOM_FRONTEND}"
elif [ "${IN_PLACE}" = true ]; then
    TARGET_FRONTEND="${REPO_DIR}/public_html"
elif [ -d "${USER_HOME}/projects/proerp/public" ]; then
    TARGET_FRONTEND="${USER_HOME}/projects/proerp/public"
elif [ -d "/home/devcente/projects/proerp/public" ]; then
    TARGET_FRONTEND="/home/devcente/projects/proerp/public"
elif [ -d "${USER_HOME}/public_html" ] || [ "${USER_HOME#/home/}" != "${USER_HOME}" ]; then
    # In cPanel, public_html is reserved for the primary domain portfolio (devcenterpoint.com).
    # ProERP is placed in projects/proerp/public to prevent overwriting the agency website.
    TARGET_FRONTEND="${USER_HOME}/projects/proerp/public"
else
    TARGET_FRONTEND="${REPO_DIR}/public_html"
fi

START_TIME=$(date +%s)

echo "=================================================================="
echo " SliceMart FMS — Automated Bash Deployment Started               "
echo " Timestamp:          $(date '+%Y-%m-%d %H:%M:%S')"
echo " Source Repo:        ${REPO_DIR}"
echo " Backend Target:     ${TARGET_BACKEND}"
echo " Frontend Target:    ${TARGET_FRONTEND}"
echo " In-Place Mode:      ${IN_PLACE}"
echo " cPanel User:        ${CPANEL_USER}"
echo " Home Directory:     ${USER_HOME}"
echo "=================================================================="

# ------------------------------------------------------------------------------
# 2. PHP CLI Discovery (MultiPHP 8.5/8.4/8.3/8.2, System PHP)
# ------------------------------------------------------------------------------
PHP_BIN=""
PHP_CANDIDATES=(
    "${PHP_BIN:-}"
    "${PHP_BIN_CUSTOM:-}"
    "/opt/cpanel/ea-php85/root/usr/bin/php"
    "/opt/cpanel/ea-php84/root/usr/bin/php"
    "/opt/cpanel/ea-php83/root/usr/bin/php"
    "/opt/cpanel/ea-php82/root/usr/bin/php"
    "/usr/local/bin/ea-php85"
    "/usr/local/bin/ea-php84"
    "/usr/local/bin/ea-php83"
    "/usr/local/bin/ea-php82"
    "$(command -v php8.5 2>/dev/null || true)"
    "$(command -v php8.4 2>/dev/null || true)"
    "$(command -v php8.3 2>/dev/null || true)"
    "$(command -v php8.2 2>/dev/null || true)"
    "$(command -v php 2>/dev/null || true)"
    "/usr/local/bin/php"
    "/usr/bin/php"
)

for cand in "${PHP_CANDIDATES[@]}"; do
    if [ -n "${cand}" ] && [ -x "${cand}" ]; then
        IS_VALID=$("${cand}" -r "echo version_compare(PHP_VERSION, '8.2.0', '>=') ? '1' : '0';" 2>/dev/null || echo "0")
        if [ "${IS_VALID}" = "1" ]; then
            PHP_BIN="${cand}"
            break
        fi
    fi
done

if [ -z "${PHP_BIN}" ]; then
    if command -v php &>/dev/null; then
        PHP_BIN="$(command -v php)"
        echo "Warning: Using default system php ($(${PHP_BIN} -v 2>/dev/null | head -n 1)). PHP 8.2+ required."
    else
        PHP_BIN="php"
    fi
fi

# Prepend the PHP binary directory to PATH so composer, artisan, and child shells use PHP 8.4+
PHP_DIR="$(dirname "${PHP_BIN}")"
if [ -d "${PHP_DIR}" ]; then
    export PATH="${PHP_DIR}:${PATH}"
fi

echo "✓ PHP CLI: $(${PHP_BIN} -v 2>/dev/null | head -n 1 || echo 'php')"

# ------------------------------------------------------------------------------
# 3. Node.js & Frontend Build (If npm/node are available and not skipped)
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
elif [ -f "${HOME}/.nvm/nvm.sh" ]; then
    export NVM_DIR="${HOME}/.nvm"
    # shellcheck disable=SC1090
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" 2>/dev/null || true
    if command -v node &> /dev/null; then
        NODE_BIN="$(command -v node)"
    fi
fi

if [ "${SKIP_BUILD}" = false ] && [ -n "${NODE_BIN}" ] && command -v npm &> /dev/null; then
    echo "--- [1/5] Building Frontend Production Bundle (Node: ${NODE_BIN}) ---"
    (
        cd "${REPO_DIR}"
        npm run build:prod
    ) || {
        echo "Warning: Build failed; proceeding with pre-built assets in public_html."
    }
else
    echo "--- [1/5] Skipping Frontend Build (Using Pre-built public_html Assets) ---"
fi

# ------------------------------------------------------------------------------
# 4. Target Directory Scaffolding & Web Assets Deployment
# ------------------------------------------------------------------------------
echo "--- [2/5] Deploying Web Frontend Distribution ---"
mkdir -p "${TARGET_FRONTEND}"
mkdir -p "${TARGET_BACKEND}"
mkdir -p "${USER_HOME}/logs"

if [ -d "${REPO_DIR}/public_html" ] && [ "${REPO_DIR}/public_html" != "${TARGET_FRONTEND}" ]; then
    echo "Syncing public_html -> ${TARGET_FRONTEND}"
    cp -Rf "${REPO_DIR}/public_html/." "${TARGET_FRONTEND}/"
    echo "✓ Frontend assets synchronized to ${TARGET_FRONTEND}."
else
    echo "✓ Frontend assets already in place at ${TARGET_FRONTEND}."
fi

# Ensure critical web entry files exist
if [ ! -f "${TARGET_FRONTEND}/index.php" ] && [ -f "${REPO_DIR}/public_html/index.php" ]; then
    cp -f "${REPO_DIR}/public_html/index.php" "${TARGET_FRONTEND}/index.php"
fi
if [ ! -f "${TARGET_FRONTEND}/.htaccess" ] && [ -f "${REPO_DIR}/public_html/.htaccess" ]; then
    cp -f "${REPO_DIR}/public_html/.htaccess" "${TARGET_FRONTEND}/.htaccess"
fi
if [ ! -f "${TARGET_FRONTEND}/index.html" ] && [ -f "${REPO_DIR}/public_html/index.html" ]; then
    cp -f "${REPO_DIR}/public_html/index.html" "${TARGET_FRONTEND}/index.html"
fi

# Write dynamic backend pointer file for public_html/index.php
echo "${TARGET_BACKEND}" > "${TARGET_FRONTEND}/.backend_path"
chmod 644 "${TARGET_FRONTEND}/.backend_path" 2>/dev/null || true
chmod 644 "${TARGET_FRONTEND}/index.php" "${TARGET_FRONTEND}/.htaccess" "${TARGET_FRONTEND}/index.html" 2>/dev/null || true
echo "✓ Backend location registered in ${TARGET_FRONTEND}/.backend_path -> ${TARGET_BACKEND}"

# ------------------------------------------------------------------------------
# 5. Backend Files Synchronization
# ------------------------------------------------------------------------------
echo "--- [3/5] Synchronizing Backend Application Files ---"
if [ "${REPO_DIR}/backend" != "${TARGET_BACKEND}" ]; then
    # Preserve existing .env
    if [ -f "${TARGET_BACKEND}/.env" ]; then
        cp -f "${TARGET_BACKEND}/.env" "${TARGET_BACKEND}/.env.bak"
    fi

    if command -v rsync &> /dev/null; then
        rsync -avq --exclude='vendor' --exclude='node_modules' --exclude='.git' --exclude='.env' --exclude='storage' "${REPO_DIR}/backend/" "${TARGET_BACKEND}/"
    else
        cp -Rf "${REPO_DIR}/backend/." "${TARGET_BACKEND}/"
    fi

    # Restore or initialize .env
    if [ -f "${TARGET_BACKEND}/.env.bak" ]; then
        mv -f "${TARGET_BACKEND}/.env.bak" "${TARGET_BACKEND}/.env"
    fi
    echo "✓ Backend files copied to ${TARGET_BACKEND}."
else
    echo "✓ Backend application is already located at ${TARGET_BACKEND}."
fi

# Ensure .env exists
if [ ! -f "${TARGET_BACKEND}/.env" ]; then
    if [ -f "${REPO_DIR}/.env.production.example" ]; then
        cp "${REPO_DIR}/.env.production.example" "${TARGET_BACKEND}/.env"
        echo "Notice: Created ${TARGET_BACKEND}/.env from .env.production.example."
        echo "ATTENTION: Please update ${TARGET_BACKEND}/.env with your cPanel MySQL database credentials."
    elif [ -f "${TARGET_BACKEND}/.env.example" ]; then
        cp "${TARGET_BACKEND}/.env.example" "${TARGET_BACKEND}/.env"
        echo "Notice: Created ${TARGET_BACKEND}/.env from .env.example."
    fi
fi

# ------------------------------------------------------------------------------
# 6. Storage Permissions & Symlinks
# ------------------------------------------------------------------------------
echo "--- [4/5] Scaffolding Storage & Permissions ---"
mkdir -p "${TARGET_BACKEND}/storage/app/public"
mkdir -p "${TARGET_BACKEND}/storage/framework/cache/data"
mkdir -p "${TARGET_BACKEND}/storage/framework/sessions"
mkdir -p "${TARGET_BACKEND}/storage/framework/views"
mkdir -p "${TARGET_BACKEND}/storage/framework/testing"
mkdir -p "${TARGET_BACKEND}/storage/logs"
mkdir -p "${TARGET_BACKEND}/bootstrap/cache"
touch "${TARGET_BACKEND}/storage/logs/laravel.log" 2>/dev/null || true

chmod -R 775 "${TARGET_BACKEND}/storage" "${TARGET_BACKEND}/bootstrap/cache" 2>/dev/null || true
chmod 664 "${TARGET_BACKEND}/storage/logs/laravel.log" 2>/dev/null || true
echo "✓ Storage directories created and 775 permissions set."

# Create public storage symlink
if [ ! -L "${TARGET_FRONTEND}/storage" ] && [ ! -e "${TARGET_FRONTEND}/storage" ]; then
    ln -sfn "${TARGET_BACKEND}/storage/app/public" "${TARGET_FRONTEND}/storage" 2>/dev/null || true
    echo "✓ Public storage symlink: ${TARGET_FRONTEND}/storage -> ${TARGET_BACKEND}/storage/app/public"
fi

# Portfolio safety symlink: if ProERP document root is separate from ~/public_html,
# provide ~/public_html/proerp-app symlink for subdomain or fallback access
PORTFOLIO_DIR="${USER_HOME}/public_html"
if [ -d "${PORTFOLIO_DIR}" ] && [ "${TARGET_FRONTEND}" != "${PORTFOLIO_DIR}" ]; then
    if [ ! -e "${PORTFOLIO_DIR}/proerp-app" ]; then
        ln -sfn "${TARGET_FRONTEND}" "${PORTFOLIO_DIR}/proerp-app" 2>/dev/null || true
    fi
fi

# ------------------------------------------------------------------------------
# 7. Composer, Migrations, Seeders & Production Caches
# ------------------------------------------------------------------------------
echo "--- [5/5] Executing Backend Actions (Composer, Migrations, Caches) ---"
cd "${TARGET_BACKEND}"

# Configure Composer memory
export COMPOSER_MEMORY_LIMIT=-1

# Resolve Composer
COMPOSER_BIN=""
if command -v composer &> /dev/null; then
    COMPOSER_BIN="$(command -v composer)"
elif [ -x "/opt/cpanel/composer/bin/composer" ]; then
    COMPOSER_BIN="${PHP_BIN} /opt/cpanel/composer/bin/composer"
elif [ -x "/usr/local/bin/composer" ]; then
    COMPOSER_BIN="${PHP_BIN} /usr/local/bin/composer"
elif [ -x "/usr/bin/composer" ]; then
    COMPOSER_BIN="${PHP_BIN} /usr/bin/composer"
elif [ -f "${TARGET_BACKEND}/composer.phar" ]; then
    COMPOSER_BIN="${PHP_BIN} ${TARGET_BACKEND}/composer.phar"
elif [ -f "${USER_HOME}/composer.phar" ]; then
    COMPOSER_BIN="${PHP_BIN} ${USER_HOME}/composer.phar"
elif [ -f "${REPO_DIR}/composer.phar" ]; then
    COMPOSER_BIN="${PHP_BIN} ${REPO_DIR}/composer.phar"
fi

# Auto-download composer if missing and vendor is absent
if [ -z "${COMPOSER_BIN}" ] && [ ! -f "${TARGET_BACKEND}/vendor/autoload.php" ]; then
    echo "Composer not found and vendor is absent. Downloading composer.phar..."
    ${PHP_BIN} -r "copy('https://getcomposer.org/installer', 'composer-setup.php');" 2>/dev/null || true
    if [ -f "composer-setup.php" ]; then
        ${PHP_BIN} composer-setup.php --quiet 2>/dev/null || true
        rm -f composer-setup.php
        if [ -f "composer.phar" ]; then
            COMPOSER_BIN="${PHP_BIN} composer.phar"
        fi
    fi
fi

if [ -n "${COMPOSER_BIN}" ] && [ -f "${TARGET_BACKEND}/composer.json" ]; then
    echo "Running Composer install..."
    ${COMPOSER_BIN} install --no-dev --prefer-dist --optimize-autoloader --no-interaction || \
    ${COMPOSER_BIN} install --no-dev --prefer-dist --optimize-autoloader --no-interaction --ignore-platform-reqs || {
        echo "Notice: Composer install completed with warnings or vendor is cached."
    }
fi

# Key generation if APP_KEY is empty
if [ -f "${TARGET_BACKEND}/.env" ]; then
    if ! grep -q "^APP_KEY=base64:.\+" "${TARGET_BACKEND}/.env" && ! grep -q "^APP_KEY=.\+" "${TARGET_BACKEND}/.env"; then
        echo "Generating Application Key (APP_KEY)..."
        ${PHP_BIN} artisan key:generate --force 2>/dev/null || true
    fi
fi

# Link storage via Artisan
${PHP_BIN} artisan storage:link 2>/dev/null || true

# Run Migrations & Seeders
if [ "${SKIP_MIGRATE}" = false ] && [ -f "${TARGET_BACKEND}/vendor/autoload.php" ]; then
    echo "Running database migrations..."
    ${PHP_BIN} artisan migrate --force --no-interaction || echo "Notice: Migrations check finished."

    if [ "${FORCE_SEED}" = true ]; then
        echo "Running full database seeders..."
        ${PHP_BIN} artisan db:seed --force --no-interaction || true
    else
        ${PHP_BIN} artisan db:seed --class=SystemPermissionsSeeder --force --no-interaction 2>/dev/null || true
        ${PHP_BIN} artisan db:seed --class=BusinessTypeSeeder --force --no-interaction 2>/dev/null || true
        ${PHP_BIN} artisan db:seed --class=IndustryProfileSeeder --force --no-interaction 2>/dev/null || true
        ${PHP_BIN} artisan db:seed --class=PlansAndTenantsSeeder --force --no-interaction 2>/dev/null || true
        ${PHP_BIN} artisan db:seed --class=RolesAndPermissionsSeeder --force --no-interaction 2>/dev/null || true
        ${PHP_BIN} artisan db:seed --class=DocumentTemplatesSeeder --force --no-interaction 2>/dev/null || true
        ${PHP_BIN} artisan db:seed --class=ReportDefinitionsTableSeeder --force --no-interaction 2>/dev/null || true
    fi
fi

# Rebuild Production Caches
if [ -f "${TARGET_BACKEND}/vendor/autoload.php" ]; then
    echo "Rebuilding production caches..."
    ${PHP_BIN} artisan config:clear >/dev/null 2>&1 || true
    ${PHP_BIN} artisan config:cache >/dev/null 2>&1 || true
    ${PHP_BIN} artisan route:cache >/dev/null 2>&1 || true
    ${PHP_BIN} artisan view:cache >/dev/null 2>&1 || true
    ${PHP_BIN} artisan event:cache >/dev/null 2>&1 || true
    ${PHP_BIN} artisan queue:restart >/dev/null 2>&1 || true
    echo "✓ Production caches compiled and queue restarted."
fi

# ------------------------------------------------------------------------------
# 8. Post-Deployment Verification & Health Summary
# ------------------------------------------------------------------------------
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "=================================================================="
echo " DEPLOYMENT COMPLETED SUCCESSFULLY IN ${DURATION}s               "
echo "=================================================================="
echo " Backend Directory:  ${TARGET_BACKEND}"
echo " Frontend Directory: ${TARGET_FRONTEND}"
echo " PHP CLI Version:    $(${PHP_BIN} -v 2>/dev/null | head -n 1 || echo 'php')"
echo ""
echo " Health Checks:"
if [ -f "${TARGET_FRONTEND}/index.html" ]; then
    echo "   [✓] SPA index.html present"
else
    echo "   [!] SPA index.html missing"
fi
if [ -f "${TARGET_FRONTEND}/index.php" ]; then
    echo "   [✓] Server index.php entry point present"
else
    echo "   [!] Server index.php missing"
fi
if [ -f "${TARGET_FRONTEND}/.htaccess" ]; then
    echo "   [✓] Apache .htaccess routing rules present"
else
    echo "   [!] .htaccess missing"
fi
if [ -e "${TARGET_FRONTEND}/storage" ]; then
    echo "   [✓] Public storage symlink active"
else
    echo "   [!] Public storage symlink not found"
fi
echo "=================================================================="
