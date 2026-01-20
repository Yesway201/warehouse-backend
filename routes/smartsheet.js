// ⚠️ DO NOT MODIFY – Smartsheet stable working configuration
// This file is part of the STABLE BASELINE (smartsheet-stable-v1.0)
// Any changes may break the working Smartsheet integration
// See: server/SMARTSHEET_BASELINE.md for details

// Smartsheet API integration routes with server-side persistent storage
import express from 'express';
import fetch from 'node-fetch';
import { loadSettings, saveSettings, clearSettings, maskToken } from '../lib/settingsStore.js';

const router = express.Router();

// Boot log to confirm routes are loaded
console.log('[SmartsheetRoutes] mounted');

// API Version for tracking deployment
const API_VERSION = 'incoming-filter-v2-2026-01-20';
const BACKEND_COMMIT = process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown';

/**
 * Helper: Normalize and trim string values
 */
function normalizeString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Helper: Check if a value is blank (null, undefined, empty string, or whitespace)
 */
function isBlank(value) {
  const normalized = normalizeString(value);
  return normalized === '';
}

/**
 * GET /api/smartsheet/settings
 * Load Smartsheet settings from server-side storage
 * ⚠️ STABLE ENDPOINT - DO NOT MODIFY
 */
router.get('/settings', async (req, res) => {
  console.log('[Smartsheet] GET /settings');
  try {
    const settings = loadSettings();
    
    return res.json({
      success: true,
      settings: {
        apiTokenMasked: settings.apiToken ? maskToken(settings.apiToken) : null,
        sheetId: settings.sheetId,
        mappings: settings.mappings,
        lastUpdated: settings.lastUpdated,
        configured: !!(settings.apiToken && settings.sheetId)
      }
    });
  } catch (error) {
    console.error('[Smartsheet] Failed to load settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load settings from server',
      details: error.message
    });
  }
});

/**
 * POST /api/smartsheet/settings
 * Save Smartsheet settings to server-side storage
 * ⚠️ STABLE ENDPOINT - DO NOT MODIFY
 */
router.post('/settings', async (req, res) => {
  console.log('[Smartsheet] POST /settings');
  try {
    const { apiToken, sheetId, mappings } = req.body;

    if (!apiToken || !sheetId) {
      return res.status(400).json({
        success: false,
        error: 'API Token and Sheet ID are required'
      });
    }

    const saved = saveSettings({
      apiToken,
      sheetId,
      mappings: mappings || []
    });

    if (!saved) {
      return res.status(500).json({
        success: false,
        error: 'Failed to save settings to server storage'
      });
    }

    return res.json({
      success: true,
      message: 'Settings saved successfully',
      apiTokenMasked: maskToken(apiToken)
    });
  } catch (error) {
    console.error('[Smartsheet] Failed to save settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save settings',
      details: error.message
    });
  }
});

/**
 * DELETE /api/smartsheet/settings
 * Clear Smartsheet settings from server-side storage
 * ⚠️ STABLE ENDPOINT - DO NOT MODIFY
 */
router.delete('/settings', async (req, res) => {
  console.log('[Smartsheet] DELETE /settings');
  try {
    const cleared = clearSettings();

    if (!cleared) {
      return res.status(500).json({
        success: false,
        error: 'Failed to clear settings from server storage'
      });
    }

    return res.json({
      success: true,
      message: 'Settings cleared successfully'
    });
  } catch (error) {
    console.error('[Smartsheet] Failed to clear settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear settings',
      details: error.message
    });
  }
});

/**
 * POST /api/smartsheet/test-connection
 * Test Smartsheet connection using server-side stored credentials
 * ⚠️ STABLE ENDPOINT - DO NOT MODIFY
 */
