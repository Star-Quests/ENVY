// ENVY Journal JavaScript - Complete Implementation with Independent Timers

import { ENVYConfig } from './config.js';
import { supabase } from './supabase-client.js';
import { connectionMonitor } from './connection-monitor.js';
import { notificationSystem } from './notifications.js';
import { getAssetLogoUrl } from './crypto-logos.js';
class JournalManager {
    constructor() {
        this.user = null;
        this.userProfile = null;
        this.userSettings = null;
        this.trades = [];
        this.assets = [];
        this.selectedAsset = null;
        this.currentPrice = null;
        this.cryptoPrices = {};
        this.activeTimers = new Map();
        this.currentPage = 1;
        this.pageSize = 25;
        this.totalPages = 1;
        this.filters = {
            status: 'all',
            asset: 'all'
        };
        this.tradeToDelete = null;
        this.priceUpdateInterval = null;
        this.currentTrade = null;
        this.editingTradeId = null;
        
        // NEW PROPERTIES
        this.openBuyPositions = [];
        this.selectedLinkedBuy = null;
        this.isPartialClose = false;
        
        this.initialize();
    }
    
    async initialize() {
        await this.checkAuth();
        await this.loadUserData();
        await this.loadAssets();
        this.setupEventListeners();
        this.updateGreeting();
        this.updateDateTime();
        this.loadTrades();
        this.updateStatistics();
        this.startPriceUpdates();
        this.checkAdminStatus();
        this.applyUserSettings();
        this.applyFormDefaults();
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
    }
    
    async loadAssets() {
    try {
        const response = await fetch('/api/proxy/bybit-assets');
        const data = await response.json();
        
        if (data.retCode === 0 && data.result.list) {
            const seen = new Set();
            this.assets = data.result.list
                .filter(item => item.status === 'Trading' && item.quoteCoin === 'USDT')
                .map(item => ({
                    symbol: item.baseCoin,
                    name: item.baseCoin,
                    logoUrl: this.getAssetLogo(item.baseCoin)
                }))
                .filter(asset => {
                    if (seen.has(asset.symbol)) return false;
                    seen.add(asset.symbol);
                    return true;
                })
                .sort((a, b) => a.symbol.localeCompare(b.symbol));
        } else {
            throw new Error('Failed to parse Bybit response');
        }
    } catch (error) {
        console.error('Error loading assets:', error);
        this.assets = this.getFallbackAssets();
    }
    this.populateAssetDropdown();
    this.populateFilterAssets();
}
    
    getFallbackAssets() {
        return [
            { symbol: 'BTC', name: 'Bitcoin' },
            { symbol: 'ETH', name: 'Ethereum' },
            { symbol: 'SOL', name: 'Solana' },
            { symbol: 'BNB', name: 'Binance Coin' },
            { symbol: 'XRP', name: 'Ripple' },
            { symbol: 'ADA', name: 'Cardano' },
            { symbol: 'DOGE', name: 'Dogecoin' },
            { symbol: 'MATIC', name: 'Polygon' },
            { symbol: 'DOT', name: 'Polkadot' },
            { symbol: 'AVAX', name: 'Avalanche' }
        ];
    }
    
    populateAssetDropdown() {
        const dropdownList = document.getElementById('assetDropdownList');
        dropdownList.innerHTML = '';
        
        this.assets.forEach(asset => {
            const item = document.createElement('div');
            item.className = 'asset-dropdown-item';
            item.dataset.symbol = asset.symbol;
            
            const logoUrl = this.getAssetLogo(asset.symbol);
            
            item.innerHTML = `
                <img src="${logoUrl}" alt="${asset.symbol}" onerror="this.src='assets/icons/default-crypto.svg'" style="width: 24px; height: 24px; border-radius: 50%; object-fit: contain;">
                <div class="asset-dropdown-info">
                    <div class="asset-dropdown-name">${asset.name}</div>
                    <div class="asset-dropdown-symbol">${asset.symbol}</div>
                </div>
                <div class="asset-dropdown-price" id="price-${asset.symbol}">-</div>
            `;
            
            item.addEventListener('click', () => this.selectAsset(asset));
            dropdownList.appendChild(item);
        });
    }
    
    populateFilterAssets() {
        const filterSelect = document.getElementById('filterAsset');
        filterSelect.innerHTML = '<option value="all">All Assets</option>';
        
        const uniqueAssets = [...new Set(this.trades.map(t => t.asset_symbol))];
        uniqueAssets.sort().forEach(symbol => {
            const option = document.createElement('option');
            option.value = symbol;
            option.textContent = symbol;
            filterSelect.appendChild(option);
        });
    }
    
    selectAsset(asset) {
        this.selectedAsset = asset;
        document.getElementById('assetInput').value = `${asset.name} (${asset.symbol})`;
        document.getElementById('assetSuffix').textContent = asset.symbol;
        
        document.querySelectorAll('.asset-dropdown-item').forEach(item => {
            item.classList.remove('selected');
            if (item.dataset.symbol === asset.symbol) {
                item.classList.add('selected');
            }
        });
        
            document.getElementById('assetDropdown').style.display = 'none';
    // Only fetch live price for NEW trades, not when editing
    const form = document.getElementById('tradeForm');
    if (!form || form.dataset.mode !== 'edit') {
        this.fetchCurrentPrice(asset.symbol);
    }
        
        this.updateAmountSuffix();
    }
    
