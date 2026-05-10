# Fix dashboard.html using the working dashboard.js as reference
# This restores emblem and theme functionality

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    FIX DASHBOARD WITH WORKING JS      " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$currentDir = Get-Location
$dashboardHtml = Join-Path $currentDir "frontend\dashboard.html"
$journalHtml = Join-Path $currentDir "frontend\journal.html"
$globalCss = Join-Path $currentDir "frontend\css\global.css"
$backupDir = Join-Path $currentDir "backup_final_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $dashboardHtml "$backupDir\dashboard.html" -Force -ErrorAction SilentlyContinue
Write-Host "Backup: $backupDir" -ForegroundColor Green

# ============================================
# 1. COPY WORKING SIDEBAR FROM JOURNAL TO DASHBOARD
# ============================================
Write-Host ""
Write-Host "Copying working sidebar from journal.html..." -ForegroundColor Yellow

$journalContent = Get-Content $journalHtml -Raw -Encoding UTF8
$dashboardContent = Get-Content $dashboardHtml -Raw -Encoding UTF8

# Extract sidebar from journal
if ($journalContent -match '(?s)<aside class="sidebar glass-morphism" id="sidebar">.*?</aside>') {
    $journalSidebar = $matches[0]
    
    # Replace sidebar in dashboard
    if ($dashboardContent -match '(?s)<aside class="sidebar glass-morphism" id="sidebar">.*?</aside>') {
        $dashboardContent = $dashboardContent -replace '(?s)<aside class="sidebar glass-morphism" id="sidebar">.*?</aside>', $journalSidebar
        Write-Host "Sidebar replaced successfully" -ForegroundColor Green
    }
}

# ============================================
# 2. COPY WORKING HEAD (CSS/THEME LINKS) FROM JOURNAL
# ============================================
Write-Host "Copying working head section from journal.html..." -ForegroundColor Yellow

if ($journalContent -match '(?s)<head>.*?</head>') {
    $journalHead = $matches[0]
    # Update title
    $journalHead = $journalHead -replace '<title>.*?</title>', '<title>Dashboard | ENVY</title>'
    
    if ($dashboardContent -match '(?s)<head>.*?</head>') {
        $dashboardContent = $dashboardContent -replace '(?s)<head>.*?</head>', $journalHead
        Write-Host "Head replaced successfully" -ForegroundColor Green
    }
}

# ============================================
# 3. ENSURE PAGE TITLE IS DASHBOARD
# ============================================
Write-Host "Setting page title to Dashboard..." -ForegroundColor Yellow
$dashboardContent = $dashboardContent -replace '<h1 class="page-title">.*?</h1>', '<h1 class="page-title">Dashboard</h1>'

# ============================================
# 4. SAVE DASHBOARD.HTML
# ============================================
Write-Host "Saving dashboard.html..." -ForegroundColor Yellow
[System.IO.File]::WriteAllText($dashboardHtml, $dashboardContent, [System.Text.UTF8Encoding]::new($true))
Write-Host "dashboard.html saved" -ForegroundColor Green

# ============================================
# 5. ENSURE THEME VARIABLES IN GLOBAL.CSS
# ============================================
Write-Host ""
Write-Host "Ensuring theme variables in global.css..." -ForegroundColor Yellow

$themeVars = @'
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
    --transition-fast: 150ms;
    --transition-base: 250ms;
    --shadow-glow: 0 0 20px rgba(156, 163, 175, 0.3);
}
'@

$globalContent = Get-Content $globalCss -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
if ($globalContent -notmatch ':root\s*\{') {
    $globalContent = $themeVars + "`r`n`r`n" + $globalContent
    [System.IO.File]::WriteAllText($globalCss, $globalContent, [System.Text.UTF8Encoding]::new($true))
    Write-Host "Theme variables added to global.css" -ForegroundColor Green
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
Write-Host "  - Sidebar copied from working journal"
Write-Host "  - Head/CSS links copied from journal"
Write-Host "  - Theme variables ensured"
Write-Host "  - Your working dashboard.js remains unchanged"
Write-Host ""
Write-Host "NEXT: Hard refresh (Ctrl+Shift+R)" -ForegroundColor Yellow
Write-Host ""
Write-Host "The dashboard will now have:" -ForegroundColor Cyan
Write-Host "  - Working emblem (same as journal)"
Write-Host "  - Working theme (same as journal)"
Write-Host "  - Your existing dashboard functionality"
Write-Host ""