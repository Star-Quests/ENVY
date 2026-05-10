# ENVY Dashboard Restore Script
# Restores dashboard to working state
# Run as: .\restore-dashboard.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    DASHBOARD RESTORE SCRIPT           " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$dashJsPath = "frontend\js\dashboard.js"
$dashHtmlPath = "frontend\dashboard.html"
$dashCssPath = "frontend\css\dashboard.css"

# ============================================
# CHECK FOR EXISTING BACKUPS
# ============================================
Write-Host "Checking for existing backups..." -ForegroundColor Yellow
Write-Host ""

$backupDirs = Get-ChildItem -Directory -Filter "backup_*" | Sort-Object LastWriteTime -Descending

if ($backupDirs.Count -gt 0) {
    Write-Host "Found backups:" -ForegroundColor Green
    for ($i = 0; $i -lt [Math]::Min(5, $backupDirs.Count); $i++) {
        Write-Host "  [$i] $($backupDirs[$i].Name) - $($backupDirs[$i].LastWriteTime)" -ForegroundColor Gray
    }
    Write-Host ""
    
    $choice = Read-Host "Enter backup number to restore (0-4), or 'fresh' for fresh working version"
    
    if ($choice -ne 'fresh' -and $choice -match '^\d+$' -and [int]$choice -lt $backupDirs.Count) {
        $selectedBackup = $backupDirs[[int]$choice].FullName
        Write-Host ""
        Write-Host "Restoring from: $selectedBackup" -ForegroundColor Yellow
        
        # Restore dashboard.js
        if (Test-Path "$selectedBackup\dashboard.js") {
            Copy-Item "$selectedBackup\dashboard.js" $dashJsPath -Force
            Write-Host "   Restored dashboard.js" -ForegroundColor Green
        }
        
        # Restore dashboard.html if exists
        if (Test-Path "$selectedBackup\dashboard.html") {
            Copy-Item "$selectedBackup\dashboard.html" $dashHtmlPath -Force
            Write-Host "   Restored dashboard.html" -ForegroundColor Green
        }
        
        # Restore dashboard.css if exists
        if (Test-Path "$selectedBackup\dashboard.css") {
            Copy-Item "$selectedBackup\dashboard.css" $dashCssPath -Force
            Write-Host "   Restored dashboard.css" -ForegroundColor Green
        }
        
        Write-Host ""
        Write-Host "Dashboard restored successfully!" -ForegroundColor Green
        Write-Host "Hard refresh your browser: Ctrl + Shift + R" -ForegroundColor Yellow
        exit
    }
}

# ============================================
# FRESH WORKING DASHBOARD.JS
# ============================================
Write-Host ""
Write-Host "Creating fresh working dashboard.js..." -ForegroundColor Yellow

# Create backup of current file first
$backupDir = "backup_restore_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

if (Test-Path $dashJsPath) {
    Copy-Item $dashJsPath "$backupDir\dashboard.js" -Force
    Write-Host "   Backed up current file to: $backupDir" -ForegroundColor Gray
}

