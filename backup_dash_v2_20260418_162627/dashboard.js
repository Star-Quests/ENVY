// ENVY Dashboard - True Real-Time via Bybit WebSocket

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
        
        this.initialize();
    }
    
    async initialize() {
        await this.checkAuth();
        await this.loadUserData();
        
        // Connect to Bybit WebSocket FIRST
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
        this.loadHoldings();
        this.loadRecentTrades();
        this.checkAdminStatus();
        this.applyUserSettings();
    }
    
    async checkAuth() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            window.location.href = 'auth.html';
            return;
        }
        this.user = user;
        
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
            
        this.userProfile = profile;
        this.updateUserDisplay();
    }
    
    async loadUserData() {
        const { data: settings } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', this.user.id)
            .single();
            
        this.userSettings = settings || {};
        if (settings?.favorite_assets) {
            this.favoriteAssets = settings.favorite_assets;
        }
        
        await this.loadHoldingsData();
        await this.loadTradesData();
    }
    
    updateUserDisplay() {
        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        const userEmblem = document.getElementById('userEmblem');
        
        if (this.userProfile) {
            userName.textContent = this.userProfile.full_name || this.user.email.split('@')[0];
            if (this.userProfile.avatar_url) userAvatar.src = this.userProfile.avatar_url;
            
            if (this.userProfile.role === 'admin') {
                userEmblem.textContent = 'ðŸ‘‘';
                userEmblem.className = 'user-emblem crown';
            } else {
                userEmblem.textContent = 'ðŸ‘¤';
                userEmblem.className = 'user-emblem';
            }
        }
    }
    
    updateConnectionIndicator(connected) {
        const indicator = document.getElementById('connectionIndicator');
        if (indicator) {
            const dot = indicator.querySelector('.connection-dot');
            const text = indicator.querySelector('.connection-text');
            if (connected) {
                dot.className = 'connection-dot status-connected';
                text.textContent = 'Live (Bybit)';
            } else {
                dot.className = 'connection-dot status-disconnected';
                text.textContent = 'Reconnecting...';
            }
        }
    }
    
    subscribeToPrices() {
        // Unsubscribe from previous
        this.unsubscribers.forEach(unsub => unsub());
        this.unsubscribers.clear();
        
        // Subscribe to each favorite asset
        this.favoriteAssets.forEach(symbol => {
            const unsub = bybitWS.subscribe(symbol, (priceData) => {
                this.cryptoPrices[symbol] = priceData;
                this.renderCryptoFeed();
                this.updateHoldingsWithLivePrices();
                this.updatePortfolioSummary();
            });
            this.unsubscribers.set(symbol, unsub);
            
            // Check for cached price
            const cached = bybitWS.getCachedPrice(symbol);
            if (cached) {
                this.cryptoPrices[symbol] = cached;
            }
        });
        
        this.renderCryptoFeed();
    }
    
    updateGreeting() {
        const el = document.getElementById('userGreeting');
        if (!el) return;
        const hour = new Date().getHours();
        let g = 'Good ';
        if (hour < 12) g += 'morning';
        else if (hour < 18) g += 'afternoon';
        else g += 'evening';
        el.textContent = g;
    }
    
    updateDateTime() {
        const el = document.getElementById('headerTime');
        if (!el) return;
        const update = () => {
            el.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        };
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
        document.getElementById('sidebarToggle')?.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
        
        document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
        });
        
        document.getElementById('editAssetsBtn')?.addEventListener('click', () => this.showAssetSelector());
        
        document.getElementById('holdingsSort')?.addEventListener('change', (e) => this.sortHoldings(e.target.value));
        
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.changeChartPeriod(e.target.dataset.period));
        });
        
        document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });
    }
    
    async showAssetSelector() {
        // Fetch all Bybit assets
        try {
            const response = await fetch('https://api.bybit.com/v5/market/instruments-info?category=spot');
            const data = await response.json();
            
            if (data.retCode !== 0) throw new Error('Failed to fetch assets');
            
            const assets = data.result.list
                .filter(item => item.status === 'Trading' && item.quoteCoin === 'USDT')
                .map(item => ({
                    symbol: item.baseCoin,
                    name: item.baseCoin,
                    logoUrl: this.getLogoUrl(item.baseCoin)
                }))
                .filter((v, i, a) => a.findIndex(t => t.symbol === v.symbol) === i)
                .sort((a, b) => a.symbol.localeCompare(b.symbol));
            
            this.showAssetModal(assets);
        } catch (error) {
            console.error('Failed to load assets:', error);
            notificationSystem?.error('Failed to load assets');
        }
    }
    
    getLogoUrl(symbol) {
        const ids = {
            'BTC': '1', 'ETH': '279', 'SOL': '4128', 'BNB': '825', 'XRP': '44',
            'ADA': '975', 'DOGE': '5', 'MATIC': '4713', 'DOT': '12171', 'AVAX': '12559',
            'LINK': '877', 'UNI': '12504', 'ATOM': '1481', 'LTC': '2', 'BCH': '780'
        };
        const id = ids[symbol] || symbol.toLowerCase();
        return `https://assets.coingecko.com/coins/images/${id}/small/${symbol.toLowerCase()}.png`;
    }
    
    showAssetModal(assets) {
        // Create modal dynamically
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content modal-large glass-morphism">
                <div class="modal-header">
                    <h3>Select Assets</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <input type="text" id="assetModalSearch" placeholder="Search assets..." class="search-input glass-morphism">
                    <div class="selected-assets" id="modalSelectedAssets"></div>
                    <div class="assets-grid-modal" id="modalAssetsGrid" style="max-height: 400px; overflow-y: auto;"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="modalCancel">Cancel</button>
                    <button class="btn-primary" id="modalSave">Save</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const selected = [...this.favoriteAssets];
        const grid = modal.querySelector('#modalAssetsGrid');
        const selectedDiv = modal.querySelector('#modalSelectedAssets');
        
        const renderSelected = () => {
            selectedDiv.innerHTML = selected.map(s => `
                <span class="selected-tag">
                    ${s}
                    <button data-remove="${s}">&times;</button>
                </span>
            `).join('');
            
            selectedDiv.querySelectorAll('[data-remove]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = selected.indexOf(btn.dataset.remove);
                    if (idx > -1) selected.splice(idx, 1);
                    renderGrid();
                    renderSelected();
                });
            });
        };
        
        const renderGrid = (filter = '') => {
            const filtered = filter ? assets.filter(a => 
                a.symbol.toLowerCase().includes(filter) || a.name.toLowerCase().includes(filter)
            ) : assets;
            
            grid.innerHTML = filtered.slice(0, 100).map(asset => `
                <div class="asset-item-modal ${selected.includes(asset.symbol) ? 'selected' : ''}" data-symbol="${asset.symbol}">
                    <img src="${asset.logoUrl}" alt="${asset.symbol}" onerror="this.src='assets/icons/default-crypto.svg'">
                    <div>
                        <strong>${asset.symbol}</strong>
                        <small>${asset.name}</small>
                    </div>
                </div>
            `).join('');
            
            grid.querySelectorAll('.asset-item-modal').forEach(item => {
                item.addEventListener('click', () => {
                    const symbol = item.dataset.symbol;
                    const idx = selected.indexOf(symbol);
                    if (idx === -1) {
                        if (selected.length < 10) selected.push(symbol);
                        else notificationSystem?.warning('Max 10 assets');
                    } else {
                        selected.splice(idx, 1);
                    }
                    renderGrid(filter);
                    renderSelected();
                });
            });
        };
        
        modal.querySelector('#assetModalSearch').addEventListener('input', (e) => renderGrid(e.target.value));
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
        
        this.chart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Portfolio',
                    data: [10000, 10500, 10200, 10800, 11200, 11500, 12000],
                    borderColor: '#9CA3AF',
                    backgroundColor: 'rgba(156, 163, 175, 0.1)',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }
    
    changeChartPeriod(period) {
        // Update chart based on period
        console.log('Chart period:', period);
    }
    
    renderCryptoFeed() {
        const container = document.getElementById('cryptoFeed');
        if (!container) return;
        
        container.innerHTML = this.favoriteAssets.map(symbol => {
            const price = this.cryptoPrices[symbol] || { price: 0, change24h: 0 };
            const change = price.change24h || 0;
            const changeClass = change >= 0 ? 'positive' : 'negative';
            
            return `
                <div class="crypto-card glass-morphism">
                    <div class="crypto-card-header">
                        <img src="${this.getLogoUrl(symbol)}" class="crypto-logo" onerror="this.src='assets/icons/default-crypto.svg'">
                        <div>
                            <div class="crypto-name">${symbol}</div>
                            <div class="crypto-symbol">${symbol}</div>
                        </div>
                    </div>
                    <div class="crypto-price">$${this.formatNumber(price.price)}</div>
                    <div class="crypto-change ${changeClass}">
                        ${change >= 0 ? 'â–²' : 'â–¼'} ${Math.abs(change).toFixed(2)}%
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
        await this.loadHoldingsData();
        this.renderHoldingsTable();
        this.updatePortfolioSummary();
    }
    
    renderHoldingsTable() {
        const tbody = document.getElementById('holdingsTableBody');
        if (!tbody) return;
        
        if (this.holdings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No holdings</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.holdings.map(h => {
            const price = this.cryptoPrices[h.asset_symbol]?.price || 0;
            const value = h.total_amount * price;
            const cost = h.total_amount * h.average_cost;
            const pl = value - cost;
            const plClass = pl >= 0 ? 'positive' : 'negative';
            
            return `
                <tr>
                    <td>${h.asset_symbol}</td>
                    <td>${this.formatNumber(h.total_amount, 8)}</td>
                    <td>$${this.formatNumber(h.average_cost)}</td>
                    <td>$${this.formatNumber(price)}</td>
                    <td class="${plClass}">${pl >= 0 ? '+' : ''}$${this.formatNumber(pl)}</td>
                    <td>$${this.formatNumber(value)}</td>
                </tr>
            `;
        }).join('');
    }
    
    updateHoldingsWithLivePrices() {
        this.renderHoldingsTable();
    }
    
    updatePortfolioSummary() {
        const totalValue = this.holdings.reduce((sum, h) => {
            const price = this.cryptoPrices[h.asset_symbol]?.price || 0;
            return sum + (h.total_amount * price);
        }, 0);
        
        const totalCost = this.holdings.reduce((sum, h) => sum + (h.total_amount * h.average_cost), 0);
        const totalPL = totalValue - totalCost;
        const plPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
        
        const profit = this.holdings.reduce((sum, h) => {
            const price = this.cryptoPrices[h.asset_symbol]?.price || 0;
            const pl = h.total_amount * (price - h.average_cost);
            return sum + (pl > 0 ? pl : 0);
        }, 0);
        
        const loss = this.holdings.reduce((sum, h) => {
            const price = this.cryptoPrices[h.asset_symbol]?.price || 0;
            const pl = h.total_amount * (price - h.average_cost);
            return sum + (pl < 0 ? Math.abs(pl) : 0);
        }, 0);
        
        document.getElementById('totalCapital').textContent = `$${this.formatNumber(totalCost)}`;
        document.getElementById('currentBalance').textContent = `$${this.formatNumber(totalValue)}`;
        document.getElementById('balanceChange').textContent = `${plPercent >= 0 ? '+' : ''}${plPercent.toFixed(2)}%`;
        document.getElementById('balanceChange').className = `trend-indicator ${plPercent >= 0 ? 'positive' : 'negative'}`;
        document.getElementById('totalProfit').textContent = `$${this.formatNumber(profit)}`;
        document.getElementById('totalLoss').textContent = `$${this.formatNumber(loss)}`;
    }
    
    async loadTradesData() {
        const { data } = await supabase.from('trades').select('*').eq('user_id', this.user.id).order('created_at', { ascending: false }).limit(10);
        this.trades = data || [];
    }
    
    async loadRecentTrades() {
        await this.loadTradesData();
        const tbody = document.getElementById('recentTradesBody');
        if (!tbody) return;
        
        if (this.trades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No trades</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.trades.map(t => `
            <tr>
                <td>${t.asset_symbol}</td>
                <td><span class="trade-type-badge ${t.trade_type}">${t.trade_type}</span></td>
                <td>${this.formatNumber(t.amount, 8)}</td>
                <td>$${this.formatNumber(t.entry_price)}</td>
                <td>${t.exit_price ? '$' + this.formatNumber(t.exit_price) : '-'}</td>
                <td class="${t.profit_loss >= 0 ? 'positive' : 'negative'}">
                    ${t.profit_loss ? (t.profit_loss >= 0 ? '+' : '') + '$' + this.formatNumber(t.profit_loss) : '-'}
                </td>
                <td>${this.formatTimeAgo(t.created_at)}</td>
            </tr>
        `).join('');
    }
    
    sortHoldings(criteria) {
        if (criteria === 'highest_value') {
            this.holdings.sort((a, b) => {
                const va = a.total_amount * (this.cryptoPrices[a.asset_symbol]?.price || 0);
                const vb = b.total_amount * (this.cryptoPrices[b.asset_symbol]?.price || 0);
                return vb - va;
            });
        } else {
            this.holdings.sort((a, b) => a.asset_symbol.localeCompare(b.asset_symbol));
        }
        this.renderHoldingsTable();
    }
    
    applyUserSettings() {
        if (this.userSettings?.theme) {
            document.body.className = `${this.userSettings.theme}-theme`;
        }
    }
    
    formatNumber(num, decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) return '0.00';
        return new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num);
    }
    
    formatTimeAgo(ts) {
        const diff = Date.now() - new Date(ts).getTime();
        const mins = Math.floor(diff / 60000);
        const hrs = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        if (hrs < 24) return `${hrs}h ago`;
        return `${days}d ago`;
    }
    
    async logout() {
        this.unsubscribers.forEach(unsub => unsub());
        bybitWS.disconnect();
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    }
}

let dashboardManager;
document.addEventListener('DOMContentLoaded', () => {
    dashboardManager = new DashboardManager();
    window.dashboardManager = dashboardManager;
});

window.addEventListener('beforeunload', () => {
    if (dashboardManager) {
        dashboardManager.unsubscribers?.forEach(unsub => unsub());
        bybitWS.disconnect();
    }
});
