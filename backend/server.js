// File: backend/server.js
// ENVY Backend Server - PROFESSIONAL EDITION - FIXED

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const WebSocket = require('ws');
const cron = require('node-cron');
const BigNumber = require('bignumber.js');
const { v4: uuidv4 } = require('uuid');
const initSqlJs = require('sql.js');
require('dotenv').config();

// Import custom modules
const Ledger = require('./ledger');
const GitHubSync = require('./githubSync');
const BybitAssets = require('./bybitAssets');

const app = express();
const PORT = process.env.PORT || 3001;
console.log(`🚀 Starting server on port: ${PORT}`);

// ==================== TEST BYBIT CONNECTION ====================
const https = require('https');
console.log('🔍 Testing Bybit API connection...');
https.get('https://api.bybit.com/v5/market/time', (resp) => {
  let data = '';
  resp.on('data', chunk => data += chunk);
  resp.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('✅ Bybit API reachable:', result);
    } catch (e) {
      console.log('❌ Bybit API error:', e.message);
    }
  });
}).on('error', (err) => {
  console.log('❌ Cannot reach Bybit API:', err.message);
});

// Test WebSocket connection
const testWs = new WebSocket('wss://stream.bybit.com/v5/public/spot');
testWs.on('open', () => {
  console.log('✅ WebSocket connection test successful');
  testWs.close();
});
testWs.on('error', (err) => {
  console.log('❌ WebSocket connection test failed:', err.message);
});
// ==================== END TEST ====================

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static assets (logos, icons, etc.)
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));

// ==================== SIMPLE TEST ROUTE ====================
app.get('/test', (req, res) => {
  console.log('✅ Test route accessed!');
  res.json({ message: 'Backend is working!', time: Date.now() });
});

// ==================== SERVE FRONTEND ====================
// Serve the main frontend files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../frontend')));

// For any route not matching an API endpoint, serve index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  }
});
// ==================== END OF NEW BLOCK ====================

// ==================== DATABASE SETUP ====================
let db;
let SQL;
let ledger;
let githubSync;
let bybitAssets;

// ==================== DATABASE RELOAD FUNCTION ====================
// ⚠️ IMPORTANT: This MUST be defined before it's used
async function reloadDatabase(dbFile) {
  try {
    console.log('🔄 Reloading database from file...');
    
    // Create new database instance from the file data
    const newDb = new SQL.Database(new Uint8Array(dbFile));
    
    // Verify the new database has data
    const txCheck = newDb.exec("SELECT COUNT(*) FROM transactions");
    const txCount = txCheck[0]?.values[0][0] || 0;
    console.log(`📊 New database has ${txCount} transactions`);
    
    // Replace the global database instance
    db = newDb;
    
    // Recreate ledger with new database
    ledger = new Ledger(db);
    
    // Update githubSync with new database
    githubSync = new GitHubSync(db, ledger);
    
    // Update bybitAssets with new database
    bybitAssets = new BybitAssets(db);
    
    console.log('✅ Database reloaded successfully');
    
    // Save the new database to file (backup)
    await saveDatabaseToFile();
    
    return true;
  } catch (error) {
    console.error('❌ Error reloading database:', error);
    return false;
  }
}

