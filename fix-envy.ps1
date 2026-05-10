# ENVY Auto-Fix Script
# Run as: .\fix-envy.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "       ENVY AUTO-FIX SCRIPT            " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create backup folder
$backupDir = "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
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
# FIX 1: Remove invalid preload from HTML files
# ============================================
Write-Host ""
Write-Host "Fixing HTML files..." -ForegroundColor Yellow

$htmlFiles = @(
    "frontend\dashboard.html",
    "frontend\journal.html",
    "frontend\planner.html",
    "frontend\settings.html",
    "frontend\admin.html"
)

foreach ($file in $htmlFiles) {
    if (Test-Path $file) {
        Backup-File $file
        $content = Get-Content $file -Raw -Encoding UTF8
        $content = $content -replace '<link rel="preload" as="document" href="components/sidebar.html">', ''
        Set-Content $file $content -Encoding UTF8 -NoNewline
        Write-Host "   Fixed: $file" -ForegroundColor Green
    }
}

# ============================================
# FIX 2: Add CSS to global.css
# ============================================
Write-Host ""
Write-Host "Fixing global.css..." -ForegroundColor Yellow

$globalCssPath = "frontend\css\global.css"
if (Test-Path $globalCssPath) {
    Backup-File $globalCssPath
    
    $cssFixes = @'

/* ============================================ */
/* AUTO-FIX: Logo and Avatar Sizes              */
/* ============================================ */

img#siteEmblem,
img.brand-emblem {
    width: 56px !important;
    height: 56px !important;
    max-width: none !important;
    object-fit: contain !important;
}

img#userAvatar,
img.user-avatar {
    width: 52px !important;
    height: 52px !important;
    max-width: none !important;
    object-fit: cover !important;
    border-radius: 50% !important;
    border: 2px solid var(--accent-primary) !important;
}

.sidebar.collapsed img#siteEmblem,
.sidebar.collapsed img.brand-emblem {
    width: 44px !important;
    height: 44px !important;
}

.sidebar.collapsed img#userAvatar,
.sidebar.collapsed img.user-avatar {
    width: 44px !important;
    height: 44px !important;
}

/* ============================================ */
/* AUTO-FIX: Fullscreen Layout                  */
/* ============================================ */

.main-content {
    width: calc(100% - 280px) !important;
    max-width: calc(100% - 280px) !important;
    margin-left: 0 !important;
    transition: width 0.2s ease, max-width 0.2s ease !important;
    overflow-x: hidden !important;
}

.sidebar.collapsed ~ .main-content,
.sidebar.collapsed + .main-content {
    width: calc(100% - 80px) !important;
    max-width: calc(100% - 80px) !important;
}

.dashboard-content,
.journal-content,
.planner-content,
.settings-content,
.admin-content {
    width: 100% !important;
    max-width: 100% !important;
}

@media (max-width: 768px) {
    .main-content,
    .sidebar.collapsed ~ .main-content,
    .sidebar.collapsed + .main-content,
    .sidebar:not(.collapsed) ~ .main-content,
    .sidebar:not(.collapsed) + .main-content {
        width: 100% !important;
        max-width: 100% !important;
    }
}

/* ============================================ */
/* AUTO-FIX: Hamburger Menu                     */
/* ============================================ */

.mobile-menu-btn {
    display: none !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
    gap: 5px !important;
    width: 44px !important;
    height: 44px !important;
    padding: 0 !important;
    background: transparent !important;
    border: none !important;
    cursor: pointer !important;
    z-index: 1000 !important;
}

.mobile-menu-btn span {
    display: block !important;
    width: 22px !important;
    height: 3px !important;
    background: var(--accent-secondary) !important;
    border-radius: 3px !important;
    transition: transform 0.2s ease, opacity 0.2s ease !important;
}

.mobile-menu-btn.active span:nth-child(1) {
    transform: translateY(8px) rotate(45deg) !important;
}

.mobile-menu-btn.active span:nth-child(2) {
    opacity: 0 !important;
}

.mobile-menu-btn.active span:nth-child(3) {
    transform: translateY(-8px) rotate(-45deg) !important;
}

@media (max-width: 768px) {
    .mobile-menu-btn {
        display: flex !important;
    }
}

.sidebar-overlay {
    position: fixed !important;
    top: 28px !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    background: rgba(0, 0, 0, 0.6) !important;
    backdrop-filter: blur(3px) !important;
    z-index: 99 !important;
    opacity: 0 !important;
    visibility: hidden !important;
    transition: opacity 0.2s ease, visibility 0.2s ease !important;
}

.sidebar-overlay.active {
    opacity: 1 !important;
    visibility: visible !important;
}

@media (max-width: 768px) {
    .sidebar {
        position: fixed !important;
        top: 28px !important;
        left: 0 !important;
        bottom: 0 !important;
        width: 280px !important;
        transform: translateX(-100%) !important;
        transition: transform 0.2s ease !important;
        z-index: 100 !important;
    }
    
    .sidebar.mobile-open {
        transform: translateX(0) !important;
        box-shadow: 0 0 30px rgba(0,0,0,0.5) !important;
    }
}

'@
    
    Add-Content $globalCssPath "`r`n$cssFixes" -Encoding UTF8
    Write-Host "   Added fixes to: global.css" -ForegroundColor Green
}

