/**
 * ENVY Bybit API Module
 * Professional integration with Bybit exchange
 * Fetches real-time prices and asset information
 */

import { ENVYConfig } from './config.js';

class BybitAPI {
    constructor() {
        this.baseUrl = 'https://api.bybit.com';
        this.priceCache = new Map();
        this.assetsCache = null;
        this.cacheTimeout = 3000;
        this.pendingRequests = new Map();
    }

    /**
     * Fetch all available spot trading pairs from Bybit
     * @returns {Promise<Array>} Array of asset objects
     */
    async fetchAllAssets() {
        if (this.assetsCache && Date.now() - this.assetsCache.timestamp < 3600000) {
            return this.assetsCache.data;
        }

        try {
            const response = await fetch(`${this.baseUrl}/v5/market/instruments-info?category=spot`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.retCode === 0 && data.result && data.result.list) {
                const assets = data.result.list
                    .filter(item => item.status === 'Trading' && item.quoteCoin === 'USDT')
                    .map(item => ({
                        symbol: item.baseCoin,
                        name: this.getAssetName(item.baseCoin),
                        fullSymbol: item.symbol,
                        baseCoin: item.baseCoin,
                        quoteCoin: item.quoteCoin,
                        minOrderQty: item.lotSizeFilter?.minOrderQty || '0',
                        maxOrderQty: item.lotSizeFilter?.maxOrderQty || '0',
                        priceScale: item.priceScale || 2,
                        logoUrl: this.getLogoUrl(item.baseCoin)
                    }))
                    .filter((value, index, self) => 
                        index === self.findIndex(t => t.symbol === value.symbol)
                    )
                    .sort((a, b) => a.symbol.localeCompare(b.symbol));

                this.assetsCache = {
                    data: assets,
                    timestamp: Date.now()
                };

                return assets;
            }

            return this.getFallbackAssets();
        } catch (error) {
            console.error('Bybit API Error:', error);
            return this.getFallbackAssets();
        }
    }

    /**
     * Fetch current prices for multiple symbols
     * @param {Array} symbols - Array of asset symbols
     * @returns {Promise<Object>} Price data object
     */
    async fetchPrices(symbols) {
        const results = {};
        const uncachedSymbols = [];

        for (const symbol of symbols) {
            const cached = this.priceCache.get(symbol);
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                results[symbol] = cached.data;
            } else {
                uncachedSymbols.push(symbol);
            }
        }

        if (uncachedSymbols.length === 0) {
            return results;
        }