async function initDatabase() {
  try {
    // Look for WASM file
    const possiblePaths = [
      path.join(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm'),
      path.join(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm'),
      path.join(__dirname, 'sql-wasm.wasm')
    ];
    
    let wasmPath = null;
    for (const p of possiblePaths) {
      if (await fs.pathExists(p)) {
        wasmPath = p;
        break;
      }
    }
    
    if (!wasmPath) {
      console.log('❌ sql-wasm.wasm not found. Please run: npm install sql.js');
      process.exit(1);
    }
    
    const wasmBinary = await fs.readFile(wasmPath);
    SQL = await initSqlJs({ wasmBinary });
    
    const dbPath = path.join(__dirname, 'database/envy.db');
    await fs.ensureDir(path.dirname(dbPath));
    
    let dbFile;
    try {
      dbFile = await fs.readFile(dbPath);
      console.log('📂 Loaded existing database');
    } catch (err) {
      console.log('📁 Creating new database');
      dbFile = null;
    }
    
    if (dbFile && dbFile.length > 0) {
      db = new SQL.Database(new Uint8Array(dbFile));
    } else {
      db = new SQL.Database();
      await createTables();
    }
    
    ledger = new Ledger(db);
    githubSync = new GitHubSync(db, ledger);
    bybitAssets = new BybitAssets(db);
    
    // Auto-save every 30 seconds
    setInterval(saveDatabaseToFile, 30000);
    
    console.log('✅ Database initialized');
    return db;
  } catch (error) {
    console.error('❌ Database error:', error);
    process.exit(1);
  }
}

async function createTables() {
  db.run(`
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('buy', 'sell', 'fee')),
      asset TEXT NOT NULL,
      amount TEXT NOT NULL,
      price TEXT NOT NULL,
      total_value TEXT NOT NULL,
      fee TEXT DEFAULT '0',
      timestamp INTEGER NOT NULL,
      notes TEXT,
      cycle_id TEXT
    );
  `);
  
  db.run(`
    CREATE TABLE trade_cycles (
      id TEXT PRIMARY KEY,
      asset TEXT NOT NULL,
      entry_date INTEGER NOT NULL,
      exit_date INTEGER,
      entry_price TEXT NOT NULL,
      exit_price TEXT,
      quantity TEXT NOT NULL,
      realized_pl TEXT,
      realized_pl_percent TEXT,
      status TEXT DEFAULT 'open',
      timer_start INTEGER,
      timer_stop INTEGER,
      duration INTEGER DEFAULT 0
    );
  `);
  
  db.run(`
    CREATE TABLE trade_plans (
      id TEXT PRIMARY KEY,
      asset TEXT NOT NULL,
      entry_price TEXT NOT NULL,
      amount TEXT NOT NULL,
      target_profit TEXT NOT NULL,
      max_loss TEXT NOT NULL,
      tp_price TEXT,
      sl_price TEXT,
      total_capital TEXT,
      potential_profit TEXT,
      potential_loss TEXT,
      roi TEXT,
      risk_reward TEXT,
      trailing_activation TEXT,
      trailing_distance TEXT,
      created_at INTEGER NOT NULL,
      status TEXT DEFAULT 'active'
    );
  `);
  
  db.run(`
    CREATE TABLE asset_settings (
      symbol TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 1,
      display_name TEXT,
      logo_path TEXT,
      last_updated INTEGER
    );
  `);
  
  db.run(`
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  
  const defaultAssets = [
    ['BTC', 1, 'Bitcoin', '/assets/logos/BTC.png'],
    ['ETH', 1, 'Ethereum', '/assets/logos/ETH.png'],
    ['SOL', 1, 'Solana', '/assets/logos/SOL.png'],
    ['BNB', 1, 'BNB', '/assets/logos/BNB.png'],
    ['USDT', 1, 'Tether', '/assets/logos/USDT.png']
  ];
  
  defaultAssets.forEach(([symbol, enabled, name, logo]) => {
    db.run(`
      INSERT INTO asset_settings (symbol, enabled, display_name, logo_path)
      VALUES (?, ?, ?, ?)
    `, [symbol, enabled, name, logo]);
  });
  
  const now = Date.now();
  db.run(`
    INSERT INTO settings (key, value, updated_at) VALUES
    ('github_token', '', ?),
    ('github_repo', '', ?),
    ('last_sync_time', '0', ?)
  `, [now, now, now]);
  
  console.log('📊 Tables created');
}

async function saveDatabaseToFile() {
  try {
    const dbPath = path.join(__dirname, 'database/envy.db');
    const data = db.export();
    const buffer = Buffer.from(data);
    await fs.writeFile(dbPath, buffer);
  } catch (error) {
    console.error('❌ Error saving database:', error);
  }
}

// ==================== BYBIT WEBSOCKET ====================
class BybitWebSocket {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.subscriptions = new Set();
    this.priceData = new Map();
    this.connectionStatus = 'disconnected';
    this.statusListeners = [];
    this.pingInterval = null;
    this.lastUpdateTime = Date.now();
  }
  
  connect() {
  this.connectionStatus = 'connecting';
  this.notifyStatusListeners();
  
  this.ws = new WebSocket('wss://stream.bybit.com/v5/public/spot');
  
  this.ws.on('open', () => {
    console.log('🔌 Bybit WebSocket connected');
    this.connectionStatus = 'connected';
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.lastUpdateTime = Date.now();
    this.notifyStatusListeners();
    
    // CRITICAL FIX: Send ping every 15 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const pingMsg = JSON.stringify({ op: 'ping' });
        this.ws.send(pingMsg);
        console.log('📤 Ping sent to Bybit'); // Optional: remove in production
      }
    }, 15000); // 15 seconds (Bybit requires < 20 seconds)
    
    if (this.subscriptions.size > 0) {
      this.subscribe([...this.subscriptions]);
    }
  });
  
  this.ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      // Handle pong responses
      if (message.op === 'pong') {
        console.log('📥 Pong received from Bybit'); // Optional: remove in production
        return;
      }
      
      this.handleMessage(message);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  this.ws.on('close', (code, reason) => {
    console.log(`🔌 WebSocket disconnected (code: ${code}, reason: ${reason})`);
    this.connectionStatus = 'disconnected';
    this.notifyStatusListeners();
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    this.reconnect();
  });
  
  this.ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
  });
}
  
  handleMessage(message) {
    if (message.op === 'pong') return;
    
    if (message.topic && message.topic.startsWith('tickers.')) {
      const symbol = message.topic.split('.')[1].replace('USDT', '');
      if (message.data) {
        const price = new BigNumber(message.data.lastPrice || 0);
        const change24h = new BigNumber(message.data.price24hPcnt || 0);
        
        this.priceData.set(symbol, {
          price: price.toString(),
          change24h: change24h.toString(),
          timestamp: Date.now()
        });
        
        this.lastUpdateTime = Date.now();
      }
    }
  }
  
  subscribe(symbols) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      symbols.forEach(s => this.subscriptions.add(s));
      return;
    }
    
    const validSymbols = symbols.filter(s => s !== 'USDT');
    if (validSymbols.length === 0) return;
    
    const subscriptionMessage = {
      op: 'subscribe',
      args: validSymbols.map(s => `tickers.${s}USDT`)
    };
    
    this.ws.send(JSON.stringify(subscriptionMessage));
    validSymbols.forEach(s => this.subscriptions.add(s));
    console.log(`📡 Subscribed to: ${validSymbols.join(', ')}`);
  }
  
  unsubscribe(symbols) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    const validSymbols = symbols.filter(s => s !== 'USDT');
    if (validSymbols.length === 0) return;
    
    const subscriptionMessage = {
      op: 'unsubscribe',
      args: validSymbols.map(s => `tickers.${s}USDT`)
    };
    
    this.ws.send(JSON.stringify(subscriptionMessage));
    validSymbols.forEach(s => this.subscriptions.delete(s));
  }
  
  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.connectionStatus = 'failed';
      this.notifyStatusListeners();
      return;
    }
    
    this.reconnectAttempts++;
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
    
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }
  
  getPrice(symbol) {
    return this.priceData.get(symbol) || null;
  }
  
  getAllPrices() {
    return Object.fromEntries(this.priceData);
  }
  
  getEnabledPrices(enabledAssets) {
    const prices = {};
    enabledAssets.forEach(asset => {
      if (asset !== 'USDT' && this.priceData.has(asset)) {
        prices[asset] = this.priceData.get(asset);
      }
    });
    return prices;
  }
  
  addStatusListener(listener) {
    this.statusListeners.push(listener);
  }
  
  notifyStatusListeners() {
    this.statusListeners.forEach(listener => listener(this.connectionStatus));
  }
  
  getStatus() {
    return this.connectionStatus;
  }
  
  getLastUpdateTime() {
    return this.lastUpdateTime;
  }
}

const bybitWS = new BybitWebSocket();
bybitWS.connect();

// ==================== API ROUTES ====================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    connection: bybitWS.getStatus(),
    lastUpdate: bybitWS.getLastUpdateTime()
  });
});

app.get('/api/assets', async (req, res) => {
  console.log('📡 /api/assets called'); // Add this log
  try {
    const assets = db.exec(`
      SELECT symbol, enabled, display_name, logo_path 
      FROM asset_settings 
      ORDER BY symbol
    `);
    
    const result = [];
    if (assets[0]) {
      const columns = assets[0].columns;
      assets[0].values.forEach(row => {
        const asset = {};
        columns.forEach((col, i) => {
          asset[col] = row[i];
        });
        result.push(asset);
      });
    }
    
    console.log(`✅ /api/assets returning ${result.length} assets`);
    res.json(result);
  } catch (error) {
    console.error('❌ /api/assets error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/assets/enabled', (req, res) => {
  try {
    const assets = db.exec(`
      SELECT symbol, display_name, logo_path, enabled 
      FROM asset_settings 
      WHERE enabled = 1
      ORDER BY symbol
    `);
    
    const result = [];
    if (assets[0]) {
      const columns = assets[0].columns;
      assets[0].values.forEach(row => {
        const asset = {};
        columns.forEach((col, i) => {
          asset[col] = row[i];
        });
        result.push(asset);
      });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/assets/enabled', async (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (!Array.isArray(enabled)) {
      return res.status(400).json({ error: 'Enabled must be an array' });
    }
    
    db.run(`UPDATE asset_settings SET enabled = 0`);
    
    enabled.forEach(symbol => {
      db.run(`UPDATE asset_settings SET enabled = 1 WHERE symbol = ?`, [symbol]);
    });
    
    if (bybitWS.getStatus() === 'connected') {
      const currentSubs = [...bybitWS.subscriptions];
      if (currentSubs.length > 0) {
        bybitWS.unsubscribe(currentSubs);
      }
      if (enabled.length > 0) {
        bybitWS.subscribe(enabled);
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/assets/discover', async (req, res) => {
  try {
    const newAssets = await bybitAssets.discoverNewAssets();
    res.json({ success: true, newAssets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== PRICE ROUTES ====================

app.get('/api/prices', (req, res) => {
  try {
    const assets = db.exec(`SELECT symbol FROM asset_settings WHERE enabled = 1`);
    const enabledAssets = [];
    
    if (assets[0]) {
      assets[0].values.forEach(row => enabledAssets.push(row[0]));
    }
    
    const prices = bybitWS.getEnabledPrices(enabledAssets);
    
    res.json({
      prices,
      lastUpdate: bybitWS.getLastUpdateTime()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/market/ticker/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const upperSymbol = symbol.toUpperCase();
    
    const price = bybitWS.getPrice(upperSymbol);
    if (price) {
      res.json({
        symbol: upperSymbol,
        price: price.price,
        change24h: price.change24h,
        timestamp: price.timestamp
      });
    } else {
      const response = await bybitAssets.fetchTicker(upperSymbol);
      res.json(response);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== TRANSACTION ROUTES ====================

app.get('/api/transactions', (req, res) => {
  try {
    const result = db.exec(`
      SELECT * FROM transactions ORDER BY timestamp DESC
    `);
    
    const transactions = [];
    if (result[0]) {
      const columns = result[0].columns;
      result[0].values.forEach(row => {
        const tx = {};
        columns.forEach((col, i) => {
          tx[col] = row[i];
        });
        transactions.push(tx);
      });
    }
    
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/transactions', (req, res) => {
  try {
    const { type, asset, amount, price, fee = '0', notes = '' } = req.body;
    
    if (!type || !asset || !amount || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const id = uuidv4();
    const timestamp = Date.now();
    
    const amountBN = new BigNumber(amount);
    const priceBN = new BigNumber(price);
    const feeBN = new BigNumber(fee);
    const totalValueBN = amountBN.times(priceBN);
    
    const cycleId = ledger.addTransaction({
      id,
      type,
      asset,
      amount: amountBN.toString(),
      price: priceBN.toString(),
      totalValue: totalValueBN.toString(),
      fee: feeBN.toString(),
      timestamp,
      notes
    });
    
    db.run(`
      INSERT INTO transactions (
        id, type, asset, amount, price, total_value, fee, timestamp, notes, cycle_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, type, asset, amountBN.toString(), priceBN.toString(),
      totalValueBN.toString(), feeBN.toString(), timestamp, notes, cycleId || null
    ]);
    
    res.json({ id, success: true });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const txResult = db.exec(`SELECT * FROM transactions WHERE id = ?`, [id]);
    
    if (txResult[0] && txResult[0].values.length > 0) {
      const columns = txResult[0].columns;
      const values = txResult[0].values[0];
      const tx = {};
      columns.forEach((col, i) => {
        tx[col] = values[i];
      });
      
      ledger.removeTransaction(tx);
    }
    
    db.run(`DELETE FROM transactions WHERE id = ?`, [id]);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== PORTFOLIO ROUTES ====================

app.get('/api/portfolio/summary', (req, res) => {
  try {
    const summary = ledger.getPortfolioSummary(bybitWS);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/portfolio/positions', (req, res) => {
  try {
    const positions = ledger.getOpenPositions(bybitWS);
    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/portfolio/trades', (req, res) => {
  try {
    const trades = ledger.getTradeHistory();
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== TRADE PLAN ROUTES ====================

app.post('/api/plans', (req, res) => {
  try {
    const plan = req.body;
    const id = uuidv4();
    const created_at = Date.now();
    
    if (!plan.asset || !plan.entryPrice || !plan.amount || !plan.targetProfit || !plan.maxLoss) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const entryPriceBN = new BigNumber(plan.entryPrice);
    const amountBN = new BigNumber(plan.amount);
    const targetProfitBN = new BigNumber(plan.targetProfit);
    const maxLossBN = new BigNumber(plan.maxLoss);
    
    const totalCapitalBN = amountBN.times(entryPriceBN);
    const tpPriceBN = entryPriceBN.plus(targetProfitBN.dividedBy(amountBN));
    const slPriceBN = entryPriceBN.minus(maxLossBN.dividedBy(amountBN));
    const potentialProfitBN = amountBN.times(tpPriceBN.minus(entryPriceBN));
    const potentialLossBN = amountBN.times(entryPriceBN.minus(slPriceBN));
    const roiBN = potentialProfitBN.dividedBy(totalCapitalBN).times(100);
    const riskRewardBN = potentialProfitBN.dividedBy(potentialLossBN);
    
    const trailingActivationBN = tpPriceBN;
    const trailingDistanceBN = potentialProfitBN.dividedBy(2);
    
    db.run(`
      INSERT INTO trade_plans (
        id, asset, entry_price, amount, target_profit, max_loss,
        tp_price, sl_price, total_capital, potential_profit, potential_loss,
        roi, risk_reward, trailing_activation, trailing_distance, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, plan.asset,
      entryPriceBN.toString(), amountBN.toString(),
      targetProfitBN.toString(), maxLossBN.toString(),
      tpPriceBN.toString(), slPriceBN.toString(),
      totalCapitalBN.toString(), potentialProfitBN.toString(), potentialLossBN.toString(),
      roiBN.toString(), riskRewardBN.toString(),
      trailingActivationBN.toString(), trailingDistanceBN.toString(),
      created_at
    ]);
    
    res.json({ id, success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/plans/active', (req, res) => {
  try {
    const result = db.exec(`
      SELECT * FROM trade_plans WHERE status = 'active' ORDER BY created_at DESC
    `);
    
    const plans = [];
    if (result[0]) {
      const columns = result[0].columns;
      result[0].values.forEach(row => {
        const plan = {};
        columns.forEach((col, i) => {
          plan[col] = row[i];
        });
        plans.push(plan);
      });
    }
    
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/plans/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.run(`DELETE FROM trade_plans WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== TIMER ROUTES ====================

app.post('/api/cycles/:id/timer/start', (req, res) => {
  try {
    const { id } = req.params;
    ledger.startTimer(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cycles/:id/timer/stop', (req, res) => {
  try {
    const { id } = req.params;
    const duration = ledger.stopTimer(id);
    res.json({ success: true, duration });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SETTINGS ROUTES ====================

app.get('/api/settings', (req, res) => {
  try {
    const result = db.exec(`SELECT key, value FROM settings`);
    
    const settings = {};
    if (result[0]) {
      result[0].values.forEach(([key, value]) => {
        try {
          settings[key] = JSON.parse(value);
        } catch {
          settings[key] = value;
        }
      });
    }
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const updates = req.body;
    
    Object.entries(updates).forEach(([key, value]) => {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      db.run(`
        UPDATE settings SET value = ?, updated_at = ? WHERE key = ?
      `, [valueStr, Date.now(), key]);
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== GITHUB SYNC ROUTES ====================
// ⚠️ IMPORTANT: These must come AFTER reloadDatabase is defined

app.post('/api/sync', async (req, res) => {
  try {
    const success = await githubSync.sync();
    res.json({ success, timestamp: Date.now() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// FIXED RESTORE ROUTE - Uses the reloadDatabase function defined above
app.post('/api/restore', async (req, res) => {
  try {
    console.log('🔄 Restore endpoint called');
    
    // Pass the reloadDatabase function as callback
    const result = await githubSync.restore(reloadDatabase);
    
    if (result.success) {
      console.log('✅ Restore completed successfully');
      
      // Verify the restore worked by getting counts
      const txResult = db.exec("SELECT COUNT(*) FROM transactions");
      const txCount = txResult[0]?.values[0][0] || 0;
      
      const cyclesResult = db.exec("SELECT COUNT(*) FROM trade_cycles");
      const cyclesCount = cyclesResult[0]?.values[0][0] || 0;
      
      console.log(`📊 After restore - Transactions: ${txCount}, Cycles: ${cyclesCount}`);
      
      res.json({ 
        success: true, 
        message: result.message,
        stats: {
          transactions: txCount,
          cycles: cyclesCount
        }
      });
    } else {
      console.log('❌ Restore failed:', result.error);
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('❌ Restore error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== MEMORY FORMAT ====================

app.post('/api/format', async (req, res) => {
  try {
    console.log('🔄 Formatting application memory...');
    
    // Get all table names first to avoid errors
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables[0]?.values.map(row => row[0]) || [];
    console.log('📊 Found tables:', tableNames);
    
    // Safely delete from known tables
    const tablesToClear = ['transactions', 'trade_cycles', 'trade_plans', 'trade_plots', 'plans'];
    
    for (const table of tablesToClear) {
      if (tableNames.includes(table)) {
        db.run(`DELETE FROM ${table}`);
        console.log(`✅ Cleared table: ${table}`);
      }
    }
    
    // Reset asset settings if table exists
    if (tableNames.includes('asset_settings')) {
      // Disable all assets
      db.run(`UPDATE asset_settings SET enabled = 0`);
      
      // Re-enable default assets
      const defaultEnabled = ['BTC', 'ETH', 'SOL', 'BNB', 'USDT'];
      defaultEnabled.forEach(symbol => {
        db.run(`UPDATE asset_settings SET enabled = 1 WHERE symbol = ?`, [symbol]);
      });
      console.log('✅ Asset settings reset');
    }
    
    // Reset settings if table exists
    if (tableNames.includes('settings')) {
      db.run(`UPDATE settings SET value = '' WHERE key = 'github_token'`);
      db.run(`UPDATE settings SET value = '' WHERE key = 'github_repo'`);
      db.run(`UPDATE settings SET value = '0' WHERE key = 'last_sync_time'`);
      console.log('✅ GitHub settings cleared');
    }
    
    // Save database to file
    await saveDatabaseToFile();
    console.log('✅ Database saved to disk');
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('❌ Format error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});


// ==================== START SERVER ====================

async function startServer() {
  await initDatabase();
  
  // Disable auto GitHub sync - will be manual only
  // cron.schedule('*/5 * * * *', async () => {
  //   console.log('🔄 Running scheduled GitHub sync...');
  //   await githubSync.sync();
  // });
  
  // Disable auto asset discovery - manual only via button
  // cron.schedule('0 0 * * *', async () => {
  //   console.log('🔄 Running scheduled asset discovery...');
  //   await bybitAssets.discoverNewAssets();
  // });
  
  setTimeout(() => {
    const assets = db.exec(`SELECT symbol FROM asset_settings WHERE enabled = 1`);
    if (assets[0]) {
      const enabledAssets = assets[0].values.map(row => row[0]);
      bybitWS.subscribe(enabledAssets);
    }
  }, 2000);
  
  app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════╗
║   ENVY Server Running                  ║
║   📍 http://localhost:${PORT}            ║
║   📊 Bybit: ${bybitWS.getStatus()}      ║
║   💾 Database: Ready                    ║
║   🔧 Manual sync only                   ║
╚════════════════════════════════════════╝
    `);
  });
}

// Disable scheduled GitHub sync on Pxxl (git not available)
if (process.env.NODE_ENV === 'production') {
  console.log('⏰ GitHub sync is manual only on Pxxl (git not installed)');
  // You can still use manual sync if you click the button
} else {
  console.log('⏰ GitHub sync is manual only (development mode)');
}

startServer().catch(console.error);