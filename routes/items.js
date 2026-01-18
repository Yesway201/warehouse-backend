import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Initialize Supabase client only if credentials are provided
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Middleware to check if Supabase is configured
const requireSupabase = (req, res, next) => {
  if (!supabase) {
    return res.status(503).json({ 
      success: false, 
      error: 'Supabase is not configured. Please add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables in Railway.',
      configured: false
    });
  }
  next();
};

// Health check endpoint (doesn't require Supabase)
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    configured: !!supabase,
    message: supabase ? 'Items API is ready' : 'Supabase not configured'
  });
});

// Get all items (optionally filtered by customer)
router.get('/', requireSupabase, async (req, res) => {
  try {
    const { customerId } = req.query;
    
    let query = supabase
      .from('extensiv_items')
      .select('*')
      .order('item_number', { ascending: true });
    
    if (customerId && customerId !== 'all') {
      query = query.eq('customer_id', customerId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    res.json({ success: true, items: data || [] });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get sync status for a customer
router.get('/sync-status/:customerId', requireSupabase, async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const { data, error } = await supabase
      .from('extensiv_items_sync_status')
      .select('*')
      .eq('customer_id', customerId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    
    res.json({ success: true, syncStatus: data || null });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sync items from Extensiv for a specific customer
router.post('/sync', requireSupabase, async (req, res) => {
  try {
    const { customerId, items } = req.body;
    
    if (!customerId || !items || !Array.isArray(items)) {
      return res.status(400).json({ 
        success: false, 
        error: 'customerId and items array are required' 
      });
    }
    
    let newItems = 0;
    let updatedItems = 0;
    
    // Process each item
    for (const item of items) {
      const { data: existing, error: fetchError } = await supabase
        .from('extensiv_items')
        .select('id')
        .eq('item_number', item.itemNumber)
        .eq('customer_id', customerId)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      
      const itemData = {
        item_number: item.itemNumber,
        description: item.description,
        uom: item.uom,
        category: item.category,
        customer_id: customerId,
        barcode: item.barcode || null,
        extensiv_id: item.extensivId || null,
        last_updated: new Date().toISOString()
      };
      
      if (existing) {
        // Update existing item
        const { error: updateError } = await supabase
          .from('extensiv_items')
          .update(itemData)
          .eq('id', existing.id);
        
        if (updateError) throw updateError;
        updatedItems++;
      } else {
        // Insert new item
        const { error: insertError } = await supabase
          .from('extensiv_items')
          .insert(itemData);
        
        if (insertError) throw insertError;
        newItems++;
      }
    }
    
    // Update sync status
    const { data: syncStatus, error: syncFetchError } = await supabase
      .from('extensiv_items_sync_status')
      .select('id')
      .eq('customer_id', customerId)
      .single();
    
    if (syncFetchError && syncFetchError.code !== 'PGRST116') throw syncFetchError;
    
    const syncData = {
      customer_id: customerId,
      last_sync: new Date().toISOString(),
      items_count: items.length
    };
    
    if (syncStatus) {
      await supabase
        .from('extensiv_items_sync_status')
        .update(syncData)
        .eq('id', syncStatus.id);
    } else {
      await supabase
        .from('extensiv_items_sync_status')
        .insert(syncData);
    }
    
    res.json({ 
      success: true, 
      newItems, 
      updatedItems, 
      totalItems: items.length 
    });
  } catch (error) {
    console.error('Error syncing items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add a single item manually
router.post('/', requireSupabase, async (req, res) => {
  try {
    const { itemNumber, description, uom, category, customerId, barcode } = req.body;
    
    if (!itemNumber || !description || !uom || !category || !customerId) {
      return res.status(400).json({ 
        success: false, 
        error: 'itemNumber, description, uom, category, and customerId are required' 
      });
    }
    
    const itemData = {
      item_number: itemNumber,
      description,
      uom,
      category,
      customer_id: customerId,
      barcode: barcode || null,
      last_updated: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('extensiv_items')
      .insert(itemData)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, item: data });
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update an item
router.put('/:itemNumber', requireSupabase, async (req, res) => {
  try {
    const { itemNumber } = req.params;
    const { description, uom, category, customerId, barcode } = req.body;
    
    const updateData = {
      description,
      uom,
      category,
      customer_id: customerId,
      barcode: barcode || null,
      last_updated: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('extensiv_items')
      .update(updateData)
      .eq('item_number', itemNumber)
      .eq('customer_id', customerId)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, item: data });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete an item
router.delete('/:itemNumber', requireSupabase, async (req, res) => {
  try {
    const { itemNumber } = req.params;
    const { customerId } = req.query;
    
    const { error } = await supabase
      .from('extensiv_items')
      .delete()
      .eq('item_number', itemNumber)
      .eq('customer_id', customerId);
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;