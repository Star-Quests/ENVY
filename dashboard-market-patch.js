/**
 * ENVY Dashboard Market Feed Patch
 * Add this code to your dashboard.js file
 */

// 1. Add this import at the top of dashboard.js:
// import { bybitAPI } from './bybit-api.js';

// 2. Add these properties to the DashboardManager class:
// this.allAssets = [];
// this.tempSelectedAssets = [];
// this.priceUpdateInterval = null;
// this.assetSelectorModal = null;

// 3. Replace the updateCryptoPrices method with:
async updateCryptoPrices() {
    try {
        if (this.favoriteAssets.length === 0) {
            this.favoriteAssets = ['BTC', 'ETH', 'SOL'];
        }
        
        const prices = await bybitAPI.fetchPrices(this.favoriteAssets);
        this.cryptoPrices = prices;
        
        const timeElement = document.getElementById('lastPriceUpdate');
        if (timeElement) {
            timeElement.textContent = new Date().toLocaleTimeString();
        }
        
        return prices;
    } catch (error) {
        console.error('Price fetch error:', error);
        return {};
    }
}

// 4. Replace the renderCryptoFeed method with:
renderCryptoFeed() {
    const feedContainer = document.getElementById('cryptoFeed');
    if (!feedContainer) return;
    
    feedContainer.innerHTML = '';
    
    if (this.favoriteAssets.length === 0) {
        feedContainer.innerHTML = '<div class="empty-feed">Select assets to display</div>';
        return;
    }
    
    this.favoriteAssets.forEach(symbol => {
        const priceData = this.cryptoPrices[symbol] || bybitAPI.getFallbackPrice(symbol);
        const card = this.createCryptoCard(symbol, priceData);
        feedContainer.appendChild(card);
    });
    
    const timeElement = document.getElementById('lastPriceUpdate');
    if (timeElement) {
        timeElement.textContent = new Date().toLocaleTimeString();
    }
}

// 5. Replace the createCryptoCard method with:
createCryptoCard(symbol, priceData) {
    const card = document.createElement('div');
    card.className = 'crypto-card glass-morphism';
    
    const change = priceData.change24h || 0;
    const changeClass = change >= 0 ? 'positive' : 'negative';
    const changeSign = change >= 0 ? '+' : '';
    const logoUrl = bybitAPI.getLogoUrl(symbol);
    const assetName = bybitAPI.getAssetName(symbol);
    
    card.innerHTML = `
        <div class="crypto-card-header">
            <img src="${logoUrl}" alt="${symbol}" class="crypto-logo" onerror="this.src='assets/icons/default-crypto.svg'">
            <div class="crypto-info">
                <div class="crypto-name">${assetName}</div>
                <div class="crypto-symbol">${symbol}</div>
            </div>
        </div>
        <div class="crypto-price">$${bybitAPI.formatPrice(priceData.price)}</div>
        <div class="crypto-change ${changeClass}">
            <span class="change-arrow">${change >= 0 ? 'â–²' : 'â–¼'}</span>
            ${changeSign}${Math.abs(change).toFixed(2)}%
        </div>
        <div class="crypto-details">
            <div class="detail-item">
                <span>24h High</span>
                <span>$${bybitAPI.formatPrice(priceData.high24h)}</span>
            </div>
            <div class="detail-item">
                <span>24h Low</span>
                <span>$${bybitAPI.formatPrice(priceData.low24h)}</span>
            </div>
        </div>
        ${priceData.isFallback ? '<div class="fallback-badge">Estimated</div>' : ''}
    `;
    
    return card;
}

// 6. Add this method for showing the asset selector modal:
async showAssetSelectorModal() {
    this.tempSelectedAssets = [...this.favoriteAssets];
    
    let modal = document.getElementById('assetSelectorModal');
    
    if (!modal) {
        const response = await fetch('components/asset-selector-modal.html');
        const html = await response.text();
        document.body.insertAdjacentHTML('beforeend', html);
        modal = document.getElementById('assetSelectorModal');
        this.setupAssetModalEvents();
    }
    
    modal.classList.add('active');
    document.getElementById('assetSearchInput').value = '';
    
    const loadingEl = document.getElementById('assetsLoading');
    const gridEl = document.getElementById('assetsGrid');
    
    loadingEl.style.display = 'flex';
    gridEl.style.display = 'none';
    
    try {
        this.allAssets = await bybitAPI.fetchAllAssets();
        this.renderAssetGrid(this.allAssets);
        this.renderSelectedAssets();
        this.updateSelectedCount();
        
        loadingEl.style.display = 'none';
        gridEl.style.display = 'grid';
    } catch (error) {
        loadingEl.innerHTML = '<p class="error">Failed to load assets. Please try again.</p>';
    }
}

