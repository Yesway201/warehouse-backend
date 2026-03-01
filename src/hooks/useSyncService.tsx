import { useData } from '@/contexts/DataContext';
import { smartsheetAPI, extensivAPI } from '@/lib/api';

export function useSyncService() {
  const { deliveries, syncFromSmartsheet, syncExtensivItems, apiConfig } = useData();

  const syncSmartsheetDeliveries = async () => {
    const beforeCount = deliveries.length;
    
    await syncFromSmartsheet();
    
    // After sync, deliveries will be updated via DataContext
    // We need to wait a bit for the state to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get the updated count from the context
    const afterCount = deliveries.length;
    
    // Return sync results for the UI
    return {
      success: true,
      newCount: Math.max(0, afterCount - beforeCount),
      updatedCount: Math.min(beforeCount, afterCount),
      total: afterCount,
    };
  };

  const syncExtensivItemsData = async () => {
    await syncExtensivItems();
    return { success: true };
  };

  const testSmartsheetConnection = async (credentials?: {
    apiToken: string;
    sheetId: string;
    columnMappings?: Record<string, string>;
  }) => {
    // Use provided credentials or fall back to context
    const config = credentials || apiConfig?.smartsheet;
    
    if (!config?.apiToken || !config?.sheetId) {
      throw new Error('Smartsheet configuration is missing');
    }

    const result = await smartsheetAPI.testConnection(
      config.apiToken,
      config.sheetId
    );
    return { success: true, sheetName: result.sheetName || 'Connected' };
  };

  const testExtensivConnection = async (credentials?: {
    apiKey: string;
    facilityId: string;
  }) => {
    // Use provided credentials or fall back to context
    const config = credentials || apiConfig?.extensiv;
    
    if (!config?.apiKey || !config?.facilityId) {
      throw new Error('Extensiv configuration is missing');
    }

    const result = await extensivAPI.testConnection(
      config.apiKey,
      config.facilityId
    );
    return { success: true, facilityName: result.facilityName || 'Connected' };
  };

  const autoDetectSmartsheetColumns = async () => {
    if (!apiConfig?.smartsheet) {
      throw new Error('Smartsheet configuration is missing');
    }

    const result = await smartsheetAPI.autoDetectColumns(
      apiConfig.smartsheet.apiToken,
      apiConfig.smartsheet.sheetId
    );
    return result.detectedMappings || apiConfig.smartsheet.columnMappings;
  };

  return {
    syncSmartsheetDeliveries,
    syncExtensivItemsData,
    testSmartsheetConnection,
    testExtensivConnection,
    autoDetectSmartsheetColumns,
  };
}