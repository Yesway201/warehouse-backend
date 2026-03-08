import express from 'express';
import { query, getClient } from '../db.js';

const router = express.Router();

// Helper function to fetch ASN items
async function fetchASNItems(asnId) {
  const result = await query(
    `SELECT 
      id, asn_id, item_number, description, expected_qty, uom,
      cases_per_pallet, cases_per_row, rows_high,
      created_at, updated_at
    FROM asn_items
    WHERE asn_id = $1
    ORDER BY id ASC`,
    [asnId]
  );
  return result.rows;
}

// Helper function to format ASN with items
function formatASNWithItems(asnRow, items) {
  return {
    id: asnRow.id,
    asn_number: asnRow.asn_number,
    delivery_id: asnRow.delivery_id,
    expected_date: asnRow.expected_date,
    status: asnRow.status,
    created_at: asnRow.created_at,
    updated_at: asnRow.updated_at,
    customer_id: asnRow.customer_id,
    customer_name: asnRow.customer_name,
    threel_id: asnRow.threel_id,
    items: items.map(item => ({
      itemNumber: item.item_number,
      description: item.description,
      expectedQty: item.expected_qty,
      uom: item.uom,
      palletConfig: {
        casesPerPallet: item.cases_per_pallet || 0,
        casesPerRow: item.cases_per_row || 0,
        rowsHigh: item.rows_high || 0
      }
    }))
  };
}

// GET /api/asns - Get all ASNs with customer information and items
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        a.id, a.asn_number, a.delivery_id, a.expected_date, a.status, 
        a.created_at, a.updated_at,
        c.id as customer_id, c.name as customer_name, c.threel_id
      FROM asns a
      LEFT JOIN customers c ON a.customer_id = c.id
      ORDER BY a.created_at DESC`
    );
    
    // Fetch items for each ASN
    const asnsWithItems = await Promise.all(
      result.rows.map(async (asn) => {
        const items = await fetchASNItems(asn.id);
        return formatASNWithItems(asn, items);
      })
    );
    
    res.json(asnsWithItems);
  } catch (error) {
    console.error('Error fetching ASNs:', error);
    res.status(500).json({ error: 'Failed to fetch ASNs', message: error.message });
  }
});

// GET /api/asns/:id - Get single ASN by ID with customer information and items
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT 
        a.id, a.asn_number, a.delivery_id, a.expected_date, a.status, 
        a.created_at, a.updated_at,
        c.id as customer_id, c.name as customer_name, c.threel_id
      FROM asns a
      LEFT JOIN customers c ON a.customer_id = c.id
      WHERE a.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ASN not found' });
    }
    
    const items = await fetchASNItems(id);
    const asnWithItems = formatASNWithItems(result.rows[0], items);
    
    res.json(asnWithItems);
  } catch (error) {
    console.error('Error fetching ASN:', error);
    res.status(500).json({ error: 'Failed to fetch ASN', message: error.message });
  }
});

// POST /api/asns - Create new ASN with items
router.post('/', async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const {
      asn_number,
      customer_id,
      delivery_id,
      expected_date,
      status,
      items
    } = req.body;

    // Validate required fields
    if (!asn_number) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'ASN number is required' });
    }
    if (!customer_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    // CRITICAL FIX: Convert customer_id to integer
    const customer_id_int = parseInt(customer_id, 10);
    
    if (isNaN(customer_id_int)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Customer ID must be a valid number' });
    }

    console.log('[ASN API] Creating ASN with customer_id:', customer_id_int);
    console.log('[ASN API] delivery_id:', delivery_id);
    console.log('[ASN API] items count:', items?.length || 0);

    // Verify customer exists
    const customerCheck = await client.query(
      `SELECT id FROM customers WHERE id = $1`,
      [customer_id_int]
    );
    
    if (customerCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Insert ASN header
    const asnResult = await client.query(
      `INSERT INTO asns (asn_number, customer_id, delivery_id, expected_date, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        asn_number,
        customer_id_int,
        delivery_id || null,
        expected_date || null,
        status || 'pending'
      ]
    );

    const asnId = asnResult.rows[0].id;
    console.log('[ASN API] ✅ ASN header created with ID:', asnId);

    // Insert ASN items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      console.log('[ASN API] 📦 Inserting', items.length, 'items...');
      
      for (const item of items) {
        await client.query(
          `INSERT INTO asn_items (
            asn_id, item_number, description, expected_qty, uom,
            cases_per_pallet, cases_per_row, rows_high
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            asnId,
            item.itemNumber || item.item_number,
            item.description || '',
            item.expectedQty || item.expected_qty || 1,
            item.uom || 'EA',
            item.palletConfig?.casesPerPallet || item.cases_per_pallet || 0,
            item.palletConfig?.casesPerRow || item.cases_per_row || 0,
            item.palletConfig?.rowsHigh || item.rows_high || 0
          ]
        );
      }
      
      console.log('[ASN API] ✅ All items inserted successfully');
    }

    await client.query('COMMIT');

    // Fetch the complete ASN with customer info and items
    const completeAsn = await query(
      `SELECT 
        a.id, a.asn_number, a.delivery_id, a.expected_date, a.status, 
        a.created_at, a.updated_at,
        c.id as customer_id, c.name as customer_name, c.threel_id
      FROM asns a
      LEFT JOIN customers c ON a.customer_id = c.id
      WHERE a.id = $1`,
      [asnId]
    );

    const asnItems = await fetchASNItems(asnId);
    const result = formatASNWithItems(completeAsn.rows[0], asnItems);

    console.log('[ASN API] ✅ ASN created successfully with', asnItems.length, 'items');
    res.status(201).json(result);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating ASN:', error);
    if (error.code === '23505') { // Unique violation
      res.status(409).json({ error: 'ASN number already exists' });
    } else if (error.code === '23503') { // Foreign key violation
      res.status(404).json({ error: 'Customer not found' });
    } else {
      res.status(500).json({ error: 'Failed to create ASN', message: error.message });
    }
  } finally {
    client.release();
  }
});

// PUT /api/asns/:id - Update ASN with items
router.put('/:id', async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const {
      asn_number,
      customer_id,
      delivery_id,
      expected_date,
      status,
      items
    } = req.body;

    // CRITICAL FIX: Convert customer_id to integer if provided
    let customer_id_int = customer_id;
    if (customer_id !== undefined && customer_id !== null) {
      customer_id_int = parseInt(customer_id, 10);
      
      if (isNaN(customer_id_int)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Customer ID must be a valid number' });
      }

      // Verify customer exists
      const customerCheck = await client.query(
        `SELECT id FROM customers WHERE id = $1`,
        [customer_id_int]
      );
      
      if (customerCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Customer not found' });
      }
    }

    // Update ASN header
    const asnResult = await client.query(
      `UPDATE asns SET
        asn_number = COALESCE($1, asn_number),
        customer_id = COALESCE($2, customer_id),
        delivery_id = COALESCE($3, delivery_id),
        expected_date = COALESCE($4, expected_date),
        status = COALESCE($5, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *`,
      [asn_number, customer_id_int, delivery_id, expected_date, status, id]
    );

    if (asnResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'ASN not found' });
    }

    // Update items if provided
    if (items && Array.isArray(items)) {
      console.log('[ASN API] 🔄 Updating items for ASN:', id);
      
      // Delete existing items
      await client.query(`DELETE FROM asn_items WHERE asn_id = $1`, [id]);
      console.log('[ASN API] 🗑️ Deleted old items');
      
      // Insert new items
      if (items.length > 0) {
        for (const item of items) {
          await client.query(
            `INSERT INTO asn_items (
              asn_id, item_number, description, expected_qty, uom,
              cases_per_pallet, cases_per_row, rows_high
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              id,
              item.itemNumber || item.item_number,
              item.description || '',
              item.expectedQty || item.expected_qty || 1,
              item.uom || 'EA',
              item.palletConfig?.casesPerPallet || item.cases_per_pallet || 0,
              item.palletConfig?.casesPerRow || item.cases_per_row || 0,
              item.palletConfig?.rowsHigh || item.rows_high || 0
            ]
          );
        }
        console.log('[ASN API] ✅ Inserted', items.length, 'new items');
      }
    }

    await client.query('COMMIT');

    // Fetch the complete ASN with customer info and items
    const completeAsn = await query(
      `SELECT 
        a.id, a.asn_number, a.delivery_id, a.expected_date, a.status, 
        a.created_at, a.updated_at,
        c.id as customer_id, c.name as customer_name, c.threel_id
      FROM asns a
      LEFT JOIN customers c ON a.customer_id = c.id
      WHERE a.id = $1`,
      [id]
    );

    const asnItems = await fetchASNItems(id);
    const result = formatASNWithItems(completeAsn.rows[0], asnItems);

    console.log('[ASN API] ✅ ASN updated successfully with', asnItems.length, 'items');
    res.json(result);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating ASN:', error);
    if (error.code === '23505') { // Unique violation
      res.status(409).json({ error: 'ASN number already exists' });
    } else if (error.code === '23503') { // Foreign key violation
      res.status(404).json({ error: 'Customer not found' });
    } else {
      res.status(500).json({ error: 'Failed to update ASN', message: error.message });
    }
  } finally {
    client.release();
  }
});

