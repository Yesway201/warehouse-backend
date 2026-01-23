import express from 'express';
import { loadSettings, saveSettings, clearSettings, getStorageInfo, maskValue } from '../lib/extensivSettingsStore.js';

const router = express.Router();

/**
 * GET /api/extensiv-settings
 * Load saved Extensiv credentials
 */
router.get('/', async (req, res) => {
  try {
    console.log('[ExtensivSettings API] Loading credentials...');
    
    const settings = loadSettings();
    
    // Return settings with masked client_secret for security
    const response = {
      success: true,
      settings: {
        clientId: settings.clientId,
        clientSecret: settings.clientSecret ? maskValue(settings.clientSecret) : null,
        clientSecretMasked: !!settings.clientSecret,
        userLoginId: settings.userLoginId,
        facilityId: settings.facilityId,
        lastUpdated: settings.lastUpdated
      },
      // Include full unmasked credentials for actual use (frontend will handle securely)
      credentials: settings
    };
    
    console.log('[ExtensivSettings API] Credentials loaded successfully');
    res.json(response);
  } catch (error) {
    console.error('[ExtensivSettings API] Error loading credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load credentials',
      details: error.message
    });
  }
});

/**
 * POST /api/extensiv-settings
 * Save Extensiv credentials
 */
router.post('/', async (req, res) => {
  try {
    console.log('[ExtensivSettings API] Saving credentials...');
    
    const { clientId, clientSecret, userLoginId, facilityId } = req.body;
    
    // Validate required fields
    if (!clientId || !clientSecret || !userLoginId || !facilityId) {
      console.error('[ExtensivSettings API] Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: clientId, clientSecret, userLoginId, facilityId'
      });
    }
    
    const settings = {
      clientId,
      clientSecret,
      userLoginId,
      facilityId
    };
    
    const success = saveSettings(settings);
    
    if (success) {
      console.log('[ExtensivSettings API] Credentials saved successfully');
      res.json({
        success: true,
        message: 'Credentials saved successfully',
        settings: {
          clientId: settings.clientId,
          clientSecret: maskValue(settings.clientSecret),
          userLoginId: settings.userLoginId,
          facilityId: settings.facilityId
        }
      });
    } else {
      throw new Error('Failed to save credentials');
    }
  } catch (error) {
    console.error('[ExtensivSettings API] Error saving credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save credentials',
      details: error.message
    });
  }
});

/**
 * DELETE /api/extensiv-settings
 * Clear saved Extensiv credentials
 */
router.delete('/', async (req, res) => {
  try {
    console.log('[ExtensivSettings API] Clearing credentials...');
    
    const success = clearSettings();
    
    if (success) {
      console.log('[ExtensivSettings API] Credentials cleared successfully');
      res.json({
        success: true,
        message: 'Credentials cleared successfully'
      });
    } else {
      throw new Error('Failed to clear credentials');
    }
  } catch (error) {
    console.error('[ExtensivSettings API] Error clearing credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear credentials',
      details: error.message
    });
  }
});

/**
 * GET /api/extensiv-settings/status
 * Get storage status and configuration info
 */
router.get('/status', async (req, res) => {
  try {
    const storageInfo = getStorageInfo();
    res.json({
      success: true,
      storage: storageInfo
    });
  } catch (error) {
    console.error('[ExtensivSettings API] Error getting status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get status',
      details: error.message
    });
  }
});

export default router;