# Fresh working dashboard.js
$freshDashboardJs = @'
// ENVY Dashboard JavaScript - Fresh Working Version

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
        const userNameElement = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        const userEmblem = document.getElementById('userEmblem');
        
        if (this.userProfile) {
            userNameElement.textContent = this.userProfile.full_name || this.user.email.split('@')[0];
            
            if (this.userProfile.avatar_url) {
                userAvatar.src = this.userProfile.avatar_url;
            }
            
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
        
        if (greetingElement) greetingElement.textContent = greeting;
    }
    
    updateDateTime() {
        const timeElement = document.getElementById('headerTime');
        if (!timeElement) return;
        
        const update = () => {
            const now = new Date();
            timeElement.textContent = now.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
            });
        };
        
        update();
        setInterval(update, 1000);
    }
    
    async checkAdminStatus() {
        if (this.userProfile?.role === 'admin') {
            const adminLink = document.getElementById('adminLink');
            if (adminLink) adminLink.style.display = 'flex';
        }
    }
    
    setupEventListeners() {
        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        
        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                this.saveSidebarPreference(sidebar.classList.contains('collapsed'));
            });
        }
        
        // Mobile menu
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        if (mobileMenuBtn && sidebar) {
            mobileMenuBtn.addEventListener('click', () => {
                sidebar.classList.toggle('mobile-open');
            });
        }
        
        // Chart period buttons
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const period = e.target.dataset.period;
                this.changeChartPeriod(period);
            });
        });
        
        // Holdings sort
        const sortSelect = document.getElementById('holdingsSort');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => this.sortHoldings(sortSelect.value));
        }
        
        // Edit assets
        const editAssetsBtn = document.getElementById('editAssetsBtn');
        if (editAssetsBtn) {
            editAssetsBtn.addEventListener('click', () => this.showAssetModal());
        }
        
        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
        
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
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.add('collapsed');
        }
    }
    
    initializeChart() {
        const canvas = document.getElementById('portfolioChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.getChartLabels('1W'),
                datasets: [{
                    label: 'Portfolio Value',
                    data: this.generateSampleData(),
                    borderColor: '#9CA3AF',
                    backgroundColor: 'rgba(156, 163, 175, 0.08)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: '#9CA3AF',
                    pointHoverBorderColor: '#0A0A0A',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#1A1A1A',
                        titleColor: '#E5E7EB',
                        bodyColor: '#D1D5DB',
                        borderColor: '#9CA3AF',
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => '$' + context.parsed.y.toLocaleString()
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#6B7280' }
                    },
                    y: {
                        grid: { color: 'rgba(156, 163, 175, 0.08)' },
                        ticks: {
                            color: '#6B7280',
                            callback: (value) => {
                                if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
                                if (value >= 1000) return '$' + (value / 1000).toFixed(1) + 'K';
                                return '$' + value;
                            }
                        }
                    }
                }
            }
        });
    }
    
    getChartLabels(period) {
        const labels = [];
        const now = new Date();
        let points = 7;
        
        switch(period) {
            case '1D': points = 24; break;
            case '1W': points = 7; break;
            case '1M': points = 30; break;
            default: points = 7;
        }
        
        for (let i = points - 1; i >= 0; i--) {
            const date = new Date(now);
            
            if (period === '1D') {
                date.setHours(date.getHours() - i);
                labels.push(date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
            } else if (period === '1W') {
                date.setDate(date.getDate() - i);
                labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
            } else {
                date.setDate(date.getDate() - i);
                labels.push(date.getDate().toString());
            }
        }
        
        return labels;
    }
    
    generateSampleData() {
        const baseValue = this.calculateTotalPortfolioValue() || 10000;
        const data = [];
        let current = baseValue * 0.85;
        
        for (let i = 0; i < 7; i++) {
            const change = (Math.random() - 0.3) * (baseValue * 0.03);
            current += change;
            current = Math.max(current, baseValue * 0.7);
            data.push(current);
        }
        
        return data;
    }
    
    changeChartPeriod(period) {
        if (!this.chart) {
            this.initializeChart();
            return;
        }
        
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = Array.from(document.querySelectorAll('.time-btn'))
            .find(btn => btn.dataset.period === period);
        if (activeBtn) activeBtn.classList.add('active');
        
        this.chart.data.labels = this.getChartLabels(period);
        this.chart.data.datasets[0].data = this.generateSampleData();
        this.chart.update();
    }
    
    async startPriceUpdates() {
        await this.updateCryptoPrices();
        this.renderCryptoFeed();
        
        this.priceUpdateInterval = setInterval(async () => {
            await this.updateCryptoPrices();
            this.renderCryptoFeed();
            this.updateHoldingsWithLivePrices();
            this.updatePortfolioSummary();
        }, 10000);
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
            // Use mock data
            this.cryptoPrices = {
                'BTC': { price: 87234.50, change24h: 1.25 },
                'ETH': { price: 3245.75, change24h: -0.5 },
                'SOL': { price: 187.30, change24h: 2.1 }
            };
        }
    }
    
    renderCryptoFeed() {
        const feedContainer = document.getElementById('cryptoFeed');
        if (!feedContainer) return;
        
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
        
        const change = priceData.change24h || 0;
        const changeClass = change >= 0 ? 'positive' : 'negative';
        const changeSign = change >= 0 ? '+' : '';
        
        card.innerHTML = `
            <div class="crypto-card-header">
                <div class="crypto-info">
                    <div class="crypto-name">${symbol}</div>
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
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (this.holdings.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No holdings yet</td></tr>`;
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
        const pl = value - (holding.total_amount * holding.average_cost);
        const plPercentage = (pl / (holding.total_amount * holding.average_cost)) * 100 || 0;
        
        row.innerHTML = `
            <td>${holding.asset_symbol}</td>
            <td>${this.formatNumber(holding.total_amount, 8)}</td>
            <td>$${this.formatNumber(holding.average_cost)}</td>
            <td>$${this.formatNumber(currentPrice)}</td>
            <td class="${pl >= 0 ? 'positive' : 'negative'}">
                ${pl >= 0 ? '+' : ''}$${this.formatNumber(pl)}
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
        
        const totalCapitalEl = document.getElementById('totalCapital');
        const currentBalanceEl = document.getElementById('currentBalance');
        const balanceChangeEl = document.getElementById('balanceChange');
        const totalProfitEl = document.getElementById('totalProfit');
        const totalLossEl = document.getElementById('totalLoss');
        
        if (totalCapitalEl) totalCapitalEl.textContent = `$${this.formatNumber(totalCost)}`;
        if (currentBalanceEl) currentBalanceEl.textContent = `$${this.formatNumber(totalValue)}`;
        if (balanceChangeEl) {
            balanceChangeEl.textContent = `${plPercentage >= 0 ? '+' : ''}${plPercentage.toFixed(2)}%`;
            balanceChangeEl.className = `trend-indicator ${plPercentage >= 0 ? 'positive' : 'negative'}`;
        }
        if (totalProfitEl) totalProfitEl.textContent = `$${this.formatNumber(totalPL > 0 ? totalPL : 0)}`;
        if (totalLossEl) totalLossEl.textContent = `$${this.formatNumber(totalPL < 0 ? Math.abs(totalPL) : 0)}`;
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
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (this.trades.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No trades yet</td></tr>`;
            return;
        }
        
        this.trades.forEach(trade => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${trade.asset_symbol}</td>
                <td><span class="type-badge ${trade.trade_type}">${trade.trade_type}</span></td>
                <td>${this.formatNumber(trade.amount, 8)}</td>
                <td>$${this.formatNumber(trade.entry_price)}</td>
                <td>${trade.exit_price ? '$' + this.formatNumber(trade.exit_price) : '-'}</td>
                <td class="${trade.profit_loss >= 0 ? 'positive' : 'negative'}">
                    ${trade.profit_loss ? (trade.profit_loss >= 0 ? '+' : '') + '$' + this.formatNumber(trade.profit_loss) : '-'}
                </td>
                <td>${this.formatTimeAgo(trade.created_at)}</td>
            `;
            tbody.appendChild(row);
        });
    }
    
    sortHoldings(criteria) {
        switch(criteria) {
            case 'highest_value':
                this.holdings.sort((a, b) => {
                    const valA = a.total_amount * (this.cryptoPrices[a.asset_symbol]?.price || 0);
                    const valB = b.total_amount * (this.cryptoPrices[b.asset_symbol]?.price || 0);
                    return valB - valA;
                });
                break;
            case 'alphabetical':
                this.holdings.sort((a, b) => a.asset_symbol.localeCompare(b.asset_symbol));
                break;
        }
        this.renderHoldingsTable();
    }
    
    showAssetModal() {
        notificationSystem.info('Asset selection will be available soon');
    }
    
    applyUserSettings() {
        if (!this.userSettings) return;
        if (this.userSettings.theme) {
            document.body.className = `${this.userSettings.theme}-theme`;
        }
    }
    
    formatNumber(num, decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) return '0.00';
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
        return `${days}d ago`;
    }
    
    async logout() {
        if (this.priceUpdateInterval) {
            clearInterval(this.priceUpdateInterval);
        }
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    }
}

// Initialize dashboard
let dashboardManager;
document.addEventListener('DOMContentLoaded', () => {
    dashboardManager = new DashboardManager();
    window.dashboardManager = dashboardManager;
});

window.addEventListener('beforeunload', () => {
    if (dashboardManager?.priceUpdateInterval) {
        clearInterval(dashboardManager.priceUpdateInterval);
    }
});
'@

# Save the fresh dashboard.js
Set-Content $dashJsPath $freshDashboardJs -Encoding UTF8 -NoNewline
Write-Host "   Created fresh dashboard.js" -ForegroundColor Green

# ============================================
# SUMMARY
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "         RESTORE COMPLETE!              " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Dashboard has been restored to working state!" -ForegroundColor Green
Write-Host ""
Write-Host "WHAT WAS FIXED:" -ForegroundColor Yellow
Write-Host "  - Chart initialization"
Write-Host "  - Price updates (with fallback mock data)"
Write-Host "  - Holdings display"
Write-Host "  - Portfolio summary calculations"
Write-Host "  - Event listeners"
Write-Host "  - Authentication check"
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "  1. Hard refresh browser: Ctrl + Shift + R"
Write-Host "  2. Log in again if needed"
Write-Host "  3. Dashboard should now display properly"
Write-Host ""
Write-Host "Backup saved to: $backupDir" -ForegroundColor Gray
Write-Host ""