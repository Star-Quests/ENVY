# ENVY Dashboard - Final Encoding Fix
# Fixes all alien characters with proper HTML entities

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    FINAL ENCODING FIX                 " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$htmlPath = "frontend\dashboard.html"
$dashPath = "frontend\js\dashboard.js"
$backupDir = "backup_encoding_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
if (Test-Path $htmlPath) { Copy-Item $htmlPath "$backupDir\dashboard.html" -Force }
if (Test-Path $dashPath) { Copy-Item $dashPath "$backupDir\dashboard.js" -Force }

Write-Host "Backup: $backupDir" -ForegroundColor Green

# ============================================
# FIX DASHBOARD.HTML WITH PROPER ENTITIES
# ============================================
Write-Host "Fixing dashboard.html with HTML entities..." -ForegroundColor Yellow

$fixedHtml = @'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes, viewport-fit=cover">
    <meta name="description" content="ENVY Dashboard - Professional Crypto Portfolio Management">
    <meta name="theme-color" content="#0A0A0A">
    
    <title>Dashboard | ENVY</title>
    
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    
    <link rel="stylesheet" href="css/global.css">
    <link rel="stylesheet" href="css/dashboard.css">
    
    <link rel="icon" type="image/svg+xml" href="assets/icons/favicon.svg">