        const cacheKey = uncachedSymbols.sort().join(',');
        
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }

        const promise = this.doFetchPrices(uncachedSymbols);
        this.pendingRequests.set(cacheKey, promise);

        try {
            const freshData = await promise;
            Object.assign(results, freshData);
            return results;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    }

    async doFetchPrices(symbols) {
        const results = {};

        try {
            const bybitSymbols = symbols.map(s => s.includes('USDT') ? s : `${s}USDT`).join(',');
            const response = await fetch(`${this.baseUrl}/v5/market/tickers?category=spot&symbol=${bybitSymbols}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.retCode === 0 && data.result && data.result.list) {
                for (const ticker of data.result.list) {
                    const symbol = ticker.symbol.replace('USDT', '');
                    const priceData = {
                        symbol: symbol,
                        price: parseFloat(ticker.lastPrice) || 0,
                        change24h: parseFloat(ticker.price24hPcnt) * 100 || 0,
                        high24h: parseFloat(ticker.highPrice24h) || 0,
                        low24h: parseFloat(ticker.lowPrice24h) || 0,
                        volume24h: parseFloat(ticker.volume24h) || 0,
                        timestamp: Date.now()
                    };

                    results[symbol] = priceData;
                    this.priceCache.set(symbol, { data: priceData, timestamp: Date.now() });
                }
            }

            for (const symbol of symbols) {
                if (!results[symbol]) {
                    results[symbol] = this.getFallbackPrice(symbol);
                }
            }

            return results;
        } catch (error) {
            console.error('Price fetch error:', error);
            for (const symbol of symbols) {
                results[symbol] = this.getFallbackPrice(symbol);
            }
            return results;
        }
    }

    /**
     * Search assets by query
     * @param {string} query - Search term
     * @returns {Promise<Array>} Filtered assets
     */
    async searchAssets(query) {
        const assets = await this.fetchAllAssets();
        const lowerQuery = query.toLowerCase().trim();
        
        if (!lowerQuery) {
            return assets.slice(0, 50);
        }

        return assets
            .filter(asset => 
                asset.symbol.toLowerCase().includes(lowerQuery) ||
                asset.name.toLowerCase().includes(lowerQuery)
            )
            .slice(0, 50);
    }

    /**
     * Get asset logo URL from CoinGecko
     * @param {string} symbol - Asset symbol
     * @returns {string} Logo URL
     */
    getLogoUrl(symbol) {
        const ids = {
            'BTC': '1', 'ETH': '279', 'SOL': '4128', 'BNB': '825',
            'XRP': '44', 'ADA': '975', 'DOGE': '5', 'MATIC': '4713',
            'DOT': '12171', 'AVAX': '12559', 'LINK': '877', 'UNI': '12504',
            'ATOM': '1481', 'LTC': '2', 'BCH': '780', 'XLM': '128',
            'VET': '1168', 'THETA': '1492', 'FIL': '12817', 'TRX': '1094',
            'EOS': '1124', 'NEO': '1165', 'XMR': '328', 'DASH': '3',
            'ETC': '337', 'ZEC': '486', 'XTZ': '1697', 'AAVE': '7278',
            'ALGO': '4030', 'ICP': '14495', 'SAND': '12129', 'MANA': '1966',
            'APE': '24383', 'ARB': '28752', 'OP': '25222', 'SUI': '29538'
        };
        
        const id = ids[symbol.toUpperCase()] || symbol.toLowerCase();
        return `https://assets.coingecko.com/coins/images/${id}/small/${symbol.toLowerCase()}.png`;
    }

    /**
     * Get full asset name
     * @param {string} symbol - Asset symbol
     * @returns {string} Asset name
     */
    getAssetName(symbol) {
        const names = {
            'BTC': 'Bitcoin', 'ETH': 'Ethereum', 'SOL': 'Solana',
            'BNB': 'Binance Coin', 'XRP': 'Ripple', 'ADA': 'Cardano',
            'DOGE': 'Dogecoin', 'MATIC': 'Polygon', 'DOT': 'Polkadot',
            'AVAX': 'Avalanche', 'LINK': 'Chainlink', 'UNI': 'Uniswap',
            'ATOM': 'Cosmos', 'LTC': 'Litecoin', 'BCH': 'Bitcoin Cash',
            'XLM': 'Stellar', 'VET': 'VeChain', 'THETA': 'Theta',
            'FIL': 'Filecoin', 'TRX': 'TRON', 'EOS': 'EOS', 'NEO': 'NEO'
        };
        return names[symbol] || symbol;
    }

    /**
     * Get fallback assets list
     * @returns {Array} Fallback assets
     */
    getFallbackAssets() {
        return [
            { symbol: 'BTC', name: 'Bitcoin', logoUrl: this.getLogoUrl('BTC') },
            { symbol: 'ETH', name: 'Ethereum', logoUrl: this.getLogoUrl('ETH') },
            { symbol: 'SOL', name: 'Solana', logoUrl: this.getLogoUrl('SOL') },
            { symbol: 'BNB', name: 'Binance Coin', logoUrl: this.getLogoUrl('BNB') },
            { symbol: 'XRP', name: 'Ripple', logoUrl: this.getLogoUrl('XRP') },
            { symbol: 'ADA', name: 'Cardano', logoUrl: this.getLogoUrl('ADA') },
            { symbol: 'DOGE', name: 'Dogecoin', logoUrl: this.getLogoUrl('DOGE') },
            { symbol: 'MATIC', name: 'Polygon', logoUrl: this.getLogoUrl('MATIC') },
            { symbol: 'DOT', name: 'Polkadot', logoUrl: this.getLogoUrl('DOT') },
            { symbol: 'AVAX', name: 'Avalanche', logoUrl: this.getLogoUrl('AVAX') }
        ];
    }

    /**
     * Get fallback price for a symbol
     * @param {string} symbol - Asset symbol
     * @returns {Object} Fallback price data
     */
    getFallbackPrice(symbol) {
        const fallbacks = {
            'BTC': { price: 87234.50, change24h: 1.25, high24h: 88500, low24h: 86000, volume24h: 28000000000 },
            'ETH': { price: 3245.75, change24h: -0.5, high24h: 3300, low24h: 3200, volume24h: 15000000000 },
            'SOL': { price: 187.30, change24h: 2.1, high24h: 192, low24h: 182, volume24h: 3000000000 },
            'BNB': { price: 612.40, change24h: 0.8, high24h: 620, low24h: 605, volume24h: 2000000000 },
            'XRP': { price: 0.62, change24h: -1.2, high24h: 0.64, low24h: 0.61, volume24h: 1500000000 }
        };

        const upperSymbol = symbol.toUpperCase();
        
        if (fallbacks[upperSymbol]) {
            return {
                symbol: upperSymbol,
                ...fallbacks[upperSymbol],
                timestamp: Date.now(),
                isFallback: true
            };
        }

        const randomPrice = 100 + Math.random() * 900;
        return {
            symbol: upperSymbol,
            price: randomPrice,
            change24h: (Math.random() - 0.5) * 10,
            high24h: randomPrice * 1.05,
            low24h: randomPrice * 0.95,
            volume24h: 1000000,
            timestamp: Date.now(),
            isFallback: true
        };
    }

    /**
     * Format price for display
     * @param {number} price - Price value
     * @returns {string} Formatted price
     */
    formatPrice(price) {
        if (price >= 1000) {
            return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
        } else if (price >= 1) {
            return price.toLocaleString('en-US', { maximumFractionDigits: 4 });
        } else if (price >= 0.01) {
            return price.toLocaleString('en-US', { maximumFractionDigits: 6 });
        } else {
            return price.toLocaleString('en-US', { maximumFractionDigits: 8 });
        }
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this.priceCache.clear();
        this.assetsCache = null;
        this.pendingRequests.clear();
    }
}

export const bybitAPI = new BybitAPI();
export default bybitAPI;