import express from 'express';
import axios from 'axios';

const router = express.Router();

const EXTENSIV_API_BASE = 'https://secure-wms.com/api';

// Helper function to create Extensiv API client
const createExtensivClient = (apiKey) => {
  return axios.create({
    baseURL: EXTENSIV_API_BASE,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
};

// Test connection
router.post('/test-connection', async (req, res) => {
  try {
    const { apiKey, facilityId } = req.body;

    if (!apiKey || !facilityId) {
      return res.status(400).json({ error: 'API key and facility ID are required' });
    }

    const client = createExtensivClient(apiKey);
    const response = await client.get(`/facilities/${facilityId}`);

    res.json({
      success: true,
      facilityName: response.data.name,
      facilityId: response.data.id
    });
  } catch (error) {
    console.error('Extensiv connection test failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message || 'Connection test failed'
    });
  }
});

// Fetch items
router.post('/fetch-items', async (req, res) => {
  try {
    const { apiKey, facilityId } = req.body;

    if (!apiKey || !facilityId) {
      return res.status(400).json({ error: 'API key and facility ID are required' });
    }

    const client = createExtensivClient(apiKey);
    const response = await client.get(`/facilities/${facilityId}/items`);

    const items = response.data.items.map(item => ({
      itemNumber: item.sku,
      description: item.description,
      uom: item.uom || 'EA',
      category: item.category || 'Other',
      customerId: item.customerId || null,
      barcode: item.barcode || '',
      lastUpdated: item.updatedAt || new Date().toISOString()
    }));

    res.json({
      success: true,
      items,
      count: items.length
    });
  } catch (error) {
    console.error('Fetch items failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message || 'Failed to fetch items'
    });
  }
});

// Send receiving transaction
router.post('/send-receiving', async (req, res) => {
  try {
    const { apiKey, facilityId, receivingData } = req.body;

    if (!apiKey || !facilityId || !receivingData) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const client = createExtensivClient(apiKey);
    const response = await client.post(`/facilities/${facilityId}/receiving`, receivingData);

    res.json({
      success: true,
      transactionId: response.data.id
    });
  } catch (error) {
    console.error('Send receiving failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message || 'Failed to send receiving transaction'
    });
  }
});

export default router;