import express from 'express';
import { query } from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// POST /api/migrate/run - Run pending migrations (ONE-TIME USE)
router.post('/run', async (req, res) => {
  try {
    console.log('[Migration] Starting database migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/002_add_delivery_id_to_asns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('[Migration] Executing SQL:', migrationSQL);
    
    // Execute the migration
    await query(migrationSQL);
    
    console.log('[Migration] ✅ Migration completed successfully');
    
    // Update existing ASN with delivery_id if needed
    const updateResult = await query(`
      UPDATE asns 
      SET delivery_id = '6165079197945732'
      WHERE id = 8 AND delivery_id IS NULL
      RETURNING *
    `);
    
    if (updateResult.rows.length > 0) {
      console.log('[Migration] ✅ Updated existing ASN with delivery_id:', updateResult.rows[0]);
    }
    
    res.json({ 
      success: true, 
      message: 'Migration completed successfully',
      updatedASNs: updateResult.rows
    });
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Migration failed', 
      message: error.message,
      details: error.stack
    });
  }
});

/**
 * POST /api/migrate/run-sql
 * Run arbitrary SQL for ad-hoc migrations (use with caution)
 * Body: { sql: "ALTER TABLE ..." }
 */
router.post('/run-sql', async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) {
      return res.status(400).json({ success: false, error: 'Missing sql in request body' });
    }
    
    console.log('[Migration] Running ad-hoc SQL:', sql.substring(0, 200));
    const result = await query(sql);
    
    console.log('[Migration] ✅ SQL executed successfully, rows affected:', result.rowCount);
    
    res.json({
      success: true,
      message: 'SQL executed successfully',
      rowCount: result.rowCount,
      rows: result.rows || []
    });
  } catch (error) {
    console.error('[Migration] ❌ SQL execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'SQL execution failed',
      message: error.message,
      details: error.stack
    });
  }
});

/**
 * POST /api/migrate/set-extensiv-ids
 * Batch set extensiv_customer_id for customers
 * Body: { mappings: [{ thirdPartyLogisticsId: "102", extensivCustomerId: 102 }, ...] }
 * 
 * If no mappings provided, auto-sets extensiv_customer_id = threel_id for all customers
 * where extensiv_customer_id is NULL and threel_id is a valid integer
 */
router.post('/set-extensiv-ids', async (req, res) => {
  try {
    const { mappings } = req.body;
    const results = [];
    
    if (mappings && Array.isArray(mappings) && mappings.length > 0) {
      // Manual mappings provided
      for (const mapping of mappings) {
        try {
          const result = await query(
            `UPDATE customers 
             SET extensiv_customer_id = $1, updated_at = CURRENT_TIMESTAMP
             WHERE threel_id = $2
             RETURNING id, name, threel_id, extensiv_customer_id`,
            [parseInt(mapping.extensivCustomerId), String(mapping.thirdPartyLogisticsId)]
          );
          
          if (result.rows.length > 0) {
            results.push({ ...result.rows[0], status: 'updated' });
          } else {
            results.push({ threel_id: mapping.thirdPartyLogisticsId, status: 'not_found' });
          }
        } catch (err) {
          results.push({ threel_id: mapping.thirdPartyLogisticsId, status: 'error', error: err.message });
        }
      }
    } else {
      // Auto-set: use threel_id as extensiv_customer_id where it's a valid integer
      const autoResult = await query(
        `UPDATE customers 
         SET extensiv_customer_id = threel_id::INTEGER, updated_at = CURRENT_TIMESTAMP
         WHERE extensiv_customer_id IS NULL 
           AND threel_id ~ '^[0-9]+$'
         RETURNING id, name, threel_id, extensiv_customer_id`
      );
      
      for (const row of autoResult.rows) {
        results.push({ ...row, status: 'auto_set' });
      }
    }
    
    console.log(`[Migration] ✅ Set extensiv_customer_id for ${results.length} customers`);
    
    res.json({
      success: true,
      message: `Updated ${results.filter(r => r.status !== 'error' && r.status !== 'not_found').length} customers`,
      results
    });
  } catch (error) {
    console.error('[Migration] ❌ Failed to set extensiv IDs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set extensiv customer IDs',
      message: error.message
    });
  }
});

// GET /api/migrate/status - Check if migration is needed
router.get('/status', async (req, res) => {
  try {
    // Check if delivery_id column exists
    const result = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'asns' AND column_name = 'delivery_id'
    `);
    
    // Check if extensiv_customer_id column exists
    const extensivIdResult = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customers' AND column_name = 'extensiv_customer_id'
    `);
    
    const deliveryIdMigrationNeeded = result.rows.length === 0;
    const extensivIdMigrationNeeded = extensivIdResult.rows.length === 0;
    
    // Get customers with/without extensiv_customer_id
    let customerStats = null;
    if (!extensivIdMigrationNeeded) {
      const statsResult = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(extensiv_customer_id) as with_extensiv_id,
          COUNT(*) - COUNT(extensiv_customer_id) as without_extensiv_id
        FROM customers
      `);
      customerStats = statsResult.rows[0];
    }
    
    res.json({
      deliveryIdMigrationNeeded,
      extensivIdMigrationNeeded,
      customerStats,
      message: [
        deliveryIdMigrationNeeded ? 'Migration needed: delivery_id column' : 'delivery_id column exists',
        extensivIdMigrationNeeded ? 'Migration needed: extensiv_customer_id column' : 'extensiv_customer_id column exists',
      ].join(' | ')
    });
  } catch (error) {
    console.error('[Migration] Error checking status:', error);
    res.status(500).json({ 
      error: 'Failed to check migration status', 
      message: error.message 
    });
  }
});

export default router;