// PATCH /api/asns/:id/status - Update ASN status only
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status', 
        validStatuses 
      });
    }

    const result = await query(
      `UPDATE asns SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ASN not found' });
    }

    // Fetch the complete ASN with customer info and items
    const completeAsn = await query(
      `SELECT 
        a.id, a.asn_number, a.delivery_id, a.expected_date, a.status, 
        a.created_at, a.updated_at,
        c.id as customer_id, c.name as customer_name, c.threel_id
      FROM asns a
      LEFT JOIN customers c ON a.customer_id = c.id
      WHERE a.id = $1`,
      [id]
    );

    const items = await fetchASNItems(id);
    const asnWithItems = formatASNWithItems(completeAsn.rows[0], items);

    res.json(asnWithItems);
  } catch (error) {
    console.error('Error updating ASN status:', error);
    res.status(500).json({ error: 'Failed to update ASN status', message: error.message });
  }
});

// DELETE /api/asns/:id - Delete ASN (items will cascade delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Items will be automatically deleted due to ON DELETE CASCADE
    const result = await query(
      `DELETE FROM asns WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ASN not found' });
    }

    console.log('[ASN API] ✅ ASN and associated items deleted successfully');
    res.json({ message: 'ASN deleted successfully', asn: result.rows[0] });
  } catch (error) {
    console.error('Error deleting ASN:', error);
    res.status(500).json({ error: 'Failed to delete ASN', message: error.message });
  }
});

export default router;