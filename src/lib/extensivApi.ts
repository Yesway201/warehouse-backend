// Extensiv 3PL Warehouse Manager API Client
// Updated to use Railway backend URL from environment variable

// ✅ FIXED: Use same environment variable as credentialStorage.ts
const RAILWAY_API_URL = import.meta.env.VITE_API_BASE_URL || 'https://warehouse-backend-production-4200.up.railway.app';

console.log('[ExtensivAPI] 🔍 Using backend URL:', RAILWAY_API_URL);

interface ExtensivCredentials {
  clientId: string;
  clientSecret: string;
  userLoginId: string;
  facilityId: string;
}

interface ExtensivItemResponse {
  id?: number;
  sku?: string;
  description?: string;
  isActive?: boolean;
  // Alternative field names
  ItemId?: number;
  SKU?: string;
  Description?: string;
  IsActive?: boolean;
}

interface Item {
  itemNumber: string;
  description: string;
  uom: string;
  category: string;
  customerId: string;
  barcode?: string;
  extensivId?: string;
  isActive?: boolean;
  lastSyncedAt?: string;
}

interface SyncDiagnostics {
  customerId: string | null;
  request: {
    urlTemplate: string;
    pgsiz: number;
    pagesRequested: number[];
    lastUrlCalled: string | null;
  };
  response: {
    httpStatusByPage: Array<{ page: number; status: number }>;
    rawSnippetByPage: Array<{ page: number; snippet: string }>;
    detectedItemsPath: string;
    itemsFoundByPage: Array<{ page: number; count: number }>;
    totalItemsExtracted: number;
  };
  storage: {
    upsertKey: string;
    inserted: number;
    updated: number;
    finalTotalForCustomer: number;
  };
}

interface DiagnosticInfo {
  error?: string;
  rawResponse?: string;
  exception?: string;
  status?: number;
  url?: string;
  [key: string]: unknown;
}

interface SyncResult {
  success: boolean;
  newItems: number;
  updatedItems: number;
  totalItems: number;
  error?: string;
  diagnostics?: SyncDiagnostics | DiagnosticInfo;
}

interface TestConnectionResult {
  success: boolean;
  error?: string;
  diagnostics?: DiagnosticInfo;
}

interface SendReceivingResult {
  success: boolean;
  receiverId?: string | number;
  receiverNumber?: string;
  referenceNumber?: string;
  error?: string;
  details?: string;
}

interface ReceivingSessionPayload {
  id: string;
  customerName: string;
  customerId: string;
  containerNumber: string;
  poNumber?: string;
  startedBy: string;
  startedAt: string;
  completedAt?: string;
  type?: string;
  reviewNotes?: string;
  items: Array<{
    itemNumber: string;
    description: string;
    expectedQty: number;
    receivedQty: number;
    uom: string;
    condition: string;
    notes?: string;
  }>;
}

/**
 * Test connection - ONLY validates OAuth token via Railway Backend
 */
export async function testConnection(credentials: ExtensivCredentials): Promise<TestConnectionResult> {
  console.log('[Frontend] Testing connection via Railway Backend...');
  
  try {
    const url = `${RAILWAY_API_URL}/api/extensiv/test-connection`;
    console.log('[Frontend] POST', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        userLoginId: credentials.userLoginId,
      }),
    });

    // ALWAYS read as text first
    const text = await response.text();
    console.log('[Frontend] Response status:', response.status);
    console.log('[Frontend] Response text:', text);

    if (!response.ok) {
      console.error('[Frontend] Connection test failed with status:', response.status);
      
      // Try to parse as JSON for structured error
      let errorData: DiagnosticInfo;
      try {
        errorData = JSON.parse(text) as DiagnosticInfo;
      } catch {
        errorData = { 
          error: 'Backend returned non-JSON response', 
          rawResponse: text,
          status: response.status,
          url: url
        };
      }
      
      return { 
        success: false, 
        error: errorData.error || `HTTP ${response.status}`,
        diagnostics: errorData
      };
    }

    // Try to parse success response
    let data: { success: boolean; error?: string };
    try {
      data = JSON.parse(text) as { success: boolean; error?: string };
    } catch (parseError) {
      console.error('[Frontend] Failed to parse success response as JSON');
      return {
        success: false,
        error: 'Backend returned non-JSON response',
        diagnostics: { rawResponse: text, status: response.status, url: url }
      };
    }
    
    if (data.success) {
      console.log('[Frontend] ✅ Connection test successful');
      return { success: true };
    } else {
      console.error('[Frontend] Connection test failed:', data.error);
      return { 
        success: false, 
        error: data.error || 'Connection test failed', 
        diagnostics: { ...data as DiagnosticInfo, status: response.status, url: url }
      };
    }
  } catch (error) {
    console.error('[Frontend] Connection test error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      diagnostics: { 
        exception: error instanceof Error ? error.stack : String(error),
        url: `${RAILWAY_API_URL}/api/extensiv/test-connection`
      }
    };
  }
}

