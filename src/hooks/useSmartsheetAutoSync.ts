import { useEffect, useRef, useState } from 'react';
import { syncDeliveriesFromSmartsheet, type SyncResult } from '@/lib/smartsheetApi';
import { loadAppSettings } from '@/lib/appSettingsApi';
import { toast } from 'sonner';

interface AutoSyncConfig {
  enabled: boolean;
  intervalMinutes: number;
  syncOnStartup: boolean;
}

interface UseSmartsheetAutoSyncOptions {
  onSyncComplete?: (result: SyncResult) => void;
  onSyncError?: (error: SyncResult) => void;
  isConfigured: boolean;
}

export function useSmartsheetAutoSync(options: UseSmartsheetAutoSyncOptions) {
  const { onSyncComplete, onSyncError, isConfigured } = options;
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const backendLoadedRef = useRef(false);

  // Load config from localStorage (with backend hydration on first call)
  const getConfig = (): AutoSyncConfig => {
    return {
      enabled: localStorage.getItem('smartsheet_auto_sync_enabled') === 'true',
      intervalMinutes: parseInt(localStorage.getItem('smartsheet_auto_sync_interval') || '15'),
      syncOnStartup: localStorage.getItem('smartsheet_auto_sync_on_startup') === 'true',
    };
  };

  // Hydrate localStorage from backend (runs once on mount)
  const hydrateFromBackend = async (): Promise<AutoSyncConfig> => {
    try {
      const appSettings = await loadAppSettings();
      if (appSettings && appSettings.smartsheet_auto_sync_enabled !== undefined) {
        const config: AutoSyncConfig = {
          enabled: appSettings.smartsheet_auto_sync_enabled ?? false,
          intervalMinutes: appSettings.smartsheet_auto_sync_interval ?? 15,
          syncOnStartup: appSettings.smartsheet_auto_sync_on_startup ?? false,
        };
        // Write to localStorage so subsequent reads are fast
        localStorage.setItem('smartsheet_auto_sync_enabled', String(config.enabled));
        localStorage.setItem('smartsheet_auto_sync_interval', String(config.intervalMinutes));
        localStorage.setItem('smartsheet_auto_sync_on_startup', String(config.syncOnStartup));
        console.log('[AutoSync] Hydrated localStorage from backend settings');
        return config;
      }
    } catch (error) {
      console.warn('[AutoSync] Failed to hydrate from backend:', error);
    }
    return getConfig();
  };

  // Save config to localStorage
  const saveConfig = (config: Partial<AutoSyncConfig>) => {
    if (config.enabled !== undefined) {
      localStorage.setItem('smartsheet_auto_sync_enabled', String(config.enabled));
    }
    if (config.intervalMinutes !== undefined) {
      localStorage.setItem('smartsheet_auto_sync_interval', String(config.intervalMinutes));
    }
    if (config.syncOnStartup !== undefined) {
      localStorage.setItem('smartsheet_auto_sync_on_startup', String(config.syncOnStartup));
    }
  };

  // Perform sync
  const performSync = async (silent = false) => {
    if (!isConfigured) {
      if (!silent) {
        toast.error('Smartsheet is not configured');
      }
      return;
    }

    if (isSyncing) {
      return; // Prevent concurrent syncs
    }

    setIsSyncing(true);

    try {
      const result = await syncDeliveriesFromSmartsheet();
      
      if (!mountedRef.current) return;

      // FIXED: Use current client-side timestamp (already set by syncDeliveriesFromSmartsheet)
      const timestamp = new Date().toISOString();
      setLastSyncTime(timestamp);

      if (result.success) {
        if (!silent) {
          const diagnostics = result.diagnostics;
          const totalRows = diagnostics?.totalRows || 0;
          const imported = diagnostics?.includedCount || 0;
          const skipped = totalRows - imported;

          const summaryParts = [
            `Synced ${imported} deliveries`,
          ];

          if (skipped > 0) {
            summaryParts.push(`(${skipped} skipped)`);
          }

          toast.success(summaryParts.join(' '));
        }
        
        onSyncComplete?.(result);
      } else {
        if (!silent) {
          toast.error(`Auto-sync failed: ${result.error || 'Unknown error'}`);
        }
        onSyncError?.(result);
      }
    } catch (error) {
      if (!mountedRef.current) return;
      
      const errorResult: SyncResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
      
      if (!silent) {
        toast.error(`Auto-sync failed: ${errorResult.error}`);
      }
      onSyncError?.(errorResult);
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
      }
    }
  };

  // Start auto-sync interval
  const startAutoSync = (intervalMinutes: number) => {
    stopAutoSync(); // Clear any existing interval

    if (!isConfigured) {
      return;
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    
    intervalRef.current = setInterval(() => {
      performSync(true); // Silent sync
    }, intervalMs);

    console.log(`[AutoSync] Started with interval: ${intervalMinutes} minutes`);
  };

  // Stop auto-sync interval
  const stopAutoSync = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('[AutoSync] Stopped');
    }
  };

  // Initialize auto-sync on mount - hydrate from backend first
  useEffect(() => {
    mountedRef.current = true;

    const initAutoSync = async () => {
      // Hydrate localStorage from backend on first load
      let config: AutoSyncConfig;
      if (!backendLoadedRef.current) {
        config = await hydrateFromBackend();
        backendLoadedRef.current = true;
      } else {
        config = getConfig();
      }

      if (!mountedRef.current) return;

      // Sync on startup if enabled
      if (config.syncOnStartup && isConfigured) {
        console.log('[AutoSync] Performing startup sync...');
        performSync(true);
      }

      // Start auto-sync if enabled
      if (config.enabled && isConfigured) {
        startAutoSync(config.intervalMinutes);
      }
    };

    initAutoSync();

    return () => {
      mountedRef.current = false;
      stopAutoSync();
    };
  }, [isConfigured]);

  // Update interval when config changes
  const updateConfig = (newConfig: Partial<AutoSyncConfig>) => {
    const currentConfig = getConfig();
    const updatedConfig = { ...currentConfig, ...newConfig };
    
    saveConfig(newConfig);

    // Restart auto-sync if enabled
    if (updatedConfig.enabled && isConfigured) {
      startAutoSync(updatedConfig.intervalMinutes);
    } else {
      stopAutoSync();
    }
  };

  return {
    isSyncing,
    lastSyncTime,
    config: getConfig(),
    performSync,
    updateConfig,
    startAutoSync,
    stopAutoSync,
  };
}