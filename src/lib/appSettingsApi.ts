// App Settings API Client - Persists settings to backend server
// Replaces localStorage-based settings that were lost across browsers/devices

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://warehouse-backend-production-4200.up.railway.app';

export interface AppSettings {
  // Smartsheet Auto-Sync
  smartsheet_auto_sync_enabled?: boolean;
  smartsheet_auto_sync_interval?: number;
  smartsheet_auto_sync_on_startup?: boolean;

  // Item Database
  item_db_auto_sync?: boolean;
  item_db_sync_interval?: number;
  item_db_notifications?: boolean;
  item_db_low_stock?: number;
  item_db_sync_startup?: boolean;

  // Metadata
  lastUpdated?: string;
}

/**
 * Load all app settings from the backend server
 */
export async function loadAppSettings(): Promise<AppSettings> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/app-settings`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.error('[AppSettingsApi] Failed to load settings:', response.status);
      return {};
    }

    const data = await response.json();
    if (data.success && data.settings) {
      console.log('[AppSettingsApi] Settings loaded from backend');
      return data.settings;
    }

    return {};
  } catch (error) {
    console.error('[AppSettingsApi] Error loading settings:', error);
    return {};
  }
}

/**
 * Save app settings to the backend server (partial merge)
 */
export async function saveAppSettings(settings: Partial<AppSettings>): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/app-settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      console.error('[AppSettingsApi] Failed to save settings:', response.status);
      return false;
    }

    const data = await response.json();
    if (data.success) {
      console.log('[AppSettingsApi] Settings saved to backend');
      return true;
    }

    return false;
  } catch (error) {
    console.error('[AppSettingsApi] Error saving settings:', error);
    return false;
  }
}