/**
 * Transform Extensiv item to our format
 */
function transformItem(extensivItem: ExtensivItemResponse, customerId: string): Item {
  const id = extensivItem.id || extensivItem.ItemId || 0;
  const sku = extensivItem.sku || extensivItem.SKU || '';
  const description = extensivItem.description || extensivItem.Description || '';
  const isActive = extensivItem.isActive !== undefined ? extensivItem.isActive : 
                   extensivItem.IsActive !== undefined ? extensivItem.IsActive : true;

  return {
    itemNumber: sku,
    description,
    uom: 'EA',
    category: 'Uncategorized',
    customerId,
    extensivId: id.toString(),
    isActive,
    lastSyncedAt: new Date().toISOString(),
  };
}

/**
 * Main sync function - calls Railway Backend which handles Extensiv API
 * Returns comprehensive diagnostics for troubleshooting
 */
export async function syncItemsFromExtensiv(
  credentials: ExtensivCredentials,
  customerId: string
): Promise<SyncResult> {
  try {
    console.log('[Frontend] ========================================');
    console.log('[Frontend] Starting sync via Railway Backend for customer:', customerId);
    console.log('[Frontend] Backend will handle OAuth + pagination');
    console.log('[Frontend] ========================================');

    const url = `${RAILWAY_API_URL}/api/extensiv/sync-items`;
    console.log('[Frontend] POST', url);

    // Call Railway Backend to sync items
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        userLoginId: credentials.userLoginId,
        customerId: customerId,
      }),
    });

    // ALWAYS read as text first
    const text = await response.text();
    console.log('[Frontend] Response status:', response.status);
    console.log('[Frontend] Response text (first 500 chars):', text.substring(0, 500));

    if (!response.ok) {
      console.error('[Frontend] Sync failed with status:', response.status);
      
      // Try to parse as JSON for structured error
      let errorData: { error?: string; diagnostics?: SyncDiagnostics };
      try {
        errorData = JSON.parse(text) as { error?: string; diagnostics?: SyncDiagnostics };
      } catch {
        errorData = { 
          error: 'Backend returned non-JSON response',
          diagnostics: {
            customerId: customerId,
            request: {
              urlTemplate: 'https://secure-wms.com/customers/{customerId}/items',
              pgsiz: 100,
              pagesRequested: [],
              lastUrlCalled: null,
            },
            response: {
              httpStatusByPage: [{ page: 1, status: response.status }],
              rawSnippetByPage: [{ page: 1, snippet: text.substring(0, 300) }],
              detectedItemsPath: 'none',
              itemsFoundByPage: [],
              totalItemsExtracted: 0,
            },
            storage: {
              upsertKey: 'customerId+itemNumber',
              inserted: 0,
              updated: 0,
              finalTotalForCustomer: 0,
            },
          } as SyncDiagnostics
        };
      }
      
      return {
        success: false,
        newItems: 0,
        updatedItems: 0,
        totalItems: 0,
        error: errorData.error || `HTTP ${response.status}`,
        diagnostics: errorData.diagnostics
      };
    }

    // Try to parse success response
    let data: { 
      success: boolean; 
      error?: string; 
      items: ExtensivItemResponse[];
      diagnostics?: SyncDiagnostics;
    };
    try {
      data = JSON.parse(text) as { 
        success: boolean; 
        error?: string; 
        items: ExtensivItemResponse[];
        diagnostics?: SyncDiagnostics;
      };
    } catch (parseError) {
      console.error('[Frontend] Failed to parse success response as JSON');
      return {
        success: false,
        newItems: 0,
        updatedItems: 0,
        totalItems: 0,
        error: 'Backend returned non-JSON response',
        diagnostics: {
          customerId: customerId,
          request: {
            urlTemplate: 'https://secure-wms.com/customers/{customerId}/items',
            pgsiz: 100,
            pagesRequested: [],
            lastUrlCalled: null,
          },
          response: {
            httpStatusByPage: [{ page: 1, status: response.status }],
            rawSnippetByPage: [{ page: 1, snippet: text.substring(0, 300) }],
            detectedItemsPath: 'none',
            itemsFoundByPage: [],
            totalItemsExtracted: 0,
          },
          storage: {
            upsertKey: 'customerId+itemNumber',
            inserted: 0,
            updated: 0,
            finalTotalForCustomer: 0,
          },
        } as SyncDiagnostics
      };
    }

    if (!data.success) {
      console.error('[Frontend] Sync failed:', data.error);
      return {
        success: false,
        newItems: 0,
        updatedItems: 0,
        totalItems: 0,
        error: data.error || 'Sync failed',
        diagnostics: data.diagnostics
      };
    }

    console.log('[Frontend] Backend returned', data.items.length, 'items');

    // Transform items to our format
    const transformedItems = data.items
      .map((item: ExtensivItemResponse) => transformItem(item, customerId))
      .filter((item: Item) => item.itemNumber);

    console.log('[Frontend] Transformed items:', transformedItems.length);

    // Store in localStorage
    const sessionId = 'warehouse_mgmt';
    const tableName = 'extensiv_items';
    const storageKey = `${sessionId}_${tableName}`;
    
    const existingJson = localStorage.getItem(storageKey);
    const existingItems: Item[] = existingJson ? JSON.parse(existingJson) : [];
    
    // Remove old items for this customer
    const otherCustomerItems = existingItems.filter(item => item.customerId !== customerId);
    
    // Track new vs updated
    const existingItemsMap = new Map(
      existingItems
        .filter(item => item.customerId === customerId)
        .map(item => [item.itemNumber, item])
    );
    
    let newItems = 0;
    let updatedItems = 0;
    
    for (const item of transformedItems) {
      if (existingItemsMap.has(item.itemNumber)) {
        updatedItems++;
      } else {
        newItems++;
      }
    }
    
    // Save updated items
    const updatedAllItems = [...otherCustomerItems, ...transformedItems];
    localStorage.setItem(storageKey, JSON.stringify(updatedAllItems));
    
    // Update diagnostics with actual storage results
    if (data.diagnostics) {
      data.diagnostics.storage.inserted = newItems;
      data.diagnostics.storage.updated = updatedItems;
      data.diagnostics.storage.finalTotalForCustomer = transformedItems.length;
    }
    
    // Update sync status
    const syncStatusKey = `${sessionId}_extensiv_items_sync_status`;
    const syncStatusJson = localStorage.getItem(syncStatusKey);
    const syncStatuses = syncStatusJson ? JSON.parse(syncStatusJson) : [];
    syncStatuses.push({
      customer_id: customerId,
      last_sync_at: new Date().toISOString(),
      items_count: transformedItems.length,
      status: 'success',
    });
    localStorage.setItem(syncStatusKey, JSON.stringify(syncStatuses));

    console.log('[Frontend] ✅ Sync completed successfully');
    console.log('[Frontend] New:', newItems, 'Updated:', updatedItems, 'Total:', transformedItems.length);

    return {
      success: true,
      newItems,
      updatedItems,
      totalItems: transformedItems.length,
      diagnostics: data.diagnostics,
    };
  } catch (error) {
    console.error('[Frontend] ❌ Sync failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return {
      success: false,
      newItems: 0,
      updatedItems: 0,
      totalItems: 0,
      error: errorMessage,
      diagnostics: {
        customerId: customerId,
        request: {
          urlTemplate: 'https://secure-wms.com/customers/{customerId}/items',
          pgsiz: 100,
          pagesRequested: [],
          lastUrlCalled: null,
        },
        response: {
          httpStatusByPage: [],
          rawSnippetByPage: [],
          detectedItemsPath: 'none',
          itemsFoundByPage: [],
          totalItemsExtracted: 0,
        },
        storage: {
          upsertKey: 'customerId+itemNumber',
          inserted: 0,
          updated: 0,
          finalTotalForCustomer: 0,
        },
      } as SyncDiagnostics
    };
  }
}

