// File: setup.js
// ENVY Complete Setup Script

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

async function setup() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   ENVY Complete Setup                  ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    // Step 1: Install root dependencies
    console.log('📦 Installing root dependencies...');
    execSync('npm install', { stdio: 'inherit', cwd: __dirname });
    console.log('✅ Root dependencies installed\n');

    // Step 2: Install backend dependencies
    console.log('📦 Installing backend dependencies...');
    const backendDir = path.join(__dirname, 'backend');
    execSync('npm install sql.js bignumber.js axios fs-extra uuid simple-git node-cron ws', { 
      stdio: 'inherit', 
      cwd: backendDir 
    });
    console.log('✅ Backend dependencies installed\n');

    // Step 3: Install frontend dependencies
    console.log('📦 Installing frontend dependencies...');
    const frontendDir = path.join(__dirname, 'frontend');
    execSync('npm install', { stdio: 'inherit', cwd: frontendDir });
    console.log('✅ Frontend dependencies installed\n');

    // Step 4: Create directories
    console.log('📁 Creating directories...');
    await fs.ensureDir(path.join(__dirname, 'backend', 'database'));
    await fs.ensureDir(path.join(__dirname, 'frontend', 'assets', 'logos'));
    await fs.ensureDir(path.join(__dirname, 'frontend', 'assets', 'icons'));
    console.log('✅ Directories created\n');

    // Step 5: Download sql-wasm.wasm
    console.log('📥 Downloading sql-wasm.wasm...');
    const axios = require('axios');
    const wasmDir = path.join(__dirname, 'backend', 'node_modules', 'sql.js', 'dist');
    await fs.ensureDir(wasmDir);
    
    const response = await axios({
      method: 'get',
      url: 'https://sql.js.org/dist/sql-wasm.wasm',
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    const wasmPath = path.join(wasmDir, 'sql-wasm.wasm');
    await fs.writeFile(wasmPath, Buffer.from(response.data));
    console.log('✅ sql-wasm.wasm downloaded\n');

    // Step 6: Download logos
    console.log('🖼️  Downloading crypto logos...');
    try {
      const downloadLogos = require('./backend/download-logos');
      await downloadLogos.downloadLogos();
    } catch (e) {
      console.log('⚠️  Logo download failed, creating placeholders...');
      // Create basic placeholders
      const logoDir = path.join(__dirname, 'frontend', 'assets', 'logos');
      const symbols = ['BTC', 'ETH', 'SOL', 'BNB', 'USDT'];
      for (const symbol of symbols) {
        await createPlaceholder(logoDir, symbol);
      }
    }
    console.log('✅ Logos prepared\n');

    // Step 7: Create icons
    console.log('🎨 Creating icons...');
    await createIcons();
    console.log('✅ Icons created\n');

    console.log('╔════════════════════════════════════════╗');
    console.log('║   Setup Complete!                      ║');
    console.log('║                                        ║');
    console.log('║   To start the application:            ║');
    console.log('║   npm run dev:full                     ║');
    console.log('║                                        ║');
    console.log('║   Frontend: http://localhost:3000      ║');
    console.log('║   Backend:  http://localhost:3001      ║');
    console.log('╚════════════════════════════════════════╝');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

async function createPlaceholder(dir, symbol) {
  const colors = {
    'BTC': '#F7931A',
    'ETH': '#627EEA',
    'BNB': '#F3BA2F',
    'SOL': '#14F195',
    'USDT': '#26A17B'
  };
  
  const color = colors[symbol] || '#627EEA';
  
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" rx="24" fill="#1E2025"/>
  <circle cx="64" cy="64" r="48" fill="${color}"/>
  <text x="64" y="84" font-family="Orbitron, sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">${symbol}</text>
</svg>`;
  
  await fs.writeFile(path.join(dir, `${symbol}.svg`), svg);
}

async function createIcons() {
  const iconDir = path.join(__dirname, 'frontend', 'assets', 'icons');
  await fs.ensureDir(iconDir);
  
  const icons = {
    'dashboard': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="9" rx="1" stroke="currentColor" stroke-width="2"/><rect x="14" y="3" width="7" height="5" rx="1" stroke="currentColor" stroke-width="2"/><rect x="14" y="12" width="7" height="9" rx="1" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="7" height="5" rx="1" stroke="currentColor" stroke-width="2"/></svg>',
    'journal': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" stroke-width="2"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" stroke-width="2"/></svg>',
    'planner': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" stroke-width="2"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    'settings': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H5.78a1.65 1.65 0 0 0-1.51 1 1.65 1.65 0 0 0 .33 1.82l.07.09A10 10 0 0 0 12 18a10 10 0 0 0 6.26-2.22z" stroke="currentColor" stroke-width="2"/><path d="M16.5 6.5L17 4l-2-1-2 2-2-2-2 1 .5 2.5L5 8l3 4 4-4 3 4 3-4z" stroke="currentColor" stroke-width="2"/></svg>',
    'delete': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2"/></svg>'
  };
  
  for (const [name, svg] of Object.entries(icons)) {
    await fs.writeFile(path.join(iconDir, `${name}.svg`), svg);
  }
}

// Run setup
setup();