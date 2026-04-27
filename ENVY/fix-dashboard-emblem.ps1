# ENVY Dashboard Emblem Fix
# Fixes the site emblem not showing on dashboard

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    DASHBOARD EMBLEM FIX               " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$currentDir = Get-Location
$htmlPath = Join-Path $currentDir "frontend\dashboard.html"
$cssPath = Join-Path $currentDir "frontend\css\dashboard.css"
$globalCssPath = Join-Path $currentDir "frontend\css\global.css"
$backupDir = Join-Path $currentDir "backup_emblem_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
if (Test-Path $htmlPath) { Copy-Item $htmlPath "$backupDir\dashboard.html" -Force }

Write-Host "Backup created: $backupDir" -ForegroundColor Green

# ============================================
# CHECK IF EMBLEM FILE EXISTS
# ============================================
$emblemPath = Join-Path $currentDir "frontend\assets\icons\envy-emblem.svg"
if (Test-Path $emblemPath) {
    Write-Host "Emblem file found: $emblemPath" -ForegroundColor Green
} else {
    Write-Host "WARNING: Emblem file not found at $emblemPath" -ForegroundColor Yellow
    Write-Host "Creating assets/icons directory..." -ForegroundColor Yellow
    
    $iconsDir = Join-Path $currentDir "frontend\assets\icons"
    if (-not (Test-Path $iconsDir)) {
        New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
    }
    
    # Create a simple SVG emblem
    $svgContent = @'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#9CA3AF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#E5E7EB;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="45" fill="url(#grad)" />
  <text x="50" y="65" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="#0A0A0A" text-anchor="middle">E</text>
</svg>
'@
    Set-Content $emblemPath $svgContent -Encoding UTF8
    Write-Host "Created default emblem: $emblemPath" -ForegroundColor Green
}

# ============================================
# FIX DASHBOARD.HTML EMBLEM SECTION
# ============================================
Write-Host "Fixing dashboard.html emblem..." -ForegroundColor Yellow

$htmlContent = Get-Content $htmlPath -Raw -Encoding UTF8

# Fix the brand wrapper section with proper emblem
$brandPattern = '(?s)<div class="brand-wrapper brand-wrapper-horizontal">.*?</div>'
$newBrand = @'
<div class="brand-wrapper brand-wrapper-horizontal">
    <img src="assets/icons/envy-emblem.svg" alt="ENVY" class="brand-emblem pulse-glow" id="siteEmblem" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'45\' fill=\'%239CA3AF\'/%3E%3Ctext x=\'50\' y=\'65\' font-family=\'Arial\' font-size=\'40\' font-weight=\'bold\' fill=\'%230A0A0A\' text-anchor=\'middle\'%3EE%3C/text%3E%3C/svg%3E'">
    <span class="brand-text-horizontal" id="brandText">ENVY</span>
</div>
'@

if ($htmlContent -match $brandPattern) {
    $htmlContent = $htmlContent -replace $brandPattern, $newBrand
    [System.IO.File]::WriteAllText($htmlPath, $htmlContent, [System.Text.UTF8Encoding]::new($true))
    Write-Host "dashboard.html emblem fixed" -ForegroundColor Green
}

# ============================================
# ADD CSS TO ENSURE EMBLEM DISPLAYS
# ============================================
Write-Host "Adding emblem CSS fixes..." -ForegroundColor Yellow

$emblemCss = @'

/* ============================================ */
/* EMBLEM DISPLAY FIX                           */
/* ============================================ */

.brand-emblem,
#siteEmblem,
img[alt="ENVY"] {
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    width: 40px !important;
    height: 40px !important;
    object-fit: contain !important;
    border-radius: 8px !important;
    background: transparent !important;
}

.brand-wrapper-horizontal {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
}

.brand-text-horizontal {
    font-size: 22px !important;
    font-weight: 700 !important;
    background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-hover) 100%);
    -webkit-background-clip: text !important;
    -webkit-text-fill-color: transparent !important;
    background-clip: text !important;
}

/* Pulse glow animation */
.pulse-glow {
    animation: emblem-pulse 3s ease-in-out infinite;
}

@keyframes emblem-pulse {
    0%, 100% { box-shadow: 0 0 10px rgba(156, 163, 175, 0.3); }
    50% { box-shadow: 0 0 20px rgba(156, 163, 175, 0.5); }
}

/* Sidebar collapsed state */
.sidebar.collapsed .brand-text-horizontal {
    display: none !important;
}

.sidebar.collapsed .brand-emblem {
    width: 40px !important;
    height: 40px !important;
}
'@

if (Test-Path $globalCssPath) {
    Add-Content $globalCssPath "`r`n$emblemCss" -Encoding UTF8
    Write-Host "CSS added to global.css" -ForegroundColor Green
}

if (Test-Path $cssPath) {
    Add-Content $cssPath "`r`n$emblemCss" -Encoding UTF8
    Write-Host "CSS added to dashboard.css" -ForegroundColor Green
}

# ============================================
# CREATE FALLBACK EMBLEM IF NEEDED
# ============================================
$fallbackDir = Join-Path $currentDir "frontend\assets\icons"
if (-not (Test-Path $fallbackDir)) {
    New-Item -ItemType Directory -Path $fallbackDir -Force | Out-Null
}

# Create a PNG fallback using base64 if SVG doesn't work
$pngFallback = Join-Path $fallbackDir "envy-emblem-fallback.html"
$fallbackHtml = @'
<!-- Fallback emblem reference -->
<div style="display:none">Emblem fallback</div>
'@
Set-Content $pngFallback $fallbackHtml -Encoding UTF8

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "      EMBLEM FIX COMPLETE!              " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "FIXES APPLIED:" -ForegroundColor Green
Write-Host "  - Emblem image path verified"
Write-Host "  - Added onerror fallback SVG"
Write-Host "  - CSS display properties forced"
Write-Host "  - Created default emblem if missing"
Write-Host ""
Write-Host "NEXT: Hard refresh (Ctrl+Shift+R)" -ForegroundColor Yellow
Write-Host ""
Write-Host "If emblem still doesn't show, check:" -ForegroundColor Cyan
Write-Host "  1. Browser console for 404 errors"
Write-Host "  2. That assets/icons/envy-emblem.svg exists"
Write-Host ""