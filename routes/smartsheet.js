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
 * ⚠️ STABLE ENDPOINT - DO NOT MODIFY
 */
router.post('/sync-deliveries', async (req, res) => {
  console.log('[Smartsheet] POST /sync-deliveries');
  try {
    // Load credentials from server-side storage
    const settings = loadSettings();

    if (!settings.apiToken || !settings.sheetId) {
      return res.json({
        success: false,
        error: 'Smartsheet credentials not configured on server'
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
        diagnostics: { rawResponse: errorText }
      });
    }

    const sheetData = await response.json();

    // Build column mapping (Smartsheet column name -> column ID)
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

    // Process rows and filter by "Done" checkbox
    const deliveries = [];
    const doneColumnId = fieldToColumnId['done'];

    sheetData.rows.forEach(row => {
      // Check if "Done" is checked (skip if true)
      const doneCell = row.cells.find(c => c.columnId === doneColumnId);
      const isDone = doneCell?.value === true;

      if (isDone) {
        return; // Skip this row
      }

      // Extract delivery data based on column mappings
      const delivery = {
        rowId: String(row.id),
      };

      // Map each field
      Object.keys(fieldToColumnId).forEach(appField => {
        const columnId = fieldToColumnId[appField];
        const cell = row.cells.find(c => c.columnId === columnId);
        
        if (cell) {
          if (appField === 'done') {
            delivery[appField] = cell.value === true;
          } else if (appField === 'expectedDeliveryDate') {
            delivery[appField] = cell.value || '';
          } else {
            delivery[appField] = cell.displayValue || cell.value || '';
          }
        } else {
          delivery[appField] = appField === 'done' ? false : '';
        }
      });

      deliveries.push(delivery);
    });

    return res.json({
      success: true,
      message: `Synced ${deliveries.length} deliveries`,
      deliveries,
      rowsProcessed: sheetData.rows.length,
      rowsImported: deliveries.length,
      diagnostics: {
        sheetId: settings.sheetId,
        totalRows: sheetData.rows.length,
        filteredRows: deliveries.length,
        columnMappings: settings.mappings
      }
    });
  } catch (error) {
    console.error('[Smartsheet] Sync error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
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