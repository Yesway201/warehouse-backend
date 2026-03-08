import express from 'express';
import { query, getClient } from '../db.js';

const router = express.Router();

console.log('[SessionRoutes] mounted');

// Helper: convert frontend session object to DB row
function sessionToRow(session) {
  return {
    id: session.id,
    customer_name: session.customerName || null,
    customer_id: session.customerId || null,
    container_number: session.containerNumber || null,
    po_number: session.poNumber || null,
    status: session.status || 'pending-review',
    type: session.type || null,
    started_by: session.startedBy || session.receivedBy || null,
    started_at: session.startedAt || null,
    completed_at: session.completedAt || null,
    reference_number: session.referenceNumber || null,
    review_notes: session.reviewNotes || session.notes || null,
    items: JSON.stringify(session.items || []),
    photos: JSON.stringify(session.photos || []),
    metadata: JSON.stringify({
      asnId: session.asnId,
      deliveryId: session.deliveryId,
      ...(session.metadata || {}),
    }),
  };
}

// Helper: convert DB row to frontend session object
function rowToSession(row) {
  const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
  return {
    id: row.id,
    customerName: row.customer_name,
    customerId: row.customer_id,
    containerNumber: row.container_number,
    poNumber: row.po_number,
    status: row.status,
    type: row.type,
    startedBy: row.started_by,
    receivedBy: row.started_by,
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    referenceNumber: row.reference_number,
    reviewNotes: row.review_notes,
    notes: row.review_notes,
    items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []),
    photos: typeof row.photos === 'string' ? JSON.parse(row.photos) : (row.photos || []),
    asnId: metadata.asnId || '',
    deliveryId: metadata.deliveryId || '',
    ...metadata,
  };
}

