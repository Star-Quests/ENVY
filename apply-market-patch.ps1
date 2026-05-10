# ENVY Dashboard Market Feed - Auto Patcher
# Automatically applies the Bybit market feed patch to dashboard.js
# Run as: .\apply-market-patch.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    APPLYING MARKET FEED PATCH          " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$dashJsPath = "frontend\js\dashboard.js"
$backupDir = "backup_dashboard_patch_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

# ============================================
# CREATE BACKUP
# ============================================
Write-Host "Creating backup..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $dashJsPath "$backupDir\dashboard.js" -Force
Write-Host "   Backup saved to: $backupDir\dashboard.js" -ForegroundColor Green
Write-Host ""

# ============================================
# READ CURRENT FILE
# ============================================
Write-Host "Reading dashboard.js..." -ForegroundColor Yellow
$content = Get-Content $dashJsPath -Raw -Encoding UTF8

# ============================================
# STEP 1: ADD IMPORT STATEMENT
# ============================================
Write-Host "Adding Bybit API import..." -ForegroundColor Yellow

$importStatement = "import { bybitAPI } from './bybit-api.js';"

# Check if import already exists
if ($content -notmatch [regex]::Escape($importStatement)) {
    # Find the last import statement
    $importPattern = '(?m)^import .+$'
    $matches = [regex]::Matches($content, $importPattern)
    
    if ($matches.Count -gt 0) {
        $lastImport = $matches[$matches.Count - 1].Value
        $content = $content -replace [regex]::Escape($lastImport), "$lastImport`n$importStatement"
        Write-Host "   Import added after: $lastImport" -ForegroundColor Green
    } else {
        # Add at the very top
        $content = "$importStatement`n`n$content"
        Write-Host "   Import added at top of file" -ForegroundColor Green
    }
} else {
    Write-Host "   Import already exists" -ForegroundColor Gray
}

# ============================================
# STEP 2: ADD CLASS PROPERTIES
# ============================================
Write-Host "Adding class properties..." -ForegroundColor Yellow

$propertiesToAdd = @'
        this.allAssets = [];
        this.tempSelectedAssets = [];
        this.assetSelectorModal = null;
'@

$constructorPattern = '(?s)constructor\(\) \{.*?\n    \}'
if ($content -match $constructorPattern) {
    $constructor = $matches[0]
    
    # Check if properties already exist
    if ($constructor -notmatch 'this\.allAssets') {
        # Find the line after "this.initialize();" or last property
        $newConstructor = $constructor -replace '(\n    \})', "$propertiesToAdd`n    }"
        $content = $content -replace [regex]::Escape($constructor), $newConstructor
        Write-Host "   Properties added to constructor" -ForegroundColor Green
    } else {
        Write-Host "   Properties already exist" -ForegroundColor Gray
    }
}

# ============================================
# STEP 3: REPLACE updateCryptoPrices METHOD
# ============================================
Write-Host "Replacing updateCryptoPrices()..." -ForegroundColor Yellow

$newUpdatePrices = @'
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
'@

$oldUpdatePattern = '(?s)async updateCryptoPrices\(\) \{.*?\n    \}'
if ($content -match $oldUpdatePattern) {
    $content = $content -replace $oldUpdatePattern, $newUpdatePrices
    Write-Host "   updateCryptoPrices() replaced" -ForegroundColor Green
} else {
    Write-Host "   WARNING: Could not find updateCryptoPrices()" -ForegroundColor Yellow
}

# ============================================
# STEP 4: REPLACE renderCryptoFeed METHOD
# ============================================
Write-Host "Replacing renderCryptoFeed()..." -ForegroundColor Yellow

$newRenderFeed = @'
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
'@

$oldRenderPattern = '(?s)renderCryptoFeed\(\) \{.*?\n    \}'
if ($content -match $oldRenderPattern) {
    $content = $content -replace $oldRenderPattern, $newRenderFeed
    Write-Host "   renderCryptoFeed() replaced" -ForegroundColor Green
} else {
    Write-Host "   WARNING: Could not find renderCryptoFeed()" -ForegroundColor Yellow
}

# ============================================
# STEP 5: REPLACE createCryptoCard METHOD
# ============================================
Write-Host "Replacing createCryptoCard()..." -ForegroundColor Yellow

