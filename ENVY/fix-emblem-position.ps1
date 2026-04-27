# ENVY Emblem Position Fix Script
# Moves emblem beside ENVY text on auth and dashboard pages
# Run as: .\fix-emblem-position.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    ENVY EMBLEM POSITION FIX           " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create backup folder
$backupDir = "backup_emblem_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Write-Host "Backup folder: $backupDir" -ForegroundColor Green

# Function to backup a file
function Backup-File {
    param([string]$FilePath)
    if (Test-Path $FilePath) {
        $fileName = Split-Path $FilePath -Leaf
        $backupPath = Join-Path $backupDir $fileName
        Copy-Item $FilePath $backupPath -Force
        Write-Host "   Backed up: $fileName" -ForegroundColor Gray
        return $true
    }
    return $false
}

# ============================================
# FIX 1: Auth Page - Emblem beside ENVY
# ============================================
Write-Host ""
Write-Host "Fixing auth.html - Moving emblem beside ENVY..." -ForegroundColor Yellow

$authPath = "frontend\auth.html"
if (Test-Path $authPath) {
    Backup-File $authPath
    $content = Get-Content $authPath -Raw -Encoding UTF8
    
    # Replace the auth-brand section with horizontal layout
    $oldPattern = '(?s)<div class="auth-brand">.*?</div>'
    $newAuthBrand = @'
<div class="auth-brand">
    <div class="auth-brand-horizontal">
        <img src="assets/icons/envy-emblem.svg" alt="ENVY" class="auth-emblem-horizontal pulse-glow" id="siteEmblem">
        <h1 class="auth-title-horizontal">ENVY</h1>
    </div>
    <p class="auth-subtitle">Professional Crypto Trading Journal</p>
</div>
'@
    
    if ($content -match $oldPattern) {
        $content = $content -replace $oldPattern, $newAuthBrand
        Set-Content $authPath $content -Encoding UTF8 -NoNewline
        Write-Host "   Fixed: auth.html" -ForegroundColor Green
    }
}

# ============================================
# FIX 2: Dashboard - Emblem beside ENVY in sidebar
# ============================================
Write-Host ""
Write-Host "Fixing dashboard.html - Moving emblem beside ENVY..." -ForegroundColor Yellow

$dashPath = "frontend\dashboard.html"
if (Test-Path $dashPath) {
    Backup-File $dashPath
    $content = Get-Content $dashPath -Raw -Encoding UTF8
    
    # Update brand wrapper to horizontal layout
    $oldBrand = '(?s)<div class="brand-wrapper">.*?</div>'
    $newBrand = @'
<div class="brand-wrapper brand-wrapper-horizontal">
    <img src="assets/icons/envy-emblem.svg" alt="ENVY" class="brand-emblem-horizontal pulse-glow" id="siteEmblem">
    <span class="brand-text-horizontal" id="brandText">ENVY</span>
</div>
'@
    
    if ($content -match $oldBrand) {
        $content = $content -replace $oldBrand, $newBrand
        Set-Content $dashPath $content -Encoding UTF8 -NoNewline
        Write-Host "   Fixed: dashboard.html" -ForegroundColor Green
    }
}

# ============================================
# FIX 3: Journal Page
# ============================================
Write-Host ""
Write-Host "Fixing journal.html..." -ForegroundColor Yellow

$journalPath = "frontend\journal.html"
if (Test-Path $journalPath) {
    Backup-File $journalPath
    $content = Get-Content $journalPath -Raw -Encoding UTF8
    
    $oldBrand = '(?s)<div class="brand-wrapper">.*?</div>'
    $newBrand = @'
<div class="brand-wrapper brand-wrapper-horizontal">
    <img src="assets/icons/envy-emblem.svg" alt="ENVY" class="brand-emblem-horizontal pulse-glow" id="siteEmblem">
    <span class="brand-text-horizontal" id="brandText">ENVY</span>
</div>
'@
    
    if ($content -match $oldBrand) {
        $content = $content -replace $oldBrand, $newBrand
        Set-Content $journalPath $content -Encoding UTF8 -NoNewline
        Write-Host "   Fixed: journal.html" -ForegroundColor Green
    }
}

# ============================================
# FIX 4: Planner Page
# ============================================
Write-Host ""
Write-Host "Fixing planner.html..." -ForegroundColor Yellow

$plannerPath = "frontend\planner.html"
if (Test-Path $plannerPath) {
    Backup-File $plannerPath
    $content = Get-Content $plannerPath -Raw -Encoding UTF8
    
    $oldBrand = '(?s)<div class="brand-wrapper">.*?</div>'
    $newBrand = @'
<div class="brand-wrapper brand-wrapper-horizontal">
    <img src="assets/icons/envy-emblem.svg" alt="ENVY" class="brand-emblem-horizontal pulse-glow" id="siteEmblem">
    <span class="brand-text-horizontal" id="brandText">ENVY</span>
</div>
'@
    
    if ($content -match $oldBrand) {
        $content = $content -replace $oldBrand, $newBrand
        Set-Content $plannerPath $content -Encoding UTF8 -NoNewline
        Write-Host "   Fixed: planner.html" -ForegroundColor Green
    }
}

# ============================================
# FIX 5: Settings Page
# ============================================
Write-Host ""
Write-Host "Fixing settings.html..." -ForegroundColor Yellow

