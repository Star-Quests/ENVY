// ENVY Journal JavaScript - Complete Implementation with Independent Timers

import { ENVYConfig } from './config.js';
import { supabase } from './supabase-client.js';
import { connectionMonitor } from './connection-monitor.js';
import { notificationSystem } from './notifications.js';

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
        this.activeTimers = new Map(); // Store active timer intervals
        this.currentPage = 1;
        this.pageSize = 25;
        this.totalPages = 1;
        this.filters = {
            status: 'all',
            asset: 'all'
        };
        this.tradeToDelete = null;
        this.priceUpdateInterval = null;
        
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
        
        // Setup form defaults from user settings
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
            const response = await fetch(`${ENVYConfig.API_BASE_URL}/bybit/assets`);
            this.assets = await response.json();
            this.populateAssetDropdown();
            this.populateFilterAssets();
        } catch (error) {
            console.error('Error loading assets:', error);
            // Use fallback assets
            this.assets = this.getFallbackAssets();
            this.populateAssetDropdown();
        }
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
                <img src="${logoUrl}" alt="${asset.symbol}" onerror="this.src='assets/icons/default-crypto.svg'">
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
        
        // Highlight selected in dropdown
        document.querySelectorAll('.asset-dropdown-item').forEach(item => {
            item.classList.remove('selected');
            if (item.dataset.symbol === asset.symbol) {
                item.classList.add('selected');
            }
        });
        
        // Hide dropdown
        document.getElementById('assetDropdown').style.display = 'none';
        
        // Fetch current price
        this.fetchCurrentPrice(asset.symbol);
    }
    
    async fetchCurrentPrice(symbol) {
        const fetchBtn = document.getElementById('fetchPriceBtn');
        fetchBtn.disabled = true;
        fetchBtn.innerHTML = '<span class="spinner"></span> Fetching...';
        
        try {
            const response = await fetch(`${ENVYConfig.API_BASE_URL}/bybit/price?symbol=${symbol}`);
            const data = await response.json();
            
            if (data.price) {
                this.currentPrice = data.price;
                document.getElementById('priceInput').value = data.price;
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
        // Asset input focus
        const assetInput = document.getElementById('assetInput');
        assetInput.addEventListener('focus', () => {
            document.getElementById('assetDropdown').style.display = 'block';
        });
        
        // Asset search
        const assetSearch = document.getElementById('assetSearchInput');
        assetSearch.addEventListener('input', (e) => this.filterAssets(e.target.value));
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('assetDropdown');
            const assetInput = document.getElementById('assetInput');
            if (!dropdown.contains(e.target) && e.target !== assetInput) {
                dropdown.style.display = 'none';
            }
        });
        
        // Fetch price button
        document.getElementById('fetchPriceBtn').addEventListener('click', () => {
            if (this.selectedAsset) {
                this.fetchCurrentPrice(this.selectedAsset.symbol);
            } else {
                notificationSystem.warning('Please select an asset first');
            }
        });
        
        // Trade type toggle
        document.getElementById('buyTypeBtn').addEventListener('click', () => {
            this.setTradeType('buy');
        });
        
        document.getElementById('sellTypeBtn').addEventListener('click', () => {
            this.setTradeType('sell');
        });
        
        // Toggle advanced fields
        document.getElementById('toggleAdvancedBtn').addEventListener('click', () => {
            const advancedFields = document.getElementById('advancedFields');
            const isVisible = advancedFields.style.display !== 'none';
            advancedFields.style.display = isVisible ? 'none' : 'block';
            
            const btn = document.getElementById('toggleAdvancedBtn');
            btn.innerHTML = isVisible ? 
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 6V18M12 18L16 14M12 18L8 14" stroke="currentColor" stroke-width="2"/></svg> Advanced Options' :
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 18V6M12 6L16 10M12 6L8 10" stroke="currentColor" stroke-width="2"/></svg> Hide Advanced';
        });
        
        // Form submission
        document.getElementById('tradeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTrade();
        });
        
        // Clear form
        document.getElementById('clearFormBtn').addEventListener('click', () => {
            this.clearForm();
        });
        
        // Filter changes
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
        
        // Export
        document.getElementById('exportJournalBtn').addEventListener('click', () => {
            this.exportJournal();
        });
        
        // Pagination
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
        
        // Modal close buttons
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
        
        // Sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });
        
        // Mobile menu
        document.getElementById('mobileMenuBtn').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('mobile-open');
        });
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
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
        
        const tradeData = {
            user_id: this.user.id,
            asset_symbol: this.selectedAsset.symbol,
            asset_logo: this.getAssetLogo(this.selectedAsset.symbol),
            trade_type: tradeType,
            amount: amount,
            entry_price: price,
            exit_price: exitPrice,
            fee: fee,
            status: exitPrice ? 'closed' : 'open',
            started_at: new Date().toISOString(),
            ended_at: exitPrice ? new Date().toISOString() : null,
            notes: notes
        };
        
        // Calculate initial P/L if exit price provided
        if (exitPrice) {
            if (tradeType === 'buy') {
                tradeData.profit_loss = (exitPrice - price) * amount;
            } else {
                tradeData.profit_loss = (price - exitPrice) * amount;
            }
            tradeData.profit_loss_percentage = (tradeData.profit_loss / (price * amount)) * 100;
        }
        
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
        
        // Update holdings
        await this.updateHoldings(data);
        
        // Play success sound if enabled
        if (this.userSettings?.sound_enabled) {
            document.getElementById('tradeSuccessSound').play();
        }
        
        notificationSystem.success('Trade added successfully');
        
        // Clear form if auto-clear enabled
        if (this.userSettings?.auto_clear_form) {
            this.clearForm();
        }
        
        // Refresh trades
        this.loadTrades();
        this.updateStatistics();
        
        // Start timer if trade is open
        if (data.status === 'open') {
            this.startTradeTimer(data);
        }
    }
    
    async updateHoldings(trade) {
        // Get current holdings for this asset
        const { data: holding } = await supabase
            .from('holdings')
            .select('*')
            .eq('user_id', this.user.id)
            .eq('asset_symbol', trade.asset_symbol)
            .single();
            
        if (holding) {
            // Update existing holding
            let newAmount = holding.total_amount;
            let newCost = holding.average_cost * holding.total_amount;
            
            if (trade.trade_type === 'buy') {
                newAmount += trade.amount;
                newCost += trade.amount * trade.entry_price;
            } else {
                newAmount -= trade.amount;
                newCost -= trade.amount * holding.average_cost;
            }
            
            const newAvgCost = newAmount > 0 ? newCost / newAmount : 0;
            
            await supabase
                .from('holdings')
                .update({
                    total_amount: newAmount,
                    average_cost: newAvgCost
                })
                .eq('id', holding.id);
        } else if (trade.trade_type === 'buy') {
            // Create new holding
            await supabase
                .from('holdings')
                .insert([{
                    user_id: this.user.id,
                    asset_symbol: trade.asset_symbol,
                    asset_logo: trade.asset_logo,
                    total_amount: trade.amount,
                    average_cost: trade.entry_price
                }]);
        }
    }
    
    async loadTrades() {
        let query = supabase
            .from('trades')
            .select('*', { count: 'exact' })
            .eq('user_id', this.user.id);
            
        // Apply filters
        if (this.filters.status !== 'all') {
            query = query.eq('status', this.filters.status);
        }
        
        if (this.filters.asset !== 'all') {
            query = query.eq('asset_symbol', this.filters.asset);
        }
        
        // Pagination
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
        
        // Start timers for open trades
        this.startAllTradeTimers();
    }
    
    renderTrades() {
        const tbody = document.getElementById('journalTableBody');
        tbody.innerHTML = '';
        
        if (this.trades.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="11">
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
        
        // Asset Logo
        const logoCell = document.createElement('td');
        logoCell.className = 'asset-logo-cell';
        logoCell.innerHTML = `
            <img src="${trade.asset_logo || this.getAssetLogo(trade.asset_symbol)}" 
                 alt="${trade.asset_symbol}" 
                 class="asset-logo-table"
                 onerror="this.src='assets/icons/default-crypto.svg'">
        `;
        row.appendChild(logoCell);
        
        // Asset Symbol
        const assetCell = document.createElement('td');
        assetCell.textContent = trade.asset_symbol;
        assetCell.style.fontWeight = '600';
        row.appendChild(assetCell);
        
        // Trade Type
        const typeCell = document.createElement('td');
        typeCell.className = 'trade-type-cell';
        typeCell.innerHTML = `<span class="type-badge ${trade.trade_type}">${trade.trade_type}</span>`;
        row.appendChild(typeCell);
        
        // Amount
        const amountCell = document.createElement('td');
        amountCell.textContent = this.formatNumber(trade.amount, 8);
        amountCell.style.fontFamily = 'var(--font-mono)';
        row.appendChild(amountCell);
        
        // Entry Price
        const entryCell = document.createElement('td');
        entryCell.textContent = `$${this.formatNumber(trade.entry_price)}`;
        entryCell.style.fontFamily = 'var(--font-mono)';
        row.appendChild(entryCell);
        
        // Exit Price
        const exitCell = document.createElement('td');
        exitCell.textContent = trade.exit_price ? `$${this.formatNumber(trade.exit_price)}` : '-';
        exitCell.style.fontFamily = 'var(--font-mono)';
        row.appendChild(exitCell);
        
        // P/L
        const plCell = document.createElement('td');
        if (trade.profit_loss !== null) {
            const plClass = trade.profit_loss >= 0 ? 'positive' : 'negative';
            const plSign = trade.profit_loss >= 0 ? '+' : '';
            plCell.className = plClass;
            plCell.innerHTML = `
                ${plSign}$${this.formatNumber(Math.abs(trade.profit_loss))}
                <br>
                <small>${trade.profit_loss_percentage?.toFixed(2)}%</small>
            `;
        } else {
            plCell.textContent = '-';
        }
        row.appendChild(plCell);
        
        // Duration
        const durationCell = document.createElement('td');
        durationCell.textContent = this.calculateDuration(trade);
        durationCell.style.fontFamily = 'var(--font-mono)';
        row.appendChild(durationCell);
        
        // Timer
        const timerCell = document.createElement('td');
        timerCell.appendChild(this.createTimerElement(trade));
        row.appendChild(timerCell);
        
        // Date/Time
        const dateCell = document.createElement('td');
        dateCell.innerHTML = `
            ${this.formatDate(trade.created_at)}
            <br>
            <small>${this.formatTime(trade.created_at)}</small>
        `;
        row.appendChild(dateCell);
        
        // Actions
        const actionsCell = document.createElement('td');
        actionsCell.className = 'trade-actions';
        actionsCell.appendChild(this.createActionButtons(trade));
        row.appendChild(actionsCell);
        
        // Click to view details
        row.addEventListener('click', (e) => {
            // Don't trigger if clicking on buttons
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
            // Pause button
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
            
            // End Trade button
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
            // Resume button
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
        
        // View/Edit button
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
        
        // Delete button
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
        // Clear existing timers
        this.activeTimers.forEach((interval, tradeId) => {
            clearInterval(interval);
        });
        this.activeTimers.clear();
        
        // Start timers for open trades
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
            
            // Apply age-based coloring if enabled
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
        
        // Subtract paused time if any
        if (trade.accumulated_paused_time) {
            const pausedMs = this.parseIntervalToMs(trade.accumulated_paused_time);
            endTime = new Date(endTime.getTime() - pausedMs);
        }
        
        // If currently paused, use paused_at time
        if (trade.status === 'paused' && trade.paused_at) {
            endTime = new Date(trade.paused_at);
        }
        
        return endTime.getTime() - startTime.getTime();
    }
    
    parseIntervalToMs(interval) {
        // Parse PostgreSQL interval format
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
        } else if (hours < 168) { // 7 days
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
        
        // Calculate current accumulated paused time
        let accumulatedMs = this.parseIntervalToMs(trade.accumulated_paused_time || '0 seconds');
        
        await supabase
            .from('trades')
            .update({
                status: 'paused',
                paused_at: new Date().toISOString()
            })
            .eq('id', tradeId);
            
        // Clear the timer interval
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
        
        // Calculate paused duration
        const pausedDuration = new Date().getTime() - new Date(trade.paused_at).getTime();
        const accumulatedMs = this.parseIntervalToMs(trade.accumulated_paused_time || '0 seconds');
        const totalPausedMs = accumulatedMs + pausedDuration;
        
        // Format as PostgreSQL interval
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
        
        // Fetch current price
        let exitPrice;
        try {
            const response = await fetch(`${ENVYConfig.API_BASE_URL}/bybit/price?symbol=${trade.asset_symbol}`);
            const data = await response.json();
            exitPrice = data.price;
        } catch (error) {
            notificationSystem.error('Failed to fetch current price');
            return;
        }
        
        // Calculate P/L
        let profitLoss;
        if (trade.trade_type === 'buy') {
            profitLoss = (exitPrice - trade.entry_price) * trade.amount;
        } else {
            profitLoss = (trade.entry_price - exitPrice) * trade.amount;
        }
        
        const profitLossPercentage = (profitLoss / (trade.entry_price * trade.amount)) * 100;
        
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
            
        // Clear timer
        const interval = this.activeTimers.get(tradeId);
        if (interval) {
            clearInterval(interval);
            this.activeTimers.delete(tradeId);
        }
        
        // Update holdings
        await this.updateHoldingsOnClose(trade);
        
        this.loadTrades();
        this.updateStatistics();
        
        // Play notification
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
            newAmount -= trade.amount;
        } else {
            newAmount += trade.amount;
        }
        
        if (newAmount <= 0) {
            // Remove holding
            await supabase
                .from('holdings')
                .delete()
                .eq('id', holding.id);
        } else {
            await supabase
                .from('holdings')
                .update({
                    total_amount: newAmount
                })
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
        
        const { error } = await supabase
            .from('trades')
            .delete()
            .eq('id', this.tradeToDelete.id);
            
        if (error) {
            console.error('Error deleting trade:', error);
            notificationSystem.error('Failed to delete trade');
            return;
        }
        
        // Clear timer
        const interval = this.activeTimers.get(this.tradeToDelete.id);
        if (interval) {
            clearInterval(interval);
            this.activeTimers.delete(this.tradeToDelete.id);
        }
        
        document.getElementById('deleteModal').classList.remove('active');
        this.tradeToDelete = null;
        
        this.loadTrades();
        this.updateStatistics();
        
        notificationSystem.success('Trade deleted successfully');
    }
    
    showTradeDetails(trade) {
        const body = document.getElementById('tradeDetailsBody');
        
        const duration = this.calculateDuration(trade);
        const plClass = trade.profit_loss >= 0 ? 'positive' : 'negative';
        const plSign = trade.profit_loss >= 0 ? '+' : '';
        
        body.innerHTML = `
            <div class="trade-details-grid">
                <div class="trade-detail-item">
                    <span class="trade-detail-label">Asset</span>
                    <span class="trade-detail-value">
                        <img src="${trade.asset_logo || this.getAssetLogo(trade.asset_symbol)}" 
                             alt="${trade.asset_symbol}" 
                             style="width: 20px; height: 20px; border-radius: 50%; margin-right: 8px;"
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
                        ${plSign}$${this.formatNumber(Math.abs(trade.profit_loss || 0))}
                        ${trade.profit_loss_percentage ? ` (${trade.profit_loss_percentage.toFixed(2)}%)` : ''}
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
        
        // Calculate average duration
        let totalDurationMs = 0;
        closedTrades.forEach(trade => {
            totalDurationMs += this.calculateTradeDuration(trade);
        });
        const avgDurationMs = closedTrades.length > 0 ? totalDurationMs / closedTrades.length : 0;
        
        // Update header stats
        document.getElementById('totalTradesCount').textContent = totalTrades;
        document.getElementById('winRate').textContent = `${winRate.toFixed(1)}%`;
        
        const totalPLElement = document.getElementById('totalPL');
        totalPLElement.textContent = `${totalPL >= 0 ? '+' : ''}$${this.formatNumber(Math.abs(totalPL))}`;
        totalPLElement.className = `stat-value ${totalPL >= 0 ? 'positive' : 'negative'}`;
        
        // Update statistics cards
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
        // Update prices every 10 seconds for open trades
        this.priceUpdateInterval = setInterval(async () => {
            await this.updateOpenTradesPL();
        }, 10000);
    }
    
    async updateOpenTradesPL() {
        const openTrades = this.trades.filter(t => t.status === 'open');
        
        for (const trade of openTrades) {
            try {
                const response = await fetch(`${ENVYConfig.API_BASE_URL}/bybit/price?symbol=${trade.asset_symbol}`);
                const data = await response.json();
                
                if (data.price) {
                    this.cryptoPrices[trade.asset_symbol] = data.price;
                }
            } catch (error) {
                console.error(`Error updating price for ${trade.asset_symbol}:`, error);
            }
        }
        
        // Re-render table to show updated P/L estimates
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
        const ids = {
            'BTC': '1', 'ETH': '279', 'SOL': '4128', 'BNB': '825',
            'XRP': '44', 'ADA': '975', 'DOGE': '5', 'MATIC': '4713',
            'DOT': '12171', 'AVAX': '12559'
        };
        const id = ids[symbol] || symbol.toLowerCase();
        return `https://assets.coingecko.com/coins/images/${id}/small/${symbol.toLowerCase()}.png`;
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
                userEmblem.textContent = '👑';
                userEmblem.className = 'user-emblem crown';
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
        
        // Apply theme
        if (this.userSettings.theme) {
            document.body.className = `${this.userSettings.theme}-theme`;
        }
        
        // Apply accent color
        if (this.userSettings.accent_color) {
            document.documentElement.style.setProperty('--accent-primary', this.userSettings.accent_color);
        }
    }
    
    async logout() {
        // Clear all timers
        this.activeTimers.forEach((interval) => {
            clearInterval(interval);
        });
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
        journalManager.activeTimers.forEach((interval) => {
            clearInterval(interval);
        });
        if (journalManager.priceUpdateInterval) {
            clearInterval(journalManager.priceUpdateInterval);
        }
    }
});