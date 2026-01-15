import express from 'express';
import axios from 'axios';

const router = express.Router();

const SMARTSHEET_API_BASE = 'https://api.smartsheet.com/2.0';

// Helper function to create Smartsheet API client
const createSmartsheetClient = (apiToken) => {
  return axios.create({
    baseURL: SMARTSHEET_API_BASE,
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    }
  });
};

// Test connection
router.post('/test-connection', async (req, res) => {
  try {
    const { apiToken, sheetId } = req.body;

    if (!apiToken || !sheetId) {
      return res.status(400).json({ error: 'API token and sheet ID are required' });
    }

    const client = createSmartsheetClient(apiToken);
    const response = await client.get(`/sheets/${sheetId}`);

    res.json({
      success: true,
      sheetName: response.data.name,
      columnCount: response.data.columns.length,
      rowCount: response.data.rows.length
    });
  } catch (error) {
    console.error('Smartsheet connection test failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message || 'Connection test failed'
    });
  }
});

// Auto-detect columns
router.post('/auto-detect-columns', async (req, res) => {
  try {
    const { apiToken, sheetId } = req.body;

    if (!apiToken || !sheetId) {
      return res.status(400).json({ error: 'API token and sheet ID are required' });
    }

    const client = createSmartsheetClient(apiToken);
    const response = await client.get(`/sheets/${sheetId}`);

    const columns = response.data.columns.map(col => ({
      id: col.id,
      title: col.title,
      type: col.type,
      primary: col.primary || false
    }));

    // Auto-detect mappings based on common column names
    const mappings = {};
    const fieldMappings = {
      containerNumber: ['container', 'container number', 'container #', 'container no', 'po #', 'po number'],
      customerName: ['customer', 'customer name', 'client', 'client name'],
      poNumber: ['po', 'po number', 'po #', 'purchase order', 'po no'],
      door: ['door', 'dock door', 'dock', 'door #', 'door number'],
      expectedDate: ['expected date', 'eta', 'arrival date', 'expected arrival', 'date'],
      carrier: ['carrier', 'shipping carrier', 'shipper', 'transport'],
      trackingNumber: ['tracking', 'tracking number', 'tracking #', 'tracking no', 'awb', '3pl'],
      status: ['status', 'delivery status', 'state'],
      notes: ['notes', 'comments', 'remarks', 'description', 'additional information'],
      done: ['done', 'completed', 'finished', 'complete']
    };

    for (const [field, patterns] of Object.entries(fieldMappings)) {
      const matchedColumn = columns.find(col => 
        patterns.some(pattern => 
          col.title.toLowerCase().includes(pattern.toLowerCase())
        )
      );
      if (matchedColumn) {
        mappings[field] = matchedColumn.title;
      }
    }

    res.json({
      success: true,
      columns,
      suggestedMappings: mappings
    });
  } catch (error) {
    console.error('Auto-detect columns failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message || 'Failed to detect columns'
    });
  }
});

