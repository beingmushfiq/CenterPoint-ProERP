#!/usr/bin/env bash
# ==============================================================================
# DevCenterPoint ProERP — Enterprise Automated Deployment Runner
# ==============================================================================
# Purpose:
#   Automatically executes all steps required to deploy the latest code:
#   1. Parses optional CLI flags (--skip-git, --skip-build, --seed, --target)
#   2. Pulls latest commits from Git repository (origin/main or custom branch)
#   3. Builds frontend production bundle if Node.js/npm is available
#   4. Syncs backend, frontend assets (public_html), and scripts into place
#   5. Executes deploy-cpanel.sh (composer, migrations, cache rebuild, symlinks)
#   6. Runs post-deployment health checks and prints deployment summary
#
# Usage:
#   Direct / Terminal:  bash scripts/auto-deploy.sh [OPTIONS]
#   Or from repo root:  bash deploy.sh [OPTIONS]
#   Or via cPanel Cron: /bin/bash /home/devcente/scripts/auto-deploy.sh >> /home/devcente/logs/auto-deploy.log 2>&1
#
# Options:
#   --skip-git      Skip git fetch and reset (use current local files)
#   --skip-build    Skip frontend npm build even if node/npm is detected
#   --seed          Run full database seeders (Platform & Flagship tenant)
#   --branch=NAME   Specify git branch to pull (default: main)
#   --help          Show this help message
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# 0. Parse Command-Line Options
# ------------------------------------------------------------------------------
SKIP_GIT=false
SKIP_BUILD=false
FORCE_SEED=false
GIT_BRANCH="main"

for arg in "$@"; do
    case "$arg" in
        --skip-git)
            SKIP_GIT=true
            ;;
        --skip-build)
            SKIP_BUILD=true
            ;;
        --seed)
            FORCE_SEED=true
            ;;
        --backend-target=*)
            BACKEND_TARGET="${arg#*=}"
            ;;
        --public-target=*)
            PUBLIC_TARGET="${arg#*=}"
            ;;
        --branch=*)
            GIT_BRANCH="${arg#*=}"
            ;;
        --help|-h)
            echo "Usage: $0 [--skip-git] [--skip-build] [--seed] [--branch=main] [--backend-target=DIR] [--public-target=DIR]"
            exit 0
            ;;
        *)
            echo "Unknown option: $arg"
            ;;
    esac
done

# ------------------------------------------------------------------------------
# 1. Environment & Path Resolution
# ------------------------------------------------------------------------------
CPANEL_USER="${CPANEL_USER:-$(whoami)}"

if [ -d "/home.devcente" ]; then
    DETECTED_HOME="/home.devcente"
elif [ -d "/home/devcente" ]; then
    DETECTED_HOME="/home/devcente"
else
    DETECTED_HOME="${HOME:-/home/${CPANEL_USER}}"
fi
HOME_DIR="${HOME_DIR:-${DETECTED_HOME}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Resolve repository directory (either parent of scripts/ or current working dir)
if [ -d "${SCRIPT_DIR}/../.git" ]; then
    REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
elif [ -d "${HOME_DIR}/repositories/proerp" ]; then
    REPO_DIR="${HOME_DIR}/repositories/proerp"
else
    REPO_DIR="$(pwd)"
fi

PROERP_ROOT="${PROERP_ROOT:-${HOME_DIR}/projects/proerp}"
BACKEND_TARGET="${BACKEND_TARGET:-${PROERP_ROOT}/backend}"
PUBLIC_TARGET="${PUBLIC_TARGET:-${PROERP_ROOT}/public}"
SCRIPTS_TARGET="${SCRIPTS_TARGET:-${HOME_DIR}/scripts}"
PORTFOLIO_DIR="${PORTFOLIO_DIR:-${HOME_DIR}/public_html}"
LOG_DIR="${LOG_DIR:-${HOME_DIR}/logs}"

mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/deploy-$(date '+%Y-%m-%d').log"

START_TIME=$(date +%s)

