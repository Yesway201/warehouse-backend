import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine storage path based on environment
const IS_RAILWAY = !!process.env.RAILWAY_ENVIRONMENT;
const STORAGE_DIR = IS_RAILWAY 
  ? '/data/storage'
  : path.join(__dirname, '../storage');
const SETTINGS_FILE = path.join(STORAGE_DIR, 'smartsheetSettings.json');

// Old storage path for migration
const OLD_STORAGE_DIR = path.join(__dirname, '../storage');
const OLD_SETTINGS_FILE = path.join(OLD_STORAGE_DIR, 'smartsheetSettings.json');

/**
 * Ensure storage directory exists
 */
function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    console.log('[SettingsStore] Creating storage directory:', STORAGE_DIR);
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

/**
 * One-time migration: copy old settings to new location
 */
function migrateOldSettings() {
  try {
    // Only migrate if we're on Railway and new file doesn't exist but old one does
    if (IS_RAILWAY && !fs.existsSync(SETTINGS_FILE) && fs.existsSync(OLD_SETTINGS_FILE)) {
      console.log('[SettingsStore] Migrating credentials from old location to Railway volume...');
      ensureStorageDir();
      
      const oldData = fs.readFileSync(OLD_SETTINGS_FILE, 'utf8');
      fs.writeFileSync(SETTINGS_FILE, oldData, 'utf8');
      
      console.log('[SettingsStore] ✅ Migration complete: credentials copied to', SETTINGS_FILE);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[SettingsStore] ⚠️ Migration failed:', error.message);
    return false;
  }
}

// Initialize storage and log configuration on module load
(function initialize() {
  ensureStorageDir();
  migrateOldSettings();
  
  const fileExists = fs.existsSync(SETTINGS_FILE);
  
  console.log('[SettingsStore] Configuration:');
  console.log('  - storagePath:', SETTINGS_FILE);
  console.log('  - usingRailwayVolume:', IS_RAILWAY);
  console.log('  - fileExists:', fileExists);
  
  if (fileExists) {
    try {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(data);
      const configured = !!(settings.apiToken && settings.sheetId);
      console.log('  - smartsheetConfigured:', configured);
    } catch (error) {
      console.log('  - smartsheetConfigured: false (error reading file)');
    }
  } else {
    console.log('  - smartsheetConfigured: false');
  }
})();

/**
 * Load Smartsheet settings from persistent storage
 * @returns {Object} Settings object with apiToken, sheetId, mappings, lastUpdated
 */
export function loadSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      console.log('[SettingsStore] Settings file not found, returning empty settings');
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
    console.log('[SettingsStore] Has API token:', !!settings.apiToken);
    console.log('[SettingsStore] Has Sheet ID:', !!settings.sheetId);
    console.log('[SettingsStore] Last updated:', settings.lastUpdated);
    
    return settings;
  } catch (error) {
    console.error('[SettingsStore] Error loading settings:', error);
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
 * @param {Object} settings - Settings object with apiToken, sheetId, mappings
 * @returns {boolean} Success status
 */
export function saveSettings(settings) {
  try {
    ensureStorageDir();
    
    const settingsToSave = {
      apiToken: settings.apiToken,
      sheetId: settings.sheetId,
      mappings: settings.mappings || [],
      lastUpdated: new Date().toISOString()
    };

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settingsToSave, null, 2), 'utf8');
    
    console.log('[SettingsStore] Settings saved successfully');
    console.log('[SettingsStore] Storage location:', SETTINGS_FILE);
    
    return true;
  } catch (error) {
    console.error('[SettingsStore] Error saving settings:', error);
    return false;
  }
}

/**
 * Clear Smartsheet settings from persistent storage
 * @returns {boolean} Success status
 */
export function clearSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      fs.unlinkSync(SETTINGS_FILE);
      console.log('[SettingsStore] Settings cleared successfully');
    } else {
      console.log('[SettingsStore] No settings file to clear');
    }
    return true;
  } catch (error) {
    console.error('[SettingsStore] Error clearing settings:', error);
    return false;
  }
}

/**
 * Get storage configuration info (for /api/version endpoint)
 * @returns {Object} Storage configuration
 */
export function getStorageInfo() {
  const fileExists = fs.existsSync(SETTINGS_FILE);
  let smartsheetConfigured = false;
  
  if (fileExists) {
    try {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(data);
      smartsheetConfigured = !!(settings.apiToken && settings.sheetId);
    } catch (error) {
      smartsheetConfigured = false;
    }
  }
  
  return {
    usingRailwayVolume: IS_RAILWAY,
    storagePath: SETTINGS_FILE,
    fileExists,
    smartsheetConfigured
  };
}

/**
 * Mask API token for safe display
 * @param {string} token - API token to mask
 * @returns {string} Masked token
 */
export function maskToken(token) {
  if (!token || token.length < 8) return '***';
  return token.substring(0, 4) + '***' + token.substring(token.length - 4);
}