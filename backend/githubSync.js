// File: backend/githubSync.js
// ENVY GitHub Sync Module - FIXED RESTORE

const simpleGit = require('simple-git');
const fs = require('fs-extra');
const path = require('path');

class GitHubSync {
  constructor(db, ledger) {
    this.db = db;
    this.ledger = ledger;
    this.git = simpleGit({
      baseDir: path.join(__dirname, '..'),
      binary: 'git',
      maxConcurrentProcesses: 1
    });
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
  
  async initRepository(token, repo) {
    const repoPath = path.join(__dirname, '..');
    const gitPath = path.join(repoPath, '.git');
    
    // Check if git is initialized
    if (!await fs.pathExists(gitPath)) {
      console.log('📁 Initializing git repository...');
      await this.git.init();
    }
    
    // Configure git user
    await this.git.addConfig('user.name', 'ENVY Backup');
    await this.git.addConfig('user.email', 'envy@localhost');
    
    // Check if remote exists
    const remotes = await this.git.getRemotes();
    const hasOrigin = remotes.some(r => r.name === 'origin');
    
    const remoteUrl = `https://${token}@github.com/${repo}.git`;
    
    if (!hasOrigin) {
      await this.git.addRemote('origin', remoteUrl);
    } else {
      await this.git.removeRemote('origin');
      await this.git.addRemote('origin', remoteUrl);
    }
    
    // Create initial commit if needed
    const status = await this.git.status();
    if (!status.current) {
      // Create README if doesn't exist
      const readmePath = path.join(repoPath, 'README.md');
      if (!await fs.pathExists(readmePath)) {
        await fs.writeFile(readmePath, '# ENVY Trading Journal\nAutomatic backup repository');
      }
      
      await this.git.add('.');
      await this.git.commit('Initial ENVY backup setup');
    }
    
    // Ensure main branch exists
    try {
      await this.git.branch(['-M', 'main']);
    } catch (e) {
      // Branch may already exist
    }
    
    return true;
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
      
      console.log('🔄 Starting GitHub sync...');
      
      // Initialize repository
      await this.initRepository(token, repo);
      
      // Get all data from current database
      const tables = {};
      const tableNames = this.db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      
      if (tableNames[0]) {
        for (const row of tableNames[0].values) {
          const tableName = row[0];
          const tableData = this.db.exec(`SELECT * FROM ${tableName}`);
          tables[tableName] = tableData;
        }
      }
      
      console.log(`📊 Extracted ${Object.keys(tables).length} tables`);
      
      // Create a new database with the extracted data
      const initSqlJs = require('sql.js');
      const SQL = await initSqlJs();
      const newDb = new SQL.Database();
      
      // Recreate schema and insert data
      for (const [tableName, tableData] of Object.entries(tables)) {
        if (tableData[0]) {
          // Create table
          const createSQL = this.db.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'`);
          if (createSQL[0]) {
            try {
              newDb.run(createSQL[0].values[0][0]);
            } catch (e) {
              console.log(`  ❌ Error creating table ${tableName}:`, e.message);
            }
          }
          
          // Insert data
          if (tableData[0].values.length > 0) {
            const columns = tableData[0].columns;
            const placeholders = columns.map(() => '?').join(',');
            
            for (const row of tableData[0].values) {
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
      const dbPath = path.join(__dirname, 'database/envy.db');
      await fs.writeFile(dbPath, buffer);
      console.log(`✅ Database file written: ${buffer.length} bytes`);
      
      // Now add the file to git
      await this.git.add('./backend/database/envy.db');
      
      // Check if there are changes
      const status = await this.git.status();
      if (status.files.length === 0) {
        console.log('📊 No changes to sync');
        await this.updateSetting('last_sync_time', Date.now().toString());
        return true;
      }
      
      // Commit
      const commitMessage = `ENVY Backup ${new Date().toISOString()}`;
      await this.git.commit(commitMessage);
      
      // Push to main branch
      console.log('📤 Pushing to GitHub...');
      await this.git.push('origin', 'main', ['--force']);
      
      await this.updateSetting('last_sync_time', Date.now().toString());
      
      console.log('✅ Successfully synced with GitHub');
      return true;
      
    } catch (error) {
      console.error('❌ GitHub sync error:', error.message);
      return false;
    }
  }
  
  async restore(dbReloadCallback) {
    try {
      const settings = await this.getSettings();
      const token = settings.github_token || process.env.GITHUB_TOKEN;
      const repo = settings.github_repo || process.env.GITHUB_REPO;
      
      if (!token || !repo) {
        console.log('⚠️ GitHub credentials not configured');
        return { success: false, error: 'GitHub not configured' };
      }
      
      console.log('🔄 Restoring from GitHub...');

      const repoPath = path.join(__dirname, '..');
      const gitPath = path.join(repoPath, '.git');
      const dbPath = path.join(__dirname, 'database/envy.db');
      
      console.log(`📁 Local database path: ${dbPath}`);
      
      if (!await fs.pathExists(gitPath)) {
        console.log('📁 Initializing git repository...');
        await this.git.init();
      }
      
      const remoteUrl = `https://${token}@github.com/${repo}.git`;
      
      const remotes = await this.git.getRemotes();
      const hasOrigin = remotes.some(r => r.name === 'origin');
      
      if (!hasOrigin) {
        await this.git.addRemote('origin', remoteUrl);
        console.log('✅ Added remote origin');
      } else {
        await this.git.removeRemote('origin');
        await this.git.addRemote('origin', remoteUrl);
        console.log('✅ Updated remote origin');
      }
      
      // Fetch from remote
      console.log('📡 Fetching from GitHub...');
      await this.git.fetch('origin', 'main');
      
      // Check if the file exists in the fetched data
      try {
        const showResult = await this.git.show(['origin/main:backend/database/envy.db']);
        console.log(`✅ File found in GitHub, size: ${showResult.length} bytes`);
      } catch (e) {
        console.log('❌ File not found in GitHub:', e.message);
        return { success: false, error: 'No backup found in GitHub' };
      }
      
      // Reset to remote state
      console.log('🔄 Resetting local files to match GitHub...');
      await this.git.reset(['--hard', 'origin/main']);
      
      // Check if the database file now exists locally
      if (await fs.pathExists(dbPath)) {
        const stats = await fs.stat(dbPath);
        console.log(`✅ Database file restored to: ${dbPath}`);
        console.log(`📊 Restored file size: ${stats.size} bytes`);
        
        // Read the restored database file
        const dbFile = await fs.readFile(dbPath);
        console.log(`📊 Read restored file: ${dbFile.length} bytes`);
        
        // Call the reload callback with the new database data
        if (dbReloadCallback && typeof dbReloadCallback === 'function') {
          const reloadSuccess = await dbReloadCallback(dbFile);
          if (reloadSuccess) {
            console.log('✅ Database reloaded successfully');
            return { success: true, message: 'Restore completed and database reloaded' };
          } else {
            console.log('❌ Failed to reload database');
            return { success: false, error: 'Failed to reload database' };
          }
        } else {
          console.log('⚠️ No reload callback provided');
          return { success: true, message: 'File restored but database not reloaded' };
        }
      } else {
        console.log('❌ Database file was not restored to the expected path');
        return { success: false, error: 'Restore failed - file not found' };
      }
      
    } catch (error) {
      console.error('❌ GitHub restore error:', error.message);
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

module.exports = GitHubSync;