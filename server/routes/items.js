import express from 'express';
import { query } from '../db.js';

const router = express.Router();

console.log('[ItemRoutes] mounted');

/**
 * Helper: Resolve a customerId to the actual database customers.id
 * The frontend sends thirdPartyLogisticsId (stored as threel_id in customers table)
 * but the items table references customers.id (serial integer)
 */
async function resolveCustomerId(frontendCustomerId) {
  const idInt = parseInt(frontendCustomerId, 10);
  
  // First try to find by threel_id (thirdPartyLogisticsId from Extensiv)
  const byThreelId = await query(
    `SELECT id, threel_id FROM customers WHERE threel_id = $1`,
    [frontendCustomerId.toString()]
  );
  
  if (byThreelId.rows.length > 0) {
    console.log(`[Items] Resolved customerId: threel_id "${frontendCustomerId}" → db id ${byThreelId.rows[0].id}`);
    return { dbId: byThreelId.rows[0].id, threelId: byThreelId.rows[0].threel_id };
  }
  
  // Fallback: try as direct database id
  if (!isNaN(idInt)) {
    const byId = await query(
      `SELECT id, threel_id FROM customers WHERE id = $1`,
      [idInt]
    );
    if (byId.rows.length > 0) {
      console.log(`[Items] Resolved customerId: db id ${idInt} found directly`);
      return { dbId: byId.rows[0].id, threelId: byId.rows[0].threel_id };
    }
  }
  
  console.warn(`[Items] Could not resolve customerId: "${frontendCustomerId}"`);
  return null;
}

/**
 * Helper: Map a database row to the frontend Item shape
 * Returns threel_id as customerId so the frontend gets the thirdPartyLogisticsId
 */
