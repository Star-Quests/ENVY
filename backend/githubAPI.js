// File: backend/githubAPI.js
// ENVY GitHub Sync using REST API (no git required)

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const initSqlJs = require('sql.js');

class GitHubAPI {
  constructor(db) {
    this.db = db;
    this.baseUrl = 'https://api.github.com';
  }

  async getSettings() {
    const result = this.db.exec(`SELECT key, value FROM settings`);
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
    return settings;
  }

  async updateSetting(key, value) {
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    this.db.run(`
      UPDATE settings SET value = ?, updated_at = ? WHERE key = ?
    `, [valueStr, Date.now(), key]);
  }

  async sync() {
  try {
    const settings = await this.getSettings();
    const token = settings.github_token || process.env.GITHUB_TOKEN;
    const repo = settings.github_repo || process.env.GITHUB_REPO;

    if (!token || !repo) {
      console.log('⚠️ GitHub credentials not configured');
      return false;
    }

    console.log('🔄 Starting GitHub API sync...');

    // Get all data from current database
    const tables = {};
    const tableNames = this.db.exec("SELECT name FROM sqlite_master WHERE type='table'");

    if (tableNames[0]) {
      for (const row of tableNames[0].values) {
        const tableName = row[0];
        const tableData = this.db.exec(`SELECT * FROM ${tableName}`);
        if (tableData[0]) {
          tables[tableName] = {
            columns: tableData[0].columns,
            rows: tableData[0].values
          };
        }
      }
    }

    console.log(`📊 Extracted ${Object.keys(tables).length} tables`);

    // Create a backup object
    const backup = {
      version: '1.0',
      timestamp: Date.now(),
      tables
    };

    // Convert to JSON and base64
    const backupJson = JSON.stringify(backup, null, 2);
    const content = Buffer.from(backupJson).toString('base64');

    // Upload to GitHub
    const url = `https://api.github.com/repos/${repo}/contents/envy-backup.json`;

    // Check if file exists
    let sha = null;
    try {
      const checkResponse = await axios.get(url, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 10000
      });
      sha = checkResponse.data.sha;
      console.log('📁 Existing backup found, will update');
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error('❌ Error checking file:', err.message);
      }
      console.log('📁 No existing backup, will create new');
    }

    // Create or update file
    const putData = {
      message: `ENVY Backup ${new Date().toISOString()}`,
      content: content
    };

    if (sha) {
      putData.sha = sha;
    }

    await axios.put(url, putData, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 30000
    });

    await this.updateSetting('last_sync_time', Date.now().toString());
    console.log('✅ Successfully synced with GitHub API');
    return true;

  } catch (error) {
    console.error('❌ GitHub API sync error:', error.response?.data || error.message);
    return false;
  }
}

  async restore(dbReloadCallback) {
  try {
    const settings = await this.getSettings();
    const token = settings.github_token || process.env.GITHUB_TOKEN;
    const repo = settings.github_repo || process.env.GITHUB_REPO;

    if (!token || !repo) {
      return { success: false, error: 'GitHub not configured' };
    }

    console.log('🔄 Restoring from GitHub API...');

    // Download backup from GitHub
    const url = `https://api.github.com/repos/${repo}/contents/envy-backup.json`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 30000
    });

    if (!response.data.content) {
      return { success: false, error: 'No backup found' };
    }

    // Decode content
    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    const backup = JSON.parse(content);

    console.log(`📊 Backup contains ${Object.keys(backup.tables).length} tables`);

    // Get database path
    const dbPath = path.join(__dirname, 'database/envy.db');
    await fs.ensureDir(path.dirname(dbPath));

    // Initialize SQL.js for new database
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
      return { success: false, error: 'sql-wasm.wasm not found' };
    }

    const wasmBinary = await fs.readFile(wasmPath);
    const SQL = await initSqlJs({ wasmBinary });
    const newDb = new SQL.Database();

    // Recreate schema and insert data
    const tableNames = this.db.exec("SELECT name FROM sqlite_master WHERE type='table'");

    if (tableNames[0]) {
      for (const row of tableNames[0].values) {
        const tableName = row[0];
        
        // Get CREATE TABLE statement
        const createSQL = this.db.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'`);
        if (createSQL[0]) {
          try {
            newDb.run(createSQL[0].values[0][0]);
          } catch (e) {
            console.log(`  ❌ Error creating table ${tableName}:`, e.message);
          }
        }

        // Insert data if available in backup
        if (backup.tables[tableName] && backup.tables[tableName].rows) {
          const columns = backup.tables[tableName].columns;
          const placeholders = columns.map(() => '?').join(',');

          for (const row of backup.tables[tableName].rows) {
            const insertSQL = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;
            try {
              newDb.run(insertSQL, row);
            } catch (e) {
              console.log(`  ❌ Error inserting into ${tableName}:`, e.message);
            }
          }
        }
      }
    }

    // Export the new database
    const data = newDb.export();
    const buffer = Buffer.from(data);

    // Write to file
    await fs.writeFile(dbPath, buffer);
    console.log(`✅ Database file written: ${buffer.length} bytes`);

    // Call the reload callback
    if (dbReloadCallback && typeof dbReloadCallback === 'function') {
      const reloadSuccess = await dbReloadCallback(buffer);
      if (reloadSuccess) {
        console.log('✅ Database reloaded successfully');
        return { success: true, message: 'Restore completed and database reloaded' };
      } else {
        return { success: false, error: 'Failed to reload database' };
      }
    }

    return { success: true, message: 'File restored but database not reloaded' };

  } catch (error) {
    console.error('❌ GitHub API restore error:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

  // Scheduled sync function
  async scheduledSync() {
    try {
      const result = await this.sync();
      if (result) {
        console.log(`✅ Scheduled sync completed at ${new Date().toISOString()}`);
      } else {
        console.log(`⚠️ Scheduled sync failed at ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.error(`❌ Scheduled sync error: ${error.message}`);
    }
  }
}

module.exports = GitHubAPI;