$newCreateCard = @'
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
                <span class="change-arrow">${change >= 0 ? '▲' : '▼'}</span>
                ${changeSign}${Math.abs(change).toFixed(2)}%
            </div>
            <div class="crypto-details">
                <div class="detail-item">
                    <span>24h High</span>
                    <span>$${bybitAPI.formatPrice(priceData.high24h || priceData.price * 1.02)}</span>
                </div>
                <div class="detail-item">
                    <span>24h Low</span>
                    <span>$${bybitAPI.formatPrice(priceData.low24h || priceData.price * 0.98)}</span>
                </div>
            </div>
            ${priceData.isFallback ? '<div class="fallback-badge">Estimated</div>' : ''}
        `;
        
        return card;
    }
'@

$oldCreatePattern = '(?s)createCryptoCard\([^)]*\) \{.*?\n    \}'
if ($content -match $oldCreatePattern) {
    $content = $content -replace $oldCreatePattern, $newCreateCard
    Write-Host "   createCryptoCard() replaced" -ForegroundColor Green
} else {
    Write-Host "   WARNING: Could not find createCryptoCard()" -ForegroundColor Yellow
}

# ============================================
# STEP 6: ADD ASSET SELECTOR METHODS
# ============================================
Write-Host "Adding asset selector methods..." -ForegroundColor Yellow

$selectorMethods = @'

    async showAssetSelectorModal() {
        this.tempSelectedAssets = [...this.favoriteAssets];
        
        let modal = document.getElementById('assetSelectorModal');
        
        if (!modal) {
            try {
                const response = await fetch('components/asset-selector-modal.html');
                const html = await response.text();
                document.body.insertAdjacentHTML('beforeend', html);
                modal = document.getElementById('assetSelectorModal');
                this.setupAssetModalEvents();
            } catch (error) {
                console.error('Failed to load asset selector modal:', error);
                notificationSystem?.error('Failed to load asset selector');
                return;
            }
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
            console.error('Failed to load assets:', error);
            loadingEl.innerHTML = '<p class="error">Failed to load assets. Please try again.</p>';
        }
    }

    setupAssetModalEvents() {
        const modal = document.getElementById('assetSelectorModal');
        
        document.getElementById('closeAssetSelectorModal').onclick = () => modal.classList.remove('active');
        document.getElementById('cancelAssetSelectorBtn').onclick = () => modal.classList.remove('active');
        
        document.getElementById('saveAssetSelectorBtn').onclick = async () => {
            this.favoriteAssets = [...this.tempSelectedAssets];
            
            if (this.user) {
                await supabase
                    .from('user_settings')
                    .upsert({ user_id: this.user.id, favorite_assets: this.favoriteAssets });
            }
            
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
        
        if (!assets || assets.length === 0) {
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
            const asset = this.allAssets?.find(a => a.symbol === symbol) || { 
                symbol, 
                logoUrl: bybitAPI.getLogoUrl(symbol) 
            };
            
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
                        if (item.querySelector('.asset-item-symbol')?.textContent === sym) {
                            item.classList.remove('selected');
                        }
                    });
                }
            };
            
            container.appendChild(tag);
        });
    }

    updateSelectedCount() {
        const countEl = document.getElementById('selectedCount');
        if (countEl) {
            countEl.textContent = this.tempSelectedAssets.length;
        }
    }

'@

# Find where to insert the methods (before the last closing brace of the class)
$classEndPattern = '(?s)(class DashboardManager \{.*?)(\n\})'
if ($content -match $classEndPattern) {
    $content = $content -replace '(\n\})', "$selectorMethods`n}"
    Write-Host "   Asset selector methods added" -ForegroundColor Green
}

# ============================================
# STEP 7: UPDATE editAssetsBtn EVENT LISTENER
# ============================================
Write-Host "Updating edit assets button handler..." -ForegroundColor Yellow

$oldHandler = "document.getElementById\('editAssetsBtn'\).*?\.addEventListener\('click', \(\) =>.*?\)"
$newHandler = "const editAssetsBtn = document.getElementById('editAssetsBtn');`n        if (editAssetsBtn) {`n            editAssetsBtn.addEventListener('click', () => this.showAssetSelectorModal());`n        }"

