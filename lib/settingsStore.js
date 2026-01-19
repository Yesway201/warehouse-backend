// Simple JSON file-based persistent storage for Smartsheet settings
// This persists across Railway redeploys if volume is mounted
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SETTINGS_FILE = path.join(__dirname, '../storage/smartsheetSettings.json');

// Ensure storage directory exists
const storageDir = path.dirname(SETTINGS_FILE);
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

// Initialize file if it doesn't exist
if (!fs.existsSync(SETTINGS_FILE)) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
    apiToken: null,
    sheetId: null,
    mappings: [],
    lastUpdated: null
  }, null, 2));
}

/**
 * Load Smartsheet settings from persistent storage
 */
export function loadSettings() {
  try {
    const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return JSON.parse(data);
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
 * Save Smartsheet settings to persistent storage
 */
export function saveSettings(settings) {
  try {
    const data = {
      apiToken: settings.apiToken || null,
      sheetId: settings.sheetId || null,
      mappings: settings.mappings || [],
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
    console.log('[SettingsStore] Settings saved successfully');
    return true;
  } catch (error) {
    console.error('[SettingsStore] Failed to save settings:', error);
    return false;
  }
}

/**
 * Clear Smartsheet settings
 */
export function clearSettings() {
  try {
    const data = {
      apiToken: null,
      sheetId: null,
      mappings: [],
      lastUpdated: null
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
    console.log('[SettingsStore] Settings cleared successfully');
    return true;
  } catch (error) {
    console.error('[SettingsStore] Failed to clear settings:', error);
    return false;
  }
}

/**
 * Mask API token for safe display (show last 4 chars only)
 */
export function maskToken(token) {
  if (!token || token.length < 8) return '••••••••';
  return '••••' + token.slice(-4);
}