// GET /api/sessions - List all sessions (with optional filters)
router.get('/', async (req, res) => {
  console.log('[Sessions] GET /');
  try {
    const { status, customer_id, limit = 200 } = req.query;

    let sql = 'SELECT * FROM sessions_v2';
    const params = [];
    const conditions = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (customer_id) {
      params.push(customer_id);
      conditions.push(`customer_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY started_at DESC';
    params.push(parseInt(limit, 10));
    sql += ` LIMIT $${params.length}`;

    const result = await query(sql, params);
    const sessions = result.rows.map(rowToSession);

    console.log(`[Sessions] GET / - Returned ${sessions.length} sessions`);
    res.json({ success: true, sessions });
  } catch (error) {
    console.error('[Sessions] GET / error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/sessions/bulk - Bulk upsert sessions (for initial migration from localStorage)
// NOTE: Must be before /:id route to avoid "bulk" being treated as an id
router.post('/bulk', async (req, res) => {
  console.log('[Sessions] POST /bulk');
  try {
    const { sessions } = req.body;
    if (!Array.isArray(sessions)) {
      return res.status(400).json({ success: false, error: 'sessions must be an array' });
    }

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const session of sessions) {
      try {
        const row = sessionToRow(session);
        const result = await query(
          `INSERT INTO sessions_v2 (id, customer_name, customer_id, container_number, po_number, status, type, started_by, started_at, completed_at, reference_number, review_notes, items, photos, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO UPDATE SET
             customer_name = EXCLUDED.customer_name,
             customer_id = EXCLUDED.customer_id,
             container_number = EXCLUDED.container_number,
             po_number = EXCLUDED.po_number,
             status = EXCLUDED.status,
             type = EXCLUDED.type,
             started_by = EXCLUDED.started_by,
             started_at = EXCLUDED.started_at,
             completed_at = EXCLUDED.completed_at,
             reference_number = EXCLUDED.reference_number,
             review_notes = EXCLUDED.review_notes,
             items = EXCLUDED.items,
             photos = EXCLUDED.photos,
             metadata = EXCLUDED.metadata
           RETURNING (xmax = 0) AS is_insert`,
          [
            row.id, row.customer_name, row.customer_id, row.container_number,
            row.po_number, row.status, row.type, row.started_by,
            row.started_at, row.completed_at, row.reference_number, row.review_notes,
            row.items, row.photos, row.metadata,
          ]
        );

        if (result.rows[0].is_insert) {
          created++;
        } else {
          updated++;
        }
      } catch (err) {
        console.error(`[Sessions] Bulk upsert error for session ${session.id}:`, err.message);
        errors++;
      }
    }

    console.log(`[Sessions] POST /bulk - Created: ${created}, Updated: ${updated}, Errors: ${errors}`);
    res.json({ success: true, created, updated, errors, total: sessions.length });
  } catch (error) {
    console.error('[Sessions] POST /bulk error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/sessions/:id - Get a single session
router.get('/:id', async (req, res) => {
  console.log('[Sessions] GET /', req.params.id);
  try {
    const result = await query('SELECT * FROM sessions_v2 WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    res.json({ success: true, session: rowToSession(result.rows[0]) });
  } catch (error) {
    console.error('[Sessions] GET /:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/sessions - Create a new session
router.post('/', async (req, res) => {
  console.log('[Sessions] POST / - Creating session:', req.body.id);
  try {
    const row = sessionToRow(req.body);

    const result = await query(
      `INSERT INTO sessions_v2 (id, customer_name, customer_id, container_number, po_number, status, type, started_by, started_at, completed_at, reference_number, review_notes, items, photos, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (id) DO UPDATE SET
         customer_name = EXCLUDED.customer_name,
         customer_id = EXCLUDED.customer_id,
         container_number = EXCLUDED.container_number,
         po_number = EXCLUDED.po_number,
         status = EXCLUDED.status,
         type = EXCLUDED.type,
         started_by = EXCLUDED.started_by,
         started_at = EXCLUDED.started_at,
         completed_at = EXCLUDED.completed_at,
         reference_number = EXCLUDED.reference_number,
         review_notes = EXCLUDED.review_notes,
         items = EXCLUDED.items,
         photos = EXCLUDED.photos,
         metadata = EXCLUDED.metadata
       RETURNING *`,
      [
        row.id, row.customer_name, row.customer_id, row.container_number,
        row.po_number, row.status, row.type, row.started_by,
        row.started_at, row.completed_at, row.reference_number, row.review_notes,
        row.items, row.photos, row.metadata,
      ]
    );

    const session = rowToSession(result.rows[0]);
    console.log(`[Sessions] POST / - Created/updated session: ${session.id}`);
    res.json({ success: true, session });
  } catch (error) {
    console.error('[Sessions] POST / error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/sessions/:id - Update a session
router.put('/:id', async (req, res) => {
  console.log('[Sessions] PUT /', req.params.id);
  try {
    // First check if session exists
    const existing = await query('SELECT * FROM sessions_v2 WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Merge existing with updates
    const existingSession = rowToSession(existing.rows[0]);
    const merged = { ...existingSession, ...req.body };
    const row = sessionToRow(merged);

    const result = await query(
      `UPDATE sessions_v2 SET
         customer_name = $2, customer_id = $3, container_number = $4,
         po_number = $5, status = $6, type = $7, started_by = $8,
         started_at = $9, completed_at = $10, reference_number = $11,
         review_notes = $12, items = $13, photos = $14, metadata = $15
       WHERE id = $1
       RETURNING *`,
      [
        req.params.id, row.customer_name, row.customer_id, row.container_number,
        row.po_number, row.status, row.type, row.started_by,
        row.started_at, row.completed_at, row.reference_number, row.review_notes,
        row.items, row.photos, row.metadata,
      ]
    );

    const session = rowToSession(result.rows[0]);
    console.log(`[Sessions] PUT /${req.params.id} - Updated session`);
    res.json({ success: true, session });
  } catch (error) {
    console.error('[Sessions] PUT /:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/sessions/:id - Delete a session
router.delete('/:id', async (req, res) => {
  console.log('[Sessions] DELETE /', req.params.id);
  try {
    const result = await query('DELETE FROM sessions_v2 WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    console.log(`[Sessions] DELETE /${req.params.id} - Deleted session`);
    res.json({ success: true, deleted: req.params.id });
  } catch (error) {
    console.error('[Sessions] DELETE /:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;