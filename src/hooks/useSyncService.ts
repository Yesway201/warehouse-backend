import { useCallback } from 'react';
import { useData } from '@/contexts/DataContext';
import { SmartsheetService } from '@/services/smartsheetService';
import { ExtensivService } from '@/services/extensivService';
import { Delivery, ReceivingSession } from '@/types';
import { toast } from 'sonner';

export function useSyncService() {
  const { apiConfig, addDelivery, updateDelivery, syncExtensivItems, addSyncLog } = useData();

  const syncSmartsheetDeliveries = useCallback(async () => {
    if (!apiConfig?.smartsheet?.apiToken || !apiConfig?.smartsheet?.sheetId) {
      throw new Error('Smartsheet is not configured');
    }

    try {
      const service = new SmartsheetService(apiConfig.smartsheet);
      const deliveries = await service.fetchDeliveries();

      let newCount = 0;
      let updatedCount = 0;

      for (const delivery of deliveries) {
        try {
          // Check if delivery exists
          const existing = await checkDeliveryExists(delivery.containerNumber);
          
          if (existing) {
            updateDelivery(existing.id, delivery);
            updatedCount++;
          } else {
            addDelivery(delivery);
            newCount++;
          }
        } catch (error) {
          console.error('Error processing delivery:', error);
        }
      }

      addSyncLog({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        source: 'smartsheet',
        action: 'fetch_deliveries',
        status: 'success',
        details: `Synced ${deliveries.length} deliveries (${newCount} new, ${updatedCount} updated)`,
      });

      return { success: true, newCount, updatedCount, total: deliveries.length };
    } catch (error) {
      addSyncLog({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        source: 'smartsheet',
        action: 'fetch_deliveries',
        status: 'error',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }, [apiConfig, addDelivery, updateDelivery, addSyncLog]);

  const updateSmartsheetStatus = useCallback(
    async (smartsheetRowId: number, status: string, completedAt?: string, notes?: string) => {
      if (!apiConfig?.smartsheet?.apiToken || !apiConfig?.smartsheet?.sheetId) {
        throw new Error('Smartsheet is not configured');
      }

      try {
        const service = new SmartsheetService(apiConfig.smartsheet);
        await service.updateDeliveryStatus(smartsheetRowId, status, completedAt, notes);

        addSyncLog({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          source: 'smartsheet',
          action: 'update_status',
          status: 'success',
          details: `Updated row ${smartsheetRowId} to status: ${status}`,
        });

        return { success: true };
      } catch (error) {
        addSyncLog({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          source: 'smartsheet',
          action: 'update_status',
          status: 'error',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
    [apiConfig, addSyncLog]
  );

  const addDeliveryToSmartsheet = useCallback(
    async (delivery: Delivery) => {
      if (!apiConfig?.smartsheet?.apiToken || !apiConfig?.smartsheet?.sheetId) {
        throw new Error('Smartsheet is not configured');
      }

      try {
        const service = new SmartsheetService(apiConfig.smartsheet);
        const rowId = await service.addDelivery(delivery);

        addSyncLog({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          source: 'smartsheet',
          action: 'add_delivery',
          status: 'success',
          details: `Added delivery ${delivery.containerNumber} to Smartsheet (Row ID: ${rowId})`,
        });

        return { success: true, rowId };
      } catch (error) {
        addSyncLog({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          source: 'smartsheet',
          action: 'add_delivery',
          status: 'error',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
    [apiConfig, addSyncLog]
  );

  const syncExtensivItemsService = useCallback(async () => {
    if (!apiConfig?.extensiv?.apiKey || !apiConfig?.extensiv?.facilityId) {
      throw new Error('Extensiv is not configured');
    }

    try {
      const service = new ExtensivService(apiConfig.extensiv);
      await syncExtensivItems();

      addSyncLog({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        source: 'extensiv',
        action: 'sync_items',
        status: 'success',
        details: 'Successfully synced items from Extensiv',
      });

      return { success: true };
    } catch (error) {
      addSyncLog({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        source: 'extensiv',
        action: 'sync_items',
        status: 'error',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }, [apiConfig, syncExtensivItems, addSyncLog]);

  const sendReceivingToExtensiv = useCallback(
    async (session: ReceivingSession) => {
      if (!apiConfig?.extensiv?.apiKey || !apiConfig?.extensiv?.facilityId) {
        throw new Error('Extensiv is not configured');
      }

      try {
        const service = new ExtensivService(apiConfig.extensiv);
        await service.sendReceivingTransaction(session);

        addSyncLog({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          source: 'extensiv',
          action: 'send_receiving',
          status: 'success',
          details: `Sent receiving transaction for ASN ${session.asnId}`,
        });

        return { success: true };
      } catch (error) {
        addSyncLog({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          source: 'extensiv',
          action: 'send_receiving',
          status: 'error',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
    [apiConfig, addSyncLog]
  );

  const testSmartsheetConnection = useCallback(async () => {
    if (!apiConfig?.smartsheet?.apiToken || !apiConfig?.smartsheet?.sheetId) {
      throw new Error('Smartsheet is not configured');
    }

    const service = new SmartsheetService(apiConfig.smartsheet);
    return await service.testConnection();
  }, [apiConfig]);

  const testExtensivConnection = useCallback(async () => {
    if (!apiConfig?.extensiv?.apiKey || !apiConfig?.extensiv?.facilityId) {
      throw new Error('Extensiv is not configured');
    }

    const service = new ExtensivService(apiConfig.extensiv);
    return await service.testConnection();
  }, [apiConfig]);

  const autoDetectSmartsheetColumns = useCallback(async () => {
    if (!apiConfig?.smartsheet?.apiToken || !apiConfig?.smartsheet?.sheetId) {
      throw new Error('Smartsheet is not configured');
    }

    const service = new SmartsheetService(apiConfig.smartsheet);
    return await service.autoDetectColumns();
  }, [apiConfig]);

  return {
    syncSmartsheetDeliveries,
    updateSmartsheetStatus,
    addDeliveryToSmartsheet,
    syncExtensivItemsService,
    sendReceivingToExtensiv,
    testSmartsheetConnection,
    testExtensivConnection,
    autoDetectSmartsheetColumns,
  };
}

// Helper function to check if delivery exists
async function checkDeliveryExists(containerNumber: string): Promise<Delivery | null> {
  // This would query your data context or backend
  // For now, returning null (treat all as new)
  return null;
}