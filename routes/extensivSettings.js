import express from 'express';
import { 
  loadExtensivSettings, 
  saveExtensivSettings, 
  clearExtensivSettings, 
  getExtensivStorageInfo, 
  maskValue 
} from '../lib/settingsStore.js';

const router = express.Router();

console.log('[ExtensivSettingsRoutes] mounted');

/**
 * GET /api/extensiv-settings
 * Load Extensiv settings from server-side storage
 */
router.get('/', async (req, res) => {
  console.log('[ExtensivSettings] GET /');
  try {
    const settings = loadExtensivSettings();
    
    return res.json({
      success: true,
      settings: {
        clientIdMasked: settings.clientId ? maskValue(settings.clientId) : null,
        clientSecretMasked: settings.clientSecret ? maskValue(settings.clientSecret) : null,
        userLoginId: settings.userLoginId,
        facilityId: settings.facilityId,
        lastUpdated: settings.lastUpdated,
        configured: !!(settings.clientId && settings.clientSecret && settings.userLoginId && settings.facilityId)
      }
    });
  } catch (error) {
    console.error('[ExtensivSettings] Failed to load settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load settings from server',
      details: error.message
    });
  }
});

/**
 * POST /api/extensiv-settings
 * Save Extensiv settings to server-side storage
 */
router.post('/', async (req, res) => {
  console.log('[ExtensivSettings] POST /');
  try {
    const { clientId, clientSecret, userLoginId, facilityId } = req.body;

    if (!clientId || !clientSecret || !userLoginId || !facilityId) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required: clientId, clientSecret, userLoginId, facilityId'
      });
    }

    const saved = saveExtensivSettings({
      clientId,
      clientSecret,
      userLoginId,
      facilityId
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
      clientIdMasked: maskValue(clientId),
      clientSecretMasked: maskValue(clientSecret)
    });
  } catch (error) {
    console.error('[ExtensivSettings] Failed to save settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save settings',
      details: error.message
    });
  }
});

/**
 * DELETE /api/extensiv-settings
 * Clear Extensiv settings from server-side storage
 */
router.delete('/', async (req, res) => {
  console.log('[ExtensivSettings] DELETE /');
  try {
    const cleared = clearExtensivSettings();

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
    console.error('[ExtensivSettings] Failed to clear settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear settings',
      details: error.message
    });
  }
});

/**
 * GET /api/extensiv-settings/storage-info
 * Get storage information for debugging
 */
router.get('/storage-info', async (req, res) => {
  console.log('[ExtensivSettings] GET /storage-info');
  try {
    const info = getExtensivStorageInfo();
    return res.json({
      success: true,
      ...info
    });
  } catch (error) {
    console.error('[ExtensivSettings] Failed to get storage info:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get storage info',
      details: error.message
    });
  }
});

export default router;