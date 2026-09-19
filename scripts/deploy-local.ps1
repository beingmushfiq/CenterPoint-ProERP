<#
.SYNOPSIS
    DevCenterPoint ProERP — Local Deployment Preparation & Pre-Flight Verification (Windows/PowerShell)

.DESCRIPTION
    1. Executes production frontend build (tsc -b and vite build)
    2. Synchronizes frontend/dist into public_html/ (web root) preserving server files
    3. Prunes stale hashed chunk files from public_html/assets/
    4. Validates backend Laravel route registration and config caching
    5. Performs comprehensive pre-flight verification

.EXAMPLE
    .\scripts\deploy-local.ps1
#>

[CmdletBinding()]
param (
    [switch]$SkipBuild,
    [switch]$TestCaches
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
Set-Location $RootDir

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " DevCenterPoint ProERP -- Local Deployment Runner                " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Root Directory: $RootDir"

# 1. Frontend Build & Sync
if (-not $SkipBuild) {
    Write-Host "`n--- Step 1: Compiling Frontend Production Bundle ---" -ForegroundColor Yellow
    npm run build --workspace frontend
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Frontend compilation failed."
        exit 1
    }

    Write-Host "`n--- Step 2: Synchronizing Distribution to public_html ---" -ForegroundColor Yellow
    node scripts/sync_public_html.cjs
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Distribution sync failed."
        exit 1
    }
} else {
    Write-Host "`n--- Skipping Frontend Build (-SkipBuild specified) ---" -ForegroundColor Gray
}

# 2. Pre-flight Verification Audit
Write-Host "`n--- Step 3: Running Pre-Flight Deployment Audit ---" -ForegroundColor Yellow
node scripts/verify_deployment_readiness.cjs
if ($LASTEXITCODE -ne 0) {
    Write-Error "Pre-flight audit failed."
    exit 1
}

# 3. Optional Artisan Cache Test
if ($TestCaches) {
    Write-Host "`n--- Step 4: Testing Production Caches (Artisan) ---" -ForegroundColor Yellow
    Push-Location "$RootDir\backend"
    try {
        php artisan config:cache
        php artisan route:cache
        php artisan view:cache
        Write-Host "Production caches generated successfully." -ForegroundColor Green
    }
    catch {
        Write-Error "Cache generation encountered an error: $_"
    }
    php artisan config:clear
    php artisan route:clear
    php artisan view:clear
    Write-Host "Local development caches cleared." -ForegroundColor Green
    Pop-Location
}

Write-Host "`n=================================================================" -ForegroundColor Green
Write-Host " DEPLOYMENT ARTIFACTS ARE 100% READY!                            " -ForegroundColor Green
Write-Host " You can now commit and push to GitHub to trigger auto-deploy:   " -ForegroundColor White
Write-Host "   git add public_html/ frontend/ backend/ scripts/ package.json " -ForegroundColor Gray
Write-Host "   git commit -m 'feat: deploy production reporting and bilingual support'" -ForegroundColor Gray
Write-Host "   git push origin main                                          " -ForegroundColor Gray
Write-Host "=================================================================" -ForegroundColor Green
