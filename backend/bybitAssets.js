// File: backend/bybitAssets.js
// ENVY Bybit Asset Discovery and Logo Management

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class BybitAssets {
  constructor(db) {
    this.db = db;
    this.baseUrl = 'https://api.bybit.com/v5';
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
      'USDC': 'usd-coin'
    };
  }
  
  async fetchBybitSymbols() {
    try {
      const response = await axios.get(`${this.baseUrl}/market/instruments-info`, {
        params: { category: 'spot' },
        timeout: 10000
      });
      
      if (response.data.retCode === 0 && response.data.result.list) {
        return response.data.result.list
          .filter(item => item.status === 'Trading' && item.symbol.endsWith('USDT'))
          .map(item => item.symbol.replace('USDT', ''));
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching Bybit symbols:', error.message);
      return [];
    }
  }
  
  async fetchTicker(symbol) {
    try {
      const response = await axios.get(`${this.baseUrl}/market/tickers`, {
        params: {
          category: 'spot',
          symbol: symbol + 'USDT'
        },
        timeout: 10000
      });
      
      if (response.data.retCode === 0 && response.data.result.list[0]) {
        const ticker = response.data.result.list[0];
        return {
          symbol,
          price: parseFloat(ticker.lastPrice),
          bid: parseFloat(ticker.bid1Price),
          ask: parseFloat(ticker.ask1Price),
          change24h: parseFloat(ticker.price24hPcnt)
        };
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching ticker for ${symbol}:`, error.message);
      return null;
    }
  }
  
  async discoverNewAssets() {
    try {
      const bybitSymbols = await this.fetchBybitSymbols();
      
      // Get existing assets
      const existing = this.db.exec(`SELECT symbol FROM asset_settings`);
      const existingSymbols = [];
      if (existing[0]) {
        existing[0].values.forEach(row => existingSymbols.push(row[0]));
      }
      
      // Find new symbols
      const newSymbols = bybitSymbols.filter(s => !existingSymbols.includes(s));
      
      // Add new assets (disabled by default)
      for (const symbol of newSymbols) {
        const logoPath = await this.fetchLogo(symbol);
        this.db.run(`
          INSERT INTO asset_settings (symbol, enabled, display_name, logo_path, last_updated)
          VALUES (?, 0, ?, ?, ?)
        `, [symbol, symbol, logoPath, Date.now()]);
        console.log(`➕ Added new asset: ${symbol}`);
      }
      
      // Check for delisted assets
      const delisted = existingSymbols.filter(s => !bybitSymbols.includes(s) && s !== 'USDT');
      for (const symbol of delisted) {
        this.db.run(`UPDATE asset_settings SET enabled = 0 WHERE symbol = ?`, [symbol]);
        console.log(`➖ Delisted asset: ${symbol} (disabled)`);
      }
      
      // Update last discovery time
      this.db.run(`
        UPDATE settings SET value = ?, updated_at = ? WHERE key = 'last_asset_update'
      `, [Date.now().toString(), Date.now()]);
      
      return newSymbols;
      
    } catch (error) {
      console.error('Error discovering assets:', error);
      return [];
    }
  }
  
  async fetchLogo(symbol) {
    const logoDir = path.join(__dirname, '../frontend/assets/logos');
    await fs.ensureDir(logoDir);
    
    const localPath = path.join(logoDir, `${symbol}.png`);
    const localSvgPath = path.join(logoDir, `${symbol}.svg`);
    
    // Check if already cached
    if (await fs.pathExists(localPath)) {
      return `/assets/logos/${symbol}.png`;
    }
    if (await fs.pathExists(localSvgPath)) {
      return `/assets/logos/${symbol}.svg`;
    }
    
    // Try CoinGecko
    const coinId = this.coinGeckoIds[symbol] || symbol.toLowerCase();
    
    try {
      const response = await axios({
        method: 'get',
        url: `https://api.coingecko.com/api/v3/coins/${coinId}`,
        timeout: 10000,
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.data && response.data.image) {
        const imageUrl = response.data.image.large || response.data.image.thumb;
        
        if (imageUrl) {
          const imgResponse = await axios({
            method: 'get',
            url: imageUrl,
            responseType: 'arraybuffer',
            timeout: 15000
          });
          
          await fs.writeFile(localPath, imgResponse.data);
          console.log(`✅ Downloaded logo for ${symbol}`);
          return `/assets/logos/${symbol}.png`;
        }
      }
    } catch (error) {
      console.log(`❌ Logo fetch failed for ${symbol}: ${error.message}`);
    }
    
    // Create placeholder
    await this.createPlaceholder(symbol, localSvgPath);
    return `/assets/logos/${symbol}.svg`;
  }
  
  async createPlaceholder(symbol, localPath) {
    const colors = {
      'BTC': '#F7931A',
      'ETH': '#627EEA',
      'BNB': '#F3BA2F',
      'SOL': '#14F195',
      'USDT': '#26A17B',
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
      'ETC': '#669073'
    };
    
    const color = colors[symbol] || '#627EEA';
    
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" rx="24" fill="#1E2025"/>
  <circle cx="64" cy="64" r="48" fill="${color}"/>
  <text x="64" y="84" font-family="Orbitron, sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">${symbol}</text>
</svg>`;
    
    await fs.writeFile(localPath, svg);
    console.log(`📦 Created placeholder for ${symbol}`);
  }
}

module.exports = BybitAssets;