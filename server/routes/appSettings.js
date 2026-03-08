// App Settings API - Persists application settings to server-side storage
// This replaces localStorage-based settings that were lost across browsers/devices
import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Use /data on Railway (persistent volume), local storage dir otherwise
const IS_RAILWAY = !!process.env.RAILWAY_ENVIRONMENT;
const STORAGE_DIR = IS_RAILWAY ? '/data' : path.join(new URL('.', import.meta.url).pathname, '../storage');
const APP_SETTINGS_FILE = path.join(STORAGE_DIR, 'appSettings.json');

function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function loadAppSettings() {
  try {
    if (!fs.existsSync(APP_SETTINGS_FILE)) {
      return {};
    }
    const data = fs.readFileSync(APP_SETTINGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[AppSettings] Error loading settings:', error.message);
    return {};
  }
}

function saveAppSettingsToFile(settings) {
  try {
    ensureStorageDir();
    const jsonContent = JSON.stringify(settings, null, 2);
    fs.writeFileSync(APP_SETTINGS_FILE, jsonContent, 'utf8');
    console.log(`[AppSettings] Settings saved (${jsonContent.length} bytes)`);
    return true;
  } catch (error) {
    console.error('[AppSettings] Error saving settings:', error.message);
    return false;
  }
}

/**
 * GET /api/app-settings
 * Load all application settings from server-side storage
 */
router.get('/', async (req, res) => {
  console.log('[AppSettings] GET /');
  try {
    const settings = loadAppSettings();
    return res.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('[AppSettings] Failed to load settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load app settings',
      details: error.message,
    });
  }
});

/**
 * PUT /api/app-settings
 * Save all application settings to server-side storage
 * Accepts a flat or nested object of settings
 */
router.put('/', async (req, res) => {
  console.log('[AppSettings] PUT /');
  try {
    const newSettings = req.body;

    if (!newSettings || typeof newSettings !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Request body must be a JSON object',
      });
    }

    // Merge with existing settings so partial updates work
    const existing = loadAppSettings();
    const merged = { ...existing, ...newSettings };
    merged.lastUpdated = new Date().toISOString();

    const saved = saveAppSettingsToFile(merged);

    if (!saved) {
      return res.status(500).json({
        success: false,
        error: 'Failed to save settings to server storage',
      });
    }

    return res.json({
      success: true,
      message: 'App settings saved successfully',
      settings: merged,
    });
  } catch (error) {
    console.error('[AppSettings] Failed to save settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save app settings',
      details: error.message,
    });
  }
});

/**
 * PATCH /api/app-settings
 * Partially update application settings (merge with existing)
 */
router.patch('/', async (req, res) => {
  console.log('[AppSettings] PATCH /');
  try {
    const updates = req.body;

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Request body must be a JSON object',
      });
    }

    const existing = loadAppSettings();
    const merged = { ...existing, ...updates };
    merged.lastUpdated = new Date().toISOString();

    const saved = saveAppSettingsToFile(merged);

    if (!saved) {
      return res.status(500).json({
        success: false,
        error: 'Failed to save settings to server storage',
      });
    }

    return res.json({
      success: true,
      message: 'App settings updated successfully',
      settings: merged,
    });
  } catch (error) {
    console.error('[AppSettings] Failed to update settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update app settings',
      details: error.message,
    });
  }
});

export default router;