router.post('/test-connection', async (req, res) => {
  console.log('[Smartsheet] POST /test-connection');
  try {
    // Load credentials from server-side storage
    const settings = loadSettings();

    if (!settings.apiToken || !settings.sheetId) {
      return res.json({
        success: false,
        error: 'Smartsheet credentials not configured on server',
        status: 'NOT_CONFIGURED'
      });
    }

    // Test connection by fetching sheet metadata
    const response = await fetch(`https://api.smartsheet.com/2.0/sheets/${settings.sheetId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${settings.apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.json({
        success: false,
        error: `Smartsheet API error: ${response.status} ${response.statusText}`,
        status: response.status,
        details: errorText
      });
    }

    const sheetData = await response.json();

    return res.json({
      success: true,
      message: `Connected to sheet: ${sheetData.name}`,
      sheetName: sheetData.name,
      rowCount: sheetData.totalRowCount || 0
    });
  } catch (error) {
    console.error('[Smartsheet] Test connection error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      status: 'SERVER_ERROR',
      details: String(error)
    });
  }
});

/**
 * GET /api/smartsheet/columns
 * Fetch all column names from the configured Smartsheet
 * ⚠️ STABLE ENDPOINT - DO NOT MODIFY
 */
router.get('/columns', async (req, res) => {
  console.log('[Smartsheet] GET /columns');
  try {
    // Load credentials from server-side storage
    const settings = loadSettings();

    if (!settings.apiToken || !settings.sheetId) {
      return res.json({
        success: false,
        error: 'Smartsheet credentials not configured on server',
        status: 'NOT_CONFIGURED'
      });
    }

    // Fetch sheet metadata to get columns
    const response = await fetch(`https://api.smartsheet.com/2.0/sheets/${settings.sheetId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${settings.apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.json({
        success: false,
        error: `Smartsheet API error: ${response.status} ${response.statusText}`,
        status: response.status,
        details: errorText
      });
    }

    const sheetData = await response.json();

    // Extract column names
    const columns = sheetData.columns.map(col => ({
      id: col.id,
      title: col.title,
      type: col.type,
      primary: col.primary || false
    }));

    return res.json({
      success: true,
      columns,
      sheetName: sheetData.name
    });
  } catch (error) {
    console.error('[Smartsheet] Get columns error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      status: 'SERVER_ERROR',
      details: String(error)
    });
  }
});

/**
 * POST /api/smartsheet/sync-deliveries
 * Sync deliveries from Smartsheet using server-side stored credentials
 * 
 * ═══════════════════════════════════════════════════════════════════════
 * API VERSION: incoming-filter-v2-2026-01-20
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * EXACT COLUMN TITLES (NO OLD MAPPINGS):
 * - Customer Name
 * - PO # / Container #
 * - Status
 * - Done
 * 
 * FILTERING RULES (ALL must be true to INCLUDE):
 * 1) Customer Name is NOT blank (trim whitespace)
 * 2) PO # / Container # is NOT blank (trim whitespace)
 * 3) Done is NOT checked
 * 4) Status: blank → "Expected" OR exactly one of: Arrived, Dropped, Unloaded, Checked In
 * 
 * FIELD MAPPING:
 * - "PO # / Container #" → poContainerNumber (primary)
 * - poNumber = poContainerNumber (legacy)
 * - containerNumber = poContainerNumber (legacy)
 * 
 * ═══════════════════════════════════════════════════════════════════════
 */