function mapRowToItem(row, threelIdMap = {}) {
  // Use the threel_id if available in the map, otherwise fall back to customer_id
  const customerId = threelIdMap[row.customer_id] || row.customer_id.toString();
  return {
    id: row.id.toString(),
    itemNumber: row.sku,
    description: row.description || '',
    uom: row.uom || '',
    category: row.category || '',
    customerId: customerId,
    barcode: row.barcode || row.upc || '',
    extensivId: row.extensiv_id || '',
    isActive: row.is_active !== false,
    lastSyncedAt: row.last_synced_at || null,
    lastUpdated: row.updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Helper: Build a threel_id lookup map for a set of customer_ids
 */
async function buildThreelIdMap(customerIds) {
  if (customerIds.length === 0) return {};
  const uniqueIds = [...new Set(customerIds)];
  const result = await query(
    `SELECT id, threel_id FROM customers WHERE id = ANY($1)`,
    [uniqueIds]
  );
  const map = {};
  for (const row of result.rows) {
    map[row.id] = row.threel_id;
  }
  return map;
}

/**
 * GET /api/items
 * Load all items, optionally filtered by customerId query param
 * customerId can be either threel_id or database id
 */
router.get('/', async (req, res) => {
  const { customerId } = req.query;
  console.log('[Items] GET / customerId:', customerId || 'all');
  try {
    let result;
    if (customerId) {
      const resolved = await resolveCustomerId(customerId);
      if (!resolved) {
        return res.json({ success: true, items: [], count: 0 });
      }
      result = await query(
        `SELECT * FROM items WHERE customer_id = $1 ORDER BY sku ASC`,
        [resolved.dbId]
      );
    } else {
      result = await query(`SELECT * FROM items ORDER BY sku ASC`);
    }

    // Build threel_id map for all customer_ids in results
    const customerIds = result.rows.map(r => r.customer_id);
    const threelIdMap = await buildThreelIdMap(customerIds);

    const items = result.rows.map(row => mapRowToItem(row, threelIdMap));
    console.log(`[Items] Loaded ${items.length} items from database`);

    return res.json({
      success: true,
      items,
      count: items.length,
    });
  } catch (error) {
    console.error('[Items] Failed to load items:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load items from database',
      details: error.message,
    });
  }
});

/**
 * GET /api/items/sync-status/:customerId
 * Get sync status for a customer
 * NOTE: Must be defined BEFORE /:id to avoid Express matching "sync-status" as an :id param
 */
router.get('/sync-status/:customerId', async (req, res) => {
  const { customerId } = req.params;
  console.log('[Items] GET /sync-status/', customerId);
  try {
    const resolved = await resolveCustomerId(customerId);
    if (!resolved) {
      return res.json({ success: true, lastSync: null, itemsCount: 0 });
    }

    const result = await query(
      `SELECT COUNT(*) as count, MAX(last_synced_at) as last_sync
       FROM items
       WHERE customer_id = $1 AND is_active = true`,
      [resolved.dbId]
    );

    const row = result.rows[0];
    if (row && row.last_sync) {
      return res.json({
        success: true,
        lastSync: row.last_sync,
        itemsCount: parseInt(row.count, 10),
      });
    }

    return res.json({ success: true, lastSync: null, itemsCount: 0 });
  } catch (error) {
    console.error('[Items] Failed to get sync status:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/items/:id
 * Get a single item by database ID
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  console.log('[Items] GET /', id);
  try {
    const result = await query(`SELECT * FROM items WHERE id = $1`, [parseInt(id, 10)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    const threelIdMap = await buildThreelIdMap([result.rows[0].customer_id]);
    return res.json({ success: true, item: mapRowToItem(result.rows[0], threelIdMap) });
  } catch (error) {
    console.error('[Items] Failed to get item:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/items
 * Add a single item
 */
router.post('/', async (req, res) => {
  console.log('[Items] POST /');
  try {
    const { itemNumber, description, uom, category, customerId, barcode, extensivId } = req.body;

    if (!itemNumber || !customerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: itemNumber and customerId',
      });
    }

    const resolved = await resolveCustomerId(customerId);
    if (!resolved) {
      return res.status(400).json({
        success: false,
        error: `Customer not found for customerId: ${customerId}`,
      });
    }

    const result = await query(
      `INSERT INTO items (customer_id, sku, description, upc, uom, category, barcode, extensiv_id, is_active, last_synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, CURRENT_TIMESTAMP)
       ON CONFLICT (customer_id, sku)
       DO UPDATE SET
         description = EXCLUDED.description,
         upc = EXCLUDED.upc,
         uom = EXCLUDED.uom,
         category = EXCLUDED.category,
         barcode = EXCLUDED.barcode,
         extensiv_id = EXCLUDED.extensiv_id,
         last_synced_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        resolved.dbId,
        itemNumber,
        description || '',
        barcode || '',
        uom || '',
        category || '',
        barcode || '',
        extensivId || '',
      ]
    );

    const threelIdMap = { [resolved.dbId]: resolved.threelId };
    const item = mapRowToItem(result.rows[0], threelIdMap);
    console.log(`[Items] Added/updated item: ${item.itemNumber} for customer ${item.customerId}`);
    return res.json({ success: true, item });
  } catch (error) {
    console.error('[Items] Failed to add item:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/items/:itemNumber
 * Update an item by itemNumber + customerId (in body)
 */
router.put('/:itemNumber', async (req, res) => {
  const { itemNumber } = req.params;
  const { customerId, ...updates } = req.body;
  console.log('[Items] PUT /', itemNumber, 'customerId:', customerId);

  if (!customerId) {
    return res.status(400).json({ success: false, error: 'customerId is required' });
  }

  try {
    const resolved = await resolveCustomerId(customerId);
    if (!resolved) {
      return res.status(400).json({
        success: false,
        error: `Customer not found for customerId: ${customerId}`,
      });
    }

    // Build dynamic SET clause from provided fields
    const fieldMap = {
      description: 'description',
      uom: 'uom',
      category: 'category',
      barcode: 'barcode',
      extensivId: 'extensiv_id',
      isActive: 'is_active',
    };

    const setClauses = ['updated_at = CURRENT_TIMESTAMP'];
    const values = [];
    let paramIndex = 1;

    for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
      if (updates[jsKey] !== undefined) {
        setClauses.push(`${dbCol} = $${paramIndex}`);
        values.push(updates[jsKey]);
        paramIndex++;
      }
    }

    // Also update UPC if barcode is provided
    if (updates.barcode !== undefined) {
      setClauses.push(`upc = $${paramIndex}`);
      values.push(updates.barcode);
      paramIndex++;
    }

    values.push(resolved.dbId);
    values.push(itemNumber);

    const result = await query(
      `UPDATE items SET ${setClauses.join(', ')}
       WHERE customer_id = $${paramIndex - 1} AND sku = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    const threelIdMap = { [resolved.dbId]: resolved.threelId };
    return res.json({ success: true, item: mapRowToItem(result.rows[0], threelIdMap) });
  } catch (error) {
    console.error('[Items] Failed to update item:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/items/:itemNumber
 * Delete an item by itemNumber + customerId (query param)
 */
router.delete('/:itemNumber', async (req, res) => {
  const { itemNumber } = req.params;
  const { customerId } = req.query;
  console.log('[Items] DELETE /', itemNumber, 'customerId:', customerId);

  if (!customerId) {
    return res.status(400).json({ success: false, error: 'customerId query param is required' });
  }

  try {
    const resolved = await resolveCustomerId(customerId);
    if (!resolved) {
      return res.status(400).json({
        success: false,
        error: `Customer not found for customerId: ${customerId}`,
      });
    }

    const result = await query(
      `DELETE FROM items WHERE customer_id = $1 AND sku = $2 RETURNING *`,
      [resolved.dbId, itemNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    console.log(`[Items] Deleted item: ${itemNumber} for customer ${customerId}`);
    return res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    console.error('[Items] Failed to delete item:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/items/sync
 * Bulk sync items for a customer (from Extensiv)
 * Upserts all items and returns sync stats
 * customerId can be either threel_id (thirdPartyLogisticsId) or database id
 */
router.post('/sync', async (req, res) => {
  console.log('[Items] POST /sync');
  try {
    const { customerId, items } = req.body;

    if (!customerId || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'customerId and items array are required',
      });
    }

    const resolved = await resolveCustomerId(customerId);
    if (!resolved) {
      return res.status(400).json({
        success: false,
        error: `Customer not found for customerId: ${customerId}. Make sure the customer exists in the database.`,
      });
    }

    console.log(`[Items] Syncing ${items.length} items for customer threel_id="${customerId}" → db id=${resolved.dbId}`);

    let newItems = 0;
    let updatedItems = 0;
    const errors = [];

    for (const item of items) {
      try {
        // Check if item exists
        const existing = await query(
          `SELECT id FROM items WHERE customer_id = $1 AND sku = $2`,
          [resolved.dbId, item.itemNumber]
        );

        const result = await query(
          `INSERT INTO items (customer_id, sku, description, upc, uom, category, barcode, extensiv_id, is_active, last_synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, CURRENT_TIMESTAMP)
           ON CONFLICT (customer_id, sku)
           DO UPDATE SET
             description = EXCLUDED.description,
             upc = EXCLUDED.upc,
             uom = EXCLUDED.uom,
             category = EXCLUDED.category,
             barcode = EXCLUDED.barcode,
             extensiv_id = EXCLUDED.extensiv_id,
             is_active = true,
             last_synced_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [
            resolved.dbId,
            item.itemNumber,
            item.description || '',
            item.barcode || item.upc || '',
            item.uom || '',
            item.category || '',
            item.barcode || '',
            item.extensivId || '',
          ]
        );

        if (existing.rows.length > 0) {
          updatedItems++;
        } else {
          newItems++;
        }
      } catch (itemError) {
        console.error(`[Items] Failed to sync item ${item.itemNumber}:`, itemError.message);
        errors.push({ itemNumber: item.itemNumber, error: itemError.message });
      }
    }

    console.log(`[Items] Sync complete for customer ${customerId} (db id ${resolved.dbId}): ${newItems} new, ${updatedItems} updated, ${errors.length} errors`);

    return res.json({
      success: true,
      newItems,
      updatedItems,
      totalItems: newItems + updatedItems,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Items] Failed to sync items:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;