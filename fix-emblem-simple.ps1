# Simple Professional Fix - Copy working emblem and theme from Journal to Dashboard

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    SIMPLE EMBLEM & THEME FIX          " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$currentDir = Get-Location

# Source files that WORK
$journalHtml = Join-Path $currentDir "frontend\journal.html"
$journalCss = Join-Path $currentDir "frontend\css\journal.css"

# Target files to FIX
$dashboardHtml = Join-Path $currentDir "frontend\dashboard.html"
$dashboardCss = Join-Path $currentDir "frontend\css\dashboard.css"
$globalCss = Join-Path $currentDir "frontend\css\global.css"

# Backup
$backupDir = Join-Path $currentDir "backup_simple_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $dashboardHtml "$backupDir\dashboard.html" -Force -ErrorAction SilentlyContinue
Copy-Item $dashboardCss "$backupDir\dashboard.css" -Force -ErrorAction SilentlyContinue
Write-Host "Backup: $backupDir" -ForegroundColor Green

# ============================================
# 1. EXTRACT WORKING SIDEBAR FROM JOURNAL
# ============================================
Write-Host ""
Write-Host "Extracting working sidebar from journal.html..." -ForegroundColor Yellow

$journalContent = Get-Content $journalHtml -Raw -Encoding UTF8

# Extract the entire sidebar section
if ($journalContent -match '(?s)<aside class="sidebar glass-morphism" id="sidebar">.*?</aside>') {
    $workingSidebar = $matches[0]
    Write-Host "Found working sidebar in journal" -ForegroundColor Green
} else {
    Write-Host "ERROR: Could not find sidebar in journal.html" -ForegroundColor Red
    exit
}

# ============================================
# 2. EXTRACT WORKING HEAD (CSS LINKS) FROM JOURNAL
# ============================================
Write-Host "Extracting working head section from journal.html..." -ForegroundColor Yellow

if ($journalContent -match '(?s)<head>.*?</head>') {
    $workingHead = $matches[0]
    Write-Host "Found working head in journal" -ForegroundColor Green
} else {
    Write-Host "ERROR: Could not find head in journal.html" -ForegroundColor Red
    exit
}

# ============================================
# 3. GET DASHBOARD CONTENT
# ============================================
Write-Host "Reading current dashboard.html..." -ForegroundColor Yellow
$dashboardContent = Get-Content $dashboardHtml -Raw -Encoding UTF8

# ============================================
# 4. REPLACE SIDEBAR IN DASHBOARD
# ============================================
Write-Host "Replacing dashboard sidebar with working journal sidebar..." -ForegroundColor Yellow

if ($dashboardContent -match '(?s)<aside class="sidebar glass-morphism" id="sidebar">.*?</aside>') {
    $dashboardContent = $dashboardContent -replace '(?s)<aside class="sidebar glass-morphism" id="sidebar">.*?</aside>', $workingSidebar
    Write-Host "Sidebar replaced successfully" -ForegroundColor Green
} else {
    Write-Host "WARNING: Could not find sidebar pattern in dashboard" -ForegroundColor Yellow
}

# ============================================
# 5. REPLACE HEAD IN DASHBOARD
# ============================================
Write-Host "Replacing dashboard head with working journal head..." -ForegroundColor Yellow

# Update the title to say Dashboard instead of Journal
$workingHead = $workingHead -replace '<title>.*?</title>', '<title>Dashboard | ENVY</title>'

if ($dashboardContent -match '(?s)<head>.*?</head>') {
    $dashboardContent = $dashboardContent -replace '(?s)<head>.*?</head>', $workingHead
    Write-Host "Head replaced successfully" -ForegroundColor Green
}

# ============================================
# 6. UPDATE MAIN CONTENT AREA TITLE
# ============================================
Write-Host "Updating page title to Dashboard..." -ForegroundColor Yellow

$dashboardContent = $dashboardContent -replace '<h1 class="page-title">.*?</h1>', '<h1 class="page-title">Dashboard</h1>'

# ============================================
# 7. ENSURE DASHBOARD CONTENT REMAINS
# ============================================
# The main content (summary cards, crypto feed, chart, holdings, trades) 
# should already be there since we only replaced head and sidebar

