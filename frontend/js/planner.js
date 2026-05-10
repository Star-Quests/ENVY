// ENVY Planner JavaScript - Mathematical Trade Analysis with Trailing Stops

import { ENVYConfig } from './config.js';
import { supabase } from './supabase-client.js';
import { connectionMonitor } from './connection-monitor.js';
import { notificationSystem } from './notifications.js';
import { getAssetLogoUrl } from './crypto-logos.js';
class PlannerManager {
    constructor() {
        this.user = null;
        this.userProfile = null;
        this.userSettings = null;
        this.assets = [];
        this.selectedAsset = null;
        this.currentPrice = null;
        this.availableCapital = 0;
        this.currentAnalysis = null;
        this.retracementUnit = 'percentage'; // 'percentage' or 'usdt'
        this.savedAnalyses = [];
        
        this.initialize();
    }
    
    async initialize() {
        await this.checkAuth();
        await this.loadUserData();
        await this.loadAssets();
        await this.loadAvailableCapital();
        await this.loadSavedAnalyses();
        this.setupEventListeners();
        this.updateGreeting();
        this.updateDateTime();
        this.checkAdminStatus();
        this.applyUserSettings();
        this.updateTradingModeDisplay();
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
        
        // Apply default retracement unit
        if (this.userSettings?.retracement_unit) {
            this.retracementUnit = this.userSettings.retracement_unit;
            this.updateUnitToggle();
        }
        
        // Show/hide leverage based on trading mode
        this.updateTradingModeDisplay();
    }
    