router.post('/sync-deliveries', async (req, res) => {
  console.log(`[Smartsheet] POST /sync-deliveries - API VERSION: ${API_VERSION}`);
  const syncTimestamp = new Date().toISOString();
  
  try {
    // Load credentials from server-side storage
    const settings = loadSettings();

    if (!settings.apiToken || !settings.sheetId) {
      return res.json({
        success: false,
        error: 'Smartsheet credentials not configured on server',
        apiVersion: API_VERSION,
        backendCommit: BACKEND_COMMIT
      });
    }

    // Fetch sheet data with all rows
    const response = await fetch(`https://api.smartsheet.com/2.0/sheets/${settings.sheetId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${settings.apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.json({
        success: false,
        error: `Smartsheet API error: ${response.status} ${response.statusText}`,
        apiVersion: API_VERSION,
        backendCommit: BACKEND_COMMIT,
        diagnostics: { rawResponse: errorText }
      });
    }

    const sheetData = await response.json();

    // ═══════════════════════════════════════════════════════════════════════
    // EXACT COLUMN TITLE MATCHING (NO OLD MAPPINGS)
    // ═══════════════════════════════════════════════════════════════════════
    const columnMap = {};
    sheetData.columns.forEach(col => {
      columnMap[col.title] = col.id;
    });

    const USING_COLUMNS = ['Customer Name', 'PO # / Container #', 'Status', 'Done'];
    
    const customerNameColumnId = columnMap['Customer Name'];
    const poContainerColumnId = columnMap['PO # / Container #'];
    const statusColumnId = columnMap['Status'];
    const doneColumnId = columnMap['Done'];

    console.log(`[Smartsheet] API Version: ${API_VERSION}`);
    console.log(`[Smartsheet] Backend Commit: ${BACKEND_COMMIT}`);
    console.log('[Smartsheet] Using EXACT Column Titles:');
    console.log(`  Customer Name: ${customerNameColumnId}`);
    console.log(`  PO # / Container #: ${poContainerColumnId}`);
    console.log(`  Status: ${statusColumnId}`);
    console.log(`  Done: ${doneColumnId}`);

    // ═══════════════════════════════════════════════════════════════════════
    // ALLOWED STATUS VALUES (EXACT MATCH AFTER TRIM)
    // ═══════════════════════════════════════════════════════════════════════
    const ALLOWED_STATUSES = ['Arrived', 'Dropped', 'Unloaded', 'Checked In'];
    console.log('[Smartsheet] Allowed Statuses:', ALLOWED_STATUSES);

    // Filtering counters
    let totalRows = sheetData.rows.length;
    let skipped_missing_customer = 0;
    let skipped_missing_poContainer = 0;
    let skipped_done = 0;
    let skipped_status_not_allowed = 0;
    let includedRows = 0;

    // Audit logs
    const first10Processed = [];

    // Process rows
    const deliveries = [];

    sheetData.rows.forEach((row, index) => {
      // ═══════════════════════════════════════════════════════════════════════
      // EXTRACT RAW VALUES FROM EXACT COLUMNS
      // ═══════════════════════════════════════════════════════════════════════
      const customerNameCell = row.cells.find(c => c.columnId === customerNameColumnId);
      const customerNameRaw = normalizeString(customerNameCell?.displayValue || customerNameCell?.value);

      const poContainerCell = row.cells.find(c => c.columnId === poContainerColumnId);
      const poContainerRaw = normalizeString(poContainerCell?.displayValue || poContainerCell?.value);

      const statusCell = row.cells.find(c => c.columnId === statusColumnId);
      const statusRaw = normalizeString(statusCell?.displayValue || statusCell?.value);

      const doneCell = row.cells.find(c => c.columnId === doneColumnId);
      const doneRaw = doneCell?.value === true;

      // ═══════════════════════════════════════════════════════════════════════
      // FILTERING LOGIC (BACKEND SOURCE OF TRUTH)
      // ═══════════════════════════════════════════════════════════════════════
      let decision = 'INCLUDED';
      let reason = '';
      let statusFinal = '';

      // Rule 1: Customer Name must NOT be blank
      if (isBlank(customerNameRaw)) {
        decision = 'SKIPPED';
        reason = 'Customer Name is blank';
        skipped_missing_customer++;
      }
      // Rule 2: PO # / Container # must NOT be blank
      else if (isBlank(poContainerRaw)) {
        decision = 'SKIPPED';
        reason = 'PO # / Container # is blank';
        skipped_missing_poContainer++;
      }
      // Rule 3: Done must NOT be checked
      else if (doneRaw) {
        decision = 'SKIPPED';
        reason = 'Done checkbox is checked';
        skipped_done++;
      }
      // Rule 4: Status handling
      else {
        if (isBlank(statusRaw)) {
          // Blank status is VALID → set to "Expected"
          statusFinal = 'Expected';
        } else if (ALLOWED_STATUSES.includes(statusRaw)) {
          // Status matches allowed list
          statusFinal = statusRaw;
        } else {
          // Status not allowed
          decision = 'SKIPPED';
          reason = `Status "${statusRaw}" not in allowed list [${ALLOWED_STATUSES.join(', ')}]`;
          skipped_status_not_allowed++;
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // AUDIT LOGGING (FIRST 10 ROWS)
      // ═══════════════════════════════════════════════════════════════════════
      if (index < 10) {
        first10Processed.push({
          rowId: String(row.id),
          customerNameRaw: customerNameRaw || '(blank)',
          poContainerRaw: poContainerRaw || '(blank)',
          statusRaw: statusRaw || '(blank)',
          statusFinal: statusFinal || '(not set)',
          doneRaw,
          decision,
          reason: reason || 'Passed all checks'
        });
      }

      // If skipped, don't add to deliveries
      if (decision === 'SKIPPED') {
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // CREATE DELIVERY OBJECT (ONLY FOR INCLUDED ROWS)
      // ═══════════════════════════════════════════════════════════════════════
      const delivery = {
        rowId: String(row.id),
        smartsheetRowId: String(row.id),
        customerName: customerNameRaw,
        poContainerNumber: poContainerRaw,
        poNumber: poContainerRaw,           // Legacy field (same value)
        containerNumber: poContainerRaw,    // Legacy field (same value)
        status: statusFinal,
        statusRaw: statusRaw || '(blank)',
        done: doneRaw,
        // Additional fields for compatibility
        carrier: '',
        door: '',
        ywNumber: '',
        threePlNumber: '',
        expectedDeliveryDate: '',
        trackingNumber: '',
        referenceNumber: '',
        extensivReceiptId: ''
      };

      deliveries.push(delivery);
      includedRows++;
    });

    const skippedRows = totalRows - includedRows;

    // ═══════════════════════════════════════════════════════════════════════
    // DELIVERIES SAMPLE (FROM INCLUDED DELIVERIES ONLY - AFTER FILTERING)
    // ═══════════════════════════════════════════════════════════════════════
    const deliveriesSample = deliveries.slice(0, 5).map(d => ({
      rowId: d.rowId,
      customerName: d.customerName,
      poContainerNumber: d.poContainerNumber,
      status: d.status,
      statusRaw: d.statusRaw
    }));

    // Log summary
    console.log('[Smartsheet] ═══════════════════════════════════════════════');
    console.log(`[Smartsheet] API VERSION: ${API_VERSION}`);
    console.log(`[Smartsheet] BACKEND COMMIT: ${BACKEND_COMMIT}`);
    console.log('[Smartsheet] ═══════════════════════════════════════════════');
    console.log(`[Smartsheet] Sheet ID: ${settings.sheetId}`);
    console.log(`[Smartsheet] Total rows: ${totalRows}`);
    console.log(`[Smartsheet] Included: ${includedRows}`);
    console.log(`[Smartsheet] Skipped: ${skippedRows}`);
    console.log(`[Smartsheet]   - Missing customer: ${skipped_missing_customer}`);
    console.log(`[Smartsheet]   - Missing PO/Container: ${skipped_missing_poContainer}`);
    console.log(`[Smartsheet]   - Done checked: ${skipped_done}`);
    console.log(`[Smartsheet]   - Status not allowed: ${skipped_status_not_allowed}`);
    console.log('[Smartsheet] ═══════════════════════════════════════════════');

    return res.json({
      success: true,
      message: `Synced ${includedRows} deliveries`,
      deliveries,
      timestamp: syncTimestamp,
      apiVersion: API_VERSION,
      backendCommit: BACKEND_COMMIT,
      usingColumns: USING_COLUMNS,
      diagnostics: {
        sheetId: settings.sheetId,
        totalRows,
        includedRows,
        skippedRows,
        skipReasonsCount: {
          skipped_missing_customer,
          skipped_missing_poContainer,
          skipped_done,
          skipped_status_not_allowed
        },
        first10Processed,
        deliveriesSample,
        allowedStatuses: ALLOWED_STATUSES
      }
    });
  } catch (error) {
    console.error('[Smartsheet] Sync error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      apiVersion: API_VERSION,
      backendCommit: BACKEND_COMMIT,
      diagnostics: { exception: String(error) }
    });
  }
});

/**
 * POST /api/smartsheet/update-delivery
 * Update a delivery in Smartsheet using server-side stored credentials
 * ⚠️ STABLE ENDPOINT - DO NOT MODIFY
 */
router.post('/update-delivery', async (req, res) => {
  console.log('[Smartsheet] POST /update-delivery');
  try {
    const { rowId, updates } = req.body;

    if (!rowId) {
      return res.status(400).json({
        success: false,
        error: 'Row ID is required'
      });
    }

    // Load credentials from server-side storage
    const settings = loadSettings();

    if (!settings.apiToken || !settings.sheetId) {
      return res.json({
        success: false,
        error: 'Smartsheet credentials not configured on server'
      });
    }

    // First, fetch sheet to get column IDs
    const sheetResponse = await fetch(`https://api.smartsheet.com/2.0/sheets/${settings.sheetId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${settings.apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!sheetResponse.ok) {
      return res.json({
        success: false,
        error: `Failed to fetch sheet: ${sheetResponse.status}`
      });
    }

    const sheetData = await sheetResponse.json();

    // Build column mapping
    const columnMap = {};
    sheetData.columns.forEach(col => {
      columnMap[col.title] = col.id;
    });

    // Create reverse mapping (appField -> Smartsheet column ID)
    const fieldToColumnId = {};
    settings.mappings.forEach(mapping => {
      const columnId = columnMap[mapping.smartsheetColumn];
      if (columnId) {
        fieldToColumnId[mapping.appField] = columnId;
      }
    });

    // Build cells array for update
    const cells = [];

    if (updates.referenceNumber !== undefined) {
      const columnId = fieldToColumnId['referenceNumber'];
      if (columnId) {
        cells.push({ columnId, value: updates.referenceNumber });
      }
    }

    if (updates.extensivReceiptId !== undefined) {
      const columnId = fieldToColumnId['extensivReceiptId'];
      if (columnId) {
        cells.push({ columnId, value: updates.extensivReceiptId });
      }
    }

    if (updates.status !== undefined) {
      const columnId = fieldToColumnId['status'];
      if (columnId) {
        cells.push({ columnId, value: updates.status });
      }
    }

    if (cells.length === 0) {
      return res.json({
        success: false,
        error: 'No valid updates to apply'
      });
    }

    // Update the row
    const updateResponse = await fetch(`https://api.smartsheet.com/2.0/sheets/${settings.sheetId}/rows`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${settings.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rows: [{
          id: parseInt(rowId),
          cells,
        }],
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      return res.json({
        success: false,
        error: `Failed to update row: ${updateResponse.status}`,
        diagnostics: { rawResponse: errorText }
      });
    }

    const updateResult = await updateResponse.json();

    return res.json({
      success: true,
      message: 'Delivery updated successfully',
      result: updateResult
    });
  } catch (error) {
    console.error('[Smartsheet] Update error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      diagnostics: { exception: String(error) }
    });
  }
});

// Catch-all for undefined routes - return JSON 404
router.all('*', (req, res) => {
  console.log(`[Smartsheet] 404: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    availableRoutes: [
      'GET /api/smartsheet/settings',
      'POST /api/smartsheet/settings',
      'DELETE /api/smartsheet/settings',
      'POST /api/smartsheet/test-connection',
      'GET /api/smartsheet/columns',
      'POST /api/smartsheet/sync-deliveries',
      'POST /api/smartsheet/update-delivery'
    ]
  });
});

export default router;