// Fetch deliveries with filtering logic
router.post('/fetch-deliveries', async (req, res) => {
  try {
    const { apiToken, sheetId, columnMappings } = req.body;

    if (!apiToken || !sheetId || !columnMappings) {
      return res.status(400).json({ error: 'API token, sheet ID, and column mappings are required' });
    }

    const client = createSmartsheetClient(apiToken);
    const response = await client.get(`/sheets/${sheetId}`);

    const sheet = response.data;
    const columns = sheet.columns;
    const rows = sheet.rows;

    // Create column ID to title mapping
    const columnIdToTitle = {};
    columns.forEach(col => {
      columnIdToTitle[col.id] = col.title;
    });

    // Create reverse mapping: field name -> column title -> column ID
    const fieldToColumnId = {};
    for (const [field, columnTitle] of Object.entries(columnMappings)) {
      const column = columns.find(col => col.title === columnTitle);
      if (column) {
        fieldToColumnId[field] = column.id;
      }
    }

    // Find the "Done" column ID
    const doneColumn = columns.find(col => col.title === columnMappings.done);
    const doneColumnId = doneColumn ? doneColumn.id : null;

    // Parse rows into deliveries
    const deliveries = rows.map(row => {
      const delivery = {
        id: `ss-${row.id}`,
        smartsheetRowId: row.id,
        containerNumber: '',
        customerName: '',
        poNumber: '',
        door: '',
        expectedDate: '',
        carrier: '',
        trackingNumber: '',
        status: '',
        notes: '',
        done: false,
        createdAt: row.createdAt || new Date().toISOString(),
        updatedAt: row.modifiedAt || new Date().toISOString()
      };

      // Map cell values to delivery fields
      row.cells.forEach(cell => {
        const columnTitle = columnIdToTitle[cell.columnId];
        
        // Check if this is the "Done" column
        if (doneColumnId && cell.columnId === doneColumnId) {
          delivery.done = cell.value === true || cell.value === 'true' || cell.value === 1;
        }
        
        // Find which field this column maps to
        for (const [field, mappedColumnTitle] of Object.entries(columnMappings)) {
          if (mappedColumnTitle === columnTitle && cell.value !== undefined && cell.value !== null) {
            if (field === 'expectedDate') {
              // Handle date fields
              delivery[field] = cell.value;
            } else if (field === 'done') {
              // Handle checkbox fields
              delivery[field] = cell.value === true || cell.value === 'true' || cell.value === 1;
            } else {
              delivery[field] = String(cell.value);
            }
          }
        }
      });

      return delivery;
    })
    .filter(delivery => {
      // Filter logic based on user requirements:
      // SHOW: deliveries with container number AND done is NOT checked
      // HIDE: deliveries where done checkbox is checked
      return delivery.containerNumber && !delivery.done;
    });

    res.json({
      success: true,
      deliveries,
      count: deliveries.length
    });
  } catch (error) {
    console.error('Fetch deliveries failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message || 'Failed to fetch deliveries'
    });
  }
});

// Update delivery status
router.post('/update-status', async (req, res) => {
  try {
    const { apiToken, sheetId, rowId, columnMappings, status, completedAt, notes } = req.body;

    if (!apiToken || !sheetId || !rowId || !columnMappings) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const client = createSmartsheetClient(apiToken);
    
    // Get sheet to find column IDs
    const sheetResponse = await client.get(`/sheets/${sheetId}`);
    const columns = sheetResponse.data.columns;

    // Find column IDs for status and notes
    const statusColumn = columns.find(col => col.title === columnMappings.status);
    const notesColumn = columns.find(col => col.title === columnMappings.notes);

    if (!statusColumn) {
      return res.status(400).json({ error: 'Status column not found in sheet' });
    }

    // Build update payload
    const cells = [
      {
        columnId: statusColumn.id,
        value: status
      }
    ];

    if (notesColumn && notes) {
      cells.push({
        columnId: notesColumn.id,
        value: notes
      });
    }

    // Update the row
    const updateResponse = await client.put(`/sheets/${sheetId}/rows`, {
      rows: [{
        id: rowId,
        cells
      }]
    });

    res.json({
      success: true,
      rowId: updateResponse.data.result[0].id
    });
  } catch (error) {
    console.error('Update status failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message || 'Failed to update status'
    });
  }
});

// Add delivery to Smartsheet
router.post('/add-delivery', async (req, res) => {
  try {
    const { apiToken, sheetId, columnMappings, delivery } = req.body;

    if (!apiToken || !sheetId || !columnMappings || !delivery) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const client = createSmartsheetClient(apiToken);
    
    // Get sheet to find column IDs
    const sheetResponse = await client.get(`/sheets/${sheetId}`);
    const columns = sheetResponse.data.columns;

    // Build cells array
    const cells = [];
    for (const [field, columnTitle] of Object.entries(columnMappings)) {
      const column = columns.find(col => col.title === columnTitle);
      if (column && delivery[field]) {
        cells.push({
          columnId: column.id,
          value: delivery[field]
        });
      }
    }

    // Add row to sheet
    const addResponse = await client.post(`/sheets/${sheetId}/rows`, {
      rows: [{
        toBottom: true,
        cells
      }]
    });

    res.json({
      success: true,
      rowId: addResponse.data.result[0].id
    });
  } catch (error) {
    console.error('Add delivery failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message || 'Failed to add delivery'
    });
  }
});

export default router;