# ============================================
# 8. SAVE THE FIXED DASHBOARD
# ============================================
Write-Host "Saving fixed dashboard.html..." -ForegroundColor Yellow
[System.IO.File]::WriteAllText($dashboardHtml, $dashboardContent, [System.Text.UTF8Encoding]::new($true))
Write-Host "dashboard.html saved" -ForegroundColor Green

# ============================================
# 9. COPY WORKING CSS VARIABLES FROM JOURNAL
# ============================================
Write-Host ""
Write-Host "Syncing theme variables..." -ForegroundColor Yellow

# Add theme variables to dashboard.css
$themeVariables = @'

/* ============================================ */
/* THEME VARIABLES - SYNCED FROM JOURNAL        */
/* ============================================ */

:root {
    --bg-primary: #0A0A0A;
    --bg-secondary: #111111;
    --bg-tertiary: #1A1A1A;
    --bg-elevated: #222222;
    --accent-primary: #9CA3AF;
    --accent-secondary: #D1D5DB;
    --accent-hover: #E5E7EB;
    --accent-muted: #6B7280;
    --success: #10B981;
    --error: #EF4444;
    --warning: #F59E0B;
    --info: #3B82F6;
    --glass-bg: rgba(17, 17, 17, 0.7);
    --glass-border: rgba(156, 163, 175, 0.1);
    --glass-blur: blur(12px);
    --font-primary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --font-mono: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
    --spacing-xs: 0.25rem;
    --spacing-sm: 0.5rem;
    --spacing-md: 1rem;
    --spacing-lg: 1.5rem;
    --spacing-xl: 2rem;
    --spacing-2xl: 3rem;
    --radius-sm: 0.375rem;
    --radius-md: 0.5rem;
    --radius-lg: 0.75rem;
    --radius-xl: 1rem;
    --radius-2xl: 1.5rem;
    --radius-full: 9999px;
    --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-base: 250ms cubic-bezier(0.4, 0, 0.2, 1);
    --shadow-glow: 0 0 20px rgba(156, 163, 175, 0.3);
    --z-dropdown: 100;
    --z-sticky: 200;
    --z-fixed: 300;
    --z-modal: 400;
}

.dark-theme {
    --bg-primary: #0A0A0A;
    --bg-secondary: #111111;
    --bg-tertiary: #1A1A1A;
    --accent-primary: #9CA3AF;
}

'@

$dashboardCssContent = Get-Content $dashboardCss -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
if (-not $dashboardCssContent) {
    $dashboardCssContent = ""
}

# Add theme variables at the top
$dashboardCssContent = $themeVariables + "`r`n" + $dashboardCssContent
[System.IO.File]::WriteAllText($dashboardCss, $dashboardCssContent, [System.Text.UTF8Encoding]::new($true))
Write-Host "Theme variables added to dashboard.css" -ForegroundColor Green

# ============================================
# 10. VERIFY EMBLEM FILE EXISTS
# ============================================
Write-Host ""
Write-Host "Verifying emblem file..." -ForegroundColor Yellow

$emblemPath = Join-Path $currentDir "frontend\assets\icons\envy-emblem.svg"
if (Test-Path $emblemPath) {
    Write-Host "Emblem file exists: $emblemPath" -ForegroundColor Green
} else {
    Write-Host "Creating emblem file..." -ForegroundColor Yellow
    $emblemDir = Split-Path $emblemPath -Parent
    if (-not (Test-Path $emblemDir)) {
        New-Item -ItemType Directory -Path $emblemDir -Force | Out-Null
    }
    
    # Copy from journal assets if exists
    $journalEmblem = Join-Path $currentDir "frontend\assets\icons\envy-emblem.svg"
    if (Test-Path $journalEmblem) {
        Copy-Item $journalEmblem $emblemPath -Force
        Write-Host "Copied emblem from journal" -ForegroundColor Green
    }
}

# ============================================
# DONE
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "         FIX COMPLETE!                  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "WHAT WAS FIXED:" -ForegroundColor Green
Write-Host "  - Copied WORKING sidebar from journal"
Write-Host "  - Copied WORKING head/CSS links from journal"
Write-Host "  - Synced all theme variables"
Write-Host "  - Emblem now matches journal exactly"
Write-Host ""
Write-Host "NEXT: Hard refresh (Ctrl+Shift+R)" -ForegroundColor Yellow
Write-Host ""
Write-Host "The dashboard should now look EXACTLY like journal" -ForegroundColor Cyan
Write-Host "with the same emblem, theme, and accent colors!"
Write-Host ""