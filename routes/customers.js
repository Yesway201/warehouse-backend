import express from 'express';
import { loadCustomers, saveCustomers } from '../lib/settingsStore.js';

const router = express.Router();

console.log('[CustomerRoutes] mounted');

/**
 * GET /api/customers
 * Load all customers from persistent storage
 */
router.get('/', async (req, res) => {
  console.log('[Customers] GET /');
  try {
    const customers = loadCustomers();
    
    console.log(`[Customers] Loaded ${customers.length} customers from storage`);
    
    return res.json({
      success: true,
      customers,
      count: customers.length
    });
  } catch (error) {
    console.error('[Customers] Failed to load customers:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load customers from server',
      details: error.message
    });
  }
});

/**
 * POST /api/customers
 * Save customers to persistent storage
 */
router.post('/', async (req, res) => {
  console.log('[Customers] POST /');
  try {
    const { customers } = req.body;

    if (!Array.isArray(customers)) {
      return res.status(400).json({
        success: false,
        error: 'Customers must be an array'
      });
    }

    const saved = saveCustomers(customers);

    if (!saved) {
      return res.status(500).json({
        success: false,
        error: 'Failed to save customers to server storage'
      });
    }

    console.log(`[Customers] Saved ${customers.length} customers to storage`);

    return res.json({
      success: true,
      message: 'Customers saved successfully',
      count: customers.length
    });
  } catch (error) {
    console.error('[Customers] Failed to save customers:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save customers',
      details: error.message
    });
  }
});

/**
 * DELETE /api/customers
 * Clear all customers from persistent storage
 */
router.delete('/', async (req, res) => {
  console.log('[Customers] DELETE /');
  try {
    const saved = saveCustomers([]);

    if (!saved) {
      return res.status(500).json({
        success: false,
        error: 'Failed to clear customers from server storage'
      });
    }

    console.log('[Customers] Cleared all customers from storage');

    return res.json({
      success: true,
      message: 'All customers cleared successfully'
    });
  } catch (error) {
    console.error('[Customers] Failed to clear customers:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear customers',
      details: error.message
    });
  }
});

export default router;