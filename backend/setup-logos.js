// File: backend/setup-logos.js
// Run during deployment to ensure all logos exist

const fs = require('fs-extra');
const path = require('path');
const CryptoLogoFetcher = require('./logo-fetcher');

async function setupLogos() {
  console.log('🖼️ Setting up crypto logos...');
  
  // Define paths - CRITICAL for Pxxl
  const logoDir = path.join(__dirname, '../frontend/assets/logos');
  await fs.ensureDir(logoDir);
  
  // List of all your assets
  const symbols = [
    'BTC', 'ETH', 'SOL', 'BNB', 'USDT', 'ADA', 'DOT', 'AVAX', 'LINK',
    'MATIC', 'DYDX', 'UNI', 'AAVE', 'DOGE', 'SHIB', 'XRP', 'LTC', 'BCH', 'ETC'
  ];
  
  const fetcher = new CryptoLogoFetcher();
  
  // Create placeholders for all symbols (guaranteed to work)
  for (const symbol of symbols) {
    const svgPath = path.join(logoDir, `${symbol}.svg`);
    const pngPath = path.join(logoDir, `${symbol}.png`);
    
    // Skip if PNG already exists (prefer PNG)
    if (await fs.pathExists(pngPath)) {
      console.log(`✅ PNG exists for ${symbol}`);
      continue;
    }
    
    // Create SVG placeholder
    const color = fetcher.generateColor(symbol);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" rx="24" fill="#1E2025"/>
  <circle cx="64" cy="64" r="48" fill="${color}"/>
  <text x="64" y="84" font-family="Orbitron, sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">${symbol}</text>
</svg>`;
    
    await fs.writeFile(svgPath, svg);
    console.log(`📦 Created placeholder for ${symbol}`);
  }
  
  console.log('✅ Logo setup complete!');
}

// Run if called directly
if (require.main === module) {
  setupLogos().catch(console.error);
}

module.exports = setupLogos;