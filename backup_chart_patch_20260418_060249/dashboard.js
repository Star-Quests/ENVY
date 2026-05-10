// ENVY Dashboard JavaScript - Complete Implementation

import { ENVYConfig } from './config.js';
import { supabase } from './supabase-client.js';
import { connectionMonitor } from './connection-monitor.js';
import { notificationSystem } from './notifications.js';

class DashboardManager {
    constructor() {
        this.user = null;
        this.userProfile = null;
        this.userSettings = null;
        this.holdings = [];
        this.trades = [];
        this.cryptoPrices = {};
        this.favoriteAssets = ['BTC', 'ETH', 'SOL'];
        this.priceUpdateInterval = null;
        this.chart = null;
        this.chartData = [];
        
        this.initialize();
    }
    
    async initialize() {
        await this.checkAuth();
        await this.loadUserData();
        this.setupEventListeners();
        this.initializeChart();
        this.startPriceUpdates();
        this.updateGreeting();
        this.updateDateTime();
        this.loadHoldings();
        this.loadRecentTrades();
        this.checkAdminStatus();
        
        // Apply user settings
        this.applyUserSettings();
    }
    
    async checkAuth() {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
            window.location.href = 'auth.html';
            return;
        }
        
        this.user = user;
        
        // Get user profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
            
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
        
        // Load holdings
        await this.loadHoldingsData();
        