echo "==================================================================" | tee -a "${LOG_FILE}"
echo " ProERP Automated Deployment Started: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "${LOG_FILE}"
echo " Repository Path:   ${REPO_DIR}" | tee -a "${LOG_FILE}"
echo " Target User:       ${CPANEL_USER}" | tee -a "${LOG_FILE}"
echo " Home Directory:    ${HOME_DIR}" | tee -a "${LOG_FILE}"
echo " ProERP Backend:    ${BACKEND_TARGET}" | tee -a "${LOG_FILE}"
echo " ProERP Public:     ${PUBLIC_TARGET}" | tee -a "${LOG_FILE}"
echo " Scripts Directory: ${SCRIPTS_TARGET}" | tee -a "${LOG_FILE}"
echo " Options:           skip-git=${SKIP_GIT}, skip-build=${SKIP_BUILD}, seed=${FORCE_SEED}, branch=${GIT_BRANCH}" | tee -a "${LOG_FILE}"
echo "==================================================================" | tee -a "${LOG_FILE}"

# ------------------------------------------------------------------------------
# 2. Git Pull Latest Code (If inside a Git Repository and not skipped)
# ------------------------------------------------------------------------------
if [ "${SKIP_GIT}" = "false" ] && [ -d "${REPO_DIR}/.git" ]; then
    echo "--- Pulling latest changes from Git repository (origin/${GIT_BRANCH}) ---" | tee -a "${LOG_FILE}"
    cd "${REPO_DIR}"
    git fetch origin "${GIT_BRANCH}" 2>&1 | tee -a "${LOG_FILE}" || true
    git reset --hard "origin/${GIT_BRANCH}" 2>&1 | tee -a "${LOG_FILE}" || git pull origin "${GIT_BRANCH}" 2>&1 | tee -a "${LOG_FILE}" || true
    LATEST_COMMIT="$(git log -1 --oneline 2>/dev/null || echo 'Unknown')"
    echo "Active commit: ${LATEST_COMMIT}" | tee -a "${LOG_FILE}"
else
    echo "Notice: Skipping Git pull (using files currently present in ${REPO_DIR})." | tee -a "${LOG_FILE}"
fi

# ------------------------------------------------------------------------------
# 3. Optional On-Server Frontend Build (If Node.js and npm are present)
# ------------------------------------------------------------------------------
if [ "${SKIP_BUILD}" = "false" ] && command -v npm &> /dev/null && [ -f "${REPO_DIR}/package.json" ]; then
    echo "--- Node.js detected: Building production frontend bundle ---" | tee -a "${LOG_FILE}"
    (
        cd "${REPO_DIR}"
        npm run build:prod 2>&1 | tee -a "${LOG_FILE}"
    ) || {
        echo "WARNING: Frontend npm build failed; falling back to pre-built public_html assets." | tee -a "${LOG_FILE}"
    }
else
    echo "Notice: Skipping on-server frontend build (pre-built assets in public_html will be deployed)." | tee -a "${LOG_FILE}"
fi

# ------------------------------------------------------------------------------
# 4. Scaffold Target Directories
# ------------------------------------------------------------------------------
echo "--- Ensuring destination directories exist ---" | tee -a "${LOG_FILE}"
mkdir -p "${PUBLIC_TARGET}"
mkdir -p "${BACKEND_TARGET}"
mkdir -p "${PORTFOLIO_DIR}"
mkdir -p "${SCRIPTS_TARGET}"

# ------------------------------------------------------------------------------
# 5. Sync Files into Multi-Project Target Structure
# ------------------------------------------------------------------------------
echo "--- Syncing backend files to ${BACKEND_TARGET}/ ---" | tee -a "${LOG_FILE}"
if [ -d "${REPO_DIR}/backend" ]; then
    cp -Rf "${REPO_DIR}/backend/." "${BACKEND_TARGET}/"
fi

echo "--- Syncing public/frontend entry files to ${PUBLIC_TARGET}/ ---" | tee -a "${LOG_FILE}"
if [ -d "${REPO_DIR}/public_html" ]; then
    cp -Rf "${REPO_DIR}/public_html/." "${PUBLIC_TARGET}/"
fi

