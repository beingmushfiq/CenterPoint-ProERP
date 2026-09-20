#!/usr/bin/env bash
# ==============================================================================
# DevCenterPoint ProERP — One-Command Master Deployment (Linux/Bash/cPanel)
# ==============================================================================
# Target Layout:
#   Backend Directory:  /home/devcente/projects/proerp/backend
#   Frontend Directory: /home/devcente/projects/proerp/public
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

DEFAULT_BACKEND="/home/devcente/projects/proerp/backend"
DEFAULT_FRONTEND="/home/devcente/projects/proerp/public"

ARGS=()
HAS_TARGET_BACKEND=false
HAS_TARGET_FRONTEND=false

for arg in "$@"; do
    case "$arg" in
        --target-backend=*) HAS_TARGET_BACKEND=true ;;
        --target-frontend=*) HAS_TARGET_FRONTEND=true ;;
    esac
    ARGS+=("$arg")
done

# If running on server where /home/devcente exists, default to canonical paths
if [ "$HAS_TARGET_BACKEND" = false ] && [ -d "/home/devcente" ]; then
    ARGS+=("--target-backend=${DEFAULT_BACKEND}")
fi

if [ "$HAS_TARGET_FRONTEND" = false ] && [ -d "/home/devcente" ]; then
    ARGS+=("--target-frontend=${DEFAULT_FRONTEND}")
fi

exec node scripts/deploy_all.cjs "${ARGS[@]}"