$settingsPath = "frontend\settings.html"
if (Test-Path $settingsPath) {
    Backup-File $settingsPath
    $content = Get-Content $settingsPath -Raw -Encoding UTF8
    
    $oldBrand = '(?s)<div class="brand-wrapper">.*?</div>'
    $newBrand = @'
<div class="brand-wrapper brand-wrapper-horizontal">
    <img src="assets/icons/envy-emblem.svg" alt="ENVY" class="brand-emblem-horizontal pulse-glow" id="siteEmblem">
    <span class="brand-text-horizontal" id="brandText">ENVY</span>
</div>
'@
    
    if ($content -match $oldBrand) {
        $content = $content -replace $oldBrand, $newBrand
        Set-Content $settingsPath $content -Encoding UTF8 -NoNewline
        Write-Host "   Fixed: settings.html" -ForegroundColor Green
    }
}

# ============================================
# FIX 6: Admin Page
# ============================================
Write-Host ""
Write-Host "Fixing admin.html..." -ForegroundColor Yellow

$adminPath = "frontend\admin.html"
if (Test-Path $adminPath) {
    Backup-File $adminPath
    $content = Get-Content $adminPath -Raw -Encoding UTF8
    
    $oldBrand = '(?s)<div class="brand-wrapper">.*?</div>'
    $newBrand = @'
<div class="brand-wrapper brand-wrapper-horizontal">
    <img src="assets/icons/envy-emblem.svg" alt="ENVY" class="brand-emblem-horizontal pulse-glow" id="siteEmblem">
    <span class="brand-text-horizontal" id="brandText">ENVY</span>
</div>
'@
    
    if ($content -match $oldBrand) {
        $content = $content -replace $oldBrand, $newBrand
        Set-Content $adminPath $content -Encoding UTF8 -NoNewline
        Write-Host "   Fixed: admin.html" -ForegroundColor Green
    }
}

# ============================================
# FIX 7: Add CSS for horizontal layout
# ============================================
Write-Host ""
Write-Host "Adding horizontal layout CSS..." -ForegroundColor Yellow

$cssPath = "frontend\css\global.css"
if (Test-Path $cssPath) {
    Backup-File $cssPath
    
    $horizontalCss = @'

/* ============================================ */
/* HORIZONTAL EMBLEM LAYOUT                     */
/* ============================================ */

/* Auth Page - Horizontal Layout */
.auth-brand-horizontal {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 15px !important;
}

.auth-emblem-horizontal {
    width: 48px !important;
    height: 48px !important;
    border-radius: var(--radius-md) !important;
    object-fit: contain !important;
}

.auth-title-horizontal {
    font-size: 42px !important;
    font-weight: 800 !important;
    background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-hover) 100%);
    -webkit-background-clip: text !important;
    -webkit-text-fill-color: transparent !important;
    background-clip: text !important;
    margin: 0 !important;
}

/* Sidebar - Horizontal Brand Layout */
.brand-wrapper-horizontal {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
}

.brand-emblem-horizontal {
    width: 40px !important;
    height: 40px !important;
    border-radius: var(--radius-md) !important;
    object-fit: contain !important;
    flex-shrink: 0 !important;
}

.brand-text-horizontal {
    font-size: 22px !important;
    font-weight: 700 !important;
    background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-hover) 100%);
    -webkit-background-clip: text !important;
    -webkit-text-fill-color: transparent !important;
    background-clip: text !important;
    white-space: nowrap !important;
}

/* Collapsed sidebar */
.sidebar.collapsed .brand-text-horizontal {
    display: none !important;
}

.sidebar.collapsed .brand-emblem-horizontal {
    width: 40px !important;
    height: 40px !important;
}

/* Mobile responsive */
@media (max-width: 768px) {
    .auth-title-horizontal {
        font-size: 32px !important;
    }
    
    .auth-emblem-horizontal {
        width: 40px !important;
        height: 40px !important;
    }
}

@media (max-width: 480px) {
    .auth-title-horizontal {
        font-size: 28px !important;
    }
}

'@
    
    Add-Content $cssPath "`r`n$horizontalCss" -Encoding UTF8
    Write-Host "   Added horizontal layout CSS to: global.css" -ForegroundColor Green
}

# ============================================
# SUMMARY
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "       EMBLEM POSITION FIX COMPLETE!    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "FIXES APPLIED:" -ForegroundColor Green
Write-Host "  - auth.html: Emblem now beside ENVY text"
Write-Host "  - dashboard.html: Emblem beside ENVY in sidebar"
Write-Host "  - journal.html: Emblem beside ENVY in sidebar"
Write-Host "  - planner.html: Emblem beside ENVY in sidebar"
Write-Host "  - settings.html: Emblem beside ENVY in sidebar"
Write-Host "  - admin.html: Emblem beside ENVY in sidebar"
Write-Host "  - global.css: Horizontal layout styles added"
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Hard refresh browser: Ctrl + Shift + R"
Write-Host "  2. Check the sign-in page - emblem should be beside ENVY"
Write-Host "  3. Check the dashboard - emblem beside ENVY in sidebar"
Write-Host ""
Write-Host "Backups saved in: $backupDir" -ForegroundColor Gray
Write-Host ""