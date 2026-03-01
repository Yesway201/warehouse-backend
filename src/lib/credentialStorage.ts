// Extensiv Credentials Storage - Backend API Version
// Migrated from localStorage to backend persistent storage

const LEGACY_STORAGE_KEY = 'warehouse_extensiv_credentials';
// ✅ FIXED: Use same environment variable as Smartsheet
const RAILWAY_API_URL = import.meta.env.VITE_API_BASE_URL || 'https://warehouse-backend-production-4200.up.railway.app';

// 🔍 DEBUG: Log the actual URL being used
console.log('[CredentialStorage] 🔍 DEBUG INFO:');
console.log('[CredentialStorage] import.meta.env.VITE_API_BASE_URL =', import.meta.env.VITE_API_BASE_URL);
console.log('[CredentialStorage] RAILWAY_API_URL =', RAILWAY_API_URL);
console.log('[CredentialStorage] All env vars:', import.meta.env);

interface ExtensivCredentials {
  clientId: string;
  clientSecret: string;
  userLoginId: string;
  facilityId: string;
}

interface CredentialsResponse {
  success: boolean;
  credentials?: ExtensivCredentials;
  settings?: {
    clientId: string | null;
    clientSecret: string | null;
    clientSecretMasked: boolean;
    userLoginId: string | null;
    facilityId: string | null;
    lastUpdated: string | null;
  };
  error?: string;
}

/**
 * One-time migration: Move localStorage credentials to backend
 * This runs automatically on first load
 */
