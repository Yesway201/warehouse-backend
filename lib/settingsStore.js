// ⚠️ DO NOT MODIFY – Smartsheet stable working configuration
// This file is part of the STABLE BASELINE (smartsheet-stable-v1.0)
// Any changes may break the working Smartsheet integration
// See: server/SMARTSHEET_BASELINE.md for details

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage file path - persists across Railway redeploys
const STORAGE_DIR = path.join(__dirname, '../storage');
const SETTINGS_FILE = path.join(STORAGE_DIR, 'smartsheetSettings.json');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  console.log('[SettingsStore] Created storage directory:', STORAGE_DIR);
}

/**
 * Load Smartsheet settings from JSON file
 * ⚠️ STABLE FUNCTION - DO NOT MODIFY
 */
export function loadSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      console.log('[SettingsStore] No settings file found, returning empty settings');
      return {
        apiToken: null,
        sheetId: null,
        mappings: [],
        lastUpdated: null
      };
    }

    const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(data);
    console.log('[SettingsStore] Settings loaded successfully');
    return settings;
  } catch (error) {
    console.error('[SettingsStore] Failed to load settings:', error);
    return {
      apiToken: null,
      sheetId: null,
      mappings: [],
      lastUpdated: null
    };
  }
}

/**
 * Save Smartsheet settings to JSON file
 * ⚠️ STABLE FUNCTION - DO NOT MODIFY
 */
export function saveSettings(settings) {
  try {
    const dataToSave = {
      apiToken: settings.apiToken,
      sheetId: settings.sheetId,
      mappings: settings.mappings || [],
      lastUpdated: new Date().toISOString()
    };

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
    console.log('[SettingsStore] Settings saved successfully');
    return true;
  } catch (error) {
    console.error('[SettingsStore] Failed to save settings:', error);
    return false;
  }
}

/**
 * Clear Smartsheet settings
 * ⚠️ STABLE FUNCTION - DO NOT MODIFY
 */
export function clearSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      fs.unlinkSync(SETTINGS_FILE);
      console.log('[SettingsStore] Settings cleared successfully');
    }
    return true;
  } catch (error) {
    console.error('[SettingsStore] Failed to clear settings:', error);
    return false;
  }
}

/**
 * Mask API token for display (show first 4 and last 4 characters)
 * ⚠️ STABLE FUNCTION - DO NOT MODIFY
 */
export function maskToken(token) {
  if (!token || token.length < 12) {
    return '****';
  }
  return `${token.substring(0, 4)}${'*'.repeat(token.length - 8)}${token.substring(token.length - 4)}`;
}