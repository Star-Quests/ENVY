# ENVY Dashboard Emblem Sync
# Makes dashboard use the same emblem as journal, planner, settings, and admin

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    SYNC DASHBOARD EMBLEM              " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$currentDir = Get-Location
$htmlPath = Join-Path $currentDir "frontend\dashboard.html"
$journalPath = Join-Path $currentDir "frontend\journal.html"
$backupDir = Join-Path $currentDir "backup_emblem_sync_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
if (Test-Path $htmlPath) { Copy-Item $htmlPath "$backupDir\dashboard.html" -Force }

Write-Host "Backup created: $backupDir" -ForegroundColor Green

# ============================================
# CHECK WHAT EMBLEM JOURNAL USES
# ============================================
Write-Host "Checking journal.html for emblem reference..." -ForegroundColor Yellow

if (Test-Path $journalPath) {
    $journalContent = Get-Content $journalPath -Raw -Encoding UTF8
    
    # Extract the emblem img tag from journal
    if ($journalContent -match '<img[^>]*envy-emblem[^>]*>') {
        $journalEmblem = $matches[0]
        Write-Host "Journal uses: $journalEmblem" -ForegroundColor Green
    } else {
        Write-Host "Journal emblem not found, using default" -ForegroundColor Yellow
        $journalEmblem = '<img src="assets/icons/envy-emblem.svg" alt="ENVY" class="brand-emblem pulse-glow" id="siteEmblem">'
    }
} else {
    Write-Host "journal.html not found, using default" -ForegroundColor Yellow
    $journalEmblem = '<img src="assets/icons/envy-emblem.svg" alt="ENVY" class="brand-emblem pulse-glow" id="siteEmblem">'
}

# ============================================
# CHECK EMBLEM FILE LOCATIONS
# ============================================
Write-Host ""
Write-Host "Checking emblem file locations..." -ForegroundColor Yellow

$possiblePaths = @(
    "frontend\assets\icons\envy-emblem.svg",
    "assets\icons\envy-emblem.svg",
    "frontend\assets\envy-emblem.svg",
    "assets\envy-emblem.svg"
)

$foundPath = $null
foreach ($path in $possiblePaths) {
    $fullPath = Join-Path $currentDir $path
    if (Test-Path $fullPath) {
        Write-Host "  FOUND: $path" -ForegroundColor Green
        if (-not $foundPath) { $foundPath = "assets/icons/envy-emblem.svg" }
    } else {
        Write-Host "  NOT FOUND: $path" -ForegroundColor Gray
    }
}

# Use the standard path that works for other pages
$emblemSrc = "assets/icons/envy-emblem.svg"
Write-Host ""
Write-Host "Using emblem path: $emblemSrc" -ForegroundColor Cyan

# ============================================
# CREATE EMBLEM FILE IF MISSING
# ============================================
$emblemFullPath = Join-Path $currentDir "frontend\assets\icons\envy-emblem.svg"
$emblemDir = Split-Path $emblemFullPath -Parent

if (-not (Test-Path $emblemDir)) {
    New-Item -ItemType Directory -Path $emblemDir -Force | Out-Null
    Write-Host "Created directory: $emblemDir" -ForegroundColor Green
}

if (-not (Test-Path $emblemFullPath)) {
    Write-Host "Creating professional ENVY emblem..." -ForegroundColor Yellow
    
    $svgEmblem = @'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="envyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#9CA3AF;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#D1D5DB;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#E5E7EB;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="innerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1A1A1A;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0A0A0A;stop-opacity:1" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Outer ring -->
  <circle cx="100" cy="100" r="90" fill="url(#envyGrad)" filter="url(#glow)"/>
  
  <!-- Inner circle -->
  <circle cx="100" cy="100" r="75" fill="url(#innerGrad)"/>
  
  <!-- ENVY Text -->
  <text x="100" y="120" font-family="'Inter', 'Segoe UI', Arial, sans-serif" font-size="55" font-weight="800" fill="url(#envyGrad)" text-anchor="middle" letter-spacing="4">ENVY</text>
  
  <!-- Small decorative line -->
  <line x1="40" y1="140" x2="160" y2="140" stroke="url(#envyGrad)" stroke-width="2" opacity="0.5"/>
  
  <!-- Crown icon for admin/premium feel -->
  <path d="M70 55 L75 40 L90 50 L100 35 L110 50 L125 40 L130 55 L100 70 Z" fill="url(#envyGrad)" opacity="0.8"/>
</svg>
'@
    Set-Content $emblemFullPath $svgEmblem -Encoding UTF8
    Write-Host "Created emblem: $emblemFullPath" -ForegroundColor Green
}

