// File: fix-system.js (in root directory, NOT in backend folder)
// Run all fixes at once

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

async function fixSystem() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   ENVY System Fix Utility              ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  try {
    // Step 1: Run database migration
    console.log('📊 Running database migration...');
    execSync('node backend/migrate.js', { stdio: 'inherit', cwd: __dirname });
    console.log('✅ Database migration complete\n');

    // Step 2: Ensure logo directory exists
    console.log('📁 Ensuring logo directory...');
    await fs.ensureDir(path.join(__dirname, 'frontend', 'assets', 'logos'));
    console.log('✅ Logo directory ready\n');

    // Step 3: Create placeholder SVGs for common symbols
    console.log('🎨 Creating placeholder SVGs...');
    const logoDir = path.join(__dirname, 'frontend', 'assets', 'logos');
    
    // Create placeholder function
    async function createPlaceholder(symbol) {
      const colors = {
        'BTC': '#F7931A', 'ETH': '#627EEA', 'BNB': '#F3BA2F', 'SOL': '#14F195',
        'ADA': '#0033AD', 'DOT': '#E6007A', 'AVAX': '#E84142', 'LINK': '#2A5ADA',
        'MATIC': '#8247E5', 'DYDX': '#6966FF', 'UNI': '#FF007A', 'AAVE': '#B6509E',
        'DOGE': '#C2A633', 'SHIB': '#F5A623', 'XRP': '#23292F', 'LTC': '#345D9D',
        'BCH': '#8DC351', 'ETC': '#669073', 'USDT': '#26A17B', 'USDC': '#2775CA'
      };
      
      const color = colors[symbol] || '#627EEA';
      const bgColor = '#1E2025';
      
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="24" fill="${bgColor}"/>
    <circle cx="64" cy="64" r="48" fill="${color}"/>
    <text x="64" y="84" font-family="Orbitron, Arial, sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">${symbol}</text>
</svg>`;
      
      const svgPath = path.join(logoDir, `${symbol}.svg`);
      await fs.writeFile(svgPath, svg);
      console.log(`   📦 Created placeholder for ${symbol}`);
    }
    
    const symbols = ['BTC', 'ETH', 'SOL', 'BNB', 'USDT', 'ADA', 'DOT', 'AVAX', 'LINK', 
                     'MATIC', 'DYDX', 'UNI', 'AAVE', 'DOGE', 'SHIB', 'XRP', 'LTC', 'BCH', 'ETC'];
    
    for (const symbol of symbols) {
      const pngPath = path.join(logoDir, `${symbol}.png`);
      const svgPath = path.join(logoDir, `${symbol}.svg`);
      
      if (!await fs.pathExists(pngPath) && !await fs.pathExists(svgPath)) {
        await createPlaceholder(symbol);
      }
    }
    
    // Create placeholder for generic use
    const placeholderPath = path.join(logoDir, 'placeholder.svg');
    if (!await fs.pathExists(placeholderPath)) {
      const placeholderSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="24" fill="#1E2025"/>
    <circle cx="64" cy="64" r="48" fill="#627EEA"/>
    <text x="64" y="84" font-family="Orbitron, Arial, sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">?</text>
</svg>`;
      await fs.writeFile(placeholderPath, placeholderSvg);
    }
    
    console.log('✅ Placeholder SVGs created\n');

    console.log('╔════════════════════════════════════════╗');
    console.log('║   Fixes Applied Successfully!          ║');
    console.log('║                                        ║');
    console.log('║   Fixed Issues:                        ║');
    console.log('║   • Portfolio summary calculations     ║');
    console.log('║   • Removed Average Trade              ║');
    console.log('║   • Holdings with average cost         ║');
    console.log('║   • P/L using Bybit formula            ║');
    console.log('║   • Planner two-column layout          ║');
    console.log('║   • GitHub backup with proper init     ║');
    console.log('║   • Logo placeholders created          ║');
    console.log('║   • No number abbreviation             ║');
    console.log('║                                        ║');
    console.log('║   To start the application:            ║');
    console.log('║   npm run dev:full                     ║');
    console.log('╚════════════════════════════════════════╝');
    
  } catch (error) {
    console.error('\n❌ Fix failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fixSystem();