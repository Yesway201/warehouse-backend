// Smartsheet Credentials Storage - Permanent localStorage persistence
// This module ensures credentials NEVER disappear unless explicitly cleared by user

const STORAGE_KEY = 'warehouse_smartsheet_credentials';

export interface SmartsheetCredentials {
  apiToken: string;
  sheetId: string;
  columnMapping: Array<{
    smartsheetColumn: string;
    appField: string;
  }>;
  lastValidatedAt: string;
}

/**
 * Save Smartsheet credentials to localStorage
 * These credentials will persist across:
 * - Browser refresh
 * - Atoms preview reload
 * - App Viewer reload
 * - Railway redeploy
 */
export function saveSmartsheetCredentials(credentials: SmartsheetCredentials): void {
  try {
    const data = {
      ...credentials,
      lastValidatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log('[SmartsheetStorage] Credentials saved to localStorage');
  } catch (error) {
    console.error('[SmartsheetStorage] Failed to save credentials:', error);
    throw new Error('Failed to save Smartsheet credentials');
  }
}

/**
 * Load Smartsheet credentials from localStorage
 * Returns null if no credentials are stored
 */
export function loadSmartsheetCredentials(): SmartsheetCredentials | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      console.log('[SmartsheetStorage] No credentials found in localStorage');
      return null;
    }
    
    const credentials = JSON.parse(stored) as SmartsheetCredentials;
    console.log('[SmartsheetStorage] Credentials loaded from localStorage');
    return credentials;
  } catch (error) {
    console.error('[SmartsheetStorage] Failed to load credentials:', error);
    return null;
  }
}

/**
 * Clear Smartsheet credentials from localStorage
 * Only called when user explicitly clicks "Clear Smartsheet Settings"
 */
export function clearSmartsheetCredentials(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[SmartsheetStorage] Credentials cleared from localStorage');
  } catch (error) {
    console.error('[SmartsheetStorage] Failed to clear credentials:', error);
    throw new Error('Failed to clear Smartsheet credentials');
  }
}

/**
 * Check if Smartsheet credentials exist in localStorage
 */
export function hasSmartsheetCredentials(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * Get credentials for API calls
 * All Smartsheet API calls MUST use this function to read credentials
 * DO NOT read from React state or context
 */
export function getSmartsheetCredentialsForAPI(): SmartsheetCredentials | null {
  return loadSmartsheetCredentials();
}