#!/usr/bin/env bash
# DevCenterPoint ProERP — Root deployment runner
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${DIR}/scripts/auto-deploy.sh" "$@"
