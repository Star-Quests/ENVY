// File: backend/download-logos.js
// Run once to download all crypto logos

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const CRYPTO_SYMBOLS = [
  'BTC', 'ETH', 'SOL', 'BNB', 'USDT', 'ADA', 'DOT', 'AVAX', 'LINK', 
  'MATIC', 'DYDX', 'UNI', 'AAVE', 'DOGE', 'SHIB', 'XRP', 'LTC', 'BCH', 'ETC'
];

const LOGO_SOURCES = {
  'BTC': 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
  'ETH': 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
  'SOL': 'https://cryptologos.cc/logos/solana-sol-logo.png',
  'BNB': 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
  'USDT': 'https://cryptologos.cc/logos/tether-usdt-logo.png',
  'ADA': 'https://cryptologos.cc/logos/cardano-ada-logo.png',
  'DOT': 'https://cryptologos.cc/logos/polkadot-new-dot-logo.png',
  'AVAX': 'https://cryptologos.cc/logos/avalanche-avax-logo.png',
  'LINK': 'https://cryptologos.cc/logos/chainlink-link-logo.png',
  'MATIC': 'https://cryptologos.cc/logos/polygon-matic-logo.png',
  'DYDX': 'https://cryptologos.cc/logos/dydx-dydx-logo.png',
  'UNI': 'https://cryptologos.cc/logos/uniswap-uni-logo.png',
  'AAVE': 'https://cryptologos.cc/logos/aave-aave-logo.png',
  'DOGE': 'https://cryptologos.cc/logos/dogecoin-doge-logo.png',
  'SHIB': 'https://cryptologos.cc/logos/shiba-inu-shib-logo.png',
  'XRP': 'https://cryptologos.cc/logos/xrp-xrp-logo.png',
  'LTC': 'https://cryptologos.cc/logos/litecoin-ltc-logo.png',
  'BCH': 'https://cryptologos.cc/logos/bitcoin-cash-bch-logo.png',
  'ETC': 'https://cryptologos.cc/logos/ethereum-classic-etc-logo.png'
};

async function downloadLogos() {
  const logoDir = path.join(__dirname, '../frontend/assets/logos');
  await fs.ensureDir(logoDir);
  
  console.log('╔════════════════════════════════════════╗');
  console.log('║   ENVY Logo Downloader                 ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const [symbol, url] of Object.entries(LOGO_SOURCES)) {
    try {
      process.stdout.write(`📥 Downloading ${symbol}... `);
      
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'image/png,image/*;q=0.9,*/*;q=0.8'
        }
      });
      
      if (response.status === 200) {
        const filePath = path.join(logoDir, `${symbol}.png`);
        await fs.writeFile(filePath, response.data);
        console.log('✅');
        successCount++;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.log('❌');
      console.log(`   Error: ${error.message}`);
      failCount++;
      
      // Create placeholder for failed downloads
      await createPlaceholder(logoDir, symbol);
    }
    
    // Wait a bit between downloads
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  
  // Create generic placeholder
  await createPlaceholder(logoDir, 'placeholder');
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Download Complete                    ║');
  console.log(`║   ✅ Success: ${successCount.toString().padStart(2)}                         ║`);
  console.log(`║   ❌ Failed: ${failCount.toString().padStart(3)}                         ║`);
  console.log('╚════════════════════════════════════════╝');
}

async function createPlaceholder(dir, name) {
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
  
  const color = colors[name] || '#627EEA';
  const bgColor = '#1E2025';
  const displayName = name === 'placeholder' ? '?' : name;
  
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" rx="24" fill="${bgColor}"/>
  <circle cx="64" cy="64" r="48" fill="${color}"/>
  <text x="64" y="84" font-family="Orbitron, sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">${displayName}</text>
</svg>`;
  
  const filePath = path.join(dir, `${name}.svg`);
  await fs.writeFile(filePath, svg);
  
  if (name !== 'placeholder') {
    console.log(`   📦 Created placeholder for ${name}`);
  }
}

// Run if called directly
if (require.main === module) {
  downloadLogos().catch(console.error);
}

module.exports = { downloadLogos, createPlaceholder };