if ($content -match $oldHandler) {
    $content = $content -replace $oldHandler, $newHandler
    Write-Host "   Edit assets button handler updated" -ForegroundColor Green
} else {
    # Try alternative pattern
    $altPattern = "(?s)editAssetsBtn\.addEventListener\('click'.*?\);"
    if ($content -match $altPattern) {
        $content = $content -replace $altPattern, "editAssetsBtn.addEventListener('click', () => this.showAssetSelectorModal());"
        Write-Host "   Edit assets button handler updated" -ForegroundColor Green
    }
}

# ============================================
# STEP 8: UPDATE startPriceUpdates
# ============================================
Write-Host "Updating startPriceUpdates()..." -ForegroundColor Yellow

$newStartUpdates = @'
    startPriceUpdates() {
        this.updateCryptoPrices().then(() => this.renderCryptoFeed());
        
        this.priceUpdateInterval = setInterval(async () => {
            await this.updateCryptoPrices();
            this.renderCryptoFeed();
            this.updateHoldingsWithLivePrices();
            this.updatePortfolioSummary();
        }, 5000);
    }
'@

$oldStartPattern = '(?s)startPriceUpdates\(\) \{.*?\n    \}'
if ($content -match $oldStartPattern) {
    $content = $content -replace $oldStartPattern, $newStartUpdates
    Write-Host "   startPriceUpdates() replaced" -ForegroundColor Green
}

# ============================================
# SAVE THE FILE
# ============================================
Write-Host ""
Write-Host "Saving dashboard.js..." -ForegroundColor Yellow
Set-Content $dashJsPath $content -Encoding UTF8 -NoNewline
Write-Host "   File saved successfully!" -ForegroundColor Green

# ============================================
# ADD CSS FOR CRYPTO CARDS
# ============================================
Write-Host ""
Write-Host "Adding CSS styles..." -ForegroundColor Yellow

$cssPath = "frontend\css\dashboard.css"
if (Test-Path $cssPath) {
    Copy-Item $cssPath "$backupDir\dashboard.css" -Force
    
    $cssStyles = @'

/* ============================================ */
/* LIVE MARKET FEED STYLES                      */
/* ============================================ */

.empty-feed {
    grid-column: 1 / -1;
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--accent-muted);
    background: var(--glass-bg);
    border-radius: var(--radius-xl);
}

.crypto-logo {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: contain;
}

.crypto-card {
    position: relative;
}

.fallback-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 2px 8px;
    background: var(--warning);
    color: var(--bg-primary);
    font-size: 10px;
    font-weight: 600;
    border-radius: var(--radius-full);
    text-transform: uppercase;
}

.feed-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
}

.price-update-indicator {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: 12px;
    color: var(--accent-muted);
}

.live-badge-small {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--success);
    font-weight: 600;
}

.live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--success);
    animation: pulse-connected 2s ease-in-out infinite;
}

'@
    
    Add-Content $cssPath "`r`n$cssStyles" -Encoding UTF8
    Write-Host "   CSS styles added to dashboard.css" -ForegroundColor Green
}

# ============================================
# SUMMARY
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "         PATCH APPLIED SUCCESSFULLY!     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "WHAT WAS DONE:" -ForegroundColor Green
Write-Host "  - Added Bybit API import"
Write-Host "  - Added class properties"
Write-Host "  - Replaced updateCryptoPrices()"
Write-Host "  - Replaced renderCryptoFeed()"
Write-Host "  - Replaced createCryptoCard()"
Write-Host "  - Added showAssetSelectorModal()"
Write-Host "  - Added setupAssetModalEvents()"
Write-Host "  - Added renderAssetGrid()"
Write-Host "  - Added renderSelectedAssets()"
Write-Host "  - Added updateSelectedCount()"
Write-Host "  - Updated edit assets button handler"
Write-Host "  - Updated startPriceUpdates()"
Write-Host "  - Added CSS styles"
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "  1. Hard refresh browser: Ctrl + Shift + R"
Write-Host "  2. Click 'Edit Assets' on dashboard"
Write-Host "  3. Select any assets from Bybit"
Write-Host "  4. Live prices will update every 5 seconds"
Write-Host ""
Write-Host "Backup saved to: $backupDir" -ForegroundColor Gray
Write-Host ""