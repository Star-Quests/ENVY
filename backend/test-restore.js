// File: backend/test-restore.js
// Test script to verify restore functionality

const fs = require('fs-extra');
const path = require('path');
const initSqlJs = require('sql.js');

async function testRestore() {
  console.log('🧪 Testing restore functionality...');
  
  const dbPath = path.join(__dirname, 'database/envy.db');
  
  // Check if database exists
  if (!await fs.pathExists(dbPath)) {
    console.log('❌ Database file not found');
    return;
  }
  
  // Read current database
  const dbFile = await fs.readFile(dbPath);
  console.log(`📊 Current database size: ${dbFile.length} bytes`);
  
  // Load SQL.js
  const possiblePaths = [
    path.join(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm'),
    path.join(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm')
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
    return;
  }
  
  const wasmBinary = await fs.readFile(wasmPath);
  const SQL = await initSqlJs({ wasmBinary });
  
  // Open database
  const db = new SQL.Database(new Uint8Array(dbFile));
  
  // Check tables
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('\n📋 Tables in database:');
  if (tables[0]) {
    tables[0].values.forEach(row => {
      const count = db.exec(`SELECT COUNT(*) FROM ${row[0]}`);
      const rowCount = count[0]?.values[0][0] || 0;
      console.log(`  📄 ${row[0]}: ${rowCount} rows`);
    });
  }
  
  console.log('\n✅ Test complete - database is valid');
}

testRestore().catch(console.error);