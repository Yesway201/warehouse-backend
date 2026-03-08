import express from 'express';
import { query, getClient } from '../db.js';
import { loadCustomers, saveCustomers } from '../lib/settingsStore.js';

const router = express.Router();

console.log('[CustomerRoutes] mounted');

/**
 * GET /api/customers
 * Load all customers from PostgreSQL database
 */
router.get('/', async (req, res) => {
  console.log('[Customers] GET /');
  try {
    const result = await query(
      `SELECT id, name, threel_id, emails, reference_prefix, reference_counter, extensiv_customer_id, created_at, updated_at 
       FROM customers 
       ORDER BY name ASC`
    );
    
    const customers = result.rows.map(row => ({
      id: row.id.toString(), // Convert INTEGER to STRING for frontend
      name: row.name,
      thirdPartyLogisticsId: row.threel_id,
      emails: row.emails || [], // Parse JSONB array
      referencePrefix: row.reference_prefix || '',
      referenceCounter: row.reference_counter || 0,
      extensivCustomerId: row.extensiv_customer_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    console.log(`[Customers] Loaded ${customers.length} customers from database`);
    
    return res.json({
      success: true,
      customers,
      count: customers.length
    });
  } catch (error) {
    console.error('[Customers] Failed to load customers:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load customers from database',
      details: error.message
    });
  }
});

/**
 * POST /api/customers/sync
 * Sync customers from frontend to PostgreSQL database
 * Auto-creates or updates customers, returns database IDs
 */
router.post('/sync', async (req, res) => {
  console.log('[Customers] POST /sync');
  try {
    const { customers } = req.body;

    if (!Array.isArray(customers)) {
      return res.status(400).json({
        success: false,
        error: 'Customers must be an array'
      });
    }

    const syncedCustomers = [];
    const errors = [];

    for (const customer of customers) {
      try {
        // Validate required fields
        if (!customer.name || !customer.thirdPartyLogisticsId) {
          errors.push({
            customer: customer.name || 'Unknown',
            error: 'Missing required fields: name or thirdPartyLogisticsId'
          });
          continue;
        }

        // Prepare emails as JSONB
        const emails = Array.isArray(customer.emails) ? JSON.stringify(customer.emails) : '[]';
        const referencePrefix = customer.referencePrefix || null;
        const referenceCounter = customer.referenceCounter || 0;
        const extensivCustomerId = customer.extensivCustomerId || null;

        // UPSERT: Insert or update customer by threel_id (3PL ID)
        const result = await query(
          `INSERT INTO customers (name, threel_id, emails, reference_prefix, reference_counter, extensiv_customer_id, created_at, updated_at)
           VALUES ($1, $2, $3::jsonb, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (threel_id) 
           DO UPDATE SET 
             name = EXCLUDED.name,
             emails = EXCLUDED.emails,
             reference_prefix = EXCLUDED.reference_prefix,
             reference_counter = EXCLUDED.reference_counter,
             extensiv_customer_id = COALESCE(EXCLUDED.extensiv_customer_id, customers.extensiv_customer_id),
             updated_at = CURRENT_TIMESTAMP
           RETURNING id, name, threel_id, emails, reference_prefix, reference_counter, extensiv_customer_id, created_at, updated_at`,
          [customer.name, customer.thirdPartyLogisticsId, emails, referencePrefix, referenceCounter, extensivCustomerId]
        );

        const dbCustomer = result.rows[0];
        syncedCustomers.push({
          id: dbCustomer.id.toString(), // Convert INTEGER to STRING
          name: dbCustomer.name,
          thirdPartyLogisticsId: dbCustomer.threel_id,
          emails: dbCustomer.emails || [],
          referencePrefix: dbCustomer.reference_prefix || '',
          referenceCounter: dbCustomer.reference_counter || 0,
          extensivCustomerId: dbCustomer.extensiv_customer_id || null,
          createdAt: dbCustomer.created_at,
          updatedAt: dbCustomer.updated_at
        });

        console.log(`[Customers] Synced customer: ${dbCustomer.name} (DB ID: ${dbCustomer.id}, Emails: ${dbCustomer.emails?.length || 0})`);
      } catch (error) {
        console.error(`[Customers] Failed to sync customer ${customer.name}:`, error);
        errors.push({
          customer: customer.name,
          error: error.message
        });
      }
    }

    console.log(`[Customers] Sync complete: ${syncedCustomers.length} synced, ${errors.length} errors`);

    return res.json({
      success: true,
      customers: syncedCustomers,
      count: syncedCustomers.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[Customers] Failed to sync customers:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to sync customers',
      details: error.message
    });
  }
});

/**
 * GET /api/customers/:id/next-reference
 * Atomically increment the reference counter and return the next reference number.
 * Format: {prefix}{counter} (NO hyphen) e.g., "Asco1005"
 * 
 * Uses PostgreSQL transaction with row-level locking to prevent race conditions.
 * Also logs the reference in the reference_log table for audit trail.
 */
router.get('/:id/next-reference', async (req, res) => {
  const customerId = req.params.id;
  const sessionId = req.query.sessionId || null;
  
  console.log(`[Customers] GET /${customerId}/next-reference`);
  
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Atomically increment counter with row-level lock (SELECT ... FOR UPDATE)
    const result = await client.query(
      `UPDATE customers 
       SET reference_counter = reference_counter + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, reference_prefix, reference_counter`,
      [customerId]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: `Customer with ID ${customerId} not found`
      });
    }
    
    const customer = result.rows[0];
    const prefix = customer.reference_prefix || 'REF';
    const counter = customer.reference_counter;
    
    // Format: {prefix}{counter} - NO hyphen
    const referenceNumber = `${prefix}${counter}`;
    
    // Log the reference number for audit trail
    await client.query(
      `INSERT INTO reference_log (customer_id, reference_number, counter_value, used_for, session_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [customerId, referenceNumber, counter, 'extensiv-receiver', sessionId]
    );
    
    await client.query('COMMIT');
    
    console.log(`[Customers] ✅ Generated reference: ${referenceNumber} for customer ${customer.name} (counter: ${counter})`);
    
    return res.json({
      success: true,
      referenceNumber,
      prefix,
      counter,
      customerName: customer.name,
      customerId: customer.id.toString()
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[Customers] ❌ Failed to generate reference for customer ${customerId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate reference number',
      details: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/customers/:id/preview-reference
 * Preview the next reference number WITHOUT incrementing the counter.
 * Useful for displaying in the UI before the user confirms.
 */
router.get('/:id/preview-reference', async (req, res) => {
  const customerId = req.params.id;
  
  console.log(`[Customers] GET /${customerId}/preview-reference`);
  
  try {
    const result = await query(
      `SELECT id, name, reference_prefix, reference_counter FROM customers WHERE id = $1`,
      [customerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Customer with ID ${customerId} not found`
      });
    }
    
    const customer = result.rows[0];
    const prefix = customer.reference_prefix || 'REF';
    const nextCounter = (customer.reference_counter || 0) + 1;
    
    // Format: {prefix}{counter} - NO hyphen
    const previewReference = `${prefix}${nextCounter}`;
    
    console.log(`[Customers] Preview reference: ${previewReference} for customer ${customer.name}`);
    
    return res.json({
      success: true,
      previewReference,
      prefix,
      currentCounter: customer.reference_counter || 0,
      nextCounter,
      customerName: customer.name,
      customerId: customer.id.toString()
    });
  } catch (error) {
    console.error(`[Customers] ❌ Failed to preview reference for customer ${customerId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to preview reference number',
      details: error.message
    });
  }
});

/**
 * POST /api/customers/:id/rollback-reference
 * Rollback the last reference number (decrement counter).
 * Used when an Extensiv submission fails and the reference should be freed.
 * 
 * Only rolls back if the current counter matches the expected value (optimistic lock).
 */
router.post('/:id/rollback-reference', async (req, res) => {
  const customerId = req.params.id;
  const { expectedCounter, referenceNumber } = req.body;
  
  console.log(`[Customers] POST /${customerId}/rollback-reference (expected: ${expectedCounter})`);
  
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Only decrement if the counter matches what we expect (optimistic lock)
    const result = await client.query(
      `UPDATE customers 
       SET reference_counter = reference_counter - 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND reference_counter = $2
       RETURNING id, name, reference_prefix, reference_counter`,
      [customerId, expectedCounter]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      console.log(`[Customers] ⚠️ Rollback skipped - counter mismatch or customer not found (expected: ${expectedCounter})`);
      return res.json({
        success: false,
        error: 'Counter mismatch - another reference may have been generated. Rollback skipped to prevent data corruption.',
        skipped: true
      });
    }
    
    // Mark the reference as rolled back in the log
    if (referenceNumber) {
      await client.query(
        `UPDATE reference_log 
         SET rolled_back = TRUE, rolled_back_at = CURRENT_TIMESTAMP
         WHERE customer_id = $1 AND reference_number = $2 AND rolled_back = FALSE
         ORDER BY created_at DESC
         LIMIT 1`,
        [customerId, referenceNumber]
      );
    }
    
    await client.query('COMMIT');
    
    const customer = result.rows[0];
    console.log(`[Customers] ✅ Rolled back reference for ${customer.name}. Counter now: ${customer.reference_counter}`);
    
    return res.json({
      success: true,
      message: `Reference rolled back. Counter now: ${customer.reference_counter}`,
      currentCounter: customer.reference_counter,
      customerName: customer.name
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[Customers] ❌ Failed to rollback reference for customer ${customerId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to rollback reference number',
      details: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/customers/:id/extensiv-id
 * Update the Extensiv customer ID for a specific customer
 */
router.patch('/:id/extensiv-id', async (req, res) => {
  const customerId = req.params.id;
  const { extensivCustomerId } = req.body;
  
  console.log(`[Customers] PATCH /${customerId}/extensiv-id -> ${extensivCustomerId}`);
  
  if (extensivCustomerId === undefined || extensivCustomerId === null) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: extensivCustomerId'
    });
  }
  
  try {
    const result = await query(
      `UPDATE customers 
       SET extensiv_customer_id = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, threel_id, extensiv_customer_id`,
      [customerId, parseInt(extensivCustomerId) || null]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Customer with ID ${customerId} not found`
      });
    }
    
    const customer = result.rows[0];
    console.log(`[Customers] ✅ Updated Extensiv customer ID for ${customer.name}: ${customer.extensiv_customer_id}`);
    
    return res.json({
      success: true,
      message: `Extensiv customer ID updated to ${customer.extensiv_customer_id}`,
      customer: {
        id: customer.id.toString(),
        name: customer.name,
        thirdPartyLogisticsId: customer.threel_id,
        extensivCustomerId: customer.extensiv_customer_id
      }
    });
  } catch (error) {
    console.error(`[Customers] ❌ Failed to update Extensiv customer ID:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update Extensiv customer ID',
      details: error.message
    });
  }
});

/**
 * POST /api/customers
 * Legacy endpoint - redirects to sync
 */
router.post('/', async (req, res) => {
  console.log('[Customers] POST / (legacy) - redirecting to /sync');
  req.url = '/sync';
  return router.handle(req, res);
});

/**
 * DELETE /api/customers
 * Clear all customers from database (dangerous!)
 */
router.delete('/', async (req, res) => {
  console.log('[Customers] DELETE /');
  try {
    const result = await query('DELETE FROM customers RETURNING *');

    console.log(`[Customers] Deleted ${result.rowCount} customers from database`);

    return res.json({
      success: true,
      message: `Deleted ${result.rowCount} customers successfully`,
      count: result.rowCount
    });
  } catch (error) {
    console.error('[Customers] Failed to delete customers:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete customers',
      details: error.message
    });
  }
});

export default router;