    async loadAssets() {
    try {
        const response = await fetch('/api/proxy/bybit-assets');
        if (response.ok) {
            this.assets = await response.json();
        } else {
            // If API fails, use the same method as Dashboard
            this.assets = await this.fetchAssetsFromBybitDirectly();
        }
        this.populateAssetDropdown();
    } catch (error) {
        console.error('Error loading assets:', error);
        this.assets = await this.fetchAssetsFromBybitDirectly();
        this.populateAssetDropdown();
    }
}

async fetchAssetsFromBybitDirectly() {
    try {
        const res = await fetch('/api/proxy/bybit-assets');
        const data = await res.json();
        
        if (data.retCode === 0 && data.result.list) {
            const seen = new Set();
            return data.result.list
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
        }
    } catch (e) {
        console.error('Bybit fetch failed:', e);
    }
    return this.getFallbackAssets();
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
    
    async loadAvailableCapital() {
    const { data: holdings } = await supabase
        .from('holdings')
        .select('*')
        .eq('user_id', this.user.id);
        
    let totalValue = 0;
    
    if (holdings && holdings.length > 0) {
        for (const holding of holdings) {
            try {
                const response = await fetch(`${ENVYConfig.API_BASE_URL}/bybit/price?symbol=${holding.asset_symbol}`);
                const data = await response.json();
                totalValue += holding.total_amount * (data.price || 0);
            } catch (error) {
                console.error(`Error fetching price for ${holding.asset_symbol}:`, error);
            }
        }
    }
    
    this.availableCapital = totalValue;
    document.getElementById('availableCapital').textContent = `$${this.formatNumber(totalValue)}`;
    
    // Show available capital in the hint
    const capitalHint = document.getElementById('availableCapitalHint');
    if (capitalHint) {
        capitalHint.textContent = `Available: $${this.formatNumber(totalValue)}`;
    }
}
    
    async loadSavedAnalyses() {
        const { data: analyses } = await supabase
            .from('planner_analyses')
            .select('*')
            .eq('user_id', this.user.id)
            .order('created_at', { ascending: false })
            .limit(5);
            
        this.savedAnalyses = analyses || [];
        this.renderSavedAnalyses();
    }
    
    populateAssetDropdown() {
        const dropdownList = document.getElementById('plannerAssetList');
        dropdownList.innerHTML = '';
        
        this.assets.forEach(asset => {
            const item = document.createElement('div');
            item.className = 'asset-dropdown-item';
            item.dataset.symbol = asset.symbol;
            
            const logoUrl = this.getAssetLogo(asset.symbol);
            
            item.innerHTML = `
    <img src="${logoUrl}" alt="${asset.symbol}" 
         onerror="this.src='assets/icons/default-crypto.svg'" 
         style="width: 24px; height: 24px; border-radius: 50%; object-fit: contain;">
    <div class="asset-dropdown-info">
        <div class="asset-dropdown-name">${asset.name}</div>
        <div class="asset-dropdown-symbol">${asset.symbol}</div>
    </div>
`;
            
            item.addEventListener('click', () => this.selectAsset(asset));
            dropdownList.appendChild(item);
        });
    }
    
    selectAsset(asset) {
        this.selectedAsset = asset;
        
        document.getElementById('plannerAssetInput').value = `${asset.name} (${asset.symbol})`;
        document.getElementById('assetSuffix').textContent = asset.symbol;
        
        // Show selected asset display
        const display = document.getElementById('selectedAssetDisplay');
        const logo = document.getElementById('selectedAssetLogo');
        const info = document.getElementById('selectedAssetInfo');
        
        logo.src = this.getAssetLogo(asset.symbol);
        logo.onerror = () => logo.src = 'assets/icons/default-crypto.svg';
        info.textContent = `${asset.name} (${asset.symbol})`;
        display.style.display = 'flex';
        
        // Highlight in dropdown
        document.querySelectorAll('.asset-dropdown-item').forEach(item => {
            item.classList.remove('selected');
            if (item.dataset.symbol === asset.symbol) {
                item.classList.add('selected');
            }
        });
        
        // Hide dropdown
        document.getElementById('plannerAssetDropdown').style.display = 'none';
        
        // Fetch current price
        this.fetchCurrentPrice(asset.symbol);
    }
    
    async fetchCurrentPrice(symbol) {
        const btn = document.getElementById('fetchCurrentPriceBtn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';
        
        try {
            const response = await fetch(`/api/proxy/bybit-prices?symbols=${symbol}USDT`);
const data = await response.json();

if (data.retCode === 0 && data.result?.list?.length > 0) {
    const ticker = data.result.list[0];
    const price = parseFloat(ticker.lastPrice);
    this.currentPrice = price;
    document.getElementById('entryPriceInput').value = price;
                this.updatePositionValue();
                notificationSystem.success(`Current ${symbol} price: $${this.formatNumber(price)}`);
            }
        } catch (error) {
            console.error('Error fetching price:', error);
            notificationSystem.error('Failed to fetch current price');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
    
    updatePositionValue() {
        const amount = parseFloat(document.getElementById('amountInput').value) || 0;
        const price = parseFloat(document.getElementById('entryPriceInput').value) || 0;
        const value = amount * price;
        
        document.getElementById('positionValueUSD').textContent = `≈ $${this.formatNumber(value)} USD`;
    }
    
    updateFeeDisplay() {
    const entryPrice = parseFloat(document.getElementById('entryPriceInput').value) || 0;
    const amount = parseFloat(document.getElementById('amountInput').value) || 0;
    const fee = parseFloat(document.getElementById('feeInput').value) || 0.1;
    
    const positionValue = amount * entryPrice;
    const feeAmount = (positionValue * fee) / 100;
    
    document.getElementById('feeAmountDisplay').textContent = `≈ $${this.formatNumber(feeAmount)} per trade ($${this.formatNumber(feeAmount * 2)} total)`;
}

updateEstimatedPositionSize() {
        const capital = parseFloat(document.getElementById('capitalToUseInput').value) || 0;
        const entryPrice = parseFloat(document.getElementById('entryPriceInput').value) || 0;
        
        if (entryPrice > 0 && this.selectedAsset) {
            const estimatedAmount = capital / entryPrice;
            document.getElementById('estimatedPositionSize').textContent = 
                `≈ ${this.formatNumber(estimatedAmount, 8)} ${this.selectedAsset.symbol}`;
        } else {
            document.getElementById('estimatedPositionSize').textContent = '≈ 0.00';
        }
    }

    setupEventListeners() {
        // Asset input
        const assetInput = document.getElementById('plannerAssetInput');
        assetInput.addEventListener('focus', () => {
            document.getElementById('plannerAssetDropdown').style.display = 'block';
        });
        
        // Asset search
        const assetSearch = document.getElementById('plannerAssetSearch');
        assetSearch.addEventListener('input', (e) => this.filterAssets(e.target.value));
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('plannerAssetDropdown');
            const assetInput = document.getElementById('plannerAssetInput');
            if (!dropdown.contains(e.target) && e.target !== assetInput) {
                dropdown.style.display = 'none';
            }
        });
        
        // Fetch price button
        document.getElementById('fetchCurrentPriceBtn').addEventListener('click', () => {
            if (this.selectedAsset) {
                this.fetchCurrentPrice(this.selectedAsset.symbol);
            } else {
                notificationSystem.warning('Please select an asset first');
            }
        });
        
        // Amount input - update position value
        document.getElementById('amountInput').addEventListener('input', () => {
    this.updatePositionValue();
    this.updateFeeDisplay();
});
document.getElementById('entryPriceInput').addEventListener('input', () => {
    this.updatePositionValue();
    this.updateFeeDisplay();
    this.updateEstimatedPositionSize();
});
        
        // Fee input - update fee display
document.getElementById('feeInput').addEventListener('input', () => this.updateFeeDisplay());
document.getElementById('feeInput').addEventListener('change', () => this.updateFeeDisplay());

// Leverage slider - update display and trigger recalculation if results are shown
document.getElementById('leverageSlider').addEventListener('input', (e) => {
    document.getElementById('leverageValue').textContent = `${e.target.value}x`;
    if (this.currentAnalysis) {
        this.calculateLiquidationPrice();
    }
});

        
        // Form submission
        document.getElementById('plannerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.analyzeTrade();
        });
        
        // Save analysis
        document.getElementById('saveAnalysisBtn').addEventListener('click', () => {
            this.saveAnalysis();
        });
        
        // Reset analysis
        document.getElementById('resetAnalysisBtn').addEventListener('click', () => {
            this.resetAnalysis();
        });
        
        // Create trade from analysis
        document.getElementById('createTradeFromAnalysisBtn').addEventListener('click', () => {
            this.showCreateTradeModal();
        });
        
        // Unit toggle
        document.querySelectorAll('.unit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleRetracementUnit(e.target.dataset.unit));
        });
        
        // Apply trailing stop buttons
        document.querySelectorAll('.apply-trailing-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                this.applyTrailingStop(type);
            });
        });
        
                        // Position type toggle
        document.getElementById('longPositionBtn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('longPositionBtn').classList.add('active');
            document.getElementById('shortPositionBtn').classList.remove('active');
            console.log('🔵 Position set to: LONG');
        });

        document.getElementById('shortPositionBtn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('shortPositionBtn').classList.add('active');
            document.getElementById('longPositionBtn').classList.remove('active');
            console.log('🔴 Position set to: SHORT');
        });

        // ⬇️⬇️⬇️ ADD THESE NEW LINES RIGHT HERE ⬇️⬇️⬇️
        // Calculation mode toggle
        document.getElementById('positionSizeModeBtn').addEventListener('click', () => {
            document.getElementById('positionSizeModeBtn').classList.add('active');
            document.getElementById('availableCapitalModeBtn').classList.remove('active');
            document.getElementById('positionSizeGroup').style.display = 'block';
            document.getElementById('capitalToUseGroup').style.display = 'none';
        });

        document.getElementById('availableCapitalModeBtn').addEventListener('click', () => {
            document.getElementById('availableCapitalModeBtn').classList.add('active');
            document.getElementById('positionSizeModeBtn').classList.remove('active');
            document.getElementById('positionSizeGroup').style.display = 'none';
            document.getElementById('capitalToUseGroup').style.display = 'block';
            
            // Auto-fill capital input with available balance
            const capitalInput = document.getElementById('capitalToUseInput');
            capitalInput.value = this.availableCapital;
            this.updateEstimatedPositionSize();
        });

        // Capital input - update estimated position size
        document.getElementById('capitalToUseInput').addEventListener('input', () => {
            this.updateEstimatedPositionSize();
        });
        // ⬆️⬆️⬆️ END OF NEW LINES ⬆️⬆️⬆️
        
        // Modal
        document.getElementById('closeTradeModal').addEventListener('click', () => {
            document.getElementById('createTradeModal').classList.remove('active');
        });
        
        document.getElementById('cancelTradeBtn').addEventListener('click', () => {
            document.getElementById('createTradeModal').classList.remove('active');
        });
        
        document.getElementById('confirmCreateTradeBtn').addEventListener('click', () => {
            this.createTradeFromAnalysis();
        });
        
        // Sidebar
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });
        
        document.getElementById('mobileMenuBtn').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('mobile-open');
        });
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });
    }
    
    filterAssets(query) {
        const items = document.querySelectorAll('.asset-dropdown-item');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(query.toLowerCase()) ? 'flex' : 'none';
        });
    }
    
    analyzeTrade() {
        if (!this.selectedAsset) {
            notificationSystem.error('Please select an asset');
            return;
        }
        
        const isCapitalMode = document.getElementById('availableCapitalModeBtn').classList.contains('active');
        
        // Get entry price
        const entryPrice = parseFloat(document.getElementById('entryPriceInput').value);
        
        // Calculate amount based on mode
        let amount;
        if (isCapitalMode) {
            const capitalToUse = parseFloat(document.getElementById('capitalToUseInput').value) || 0;
            amount = entryPrice > 0 ? capitalToUse / entryPrice : 0;
        } else {
            amount = parseFloat(document.getElementById('amountInput').value) || 0;
        }
        const profitTarget = parseFloat(document.getElementById('profitTargetInput').value);
        const lossTolerance = parseFloat(document.getElementById('lossToleranceInput').value);
        
        if (!entryPrice || entryPrice <= 0) {
            notificationSystem.error('Please enter a valid entry price');
            return;
        }
        
        if (!amount || amount <= 0) {
            notificationSystem.error('Please enter a valid position size');
            return;
        }
        
        if (!profitTarget || profitTarget <= 0) {
            notificationSystem.error('Please enter a valid profit target');
            return;
        }
        
        if (!lossTolerance || lossTolerance <= 0) {
            notificationSystem.error('Please enter a valid loss tolerance');
            return;
        }
        
                // === PRECISE FORMULAS ===
        const positionValue = entryPrice * amount;
        const feePercent = parseFloat(document.getElementById('feeInput').value) || 0.1;
        const leverage = parseInt(document.getElementById('leverageSlider')?.value) || 1;
        const isFutures = this.userSettings?.trading_mode === 'futures';
        
        // Fee calculations
        const feeRate = feePercent / 100;
        const entryFee = positionValue * feeRate;
        const exitFee = positionValue * feeRate;
        const totalFeeAmount = entryFee + exitFee;
        
                // Get position type from toggle
        const positionType = document.getElementById('longPositionBtn').classList.contains('active') ? 'long' : 'short';
        
        // TP/SL Price calculations based on position type
        let takeProfitPrice, stopLossPrice;
        
        if (positionType === 'long') {
            takeProfitPrice = entryPrice + (profitTarget / amount);
            stopLossPrice = entryPrice - (lossTolerance / amount);
        } else {
            // Short: TP is below entry, SL is above entry
            takeProfitPrice = entryPrice - (profitTarget / amount);
            stopLossPrice = entryPrice + (lossTolerance / amount);
        }
        
                // Distance percentages (using absolute values for both long and short)
        const distanceToTP = Math.abs(takeProfitPrice - entryPrice) / entryPrice * 100;
        const distanceToSL = Math.abs(entryPrice - stopLossPrice) / entryPrice * 100;
        
        // Risk/Reward ratio
        const riskReward = profitTarget / lossTolerance;
        
        // Margin calculation
        const requiredMargin = isFutures ? positionValue / leverage : positionValue;
        
        // ROI based on margin
        const roi = (profitTarget / requiredMargin) * 100;
        
                // Liquidation price (futures only)
        let liquidationPrice = null;
        if (isFutures) {
            if (positionType === 'long') {
                liquidationPrice = entryPrice * (1 - (1 / leverage));
            } else {
                liquidationPrice = entryPrice * (1 + (1 / leverage));
            }
        }
        
                // Capital outcomes (after fees)
        const walletBalance = parseFloat(document.getElementById('walletBalanceInput').value) || this.availableCapital;
        const walletAfterWin = walletBalance + profitTarget - totalFeeAmount;
        const walletAfterLoss = walletBalance - lossTolerance - totalFeeAmount;
        
                // Breakeven price
        let breakevenPrice;
        if (positionType === 'long') {
            breakevenPrice = entryPrice + (totalFeeAmount / amount);
        } else {
            breakevenPrice = entryPrice - (totalFeeAmount / amount);
        }
        
        // Store analysis
        this.currentAnalysis = {
            asset: this.selectedAsset,
            entryPrice,
            amount,
            positionValue,
            profitTarget,
            lossTolerance,
            leverage,
            feePercent,
            totalFeeAmount,
            entryFee,
            exitFee,
            takeProfitPrice,
            stopLossPrice,
            potentialProfit: profitTarget,
            potentialLoss: lossTolerance,
            walletAfterWin,
            walletAfterLoss,
            roi,
            riskReward,
            distanceToTP,
            distanceToSL,
            requiredMargin,
            liquidationPrice,
            breakevenPrice,
            isFutures,
            positionType 
        };

        console.log('🔍 ANALYSIS OBJECT positionType:', this.currentAnalysis.positionType);
        console.log('🔍 ANALYSIS OBJECT isFutures:', this.currentAnalysis.isFutures);
        
        // Display results
        this.displayAnalysisResults();
        
        // Calculate trailing stop options
        this.calculateTrailingStops();
        
        // Show results container
        document.querySelector('.results-placeholder').style.display = 'none';
        document.getElementById('analysisResults').style.display = 'block';
    }
    
            displayAnalysisResults() {
        const a = this.currentAnalysis;
        
        // Show position type badge
        const positionBadge = document.getElementById('positionTypeBadge');
        const positionLabel = document.getElementById('positionTypeLabel');
        if (positionBadge && positionLabel) {
            positionBadge.style.display = 'block';
            console.log('🔍 DISPLAY positionType from analysis:', a.positionType);
            positionLabel.textContent = a.positionType === 'long' ? 'Long Position' : 'Short Position';
            positionLabel.textContent = a.positionType === 'long' ? 'Long Position' : 'Short Position';
            positionLabel.style.background = a.positionType === 'long' 
                ? 'rgba(16, 185, 129, 0.15)' 
                : 'rgba(239, 68, 68, 0.15)';
            positionLabel.style.color = a.positionType === 'long' ? '#10B981' : '#EF4444';
        }

        // Take Profit side
        document.getElementById('takeProfitPrice').textContent = `$${this.formatNumber(a.takeProfitPrice)}`;
        document.getElementById('potentialProfit').textContent = `$${this.formatNumber(a.potentialProfit)}`;
        document.getElementById('walletAfterWin').textContent = `$${this.formatNumber(a.walletAfterWin)}`;
        // Update ROI label based on mode
const roiLabel = document.querySelector('#roi').closest('.metric-item').querySelector('.metric-label');
if (roiLabel) {
    roiLabel.textContent = a.isFutures ? 'Leveraged ROI' : 'ROI';
}
document.getElementById('roi').textContent = `${a.roi >= 0 ? '+' : ''}${a.roi.toFixed(2)}%`;
        
        // Stop Loss side
        document.getElementById('stopLossPrice').textContent = `$${this.formatNumber(a.stopLossPrice)}`;
        document.getElementById('potentialLoss').textContent = `$${this.formatNumber(a.potentialLoss)}`;
        document.getElementById('walletAfterLoss').textContent = `$${this.formatNumber(a.walletAfterLoss)}`;
        document.getElementById('riskReward').textContent = `1:${a.riskReward.toFixed(2)}`;
        
                // Position summary
        document.getElementById('positionSizeUSD').textContent = `$${this.formatNumber(a.positionValue)}`;
        document.getElementById('requiredMargin').textContent = `$${this.formatNumber(a.requiredMargin)}`;
        document.getElementById('distanceToTP').textContent = `${a.distanceToTP.toFixed(2)}%`;
        document.getElementById('distanceToSL').textContent = `${a.distanceToSL.toFixed(2)}%`;
        
        // Show total fees
        document.getElementById('totalFees').textContent = `$${this.formatNumber(a.totalFeeAmount)}`;
        
        // Show breakeven price
        if (document.getElementById('breakevenPrice')) {
            document.getElementById('breakevenPrice').textContent = `$${this.formatNumber(a.breakevenPrice)}`;
        }
        
        // Show/hide liquidation price based on trading mode
        const liquidationItem = document.getElementById('liquidationItem');
        if (a.isFutures && a.liquidationPrice) {
            liquidationItem.style.display = 'flex';
            document.getElementById('liquidationPrice').textContent = `$${this.formatNumber(a.liquidationPrice)}`;
        } else {
            liquidationItem.style.display = 'none';
        }
    }

    calculateLiquidationPriceInternal(entryPrice, leverage, feePercent = 0.1) {
    // Simple liquidation formula
    const liquidationPrice = entryPrice * (1 - (1 / leverage));
    return Math.max(liquidationPrice, 0);
}

    calculateTrailingStops() {
        const a = this.currentAnalysis;
        
        // Bybit trailing stop formula:
        // Activation Price = Entry Price + (Entry Price * Activation %)
        // Callback Rate determines how far the stop trails
        
        // Aggressive (0.5% callback, 1% activation)
        const aggressiveActivation = a.entryPrice * 1.01;
        const aggressiveCallback = 0.5;
        const aggressiveDistance = a.entryPrice * 0.005;
        
        // Moderate (1% callback, 2% activation)
        const moderateActivation = a.entryPrice * 1.02;
        const moderateCallback = 1.0;
        const moderateDistance = a.entryPrice * 0.01;
        
        // Conservative (2% callback, 3% activation)
        const conservativeActivation = a.entryPrice * 1.03;
        const conservativeCallback = 2.0;
        const conservativeDistance = a.entryPrice * 0.02;
        
        // Update display based on unit preference
        this.updateTrailingDisplay('aggressive', aggressiveActivation, aggressiveCallback, aggressiveDistance);
        this.updateTrailingDisplay('moderate', moderateActivation, moderateCallback, moderateDistance);
        this.updateTrailingDisplay('conservative', conservativeActivation, conservativeCallback, conservativeDistance);
    }
    
    updateTrailingDisplay(type, activation, callback, distance) {
        const activationEl = document.getElementById(`${type}Activation`);
        const callbackEl = document.getElementById(`${type}Callback`);
        const distanceEl = document.getElementById(`${type}Distance`);
        
        activationEl.textContent = `$${this.formatNumber(activation)}`;
        callbackEl.textContent = `${callback.toFixed(2)}%`;
        
        if (this.retracementUnit === 'percentage') {
            const distancePercent = (distance / this.currentAnalysis.entryPrice) * 100;
            distanceEl.textContent = `${distancePercent.toFixed(2)}%`;
        } else {
            distanceEl.textContent = `$${this.formatNumber(distance)}`;
        }
    }
    
    toggleRetracementUnit(unit) {
        this.retracementUnit = unit;
        
        // Update toggle buttons
        document.querySelectorAll('.unit-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.unit === unit);
        });
        
        // Recalculate trailing stops with new unit
        if (this.currentAnalysis) {
            this.calculateTrailingStops();
        }
    }
    
    applyTrailingStop(type) {
        if (!this.currentAnalysis) return;
        
        const a = this.currentAnalysis;
        let callbackRate, activationPercent;
        
        switch(type) {
            case 'aggressive':
                callbackRate = 0.5;
                activationPercent = 1;
                break;
            case 'moderate':
                callbackRate = 1.0;
                activationPercent = 2;
                break;
            case 'conservative':
                callbackRate = 2.0;
                activationPercent = 3;
                break;
        }
        
        const activationPrice = a.entryPrice * (1 + activationPercent / 100);
        const trailingStop = a.entryPrice * (1 - callbackRate / 100);
        
        notificationSystem.success(`${type.charAt(0).toUpperCase() + type.slice(1)} trailing stop applied`);
        
        // Store trailing stop configuration
        this.currentAnalysis.trailingStop = {
            type,
            callbackRate,
            activationPrice,
            trailingStop
        };
    }
    
    async saveAnalysis() {
        if (!this.currentAnalysis) {
            notificationSystem.warning('No analysis to save');
            return;
        }
        
        const a = this.currentAnalysis;
        
        const analysisData = {
            user_id: this.user.id,
            asset_symbol: a.asset.symbol,
            entry_price: a.entryPrice,
            amount: a.amount,
            profit_target: a.profitTarget,
            loss_tolerance: a.lossTolerance,
            take_profit_price: a.takeProfitPrice,
            stop_loss_price: a.stopLossPrice,
            potential_profit: a.potentialProfit,
            potential_loss: a.potentialLoss,
            risk_reward_ratio: a.riskReward,
            roi_percentage: a.roi,
            trailing_stop_options: a.trailingStop || null
        };
        
        const { data, error } = await supabase
            .from('planner_analyses')
            .insert([analysisData])
            .select()
            .single();
            
        if (error) {
            console.error('Error saving analysis:', error);
            notificationSystem.error('Failed to save analysis');
            return;
        }
        
        notificationSystem.success('Analysis saved successfully');
        
        // Refresh saved analyses list
        await this.loadSavedAnalyses();
    }

    async deleteAnalysis(analysisId) {
        const { error } = await supabase
            .from('planner_analyses')
            .delete()
            .eq('id', analysisId)
            .eq('user_id', this.user.id);
            
        if (error) {
            console.error('Error deleting analysis:', error);
            notificationSystem.error('Failed to delete analysis');
            return;
        }
        
        notificationSystem.success('Analysis deleted');
        await this.loadSavedAnalyses();
    }

    async clearAllAnalyses() {
        const { error } = await supabase
            .from('planner_analyses')
            .delete()
            .eq('user_id', this.user.id);
            
        if (error) {
            console.error('Error clearing analyses:', error);
            notificationSystem.error('Failed to clear analyses');
            return;
        }
        
        notificationSystem.success('All analyses cleared');
        await this.loadSavedAnalyses();
    }
    
    renderSavedAnalyses() {
    const container = document.getElementById('savedAnalysesList');
    
    if (this.savedAnalyses.length === 0) {
        container.innerHTML = '<p class="empty-message">No saved analyses yet</p>';
        return;
    }
    
    container.innerHTML = '';
    
    // Add Clear All button
    const clearAllDiv = document.createElement('div');
    clearAllDiv.style.cssText = 'display: flex; justify-content: flex-end; margin-bottom: 8px;';
    clearAllDiv.innerHTML = `
        <button class="clear-all-btn" style="
            padding: 4px 12px;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 12px;
            color: #EF4444;
            font-size: 11px;
            cursor: pointer;
        ">Clear All</button>
    `;
    clearAllDiv.querySelector('.clear-all-btn').addEventListener('click', () => this.clearAllAnalyses());
    container.appendChild(clearAllDiv);
    
    this.savedAnalyses.forEach(analysis => {
        const item = document.createElement('div');
        item.className = 'saved-analysis-item';
        item.style.cssText = 'position: relative;';
        
        const logoUrl = this.getAssetLogo(analysis.asset_symbol);
        
        item.innerHTML = `
            <div class="saved-analysis-header">
                <div class="saved-analysis-asset">
                    <img src="${logoUrl}" alt="${analysis.asset_symbol}" onerror="this.src='assets/icons/default-crypto.svg'">
                    <span>${analysis.asset_symbol}</span>
                </div>
                <span class="saved-analysis-time">${this.formatTimeAgo(analysis.created_at)}</span>
            </div>
            <div class="saved-analysis-details">
                <span>Entry: $${this.formatNumber(analysis.entry_price)}</span>
                <span class="positive">TP: $${this.formatNumber(analysis.take_profit_price)}</span>
                <span class="negative">SL: $${this.formatNumber(analysis.stop_loss_price)}</span>
                <span>R/R: ${analysis.risk_reward_ratio?.toFixed(2) || 'N/A'}</span>
            </div>
            <button class="delete-analysis-btn" style="
                position: absolute;
                top: 8px;
                right: 8px;
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background: transparent;
                border: 1px solid rgba(239, 68, 68, 0.3);
                color: #EF4444;
                font-size: 14px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            " title="Delete analysis">&times;</button>
        `;
        
        // Click to load
        item.addEventListener('click', (e) => {
            // Don't load if clicking delete button
            if (!e.target.classList.contains('delete-analysis-btn')) {
                this.loadAnalysis(analysis);
            }
        });
        
        // Delete button
        item.querySelector('.delete-analysis-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteAnalysis(analysis.id);
        });
        
        container.appendChild(item);
    });
}
    
    loadAnalysis(analysis) {
        // Select the asset
        const asset = this.assets.find(a => a.symbol === analysis.asset_symbol);
        if (asset) {
            this.selectAsset(asset);
        }
        
        // Fill form
        document.getElementById('entryPriceInput').value = analysis.entry_price;
        document.getElementById('amountInput').value = analysis.amount;
        document.getElementById('profitTargetInput').value = analysis.profit_target;
        document.getElementById('lossToleranceInput').value = analysis.loss_tolerance;
        
        this.updatePositionValue();
        
        // Analyze
        this.analyzeTrade();
        
        notificationSystem.info('Analysis loaded');
    }

    calculateLiquidationPrice() {
    if (!this.currentAnalysis || !this.currentAnalysis.isFutures) return;
    
    const entryPrice = parseFloat(document.getElementById('entryPriceInput').value) || 0;
    const leverage = parseInt(document.getElementById('leverageSlider')?.value) || 1;
    const feePercent = parseFloat(document.getElementById('feeInput').value) || 0.1;
    
    const liqPrice = this.calculateLiquidationPriceInternal(entryPrice, leverage, feePercent);
    
    // Update the analysis
    this.currentAnalysis.liquidationPrice = liqPrice;
    this.currentAnalysis.leverage = leverage;
    
    // Update display
    this.displayLiquidationPrice();
    this.displayAnalysisResults(); // Refresh all numbers
    
    // Update trailing stops
    this.calculateTrailingStops();
}

