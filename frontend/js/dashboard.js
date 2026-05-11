// ENVY Dashboard - Final Encoding Fix
// Using HTML entities for all special characters

import { ENVYConfig } from './config.js';
import { supabase } from './supabase-client.js';
import { notificationSystem } from './notifications.js';
import { bybitWS } from './bybit-websocket.js';
import { getAssetLogoUrl } from './crypto-logos.js';
import { siteSettings } from './site-settings.js'; 
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
    // Show loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'dashboard-loading-overlay';
    loadingOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #0A0A0A;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 1;
        transition: opacity 0.3s ease;
    `;
    loadingOverlay.innerHTML = `
        <div style="text-align: center;">
            <div class="spinner" style="width: 48px; height: 48px; margin: 0 auto 16px;"></div>
            <p style="color: #9CA3AF; font-family: 'Inter', sans-serif;">Loading Dashboard...</p>
        </div>
    `;
    document.body.appendChild(loadingOverlay);
    document.body.style.overflow = 'hidden';
    
        try {
        // ==========================================
        // CHECK MAINTENANCE MODE FIRST
        // ==========================================
        const access = await siteSettings.checkAccess();
        
        if (!access.allowed) {
    loadingOverlay.remove();
    document.body.style.overflow = '';
    
    // Show login button if user is not logged in
    const showLogin = access.redirectToAuth === true;
    siteSettings.showMaintenancePage(access.message, showLogin);
    return;
}
        
        // ==========================================
        // CHECK FOR ANNOUNCEMENTS
        // ==========================================
        const announcement = await siteSettings.getAnnouncement();
        if (announcement) {
            siteSettings.showAnnouncementBanner(announcement);
        }
        
        // Continue with normal dashboard initialization
        await this.checkAuth();
        await this.loadUserData();
        
                                // REST API polling only - no WebSocket
        this.updateConnectionIndicator(true);
        
        this.setupEventListeners();
        this.initializeChart();
                // this.subscribeToPrices(); // Disabled - no WebSocket
        this.startPricePolling();
        this.updateGreeting();
        this.updateDateTime();
        await this.loadHoldings();
        await this.loadRecentTrades();
        this.checkAdminStatus();
        
        await this.applyUserSettings();

                // Listen for updates from journal
        window.addEventListener('storage', (e) => {
            if (e.key === 'envy_journal_update') {
                this.loadHoldings();
                this.loadRecentTrades();
            }
        });

        // 🔄 AUTO-REFRESH HOLDINGS WHEN USER RETURNS TO DASHBOARD
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    this.loadHoldings();
                    this.loadRecentTrades();
                }
            });
            
            window.addEventListener('focus', () => {
                this.loadHoldings();
                this.loadRecentTrades();
            });
    } finally {
        // Remove loading overlay
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.remove();
            document.body.style.overflow = '';
        }, 300);
    }
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
    // Load user settings
    const { data: settings } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', this.user.id)
        .single();
        
    this.userSettings = settings || {};
    
    if (settings?.favorite_assets) {
        this.favoriteAssets = settings.favorite_assets;
    }
    
    // APPLY SETTINGS IMMEDIATELY AFTER LOADING
    this.applyUserSettings();
    
    // Load holdings
    await this.loadHoldingsData();
    
    // Load trades
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
            text.textContent = 'Live (REST API)';
        }
        
        if (liveBadge) {
            liveBadge.innerHTML = '<span style="color: #10B981;">&#9679;</span> LIVE';
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

    
    startPricePolling() {
    if (this.priceUpdateInterval) clearInterval(this.priceUpdateInterval);
    
    this.fetchBybitPricesNow();
    this.priceUpdateInterval = setInterval(() => this.fetchBybitPricesNow(), 5000);
}

async fetchBybitPricesNow() {
    try {
        // Fetch each symbol individually
        for (const symbol of this.favoriteAssets) {
            const res = await fetch(`/api/proxy/bybit-prices?symbols=${symbol}USDT`);
            const data = await res.json();
            
            if (data.retCode === 0 && data.result && data.result.list) {
                const ticker = data.result.list[0];
                this.cryptoPrices[symbol] = {
                    price: parseFloat(ticker.lastPrice) || 0,
                    change24h: (parseFloat(ticker.price24hPcnt) * 100) || 0,
                    high24h: parseFloat(ticker.highPrice24h) || 0,
                    low24h: parseFloat(ticker.lowPrice24h) || 0
                };
            }
        }
        this.renderCryptoFeed();
        this.updateHoldingsWithLivePrices();
        this.updatePortfolioSummary();
        this.updateChartLive();
    } catch (e) {
        console.error('Bybit fetch error:', e);
    }
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
        document.getElementById('sidebarToggle')?.addEventListener('click', async () => {
    sidebar?.classList.toggle('collapsed');
    const isCollapsed = sidebar?.classList.contains('collapsed');
    
    // Save to localStorage
    localStorage.setItem('sidebarCollapsed', isCollapsed);
    
    // Save to database
    if (this.user) {
        await supabase
            .from('user_settings')
            .upsert({
                user_id: this.user.id,
                sidebar_collapsed: isCollapsed,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
    }
});
        document.getElementById('mobileMenuBtn')?.addEventListener('click', () => sidebar?.classList.toggle('mobile-open'));
        document.getElementById('editAssetsBtn')?.addEventListener('click', () => this.showAssetSelector());
        document.getElementById('holdingsSort')?.addEventListener('change', (e) => this.sortHoldings(e.target.value));
        
        document.querySelectorAll('.time-btn').forEach(b => {
    b.addEventListener('click', (e) => {
        document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        this.loadChartData(e.target.dataset.period);
    });
});
        
                const notifBtn = document.getElementById('notificationBtn');
        const notifPanel = document.getElementById('notificationPanel');
        
        if (notifBtn && notifPanel) {
            notifBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                notifPanel.style.display = notifPanel.style.display === 'none' ? 'block' : 'none';
            });
            
            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (!notifPanel.contains(e.target) && e.target !== notifBtn) {
                    notifPanel.style.display = 'none';
                }
            });
        }
        
        document.getElementById('clearNotifications')?.addEventListener('click', () => {
            notificationSystem?.clearAll();
        });
        
        document.getElementById('logoutBtn')?.addEventListener('click', (e) => { e.preventDefault(); this.logout(); });
    }
    
    async fetchAllBybitAssets() {
        if (this.allBybitAssets.length) return this.allBybitAssets;
        
        try {
            const res = await fetch('/api/proxy/bybit-assets');
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
    return getAssetLogoUrl(symbol);
}

getCoinGeckoName(symbol) {
    // No longer needed - kept for compatibility
    return symbol.toLowerCase();
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
                    <div class="checkbox">${selected.includes(a.symbol) ? 'âœ“' : ''}</div>
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
            this.startPricePolling();
            modal.remove();
            notificationSystem?.success('Assets updated');
        });
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        
        renderGrid();
        renderSelected();
    }
    
            // =============================================
    // TRADINGVIEW-STYLE PORTFOLIO CHART
    // =============================================
    
    initializeChart() {
        const canvas = document.getElementById('portfolioChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (this.chart) this.chart.destroy();
        
        const totalValue = this.calculateTotalPortfolioValue();
        const totalCost = this.calculateTotalCost();
        const isProfitable = totalValue >= totalCost;
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    // Main price line
                    {
                        label: 'Portfolio',
                        data: [],
                        borderColor: '#9CA3AF',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        tension: 0,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: '#FFFFFF',
                        pointHoverBorderColor: isProfitable ? '#10B981' : '#EF4444',
                        pointHoverBorderWidth: 3,
                        order: 2
                    },
                    // Gradient fill under line
                    {
                        label: 'Fill',
                        data: [],
                        borderColor: 'transparent',
                        backgroundColor: isProfitable ? 'rgba(16, 185, 129, 0.10)' : 'rgba(239, 68, 68, 0.10)',
                        borderWidth: 0,
                        tension: 0,
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        order: 3
                    },
                    // Buy markers
                    {
                        label: 'Buy',
                        data: [],
                        borderColor: '#10B981',
                        backgroundColor: '#10B981',
                        borderWidth: 2,
                        tension: 0,
                        pointRadius: 6,
                        pointHoverRadius: 10,
                        pointStyle: 'triangle',
                        pointRotation: 0,
                        showLine: false,
                        order: 1
                    },
                    // Sell markers
                    {
                        label: 'Sell',
                        data: [],
                        borderColor: '#EF4444',
                        backgroundColor: '#EF4444',
                        borderWidth: 2,
                        tension: 0,
                        pointRadius: 6,
                        pointHoverRadius: 10,
                        pointStyle: 'triangle',
                        pointRotation: 180,
                        showLine: false,
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1A1A1A',
                        titleColor: '#E5E7EB',
                        bodyColor: '#D1D5DB',
                        borderColor: '#9CA3AF',
                        borderWidth: 1,
                        padding: 14,
                        titleFont: { size: 13, weight: '600' },
                        bodyFont: { size: 14, weight: '500' },
                        callbacks: {
                            label: (ctx) => {
                                if (ctx.dataset.label === 'Buy') {
                                    return '🟢 BUY: ' + (ctx.raw.tradeInfo || '');
                                }
                                if (ctx.dataset.label === 'Sell') {
                                    return '🔴 SELL: ' + (ctx.raw.tradeInfo || '');
                                }
                                return ' $' + ctx.parsed.y.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                });
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { 
                            color: 'rgba(156, 163, 175, 0.06)',
                            drawBorder: false
                        },
                        ticks: { 
                            color: '#6B7280', 
                            maxRotation: 0, 
                            font: { size: 11 },
                            maxTicksLimit: 8
                        }
                    },
                    y: {
                        position: 'right',
                        grid: { 
                            color: 'rgba(156, 163, 175, 0.06)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6B7280',
                            font: { size: 11 },
                            callback: (value) => {
                                return '$' + value.toLocaleString('en-US', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                });
                            }
                        }
                    }
                }
            }
        });
        
        this.loadChartData('1W');
    }

    async loadChartData(period) {
        if (!this.chart) return;
        
        const now = new Date();
        const labels = [];
        const lineData = [];
        const fillData = [];
        const buyMarkers = [];
        const sellMarkers = [];
        
        let points = 7;
        switch(period) {
            case '1D': points = 24; break;
            case '1W': points = 7; break;
            case '1M': points = 30; break;
            case '3M': points = 12; break;
            case '1Y': points = 12; break;
            case 'ALL': points = 24; break;
        }
        
        const totalValue = this.calculateTotalPortfolioValue();
        const totalCost = this.calculateTotalCost();
        const isProfitable = totalValue >= totalCost;
        
        // Build labels and simulated values
        for (let i = points - 1; i >= 0; i--) {
            const date = new Date(now);
            
            if (period === '1D') {
                date.setHours(date.getHours() - i);
                labels.push(date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
            } else if (period === '1W') {
                date.setDate(date.getDate() - i);
                labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
            } else if (period === '1M') {
                date.setDate(date.getDate() - i);
                labels.push(date.getDate().toString());
            } else if (period === '3M') {
                date.setDate(date.getDate() - (i * 7));
                labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            } else if (period === '1Y') {
                date.setMonth(date.getMonth() - i);
                labels.push(date.toLocaleDateString('en-US', { month: 'short' }));
            } else {
                date.setMonth(date.getMonth() - (i * 2));
                labels.push(date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
            }
            
            const progress = (points - 1 - i) / (points - 1);
            const variation = 0.85 + (progress * 0.15) + (Math.sin(i * 0.6) * 0.04);
            const value = totalValue * variation;
            lineData.push(value);
            fillData.push(value);
        }
        
        // Ensure last point is actual current value
        lineData[lineData.length - 1] = totalValue;
        fillData[fillData.length - 1] = totalValue;
        
        // Add buy/sell markers from trades
        if (this.trades && this.trades.length > 0) {
            this.trades.forEach(trade => {
                const tradeDate = new Date(trade.created_at);
                const daysAgo = (now - tradeDate) / (1000 * 60 * 60 * 24);
                
                // Only show if within the period range
                let inRange = false;
                if (period === '1D' && daysAgo <= 1) inRange = true;
                else if (period === '1W' && daysAgo <= 7) inRange = true;
                else if (period === '1M' && daysAgo <= 30) inRange = true;
                else if (period === '3M' && daysAgo <= 90) inRange = true;
                else if (period === '1Y' && daysAgo <= 365) inRange = true;
                else if (period === 'ALL') inRange = true;
                
                if (inRange) {
                    const markerValue = totalValue * (0.85 + (Math.random() * 0.15));
                    const marker = {
                        x: tradeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        y: markerValue,
                        tradeInfo: `${trade.asset_symbol} ${this.formatNumber(trade.amount, 4)} @ $${this.formatNumber(trade.entry_price)}`
                    };
                    
                    if (trade.trade_type === 'buy') {
                        buyMarkers.push(marker);
                    } else {
                        sellMarkers.push(marker);
                    }
                }
            });
        }
        
        // Update chart data
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = lineData;
        this.chart.data.datasets[1].data = fillData;
        this.chart.data.datasets[2].data = buyMarkers;
        this.chart.data.datasets[3].data = sellMarkers;
        
        // Update colors
        this.chart.data.datasets[0].borderColor = isProfitable ? '#10B981' : '#EF4444';
        this.chart.data.datasets[1].backgroundColor = isProfitable ? 'rgba(16, 185, 129, 0.10)' : 'rgba(239, 68, 68, 0.10)';
        this.chart.data.datasets[0].pointHoverBorderColor = isProfitable ? '#10B981' : '#EF4444';
        
        this.chart.update();
    }

    addChartDataPoint() {
        if (!this.chart) return;
        
        const totalValue = this.calculateTotalPortfolioValue();
        const totalCost = this.calculateTotalCost();
        const isProfitable = totalValue >= totalCost;
        
        const now = new Date();
        const label = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        // Keep last 50 points maximum
        if (this.chart.data.labels.length > 50) {
            this.chart.data.labels.shift();
            this.chart.data.datasets[0].data.shift();
            this.chart.data.datasets[1].data.shift();
        }
        
        this.chart.data.labels.push(label);
        this.chart.data.datasets[0].data.push(totalValue);
        this.chart.data.datasets[1].data.push(totalValue);
        
        this.chart.data.datasets[0].borderColor = isProfitable ? '#10B981' : '#EF4444';
        this.chart.data.datasets[1].backgroundColor = isProfitable ? 'rgba(16, 185, 129, 0.10)' : 'rgba(239, 68, 68, 0.10)';
        this.chart.data.datasets[0].pointHoverBorderColor = isProfitable ? '#10B981' : '#EF4444';
        
        this.chart.update('none');
    }

    // Called every 5 seconds from startPricePolling
    updateChartLive() {
        this.addChartDataPoint();
    }
    
    async loadTradesData() { const { data } = await supabase.from('trades').select('*').eq('user_id', this.user.id).order('created_at',{ascending:false}).limit(10); this.trades = data || []; }
    async loadRecentTrades() { 
    await this.loadTradesData(); 
    const t = document.getElementById('recentTradesBody'); 
    if (!t) return; 
    if (!this.trades.length) { 
        t.innerHTML = '<tr><td colspan="9" class="empty-state">No trades</td></tr>'; 
        return; 
    }
    t.innerHTML = this.trades.map(tr => {
        const pl = Number(tr.profit_loss) || 0;
const isProfit = pl >= 0;
const cls = isProfit ? 'positive' : 'negative';
const plSign = isProfit ? '+' : '-';
        
        // For sell trades or trades with exit price, check if it was originally a buy
        const isClosedPosition = (tr.trade_type === 'sell') || (tr.exit_price !== null && tr.exit_price > 0);
        
        return `<tr>
            <td style="text-align:center;vertical-align:middle;">
                <img src="${this.getLogoUrl(tr.asset_symbol)}" style="width:28px;height:28px;border-radius:50%;object-fit:contain;" onerror="this.src='assets/icons/default-crypto.svg'">
            </td>
            <td style="font-weight:600;vertical-align:middle;">${tr.asset_symbol}</td>
            <td style="text-align:center;vertical-align:middle;">
                ${!isClosedPosition ? '<span class="type-badge type-start">BUY</span>' : '<span style="color:var(--accent-muted);">-</span>'}
            </td>
            <td style="text-align:center;vertical-align:middle;">
                ${isClosedPosition ? '<span class="type-badge type-end">SELL</span>' : '<span style="color:var(--accent-muted);">-</span>'}
            </td>
            <td style="font-family:var(--font-mono);vertical-align:middle;">${this.formatNumber(tr.amount,8)}</td>
            <td style="font-family:var(--font-mono);vertical-align:middle;">$${this.formatNumber(tr.entry_price)}</td>
            <td style="font-family:var(--font-mono);vertical-align:middle;">${tr.exit_price?'$'+this.formatNumber(tr.exit_price):'-'}</td>
            <td class="${cls}" style="vertical-align:middle;font-weight:600;">${tr.profit_loss !== null ? plSign+'$'+this.formatNumber(Math.abs(pl)) : '-'}</td>
            <td style="vertical-align:middle;">${this.formatTimeAgo(tr.created_at)}</td>
        </tr>`;
    }).join('');
}
    
    sortHoldings(c) {
        if (c === 'highest_value') this.holdings.sort((a,b) => (b.total_amount*(this.cryptoPrices[b.asset_symbol]?.price||0)) - (a.total_amount*(this.cryptoPrices[a.asset_symbol]?.price||0)));
        else this.holdings.sort((a,b) => a.asset_symbol.localeCompare(b.asset_symbol));
        this.renderHoldingsTable();
    }
    
    async applyUserSettings() {
    if (!this.userSettings) return;
    
    // Apply theme
    if (this.userSettings.theme) {
        document.body.className = `${this.userSettings.theme}-theme`;
    }
    
    // Apply accent color - WITH !IMPORTANT
    if (this.userSettings.accent_color) {
        document.documentElement.style.setProperty('--accent-primary', this.userSettings.accent_color, 'important');
        document.documentElement.style.setProperty('--accent-secondary', this.userSettings.accent_color, 'important');
    }
    
    // APPLY FONT STYLE - THIS WAS MISSING!
    if (this.userSettings.font_style) {
        if (this.userSettings.font_style === 'Inter') {
            document.documentElement.style.setProperty('--font-primary', "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", 'important');
        } else if (this.userSettings.font_style === 'system-ui') {
            document.documentElement.style.setProperty('--font-primary', "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", 'important');
        } else {
            document.documentElement.style.setProperty('--font-primary', `'${this.userSettings.font_style}', -apple-system, BlinkMacSystemFont, sans-serif`, 'important');
        }
        document.body.style.fontFamily = `var(--font-primary)`;
    }
    
    // Apply font size
    if (this.userSettings.font_size) {
        document.documentElement.style.fontSize = this.userSettings.font_size;
    }
    
    // Apply glass morphism intensity
    if (this.userSettings.glass_intensity) {
        const intensity = this.userSettings.glass_intensity / 100;
        document.documentElement.style.setProperty('--glass-bg', `rgba(17, 17, 17, ${0.5 + intensity * 0.3})`, 'important');
        document.documentElement.style.setProperty('--glass-blur', `blur(${8 + intensity * 8}px)`, 'important');
    }
    
    // Apply border radius
    if (this.userSettings.border_radius) {
        document.documentElement.style.setProperty('--radius-md', this.userSettings.border_radius + 'px', 'important');
    }
    
        // Apply animation intensity
    if (this.userSettings.animation_intensity) {
        const speed = this.userSettings.animation_intensity / 100;
        document.documentElement.style.setProperty('--transition-base', `${250 * speed}ms`, 'important');
    }
    
    // Apply sidebar state
    if (this.userSettings.sidebar_collapsed !== undefined) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            if (this.userSettings.sidebar_collapsed) {
                sidebar.classList.add('collapsed');
            } else {
                sidebar.classList.remove('collapsed');
            }
        }
    }
}
    formatNumber(n, d=2) { if (n===null||n===undefined||isNaN(n)) return '0.00'; return new Intl.NumberFormat('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n); }
    formatTimeAgo(ts) { const diff = Date.now() - new Date(ts).getTime(); const m=Math.floor(diff/60000), h=Math.floor(diff/3600000), d=Math.floor(diff/86400000); if (m<1) return 'Just now'; if (m<60) return m+'m ago'; if (h<24) return h+'h ago'; return d+'d ago'; }
    
    async logout() { 
    // Clear all user data first
    if (window.clearAllUserData) {
        window.clearAllUserData();
    }
    
    this.unsubscribers.forEach(u => u()); 
    bybitWS.disconnect(); 
    if (this.priceUpdateInterval) clearInterval(this.priceUpdateInterval);
    await supabase.auth.signOut(); 
    window.location.href = 'index.html'; 
}
}

let dashboardManager;
document.addEventListener('DOMContentLoaded', () => { dashboardManager = new DashboardManager(); window.dashboardManager = dashboardManager; });
window.addEventListener('beforeunload', () => { if (dashboardManager) { dashboardManager.unsubscribers?.forEach(u => u()); bybitWS.disconnect(); } });