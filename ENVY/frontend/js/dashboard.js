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
        
                // WebSocket disabled for Nigeria - using REST API polling instead
        // await bybitWS.connect();
        // bybitWS.onConnectionChange((connected) => {
        //     this.connectionStatus = connected;
        //     this.updateConnectionIndicator(connected);
        // });
        
        // Show connected status (using REST API)
        this.updateConnectionIndicator(true);
        
        this.setupEventListeners();
        this.initializeChart();
        // this.subscribeToPrices(); // Disabled - WebSocket
        this.startPricePolling();
        this.updateGreeting();
        this.updateDateTime();
        await this.loadHoldings();
        await this.loadRecentTrades();
        this.checkAdminStatus();
        
        await this.applyUserSettings();
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
    
    this.fetchBybitPrices();
    this.priceUpdateInterval = setInterval(() => this.fetchBybitPrices(), 5000);
}

async fetchBybitPrices() {
    try {
        const symbols = this.favoriteAssets.map(s => s + 'USDT').join(',');
        const res = await fetch(`/api/proxy/bybit-prices?symbols=${symbols}`);
        const data = await res.json();
        
        if (data.retCode === 0 && data.result && data.result.list) {
            data.result.list.forEach(ticker => {
                const symbol = ticker.symbol.replace('USDT', '');
                this.cryptoPrices[symbol] = {
                    price: parseFloat(ticker.lastPrice) || 0,
                    change24h: (parseFloat(ticker.price24hPcnt) * 100) || 0,
                    high24h: parseFloat(ticker.highPrice24h) || 0,
                    low24h: parseFloat(ticker.lowPrice24h) || 0
                };
            });
            this.renderCryptoFeed();
            this.updateHoldingsWithLivePrices();
            this.updatePortfolioSummary();
        }
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
    
    async loadHoldingsData() { 
    const { data } = await supabase.from('holdings').select('*').eq('user_id', this.user.id); 
    this.holdings = data || []; 
}
    async loadHoldings() { 
    // Always fetch fresh data from database
    const { data } = await supabase.from('holdings').select('*').eq('user_id', this.user.id);
    this.holdings = data || [];
    this.renderHoldingsTable(); 
    this.updatePortfolioSummary(); 
}
    
    renderHoldingsTable() {
    const t = document.getElementById('holdingsTableBody');
    if (!t) return;
    if (!this.holdings.length) { 
        t.innerHTML = '<tr><td colspan="6" class="empty-state">No holdings</td></tr>'; 
        return; 
    }
    t.innerHTML = this.holdings.map(h => {
        const pr = this.cryptoPrices[h.asset_symbol]?.price || 0;
        const val = h.total_amount * pr;
        const cost = h.total_amount * h.average_cost;
        const pl = val - cost;
        const plPercent = cost > 0 ? ((pl / cost) * 100) : 0;
        const cls = pl >= 0 ? 'positive' : 'negative';
        const plSign = pl >= 0 ? '+' : '';
        
        return `<tr>
            <td><div class="asset-cell"><img src="${this.getLogoUrl(h.asset_symbol)}" class="asset-logo-small"><span>${h.asset_symbol}</span></div></td>
            <td>${this.formatNumber(h.total_amount,8)}</td>
            <td>$${this.formatNumber(h.average_cost)}</td>
            <td>$${this.formatNumber(pr)}</td>
            <td class="${cls}">${plSign}$${this.formatNumber(Math.abs(pl))}<br><small>${plSign}${plPercent.toFixed(2)}%</small></td>
            <td>$${this.formatNumber(val)}</td>
        </tr>`;
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