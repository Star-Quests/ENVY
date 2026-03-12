// File: backend/logo-fetcher.js
// Crypto Logo Fetcher - IMPROVED with multiple fallback sources

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class CryptoLogoFetcher {
    constructor() {
        // Multiple logo sources for redundancy
        this.sources = [
            {
                name: 'CryptoLogos',
                url: (symbol) => `https://cryptologos.cc/logos/${symbol.toLowerCase()}-${symbol.toLowerCase()}-logo.png`
            },
            {
                name: 'CoinMarketCap',
                url: (symbol) => `https://s2.coinmarketcap.com/static/img/coins/64x64/${this.getCMCFallback(symbol)}.png`
            },
            {
                name: 'CoinGecko',
                url: (symbol) => `https://assets.coingecko.com/coins/images/1/large/${this.getCoinGeckoId(symbol)}.png`
            },
            {
                name: 'CryptoIcons',
                url: (symbol) => `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`
            },
            {
                name: 'CryptoCompare',
                url: (symbol) => `https://www.cryptocompare.com/media/37746251/${symbol.toLowerCase()}.png`
            }
        ];
        
        // Mapping for CoinGecko IDs
        this.coinGeckoIds = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'BNB': 'binancecoin',
            'SOL': 'solana',
            'ADA': 'cardano',
            'DOT': 'polkadot',
            'AVAX': 'avalanche-2',
            'LINK': 'chainlink',
            'MATIC': 'matic-network',
            'DYDX': 'dydx',
            'UNI': 'uniswap',
            'AAVE': 'aave',
            'DOGE': 'dogecoin',
            'SHIB': 'shiba-inu',
            'XRP': 'ripple',
            'LTC': 'litecoin',
            'BCH': 'bitcoin-cash',
            'ETC': 'ethereum-classic',
            'USDT': 'tether',
            'USDC': 'usd-coin',
            'DAI': 'dai',
            'TRX': 'tron',
            'ATOM': 'cosmos',
            'NEAR': 'near',
            'FTM': 'fantom',
            'ALGO': 'algorand'
        };
        
        // Mapping for CoinMarketCap IDs
        this.cmcIds = {
            'BTC': 1,
            'ETH': 1027,
            'BNB': 1839,
            'SOL': 5426,
            'ADA': 2010,
            'DOT': 6636,
            'AVAX': 5805,
            'LINK': 1975,
            'MATIC': 3890,
            'DYDX': 28324,
            'UNI': 7083,
            'AAVE': 7278,
            'DOGE': 74,
            'SHIB': 5994,
            'XRP': 52,
            'LTC': 2,
            'BCH': 1831,
            'ETC': 1321,
            'USDT': 825,
            'USDC': 3408,
            'DAI': 4943,
            'TRX': 1958,
            'ATOM': 3794,
            'NEAR': 6535,
            'FTM': 3513,
            'ALGO': 4030
        };
    }
    
    getCoinGeckoId(symbol) {
        return this.coinGeckoIds[symbol] || symbol.toLowerCase();
    }
    
    getCMCFallback(symbol) {
        return this.cmcIds[symbol] || 1;
    }
    
    async fetchLogo(symbol) {
        const logoDir = path.join(__dirname, '../frontend/assets/logos');
        await fs.ensureDir(logoDir);
        
        const localPath = path.join(logoDir, `${symbol}.png`);
        const localSvgPath = path.join(logoDir, `${symbol}.svg`);
        
        // Check if we already have the logo cached locally
        if (await fs.pathExists(localPath)) {
            console.log(`✅ Using cached logo for ${symbol}`);
            return `/assets/logos/${symbol}.png`;
        }
        if (await fs.pathExists(localSvgPath)) {
            console.log(`✅ Using cached SVG for ${symbol}`);
            return `/assets/logos/${symbol}.svg`;
        }
        
        console.log(`🔍 Searching for ${symbol} logo...`);
        
        // Try each source in sequence
        for (const source of this.sources) {
            try {
                const url = source.url(symbol);
                console.log(`   Trying ${source.name}...`);
                
                const response = await axios({
                    method: 'get',
                    url: url,
                    responseType: 'arraybuffer',
                    timeout: 8000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0',
                        'Accept': 'image/png,image/svg+xml,image/*;q=0.9,*/*;q=0.8'
                    },
                    validateStatus: (status) => status === 200
                });
                
                if (response.status === 200 && response.data.length > 1000) {
                    await fs.writeFile(localPath, response.data);
                    console.log(`✅ Downloaded ${symbol} logo from ${source.name}`);
                    return `/assets/logos/${symbol}.png`;
                }
            } catch (error) {
                // Silently continue to next source
            }
        }
        
        // If all sources fail, create placeholder
        console.log(`📦 Creating placeholder for ${symbol}`);
        return await this.createPlaceholderLogo(symbol, localSvgPath);
    }
    
    async createPlaceholderLogo(symbol, localPath) {
        // Professional gradient colors for major assets
        const colors = {
            'BTC': '#F7931A',
            'ETH': '#627EEA',
            'BNB': '#F3BA2F',
            'SOL': '#14F195',
            'ADA': '#0033AD',
            'DOT': '#E6007A',
            'AVAX': '#E84142',
            'LINK': '#2A5ADA',
            'MATIC': '#8247E5',
            'DYDX': '#6966FF',
            'UNI': '#FF007A',
            'AAVE': '#B6509E',
            'DOGE': '#C2A633',
            'SHIB': '#F5A623',
            'XRP': '#23292F',
            'LTC': '#345D9D',
            'BCH': '#8DC351',
            'ETC': '#669073',
            'USDT': '#26A17B',
            'USDC': '#2775CA',
            'DAI': '#F5AC37',
            'TRX': '#EF3B3B',
            'ATOM': '#5064FB',
            'NEAR': '#000000',
            'FTM': '#1969FF',
            'ALGO': '#000000'
        };
        
        const color = colors[symbol] || this.generateColor(symbol);
        const bgColor = '#1E2025';
        
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${color};stop-opacity:0.8" />
            <stop offset="100%" style="stop-color:${color};stop-opacity:0.6" />
        </linearGradient>
    </defs>
    <rect width="128" height="128" rx="24" fill="${bgColor}"/>
    <circle cx="64" cy="64" r="48" fill="url(#grad)"/>
    <text x="64" y="84" font-family="Orbitron, Arial, sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">${symbol}</text>
</svg>`;
        
        await fs.writeFile(localPath, svg);
        return `/assets/logos/${symbol}.svg`;
    }
    
    generateColor(symbol) {
        // Generate consistent color based on symbol
        let hash = 0;
        for (let i = 0; i < symbol.length; i++) {
            hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 50%)`;
    }
    
    async fetchAllLogos() {
        const symbols = Object.keys(this.coinGeckoIds);
        
        for (const symbol of symbols) {
            await this.fetchLogo(symbol);
            // Add delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log('✅ All logos processed');
    }
    
    async ensureLogoExists(symbol) {
        const logoDir = path.join(__dirname, '../frontend/assets/logos');
        await fs.ensureDir(logoDir);
        
        const pngPath = path.join(logoDir, `${symbol}.png`);
        const svgPath = path.join(logoDir, `${symbol}.svg`);
        
        if (await fs.pathExists(pngPath) || await fs.pathExists(svgPath)) {
            return true;
        }
        
        await this.fetchLogo(symbol);
        return true;
    }
}

module.exports = CryptoLogoFetcher;