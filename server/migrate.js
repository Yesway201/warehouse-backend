import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create migrations table if it doesn't exist
async function createMigrationsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await pool.query(query);
  console.log('✅ Migrations table ready');
}

// Get list of executed migrations
async function getExecutedMigrations() {
  const result = await pool.query('SELECT name FROM migrations ORDER BY id');
  return result.rows.map(row => row.name);
}

// Run a single migration
async function runMigration(filename) {
  const migrationPath = path.join(__dirname, 'migrations', filename);
  const sql = await fs.readFile(migrationPath, 'utf8');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Execute the migration SQL
    await client.query(sql);
    
    // Record the migration
    await client.query('INSERT INTO migrations (name) VALUES ($1)', [filename]);
    
    await client.query('COMMIT');
    console.log(`✅ Migration ${filename} completed successfully`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Migration ${filename} failed:`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Run all pending migrations
async function runMigrations() {
  try {
    await createMigrationsTable();
    
    const executedMigrations = await getExecutedMigrations();
    const migrationFiles = await fs.readdir(path.join(__dirname, 'migrations'));
    
    // Filter for .sql files only and sort them
    const sqlFiles = migrationFiles
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    const pendingMigrations = sqlFiles.filter(
      file => !executedMigrations.includes(file)
    );
    
    if (pendingMigrations.length === 0) {
      console.log('✅ All migrations are up to date');
      return;
    }
    
    console.log(`📦 Running ${pendingMigrations.length} pending migration(s)...`);
    
    for (const migration of pendingMigrations) {
      await runMigration(migration);
    }
    
    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration process failed:', error);
    throw error;
  }
}

// Rollback the last migration
async function rollbackLastMigration() {
  try {
    const result = await pool.query(
      'SELECT name FROM migrations ORDER BY id DESC LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      console.log('ℹ️  No migrations to rollback');
      return;
    }
    
    const lastMigration = result.rows[0].name;
    const rollbackFile = lastMigration.replace('.sql', '_rollback.sql');
    const rollbackPath = path.join(__dirname, 'migrations', rollbackFile);
    
    try {
      const sql = await fs.readFile(rollbackPath, 'utf8');
      
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('DELETE FROM migrations WHERE name = $1', [lastMigration]);
        await client.query('COMMIT');
        console.log(`✅ Rolled back migration: ${lastMigration}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.error(`❌ Rollback file not found: ${rollbackFile}`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}

// CLI interface
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  
  (async () => {
    try {
      if (command === 'up') {
        await runMigrations();
      } else if (command === 'down') {
        await rollbackLastMigration();
      } else {
        console.log('Usage: node migrate.js [up|down]');
        console.log('  up   - Run all pending migrations');
        console.log('  down - Rollback the last migration');
      }
      process.exit(0);
    } catch (error) {
      console.error('Migration error:', error);
      process.exit(1);
    }
  })();
}

export { runMigrations, rollbackLastMigration };