    async fetchCurrentPrice(symbol) {
        const fetchBtn = document.getElementById('fetchPriceBtn');
        fetchBtn.disabled = true;
        fetchBtn.innerHTML = '<span class="spinner"></span> Fetching...';
        
        try {
            const response = await fetch(`/api/proxy/bybit-prices?symbols=${symbol}USDT`);
            const data = await response.json();
            
            if (data.retCode === 0 && data.result?.list?.length > 0) {
    const ticker = data.result.list[0];
    const price = parseFloat(ticker.lastPrice);
    this.currentPrice = price;
    document.getElementById('priceInput').value = price;
                document.getElementById(`price-${symbol}`).textContent = `$${this.formatNumber(data.price)}`;
                
                notificationSystem.success(`Current ${symbol} price: $${this.formatNumber(data.price)}`);
            }
        } catch (error) {
            console.error('Error fetching price:', error);
            notificationSystem.error('Failed to fetch current price');
        } finally {
            fetchBtn.disabled = false;
            fetchBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M4 4V20H20M18 8L14 12L11 9L7 13" stroke="currentColor" stroke-width="2"/>
                </svg>
                Fetch Live
            `;
        }
    }
    
    setupEventListeners() {
        const assetInput = document.getElementById('assetInput');
        assetInput.addEventListener('focus', () => {
            document.getElementById('assetDropdown').style.display = 'block';
        });
        assetInput.addEventListener('input', (e) => {
            this.filterAssets(e.target.value);
            document.getElementById('assetDropdown').style.display = 'block';
        });
        
        const assetSearch = document.getElementById('assetSearchInput');
        assetSearch.addEventListener('input', (e) => this.filterAssets(e.target.value));
        
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('assetDropdown');
            const assetInput = document.getElementById('assetInput');
            if (!dropdown.contains(e.target) && e.target !== assetInput) {
                dropdown.style.display = 'none';
            }
        });
        
        document.getElementById('fetchPriceBtn').addEventListener('click', () => {
            if (this.selectedAsset) {
                this.fetchCurrentPrice(this.selectedAsset.symbol);
            } else {
                notificationSystem.warning('Please select an asset first');
            }
        });
        
        document.getElementById('buyTypeBtn').addEventListener('click', () => {
    this.setTradeType('buy');
    document.getElementById('linkedBuyGroup').style.display = 'none';
    document.getElementById('partialCloseGroup').style.display = 'none';
    
    // Reset labels for BUY mode
    document.getElementById('priceLabel').textContent = 'Entry Price (USD)';
    document.getElementById('exitPriceLabel').textContent = 'Exit Price (Optional)';
    document.getElementById('priceInput').placeholder = '0.00';
});

document.getElementById('sellTypeBtn').addEventListener('click', async () => {
    this.setTradeType('sell');
    document.getElementById('linkedBuyGroup').style.display = 'block';
    document.getElementById('partialCloseGroup').style.display = 'block';
    await this.loadOpenBuyPositions();
    
    // Swap labels for SELL mode
    document.getElementById('priceLabel').textContent = 'Exit Price (USD)';
    document.getElementById('exitPriceLabel').textContent = 'Entry Price (USD)';
    document.getElementById('priceInput').placeholder = 'Enter sell price';
});
        
        document.getElementById('toggleAdvancedBtn').addEventListener('click', () => {
            const advancedFields = document.getElementById('advancedFields');
            const isVisible = advancedFields.style.display !== 'none';
            advancedFields.style.display = isVisible ? 'none' : 'block';
            
            const btn = document.getElementById('toggleAdvancedBtn');
            btn.innerHTML = isVisible ? 
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 6V18M12 18L16 14M12 18L8 14" stroke="currentColor" stroke-width="2"/></svg> Advanced Options' :
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 18V6M12 6L16 10M12 6L8 10" stroke="currentColor" stroke-width="2"/></svg> Hide Advanced';
        });
        
        document.getElementById('tradeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const form = e.target;
            if (form.dataset.mode === 'edit') {
                this.updateTrade();
            } else {
                this.addTrade();
            }
        });
        
        document.getElementById('clearFormBtn').addEventListener('click', () => {
            this.clearForm();
            this.resetFormToAddMode();
        });
        
        document.getElementById('filterStatus').addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.currentPage = 1;
            this.loadTrades();
        });
        
        document.getElementById('filterAsset').addEventListener('change', (e) => {
            this.filters.asset = e.target.value;
            this.currentPage = 1;
            this.loadTrades();
        });
        
        document.getElementById('exportJournalBtn').addEventListener('click', () => {
            this.exportJournal();
        });
        
        document.getElementById('prevPageBtn').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.loadTrades();
            }
        });
        
        document.getElementById('nextPageBtn').addEventListener('click', () => {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.loadTrades();
            }
        });
        
        document.getElementById('closeDeleteModal').addEventListener('click', () => {
            document.getElementById('deleteModal').classList.remove('active');
        });
        
        document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
            document.getElementById('deleteModal').classList.remove('active');
        });
        
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
            this.confirmDelete();
        });
        
        document.getElementById('closeDetailsModal').addEventListener('click', () => {
            document.getElementById('tradeDetailsModal').classList.remove('active');
        });
        
        document.getElementById('closeDetailsBtn').addEventListener('click', () => {
            document.getElementById('tradeDetailsModal').classList.remove('active');
        });
        
        document.getElementById('editTradeBtn').addEventListener('click', () => {
            this.editCurrentTrade();
        });
        
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });
        
        document.getElementById('mobileMenuBtn').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('mobile-open');
        });
        
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        document.getElementById('fullCloseBtn').addEventListener('click', () => {
            this.isPartialClose = false;
            document.getElementById('fullCloseBtn').classList.add('active');
            document.getElementById('partialCloseBtn').classList.remove('active');
            this.updateAmountSuffix();
        });
        
        document.getElementById('partialCloseBtn').addEventListener('click', () => {
            this.isPartialClose = true;
            document.getElementById('partialCloseBtn').classList.add('active');
            document.getElementById('fullCloseBtn').classList.remove('active');
            this.updateAmountSuffix();
        });
        
        document.getElementById('linkedBuySelect').addEventListener('change', (e) => {
            const tradeId = e.target.value;
            if (tradeId) {
                const selectedTrade = this.openBuyPositions.find(t => t.id === tradeId);
                this.selectedLinkedBuy = selectedTrade;
                
                const availableAmount = selectedTrade.remaining_amount || selectedTrade.amount;
                document.getElementById('availableAmountHint').textContent = 
                    `Available: ${this.formatNumber(availableAmount, 8)} ${selectedTrade.asset_symbol}`;
                
                if (!this.isPartialClose) {
                    document.getElementById('amountInput').value = availableAmount;
                }
                
                document.getElementById('priceInput').value = selectedTrade.entry_price;
            } else {
                this.selectedLinkedBuy = null;
                document.getElementById('availableAmountHint').textContent = '';
            }
        });
    }
    
    setTradeType(type) {
        const buyBtn = document.getElementById('buyTypeBtn');
        const sellBtn = document.getElementById('sellTypeBtn');
        
        if (type === 'buy') {
            buyBtn.classList.add('active');
            sellBtn.classList.remove('active');
        } else {
            sellBtn.classList.add('active');
            buyBtn.classList.remove('active');
        }
    }

    updateAmountSuffix() {
        const asset = this.selectedAsset;
        if (asset) {
            document.getElementById('assetSuffix').textContent = asset.symbol;
        } else {
            document.getElementById('assetSuffix').textContent = 'BTC';
        }
    }

    async loadOpenBuyPositions() {
        if (!this.selectedAsset) {
            document.getElementById('linkedBuySelect').innerHTML = '<option value="">-- Select an asset first --</option>';
            return;
        }
        
        const { data: positions } = await supabase
            .from('trades')
            .select('*')
            .eq('user_id', this.user.id)
            .eq('asset_symbol', this.selectedAsset.symbol)
            .eq('trade_type', 'buy')
            .eq('status', 'open')
            .order('started_at', { ascending: true });
            
        this.openBuyPositions = positions || [];
        
        const select = document.getElementById('linkedBuySelect');
        select.innerHTML = '<option value="">-- Select a Buy position --</option>';
        
        this.openBuyPositions.forEach(trade => {
            const remaining = trade.remaining_amount || trade.amount;
            if (remaining > 0.00000001) {
                const option = document.createElement('option');
                option.value = trade.id;
                option.textContent = `${this.formatDate(trade.started_at)} - ${this.formatNumber(trade.amount, 8)} ${trade.asset_symbol} @ $${this.formatNumber(trade.entry_price)} (Remaining: ${this.formatNumber(remaining, 8)})`;
                select.appendChild(option);
            }
        });
        
        if (this.openBuyPositions.length === 0) {
            select.innerHTML = '<option value="">-- No open buy positions for this asset --</option>';
        }
    }
    
    getTradeType() {
        return document.getElementById('buyTypeBtn').classList.contains('active') ? 'buy' : 'sell';
    }
    
    filterAssets(query) {
        const items = document.querySelectorAll('.asset-dropdown-item');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(query.toLowerCase()) ? 'flex' : 'none';
        });
    }
    
    async addTrade() {
        if (!this.selectedAsset) {
            notificationSystem.error('Please select an asset');
            return;
        }
        
        const amount = parseFloat(document.getElementById('amountInput').value);
        const price = parseFloat(document.getElementById('priceInput').value);
        const tradeType = this.getTradeType();
        
        if (!amount || amount <= 0) {
            notificationSystem.error('Please enter a valid amount');
            return;
        }
        
        if (!price || price <= 0) {
            notificationSystem.error('Please enter a valid price');
            return;
        }
        
        const fee = parseFloat(document.getElementById('feeInput').value) || 0.1;
        const notes = document.getElementById('notesInput').value;
        
        let linkedBuyId = null;
        let isPartial = false;
        let originalAmount = amount;
        let remainingAmount = null;
        
        if (tradeType === 'sell') {
            if (!this.selectedLinkedBuy) {
                notificationSystem.error('Please select a Buy position to close');
                return;
            }
            
            const buyTrade = this.selectedLinkedBuy;
            const availableAmount = buyTrade.remaining_amount || buyTrade.amount;
            
            if (amount > availableAmount) {
                notificationSystem.error(`Cannot sell more than available amount (${this.formatNumber(availableAmount, 8)} ${buyTrade.asset_symbol})`);
                return;
            }
            
            linkedBuyId = buyTrade.id;
            isPartial = this.isPartialClose;
            
            if (isPartial) {
                remainingAmount = availableAmount - amount;
            }
        }
        
        const tradeData = {
            user_id: this.user.id,
            asset_symbol: this.selectedAsset.symbol,
            asset_logo: this.getAssetLogo(this.selectedAsset.symbol),
            trade_type: tradeType,
            amount: amount,
            original_amount: originalAmount,
            remaining_amount: remainingAmount,
            entry_price: price,
            fee: fee,
            status: 'open',
            started_at: new Date().toISOString(),
            notes: notes,
            linked_buy_id: linkedBuyId,
            is_partial_close: isPartial
        };
        
        const { data, error } = await supabase
            .from('trades')
            .insert([tradeData])
            .select()
            .single();
            
        if (error) {
            console.error('Error adding trade:', error);
            notificationSystem.error('Failed to add trade');
            return;
        }
        
        if (tradeType === 'sell' && linkedBuyId) {
    const buyTrade = this.selectedLinkedBuy;
    const newRemaining = (buyTrade.remaining_amount || buyTrade.amount) - amount;
    
    // Calculate P/L using the correct formula (no Math.abs)
    const sellPL = (price - buyTrade.entry_price) * amount;
    const sellPLPercent = buyTrade.entry_price > 0 ? ((price - buyTrade.entry_price) / buyTrade.entry_price) * 100 : 0;
    
    // DELETE the new sell trade we just created - we don't want it
    await supabase
        .from('trades')
        .delete()
        .eq('id', data.id);
    
    // Stop the timer for the deleted trade
    const newTimerInterval = this.activeTimers.get(data.id);
    if (newTimerInterval) {
        clearInterval(newTimerInterval);
        this.activeTimers.delete(data.id);
    }
    
    // Update the ORIGINAL buy trade with the P/L and close it
    await supabase
        .from('trades')
        .update({ 
            exit_price: price,
            profit_loss: sellPL,
            profit_loss_percentage: sellPLPercent,
            status: newRemaining <= 0.00000001 ? 'closed' : 'open',
            ended_at: newRemaining <= 0.00000001 ? new Date().toISOString() : null,
            remaining_amount: newRemaining,
            trade_type: newRemaining <= 0.00000001 ? 'sell' : 'buy'  // Only change to sell if fully closed
        })
        .eq('id', linkedBuyId);
    
    // If the original buy is now closed, stop its timer
    if (newRemaining <= 0.00000001) {
        const buyTimerInterval = this.activeTimers.get(linkedBuyId);
        if (buyTimerInterval) {
            clearInterval(buyTimerInterval);
            this.activeTimers.delete(linkedBuyId);
        }
    }
}
        
        if (tradeType === 'buy') {
    await this.updateHoldings(data);
}
        
        if (this.userSettings?.sound_enabled) {
            document.getElementById('tradeSuccessSound').play();
        }
        
        notificationSystem.success('Trade added successfully');
        
        if (this.userSettings?.auto_clear_form) {
            this.clearForm();
            document.getElementById('linkedBuyGroup').style.display = 'none';
            document.getElementById('partialCloseGroup').style.display = 'none';
        }
        
        this.loadTrades();
        this.updateStatistics();
        
        if (data.status === 'open' && tradeType === 'buy') {
            this.startTradeTimer(data);
        }
    }
    
    async updateTrade() {
        if (!this.editingTradeId) return;
        
        const amount = parseFloat(document.getElementById('amountInput').value);
        const price = parseFloat(document.getElementById('priceInput').value);
        
        if (!amount || amount <= 0) {
            notificationSystem.error('Please enter a valid amount');
            return;
        }
        
        if (!price || price <= 0) {
            notificationSystem.error('Please enter a valid price');
            return;
        }
        
        const tradeType = this.getTradeType();
        const fee = parseFloat(document.getElementById('feeInput').value) || 0.1;
        const exitPrice = parseFloat(document.getElementById('exitPriceInput').value) || null;
        const notes = document.getElementById('notesInput').value;
        
        const isClosing = exitPrice !== null && exitPrice > 0;
        
        const updateData = {
            asset_symbol: this.selectedAsset.symbol,
            asset_logo: this.getAssetLogo(this.selectedAsset.symbol),
            trade_type: tradeType,
            amount: amount,
            entry_price: price,
            exit_price: exitPrice,
            fee: fee,
            notes: notes,
            status: isClosing ? 'closed' : 'open'
        };
        
    if (isClosing) {
    // FIX: Always calculate P/L based on whether exit > entry or exit < entry
    const rawPL = (exitPrice - price) * amount;
    
    // Force the sign based on whether it's actually profitable
    // If exit price is higher than entry, it's a profit (positive)
    // If exit price is lower than entry, it's a loss (negative)
    updateData.profit_loss = rawPL;
    
    // Calculate percentage
    if (price * amount !== 0) {
        updateData.profit_loss_percentage = ((exitPrice - price) / price) * 100;
    } else {
        updateData.profit_loss_percentage = 0;
    }
    
    // Debug logging
    console.log('🔴 UPDATE TRADE - Closing Trade:', {
        symbol: this.selectedAsset.symbol,
        entryPrice: price,
        exitPrice: exitPrice,
        amount: amount,
        rawPL: rawPL,
        pct: updateData.profit_loss_percentage,
        expectedSign: exitPrice >= price ? 'POSITIVE (Profit)' : 'NEGATIVE (Loss)'
    });

    updateData.ended_at = new Date().toISOString();
    
    // INTELLIGENT: If this was a BUY and exit price is added, change to SELL type
    // This means the position is now closed/sold
    const { data: originalTrade } = await supabase
        .from('trades')
        .select('trade_type')
        .eq('id', this.editingTradeId)
        .single();
        
    if (originalTrade && originalTrade.trade_type === 'buy') {
        updateData.trade_type = 'sell';
    }
    
    await this.updateHoldingsOnEdit(this.editingTradeId, updateData);
    
    const interval = this.activeTimers.get(this.editingTradeId);
    if (interval) {
        clearInterval(interval);
        this.activeTimers.delete(this.editingTradeId);
    }
}
        
        const { error } = await supabase
            .from('trades')
            .update(updateData)
            .eq('id', this.editingTradeId);
            
        if (error) {
            console.error('Error updating trade:', error);
            notificationSystem.error('Failed to update trade');
            return;
        }

        // DEBUG: Log what was sent to database
console.log('🔴 DATABASE UPDATE - Data sent:', {
    id: this.editingTradeId,
    profit_loss: updateData.profit_loss,
    profit_loss_percentage: updateData.profit_loss_percentage,
    exit_price: updateData.exit_price,
    entry_price: updateData.entry_price
});

// DEBUG: Fetch back to see what was stored
const { data: verifyData } = await supabase
    .from('trades')
    .select('profit_loss, profit_loss_percentage')
    .eq('id', this.editingTradeId)
    .single();
console.log('🔴 DATABASE VERIFY - Stored values:', verifyData);
        
        notificationSystem.success('Trade updated successfully');
        
        this.resetFormToAddMode();
        this.clearForm();
        this.loadTrades();
        this.updateStatistics();
        this.editingTradeId = null;
    }

    async updateHoldingsOnEdit(tradeId, updateData) {
        const { data: trade } = await supabase
            .from('trades')
            .select('*')
            .eq('id', tradeId)
            .single();
            
        if (!trade || trade.trade_type !== 'buy') return;
        
        const { data: holding } = await supabase
            .from('holdings')
            .select('*')
            .eq('user_id', this.user.id)
            .eq('asset_symbol', trade.asset_symbol)
            .single();
            
        if (holding) {
            const newAmount = holding.total_amount - trade.amount;
            if (newAmount <= 0.00000001) {
                await supabase.from('holdings').delete().eq('id', holding.id);
            } else {
                await supabase.from('holdings').update({ total_amount: newAmount }).eq('id', holding.id);
            }
        }
    }
    
    resetFormToAddMode() {
        const addBtn = document.getElementById('addTradeBtn');
        addBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 5V19M12 19L16 15M12 19L8 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            </svg>
            Add Trade
        `;
        
        const form = document.getElementById('tradeForm');
        form.dataset.mode = 'add';
    }
    
    editCurrentTrade() {
        if (!this.currentTrade) {
            notificationSystem.error('No trade selected');
            return;
        }
        
        const trade = this.currentTrade;
        
        document.getElementById('tradeDetailsModal').classList.remove('active');
        this.populateFormForEdit(trade);
        document.querySelector('.trade-form-section').scrollIntoView({ behavior: 'smooth' });
        
        const addBtn = document.getElementById('addTradeBtn');
        addBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M5 12L10 17L19 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Update Trade
        `;
        
        this.editingTradeId = trade.id;
        const form = document.getElementById('tradeForm');
        form.dataset.mode = 'edit';
        
        notificationSystem.info('Editing trade - make your changes and click Update');
    }
    
    populateFormForEdit(trade) {
    const asset = this.assets.find(a => a.symbol === trade.asset_symbol);
    if (asset) {
        this.selectAsset(asset);
    } else {
        document.getElementById('assetInput').value = trade.asset_symbol;
        document.getElementById('assetSuffix').textContent = trade.asset_symbol;
        this.selectedAsset = { symbol: trade.asset_symbol, name: trade.asset_symbol };
    }
    
    this.setTradeType(trade.trade_type);
    document.getElementById('amountInput').value = trade.amount;
    
        // Force entry price after any async fetches - try multiple times
    document.getElementById('priceInput').value = trade.entry_price;
    setTimeout(() => {
        document.getElementById('priceInput').value = trade.entry_price;
    }, 300);
    setTimeout(() => {
        document.getElementById('priceInput').value = trade.entry_price;
    }, 800);
    setTimeout(() => {
        document.getElementById('priceInput').value = trade.entry_price;
    }, 1500);
        document.getElementById('priceInput').value = trade.entry_price;
        document.getElementById('feeInput').value = trade.fee || 0.1;
        document.getElementById('exitPriceInput').value = trade.exit_price || '';
        document.getElementById('notesInput').value = trade.notes || '';
        
        if (trade.exit_price) {
            document.getElementById('advancedFields').style.display = 'block';
        }
    }
    
    async updateHoldings(trade) {
        const { data: holding } = await supabase
            .from('holdings')
            .select('*')
            .eq('user_id', this.user.id)
            .eq('asset_symbol', trade.asset_symbol)
            .single();
            
        if (holding) {
            let newAmount = holding.total_amount;
            let newCost = holding.average_cost * holding.total_amount;
            
            if (trade.trade_type === 'buy') {
                newAmount += trade.amount;
                newCost += trade.amount * trade.entry_price;
            } else {
                if (trade.amount > holding.total_amount) {
                    notificationSystem.error(`Cannot sell ${trade.amount} ${trade.asset_symbol}. You only have ${this.formatNumber(holding.total_amount, 8)} available.`);
                    throw new Error('Insufficient holdings');
                }
                
                newAmount -= trade.amount;
                const sellRatio = trade.amount / holding.total_amount;
                newCost -= (holding.average_cost * holding.total_amount) * sellRatio;
            }
            
            if (newAmount <= 0.00000001) {
                await supabase
                    .from('holdings')
                    .delete()
                    .eq('id', holding.id);
            } else {
                const newAvgCost = newCost / newAmount;
                await supabase
                    .from('holdings')
                    .update({
                        total_amount: newAmount,
                        average_cost: newAvgCost
                    })
                    .eq('id', holding.id);
            }
        } else if (trade.trade_type === 'buy') {
            await supabase
                .from('holdings')
                .insert([{
                    user_id: this.user.id,
                    asset_symbol: trade.asset_symbol,
                    asset_logo: trade.asset_logo,
                    total_amount: trade.amount,
                    average_cost: trade.entry_price
                }]);
        } else {
            notificationSystem.error(`You don't own any ${trade.asset_symbol} to sell.`);
            throw new Error('No holdings to sell');
        }
    }
    