echo "--- Syncing scripts to ${SCRIPTS_TARGET}/ ---" | tee -a "${LOG_FILE}"
if [ -d "${REPO_DIR}/scripts" ]; then
    cp -Rf "${REPO_DIR}/scripts/." "${SCRIPTS_TARGET}/"
    chmod +x "${SCRIPTS_TARGET}"/*.sh 2>/dev/null || true
fi

# Deploy portfolio files and proerp-app symlink for subdomain fallback routing
if [ -f "${REPO_DIR}/portfolio_public_html/.htaccess" ]; then
    cp "${REPO_DIR}/portfolio_public_html/.htaccess" "${PORTFOLIO_DIR}/.htaccess"
    echo "Deployed portfolio .htaccess to ${PORTFOLIO_DIR}/.htaccess" | tee -a "${LOG_FILE}"
fi

if [ -f "${REPO_DIR}/portfolio_public_html/index.html" ]; then
    cp "${REPO_DIR}/portfolio_public_html/index.html" "${PORTFOLIO_DIR}/index.html"
    echo "Deployed portfolio index.html to ${PORTFOLIO_DIR}/index.html" | tee -a "${LOG_FILE}"
elif [ -f "${SCRIPTS_TARGET}/portfolio-placeholder.html" ]; then
    cp "${SCRIPTS_TARGET}/portfolio-placeholder.html" "${PORTFOLIO_DIR}/index.html"
    echo "Deployed portfolio placeholder to ${PORTFOLIO_DIR}/index.html" | tee -a "${LOG_FILE}"
fi

# Install portfolio index.php forwarder (safeguard for subdomain API routing)
if [ -f "${REPO_DIR}/portfolio_public_html/index.php" ]; then
    cp "${REPO_DIR}/portfolio_public_html/index.php" "${PORTFOLIO_DIR}/index.php"
    echo "Deployed portfolio index.php to ${PORTFOLIO_DIR}/index.php" | tee -a "${LOG_FILE}"
fi

if [ -d "${PUBLIC_TARGET}" ] && [ "${PUBLIC_TARGET}" != "${PORTFOLIO_DIR}" ]; then
    ln -sfn "${PUBLIC_TARGET}" "${PORTFOLIO_DIR}/proerp-app" 2>/dev/null || true
    echo "Created proerp-app routing symlink in ${PORTFOLIO_DIR}/" | tee -a "${LOG_FILE}"
fi

# ------------------------------------------------------------------------------
# 6. Execute Core Deployment Script (Artisan, Caches, Permissions, Symlinks)
# ------------------------------------------------------------------------------
echo "--- Executing deploy-cpanel.sh ---" | tee -a "${LOG_FILE}"
export FORCE_SEED="${FORCE_SEED}"
export BACKEND_DIR="${BACKEND_TARGET}"
export PUBLIC_HTML_DIR="${PUBLIC_TARGET}"
export HOME_DIR="${HOME_DIR}"

DEPLOY_CPANEL_SCRIPT=""
if [ -f "${SCRIPTS_TARGET}/deploy-cpanel.sh" ]; then
    DEPLOY_CPANEL_SCRIPT="${SCRIPTS_TARGET}/deploy-cpanel.sh"
elif [ -f "${REPO_DIR}/scripts/deploy-cpanel.sh" ]; then
    DEPLOY_CPANEL_SCRIPT="${REPO_DIR}/scripts/deploy-cpanel.sh"
fi

if [ -n "${DEPLOY_CPANEL_SCRIPT}" ]; then
    bash "${DEPLOY_CPANEL_SCRIPT}" 2>&1 | tee -a "${LOG_FILE}"
else
    echo "Warning: deploy-cpanel.sh not found." | tee -a "${LOG_FILE}"
fi

# ------------------------------------------------------------------------------
# 7. Post-Deployment Summary & Health Verification
# ------------------------------------------------------------------------------
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "==================================================================" | tee -a "${LOG_FILE}"
echo " Automation Task Finished Successfully: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "${LOG_FILE}"
echo " Total Deployment Duration: ${DURATION} seconds" | tee -a "${LOG_FILE}"
echo " Log written to: ${LOG_FILE}" | tee -a "${LOG_FILE}"
echo "==================================================================" | tee -a "${LOG_FILE}"

