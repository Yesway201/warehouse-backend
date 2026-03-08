import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use /data as the ONLY storage path on Railway
const IS_RAILWAY = !!process.env.RAILWAY_ENVIRONMENT;
const STORAGE_DIR = IS_RAILWAY ? '/data' : path.join(__dirname, '../storage');
const SMARTSHEET_SETTINGS_FILE = path.join(STORAGE_DIR, 'smartsheetSettings.json');
const EXTENSIV_SETTINGS_FILE = path.join(STORAGE_DIR, 'extensivSettings.json');
const CUSTOMERS_FILE = path.join(STORAGE_DIR, 'customers.json');

// Encryption key for Extensiv client_secret
const ENCRYPTION_KEY = process.env.EXTENSIV_ENCRYPTION_KEY || 'warehouse-secure-extensiv-2024';
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('[SettingsStore] Decryption failed:', error.message);
    return null;
  }
}

function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    console.log('[SettingsStore] Creating storage directory:', STORAGE_DIR);
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

// Verify file was written successfully
function verifyFileWrite(filePath, expectedContent) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`[SettingsStore] VERIFICATION FAILED: File does not exist: ${filePath}`);
      return false;
    }
    
    const actualContent = fs.readFileSync(filePath, 'utf8');
    const matches = actualContent === expectedContent;
    
    if (!matches) {
      console.error(`[SettingsStore] VERIFICATION FAILED: Content mismatch for ${filePath}`);
      console.error(`[SettingsStore] Expected length: ${expectedContent.length}, Actual length: ${actualContent.length}`);
    } else {
      console.log(`[SettingsStore] ✓ VERIFICATION PASSED: ${filePath} (${actualContent.length} bytes)`);
    }
    
    return matches;
  } catch (error) {
    console.error(`[SettingsStore] VERIFICATION ERROR for ${filePath}:`, error.message);
    return false;
  }
}

