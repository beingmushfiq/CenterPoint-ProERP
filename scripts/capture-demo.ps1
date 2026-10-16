$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# Refresh PATH so recently installed tools (ffmpeg, etc.) are available in this process
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host '==> 1. Seeding demo tenant & financial ledger...' -ForegroundColor Cyan
Push-Location "$root\backend"
php artisan migrate:fresh --seed --seeder=CopilotDemoSeeder
php artisan config:clear
Pop-Location

Write-Host '==> 2. Ensuring docs/submission directory & document HTML exists...' -ForegroundColor Cyan
New-Item -ItemType Directory -Force "$root\docs\submission" | Out-Null
node "$root\scripts\render-markdown-docs.cjs"

Write-Host '==> 3. Capturing automated demo video & exporting deck PDF via Playwright...' -ForegroundColor Cyan
Push-Location "$root\frontend"
$env:DEMO_EMAIL = 'demo@slicemart.com'
$env:DEMO_PASSWORD = 'Password123!'
npx playwright test e2e/copilot-demo-capture.spec.ts --project=chromium
Pop-Location

Write-Host '==> 4. Converting raw webm recording to 1080p MP4 for submission...' -ForegroundColor Cyan
$webmItem = Get-ChildItem "$root\frontend\test-results" -Recurse -Filter *.webm | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($webmItem) {
    $webm = $webmItem.FullName
    $outMp4 = "$root\docs\submission\demo_video.mp4"
    Write-Host "Found recording: $webm" -ForegroundColor Green
    Write-Host "Encoding to: $outMp4" -ForegroundColor Cyan
    
    ffmpeg -y -i $webm -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart "$outMp4"
    
    if (Test-Path $outMp4) {
        $mp4Size = (Get-Item $outMp4).Length
        Write-Host "Demo MP4 successfully created! Size: $mp4Size bytes" -ForegroundColor Green
    } else {
        Write-Warning "Could not find generated MP4 at $outMp4"
    }
} else {
    Write-Warning "No .webm files found in frontend/test-results"
}

Write-Host '==> 5. Verifying presentation deck PDF...' -ForegroundColor Cyan
$deckPdf = "$root\docs\submission\presentation_deck.pdf"
if (Test-Path $deckPdf) {
    $deckSize = (Get-Item $deckPdf).Length
    Write-Host "Presentation deck PDF exists! Size: $deckSize bytes" -ForegroundColor Green
} else {
    Write-Warning "Presentation deck PDF not found at $deckPdf"
}

Write-Host 'Capture process completed!' -ForegroundColor Green
