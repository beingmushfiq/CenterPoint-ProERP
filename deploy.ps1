<#
.SYNOPSIS
    DevCenterPoint ProERP — One-Command Master Deployment (Windows/PowerShell)

.DESCRIPTION
    Takes backend files to backend directory, compiles and deploys frontend dist
    to frontend web root, and executes all necessary actions (migrations, caches,
    permissions, verification).

.EXAMPLE
    .\deploy.ps1
    .\deploy.ps1 -SkipBuild
    .\deploy.ps1 -Production
#>

[CmdletBinding()]
param (
    [switch]$SkipBuild,
    [switch]$SkipBackendSync,
    [switch]$SkipMigrate,
    [switch]$SkipCache,
    [switch]$Production,
    [switch]$Seed,
    [string]$TargetBackend = "",
    [string]$TargetFrontend = ""
)

$ErrorActionPreference = 'Stop'
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$NodeArgs = @("scripts/deploy_all.cjs")
if ($SkipBuild) { $NodeArgs += "--skip-build" }
if ($SkipBackendSync) { $NodeArgs += "--skip-backend-sync" }
if ($SkipMigrate) { $NodeArgs += "--skip-migrate" }
if ($SkipCache) { $NodeArgs += "--skip-cache" }
if ($Production) { $NodeArgs += "--production" }
if ($Seed) { $NodeArgs += "--seed" }
if ($TargetBackend) { $NodeArgs += "--target-backend=$TargetBackend" }
if ($TargetFrontend) { $NodeArgs += "--target-frontend=$TargetFrontend" }

Push-Location $RootDir
try {
    node $NodeArgs
}
finally {
    Pop-Location
}