# ============================================
# FIX 3: Create SQL fix file
# ============================================
Write-Host ""
Write-Host "Creating SQL fix file..." -ForegroundColor Yellow

$sqlFix = @'
-- AUTO-FIX: User Settings Table Fix
-- Run this in Supabase SQL Editor

DROP TABLE IF EXISTS public.user_settings CASCADE;

CREATE TABLE public.user_settings (
    user_id UUID PRIMARY KEY,
    theme TEXT DEFAULT 'dark',
    accent_color TEXT DEFAULT '#9CA3AF',
    trading_mode TEXT DEFAULT 'spot',
    sound_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_settings DISABLE ROW LEVEL SECURITY;

GRANT ALL ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO anon;
GRANT ALL ON public.user_settings TO service_role;

SELECT 'User settings table fixed!' as result;
'@

$sqlFixPath = "database\fix-user-settings.sql"
Set-Content $sqlFixPath $sqlFix -Encoding UTF8
Write-Host "   Created: $sqlFixPath" -ForegroundColor Green

# ============================================
# FIX 4: Create global.js fix instructions
# ============================================
Write-Host ""
Write-Host "Creating JavaScript fix file..." -ForegroundColor Yellow

$jsFixInstructions = @'
// ============================================
// ENVY Mobile Menu Fix - Add to global.js
// ============================================
// Find the initializeMobileMenu function and replace it with this:

function initializeMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    
    if (!menuBtn || !sidebar) {
        console.log('Menu elements not found');
        return;
    }
    
    console.log('Mobile menu setup complete');
    
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }
    
    let isOpen = false;
    
    function openMenu() {
        isOpen = true;
        sidebar.classList.add('mobile-open');
        menuBtn.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    function closeMenu() {
        isOpen = false;
        sidebar.classList.remove('mobile-open');
        menuBtn.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    menuBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    };
    
    overlay.onclick = function() {
        closeMenu();
    };
    
    sidebar.querySelectorAll('a').forEach(link => {
        link.onclick = function() {
            setTimeout(closeMenu, 100);
        };
    });
    
    document.onkeydown = function(e) {
        if (e.key === 'Escape' && isOpen) {
            closeMenu();
        }
    };
    
    window.onresize = function() {
        if (window.innerWidth > 768 && isOpen) {
            closeMenu();
        }
    };
}
'@

$jsFixPath = "fix-mobile-menu.js"
Set-Content $jsFixPath $jsFixInstructions -Encoding UTF8
Write-Host "   Created: $jsFixPath" -ForegroundColor Green
Write-Host "   Copy this function into frontend/js/global.js" -ForegroundColor Yellow

# ============================================
# SUMMARY
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "            FIXES COMPLETE!             " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "FIXES APPLIED:" -ForegroundColor Green
Write-Host "  - HTML files: Invalid preload links removed"
Write-Host "  - global.css: Logo, layout, and hamburger styles added"
Write-Host ""
Write-Host "MANUAL STEPS REQUIRED:" -ForegroundColor Yellow
Write-Host "  1. Copy the function from fix-mobile-menu.js"
Write-Host "     into frontend/js/global.js (replace existing function)"
Write-Host "  2. Run database/fix-user-settings.sql in Supabase"
Write-Host "  3. Hard refresh browser: Ctrl + Shift + R"
Write-Host ""
Write-Host "Backups saved in: $backupDir" -ForegroundColor Gray
Write-Host ""