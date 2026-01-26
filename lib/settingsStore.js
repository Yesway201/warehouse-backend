import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine storage path based on environment
const IS_RAILWAY = !!process.env.RAILWAY_ENVIRONMENT;
const STORAGE_DIR = IS_RAILWAY 
  ? '/data'
  : path.join(__dirname, '../storage');
const SETTINGS_FILE = path.join(STORAGE_DIR, 'smartsheetSettings.json');
const CUSTOMERS_FILE = path.join(STORAGE_DIR, 'customers.json');

// Old storage path for migration
const OLD_STORAGE_DIR = path.join(__dirname, '../storage');
const OLD_SETTINGS_FILE = path.join(OLD_STORAGE_DIR, 'smartsheetSettings.json');
const OLD_CUSTOMERS_FILE = path.join(OLD_STORAGE_DIR, 'customers.json');

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
 * One-time migration: copy old files to new location
 */
function migrateOldFiles() {
  try {
    if (IS_RAILWAY) {
      ensureStorageDir();
      
      // Migrate settings file
      if (!fs.existsSync(SETTINGS_FILE) && fs.existsSync(OLD_SETTINGS_FILE)) {
        console.log('[SettingsStore] Migrating Smartsheet settings to Railway volume...');
        const oldData = fs.readFileSync(OLD_SETTINGS_FILE, 'utf8');
        fs.writeFileSync(SETTINGS_FILE, oldData, 'utf8');
        console.log('[SettingsStore] ✅ Smartsheet settings migrated to', SETTINGS_FILE);
      }
      
      // Migrate customers file
      if (!fs.existsSync(CUSTOMERS_FILE) && fs.existsSync(OLD_CUSTOMERS_FILE)) {
        console.log('[SettingsStore] Migrating customers data to Railway volume...');
        const oldData = fs.readFileSync(OLD_CUSTOMERS_FILE, 'utf8');
        fs.writeFileSync(CUSTOMERS_FILE, oldData, 'utf8');
        console.log('[SettingsStore] ✅ Customers data migrated to', CUSTOMERS_FILE);
      }
    }
  } catch (error) {
    console.error('[SettingsStore] ⚠️ Migration failed:', error.message);
  }
}

