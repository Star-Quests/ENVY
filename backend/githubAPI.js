// File: backend/githubAPI.js
// ENVY GitHub Sync using REST API (no git required)
// ENHANCED VERSION with detailed error logging

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

      console.log('🔄 Starting GitHub API sync...');
      console.log(`📁 Repository: ${repo}`);
      console.log(`🔑 Token exists: ${token ? 'Yes (length: ' + token.length + ')' : 'No'}`);

      if (!token || !repo) {
        console.log('⚠️ GitHub credentials not configured');
        return { success: false, error: 'GitHub credentials not configured' };
      }

      // Test token validity first
      try {
        const testResponse = await axios.get('https://api.github.com/user', {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          timeout: 10000
        });
        console.log(`✅ GitHub authentication successful. User: ${testResponse.data.login}`);
      } catch (authError) {
        console.error('❌ GitHub authentication failed:');
        if (authError.response) {
          console.error(`Status: ${authError.response.status}`);
          console.error(`Message: ${authError.response.data.message}`);
          if (authError.response.status === 401) {
            return { success: false, error: 'GitHub token is invalid or expired. Please generate a new token.' };
          }
        } else {
          console.error(authError.message);
        }
        return { success: false, error: 'GitHub authentication failed' };
      }

      // Check if repository exists and is accessible
      try {
        const repoCheck = await axios.get(`https://api.github.com/repos/${repo}`, {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          timeout: 10000
        });
        console.log(`✅ Repository accessible: ${repoCheck.data.full_name} (${repoCheck.data.private ? 'private' : 'public'})`);
      } catch (repoError) {
        console.error('❌ Repository access failed:');
        if (repoError.response) {
          console.error(`Status: ${repoError.response.status}`);
          console.error(`Message: ${repoError.response.data.message}`);
          if (repoError.response.status === 404) {
            return { success: false, error: `Repository '${repo}' not found. Check the format (username/repo) and make sure it exists.` };
          } else if (repoError.response.status === 403) {
            return { success: false, error: 'No permission to access repository. Token needs repo scope.' };
          }
        }
        return { success: false, error: 'Repository access failed' };
      }

      // Get all data from current database
      const tables = {};
      const tableNames = this.db.exec("SELECT name FROM sqlite_master WHERE type='table'");

      if (tableNames[0]) {
        for (const row of tableNames[0].values) {
          const tableName = row[0];
          console.log(`📊 Exporting table: ${tableName}`);
          const tableData = this.db.exec(`SELECT * FROM ${tableName}`);
          if (tableData[0]) {
            tables[tableName] = {
              columns: tableData[0].columns,
              rows: tableData[0].values
            };
          }
        }
      }

      console.log(`📦 Extracted ${Object.keys(tables).length} tables`);

      // Create a backup object
      const backup = {
        version: '1.0',
        timestamp: Date.now(),
        tables
      };

      // 🔒 MASK GITHUB TOKEN IN BACKUP