async function migrateLocalStorageToBackend(): Promise<void> {
  try {
    // Check if we have localStorage credentials
    const localData = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!localData) {
      console.log('[CredentialStorage] No localStorage credentials to migrate');
      return;
    }

    // Check if backend already has credentials
    const existingResponse = await fetch(`${RAILWAY_API_URL}/api/extensiv-settings`);
    if (existingResponse.ok) {
      const existingData: CredentialsResponse = await existingResponse.json();
      if (existingData.credentials?.clientId) {
        console.log('[CredentialStorage] Backend already has credentials, skipping migration');
        // Clear localStorage since backend has credentials
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return;
      }
    }

    // Decrypt localStorage credentials (legacy CryptoJS format)
    console.log('[CredentialStorage] Migrating localStorage credentials to backend...');
    const CryptoJS = (await import('crypto-js')).default;
    const ENCRYPTION_KEY = 'warehouse-secure-2024';
    
    try {
      const bytes = CryptoJS.AES.decrypt(localData, ENCRYPTION_KEY);
      const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
      const credentials: ExtensivCredentials = JSON.parse(decryptedData);

      // Save to backend
      const saveResponse = await fetch(`${RAILWAY_API_URL}/api/extensiv-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (saveResponse.ok) {
        console.log('[CredentialStorage] ✅ Migration successful - credentials moved to backend');
        // Clear localStorage after successful migration
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } else {
        console.error('[CredentialStorage] Migration failed - backend save error');
      }
    } catch (decryptError) {
      console.error('[CredentialStorage] Failed to decrypt localStorage credentials:', decryptError);
    }
  } catch (error) {
    console.error('[CredentialStorage] Migration error:', error);
  }
}

// Run migration on module load
migrateLocalStorageToBackend().catch(console.error);

/**
 * Save Extensiv credentials to backend
 */
export async function saveExtensivCredentials(credentials: ExtensivCredentials): Promise<boolean> {
  try {
    console.log('[CredentialStorage] Saving credentials to backend...', RAILWAY_API_URL);
    
    const response = await fetch(`${RAILWAY_API_URL}/api/extensiv-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to save credentials');
    }

    const data = await response.json();
    console.log('[CredentialStorage] ✅ Credentials saved successfully');
    return data.success;
  } catch (error) {
    console.error('[CredentialStorage] Failed to save credentials:', error);
    throw new Error('Failed to save credentials to backend: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * Load Extensiv credentials from backend
 */
export async function loadExtensivCredentials(): Promise<ExtensivCredentials | null> {
  try {
    const url = `${RAILWAY_API_URL}/api/extensiv-settings`;
    console.log('[CredentialStorage] 🔍 Loading credentials from:', url);
    
    const response = await fetch(url);
    console.log('[CredentialStorage] 🔍 Response status:', response.status);
    console.log('[CredentialStorage] 🔍 Response ok:', response.ok);

    if (!response.ok) {
      console.error('[CredentialStorage] ❌ Failed to load credentials - HTTP', response.status);
      const errorText = await response.text();
      console.error('[CredentialStorage] ❌ Error response:', errorText);
      return null;
    }

    const data: CredentialsResponse = await response.json();
    console.log('[CredentialStorage] 🔍 Response data:', {
      success: data.success,
      hasCredentials: !!data.credentials,
      credentialsKeys: data.credentials ? Object.keys(data.credentials) : []
    });
    
    if (!data.success || !data.credentials) {
      console.log('[CredentialStorage] ❌ No credentials found in backend response');
      return null;
    }

    // Check if credentials are complete
    const creds = data.credentials;
    console.log('[CredentialStorage] 🔍 Checking credential completeness:', {
      hasClientId: !!creds.clientId,
      hasClientSecret: !!creds.clientSecret,
      hasUserLoginId: !!creds.userLoginId,
      hasFacilityId: !!creds.facilityId
    });
    
    if (!creds.clientId || !creds.clientSecret || !creds.userLoginId || !creds.facilityId) {
      console.log('[CredentialStorage] ❌ Incomplete credentials in backend');
      return null;
    }

    console.log('[CredentialStorage] ✅ Credentials loaded successfully');
    return creds;
  } catch (error) {
    console.error('[CredentialStorage] ❌ Failed to load credentials - Exception:', error);
    if (error instanceof Error) {
      console.error('[CredentialStorage] ❌ Error message:', error.message);
      console.error('[CredentialStorage] ❌ Error stack:', error.stack);
    }
    return null;
  }
}

/**
 * Clear saved credentials from backend
 */
export async function clearExtensivCredentials(): Promise<boolean> {
  try {
    console.log('[CredentialStorage] Clearing credentials from backend...');
    
    const response = await fetch(`${RAILWAY_API_URL}/api/extensiv-settings`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to clear credentials');
    }

    const data = await response.json();
    console.log('[CredentialStorage] ✅ Credentials cleared successfully');
    
    // Also clear any legacy localStorage
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    
    return data.success;
  } catch (error) {
    console.error('[CredentialStorage] Failed to clear credentials:', error);
    throw new Error('Failed to clear credentials from backend');
  }
}

/**
 * Check if credentials are saved in backend
 */
export async function hasStoredCredentials(): Promise<boolean> {
  try {
    const credentials = await loadExtensivCredentials();
    return credentials !== null;
  } catch (error) {
    console.error('[CredentialStorage] Error checking stored credentials:', error);
    return false;
  }
}

/**
 * Get storage status from backend
 */
export async function getStorageStatus(): Promise<{
  configured: boolean;
  usingRailwayVolume: boolean;
  lastUpdated: string | null;
}> {
  try {
    const response = await fetch(`${RAILWAY_API_URL}/api/extensiv-settings/status`);
    
    if (!response.ok) {
      return {
        configured: false,
        usingRailwayVolume: false,
        lastUpdated: null,
      };
    }

    const data = await response.json();
    return {
      configured: data.storage?.extensivConfigured || false,
      usingRailwayVolume: data.storage?.usingRailwayVolume || false,
      lastUpdated: null,
    };
  } catch (error) {
    console.error('[CredentialStorage] Error getting storage status:', error);
    return {
      configured: false,
      usingRailwayVolume: false,
      lastUpdated: null,
    };
  }
}

/**
 * @deprecated Use loadExtensivCredentials instead
 */
export function getExtensivCredentials(): ExtensivCredentials | null {
  console.warn('[CredentialStorage] getExtensivCredentials is deprecated, use loadExtensivCredentials (async) instead');
  // This function can't be async, so we return null and log a warning
  // Callers should migrate to the async version
  return null;
}