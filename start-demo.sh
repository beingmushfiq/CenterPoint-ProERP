#!/usr/bin/env bash
# ===============================================================================
# CenterPoint ProERP -- AI Financial Copilot (WeBank Topic E)
# FinTechathon 2026 One-Click Demo Launcher & Environment Staging
# ===============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==============================================================================="
echo "  CenterPoint ProERP -- AI Financial Copilot (WeBank Topic E)"
echo "  FinTechathon 2026 One-Click Demo Launcher"
echo "==============================================================================="
echo ""

cd "$SCRIPT_DIR/backend"

echo "[1/3] Refreshing database and seeding realistic WeBank Topic E demo scenario..."
php artisan migrate:fresh --seed --force
php artisan db:seed --class=CopilotDemoSeeder --force

echo ""
echo "[2/3] Starting Laravel backend API server on http://127.0.0.1:8000 ..."
php artisan serve --port=8000 &
BACKEND_PID=$!

cd "$SCRIPT_DIR/frontend"

echo ""
echo "[3/3] Starting React 19 / Vite frontend on http://localhost:5173 ..."
npm run dev &
FRONTEND_PID=$!

sleep 3

echo ""
echo "==============================================================================="
echo "  Environment successfully staged!"
echo "  Backend PID: $BACKEND_PID | Frontend PID: $FRONTEND_PID"
echo "  Opening http://localhost:5173 in browser..."
echo "==============================================================================="

if command -v xdg-open > /dev/null; then
    xdg-open "http://localhost:5173"
elif command -v open > /dev/null; then
    open "http://localhost:5173"
fi

wait