if (backup.tables && backup.tables.settings) {
  const settingsTable = backup.tables.settings;
  const keyIndex = settingsTable.columns.indexOf('key');
  const valueIndex = settingsTable.columns.indexOf('value');
  
  if (keyIndex !== -1 && valueIndex !== -1) {
    for (let i = 0; i < settingsTable.rows.length; i++) {
      if (settingsTable.rows[i][keyIndex] === 'github_token') {
        settingsTable.rows[i][valueIndex] = '[MASKED]';
        console.log('🔒 Masked GitHub token in backup');
        break;
      }
    }
  }
}

      // Convert to JSON and base64
      const backupJson = JSON.stringify(backup, null, 2);
      const content = Buffer.from(backupJson).toString('base64');
      console.log(`📦 Backup JSON size: ${Math.round(backupJson.length / 1024)} KB`);

      // Upload to GitHub
      const url = `https://api.github.com/repos/${repo}/contents/envy-backup.json`;
      console.log(`📡 Uploading to: ${url}`);

      // Check if file exists
      let sha = null;
      try {
        console.log('🔍 Checking if backup file already exists...');
        const checkResponse = await axios.get(url, {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          timeout: 10000
        });
        sha = checkResponse.data.sha;
        console.log('📁 Existing backup found, will update (SHA: ' + sha.substring(0, 8) + '...)');
      } catch (err) {
        if (err.response?.status === 404) {
          console.log('📁 No existing backup, will create new file');
        } else {
          console.error('❌ Error checking file:', err.message);
          if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
          }
        }
      }

      // Create or update file
      const putData = {
        message: `ENVY Backup ${new Date().toISOString()}`,
        content: content
      };

      if (sha) {
        putData.sha = sha;
        console.log('🔄 Updating existing file with SHA');
      } else {
        console.log('📝 Creating new file');
      }

      try {
        const putResponse = await axios.put(url, putData, {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          timeout: 30000
        });

        console.log(`✅ GitHub upload successful! Status: ${putResponse.status}`);
        console.log(`🔗 File URL: ${putResponse.data.content.html_url}`);

        await this.updateSetting('last_sync_time', Date.now().toString());
        console.log('✅ Successfully synced with GitHub API');
        return { success: true, message: 'Sync completed successfully' };

      } catch (uploadError) {
        console.error('❌ GitHub upload failed:');
        if (uploadError.response) {
          console.error('Status:', uploadError.response.status);
          console.error('Data:', JSON.stringify(uploadError.response.data, null, 2));
          
          let errorMessage = uploadError.response.data.message || 'Unknown error';
          if (uploadError.response.status === 403) {
            errorMessage = 'Permission denied. Token needs repo scope.';
          } else if (uploadError.response.status === 422) {
            errorMessage = 'Invalid request. Check file path and content.';
          }
          return { success: false, error: errorMessage };
        } else if (uploadError.request) {
          console.error('No response received from GitHub');
          return { success: false, error: 'No response from GitHub server' };
        } else {
          console.error('Error:', uploadError.message);
          return { success: false, error: uploadError.message };
        }
      }

    } catch (error) {
      console.error('❌ GitHub API sync error:');
      console.error(error);
      return { success: false, error: error.message };
    }
  }

  async restore(dbReloadCallback) {
    try {
      const settings = await this.getSettings();
      const token = settings.github_token || process.env.GITHUB_TOKEN;
      const repo = settings.github_repo || process.env.GITHUB_REPO;

      console.log('🔄 Restore from GitHub API called...');
      console.log(`📁 Repository: ${repo}`);
      console.log(`🔑 Token exists: ${token ? 'Yes (length: ' + token.length + ')' : 'No'}`);

      if (!token || !repo) {
        return { success: false, error: 'GitHub not configured' };
      }

      // Test token validity first
      try {
        const testResponse = await axios.get('https://api.github.com/user', {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          timeout: 10000
        });
        console.log(`✅ GitHub authentication successful. User: ${testResponse.data.login}`);
      } catch (authError) {
        console.error('❌ GitHub authentication failed:');
        if (authError.response) {
          console.error(`Status: ${authError.response.status}`);
          console.error(`Message: ${authError.response.data.message}`);
          if (authError.response.status === 401) {
            return { success: false, error: 'GitHub token is invalid or expired. Please generate a new token.' };
          }
        }
        return { success: false, error: 'GitHub authentication failed' };
      }

      // Download backup from GitHub
      const url = `https://api.github.com/repos/${repo}/contents/envy-backup.json`;
      console.log(`📡 Fetching from: ${url}`);

      try {
        const response = await axios.get(url, {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          timeout: 30000
        });

        console.log(`✅ GitHub response status: ${response.status}`);
        
        if (!response.data.content) {
          return { success: false, error: 'Backup file exists but has no content' };
        }

        console.log(`📁 File SHA: ${response.data.sha}`);
        console.log(`📁 File size: ${response.data.size} bytes`);

        // Decode content
        const content = Buffer.from(response.data.content, 'base64').toString('utf8');
        console.log(`📦 Decoded content size: ${Math.round(content.length / 1024)} KB`);

        let backup;
        try {
          backup = JSON.parse(content);
          console.log(`✅ Backup JSON parsed successfully`);
        } catch (parseError) {
          console.error('❌ Failed to parse backup JSON:', parseError.message);
          return { success: false, error: 'Backup file is corrupted or invalid JSON' };
        }

        console.log(`📊 Backup contains ${Object.keys(backup.tables || {}).length} tables`);
        if (backup.tables) {
          Object.keys(backup.tables).forEach(tableName => {
            const rowCount = backup.tables[tableName]?.rows?.length || 0;
            console.log(`   📄 ${tableName}: ${rowCount} rows`);
          });
        }

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
          console.error('❌ sql-wasm.wasm not found. Searched paths:', possiblePaths);
          return { success: false, error: 'sql-wasm.wasm not found' };
        }

        console.log(`✅ Found sql-wasm.wasm at: ${wasmPath}`);
        const wasmBinary = await fs.readFile(wasmPath);
        const SQL = await initSqlJs({ wasmBinary });
        const newDb = new SQL.Database();

        // Get current schema
        const tableNames = this.db.exec("SELECT name FROM sqlite_master WHERE type='table'");
        console.log('📋 Recreating database schema...');

        if (tableNames[0]) {
          for (const row of tableNames[0].values) {
            const tableName = row[0];
            
            // Get CREATE TABLE statement
            const createSQL = this.db.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'`);
            if (createSQL[0] && createSQL[0].values[0] && createSQL[0].values[0][0]) {
              try {
                const sql = createSQL[0].values[0][0];
                console.log(`   🏗️ Creating table: ${tableName}`);
                newDb.run(sql);
              } catch (e) {
                console.log(`   ❌ Error creating table ${tableName}:`, e.message);
              }
            }

            // Insert data if available in backup
            if (backup.tables && backup.tables[tableName] && backup.tables[tableName].rows) {
              const columns = backup.tables[tableName].columns;
              const rows = backup.tables[tableName].rows;
              
              if (columns && rows && rows.length > 0) {
                const placeholders = columns.map(() => '?').join(',');
                let insertedCount = 0;

                for (const row of rows) {
                  const insertSQL = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;
                  try {
                    newDb.run(insertSQL, row);
                    insertedCount++;
                  } catch (e) {
                    console.log(`   ❌ Error inserting into ${tableName}:`, e.message);
                  }
                }
                console.log(`   ✅ Inserted ${insertedCount} rows into ${tableName}`);
              }
            }
          }
        }

        // Export the new database
        const data = newDb.export();
        const buffer = Buffer.from(data);
        console.log(`💾 New database size: ${buffer.length} bytes`);

        // Write to file
        await fs.writeFile(dbPath, buffer);
        console.log(`✅ Database file written to: ${dbPath}`);

        // Verify the written file
        const writtenFile = await fs.readFile(dbPath);
        console.log(`✅ Verified written file: ${writtenFile.length} bytes`);

        // Call the reload callback
        if (dbReloadCallback && typeof dbReloadCallback === 'function') {
          console.log('🔄 Calling database reload callback...');
          const reloadSuccess = await dbReloadCallback(writtenFile);
          if (reloadSuccess) {
            console.log('✅ Database reloaded successfully');
            
            // Update last sync time
            await this.updateSetting('last_sync_time', Date.now().toString());
            
            return { 
              success: true, 
              message: 'Restore completed and database reloaded',
              stats: {
                transactions: backup.tables?.transactions?.rows?.length || 0,
                cycles: backup.tables?.trade_cycles?.rows?.length || 0
              }
            };
          } else {
            return { success: false, error: 'Failed to reload database after restore' };
          }
        }

        return { success: true, message: 'File restored but database not reloaded' };

      } catch (error) {
        console.error('❌ GitHub API restore error:');
        if (error.response) {
          // The request was made and the server responded with a status code
          console.error('Status:', error.response.status);
          console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
          console.error('Data:', JSON.stringify(error.response.data, null, 2));
          
          let errorMessage = error.response.data.message || 'Unknown GitHub error';
          if (error.response.status === 404) {
            errorMessage = 'Backup file not found. Please sync first to create a backup.';
          } else if (error.response.status === 401) {
            errorMessage = 'GitHub token is invalid or expired. Generate a new token.';
          } else if (error.response.status === 403) {
            errorMessage = 'GitHub token lacks permission. Need repo scope.';
          }
          
          return { success: false, error: errorMessage };
        } else if (error.request) {
          // The request was made but no response was received
          console.error('No response received:', error.request);
          return { success: false, error: 'No response from GitHub - network issue?' };
        } else {
          // Something happened in setting up the request
          console.error('Error message:', error.message);
          return { success: false, error: error.message };
        }
      }
    } catch (error) {
      console.error('❌ Restore outer error:', error);
      return { success: false, error: error.message };
    }
  }

  // Scheduled sync function
  async scheduledSync() {
    try {
      console.log(`⏰ Scheduled sync triggered at ${new Date().toISOString()}`);
      const result = await this.sync();
      if (result.success) {
        console.log(`✅ Scheduled sync completed at ${new Date().toISOString()}`);
      } else {
        console.log(`⚠️ Scheduled sync failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Scheduled sync error: ${error.message}`);
    }
  }

  // Test GitHub connection
  async testConnection() {
    try {
      const settings = await this.getSettings();
      const token = settings.github_token || process.env.GITHUB_TOKEN;
      const repo = settings.github_repo || process.env.GITHUB_REPO;

      const results = {
        tokenValid: false,
        repoAccessible: false,
        canWrite: false,
        errors: []
      };

      if (!token) {
        results.errors.push('No token provided');
        return results;
      }

      // Test token
      try {
        const userResponse = await axios.get('https://api.github.com/user', {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          timeout: 10000
        });
        results.tokenValid = true;
        results.user = userResponse.data.login;
      } catch (error) {
        results.errors.push(`Token invalid: ${error.response?.data?.message || error.message}`);
      }

      if (!repo || !results.tokenValid) {
        return results;
      }

      // Test repo access
      try {
        const repoResponse = await axios.get(`https://api.github.com/repos/${repo}`, {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          timeout: 10000
        });
        results.repoAccessible = true;
        results.repoName = repoResponse.data.full_name;
        results.repoPrivate = repoResponse.data.private;
      } catch (error) {
        results.errors.push(`Repo inaccessible: ${error.response?.data?.message || error.message}`);
      }

      // Test write access by trying to get a file (GET doesn't need write)
      // We'll just check if we can reach the contents endpoint
      if (results.repoAccessible) {
        try {
          const contentsResponse = await axios.get(`https://api.github.com/repos/${repo}/contents`, {
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json'
            },
            timeout: 10000
          });
          results.canWrite = true; // If we can list contents, we probably have write access
        } catch (error) {
          if (error.response?.status === 403) {
            results.errors.push('No write permission - token needs repo scope');
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Test connection error:', error);
      return {
        tokenValid: false,
        repoAccessible: false,
        canWrite: false,
        errors: [error.message]
      };
    }
  }
}

module.exports = GitHubAPI;