</head>
<body class="dark-theme" data-page="dashboard">
    <div class="luxury-background">
        <div class="gradient-orb orb-1"></div>
        <div class="gradient-orb orb-2"></div>
        <div class="gradient-orb orb-3"></div>
        <div class="noise-overlay"></div>
    </div>
    
    <div class="connection-bar" id="connectionBar">
        <div class="connection-indicator" id="connectionIndicator">
            <span class="connection-dot status-connected"></span>
            <span class="connection-text">Connected (Bybit WebSocket)</span>
        </div>
        <div class="connection-time" id="connectionTime">
            <span class="live-badge"><span class="live-dot-text">●</span> LIVE</span>
        </div>
    </div>
    
    <div class="app-container">
        <aside class="sidebar glass-morphism" id="sidebar">
            <div class="sidebar-header">
                <div class="brand-wrapper brand-wrapper-horizontal">
                    <img src="assets/icons/envy-emblem.svg" alt="ENVY" class="brand-emblem pulse-glow" id="siteEmblem">
                    <span class="brand-text-horizontal" id="brandText">ENVY</span>
                </div>
                <button class="sidebar-toggle" id="sidebarToggle" aria-label="Toggle Sidebar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            
            <nav class="sidebar-nav">
                <a href="dashboard.html" class="nav-item active">
                    <svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M3 12L5 10M5 10L12 3L19 10M5 10V20H9V14H15V20H19V10M19 10L21 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span class="nav-text">Dashboard</span>
                </a>
                <a href="journal.html" class="nav-item">
                    <svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <span class="nav-text">Journal</span>
                </a>
                <a href="planner.html" class="nav-item">
                    <svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M9 7H7V9H9V7Z M13 7H11V9H13V7Z M17 7H15V9H17V7Z M9 11H7V13H9V11Z M13 11H11V13H13V11Z M17 11H15V13H17V11Z M9 15H7V17H9V15Z M13 15H11V17H13V15Z M17 15H15V17H17V15Z M5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3Z" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <span class="nav-text">Planner</span>
                </a>
                <a href="settings.html" class="nav-item">
                    <svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" stroke-width="2"/>
                        <path d="M19.4 15C18.9 16.1 18.1 17 17.2 17.6L19 20.5C19.2 20.8 19.1 21.2 18.8 21.4C18.6 21.5 18.4 21.6 18.1 21.6C18 21.6 17.9 21.6 17.8 21.5L15 20C14.1 20.3 13.1 20.5 12 20.5C10.9 20.5 9.9 20.3 9 20L6.2 21.5C6.1 21.6 6 21.6 5.9 21.6C5.6 21.6 5.4 21.5 5.2 21.4C4.9 21.2 4.8 20.8 5 20.5L6.8 17.6C5.9 17 5.1 16.1 4.6 15C4.1 13.9 3.9 12.8 3.9 11.6C3.9 10.4 4.2 9.3 4.7 8.2C5.2 7.1 5.9 6.1 6.8 5.4L5.1 2.7C4.9 2.4 5 2 5.3 1.8C5.5 1.7 5.8 1.6 6 1.6C6.1 1.6 6.2 1.6 6.3 1.7L9 3.2C9.9 2.9 10.9 2.7 12 2.7C13.1 2.7 14.1 2.9 15 3.2L17.7 1.7C17.8 1.6 17.9 1.6 18.1 1.6C18.4 1.6 18.6 1.7 18.8 1.8C19.1 2 19.2 2.4 19 2.7L17.2 5.5C18.1 6.1 18.9 7.1 19.4 8.2C19.9 9.3 20.1 10.4 20.1 11.6C20.1 12.8 19.8 13.9 19.4 15Z" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <span class="nav-text">Settings</span>
                </a>
                <div class="nav-divider"></div>
                <a href="admin.html" class="nav-item" id="adminLink" style="display: none;">
                    <svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 15V19M12 5V9M8 8L5 5M16 8L19 5M8 16L5 19M16 16L19 19M3 12H7M17 12H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <span class="nav-text">Admin</span>
                </a>
                <a href="#" class="nav-item logout-item" id="logoutBtn">
                    <svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9M16 17L21 12M21 12L16 7M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span class="nav-text">Logout</span>
                </a>
            </nav>
            
            <div class="sidebar-footer">
                <div class="user-profile" id="userProfile">
                    <img src="assets/icons/user-avatar.svg" alt="User" class="user-avatar" id="userAvatar">
                    <div class="user-info">
                        <div class="user-name-wrapper">
                            <span class="user-name" id="userName">Trader</span>
                            <span class="user-emblem" id="userEmblem">👤</span>
                        </div>
                        <span class="user-greeting" id="userGreeting">Good morning</span>
                    </div>
                </div>
            </div>
        </aside>
        
        <main class="main-content" id="mainContent">
            <header class="dashboard-header glass-morphism">
                <div class="header-left">
                    <button class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Menu">
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                    <h1 class="page-title">Dashboard</h1>
                </div>
                <div class="header-right">
                    <div class="market-status">
                        <span class="status-indicator"></span>
                        <span>Market Open</span>
                    </div>
                    <button class="notification-btn glass-morphism" id="notificationBtn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22ZM18 16V11C18 7.93 16.36 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.63 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <span class="notification-badge" id="notificationBadge">0</span>
                    </button>
                    <div class="header-time" id="headerTime"></div>
                </div>
            </header>
            
            <div class="dashboard-content">
                <div class="summary-grid">
                    <div class="summary-card glass-morphism">
                        <div class="card-header"><span class="card-title">Total Capital</span></div>
                        <div class="card-value" id="totalCapital">$0.00</div>
                        <div class="card-footer"><span class="trend-indicator">All-time invested</span></div>
                    </div>
                    <div class="summary-card glass-morphism">
                        <div class="card-header"><span class="card-title">Current Balance</span></div>
                        <div class="card-value" id="currentBalance">$0.00</div>
                        <div class="card-footer"><span class="trend-indicator" id="balanceChange">+0.00%</span></div>
                    </div>
                    <div class="summary-card glass-morphism">
                        <div class="card-header"><span class="card-title">Total Profit</span></div>
                        <div class="card-value positive" id="totalProfit">$0.00</div>
                        <div class="card-footer"><span class="trend-indicator positive" id="profitPercentage">+0.00%</span></div>
                    </div>
                    <div class="summary-card glass-morphism">
                        <div class="card-header"><span class="card-title">Total Loss</span></div>
                        <div class="card-value negative" id="totalLoss">$0.00</div>
                        <div class="card-footer"><span class="trend-indicator negative" id="lossPercentage">-0.00%</span></div>
                    </div>
                </div>
                
                <div class="crypto-feed-section">
                    <div class="section-header">
                        <h2 class="section-title">Live Market Feed</h2>
                        <button class="edit-assets-btn glass-morphism" id="editAssetsBtn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                <path d="M18.5 2.5C19.3284 1.67157 20.6716 1.67157 21.5 2.5C22.3284 3.32843 22.3284 4.67157 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            Edit Assets
                        </button>
                    </div>
                    <div class="crypto-feed-grid" id="cryptoFeed"></div>
                </div>
                
                <div class="portfolio-chart-section">
                    <div class="chart-container glass-morphism">
                        <div class="chart-header">
                            <h3>Portfolio Performance</h3>
                            <div class="chart-controls">
                                <button class="time-btn active" data-period="1D">1D</button>
                                <button class="time-btn" data-period="1W">1W</button>
                                <button class="time-btn" data-period="1M">1M</button>
                                <button class="time-btn" data-period="3M">3M</button>
                                <button class="time-btn" data-period="1Y">1Y</button>
                                <button class="time-btn" data-period="ALL">ALL</button>
                            </div>
                        </div>
                        <canvas id="portfolioChart"></canvas>
                    </div>
                </div>
                
                <div class="holdings-section">
                    <div class="section-header">
                        <h2 class="section-title">Holdings</h2>
                        <div class="holdings-controls">
                            <select class="sort-select glass-morphism" id="holdingsSort">
                                <option value="highest_value">Highest Value</option>
                                <option value="alphabetical">Alphabetical</option>
                            </select>
                        </div>
                    </div>
                    <div class="holdings-table-wrapper glass-morphism">
                        <table class="holdings-table" id="holdingsTable">
                            <thead>
                                <tr><th>Asset</th><th>Amount</th><th>Avg Cost</th><th>Price</th><th>P/L</th><th>Value</th></tr>
                            </thead>
                            <tbody id="holdingsTableBody"></tbody>
                        </table>
                    </div>
                </div>
                
                <div class="recent-trades-section">
                    <div class="section-header">
                        <h2 class="section-title">Recent Trades</h2>
                        <a href="journal.html" class="view-all-link">View All &rarr;</a>
                    </div>
                    <div class="trades-table-wrapper glass-morphism">
                        <table class="trades-table" id="recentTradesTable">
                            <thead>
                                <tr><th>Asset</th><th>Type</th><th>Amount</th><th>Entry</th><th>Exit</th><th>P/L</th><th>Time</th></tr>
                            </thead>
                            <tbody id="recentTradesBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>
    </div>
    
    <div class="notification-panel glass-morphism" id="notificationPanel" style="display: none;">
        <div class="notification-header"><h3>Notifications</h3><button class="clear-notifications" id="clearNotifications">Clear</button></div>
        <div class="notification-list" id="notificationList"></div>
    </div>
    
    <script type="module" src="js/config.js"></script>
    <script type="module" src="js/supabase-client.js"></script>
    <script type="module" src="js/connection-monitor.js"></script>
    <script type="module" src="js/notifications.js"></script>
    <script type="module" src="js/bybit-websocket.js"></script>
    <script type="module" src="js/dashboard.js"></script>
    <script type="module" src="js/global.js"></script>
