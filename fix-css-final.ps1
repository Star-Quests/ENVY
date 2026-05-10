# Clean up global.css - Remove duplicate :root blocks

$cssPath = "frontend\css\global.css"
$backupPath = "backup_global_$(Get-Date -Format 'yyyyMMdd_HHmmss').css"

Copy-Item $cssPath $backupPath -Force
Write-Host "Backup saved: $backupPath" -ForegroundColor Green

$cleanCss = @'
/* ENVY Global Styles - Clean Version */
:root {
    /* Dark Theme Colors */
    --bg-primary: #0A0A0A;
    --bg-secondary: #111111;
    --bg-tertiary: #1A1A1A;
    --bg-elevated: #222222;
    
    /* Accent - Can be overridden by JS */
    --accent-primary: #9CA3AF;
    --accent-secondary: #D1D5DB;
    --accent-hover: #E5E7EB;
    --accent-muted: #6B7280;
    
    /* Status Colors */
    --success: #10B981;
    --error: #EF4444;
    --warning: #F59E0B;
    --info: #3B82F6;
    
    /* Glass Morphism */
    --glass-bg: rgba(17, 17, 17, 0.7);
    --glass-border: rgba(156, 163, 175, 0.1);
    --glass-blur: blur(12px);
    
    /* Typography */
    --font-primary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --font-mono: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
    --base-font-size: clamp(14px, 4vw, 16px);
    
    /* Spacing */
    --spacing-xs: 0.25rem;
    --spacing-sm: 0.5rem;
    --spacing-md: 1rem;
    --spacing-lg: 1.5rem;
    --spacing-xl: 2rem;
    --spacing-2xl: 3rem;
    --spacing-responsive: clamp(0.5rem, 2vw, 2rem);
    
    /* Border Radius */
    --radius-sm: 0.375rem;
    --radius-md: 0.5rem;
    --radius-lg: 0.75rem;
    --radius-xl: 1rem;
    --radius-2xl: 1.5rem;
    --radius-full: 9999px;
    
    /* Transitions */
    --transition-fast: 150ms ease;
    --transition-base: 250ms ease;
    --transition-slow: 350ms ease;
    
    /* Shadows */
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    --shadow-glow: 0 0 20px rgba(156, 163, 175, 0.3);
    
    /* Z-Index */
    --z-dropdown: 100;
    --z-sticky: 200;
    --z-fixed: 300;
    --z-modal: 400;
    --z-popover: 500;
    --z-tooltip: 600;
}

* { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

html {
    font-size: var(--base-font-size);
    -webkit-text-size-adjust: 100%;
    scroll-behavior: smooth;
    overflow-x: hidden;
}

body {
    font-family: var(--font-primary);
    background-color: var(--bg-primary);
    color: var(--accent-secondary);
    line-height: 1.6;
    min-height: 100vh;
    overflow-x: hidden;
}

img { max-width: 100%; height: auto; }

.glass-morphism {
    background: var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-lg);
}

h1, h2, h3, h4, h5, h6 { font-weight: 600; color: var(--accent-hover); }

.gradient-text {
    background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-hover) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.positive { color: var(--success) !important; }
.negative { color: var(--error) !important; }

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--bg-secondary); }
::-webkit-scrollbar-thumb { background: var(--accent-muted); border-radius: var(--radius-full); }

.spinner {
    width: 40px; height: 40px;
    border: 3px solid var(--glass-border);
    border-top-color: var(--accent-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
@keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 10px rgba(156, 163, 175, 0.3); }
    50% { box-shadow: 0 0 20px rgba(156, 163, 175, 0.5); }
}

.status-connected { animation: pulse-connected 2s ease-in-out infinite; }
@keyframes pulse-connected {
    0%, 100% { opacity: 1; box-shadow: 0 0 10px var(--success); }
    50% { opacity: 0.7; box-shadow: 0 0 20px var(--success); }
}

.connection-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 20px; height: 28px;
    background: var(--glass-bg); backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--glass-border);
}
.connection-dot { width: 8px; height: 8px; border-radius: 50%; }
.connection-dot.status-connected { background: #10B981; }
.live-badge { color: #10B981; font-weight: 600; font-size: 12px; }

.brand-wrapper-horizontal { display: flex; align-items: center; gap: 12px; }
.brand-emblem-horizontal { width: 40px; height: 40px; border-radius: var(--radius-md); object-fit: contain; flex-shrink: 0; }
.brand-text-horizontal {
    font-size: 22px; font-weight: 700;
    background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-hover) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}

.sidebar {
    width: 280px; transition: transform 0.2s ease;
    transform: translateZ(0); -webkit-transform: translateZ(0);
}
.sidebar.collapsed { width: 80px; }
.sidebar.collapsed .brand-text-horizontal { display: none; }

.main-content { flex: 1; width: calc(100% - 280px); transition: width 0.2s; }
.sidebar.collapsed ~ .main-content { width: calc(100% - 80px); }

.mobile-menu-btn { display: none; }
@media (max-width: 768px) {
    .mobile-menu-btn { display: flex; }
    .sidebar { position: fixed; top: 28px; left: 0; bottom: 0; transform: translateX(-100%); z-index: 100; }
    .sidebar.mobile-open { transform: translateX(0); box-shadow: 0 0 30px rgba(0,0,0,0.5); }
    .main-content, .sidebar ~ .main-content { width: 100% !important; }
}

.user-avatar { width: 52px; height: 52px; border-radius: 50%; border: 2px solid var(--accent-primary); object-fit: cover; }
.user-emblem.crown { color: #FBBF24 !important; filter: drop-shadow(0 0 6px rgba(251,191,36,0.5)); }

.hidden { display: none !important; }
.flex { display: flex; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.w-full { width: 100%; }
.h-full { height: 100%; }
'@

Set-Content $cssPath $cleanCss -Encoding UTF8
Write-Host "global.css cleaned! Only ONE :root block now." -ForegroundColor Green
Write-Host ""
Write-Host "NEXT: Hard refresh (Ctrl+Shift+R)" -ForegroundColor Yellow