// Initialize storage and log configuration on module load
(function initialize() {
  ensureStorageDir();
  migrateOldFiles();
  
  const settingsExists = fs.existsSync(SETTINGS_FILE);
  const customersExists = fs.existsSync(CUSTOMERS_FILE);
  
  console.log('[SettingsStore] Configuration:');
  console.log('  - RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
  console.log('  - IS_RAILWAY:', IS_RAILWAY);
  console.log('  - STORAGE_DIR:', STORAGE_DIR);
  console.log('  - SETTINGS_FILE:', SETTINGS_FILE);
  console.log('  - CUSTOMERS_FILE:', CUSTOMERS_FILE);
  console.log('  - storageDirExists:', fs.existsSync(STORAGE_DIR));
  console.log('  - settingsFileExists:', settingsExists);
  console.log('  - customersFileExists:', customersExists);
  
  if (settingsExists) {
    try {
      const stats = fs.statSync(SETTINGS_FILE);
      console.log('  - settingsFileSize:', stats.size, 'bytes');
      console.log('  - settingsFileModified:', stats.mtime.toISOString());
    } catch (error) {
      console.log('  - settingsFileError:', error.message);
    }
  }
  
  if (customersExists) {
    try {
      const stats = fs.statSync(CUSTOMERS_FILE);
      const data = fs.readFileSync(CUSTOMERS_FILE, 'utf8');
      const customers = JSON.parse(data);
      console.log('  - customersCount:', customers.length);
      console.log('  - customersFileSize:', stats.size, 'bytes');
      console.log('  - customersFileModified:', stats.mtime.toISOString());
    } catch (error) {
      console.log('  - customersFileError:', error.message);
    }
  }
})();

/**
 * Load Smartsheet settings from persistent storage
 * @returns {Object} Settings object with accessToken, sheetId, lastUpdated
 */
export function loadSettings() {
  try {
    console.log('[SettingsStore] loadSettings() called');
    console.log('[SettingsStore] Checking file:', SETTINGS_FILE);
    console.log('[SettingsStore] File exists:', fs.existsSync(SETTINGS_FILE));
    
    if (!fs.existsSync(SETTINGS_FILE)) {
      console.log('[SettingsStore] Settings file not found, returning empty settings');
      return {
        accessToken: null,
        sheetId: null,
        lastUpdated: null
      };
    }

    const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
    console.log('[SettingsStore] Raw file content length:', data.length);
    
    const settings = JSON.parse(data);
    console.log('[SettingsStore] Settings loaded successfully');
    console.log('[SettingsStore] Has Access Token:', !!settings.accessToken);
    console.log('[SettingsStore] Has Sheet ID:', !!settings.sheetId);
    console.log('[SettingsStore] Last updated:', settings.lastUpdated);
    
    return settings;
  } catch (error) {
    console.error('[SettingsStore] Error loading settings:', error);
    console.error('[SettingsStore] Error stack:', error.stack);
    return {
      accessToken: null,
      sheetId: null,
      lastUpdated: null
    };
  }
}

/**
 * Save Smartsheet settings to persistent storage
 * @param {Object} settings - Settings object with accessToken and sheetId
 * @returns {boolean} Success status
 */
export function saveSettings(settings) {
  try {
    console.log('[SettingsStore] saveSettings() called');
    console.log('[SettingsStore] Target file:', SETTINGS_FILE);
    
    ensureStorageDir();
    
    console.log('[SettingsStore] Storage dir exists:', fs.existsSync(STORAGE_DIR));
    
    const settingsToSave = {
      accessToken: settings.accessToken,
      sheetId: settings.sheetId,
      lastUpdated: new Date().toISOString()
    };

    const jsonContent = JSON.stringify(settingsToSave, null, 2);
    console.log('[SettingsStore] JSON content length:', jsonContent.length);
    
    fs.writeFileSync(SETTINGS_FILE, jsonContent, 'utf8');
    
    console.log('[SettingsStore] File written successfully');
    console.log('[SettingsStore] Verifying file exists:', fs.existsSync(SETTINGS_FILE));
    
    if (fs.existsSync(SETTINGS_FILE)) {
      const stats = fs.statSync(SETTINGS_FILE);
      console.log('[SettingsStore] File size after write:', stats.size, 'bytes');
    }
    
    console.log('[SettingsStore] Settings saved successfully');
    console.log('[SettingsStore] Storage location:', SETTINGS_FILE);
    
    return true;
  } catch (error) {
    console.error('[SettingsStore] Error saving settings:', error);
    console.error('[SettingsStore] Error stack:', error.stack);
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
 * Load customers from persistent storage
 * @returns {Array} Array of customer objects
 */
export function loadCustomers() {
  try {
    console.log('[SettingsStore] loadCustomers() called');
    console.log('[SettingsStore] Checking file:', CUSTOMERS_FILE);
    console.log('[SettingsStore] File exists:', fs.existsSync(CUSTOMERS_FILE));
    
    if (!fs.existsSync(CUSTOMERS_FILE)) {
      console.log('[SettingsStore] Customers file not found, returning empty array');
      return [];
    }

    const data = fs.readFileSync(CUSTOMERS_FILE, 'utf8');
    console.log('[SettingsStore] Raw file content length:', data.length);
    
    const customers = JSON.parse(data);
    console.log('[SettingsStore] Customers loaded successfully, count:', customers.length);
    
    return customers;
  } catch (error) {
    console.error('[SettingsStore] Error loading customers:', error);
    console.error('[SettingsStore] Error stack:', error.stack);
    return [];
  }
}

/**
 * Save customers to persistent storage
 * @param {Array} customers - Array of customer objects
 * @returns {boolean} Success status
 */
export function saveCustomers(customers) {
  try {
    console.log('[SettingsStore] saveCustomers() called');
    console.log('[SettingsStore] Target file:', CUSTOMERS_FILE);
    console.log('[SettingsStore] Customers count:', customers.length);
    
    ensureStorageDir();
    
    console.log('[SettingsStore] Storage dir exists:', fs.existsSync(STORAGE_DIR));
    
    const jsonContent = JSON.stringify(customers, null, 2);
    console.log('[SettingsStore] JSON content length:', jsonContent.length);
    
    fs.writeFileSync(CUSTOMERS_FILE, jsonContent, 'utf8');
    
    console.log('[SettingsStore] File written successfully');
    console.log('[SettingsStore] Verifying file exists:', fs.existsSync(CUSTOMERS_FILE));
    
    if (fs.existsSync(CUSTOMERS_FILE)) {
      const stats = fs.statSync(CUSTOMERS_FILE);
      console.log('[SettingsStore] File size after write:', stats.size, 'bytes');
    }
    
    console.log('[SettingsStore] Customers saved successfully');
    console.log('[SettingsStore] Storage location:', CUSTOMERS_FILE);
    
    return true;
  } catch (error) {
    console.error('[SettingsStore] Error saving customers:', error);
    console.error('[SettingsStore] Error stack:', error.stack);
    return false;
  }
}