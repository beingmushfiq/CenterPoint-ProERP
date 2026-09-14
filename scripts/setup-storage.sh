#!/usr/bin/env bash
# ==============================================================================
# DevCenterPoint ProERP — Storage Directory Scaffolding & Permissions Script
# ==============================================================================
# Usage:
#   bash scripts/setup-storage.sh
# ==============================================================================

set -euo pipefail

CPANEL_USER="${CPANEL_USER:-devcente}"
HOME_DIR="${HOME:-/home/${CPANEL_USER}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ -d "${HOME_DIR}/backend" ]; then
    BACKEND_DIR="${HOME_DIR}/backend"
else
    BACKEND_DIR="${REPO_DIR}/backend"
fi

if [ -d "${HOME_DIR}/public_html" ]; then
    PUBLIC_HTML_DIR="${HOME_DIR}/public_html"
else
    PUBLIC_HTML_DIR="${REPO_DIR}/public_html"
fi

echo "=================================================================="
echo " ProERP Storage Setup: $(date '+%Y-%m-%d %H:%M:%S')"
echo " Backend Directory:     ${BACKEND_DIR}"
echo " Public HTML Directory: ${PUBLIC_HTML_DIR}"
echo "=================================================================="

echo "--- Scaffolding storage subdirectories ---"
mkdir -p "${BACKEND_DIR}/storage/app/public"
mkdir -p "${BACKEND_DIR}/storage/framework/cache/data"
mkdir -p "${BACKEND_DIR}/storage/framework/sessions"
mkdir -p "${BACKEND_DIR}/storage/framework/views"
mkdir -p "${BACKEND_DIR}/storage/framework/testing"
mkdir -p "${BACKEND_DIR}/storage/logs"
mkdir -p "${BACKEND_DIR}/bootstrap/cache"

echo "--- Setting permissions (775) on storage and bootstrap/cache ---"
chmod -R 775 "${BACKEND_DIR}/storage" "${BACKEND_DIR}/bootstrap/cache" 2>/dev/null || true

# Symlink public storage to public_html/storage
echo "--- Ensuring public storage symlink ---"
if [ ! -L "${PUBLIC_HTML_DIR}/storage" ] && [ ! -e "${PUBLIC_HTML_DIR}/storage" ]; then
    echo "Creating symlink: ${PUBLIC_HTML_DIR}/storage -> ${BACKEND_DIR}/storage/app/public"
    ln -s "${BACKEND_DIR}/storage/app/public" "${PUBLIC_HTML_DIR}/storage" || true
else
    echo "Public storage symlink already present at ${PUBLIC_HTML_DIR}/storage"
fi

echo "=================================================================="
echo " Storage Scaffolding Completed Successfully"
echo "=================================================================="
