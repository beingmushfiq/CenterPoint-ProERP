#!/usr/bin/env bash
# ==============================================================================
# DevCenterPoint ProERP — One-Command Master Deployment (Linux/Bash/cPanel)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

exec node scripts/deploy_all.cjs "$@"