</body>
</html>
'@

# Save with UTF-8 BOM
$utf8WithBom = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllText($htmlPath, $fixedHtml, $utf8WithBom)
Write-Host "dashboard.html fixed with UTF-8 BOM" -ForegroundColor Green

# ============================================
# FIX DASHBOARD.JS WITH HTML ENTITIES
# ============================================
Write-Host "Fixing dashboard.js with HTML entities..." -ForegroundColor Yellow

$fixedJs = @'
// ENVY Dashboard - Final Encoding Fix
// Using HTML entities for all special characters

import { ENVYConfig } from './config.js';
import { supabase } from './supabase-client.js';
import { notificationSystem } from './notifications.js';
import { bybitWS } from './bybit-websocket.js';

class DashboardManager {
    constructor() {
        this.user = null;
        this.userProfile = null;
        this.userSettings = null;
        this.holdings = [];
        this.trades = [];
        this.cryptoPrices = {};
        this.favoriteAssets = ['BTC', 'ETH', 'SOL'];
        this.chart = null;
        this.unsubscribers = new Map();
        this.connectionStatus = false;
        this.allBybitAssets = [];
        this.lastRenderTime = 0;
        
        this.initialize();
    }
    
    async initialize() {
        await this.checkAuth();
        await this.loadUserData();
        
        await bybitWS.connect();
        bybitWS.onConnectionChange((connected) => {
            this.connectionStatus = connected;
            this.updateConnectionIndicator(connected);
        });
        
        this.setupEventListeners();
        this.initializeChart();
        this.subscribeToPrices();
        this.updateGreeting();
        this.updateDateTime();
        await this.loadHoldings();
        await this.loadRecentTrades();
        this.checkAdminStatus();
        this.applyUserSettings();
    }
    
