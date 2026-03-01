import { useState } from 'react';
import { syncItemsFromExtensiv } from '@/lib/extensivApi';
import { loadExtensivCredentials } from '@/lib/credentialStorage';
import { showErrorToast } from '@/lib/errorToast';
import { toast } from 'sonner';
import { useData } from '@/contexts/DataContext';

// Item sync hook that fetches from Extensiv and updates DataContext
export const useItemSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem('last_extensiv_sync_time');
  });
  
  const { loadItemsFromBackend } = useData();

  const syncItems = async (customerId?: string) => {
    console.log('[useItemSync] Starting sync for customer:', customerId || 'all');
    
    // Load credentials - FIXED: Added await
    const credentials = await loadExtensivCredentials();
    
    // TEMPORARY DEBUG LOGGING - RIGHT BEFORE THE TOAST
    console.log('[useItemSync] 🔍 DEBUG - Credential check at line 21-26:');
    console.log('[useItemSync] 🔍 credentials object:', credentials);
    console.log('[useItemSync] 🔍 credentials type:', typeof credentials);
    console.log('[useItemSync] 🔍 credentials === null?', credentials === null);
    console.log('[useItemSync] 🔍 credentials === undefined?', credentials === undefined);
    
    if (credentials) {
      console.log('[useItemSync] 🔍 Credential field lengths (NO SECRETS):');
      console.log('[useItemSync] 🔍 clientIdLen:', credentials.clientId?.length || 0);
      console.log('[useItemSync] 🔍 clientSecretLen:', credentials.clientSecret?.length || 0);
      console.log('[useItemSync] 🔍 userLoginIdLen:', credentials.userLoginId?.length || 0);
      console.log('[useItemSync] 🔍 facilityIdLen:', credentials.facilityId?.length || 0);
      console.log('[useItemSync] 🔍 Has clientId?', !!credentials.clientId);
      console.log('[useItemSync] 🔍 Has clientSecret?', !!credentials.clientSecret);
      console.log('[useItemSync] 🔍 Has userLoginId?', !!credentials.userLoginId);
    }
    
    if (!credentials || !credentials.clientId || !credentials.clientSecret || !credentials.userLoginId) {
      console.error('[useItemSync] ❌ CREDENTIAL CHECK FAILED - Showing Missing Credentials toast');
      console.error('[useItemSync] ❌ Missing fields:', {
        noCredentials: !credentials,
        noClientId: !credentials?.clientId,
        noClientSecret: !credentials?.clientSecret,
        noUserLoginId: !credentials?.userLoginId,
      });
      
      showErrorToast({
        title: 'Missing Credentials',
        error: 'Please configure your Extensiv credentials in Settings → Extensiv Integration tab first.',
      });
      return;
    }

    // If no customerId provided, show error
    if (!customerId) {
      showErrorToast({
        title: 'Customer Required',
        error: 'Please select a specific customer from the dropdown to sync items.',
      });
      return;
    }

    setIsSyncing(true);

    try {
      console.log('[useItemSync] Calling syncItemsFromExtensiv...');
      
      // Fetch items from Extensiv through Atoms Backend (relative path)
      const result = await syncItemsFromExtensiv(
        {
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          userLoginId: credentials.userLoginId,
          facilityId: credentials.facilityId || '1',
        },
        customerId
      );

      if (result.success) {
        console.log('[useItemSync] Sync successful, reloading items from backend...');
        
        // Update last sync time
        const syncTime = new Date().toISOString();
        setLastSyncTime(syncTime);
        localStorage.setItem('last_extensiv_sync_time', syncTime);
        
        // Reload items from backend storage to update UI
        await loadItemsFromBackend(customerId);
        
        toast.success(
          `Sync completed: ${result.newItems} new, ${result.updatedItems} updated, ${result.totalItems} total items`
        );
      } else {
        console.error('[useItemSync] Sync failed:', result.error);
        showErrorToast({
          title: 'Sync Failed',
          error: result.error || 'Unknown error occurred',
          diagnostics: result.diagnostics,
        });
      }
    } catch (error) {
      console.error('[useItemSync] Exception during sync:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during sync';
      showErrorToast({
        title: 'Sync Failed',
        error: errorMessage,
        diagnostics: {
          exception: error instanceof Error ? error.stack : String(error),
          timestamp: new Date().toISOString(),
        },
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    syncItems,
    isSyncing,
    lastSyncTime,
  };
};