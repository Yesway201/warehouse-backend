import express from 'express';
import { sendPackingSlipRequest } from '../services/emailService.js';
import { pool } from '../db.js';

const router = express.Router();

/**
 * GET /api/deliveries/slip-requests/all
 * Get all slip requests (for dashboard/overview)
 * NOTE: This route MUST be defined before /:id routes to avoid "all" being captured as :id
 */
router.get('/slip-requests/all', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({
        success: false,
        error: 'Database not configured',
      });
    }

    const { status } = req.query;

    let queryText = `
      SELECT id, delivery_id, customer_emails, customer_name, container_number,
             requested_by, request_count, status, last_requested_at, created_at
      FROM slip_requests
    `;
    const params = [];

    if (status) {
      queryText += ' WHERE status = $1';
      params.push(status);
    }

    queryText += ' ORDER BY last_requested_at DESC';

    const result = await pool.query(queryText, params);

    return res.json({
      success: true,
      requests: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('[Deliveries API] ❌ Exception in all slip-requests endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * POST /api/deliveries/:id/request-slip
 * Send packing slip request email to ALL customer email addresses and track the request
 * 
 * Accepts either:
 *   - customerEmail (string) - single email (legacy support)
 *   - customerEmails (array of strings) - multiple emails
 * 
 * If neither is provided, it will look up the customer's emails from the database.
 */
router.post('/:id/request-slip', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customerEmail,   // Legacy: single email string
      customerEmails,  // New: array of email strings
      customerName,
      containerNumber,
      expectedDate,
      requestedBy,
      customerId,      // Optional: to look up emails from DB
    } = req.body;

    // Build the list of recipient emails
    let recipientEmails = [];

    // Priority 1: Use customerEmails array if provided
    if (Array.isArray(customerEmails) && customerEmails.length > 0) {
      recipientEmails = customerEmails.filter(e => e && typeof e === 'string' && e.trim());
    }
    // Priority 2: Use single customerEmail (legacy)
    else if (customerEmail && typeof customerEmail === 'string') {
      recipientEmails = [customerEmail.trim()];
    }

    // Priority 3: Look up emails from customer record in DB
    if (recipientEmails.length === 0 && customerId && process.env.DATABASE_URL) {
      try {
        const customerResult = await pool.query(
          'SELECT emails FROM customers WHERE id = $1 OR threel_id = $2',
          [isNaN(customerId) ? null : parseInt(customerId), customerId]
        );
        if (customerResult.rows.length > 0 && customerResult.rows[0].emails) {
          const dbEmails = customerResult.rows[0].emails;
          if (Array.isArray(dbEmails)) {
            recipientEmails = dbEmails.filter(e => e && typeof e === 'string' && e.trim());
          }
        }
        console.log(`[Deliveries API] Looked up ${recipientEmails.length} email(s) from customer DB for customerId: ${customerId}`);
      } catch (lookupErr) {
        console.error('[Deliveries API] ⚠️ Customer email lookup failed:', lookupErr.message);
      }
    }

    console.log('[Deliveries API] Packing slip request received:', {
      deliveryId: id,
      recipientEmails,
      customerName,
      containerNumber,
    });

    // Validate we have at least one email
    if (recipientEmails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No email addresses provided. Send customerEmails (array), customerEmail (string), or customerId to look up emails.',
      });
    }

    // Validate required fields
    if (!customerName || !containerNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: customerName or containerNumber',
      });
    }

    // Validate all email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipientEmails.filter(e => !emailRegex.test(e));
    if (invalidEmails.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid email address format: ${invalidEmails.join(', ')}`,
      });
    }

    // Check if RESEND_API_KEY is configured
    if (!process.env.RESEND_API_KEY) {
      console.error('[Deliveries API] ❌ RESEND_API_KEY not configured');
      return res.status(500).json({
        success: false,
        error: 'Email service not configured. Please set RESEND_API_KEY environment variable.',
      });
    }

    // Check if there's an existing slip request for this delivery and track it
    let requestCount = 0;
    let isFollowUp = false;

    if (process.env.DATABASE_URL) {
      try {
        const existingRequest = await pool.query(
          'SELECT id, request_count FROM slip_requests WHERE delivery_id = $1',
          [id]
        );

        if (existingRequest.rows.length > 0) {
          // Update existing record - increment count and update emails
          const existing = existingRequest.rows[0];
          requestCount = existing.request_count + 1;
          isFollowUp = true;

          await pool.query(
            `UPDATE slip_requests 
             SET request_count = $1, 
                 last_requested_at = CURRENT_TIMESTAMP, 
                 requested_by = COALESCE($2, requested_by),
                 customer_emails = $3::jsonb
             WHERE id = $4`,
            [requestCount, requestedBy, JSON.stringify(recipientEmails), existing.id]
          );

          console.log(`[Deliveries API] 📧 Follow-up request #${requestCount} for delivery ${id} to ${recipientEmails.length} recipient(s)`);
        } else {
          // Insert new record
          requestCount = 1;
          isFollowUp = false;

          await pool.query(
            `INSERT INTO slip_requests (delivery_id, customer_emails, customer_name, container_number, requested_by, request_count)
             VALUES ($1, $2::jsonb, $3, $4, $5, 1)`,
            [id, JSON.stringify(recipientEmails), customerName, containerNumber, requestedBy]
          );

          console.log(`[Deliveries API] 📧 First request for delivery ${id} to ${recipientEmails.length} recipient(s)`);
        }
      } catch (dbError) {
        // Log but don't fail - email sending is more important
        console.error('[Deliveries API] ⚠️ Database tracking error (non-fatal):', dbError.message);
      }
    } else {
      console.log('[Deliveries API] ⚠️ DATABASE_URL not set, skipping request tracking');
    }

    // Send email to ALL recipient emails
    const result = await sendPackingSlipRequest({
      to: recipientEmails,  // Now sends array of all emails
      deliveryNumber: containerNumber,
      expectedDate: expectedDate || 'TBD',
      customerName: customerName,
      isFollowUp: isFollowUp,
    });

    console.log(`[Deliveries API] ✅ Packing slip request email sent to ${recipientEmails.length} recipient(s)`);
    return res.json({
      success: true,
      message: isFollowUp
        ? `Follow-up packing slip request #${requestCount} sent to ${recipientEmails.length} recipient(s)`
        : `Packing slip request sent to ${recipientEmails.length} recipient(s)`,
      emailId: result.id,
      requestCount: requestCount,
      isFollowUp: isFollowUp,
      sentTo: recipientEmails,
    });
  } catch (error) {
    console.error('[Deliveries API] ❌ Exception in request-slip endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/deliveries/:id/slip-requests
 * Get slip request history for a delivery
 */
router.get('/:id/slip-requests', async (req, res) => {
  try {
    const { id } = req.params;

    if (!process.env.DATABASE_URL) {
      return res.status(503).json({
        success: false,
        error: 'Database not configured',
      });
    }

    const result = await pool.query(
      `SELECT id, delivery_id, customer_emails, customer_name, container_number,
              requested_by, request_count, status, last_requested_at, created_at
       FROM slip_requests
       WHERE delivery_id = $1
       ORDER BY last_requested_at DESC`,
      [id]
    );

    return res.json({
      success: true,
      deliveryId: id,
      requests: result.rows,
      totalRequests: result.rows.reduce((sum, r) => sum + r.request_count, 0),
    });
  } catch (error) {
    console.error('[Deliveries API] ❌ Exception in slip-requests endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * PATCH /api/deliveries/:id/slip-requests/:requestId/status
 * Update the status of a slip request (e.g., mark as received)
 */
router.patch('/:id/slip-requests/:requestId/status', async (req, res) => {
  try {
    const { id, requestId } = req.params;
    const { status } = req.body;

    if (!process.env.DATABASE_URL) {
      return res.status(503).json({
        success: false,
        error: 'Database not configured',
      });
    }

    const validStatuses = ['pending', 'received', 'overdue'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const result = await pool.query(
      `UPDATE slip_requests SET status = $1 WHERE id = $2 AND delivery_id = $3 RETURNING *`,
      [status, requestId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Slip request not found',
      });
    }

    console.log(`[Deliveries API] ✅ Slip request ${requestId} status updated to: ${status}`);
    return res.json({
      success: true,
      message: `Slip request status updated to ${status}`,
      request: result.rows[0],
    });
  } catch (error) {
    console.error('[Deliveries API] ❌ Exception in update status endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

export default router;