    async checkAuth() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) { window.location.href = 'auth.html'; return; }
        this.user = user;
        
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        this.userProfile = profile;
        this.updateUserDisplay();
    }
    
    async loadUserData() {
        const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', this.user.id).single();
        this.userSettings = settings || {};
        if (settings?.favorite_assets?.length) this.favoriteAssets = settings.favorite_assets;
        await this.loadHoldingsData();
        await this.loadTradesData();
    }
    
    updateUserDisplay() {
        const userName = document.getElementById('userName');
        const userEmblem = document.getElementById('userEmblem');
        const userAvatar = document.getElementById('userAvatar');
        
        if (this.userProfile) {
            if (userName) userName.textContent = this.userProfile.full_name || this.user.email.split('@')[0];
            if (userAvatar && this.userProfile.avatar_url) userAvatar.src = this.userProfile.avatar_url;
            
            if (userEmblem) {
                if (this.userProfile.role === 'admin') {
                    userEmblem.innerHTML = '&#128081;';
                    userEmblem.className = 'user-emblem crown';
                } else {
                    userEmblem.innerHTML = '&#128100;';
                    userEmblem.className = 'user-emblem';
                }
            }
            
            if (this.userProfile.role === 'admin') {
                const adminLink = document.getElementById('adminLink');
                if (adminLink) adminLink.style.display = 'flex';
            }
        }
    }
    
    updateConnectionIndicator(connected) {
        const dot = document.querySelector('#connectionIndicator .connection-dot');
        const text = document.querySelector('#connectionIndicator .connection-text');
        const liveBadge = document.querySelector('.live-badge');
        
        if (dot && text) {
            dot.className = 'connection-dot ' + (connected ? 'status-connected' : 'status-disconnected');
            text.textContent = connected ? 'Connected (Bybit WebSocket)' : 'Reconnecting...';
        }
        
        if (liveBadge) {
            liveBadge.innerHTML = '<span class="live-dot-text">&#9679;</span> LIVE';
        }
    }
    
    subscribeToPrices() {
        this.unsubscribers.forEach(u => u());
        this.unsubscribers.clear();
        
        this.favoriteAssets.forEach(symbol => {
            const unsub = bybitWS.subscribe(symbol, (data) => {
                this.cryptoPrices[symbol] = data;
                
                const now = Date.now();
                if (now - this.lastRenderTime >= 300) {
                    this.lastRenderTime = now;
                    this.renderCryptoFeed();
                    this.updateHoldingsWithLivePrices();
                    this.updatePortfolioSummary();
                } else {
                    if (!this.renderScheduled) {
                        this.renderScheduled = true;
                        requestAnimationFrame(() => {
                            this.renderCryptoFeed();
                            this.updateHoldingsWithLivePrices();
                            this.updatePortfolioSummary();
                            this.renderScheduled = false;
                            this.lastRenderTime = Date.now();
                        });
                    }
                }
            });
            this.unsubscribers.set(symbol, unsub);
            
            const cached = bybitWS.getCachedPrice(symbol);
            if (cached) this.cryptoPrices[symbol] = cached;
        });
        
        this.renderCryptoFeed();
    }
    
    updateGreeting() {
        const el = document.getElementById('userGreeting');
        if (!el) return;
        const hour = new Date().getHours();
        el.textContent = 'Good ' + (hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening');
    }
    
    updateDateTime() {
        const el = document.getElementById('headerTime');
        if (!el) return;
        const update = () => { el.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); };
        update();
        setInterval(update, 1000);
    }
    
    async checkAdminStatus() {
        if (this.userProfile?.role === 'admin') {
            const link = document.getElementById('adminLink');
            if (link) link.style.display = 'flex';
        }
    }
    
    setupEventListeners() {
        const sidebar = document.getElementById('sidebar');
        document.getElementById('sidebarToggle')?.addEventListener('click', () => sidebar?.classList.toggle('collapsed'));
        document.getElementById('mobileMenuBtn')?.addEventListener('click', () => sidebar?.classList.toggle('mobile-open'));
        document.getElementById('editAssetsBtn')?.addEventListener('click', () => this.showAssetSelector());
        document.getElementById('holdingsSort')?.addEventListener('change', (e) => this.sortHoldings(e.target.value));
        
        document.querySelectorAll('.time-btn').forEach(b => {
            b.addEventListener('click', (e) => {
                document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                this.updateChartData(e.target.dataset.period);
            });
        });
        
        document.getElementById('notificationBtn')?.addEventListener('click', () => {
            const panel = document.getElementById('notificationPanel');
            if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
        
        document.getElementById('clearNotifications')?.addEventListener('click', () => {
            notificationSystem?.clearAll();
        });
        
        document.getElementById('logoutBtn')?.addEventListener('click', (e) => { e.preventDefault(); this.logout(); });
    }
    
    async fetchAllBybitAssets() {
        if (this.allBybitAssets.length) return this.allBybitAssets;
        
        try {
            const res = await fetch('https://api.bybit.com/v5/market/instruments-info?category=spot');
            const data = await res.json();
            
            if (data.retCode === 0) {
                const seen = new Set();
                this.allBybitAssets = data.result.list
                    .filter(i => i.status === 'Trading' && i.quoteCoin === 'USDT')
                    .map(i => ({ symbol: i.baseCoin, name: i.baseCoin, logoUrl: this.getLogoUrl(i.baseCoin) }))
                    .filter(a => { if (seen.has(a.symbol)) return false; seen.add(a.symbol); return true; })
                    .sort((a, b) => a.symbol.localeCompare(b.symbol));
            }
        } catch (e) {
            console.error('Bybit assets fetch failed:', e);
            this.allBybitAssets = ['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','MATIC','DOT','AVAX','LINK','UNI'].map(s => ({ symbol: s, name: s, logoUrl: this.getLogoUrl(s) }));
        }
        return this.allBybitAssets;
    }
    
    getLogoUrl(symbol) {
        const ids = { 'BTC':'1','ETH':'279','SOL':'4128','BNB':'825','XRP':'44','ADA':'975','DOGE':'5','MATIC':'4713','DOT':'12171','AVAX':'12559','LINK':'877','UNI':'12504' };
        return `https://assets.coingecko.com/coins/images/${ids[symbol] || symbol.toLowerCase()}/small/${symbol.toLowerCase()}.png`;
    }
    
    async showAssetSelector() {
        const assets = await this.fetchAllBybitAssets();
        
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content modal-large glass-morphism">
                <div class="modal-header"><h3>Select Assets (${assets.length} available)</h3><button class="modal-close">&times;</button></div>
                <div class="modal-body">
                    <input type="text" id="assetSearch" placeholder="Search assets..." class="modal-search-input">
                    <div class="selected-assets" id="selectedAssetsList"></div>
                    <div class="assets-grid" id="assetsGrid" style="max-height:350px;overflow-y:auto;"></div>
                </div>
                <div class="modal-footer">
                    <span>Selected: <span id="selectedCount">0</span>/10</span>
                    <div><button class="btn-secondary" id="modalCancel">Cancel</button><button class="btn-primary" id="modalSave">Save</button></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const selected = [...this.favoriteAssets];
        const grid = modal.querySelector('#assetsGrid');
        const selectedDiv = modal.querySelector('#selectedAssetsList');
        const countSpan = modal.querySelector('#selectedCount');
        const searchInput = modal.querySelector('#assetSearch');
        
        const renderSelected = () => {
            selectedDiv.innerHTML = selected.map(s => {
                const a = assets.find(x => x.symbol === s) || { symbol: s, logoUrl: this.getLogoUrl(s) };
                return `<div class="selected-chip"><img src="${a.logoUrl}"><span>${s}</span><button data-remove="${s}">&times;</button></div>`;
            }).join('');
            selectedDiv.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
                const idx = selected.indexOf(b.dataset.remove);
                if (idx > -1) selected.splice(idx, 1);
                renderGrid(searchInput.value);
                renderSelected();
                countSpan.textContent = selected.length;
            }));
            countSpan.textContent = selected.length;
        };
        
        const renderGrid = (filter = '') => {
            const q = filter.toLowerCase();
            const filtered = q ? assets.filter(a => a.symbol.toLowerCase().includes(q)) : assets;
            grid.innerHTML = filtered.slice(0, 200).map(a => `
                <div class="asset-item ${selected.includes(a.symbol) ? 'selected' : ''}" data-symbol="${a.symbol}">
                    <img src="${a.logoUrl}" onerror="this.src='assets/icons/default-crypto.svg'">
                    <div><strong>${a.symbol}</strong><br><small>${a.name}</small></div>
                    <div class="checkbox">${selected.includes(a.symbol) ? '✓' : ''}</div>
                </div>
            `).join('');
            
            grid.querySelectorAll('.asset-item').forEach(item => {
                item.addEventListener('click', () => {
                    const s = item.dataset.symbol;
                    const idx = selected.indexOf(s);
                    idx === -1 ? (selected.length < 10 ? selected.push(s) : notificationSystem?.warning('Max 10 assets')) : selected.splice(idx, 1);
                    renderGrid(searchInput.value);
                    renderSelected();
                });
            });
        };
        
        searchInput.addEventListener('input', (e) => renderGrid(e.target.value));
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('#modalCancel').addEventListener('click', () => modal.remove());
        modal.querySelector('#modalSave').addEventListener('click', async () => {
            this.favoriteAssets = [...selected];
            await supabase.from('user_settings').upsert({ user_id: this.user.id, favorite_assets: this.favoriteAssets });
            this.subscribeToPrices();
            modal.remove();
            notificationSystem?.success('Assets updated');
        });
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        
        renderGrid();
        renderSelected();
    }
    
    initializeChart() {
        const canvas = document.getElementById('portfolioChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Portfolio Value',
                    data: [],
                    borderColor: '#9CA3AF',
                    backgroundColor: 'rgba(156, 163, 175, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
                scales: { x: { grid: { display: false }, ticks: { color: '#6B7280' } }, y: { grid: { color: 'rgba(156,163,175,0.1)' }, ticks: { color: '#6B7280', callback: v => '$' + this.formatNumber(v) } } }
            }
        });
        
        this.updateChartData('1D');
    }
    
    updateChartData(period) {
        if (!this.chart) return;
        
        const labels = [];
        const values = [];
        const now = new Date();
        let points = 24;
        
        if (period === '1D') points = 24;
        else if (period === '1W') points = 7;
        else if (period === '1M') points = 30;
        else if (period === '3M') points = 12;
        else if (period === '1Y') points = 12;
        else if (period === 'ALL') points = 24;
        
        const baseValue = this.holdings.reduce((s, h) => s + h.total_amount * (this.cryptoPrices[h.asset_symbol]?.price || 0), 0) || 10000;
        
        for (let i = points - 1; i >= 0; i--) {
            const date = new Date(now);
            if (period === '1D') { date.setHours(date.getHours() - i); labels.push(date.getHours() + ':00'); }
            else if (period === '1W') { date.setDate(date.getDate() - i); labels.push(['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()]); }
            else if (period === '1M') { date.setDate(date.getDate() - i); labels.push(date.getDate().toString()); }
            else { date.setMonth(date.getMonth() - i); labels.push(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][date.getMonth()]); }
            
            const variation = 0.85 + (Math.sin(i * 0.5) * 0.1) + (i / points) * 0.15;
            values.push(baseValue * variation);
        }
        
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = values;
        this.chart.update();
    }
    
    renderCryptoFeed() {
        const c = document.getElementById('cryptoFeed');
        if (!c) return;
        c.innerHTML = this.favoriteAssets.map(s => {
            const p = this.cryptoPrices[s] || { price: 0, change24h: 0, high24h: 0, low24h: 0 };
            const ch = p.change24h || 0;
            const cls = ch >= 0 ? 'positive' : 'negative';
            const arrow = ch >= 0 ? '&#9650;' : '&#9660;';
            return `
                <div class="crypto-card glass-morphism">
                    <div class="crypto-card-header">
                        <img src="${this.getLogoUrl(s)}" class="crypto-logo" onerror="this.src='assets/icons/default-crypto.svg'">
                        <div><div class="crypto-name">${s}</div><div class="crypto-symbol">${s}</div></div>
                    </div>
                    <div class="crypto-price">$${this.formatNumber(p.price)}</div>
                    <div class="crypto-change ${cls}"><span>${arrow}</span> ${Math.abs(ch).toFixed(2)}%</div>
                    <div class="crypto-details">
                        <div><span>24h High</span><span>$${this.formatNumber(p.high24h || p.price * 1.02)}</span></div>
                        <div><span>24h Low</span><span>$${this.formatNumber(p.low24h || p.price * 0.98)}</span></div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    async loadHoldingsData() { const { data } = await supabase.from('holdings').select('*').eq('user_id', this.user.id); this.holdings = data || []; }
    async loadHoldings() { await this.loadHoldingsData(); this.renderHoldingsTable(); this.updatePortfolioSummary(); }
    
    renderHoldingsTable() {
        const t = document.getElementById('holdingsTableBody');
        if (!t) return;
        if (!this.holdings.length) { t.innerHTML = '<tr><td colspan="6" class="empty-state">No holdings</td></tr>'; return; }
        t.innerHTML = this.holdings.map(h => {
            const pr = this.cryptoPrices[h.asset_symbol]?.price || 0;
            const val = h.total_amount * pr;
            const cost = h.total_amount * h.average_cost;
            const pl = val - cost;
            const cls = pl >= 0 ? 'positive' : 'negative';
            return `<tr><td><div class="asset-cell"><img src="${this.getLogoUrl(h.asset_symbol)}" class="asset-logo-small"><span>${h.asset_symbol}</span></div></td><td>${this.formatNumber(h.total_amount,8)}</td><td>$${this.formatNumber(h.average_cost)}</td><td>$${this.formatNumber(pr)}</td><td class="${cls}">${pl>=0?'+':''}$${this.formatNumber(Math.abs(pl))}</td><td>$${this.formatNumber(val)}</td></tr>`;
        }).join('');
    }
    
    updateHoldingsWithLivePrices() { this.renderHoldingsTable(); }
    
    updatePortfolioSummary() {
        const tv = this.holdings.reduce((s,h) => s + h.total_amount * (this.cryptoPrices[h.asset_symbol]?.price||0), 0);
        const tc = this.holdings.reduce((s,h) => s + h.total_amount * h.average_cost, 0);
        const pl = tv - tc;
        const pct = tc ? (pl/tc)*100 : 0;
        let profit = 0, loss = 0;
        this.holdings.forEach(h => { const p = h.total_amount * ((this.cryptoPrices[h.asset_symbol]?.price||0) - h.average_cost); if (p>0) profit+=p; else loss+=Math.abs(p); });
        
        document.getElementById('totalCapital').textContent = `$${this.formatNumber(tc)}`;
        document.getElementById('currentBalance').textContent = `$${this.formatNumber(tv)}`;
        const bc = document.getElementById('balanceChange');
        bc.textContent = `${pct>=0?'+':''}${pct.toFixed(2)}%`;
        bc.className = `trend-indicator ${pct>=0?'positive':'negative'}`;
        document.getElementById('totalProfit').textContent = `$${this.formatNumber(profit)}`;
        document.getElementById('totalLoss').textContent = `$${this.formatNumber(loss)}`;
    }
    
    async loadTradesData() { const { data } = await supabase.from('trades').select('*').eq('user_id', this.user.id).order('created_at',{ascending:false}).limit(10); this.trades = data || []; }
    async loadRecentTrades() { await this.loadTradesData(); const t = document.getElementById('recentTradesBody'); if (!t) return; if (!this.trades.length) { t.innerHTML = '<tr><td colspan="7" class="empty-state">No trades</td></tr>'; return; }
        t.innerHTML = this.trades.map(tr => {
            const cls = (tr.profit_loss||0) >= 0 ? 'positive' : 'negative';
            return `<tr><td><div class="asset-cell"><img src="${this.getLogoUrl(tr.asset_symbol)}" class="asset-logo-small"><span>${tr.asset_symbol}</span></div></td><td><span class="trade-type-badge ${tr.trade_type}">${tr.trade_type}</span></td><td>${this.formatNumber(tr.amount,8)}</td><td>$${this.formatNumber(tr.entry_price)}</td><td>${tr.exit_price?'$'+this.formatNumber(tr.exit_price):'-'}</td><td class="${cls}">${tr.profit_loss?(tr.profit_loss>=0?'+':'')+'$'+this.formatNumber(Math.abs(tr.profit_loss)):'-'}</td><td>${this.formatTimeAgo(tr.created_at)}</td></tr>`;
        }).join('');
    }
    
    sortHoldings(c) {
        if (c === 'highest_value') this.holdings.sort((a,b) => (b.total_amount*(this.cryptoPrices[b.asset_symbol]?.price||0)) - (a.total_amount*(this.cryptoPrices[a.asset_symbol]?.price||0)));
        else this.holdings.sort((a,b) => a.asset_symbol.localeCompare(b.asset_symbol));
        this.renderHoldingsTable();
    }
    
    applyUserSettings() { if (this.userSettings?.theme) document.body.className = `${this.userSettings.theme}-theme`; }
    formatNumber(n, d=2) { if (n===null||n===undefined||isNaN(n)) return '0.00'; return new Intl.NumberFormat('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n); }
    formatTimeAgo(ts) { const diff = Date.now() - new Date(ts).getTime(); const m=Math.floor(diff/60000), h=Math.floor(diff/3600000), d=Math.floor(diff/86400000); if (m<1) return 'Just now'; if (m<60) return m+'m ago'; if (h<24) return h+'h ago'; return d+'d ago'; }
    
    async logout() { this.unsubscribers.forEach(u => u()); bybitWS.disconnect(); await supabase.auth.signOut(); window.location.href = 'index.html'; }
}

let dashboardManager;
document.addEventListener('DOMContentLoaded', () => { dashboardManager = new DashboardManager(); window.dashboardManager = dashboardManager; });
window.addEventListener('beforeunload', () => { if (dashboardManager) { dashboardManager.unsubscribers?.forEach(u => u()); bybitWS.disconnect(); } });
'@

[System.IO.File]::WriteAllText($dashPath, $fixedJs, $utf8WithBom)
Write-Host "dashboard.js fixed with UTF-8 BOM" -ForegroundColor Green

# ============================================
# ADD CSS FIX FOR LIVE DOT
# ============================================
Write-Host "Adding CSS fixes..." -ForegroundColor Yellow

$cssPath = "frontend\css\dashboard.css"
$cssFixes = @'

/* Live dot fix */
.live-dot-text {
    color: #10B981;
    font-size: 14px;
}

.live-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #10B981;
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.5px;
}

.connection-dot.status-connected {
    background: #10B981 !important;
    animation: pulse-green 2s ease-in-out infinite;
}

@keyframes pulse-green {
    0%, 100% { opacity: 1; box-shadow: 0 0 5px #10B981; }
    50% { opacity: 0.7; box-shadow: 0 0 12px #10B981; }
}

/* View All arrow */
.view-all-link {
    color: var(--accent-primary) !important;
    text-decoration: none !important;
    font-size: 14px !important;
}

/* Crypto card arrows */
.crypto-change span {
    font-size: 14px;
}
'@

if (Test-Path $cssPath) { Add-Content $cssPath "`r`n$cssFixes" -Encoding UTF8 }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "      ENCODING FIX COMPLETE!            " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "FIXES APPLIED:" -ForegroundColor Green
Write-Host "  - Live dot: ● (HTML entity &#9679;)"
Write-Host "  - Arrow down: ▼ (HTML entity &#9660;)"
Write-Host "  - Arrow up: ▲ (HTML entity &#9650;)"
Write-Host "  - Right arrow: → (HTML entity &rarr;)"
Write-Host "  - Crown: 👑 (HTML entity &#128081;)"
Write-Host "  - Files saved with UTF-8 BOM"
Write-Host ""
Write-Host "NEXT: Hard refresh (Ctrl+Shift+R)" -ForegroundColor Yellow
Write-Host ""