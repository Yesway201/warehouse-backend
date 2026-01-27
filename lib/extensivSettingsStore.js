import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use /data as the ONLY storage path on Railway
const IS_RAILWAY = !!process.env.RAILWAY_ENVIRONMENT;
const STORAGE_DIR = IS_RAILWAY ? '/data' : path.join(__dirname, '../storage');
const SETTINGS_FILE = path.join(STORAGE_DIR, 'extensivSettings.json');

// Encryption key for client_secret
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
    console.error('[ExtensivSettingsStore] Decryption failed:', error.message);
    return null;
  }
}

function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    console.log('[ExtensivSettingsStore] Creating storage directory:', STORAGE_DIR);
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

// Initialize storage on module load - NO MIGRATION
(function initialize() {
  ensureStorageDir();
  
  const fileExists = fs.existsSync(SETTINGS_FILE);
  
  console.log('[ExtensivSettingsStore] Configuration:');
  console.log('  - RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
  console.log('  - IS_RAILWAY:', IS_RAILWAY);
  console.log('  - STORAGE_DIR:', STORAGE_DIR);
  console.log('  - SETTINGS_FILE:', SETTINGS_FILE);
  console.log('  - storageDirExists:', fs.existsSync(STORAGE_DIR));
  console.log('  - fileExists:', fileExists);
  
  if (fileExists) {
    try {
      const stats = fs.statSync(SETTINGS_FILE);
      console.log('  - fileSize:', stats.size, 'bytes');
      console.log('  - fileModified:', stats.mtime.toISOString());
      
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(data);
      const configured = !!(settings.clientId && settings.clientSecret && settings.userLoginId && settings.facilityId);
      console.log('  - extensivConfigured:', configured);
    } catch (error) {
      console.log('  - extensivConfigured: false (error reading file)');
      console.log('  - readError:', error.message);
    }
  } else {
    console.log('  - extensivConfigured: false');
  }
})();

export function loadSettings() {
  try {
    const fileExists = fs.existsSync(SETTINGS_FILE);
    
    if (!fileExists) {
      console.log(`[ExtensivSettings] READ path=${SETTINGS_FILE} fileExists=false keysPresent=false`);
      return {
        clientId: null,
        clientSecret: null,
        userLoginId: null,
        facilityId: null,
        lastUpdated: null
      };
    }

    const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(data);
    
    if (settings.clientSecret && settings.clientSecret.includes(':')) {
      settings.clientSecret = decrypt(settings.clientSecret);
    }
    
    const keysPresent = !!(settings.clientId && settings.clientSecret && settings.userLoginId && settings.facilityId);
    console.log(`[ExtensivSettings] READ path=${SETTINGS_FILE} fileExists=true keysPresent=${keysPresent}`);
    
    return settings;
  } catch (error) {
    console.error('[ExtensivSettingsStore] Error loading settings:', error);
    console.log(`[ExtensivSettings] READ path=${SETTINGS_FILE} fileExists=error keysPresent=false`);
    return {
      clientId: null,
      clientSecret: null,
      userLoginId: null,
      facilityId: null,
      lastUpdated: null
    };
  }
}

export function saveSettings(settings) {
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
    fs.writeFileSync(SETTINGS_FILE, jsonContent, 'utf8');
    
    console.log(`[ExtensivSettings] WRITE path=${SETTINGS_FILE} keysPresent=${keysPresent}`);
    
    return true;
  } catch (error) {
    console.error('[ExtensivSettingsStore] Error saving settings:', error);
    console.log(`[ExtensivSettings] WRITE path=${SETTINGS_FILE} keysPresent=error`);
    return false;
  }
}

export function clearSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      fs.unlinkSync(SETTINGS_FILE);
      console.log('[ExtensivSettingsStore] Settings cleared successfully');
    } else {
      console.log('[ExtensivSettingsStore] No settings file to clear');
    }
    return true;
  } catch (error) {
    console.error('[ExtensivSettingsStore] Error clearing settings:', error);
    return false;
  }
}

export function getStorageInfo() {
  const fileExists = fs.existsSync(SETTINGS_FILE);
  let extensivConfigured = false;
  
  if (fileExists) {
    try {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(data);
      extensivConfigured = !!(settings.clientId && settings.clientSecret && settings.userLoginId && settings.facilityId);
    } catch (error) {
      extensivConfigured = false;
    }
  }
  
  return {
    usingRailwayVolume: IS_RAILWAY,
    storagePath: SETTINGS_FILE,
    fileExists,
    extensivConfigured
  };
}

export function maskValue(value) {
  if (!value || value.length < 8) return '***';
  return value.substring(0, 4) + '***' + value.substring(value.length - 4);
}