        // Load trades
        await this.loadTradesData();
    }
    
    updateUserDisplay() {
        const userNameElement = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        const userEmblem = document.getElementById('userEmblem');
        
        if (this.userProfile) {
            userNameElement.textContent = this.userProfile.full_name || this.user.email.split('@')[0];
            
            if (this.userProfile.avatar_url) {
                userAvatar.src = this.userProfile.avatar_url;
            }
            
            // Set emblem based on role
            if (this.userProfile.role === 'admin') {
                userEmblem.textContent = '👑';
                userEmblem.className = 'user-emblem crown';
            } else {
                userEmblem.textContent = '👤';
                userEmblem.className = 'user-emblem';
            }
        }
    }
    
    updateGreeting() {
        const greetingElement = document.getElementById('userGreeting');
        const hour = new Date().getHours();
        let greeting = 'Good ';
        
        if (hour < 12) greeting += 'morning';
        else if (hour < 18) greeting += 'afternoon';
        else greeting += 'evening';
        
        greetingElement.textContent = greeting;
    }
    
    updateDateTime() {
        const timeElement = document.getElementById('headerTime');
        
        const update = () => {
            const now = new Date();
            const formatted = now.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
            });
            timeElement.textContent = formatted;
        };
        
        update();
        setInterval(update, 1000);
    }
    
    async checkAdminStatus() {
        if (this.userProfile?.role === 'admin') {
            document.getElementById('adminLink').style.display = 'flex'; 
            
        }
    }
    
    setupEventListeners() {
        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            this.saveSidebarPreference(sidebar.classList.contains('collapsed'));
        });
        
        // Mobile menu
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                if (!sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                    sidebar.classList.remove('mobile-open');
                }
            }
        });
        
        // Edit assets modal
        const editAssetsBtn = document.getElementById('editAssetsBtn');
        const modal = document.getElementById('assetEditModal');
        const closeModal = document.getElementById('closeAssetModal');
        const cancelEdit = document.getElementById('cancelAssetEdit');
        const saveEdit = document.getElementById('saveAssetEdit');
        
        editAssetsBtn.addEventListener('click', () => {
            modal.classList.add('active');
            this.loadAssetSuggestions();
        });
        
        closeModal.addEventListener('click', () => modal.classList.remove('active'));
        cancelEdit.addEventListener('click', () => modal.classList.remove('active'));
        saveEdit.addEventListener('click', () => this.saveAssetChanges());
        
        // Close modal on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
        
        // Asset search
        const assetSearch = document.getElementById('assetSearchInput');
        assetSearch.addEventListener('input', (e) => this.searchAssets(e.target.value));
        
        // Holdings sort
        const sortSelect = document.getElementById('holdingsSort');
        sortSelect.addEventListener('change', () => this.sortHoldings(sortSelect.value));
        
        // Chart period buttons
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.changeChartPeriod(e.target.dataset.period));
        });
        
        // Notification button
        const notificationBtn = document.getElementById('notificationBtn');
        const notificationPanel = document.getElementById('notificationPanel');
        
        notificationBtn.addEventListener('click', () => {
            const isVisible = notificationPanel.style.display === 'block';
            notificationPanel.style.display = isVisible ? 'none' : 'block';
        });
        
        // Clear notifications
        document.getElementById('clearNotifications').addEventListener('click', () => {
            notificationSystem.clearAll();
        });
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });
        
        // Apply saved sidebar state
        this.restoreSidebarState();
    }
    
    async saveSidebarPreference(collapsed) {
        if (!this.user) return;
        
        await supabase
            .from('user_settings')
            .update({ sidebar_collapsed: collapsed })
            .eq('user_id', this.user.id);
    }
    
    restoreSidebarState() {
        if (this.userSettings?.sidebar_collapsed) {
            document.getElementById('sidebar').classList.add('collapsed');
        }
    }
    
    initializeChart() {
        const ctx = document.getElementById('portfolioChart').getContext('2d');
        
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
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#9CA3AF',
                    pointHoverBorderColor: '#0A0A0A',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#1A1A1A',
                        titleColor: '#E5E7EB',
                        bodyColor: '#D1D5DB',
                        borderColor: '#9CA3AF',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6B7280'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(156, 163, 175, 0.1)'
                        },
                        ticks: {
                            color: '#6B7280',
                            callback: (value) => '$' + this.formatNumber(value)
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
        
        this.updateChartData('1D');
    }
    
    async updateChartData(period) {
        // Get historical portfolio data
        const { data: trades } = await supabase
            .from('trades')
            .select('*')
            .eq('user_id', this.user.id)
            .order('created_at', { ascending: true });
            
        // Calculate portfolio value over time
        // This is simplified - in production, you'd store daily snapshots
        const chartData = this.calculatePortfolioHistory(trades, period);
        
        this.chart.data.labels = chartData.labels;
        this.chart.data.datasets[0].data = chartData.values;
        this.chart.update();
    }
    
    calculatePortfolioHistory(trades, period) {
        // Implementation for calculating portfolio history
        // Returns { labels: [], values: [] }
        const labels = [];
        const values = [];
        
        // Simplified implementation
        const now = new Date();
        let dataPoints = 24;
        
        switch(period) {
            case '1D': dataPoints = 24; break;
            case '1W': dataPoints = 7; break;
            case '1M': dataPoints = 30; break;
            case '3M': dataPoints = 12; break;
            case '1Y': dataPoints = 12; break;
            case 'ALL': dataPoints = 24; break;
        }
        
        for (let i = dataPoints - 1; i >= 0; i--) {
            const date = new Date(now);
            
            if (period === '1D') {
                date.setHours(date.getHours() - i);
                labels.push(date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
            } else if (period === '1W') {
                date.setDate(date.getDate() - i);
                labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
            } else {
                date.setDate(date.getDate() - i);
                labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            }
            
            // Calculate mock portfolio value based on current holdings and historical prices
            // In production, you'd fetch historical price data
            const baseValue = this.calculateTotalPortfolioValue();
            const variation = 1 + (Math.sin(i) * 0.1);
            values.push(baseValue * variation);
        }
        
        return { labels, values };
    }
    
    changeChartPeriod(period) {
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        this.updateChartData(period);
    }
    
    async startPriceUpdates() {
        // Initial load
        await this.updateCryptoPrices();
        this.renderCryptoFeed();
        
        // Update every 5 seconds
        this.priceUpdateInterval = setInterval(async () => {
            await this.updateCryptoPrices();
            this.renderCryptoFeed();
            this.updateHoldingsWithLivePrices();
            this.updatePortfolioSummary();
        }, 5000);
    }
    
    async updateCryptoPrices() {
        try {
            const symbols = this.favoriteAssets.join(',');
            const response = await fetch(`${ENVYConfig.API_BASE_URL}/bybit/prices?symbols=${symbols}`);
            const data = await response.json();
            
            if (data.prices) {
                this.cryptoPrices = data.prices;
            }
        } catch (error) {
            console.error('Error fetching prices:', error);
        }
    }
    
    renderCryptoFeed() {
        const feedContainer = document.getElementById('cryptoFeed');
        feedContainer.innerHTML = '';
        
        this.favoriteAssets.forEach(symbol => {
            const price = this.cryptoPrices[symbol] || { price: 0, change24h: 0 };
            const card = this.createCryptoCard(symbol, price);
            feedContainer.appendChild(card);
        });
    }
    
    createCryptoCard(symbol, priceData) {
        const card = document.createElement('div');
        card.className = 'crypto-card glass-morphism';
        
        const logoUrl = `https://assets.coingecko.com/coins/images/${this.getCoinGeckoId(symbol)}/small/${symbol.toLowerCase()}.png`;
        
        const change = priceData.change24h || 0;
        const changeClass = change >= 0 ? 'positive' : 'negative';
        const changeSign = change >= 0 ? '+' : '';
        
        card.innerHTML = `
            <div class="crypto-card-header">
                <img src="${logoUrl}" alt="${symbol}" class="crypto-logo" onerror="this.src='assets/icons/default-crypto.svg'">
                <div class="crypto-info">
                    <div class="crypto-name">${this.getCryptoName(symbol)}</div>
                    <div class="crypto-symbol">${symbol}</div>
                </div>
            </div>
            <div class="crypto-price">$${this.formatNumber(priceData.price)}</div>
            <div class="crypto-change ${changeClass}">
                ${changeSign}${change.toFixed(2)}%
            </div>
        `;
        
        return card;
    }
    
    getCoinGeckoId(symbol) {
        const ids = {
            'BTC': '1',
            'ETH': '279',
            'SOL': '4128',
            'BNB': '825',
            'XRP': '44',
            'ADA': '975',
            'DOGE': '5',
            'MATIC': '4713',
            'DOT': '12171',
            'AVAX': '12559'
        };
        return ids[symbol] || '1';
    }
    
    getCryptoName(symbol) {
        const names = {
            'BTC': 'Bitcoin',
            'ETH': 'Ethereum',
            'SOL': 'Solana',
            'BNB': 'Binance Coin',
            'XRP': 'Ripple',
            'ADA': 'Cardano',
            'DOGE': 'Dogecoin'
        };
        return names[symbol] || symbol;
    }
    
    async loadHoldingsData() {
        const { data: holdings } = await supabase
            .from('holdings')
            .select('*')
            .eq('user_id', this.user.id);
            
        this.holdings = holdings || [];
    }
    
    async loadHoldings() {
        await this.loadHoldingsData();
        this.renderHoldingsTable();
        this.updatePortfolioSummary();
    }
    
    renderHoldingsTable() {
        const tbody = document.getElementById('holdingsTableBody');
        tbody.innerHTML = '';
        
        if (this.holdings.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M20 12H4M12 4V20" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <h4>No Holdings Yet</h4>
                        <p>Start trading to see your portfolio here</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        this.holdings.forEach(holding => {
            const row = this.createHoldingRow(holding);
            tbody.appendChild(row);
        });
    }
    
    createHoldingRow(holding) {
        const row = document.createElement('tr');
        
        const currentPrice = this.cryptoPrices[holding.asset_symbol]?.price || 0;
        const value = holding.total_amount * currentPrice;
        const costBasis = holding.total_amount * holding.average_cost;
        const pl = value - costBasis;
        const plPercentage = costBasis > 0 ? (pl / costBasis) * 100 : 0;
        
        if (this.userSettings?.row_highlighting) {
            row.classList.add(pl >= 0 ? 'row-highlight-profit' : 'row-highlight-loss');
        }
        
        const logoUrl = `https://assets.coingecko.com/coins/images/${this.getCoinGeckoId(holding.asset_symbol)}/small/${holding.asset_symbol.toLowerCase()}.png`;
        
        row.innerHTML = `
            <td>
                <div class="asset-cell">
                    <img src="${logoUrl}" alt="${holding.asset_symbol}" class="asset-logo-small" onerror="this.src='assets/icons/default-crypto.svg'">
                    <span class="asset-symbol">${holding.asset_symbol}</span>
                </div>
            </td>
            <td>${this.formatNumber(holding.total_amount, 8)}</td>
            <td>$${this.formatNumber(holding.average_cost)}</td>
            <td>$${this.formatNumber(currentPrice)}</td>
            <td class="${pl >= 0 ? 'positive' : 'negative'}">
                ${pl >= 0 ? '+' : ''}$${this.formatNumber(pl)} (${plPercentage.toFixed(2)}%)
            </td>
            <td>$${this.formatNumber(value)}</td>
        `;
        
        return row;
    }
    
    updateHoldingsWithLivePrices() {
        if (this.holdings.length > 0) {
            this.renderHoldingsTable();
        }
    }
    
    calculateTotalPortfolioValue() {
        return this.holdings.reduce((total, holding) => {
            const price = this.cryptoPrices[holding.asset_symbol]?.price || 0;
            return total + (holding.total_amount * price);
        }, 0);
    }
    
    calculateTotalCost() {
        return this.holdings.reduce((total, holding) => {
            return total + (holding.total_amount * holding.average_cost);
        }, 0);
    }
    
    updatePortfolioSummary() {
        const totalValue = this.calculateTotalPortfolioValue();
        const totalCost = this.calculateTotalCost();
        const totalPL = totalValue - totalCost;
        const plPercentage = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
        
        // Calculate profits and losses separately
        const profitTrades = this.holdings.filter(h => {
            const price = this.cryptoPrices[h.asset_symbol]?.price || 0;
            return (price - h.average_cost) > 0;
        });
        
        const lossTrades = this.holdings.filter(h => {
            const price = this.cryptoPrices[h.asset_symbol]?.price || 0;
            return (price - h.average_cost) < 0;
        });
        
        const totalProfit = profitTrades.reduce((sum, h) => {
            const price = this.cryptoPrices[h.asset_symbol]?.price || 0;
            return sum + (h.total_amount * (price - h.average_cost));
        }, 0);
        
        const totalLoss = Math.abs(lossTrades.reduce((sum, h) => {
            const price = this.cryptoPrices[h.asset_symbol]?.price || 0;
            return sum + (h.total_amount * (price - h.average_cost));
        }, 0));
        
        // Update UI
        document.getElementById('totalCapital').textContent = `$${this.formatNumber(totalCost)}`;
        document.getElementById('currentBalance').textContent = `$${this.formatNumber(totalValue)}`;
        document.getElementById('balanceChange').textContent = `${plPercentage >= 0 ? '+' : ''}${plPercentage.toFixed(2)}%`;
        document.getElementById('balanceChange').className = `trend-indicator ${plPercentage >= 0 ? 'positive' : 'negative'}`;
        
        document.getElementById('totalProfit').textContent = `$${this.formatNumber(totalProfit)}`;
        document.getElementById('profitPercentage').textContent = `+${((totalProfit / totalCost) * 100).toFixed(2)}%`;
        
        document.getElementById('totalLoss').textContent = `$${this.formatNumber(totalLoss)}`;
        document.getElementById('lossPercentage').textContent = `-${((totalLoss / totalCost) * 100).toFixed(2)}%`;
    }
    
    async loadTradesData() {
        const { data: trades } = await supabase
            .from('trades')
            .select('*')
            .eq('user_id', this.user.id)
            .order('created_at', { ascending: false })
            .limit(10);
            
        this.trades = trades || [];
    }
    
    async loadRecentTrades() {
        await this.loadTradesData();
        this.renderRecentTrades();
    }
    
    renderRecentTrades() {
        const tbody = document.getElementById('recentTradesBody');
        tbody.innerHTML = '';
        
        if (this.trades.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <p>No trades yet. Start journaling your trades!</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        this.trades.forEach(trade => {
            const row = this.createTradeRow(trade);
            tbody.appendChild(row);
        });
    }
    
    createTradeRow(trade) {
        const row = document.createElement('tr');
        row.addEventListener('click', () => {
            window.location.href = `journal.html?trade=${trade.id}`;
        });
        
        const logoUrl = `https://assets.coingecko.com/coins/images/${this.getCoinGeckoId(trade.asset_symbol)}/small/${trade.asset_symbol.toLowerCase()}.png`;
        
        row.innerHTML = `
            <td>
                <div class="asset-cell">
                    <img src="${logoUrl}" alt="${trade.asset_symbol}" class="asset-logo-small" onerror="this.src='assets/icons/default-crypto.svg'">
                    <span>${trade.asset_symbol}</span>
                </div>
            </td>
            <td>
                <span class="trade-type-badge ${trade.trade_type}">${trade.trade_type}</span>
            </td>
            <td>${this.formatNumber(trade.amount, 8)}</td>
            <td>$${this.formatNumber(trade.entry_price)}</td>
            <td>${trade.exit_price ? '$' + this.formatNumber(trade.exit_price) : '-'}</td>
            <td class="${trade.profit_loss >= 0 ? 'positive' : 'negative'}">
                ${trade.profit_loss ? (trade.profit_loss >= 0 ? '+' : '') + '$' + this.formatNumber(trade.profit_loss) : '-'}
            </td>
            <td>${this.formatTimeAgo(trade.created_at)}</td>
        `;
        
        return row;
    }
    
    async loadAssetSuggestions() {
        try {
            const response = await fetch(`${ENVYConfig.API_BASE_URL}/bybit/assets`);
            const assets = await response.json();
            
            this.renderAssetSuggestions(assets);
            this.renderSelectedAssets();
        } catch (error) {
            console.error('Error loading assets:', error);
        }
    }
    
    renderSelectedAssets() {
        const container = document.getElementById('selectedAssetsList');
        container.innerHTML = '';
        
        this.favoriteAssets.forEach(symbol => {
            const tag = document.createElement('span');
            tag.className = 'selected-asset-tag';
            tag.innerHTML = `
                ${symbol}
                <button onclick="dashboardManager.removeAsset('${symbol}')">&times;</button>
            `;
            container.appendChild(tag);
        });
    }
    
    renderAssetSuggestions(assets) {
        const container = document.getElementById('assetSuggestionsList');
        container.innerHTML = '';
        
        const filteredAssets = assets.filter(asset => 
            !this.favoriteAssets.includes(asset.symbol)
        );
        
        filteredAssets.slice(0, 50).forEach(asset => {
            const item = document.createElement('div');
            item.className = 'asset-suggestion-item';
            item.innerHTML = `
                <img src="${asset.logo || 'assets/icons/default-crypto.svg'}" alt="${asset.symbol}">
                <div>
                    <div>${asset.name}</div>
                    <small>${asset.symbol}</small>
                </div>
            `;
            item.addEventListener('click', () => this.addAsset(asset.symbol));
            container.appendChild(item);
        });
    }
    
    searchAssets(query) {
        // Implement search functionality
        const items = document.querySelectorAll('.asset-suggestion-item');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(query.toLowerCase()) ? 'flex' : 'none';
        });
    }
    
    addAsset(symbol) {
        if (!this.favoriteAssets.includes(symbol)) {
            this.favoriteAssets.push(symbol);
            this.renderSelectedAssets();
            this.renderAssetSuggestions(this.allAssets);
        }
    }
    
    removeAsset(symbol) {
        this.favoriteAssets = this.favoriteAssets.filter(s => s !== symbol);
        this.renderSelectedAssets();
        this.renderAssetSuggestions(this.allAssets);
    }
    
    async saveAssetChanges() {
        await supabase
            .from('user_settings')
            .update({ favorite_assets: this.favoriteAssets })
            .eq('user_id', this.user.id);
            
        document.getElementById('assetEditModal').classList.remove('active');
        
        // Refresh crypto feed
        await this.updateCryptoPrices();
        this.renderCryptoFeed();
        
        notificationSystem.success('Assets updated successfully');
    }
    
    sortHoldings(criteria) {
        switch(criteria) {
            case 'highest_value':
                this.holdings.sort((a, b) => {
                    const valueA = a.total_amount * (this.cryptoPrices[a.asset_symbol]?.price || 0);
                    const valueB = b.total_amount * (this.cryptoPrices[b.asset_symbol]?.price || 0);
                    return valueB - valueA;
                });
                break;
            case 'highest_profit':
                this.holdings.sort((a, b) => {
                    const plA = a.total_amount * ((this.cryptoPrices[a.asset_symbol]?.price || 0) - a.average_cost);
                    const plB = b.total_amount * ((this.cryptoPrices[b.asset_symbol]?.price || 0) - b.average_cost);
                    return plB - plA;
                });
                break;
            case 'highest_loss':
                this.holdings.sort((a, b) => {
                    const plA = a.total_amount * ((this.cryptoPrices[a.asset_symbol]?.price || 0) - a.average_cost);
                    const plB = b.total_amount * ((this.cryptoPrices[b.asset_symbol]?.price || 0) - b.average_cost);
                    return plA - plB;
                });
                break;
            case 'alphabetical':
                this.holdings.sort((a, b) => a.asset_symbol.localeCompare(b.asset_symbol));
                break;
        }
        
        this.renderHoldingsTable();
    }
    
    async applyUserSettings() {
        if (!this.userSettings) return;
        
        // Apply theme
        if (this.userSettings.theme) {
            document.body.className = `${this.userSettings.theme}-theme`;
        }
        
        // Apply accent color
        if (this.userSettings.accent_color) {
            document.documentElement.style.setProperty('--accent-primary', this.userSettings.accent_color);
        }
        
        // Apply font size
        if (this.userSettings.font_size) {
            document.documentElement.style.setProperty('--base-font-size', 
                this.userSettings.font_size === 'small' ? '14px' : 
                this.userSettings.font_size === 'large' ? '18px' : '16px'
            );
        }
        
        // Apply glass morphism intensity
        if (this.userSettings.glass_intensity) {
            const intensity = this.userSettings.glass_intensity / 100;
            document.documentElement.style.setProperty('--glass-bg', `rgba(17, 17, 17, ${0.5 + intensity * 0.3})`);
            document.documentElement.style.setProperty('--glass-blur', `blur(${8 + intensity * 8}px)`);
        }
        
        // Apply border radius
        if (this.userSettings.border_radius) {
            const radius = this.userSettings.border_radius;
            document.documentElement.style.setProperty('--radius-md', `${radius}px`);
            document.documentElement.style.setProperty('--radius-lg', `${radius + 4}px`);
            document.documentElement.style.setProperty('--radius-xl', `${radius + 8}px`);
        }
        
        // Apply animation intensity
        if (this.userSettings.animation_intensity) {
            const speed = this.userSettings.animation_intensity / 100;
            document.documentElement.style.setProperty('--transition-fast', `${150 * speed}ms`);
            document.documentElement.style.setProperty('--transition-base', `${250 * speed}ms`);
            document.documentElement.style.setProperty('--transition-slow', `${350 * speed}ms`);
        }
    }
    
    formatNumber(num, decimals = 2) {
        if (num === null || num === undefined) return '0.00';
        
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    }
    
    formatTimeAgo(timestamp) {
        const now = new Date();
        const then = new Date(timestamp);
        const diff = now - then;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return then.toLocaleDateString();
    }
    
    async logout() {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    }
}

// Initialize dashboard when DOM is ready
let dashboardManager;
document.addEventListener('DOMContentLoaded', () => {
    dashboardManager = new DashboardManager();
    window.dashboardManager = dashboardManager;
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (dashboardManager?.priceUpdateInterval) {
        clearInterval(dashboardManager.priceUpdateInterval);
    }
});