    async loadTrades() {
        let query = supabase
            .from('trades')
            .select('*', { count: 'exact' })
            .eq('user_id', this.user.id);
            
        if (this.filters.status !== 'all') {
            query = query.eq('status', this.filters.status);
        }
        
        if (this.filters.asset !== 'all') {
            query = query.eq('asset_symbol', this.filters.asset);
        }
        
        const from = (this.currentPage - 1) * this.pageSize;
        const to = from + this.pageSize - 1;
        
        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);
            
        if (error) {
            console.error('Error loading trades:', error);
            return;
        }
        
        this.trades = data || [];
        this.totalPages = Math.ceil(count / this.pageSize);
        
        this.renderTrades();
        this.updatePagination();
        this.populateFilterAssets();
        this.startAllTradeTimers();
    }
    
    renderTrades() {
        const tbody = document.getElementById('journalTableBody');
        tbody.innerHTML = '';
        
        if (this.trades.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="12">
                        <div class="empty-state">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                                <path d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            <h4>No Trades Found</h4>
                            <p>Start journaling your trades to build your history</p>
                        </div>
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
        row.className = `trade-${trade.status}`;
        
        if (trade.status === 'closed') {
            row.classList.add(trade.profit_loss >= 0 ? 'trade-closed-profit' : 'trade-closed-loss');
        }
        
        const logoCell = document.createElement('td');
        logoCell.className = 'asset-logo-cell';
        logoCell.style.cssText = 'text-align: center; vertical-align: middle;';
        logoCell.innerHTML = `
            <img src="${trade.asset_logo || this.getAssetLogo(trade.asset_symbol)}" 
                 alt="${trade.asset_symbol}" 
                 class="asset-logo-table"
                 style="width: 28px; height: 28px; border-radius: 50%; object-fit: contain; display: inline-block;"
                 onerror="this.src='assets/icons/default-crypto.svg'">
        `;
        row.appendChild(logoCell);
        
        const assetCell = document.createElement('td');
        assetCell.textContent = trade.asset_symbol;
        assetCell.style.fontWeight = '600';
        assetCell.style.verticalAlign = 'middle';
        row.appendChild(assetCell);
        
        // Type(BUY) column
// Type(BUY) column - Show BUY only if originally a buy (has entry but no exit)
const buyCell = document.createElement('td');
buyCell.className = 'trade-type-cell';
buyCell.style.verticalAlign = 'middle';
buyCell.style.textAlign = 'center';

// A trade is a BUY if trade_type is 'buy' OR if it doesn't have an exit price yet
if (trade.trade_type === 'buy' && !trade.exit_price) {
    buyCell.innerHTML = `<span class="type-badge type-start">BUY</span>`;
} else {
    buyCell.innerHTML = `<span style="color: var(--accent-muted);">-</span>`;
}
row.appendChild(buyCell);

// Type(SELL) column - Show SELL if trade_type is 'sell' OR if exit price exists (closed position)
const sellCell = document.createElement('td');
sellCell.className = 'trade-type-cell';
sellCell.style.verticalAlign = 'middle';
sellCell.style.textAlign = 'center';

if (trade.trade_type === 'sell' || trade.exit_price) {
    if (trade.is_partial_close) {
        sellCell.innerHTML = `<span class="type-badge type-partial">PARTIAL</span>`;
    } else {
        sellCell.innerHTML = `<span class="type-badge type-end">SELL</span>`;
    }
} else {
    sellCell.innerHTML = `<span style="color: var(--accent-muted);">-</span>`;
}
row.appendChild(sellCell);
        
        const amountCell = document.createElement('td');
        amountCell.textContent = this.formatNumber(trade.amount, 8);
        amountCell.style.fontFamily = 'var(--font-mono)';
        amountCell.style.verticalAlign = 'middle';
        row.appendChild(amountCell);
        
        const entryCell = document.createElement('td');
        entryCell.textContent = `$${this.formatNumber(trade.entry_price)}`;
        entryCell.style.fontFamily = 'var(--font-mono)';
        entryCell.style.verticalAlign = 'middle';
        row.appendChild(entryCell);
        
        const exitCell = document.createElement('td');
        exitCell.textContent = trade.exit_price ? `$${this.formatNumber(trade.exit_price)}` : '-';
        exitCell.style.fontFamily = 'var(--font-mono)';
        exitCell.style.verticalAlign = 'middle';
        row.appendChild(exitCell);
        
        const plCell = document.createElement('td');
plCell.style.verticalAlign = 'middle';
if (trade.profit_loss !== null && trade.profit_loss !== undefined) {
    // FIX: Force numeric conversion and proper sign detection
    const rawPL = Number(trade.profit_loss);
    const rawPct = Number(trade.profit_loss_percentage);
    
    const isProfitable = rawPL >= 0;
    const plClass = isProfitable ? 'positive' : 'negative';
    const plSign = isProfitable ? '+' : '-';
    
    // Always use Math.abs for display, but keep sign for logic
    const displayPL = Math.abs(rawPL);
    const displayPct = Math.abs(rawPct || 0);
    
    plCell.className = plClass;
    plCell.innerHTML = `
        ${plSign}$${this.formatNumber(displayPL)}
        <br>
        <small class="${plClass}">${plSign}${displayPct.toFixed(2)}%</small>
    `;
    
    // Debug: Log what we're displaying
    console.log('🔵 P/L Display:', {
        symbol: trade.asset_symbol,
        rawPL: rawPL,
        rawPct: rawPct,
        isProfitable: isProfitable,
        sign: plSign,
        class: plClass
    });
} else {
    plCell.textContent = '-';
}
        row.appendChild(plCell);
        
        const durationCell = document.createElement('td');
        durationCell.textContent = this.calculateDuration(trade);
        durationCell.style.fontFamily = 'var(--font-mono)';
        durationCell.style.verticalAlign = 'middle';
        row.appendChild(durationCell);
        
        const timerCell = document.createElement('td');
        timerCell.style.verticalAlign = 'middle';
        timerCell.appendChild(this.createTimerElement(trade));
        row.appendChild(timerCell);
        
        const dateCell = document.createElement('td');
        dateCell.style.verticalAlign = 'middle';
        dateCell.innerHTML = `
            ${this.formatDate(trade.created_at)}
            <br>
            <small>${this.formatTime(trade.created_at)}</small>
        `;
        row.appendChild(dateCell);
        
        const actionsCell = document.createElement('td');
        actionsCell.className = 'trade-actions';
        actionsCell.style.verticalAlign = 'middle';
        actionsCell.appendChild(this.createActionButtons(trade));
        row.appendChild(actionsCell);
        
        row.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                this.showTradeDetails(trade);
            }
        });
        
        return row;
    }
    
    createTimerElement(trade) {
        const container = document.createElement('div');
        container.className = 'trade-timer-container';
        
        const timerDisplay = document.createElement('span');
        timerDisplay.className = 'trade-timer';
        timerDisplay.id = `timer-${trade.id}`;
        
        if (trade.status === 'open') {
            timerDisplay.classList.add('running');
        }
        
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'timer-controls';
        
        if (trade.status === 'open') {
            const pauseBtn = document.createElement('button');
            pauseBtn.className = 'timer-btn pause-btn';
            pauseBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <rect x="6" y="4" width="4" height="16" fill="currentColor"/>
                    <rect x="14" y="4" width="4" height="16" fill="currentColor"/>
                </svg>
            `;
            pauseBtn.title = 'Pause Timer';
            pauseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.pauseTradeTimer(trade.id);
            });
            controlsDiv.appendChild(pauseBtn);
            
            const endBtn = document.createElement('button');
            endBtn.className = 'timer-btn stop-btn';
            endBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <rect x="4" y="4" width="16" height="16" fill="currentColor"/>
                </svg>
            `;
            endBtn.title = 'End Trade';
            endBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.endTrade(trade.id);
            });
            controlsDiv.appendChild(endBtn);
        } else if (trade.status === 'paused') {
            const resumeBtn = document.createElement('button');
            resumeBtn.className = 'timer-btn';
            resumeBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <polygon points="5,3 19,12 5,21" fill="currentColor"/>
                </svg>
            `;
            resumeBtn.title = 'Resume Timer';
            resumeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resumeTradeTimer(trade.id);
            });
            controlsDiv.appendChild(resumeBtn);
        }
        
        container.appendChild(timerDisplay);
        container.appendChild(controlsDiv);
        
        return container;
    }
    
    createActionButtons(trade) {
        const container = document.createElement('div');
        
        const viewBtn = document.createElement('button');
        viewBtn.className = 'action-btn';
        viewBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" fill="currentColor"/>
                <path d="M22 12C22 12 19 18 12 18C5 18 2 12 2 12C2 12 5 6 12 6C19 6 22 12 22 12Z" stroke="currentColor" stroke-width="2"/>
            </svg>
        `;
        viewBtn.title = 'View Details';
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showTradeDetails(trade);
        });
        container.appendChild(viewBtn);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn delete-btn';
        deleteBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M4 7H20M10 11V17M14 11V17M5 7L6 19C6 20.1046 6.89543 21 8 21H16C17.1046 21 18 20.1046 18 19L19 7M9 7V4C9 3.44772 9.44772 3 10 3H14C14.5523 3 15 3.44772 15 4V7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `;
        deleteBtn.title = 'Delete Trade';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.promptDeleteTrade(trade);
        });
        container.appendChild(deleteBtn);
        
        return container;
    }
    
    startAllTradeTimers() {
        this.activeTimers.forEach((interval) => clearInterval(interval));
        this.activeTimers.clear();
        
        this.trades.forEach(trade => {
            if (trade.status === 'open') {
                this.startTradeTimer(trade);
            }
        });
    }
    
    startTradeTimer(trade) {
        const timerElement = document.getElementById(`timer-${trade.id}`);
        if (!timerElement) return;
        
        const updateTimer = () => {
            const duration = this.calculateTradeDuration(trade);
            timerElement.textContent = this.formatDuration(duration);
            
            if (this.userSettings?.trade_age_color) {
                this.applyTimerColor(timerElement, duration);
            }
        };
        
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        this.activeTimers.set(trade.id, interval);
    }
    
    calculateTradeDuration(trade) {
        let startTime = new Date(trade.started_at);
        let endTime = trade.status === 'closed' ? new Date(trade.ended_at) : new Date();
        
        if (trade.accumulated_paused_time) {
            const pausedMs = this.parseIntervalToMs(trade.accumulated_paused_time);
            endTime = new Date(endTime.getTime() - pausedMs);
        }
        
        if (trade.status === 'paused' && trade.paused_at) {
            endTime = new Date(trade.paused_at);
        }
        
        return endTime.getTime() - startTime.getTime();
    }
    
    parseIntervalToMs(interval) {
        if (!interval) return 0;
        
        let ms = 0;
        const match = interval.match(/(?:(\d+)\s*days?\s*)?(?:(\d+):(\d+):(\d+))?/);
        
        if (match) {
            const days = parseInt(match[1]) || 0;
            const hours = parseInt(match[2]) || 0;
            const minutes = parseInt(match[3]) || 0;
            const seconds = parseInt(match[4]) || 0;
            
            ms = (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
        }
        
        return ms;
    }
    
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (this.userSettings?.timer_format === 'compact') {
            if (days > 0) return `${days}d ${hours % 24}h`;
            if (hours > 0) return `${hours}h ${minutes % 60}m`;
            if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
            return `${seconds}s`;
        } else {
            const pad = (n) => String(n).padStart(2, '0');
            if (days > 0) {
                return `${days}d ${pad(hours % 24)}:${pad(minutes % 60)}:${pad(seconds % 60)}`;
            }
            return `${pad(hours)}:${pad(minutes % 60)}:${pad(seconds % 60)}`;
        }
    }
    
    applyTimerColor(element, durationMs) {
        const hours = durationMs / (1000 * 60 * 60);
        
        element.classList.remove('timer-age-new', 'timer-age-hours', 'timer-age-days', 'timer-age-weeks');
        
        if (hours < 1) {
            element.classList.add('timer-age-new');
        } else if (hours < 24) {
            element.classList.add('timer-age-hours');
        } else if (hours < 168) {
            element.classList.add('timer-age-days');
        } else {
            element.classList.add('timer-age-weeks');
        }
    }
    
    calculateDuration(trade) {
        const ms = this.calculateTradeDuration(trade);
        return this.formatDuration(ms);
    }
    
    async pauseTradeTimer(tradeId) {
        const { data: trade } = await supabase
            .from('trades')
            .select('*')
            .eq('id', tradeId)
            .single();
            
        if (!trade) return;
        
        await supabase
            .from('trades')
            .update({
                status: 'paused',
                paused_at: new Date().toISOString()
            })
            .eq('id', tradeId);
            
        const interval = this.activeTimers.get(tradeId);
        if (interval) {
            clearInterval(interval);
            this.activeTimers.delete(tradeId);
        }
        
        this.loadTrades();
        notificationSystem.info('Trade timer paused');
    }
    
    async resumeTradeTimer(tradeId) {
        const { data: trade } = await supabase
            .from('trades')
            .select('*')
            .eq('id', tradeId)
            .single();
            
        if (!trade) return;
        
        const pausedDuration = new Date().getTime() - new Date(trade.paused_at).getTime();
        const accumulatedMs = this.parseIntervalToMs(trade.accumulated_paused_time || '0 seconds');
        const totalPausedMs = accumulatedMs + pausedDuration;
        
        const totalSeconds = Math.floor(totalPausedMs / 1000);
        const interval = `${totalSeconds} seconds`;
        
        await supabase
            .from('trades')
            .update({
                status: 'open',
                paused_at: null,
                accumulated_paused_time: interval
            })
            .eq('id', tradeId);
            
        this.loadTrades();
        notificationSystem.success('Trade timer resumed');
    }
    
    async endTrade(tradeId) {
        const { data: trade } = await supabase
            .from('trades')
            .select('*')
            .eq('id', tradeId)
            .single();
            
        if (!trade) return;
        
        let exitPrice;
        try {
            const response = await fetch(`/api/proxy/bybit-prices?symbols=${symbol}USDT`);
            const data = await response.json();
            exitPrice = data.price;
        } catch (error) {
            notificationSystem.error('Failed to fetch current price');
            return;
        }
        
        let profitLoss = (exitPrice - trade.entry_price) * trade.amount;
        
        let profitLossPercentage = 0;
        if (trade.entry_price * trade.amount !== 0) {
            profitLossPercentage = (profitLoss / (trade.entry_price * trade.amount)) * 100;
        }
        
        await supabase
            .from('trades')
            .update({
                status: 'closed',
                exit_price: exitPrice,
                ended_at: new Date().toISOString(),
                profit_loss: profitLoss,
                profit_loss_percentage: profitLossPercentage
            })
            .eq('id', tradeId);
            
        const interval = this.activeTimers.get(tradeId);
        if (interval) {
            clearInterval(interval);
            this.activeTimers.delete(tradeId);
        }
        
        await this.updateHoldingsOnClose(trade);
        
        this.loadTrades();
        this.updateStatistics();
        
        if (this.userSettings?.sound_enabled) {
            document.getElementById('tradeSuccessSound').play();
        }
        
        notificationSystem.success(`Trade closed with ${profitLoss >= 0 ? 'profit' : 'loss'}: $${this.formatNumber(Math.abs(profitLoss))}`);
    }
    
    async updateHoldingsOnClose(trade) {
        const { data: holding } = await supabase
            .from('holdings')
            .select('*')
            .eq('user_id', this.user.id)
            .eq('asset_symbol', trade.asset_symbol)
            .single();
            
        if (!holding) return;
        
        let newAmount = holding.total_amount;
        
        if (trade.trade_type === 'buy') {
            if (trade.amount > holding.total_amount) {
                console.warn('Trade amount exceeds holdings, adjusting to available amount');
                trade.amount = holding.total_amount;
            }
            newAmount -= trade.amount;
        } else {
            newAmount += trade.amount;
        }
        
        if (newAmount <= 0.00000001) {
            await supabase
                .from('holdings')
                .delete()
                .eq('id', holding.id);
        } else {
            await supabase
                .from('holdings')
                .update({ total_amount: newAmount })
                .eq('id', holding.id);
        }
    }
    
    promptDeleteTrade(trade) {
        this.tradeToDelete = trade;
        
        const preview = document.getElementById('deleteTradePreview');
        preview.innerHTML = `
            <div class="trade-detail-item">
                <span class="trade-detail-label">Asset</span>
                <span class="trade-detail-value">${trade.asset_symbol}</span>
            </div>
            <div class="trade-detail-item">
                <span class="trade-detail-label">Type</span>
                <span class="trade-detail-value">${trade.trade_type.toUpperCase()}</span>
            </div>
            <div class="trade-detail-item">
                <span class="trade-detail-label">Amount</span>
                <span class="trade-detail-value">${this.formatNumber(trade.amount, 8)}</span>
            </div>
            <div class="trade-detail-item">
                <span class="trade-detail-label">Entry Price</span>
                <span class="trade-detail-value">$${this.formatNumber(trade.entry_price)}</span>
            </div>
        `;
        
        document.getElementById('deleteModal').classList.add('active');
    }
    
    async confirmDelete() {
        if (!this.tradeToDelete) return;
        
        const trade = this.tradeToDelete;
        
        await this.reverseHoldingsOnDelete(trade);
        
        const { error } = await supabase
            .from('trades')
            .delete()
            .eq('id', trade.id);
            
        if (error) {
            console.error('Error deleting trade:', error);
            notificationSystem.error('Failed to delete trade');
            return;
        }
        
        const interval = this.activeTimers.get(trade.id);
        if (interval) {
            clearInterval(interval);
            this.activeTimers.delete(trade.id);
        }
        
        document.getElementById('deleteModal').classList.remove('active');
        this.tradeToDelete = null;
        
        await this.loadTrades();
        await this.updateStatistics();
        
        notificationSystem.success('Trade deleted successfully');
    }

    async reverseHoldingsOnDelete(trade) {
        const { data: holding } = await supabase
            .from('holdings')
            .select('*')
            .eq('user_id', this.user.id)
            .eq('asset_symbol', trade.asset_symbol)
            .single();
            
        if (!holding) return;
        
        let newAmount = holding.total_amount;
        let newCost = holding.average_cost * holding.total_amount;
        
        if (trade.trade_type === 'buy') {
            newAmount -= trade.amount;
            newCost -= trade.amount * trade.entry_price;
        } else {
            newAmount += trade.amount;
            newCost += trade.amount * holding.average_cost;
        }
        
        if (newAmount <= 0.00000001) {
            await supabase.from('holdings').delete().eq('id', holding.id);
        } else {
            const newAvgCost = newCost / newAmount;
            await supabase.from('holdings').update({ total_amount: newAmount, average_cost: newAvgCost }).eq('id', holding.id);
        }
    }
    
    showTradeDetails(trade) {
    this.currentTrade = trade;
    
    const body = document.getElementById('tradeDetailsBody');
    const duration = this.calculateDuration(trade);
    const plClass = trade.profit_loss >= 0 ? 'positive' : 'negative';
    const plSign = trade.profit_loss >= 0 ? '+' : '';
    const pctSign = (trade.profit_loss_percentage || 0) >= 0 ? '+' : '';
    
    body.innerHTML = `
        <div class="trade-details-grid">
            <div class="trade-detail-item">
                <span class="trade-detail-label">Asset</span>
                <span class="trade-detail-value">
                    <img src="${trade.asset_logo || this.getAssetLogo(trade.asset_symbol)}" 
                         alt="${trade.asset_symbol}" 
                         style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px; object-fit: contain; vertical-align: middle;"
                         onerror="this.src='assets/icons/default-crypto.svg'">
                    ${trade.asset_symbol}
                </span>
            </div>
            <div class="trade-detail-item">
                <span class="trade-detail-label">Type</span>
                <span class="trade-detail-value">${trade.trade_type.toUpperCase()}</span>
            </div>
            <div class="trade-detail-item">
                <span class="trade-detail-label">Amount</span>
                <span class="trade-detail-value">${this.formatNumber(trade.amount, 8)} ${trade.asset_symbol}</span>
            </div>
            <div class="trade-detail-item">
                <span class="trade-detail-label">Entry Price</span>
                <span class="trade-detail-value">$${this.formatNumber(trade.entry_price)}</span>
            </div>
            <div class="trade-detail-item">
                <span class="trade-detail-label">Exit Price</span>
                <span class="trade-detail-value">${trade.exit_price ? '$' + this.formatNumber(trade.exit_price) : 'N/A'}</span>
            </div>
            <div class="trade-detail-item">
                <span class="trade-detail-label">Fee</span>
                <span class="trade-detail-value">${trade.fee}%</span>
            </div>
            <div class="trade-detail-item">
                <span class="trade-detail-label">Status</span>
                <span class="trade-detail-value">${trade.status.toUpperCase()}</span>
            </div>
            <div class="trade-detail-item">
                <span class="trade-detail-label">Duration</span>
                <span class="trade-detail-value">${duration}</span>
            </div>
            <div class="trade-detail-item">
                <span class="trade-detail-label">Profit/Loss</span>
                <span class="trade-detail-value ${plClass}">
    ${plSign}$${this.formatNumber(Math.abs(Number(trade.profit_loss) || 0))}
    ${trade.profit_loss_percentage ? ` (${plSign}${Math.abs(Number(trade.profit_loss_percentage)).toFixed(2)}%)` : ''}
