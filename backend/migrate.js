// File: backend/migrate.js
// Database migration to add average_cost column if missing

const fs = require('fs-extra');
const path = require('path');
const initSqlJs = require('sql.js');

async function migrate() {
  console.log('🔄 Running database migration...');
  
  const dbPath = path.join(__dirname, 'database/envy.db');
  await fs.ensureDir(path.dirname(dbPath));
  
  let db;
  let SQL;
  
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
      console.log('❌ sql-wasm.wasm not found');
      process.exit(1);
    }
    
    const wasmBinary = await fs.readFile(wasmPath);
    SQL = await initSqlJs({ wasmBinary });
    
    // Load database
    let dbFile;
    try {
      dbFile = await fs.readFile(dbPath);
    } catch (err) {
      console.log('📁 No existing database found');
      return;
    }
    
    db = new SQL.Database(new Uint8Array(dbFile));
    
    // Check if we need to add average_cost column
    try {
      db.exec(`SELECT average_cost FROM trade_cycles LIMIT 1`);
      console.log('✅ average_cost column already exists');
    } catch (e) {
      console.log('📊 Adding average_cost column to trade_cycles...');
      db.run(`ALTER TABLE trade_cycles ADD COLUMN average_cost TEXT DEFAULT '0'`);
    }
    
    // Check if we need to add unrealized_pl column
    try {
      db.exec(`SELECT unrealized_pl FROM trade_cycles LIMIT 1`);
      console.log('✅ unrealized_pl column already exists');
    } catch (e) {
      console.log('📊 Adding unrealized_pl column to trade_cycles...');
      db.run(`ALTER TABLE trade_cycles ADD COLUMN unrealized_pl TEXT DEFAULT '0'`);
    }
    
    // Save database
    const data = db.export();
    const buffer = Buffer.from(data);
    await fs.writeFile(dbPath, buffer);
    
    console.log('✅ Migration completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

migrate();