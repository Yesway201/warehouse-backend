import express from 'express';
import { createClient } from '@supabase/supabase-js';
import CryptoJS from 'crypto-js';

const router = express.Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Encryption key (should be in environment variable in production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'warehouse-secure-key-2024';

/**
 * Encrypt sensitive data
 */
function encrypt(text) {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

/**
 * Decrypt sensitive data
 */
function decrypt(ciphertext) {
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

/**
 * Save Extensiv Credentials
 * POST /api/credentials/save-extensiv
 * Body: { userId, clientId, clientSecret, customerId, facilityId, userLoginId }
 */
router.post('/save-extensiv', async (req, res) => {
  try {
    const { userId, clientId, clientSecret, customerId, facilityId, userLoginId } = req.body;

    if (!userId || !clientId || !clientSecret || !customerId || !facilityId || !userLoginId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    // Encrypt sensitive fields
    const encryptedClientSecret = encrypt(clientSecret);

    // Check if credentials already exist for this user
    const { data: existing } = await supabase
      .from('extensiv_credentials')
      .select('id')
      .eq('user_id', userId)
      .single();

    let result;
    if (existing) {
      // Update existing credentials
      result = await supabase
        .from('extensiv_credentials')
        .update({
          client_id: clientId,
          client_secret: encryptedClientSecret,
          customer_id: customerId,
          facility_id: facilityId,
          user_login_id: userLoginId,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    } else {
      // Insert new credentials
      result = await supabase
        .from('extensiv_credentials')
        .insert({
          user_id: userId,
          client_id: clientId,
          client_secret: encryptedClientSecret,
          customer_id: customerId,
          facility_id: facilityId,
          user_login_id: userLoginId,
        });
    }

    if (result.error) {
      throw new Error(result.error.message);
    }

    res.json({
      success: true,
      message: 'Credentials saved successfully',
    });
  } catch (error) {
    console.error('Failed to save credentials:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get Extensiv Credentials
 * GET /api/credentials/get-extensiv?userId=xxx
 */
router.get('/get-extensiv', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId parameter',
      });
    }

    const { data, error } = await supabase
      .from('extensiv_credentials')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No credentials found
        return res.json({
          success: true,
          credentials: null,
        });
      }
      throw new Error(error.message);
    }

    // Decrypt sensitive fields
    const decryptedClientSecret = decrypt(data.client_secret);

    res.json({
      success: true,
      credentials: {
        clientId: data.client_id,
        clientSecret: decryptedClientSecret,
        customerId: data.customer_id,
        facilityId: data.facility_id,
        userLoginId: data.user_login_id,
      },
    });
  } catch (error) {
    console.error('Failed to get credentials:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Delete Extensiv Credentials
 * DELETE /api/credentials/delete-extensiv?userId=xxx
 */
router.delete('/delete-extensiv', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId parameter',
      });
    }

    const { error } = await supabase
      .from('extensiv_credentials')
      .delete()
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      message: 'Credentials deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete credentials:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;