/**
 * Send receiving transaction to Extensiv
 * UPDATED: Now accepts credentials in request body (like sync-items)
 */
export async function sendReceivingToExtensiv(
  credentials: ExtensivCredentials,
  receivingSession: ReceivingSessionPayload
): Promise<SendReceivingResult> {
  try {
    console.log('[Frontend] ========================================');
    console.log('[Frontend] Sending receiving transaction to Extensiv...');
    console.log('[Frontend] Session ID:', receivingSession.id);
    console.log('[Frontend] Customer:', receivingSession.customerName);
    console.log('[Frontend] Items:', receivingSession.items?.length);
    console.log('[Frontend] Using credentials from request body (like item sync)');
    console.log('[Frontend] ========================================');

    const url = `${RAILWAY_API_URL}/api/extensiv/send-receiving`;
    console.log('[Frontend] POST', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        userLoginId: credentials.userLoginId,
        facilityId: credentials.facilityId,
        receivingSession: receivingSession,
      }),
    });

    const text = await response.text();
    console.log('[Frontend] Response status:', response.status);
    console.log('[Frontend] Response text (first 500 chars):', text.substring(0, 500));

    if (!response.ok) {
      console.error('[Frontend] Send receiving failed with status:', response.status);
      
      let errorData: { error?: string; details?: string };
      try {
        errorData = JSON.parse(text) as { error?: string; details?: string };
      } catch {
        errorData = { 
          error: 'Backend returned non-JSON response',
          details: text.substring(0, 500)
        };
      }
      
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}`,
        details: errorData.details
      };
    }

    let data: { 
      success: boolean; 
      receiverId?: string | number;
      receiverNumber?: string;
      referenceNumber?: string;
      error?: string;
      details?: string;
    };
    try {
      data = JSON.parse(text) as { 
        success: boolean; 
        receiverId?: string | number;
        receiverNumber?: string;
        referenceNumber?: string;
        error?: string;
        details?: string;
      };
    } catch (parseError) {
      console.error('[Frontend] Failed to parse success response as JSON');
      return {
        success: false,
        error: 'Backend returned non-JSON response',
        details: text.substring(0, 500)
      };
    }

    if (!data.success) {
      console.error('[Frontend] Send receiving failed:', data.error);
      return {
        success: false,
        error: data.error || 'Failed to send receiving',
        details: data.details
      };
    }

    console.log('[Frontend] ✅ Receiving transaction sent successfully');
    console.log('[Frontend] Receiver ID:', data.receiverId);
    console.log('[Frontend] Receiver Number:', data.receiverNumber);

    return {
      success: true,
      receiverId: data.receiverId,
      receiverNumber: data.receiverNumber,
      referenceNumber: data.referenceNumber,
    };

  } catch (error) {
    console.error('[Frontend] ❌ Send receiving failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      details: error instanceof Error ? error.stack : String(error)
    };
  }
}

/**
 * Simplified wrapper to get all items from localStorage
 * Returns items as an array suitable for ASN dialog
 */
export async function syncExtensivItems(): Promise<Item[]> {
  const sessionId = 'warehouse_mgmt';
  const tableName = 'extensiv_items';
  const storageKey = `${sessionId}_${tableName}`;
  
  const existingJson = localStorage.getItem(storageKey);
  const items: Item[] = existingJson ? JSON.parse(existingJson) : [];
  
  console.log('[Frontend] Loaded', items.length, 'items from localStorage');
  return items;
}