// 7. Add these helper methods:
setupAssetModalEvents() {
    const modal = document.getElementById('assetSelectorModal');
    
    document.getElementById('closeAssetSelectorModal').onclick = () => modal.classList.remove('active');
    document.getElementById('cancelAssetSelectorBtn').onclick = () => modal.classList.remove('active');
    
    document.getElementById('saveAssetSelectorBtn').onclick = async () => {
        this.favoriteAssets = [...this.tempSelectedAssets];
        
        await supabase
            .from('user_settings')
            .upsert({ user_id: this.user.id, favorite_assets: this.favoriteAssets });
        
        modal.classList.remove('active');
        
        await this.updateCryptoPrices();
        this.renderCryptoFeed();
        
        notificationSystem?.success('Assets updated successfully');
    };
    
    const searchInput = document.getElementById('assetSearchInput');
    searchInput.oninput = (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = query 
            ? this.allAssets.filter(a => 
                a.symbol.toLowerCase().includes(query) || 
                a.name.toLowerCase().includes(query))
            : this.allAssets;
        this.renderAssetGrid(filtered);
    };
    
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
}

renderAssetGrid(assets) {
    const grid = document.getElementById('assetsGrid');
    
    if (assets.length === 0) {
        grid.innerHTML = '<div class="empty-search">No assets found</div>';
        return;
    }
    
    grid.innerHTML = '';
    
    assets.slice(0, 100).forEach(asset => {
        const item = document.createElement('div');
        item.className = 'asset-item';
        if (this.tempSelectedAssets.includes(asset.symbol)) {
            item.classList.add('selected');
        }
        
        item.innerHTML = `
            <img src="${asset.logoUrl}" alt="${asset.symbol}" onerror="this.src='assets/icons/default-crypto.svg'">
            <div class="asset-item-info">
                <div class="asset-item-symbol">${asset.symbol}</div>
                <div class="asset-item-name">${asset.name}</div>
            </div>
            <div class="asset-checkbox"></div>
        `;
        
        item.onclick = () => {
            const symbol = asset.symbol;
            const index = this.tempSelectedAssets.indexOf(symbol);
            
            if (index === -1) {
                if (this.tempSelectedAssets.length < 10) {
                    this.tempSelectedAssets.push(symbol);
                    item.classList.add('selected');
                } else {
                    notificationSystem?.warning('Maximum 10 assets allowed');
                    return;
                }
            } else {
                this.tempSelectedAssets.splice(index, 1);
                item.classList.remove('selected');
            }
            
            this.renderSelectedAssets();
            this.updateSelectedCount();
        };
        
        grid.appendChild(item);
    });
}

renderSelectedAssets() {
    const container = document.getElementById('selectedAssetsList');
    container.innerHTML = '';
    
    this.tempSelectedAssets.forEach(symbol => {
        const asset = this.allAssets.find(a => a.symbol === symbol) || { symbol, logoUrl: bybitAPI.getLogoUrl(symbol) };
        
        const tag = document.createElement('div');
        tag.className = 'selected-asset-tag';
        tag.innerHTML = `
            <img src="${asset.logoUrl}" alt="${symbol}" onerror="this.src='assets/icons/default-crypto.svg'">
            <span>${symbol}</span>
            <button data-symbol="${symbol}">&times;</button>
        `;
        
        tag.querySelector('button').onclick = (e) => {
            e.stopPropagation();
            const sym = e.target.dataset.symbol;
            const index = this.tempSelectedAssets.indexOf(sym);
            if (index !== -1) {
                this.tempSelectedAssets.splice(index, 1);
                this.renderSelectedAssets();
                this.updateSelectedCount();
                
                const items = document.querySelectorAll('.asset-item');
                items.forEach(item => {
                    if (item.querySelector('.asset-item-symbol').textContent === sym) {
                        item.classList.remove('selected');
                    }
                });
            }
        };
        
        container.appendChild(tag);
    });
}

updateSelectedCount() {
    document.getElementById('selectedCount').textContent = this.tempSelectedAssets.length;
}

// 8. Update the editAssetsBtn event listener:
// In setupEventListeners(), replace the editAssetsBtn handler with:
const editAssetsBtn = document.getElementById('editAssetsBtn');
if (editAssetsBtn) {
    editAssetsBtn.addEventListener('click', () => this.showAssetSelectorModal());
}

// 9. Update startPriceUpdates to use real interval:
startPriceUpdates() {
    this.updateCryptoPrices().then(() => this.renderCryptoFeed());
    
    this.priceUpdateInterval = setInterval(async () => {
        await this.updateCryptoPrices();
        this.renderCryptoFeed();
        this.updateHoldingsWithLivePrices();
        this.updatePortfolioSummary();
    }, 5000);
}