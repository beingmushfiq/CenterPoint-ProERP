#!/usr/bin/env bash
# ==============================================================================
# DevCenterPoint ProERP — One-Click Automated Deployment Runner
# ==============================================================================
# Purpose:
#   Automatically executes all steps required to deploy the latest code:
#   1. Pulls latest commits from Git repository (origin/main)
#   2. Scaffolds required cPanel multi-project directory layout
#   3. Syncs backend, frontend assets, and deployment scripts into place
#   4. Executes deploy-cpanel.sh (migrations, cache rebuild, symlinks, permissions)
#
# Usage:
#   Direct / Terminal:  bash scripts/auto-deploy.sh
#   Or from repo root:  bash deploy.sh
#   Or via cPanel Cron: /bin/bash /home/devcente/scripts/auto-deploy.sh >> /home/devcente/logs/auto-deploy.log 2>&1
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# 1. Environment & Path Resolution
# ------------------------------------------------------------------------------
CPANEL_USER="${CPANEL_USER:-$(whoami)}"
HOME_DIR="${HOME:-/home/${CPANEL_USER}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Resolve repository directory (either parent of scripts/ or current working dir)
if [ -d "${SCRIPT_DIR}/../.git" ]; then
    REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
elif [ -d "${HOME_DIR}/repositories/proerp" ]; then
    REPO_DIR="${HOME_DIR}/repositories/proerp"
else
    REPO_DIR="$(pwd)"
fi

PROERP_ROOT="${HOME_DIR}/projects/proerp"
BACKEND_TARGET="${PROERP_ROOT}/backend"
PUBLIC_TARGET="${PROERP_ROOT}/public"
SCRIPTS_TARGET="${HOME_DIR}/scripts"
PORTFOLIO_DIR="${HOME_DIR}/public_html"
LOG_DIR="${HOME_DIR}/logs"

mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/deploy-$(date '+%Y-%m-%d').log"

echo "==================================================================" | tee -a "${LOG_FILE}"
echo " ProERP Automated Deployment Started: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "${LOG_FILE}"
echo " Repository Path:   ${REPO_DIR}" | tee -a "${LOG_FILE}"
echo " Home Directory:    ${HOME_DIR}" | tee -a "${LOG_FILE}"
echo " ProERP Backend:    ${BACKEND_TARGET}" | tee -a "${LOG_FILE}"
echo " ProERP Public:     ${PUBLIC_TARGET}" | tee -a "${LOG_FILE}"
echo " Scripts Directory: ${SCRIPTS_TARGET}" | tee -a "${LOG_FILE}"
echo "==================================================================" | tee -a "${LOG_FILE}"

# ------------------------------------------------------------------------------
# 2. Git Pull Latest Code (If inside a Git Repository)
# ------------------------------------------------------------------------------
if [ -d "${REPO_DIR}/.git" ]; then
    echo "--- Pulling latest changes from Git repository ---" | tee -a "${LOG_FILE}"
    cd "${REPO_DIR}"
    # Fetch and cleanly align with origin/main
    git fetch origin main 2>&1 | tee -a "${LOG_FILE}" || true
    git reset --hard origin/main 2>&1 | tee -a "${LOG_FILE}" || git pull origin main 2>&1 | tee -a "${LOG_FILE}" || true
    LATEST_COMMIT="$(git log -1 --oneline 2>/dev/null || echo 'Unknown')"
    echo "Active commit: ${LATEST_COMMIT}" | tee -a "${LOG_FILE}"
else
    echo "Notice: ${REPO_DIR} is not a Git clone directly; proceeding with file sync." | tee -a "${LOG_FILE}"
fi

# ------------------------------------------------------------------------------
# 3. Scaffold Target Directories
# ------------------------------------------------------------------------------
echo "--- Ensuring destination directories exist ---" | tee -a "${LOG_FILE}"
mkdir -p "${PUBLIC_TARGET}"
mkdir -p "${BACKEND_TARGET}"
mkdir -p "${PORTFOLIO_DIR}"
mkdir -p "${SCRIPTS_TARGET}"

# ------------------------------------------------------------------------------
# 4. Sync Files into Multi-Project Target Structure
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

# Portfolio root must NOT have an index.php, ensuring subdomain routing via .htaccess
if [ -f "${PORTFOLIO_DIR}/index.php" ]; then
    rm -f "${PORTFOLIO_DIR}/index.php"
    echo "Removed legacy/shadow index.php from ${PORTFOLIO_DIR}/" | tee -a "${LOG_FILE}"
fi

if [ -d "${PUBLIC_TARGET}" ] && [ "${PUBLIC_TARGET}" != "${PORTFOLIO_DIR}" ]; then
    ln -sfn "${PUBLIC_TARGET}" "${PORTFOLIO_DIR}/proerp-app" 2>/dev/null || true
    echo "Created proerp-app routing symlink in ${PORTFOLIO_DIR}/" | tee -a "${LOG_FILE}"
fi

# ------------------------------------------------------------------------------
# 5. Execute Core Deployment Script (Artisan, Caches, Permissions, Symlinks)
# ------------------------------------------------------------------------------
echo "--- Executing deploy-cpanel.sh ---" | tee -a "${LOG_FILE}"
if [ -f "${SCRIPTS_TARGET}/deploy-cpanel.sh" ]; then
    bash "${SCRIPTS_TARGET}/deploy-cpanel.sh" 2>&1 | tee -a "${LOG_FILE}"
elif [ -f "${REPO_DIR}/scripts/deploy-cpanel.sh" ]; then
    bash "${REPO_DIR}/scripts/deploy-cpanel.sh" 2>&1 | tee -a "${LOG_FILE}"
else
    echo "Warning: deploy-cpanel.sh not found." | tee -a "${LOG_FILE}"
fi

echo "==================================================================" | tee -a "${LOG_FILE}"
echo " Automation Task Finished Successfully: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "${LOG_FILE}"
echo " Log written to: ${LOG_FILE}" | tee -a "${LOG_FILE}"
echo "==================================================================" | tee -a "${LOG_FILE}"