</span>
            </div>
            <div class="trade-detail-item">
                <span class="trade-detail-label">Opened</span>
                <span class="trade-detail-value">${this.formatDateTime(trade.started_at)}</span>
            </div>
            <div class="trade-detail-item">
                <span class="trade-detail-label">Closed</span>
                <span class="trade-detail-value">${trade.ended_at ? this.formatDateTime(trade.ended_at) : 'N/A'}</span>
            </div>
            <div class="trade-detail-full">
                <span class="trade-detail-label">Notes</span>
                <span class="trade-detail-value">${trade.notes || 'No notes'}</span>
            </div>
        </div>
    `;
    
    document.getElementById('tradeDetailsModal').classList.add('active');
}
    
    async updateStatistics() {
        const { data: trades } = await supabase
            .from('trades')
            .select('*')
            .eq('user_id', this.user.id);
            
        if (!trades || trades.length === 0) {
            this.displayEmptyStatistics();
            return;
        }
        
        const totalTrades = trades.length;
        const closedTrades = trades.filter(t => t.status === 'closed');
        const winningTrades = closedTrades.filter(t => t.profit_loss > 0);
        const losingTrades = closedTrades.filter(t => t.profit_loss < 0);
        
        const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
        const totalPL = closedTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
        
        const avgWin = winningTrades.length > 0 
            ? winningTrades.reduce((sum, t) => sum + t.profit_loss, 0) / winningTrades.length 
            : 0;
            
        const avgLoss = losingTrades.length > 0 
            ? Math.abs(losingTrades.reduce((sum, t) => sum + t.profit_loss, 0) / losingTrades.length)
            : 0;
            
        const grossProfit = winningTrades.reduce((sum, t) => sum + t.profit_loss, 0);
        const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit_loss, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
        
        const largestWin = winningTrades.length > 0 
            ? Math.max(...winningTrades.map(t => t.profit_loss))
            : 0;
            
        const largestLoss = losingTrades.length > 0 
            ? Math.min(...losingTrades.map(t => t.profit_loss))
            : 0;
        
        let totalDurationMs = 0;
        closedTrades.forEach(trade => {
            totalDurationMs += this.calculateTradeDuration(trade);
        });
        const avgDurationMs = closedTrades.length > 0 ? totalDurationMs / closedTrades.length : 0;
        
        document.getElementById('totalTradesCount').textContent = totalTrades;
        document.getElementById('winRate').textContent = `${winRate.toFixed(1)}%`;
        
        const totalPLElement = document.getElementById('totalPL');
        totalPLElement.textContent = `${totalPL >= 0 ? '+' : ''}$${this.formatNumber(Math.abs(totalPL))}`;
        totalPLElement.className = `stat-value ${totalPL >= 0 ? 'positive' : 'negative'}`;
        
        document.getElementById('avgWin').textContent = `$${this.formatNumber(avgWin)}`;
        document.getElementById('avgLoss').textContent = `$${this.formatNumber(avgLoss)}`;
        document.getElementById('profitFactor').textContent = profitFactor.toFixed(2);
        document.getElementById('avgDuration').textContent = this.formatDuration(avgDurationMs);
        document.getElementById('largestWin').textContent = `$${this.formatNumber(largestWin)}`;
        document.getElementById('largestLoss').textContent = `$${this.formatNumber(Math.abs(largestLoss))}`;
    }
    
    displayEmptyStatistics() {
        document.getElementById('totalTradesCount').textContent = '0';
        document.getElementById('winRate').textContent = '0%';
        document.getElementById('totalPL').textContent = '$0.00';
        document.getElementById('avgWin').textContent = '$0.00';
        document.getElementById('avgLoss').textContent = '$0.00';
        document.getElementById('profitFactor').textContent = '0.00';
        document.getElementById('avgDuration').textContent = '0h 0m';
        document.getElementById('largestWin').textContent = '$0.00';
        document.getElementById('largestLoss').textContent = '$0.00';
    }
    
    updatePagination() {
        document.getElementById('pageInfo').textContent = `Page ${this.currentPage} of ${this.totalPages}`;
        document.getElementById('prevPageBtn').disabled = this.currentPage <= 1;
        document.getElementById('nextPageBtn').disabled = this.currentPage >= this.totalPages;
    }
    
    clearForm() {
        document.getElementById('assetInput').value = '';
        document.getElementById('amountInput').value = '';
        document.getElementById('priceInput').value = '';
        document.getElementById('feeInput').value = this.userSettings?.default_fee_rate || '0.10';
        document.getElementById('exitPriceInput').value = '';
        document.getElementById('notesInput').value = '';
        
        this.selectedAsset = null;
        this.currentPrice = null;
        document.getElementById('assetSuffix').textContent = 'BTC';
        
        document.querySelectorAll('.asset-dropdown-item').forEach(item => {
            item.classList.remove('selected');
        });
    }
    
    applyFormDefaults() {
        if (this.userSettings?.default_fee_rate) {
            document.getElementById('feeInput').value = this.userSettings.default_fee_rate;
        }
    }
    
    async startPriceUpdates() {
        this.priceUpdateInterval = setInterval(async () => {
            await this.updateOpenTradesPL();
        }, 10000);
    }
    
    async updateOpenTradesPL() {
        const openTrades = this.trades.filter(t => t.status === 'open');
        
        for (const trade of openTrades) {
            try {
                                const response = await fetch(`/api/proxy/bybit-prices?symbols=${trade.asset_symbol}USDT`);
                const data = await response.json();
                
                if (data.retCode === 0 && data.result?.list?.length > 0) {
                    this.cryptoPrices[trade.asset_symbol] = parseFloat(data.result.list[0].lastPrice);
                }
            } catch (error) {
                console.error(`Error updating price for ${trade.asset_symbol}:`, error);
            }
        }
        
        if (openTrades.length > 0) {
            this.renderTrades();
        }
    }
    
    exportJournal() {
        const format = this.userSettings?.export_format || 'csv';
        
        if (format === 'csv') {
            this.exportAsCSV();
        } else {
            this.exportAsPDF();
        }
    }
    
    exportAsCSV() {
        const headers = ['Asset', 'Type', 'Amount', 'Entry Price', 'Exit Price', 'P/L', 'Fee', 'Status', 'Duration', 'Opened', 'Closed', 'Notes'];
        
        const rows = this.trades.map(trade => [
            trade.asset_symbol,
            trade.trade_type,
            trade.amount,
            trade.entry_price,
            trade.exit_price || '',
            trade.profit_loss || '',
            trade.fee,
            trade.status,
            this.calculateDuration(trade),
            this.formatDateTime(trade.started_at),
            trade.ended_at ? this.formatDateTime(trade.ended_at) : '',
            trade.notes || ''
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `envy-journal-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        notificationSystem.success('Journal exported successfully');
    }
    
    exportAsPDF() {
        notificationSystem.info('PDF export coming soon');
    }
    
    getAssetLogo(symbol) {
    return getAssetLogoUrl(symbol);
}
    
    getCoinGeckoName(symbol) {
    return symbol.toLowerCase();
}
    
    formatNumber(num, decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) return '0.00';
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    }
    
    formatDate(timestamp) {
        return new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }
    
    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    formatDateTime(timestamp) {
        return new Date(timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
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
            timeElement.textContent = now.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
            });
        };
        
        update();
        setInterval(update, 1000);
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
                userEmblem.innerHTML = '&#128081;';
                userEmblem.className = 'user-emblem crown';
            } else {
                userEmblem.innerHTML = '&#128100;';
                userEmblem.className = 'user-emblem';
            }
        }
    }
    
    async checkAdminStatus() {
        if (this.userProfile?.role === 'admin') {
            document.getElementById('adminLink').style.display = 'flex';
        }
    }
    
    applyUserSettings() {
        if (!this.userSettings) return;
        
        if (this.userSettings.theme) {
            document.body.className = `${this.userSettings.theme}-theme`;
        }
        
        if (this.userSettings.accent_color) {
            document.documentElement.style.setProperty('--accent-primary', this.userSettings.accent_color, 'important');
        }
        
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
    }
    
    async logout() {
        if (window.clearAllUserData) {
            window.clearAllUserData();
        }
        
        this.activeTimers.forEach((interval) => clearInterval(interval));
        this.activeTimers.clear();
        
        if (this.priceUpdateInterval) {
            clearInterval(this.priceUpdateInterval);
        }
        
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    }
}

// Initialize journal when DOM is ready
let journalManager;
document.addEventListener('DOMContentLoaded', () => {
    journalManager = new JournalManager();
    window.journalManager = journalManager;
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (journalManager) {
        journalManager.activeTimers.forEach((interval) => clearInterval(interval));
        if (journalManager.priceUpdateInterval) {
            clearInterval(journalManager.priceUpdateInterval);
        }
    }
});