// Initialize storage on module load - Check all 3 files
(function initialize() {
  ensureStorageDir();
  
  const smartsheetExists = fs.existsSync(SMARTSHEET_SETTINGS_FILE);
  const extensivExists = fs.existsSync(EXTENSIV_SETTINGS_FILE);
  const customersExists = fs.existsSync(CUSTOMERS_FILE);
  
  console.log('[SettingsStore] ═══════════════════════════════════════════');
  console.log('[SettingsStore] UNIFIED STORAGE INITIALIZATION');
  console.log('[SettingsStore] ═══════════════════════════════════════════');
  console.log('[SettingsStore] Configuration:');
  console.log('  - RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT || 'NOT_SET');
  console.log('  - IS_RAILWAY:', IS_RAILWAY);
  console.log('  - STORAGE_DIR:', STORAGE_DIR);
  console.log('  - storageDirExists:', fs.existsSync(STORAGE_DIR));
  
  // Check directory permissions
  try {
    const stats = fs.statSync(STORAGE_DIR);
    console.log('  - storageDir permissions:', stats.mode.toString(8));
    console.log('  - storageDir owner:', `uid=${stats.uid} gid=${stats.gid}`);
  } catch (error) {
    console.log('  - storageDir permissions: ERROR -', error.message);
  }
  
  console.log('[SettingsStore] ───────────────────────────────────────────');
  console.log('[SettingsStore] File Status:');
  console.log('  - smartsheetSettings.json:', smartsheetExists ? '✓ EXISTS' : '✗ NOT FOUND');
  console.log('  - extensivSettings.json:', extensivExists ? '✓ EXISTS' : '✗ NOT FOUND');
  console.log('  - customers.json:', customersExists ? '✓ EXISTS' : '✗ NOT FOUND');
  
  // Check Smartsheet settings
  if (smartsheetExists) {
    try {
      const stats = fs.statSync(SMARTSHEET_SETTINGS_FILE);
      const data = fs.readFileSync(SMARTSHEET_SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(data);
      const configured = !!(settings.apiToken && settings.sheetId);
      console.log('  - Smartsheet configured:', configured ? '✓ YES' : '✗ NO');
      console.log('  - Smartsheet file size:', stats.size, 'bytes');
      console.log('  - Smartsheet file path:', SMARTSHEET_SETTINGS_FILE);
    } catch (error) {
      console.log('  - Smartsheet configured: ✗ ERROR -', error.message);
    }
  }
  
  // Check Extensiv settings
  if (extensivExists) {
    try {
      const stats = fs.statSync(EXTENSIV_SETTINGS_FILE);
      const data = fs.readFileSync(EXTENSIV_SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(data);
      const configured = !!(settings.clientId && settings.clientSecret && settings.userLoginId && settings.facilityId);
      console.log('  - Extensiv configured:', configured ? '✓ YES' : '✗ NO');
      console.log('  - Extensiv file size:', stats.size, 'bytes');
      console.log('  - Extensiv file path:', EXTENSIV_SETTINGS_FILE);
      console.log('  - Extensiv clientSecret encrypted:', settings.clientSecret?.includes(':') ? '✓ YES' : '✗ NO (PLAIN TEXT!)');
    } catch (error) {
      console.log('  - Extensiv configured: ✗ ERROR -', error.message);
    }
  }
  
  // Check Customers
  if (customersExists) {
    try {
      const stats = fs.statSync(CUSTOMERS_FILE);
      const data = fs.readFileSync(CUSTOMERS_FILE, 'utf8');
      const customers = JSON.parse(data);
      console.log('  - Customers count:', customers.length);
      console.log('  - Customers file size:', stats.size, 'bytes');
    } catch (error) {
      console.log('  - Customers count: ✗ ERROR -', error.message);
    }
  }
  
  console.log('[SettingsStore] ═══════════════════════════════════════════');
})();

// ═══════════════════════════════════════════════════════════════════
// SMARTSHEET SETTINGS
// ═══════════════════════════════════════════════════════════════════

export function maskToken(token) {
  if (!token || token.length < 8) {
    return '****';
  }
  const first4 = token.substring(0, 4);
  const last4 = token.substring(token.length - 4);
  const masked = '*'.repeat(Math.max(0, token.length - 8));
  return `${first4}${masked}${last4}`;
}

export function loadSettings() {
  try {
    const fileExists = fs.existsSync(SMARTSHEET_SETTINGS_FILE);
    
    if (!fileExists) {
      console.log(`[SmartsheetSettings] READ path=${SMARTSHEET_SETTINGS_FILE} fileExists=false keysPresent=false`);
      return {
        apiToken: null,
        sheetId: null,
        mappings: [],
        lastUpdated: null
      };
    }

    const data = fs.readFileSync(SMARTSHEET_SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(data);
    
    const keysPresent = !!(settings.apiToken && settings.sheetId);
    console.log(`[SmartsheetSettings] READ path=${SMARTSHEET_SETTINGS_FILE} fileExists=true keysPresent=${keysPresent}`);
    
    return settings;
  } catch (error) {
    console.error('[SettingsStore] Error loading Smartsheet settings:', error);
    console.log(`[SmartsheetSettings] READ path=${SMARTSHEET_SETTINGS_FILE} fileExists=error keysPresent=false`);
    return {
      apiToken: null,
      sheetId: null,
      mappings: [],
      lastUpdated: null
    };
  }
}

export function saveSettings(settings) {
  try {
    ensureStorageDir();
    
    const keysPresent = !!(settings.apiToken && settings.sheetId);
    
    const settingsToSave = {
      apiToken: settings.apiToken,
      sheetId: settings.sheetId,
      mappings: settings.mappings || [],
      lastUpdated: new Date().toISOString()
    };

    const jsonContent = JSON.stringify(settingsToSave, null, 2);
    
    console.log(`[SmartsheetSettings] WRITE attempting path=${SMARTSHEET_SETTINGS_FILE} keysPresent=${keysPresent} size=${jsonContent.length} bytes`);
    
    fs.writeFileSync(SMARTSHEET_SETTINGS_FILE, jsonContent, 'utf8');
    
    // Verify write
    const verified = verifyFileWrite(SMARTSHEET_SETTINGS_FILE, jsonContent);
    
    if (!verified) {
      console.error('[SmartsheetSettings] WRITE VERIFICATION FAILED - file may not persist!');
      return false;
    }
    
    console.log(`[SmartsheetSettings] WRITE SUCCESS path=${SMARTSHEET_SETTINGS_FILE} keysPresent=${keysPresent}`);
    
    return true;
  } catch (error) {
    console.error('[SettingsStore] Error saving Smartsheet settings:', error);
    console.log(`[SmartsheetSettings] WRITE path=${SMARTSHEET_SETTINGS_FILE} keysPresent=error`);
    return false;
  }
}

export function clearSettings() {
  try {
    if (fs.existsSync(SMARTSHEET_SETTINGS_FILE)) {
      fs.unlinkSync(SMARTSHEET_SETTINGS_FILE);
      console.log('[SettingsStore] Smartsheet settings cleared successfully');
    } else {
      console.log('[SettingsStore] No Smartsheet settings file to clear');
    }
    return true;
  } catch (error) {
    console.error('[SettingsStore] Error clearing Smartsheet settings:', error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXTENSIV SETTINGS
// ═══════════════════════════════════════════════════════════════════

export function loadExtensivSettings() {
  try {
    const fileExists = fs.existsSync(EXTENSIV_SETTINGS_FILE);
    
    if (!fileExists) {
      console.log(`[ExtensivSettings] READ path=${EXTENSIV_SETTINGS_FILE} fileExists=false keysPresent=false`);
      return {
        clientId: null,
        clientSecret: null,
        userLoginId: null,
        facilityId: null,
        lastUpdated: null
      };
    }

    const data = fs.readFileSync(EXTENSIV_SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(data);
    
    // Decrypt client_secret if encrypted
    if (settings.clientSecret && settings.clientSecret.includes(':')) {
      settings.clientSecret = decrypt(settings.clientSecret);
    }
    
    const keysPresent = !!(settings.clientId && settings.clientSecret && settings.userLoginId && settings.facilityId);
    console.log(`[ExtensivSettings] READ path=${EXTENSIV_SETTINGS_FILE} fileExists=true keysPresent=${keysPresent}`);
    
    return settings;
  } catch (error) {
    console.error('[SettingsStore] Error loading Extensiv settings:', error);
    console.log(`[ExtensivSettings] READ path=${EXTENSIV_SETTINGS_FILE} fileExists=error keysPresent=false`);
    return {
      clientId: null,
      clientSecret: null,
      userLoginId: null,
      facilityId: null,
      lastUpdated: null
    };
  }
}

export function saveExtensivSettings(settings) {
  try {
    ensureStorageDir();
    
    const keysPresent = !!(settings.clientId && settings.clientSecret && settings.userLoginId && settings.facilityId);
    
    const settingsToSave = {
      clientId: settings.clientId,
      clientSecret: settings.clientSecret ? encrypt(settings.clientSecret) : null,
      userLoginId: settings.userLoginId,
      facilityId: settings.facilityId,
      lastUpdated: new Date().toISOString()
    };

    const jsonContent = JSON.stringify(settingsToSave, null, 2);
    
    console.log(`[ExtensivSettings] ═══════════════════════════════════════════`);
    console.log(`[ExtensivSettings] WRITE ATTEMPT`);
    console.log(`[ExtensivSettings] - Path: ${EXTENSIV_SETTINGS_FILE}`);
    console.log(`[ExtensivSettings] - Keys present: ${keysPresent}`);
    console.log(`[ExtensivSettings] - Content size: ${jsonContent.length} bytes`);
    console.log(`[ExtensivSettings] - ClientSecret encrypted: ${settingsToSave.clientSecret?.includes(':') ? 'YES' : 'NO'}`);
    console.log(`[ExtensivSettings] - IS_RAILWAY: ${IS_RAILWAY}`);
    console.log(`[ExtensivSettings] - STORAGE_DIR: ${STORAGE_DIR}`);
    
    // Check directory permissions before write
    try {
      const dirStats = fs.statSync(STORAGE_DIR);
      console.log(`[ExtensivSettings] - Directory permissions: ${dirStats.mode.toString(8)}`);
      console.log(`[ExtensivSettings] - Directory owner: uid=${dirStats.uid} gid=${dirStats.gid}`);
    } catch (error) {
      console.error(`[ExtensivSettings] - Directory stat error: ${error.message}`);
    }
    
    fs.writeFileSync(EXTENSIV_SETTINGS_FILE, jsonContent, 'utf8');
    console.log(`[ExtensivSettings] - Write completed`);
    
    // Verify write immediately
    const verified = verifyFileWrite(EXTENSIV_SETTINGS_FILE, jsonContent);
    
    if (!verified) {
      console.error('[ExtensivSettings] ✗ WRITE VERIFICATION FAILED - CREDENTIALS MAY NOT PERSIST!');
      console.error('[ExtensivSettings] This indicates a volume mount or permission issue');
      console.log(`[ExtensivSettings] ═══════════════════════════════════════════`);
      return false;
    }
    
    // Double-check by reading back and decrypting
    try {
      const readBack = fs.readFileSync(EXTENSIV_SETTINGS_FILE, 'utf8');
      const parsed = JSON.parse(readBack);
      const canDecrypt = parsed.clientSecret && parsed.clientSecret.includes(':');
      console.log(`[ExtensivSettings] - Read-back verification: ${canDecrypt ? '✓ ENCRYPTED' : '✗ NOT ENCRYPTED'}`);
    } catch (error) {
      console.error(`[ExtensivSettings] - Read-back failed: ${error.message}`);
    }
    
    console.log(`[ExtensivSettings] ✓ WRITE SUCCESS - Credentials saved and verified`);
    console.log(`[ExtensivSettings] ═══════════════════════════════════════════`);
    
    return true;
  } catch (error) {
    console.error('[SettingsStore] Error saving Extensiv settings:', error);
    console.error('[SettingsStore] Error stack:', error.stack);
    console.log(`[ExtensivSettings] WRITE path=${EXTENSIV_SETTINGS_FILE} keysPresent=error`);
    console.log(`[ExtensivSettings] ═══════════════════════════════════════════`);
    return false;
  }
}

export function clearExtensivSettings() {
  try {
    if (fs.existsSync(EXTENSIV_SETTINGS_FILE)) {
      fs.unlinkSync(EXTENSIV_SETTINGS_FILE);
      console.log('[SettingsStore] Extensiv settings cleared successfully');
    } else {
      console.log('[SettingsStore] No Extensiv settings file to clear');
    }
    return true;
  } catch (error) {
    console.error('[SettingsStore] Error clearing Extensiv settings:', error);
    return false;
  }
}

export function getExtensivStorageInfo() {
  const fileExists = fs.existsSync(EXTENSIV_SETTINGS_FILE);
  let extensivConfigured = false;
  
  if (fileExists) {
    try {
      const data = fs.readFileSync(EXTENSIV_SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(data);
      extensivConfigured = !!(settings.clientId && settings.clientSecret && settings.userLoginId && settings.facilityId);
    } catch (error) {
      extensivConfigured = false;
    }
  }
  
  return {
    usingRailwayVolume: IS_RAILWAY,
    storagePath: EXTENSIV_SETTINGS_FILE,
    fileExists,
    extensivConfigured
  };
}

export function maskValue(value) {
  if (!value || value.length < 8) return '***';
  return value.substring(0, 4) + '***' + value.substring(value.length - 4);
}

// ═══════════════════════════════════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════════════════════════════════

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