# ============================================
# FIX DASHBOARD.HTML WITH CORRECT EMBLEM
# ============================================
Write-Host ""
Write-Host "Updating dashboard.html with correct emblem..." -ForegroundColor Yellow

$htmlContent = Get-Content $htmlPath -Raw -Encoding UTF8

# Replace the brand wrapper with the exact same format as other pages
$newBrandSection = @'
<div class="brand-wrapper brand-wrapper-horizontal">
    <img src="assets/icons/envy-emblem.svg" alt="ENVY" class="brand-emblem pulse-glow" id="siteEmblem">
    <span class="brand-text-horizontal" id="brandText">ENVY</span>
</div>
'@

$brandPattern = '(?s)<div class="brand-wrapper[^>]*>.*?</div>'
if ($htmlContent -match $brandPattern) {
    $htmlContent = $htmlContent -replace $brandPattern, $newBrandSection
    [System.IO.File]::WriteAllText($htmlPath, $htmlContent, [System.Text.UTF8Encoding]::new($true))
    Write-Host "dashboard.html updated with correct emblem" -ForegroundColor Green
}

# ============================================
# ADD CSS TO MATCH OTHER PAGES
# ============================================
Write-Host ""
Write-Host "Adding emblem CSS to match other pages..." -ForegroundColor Yellow

$globalCssPath = Join-Path $currentDir "frontend\css\global.css"

$emblemCss = @'

/* ============================================ */
/* SYNCED EMBLEM STYLES - MATCHES ALL PAGES     */
/* ============================================ */

.brand-emblem,
#siteEmblem,
img[alt="ENVY"] {
    width: 42px !important;
    height: 42px !important;
    object-fit: contain !important;
    border-radius: 10px !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
}

.brand-wrapper-horizontal {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
}

.brand-text-horizontal {
    font-size: 24px !important;
    font-weight: 700 !important;
    background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-hover) 100%);
    -webkit-background-clip: text !important;
    -webkit-text-fill-color: transparent !important;
    background-clip: text !important;
}

.pulse-glow {
    animation: emblemPulse 3s ease-in-out infinite;
}

@keyframes emblemPulse {
    0%, 100% { 
        box-shadow: 0 0 12px rgba(156, 163, 175, 0.3);
        transform: scale(1);
    }
    50% { 
        box-shadow: 0 0 20px rgba(156, 163, 175, 0.5);
        transform: scale(1.02);
    }
}

.sidebar.collapsed .brand-text-horizontal {
    display: none !important;
}

.sidebar.collapsed .brand-emblem {
    width: 42px !important;
    height: 42px !important;
}

'@

if (Test-Path $globalCssPath) {
    Add-Content $globalCssPath "`r`n$emblemCss" -Encoding UTF8
    Write-Host "CSS added to global.css" -ForegroundColor Green
}

# ============================================
# VERIFY THE FIX
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "      EMBLEM SYNC COMPLETE!             " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "FIXES APPLIED:" -ForegroundColor Green
Write-Host "  - Dashboard now uses same emblem as other pages"
Write-Host "  - Emblem path: assets/icons/envy-emblem.svg"
Write-Host "  - Created professional ENVY SVG emblem"
Write-Host "  - CSS synced with journal/planner/settings/admin"
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Hard refresh browser: Ctrl + Shift + R"
Write-Host "  2. Clear browser cache if needed"
Write-Host "  3. The emblem should now match other pages"
Write-Host ""
Write-Host "If emblem still doesn't show, try:" -ForegroundColor Cyan
Write-Host "  - Open browser console (F12) to check for errors"
Write-Host "  - Verify emblem exists at: frontend/assets/icons/envy-emblem.svg"
Write-Host ""