displayLiquidationPrice() {
    if (!this.currentAnalysis || !this.currentAnalysis.isFutures) return;
    
    const liqPrice = this.currentAnalysis.liquidationPrice;
    const entryPrice = this.currentAnalysis.entryPrice;
    const liqPercent = ((entryPrice - liqPrice) / entryPrice) * 100;
    
    document.getElementById('liquidationPrice').textContent = 
        `$${this.formatNumber(liqPrice)} (${liqPercent.toFixed(2)}% below entry)`;
}
    
    resetAnalysis() {
        this.currentAnalysis = null;
        document.querySelector('.results-placeholder').style.display = 'flex';
        document.getElementById('analysisResults').style.display = 'none';
        
        // Clear form
        document.getElementById('plannerAssetInput').value = '';
        document.getElementById('entryPriceInput').value = '';
        document.getElementById('amountInput').value = '';
        document.getElementById('profitTargetInput').value = '';
        document.getElementById('lossToleranceInput').value = '';
        
        document.getElementById('selectedAssetDisplay').style.display = 'none';
        this.selectedAsset = null;
    }
    
    showCreateTradeModal() {
        if (!this.currentAnalysis) return;
        
        const a = this.currentAnalysis;
        
        const preview = document.getElementById('tradePreview');
        preview.innerHTML = `
            <div class="preview-item">
                <span class="preview-label">Asset</span>
                <span class="preview-value">${a.asset.symbol}</span>
            </div>
            <div class="preview-item">
                <span class="preview-label">Entry Price</span>
                <span class="preview-value">$${this.formatNumber(a.entryPrice)}</span>
            </div>
            <div class="preview-item">
                <span class="preview-label">Amount</span>
                <span class="preview-value">${this.formatNumber(a.amount, 8)} ${a.asset.symbol}</span>
            </div>
            <div class="preview-item">
                <span class="preview-label">Take Profit</span>
                <span class="preview-value positive">$${this.formatNumber(a.takeProfitPrice)}</span>
            </div>
            <div class="preview-item">
                <span class="preview-label">Stop Loss</span>
                <span class="preview-value negative">$${this.formatNumber(a.stopLossPrice)}</span>
            </div>
            <div class="preview-item">
                <span class="preview-label">Potential P/L</span>
                <span class="preview-value ${a.potentialProfit >= 0 ? 'positive' : 'negative'}">
                    +$${this.formatNumber(a.potentialProfit)} / -$${this.formatNumber(a.potentialLoss)}
                </span>
            </div>
        `;
        
        document.getElementById('createTradeModal').classList.add('active');
    }
    
    async createTradeFromAnalysis() {
        if (!this.currentAnalysis) return;
        
        const a = this.currentAnalysis;
        
        const tradeData = {
            user_id: this.user.id,
            asset_symbol: a.asset.symbol,
            asset_logo: this.getAssetLogo(a.asset.symbol),
            trade_type: 'buy',
            amount: a.amount,
            entry_price: a.entryPrice,
            fee: this.userSettings?.default_fee_rate || 0.1,
            status: 'open',
            started_at: new Date().toISOString(),
            notes: `Created from Planner analysis. TP: $${this.formatNumber(a.takeProfitPrice)} | SL: $${this.formatNumber(a.stopLossPrice)}`
        };
        
        const { data, error } = await supabase
            .from('trades')
            .insert([tradeData])
            .select()
            .single();
            
        if (error) {
            console.error('Error creating trade:', error);
            notificationSystem.error('Failed to create trade');
            return;
        }
        
        // Update holdings
        await this.updateHoldings(data);
        
        document.getElementById('createTradeModal').classList.remove('active');
        
        notificationSystem.success('Trade created successfully! Redirecting to Journal...');
        
        setTimeout(() => {
            window.location.href = 'journal.html';
        }, 1500);
    }
    
    async updateHoldings(trade) {
        const { data: holding } = await supabase
            .from('holdings')
            .select('*')
            .eq('user_id', this.user.id)
            .eq('asset_symbol', trade.asset_symbol)
            .single();
            
        if (holding) {
            const newAmount = holding.total_amount + trade.amount;
            const newCost = (holding.average_cost * holding.total_amount) + (trade.amount * trade.entry_price);
            const newAvgCost = newCost / newAmount;
            
            await supabase
                .from('holdings')
                .update({
                    total_amount: newAmount,
                    average_cost: newAvgCost
                })
                .eq('id', holding.id);
        } else {
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
    
    updateTradingModeDisplay() {
        const mode = this.userSettings?.trading_mode || 'spot';
        const badge = document.getElementById('tradingModeBadge');
        const leverageGroup = document.getElementById('leverageGroup');
        
        badge.textContent = mode === 'spot' ? 'Spot Mode' : 'Futures Mode';
        leverageGroup.style.display = mode === 'futures' ? 'block' : 'none';
    }
    
    updateUnitToggle() {
        document.querySelectorAll('.unit-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.unit === this.retracementUnit);
        });
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
        
        if (this.userSettings.theme) {
            document.body.className = `${this.userSettings.theme}-theme`;
        }
        
        if (this.userSettings.accent_color) {
            document.documentElement.style.setProperty('--accent-primary', this.userSettings.accent_color);
        }
    }
    
    async logout() {
    // Clear all user data first
    if (window.clearAllUserData) {
        window.clearAllUserData();
    }
    
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}
}

// Initialize planner when DOM is ready
let plannerManager;
document.addEventListener('DOMContentLoaded', () => {
    plannerManager = new PlannerManager();
    window.plannerManager = plannerManager;
});