// ⚠️ DO NOT MODIFY – Smartsheet stable working configuration
// This file is part of the STABLE BASELINE (smartsheet-stable-v1.0)
// Any changes may break the working Smartsheet integration
// See: server/SMARTSHEET_BASELINE.md for details

// Smartsheet API Client - Uses server-side stored credentials
// ⚠️ STABLE API BASE URL - DO NOT CHANGE BACK TO api.atoms.dev
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://warehouse-backend-production-4200.up.railway.app';

export interface SmartsheetDelivery {
  rowId: string;
  customerName: string;
  containerNumber: string;
  poNumber: string;
  expectedDeliveryDate: string;
  door: string;
  carrier: string;
  trackingNumber: string;
  status: string;
  statusRaw: string;
  poContainerRaw: string;
  done: boolean;
  asn: boolean;
  referenceNumber: string;
  extensivReceiptId: string;
}

export interface SmartsheetColumn {
  id: number;
  title: string;
  type: string;
  primary: boolean;
}

export interface SmartsheetSettings {
  apiTokenMasked: string | null;
  sheetId: string | null;
  mappings: Array<{
    smartsheetColumn: string;
    appField: string;
  }>;
  lastUpdated: string | null;
  configured: boolean;
}

export interface SyncResult {
  success: boolean;
  deliveries?: SmartsheetDelivery[];
  message?: string;
  error?: string;
  timestamp?: string;
  diagnostics?: {
    sheetId?: string;
    totalRowsInSheet?: number;
    importedCount?: number;
    skippedCount?: number;
    skipReasonsCount?: {
      done: number;
      missingCustomer: number;
      missingPoContainer: number;
      statusNotAllowed: number;
    };
    first10Processed?: Array<{
      rowId: string;
      customerName: string;
      poContainerRaw: string;
      statusRaw: string;
      doneRaw: boolean;
      decision: string;
      reason: string;
    }>;
    sampleSkipped?: Array<{
      rowId: string;
      customerName: string;
      poContainerRaw: string;
      statusRaw: string;
      doneRaw: boolean;
      reason: string;
    }>;
    allowedStatuses?: string[];
    columnMappings?: Array<{ smartsheetColumn: string; appField: string }>;
  };
  status?: number;
  details?: string;
  url?: string;
  isHtml?: boolean;
}

/**
 * Robust fetch with JSON/text fallback
 * ⚠️ STABLE FUNCTION - DO NOT MODIFY
 */
async function robustFetch(url: string, options: RequestInit = {}) {
  const timestamp = new Date().toISOString();
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // If response is not OK, try to read as text first
    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      let errorBody: string;
      
      if (contentType.includes('application/json')) {
        const json = await response.json();
        errorBody = JSON.stringify(json, null, 2);
      } else {
        errorBody = await response.text();
      }

      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
        url,
        timestamp,
        details: errorBody,
        isHtml: contentType.includes('text/html')
      };
    }

    // Success - parse JSON
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return { ...data, timestamp, url };
    } else {
      const text = await response.text();
      return {
        success: false,
        error: 'Server returned non-JSON response',
        details: text,
        timestamp,
        url,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      details: String(error),
      timestamp,
      url,
    };
  }
}

/**
 * Load Smartsheet settings from server
 * ⚠️ STABLE ENDPOINT - DO NOT MODIFY
 */
export async function loadSmartsheetSettings(): Promise<{
  success: boolean;
  settings?: SmartsheetSettings;
  error?: string;
  details?: string;
}> {
  return await robustFetch(`${API_BASE_URL}/api/smartsheet/settings`, {
    method: 'GET',
  });
}

/**
 * Save Smartsheet settings to server
 * ⚠️ STABLE ENDPOINT - DO NOT MODIFY
 */
export async function saveSmartsheetSettings(
  apiToken: string,
  sheetId: string,
  mappings: Array<{ smartsheetColumn: string; appField: string }>
): Promise<{
  success: boolean;
  message?: string;
  apiTokenMasked?: string;
  error?: string;
  details?: string;
}> {
  return await robustFetch(`${API_BASE_URL}/api/smartsheet/settings`, {
    method: 'POST',
    body: JSON.stringify({ apiToken, sheetId, mappings }),
  });
}

/**
 * Save only column mappings (without requiring API token)
 * NEW FUNCTION for updating mappings independently
 */
export async function saveSmartsheetMappings(
  mappings: Array<{ smartsheetColumn: string; appField: string }>
): Promise<{
  success: boolean;
  message?: string;
  mappings?: Array<{ smartsheetColumn: string; appField: string }>;
  error?: string;
  details?: string;
}> {
  return await robustFetch(`${API_BASE_URL}/api/smartsheet/mappings`, {
    method: 'PATCH',
    body: JSON.stringify({ mappings }),
  });
}

/**
 * Clear Smartsheet settings on server
 * ⚠️ STABLE ENDPOINT - DO NOT MODIFY
 */
export async function clearSmartsheetSettings(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  return await robustFetch(`${API_BASE_URL}/api/smartsheet/settings`, {
    method: 'DELETE',
  });
}

/**
 * Test Smartsheet connection using server-side stored credentials
 * ⚠️ STABLE ENDPOINT - DO NOT MODIFY
 */
export async function testSmartsheetConnection(): Promise<{
  success: boolean;
  message?: string;
  sheetName?: string;
  rowCount?: number;
  error?: string;
  status?: string | number;
  details?: string;
  url?: string;
  isHtml?: boolean;
}> {
  return await robustFetch(`${API_BASE_URL}/api/smartsheet/test-connection`, {
    method: 'POST',
  });
}

/**
 * Fetch all column names from Smartsheet
 * ⚠️ STABLE ENDPOINT - DO NOT MODIFY
 */
export async function fetchSmartsheetColumns(): Promise<{
  success: boolean;
  columns?: SmartsheetColumn[];
  sheetName?: string;
  error?: string;
  status?: string | number;
  details?: string;
}> {
  return await robustFetch(`${API_BASE_URL}/api/smartsheet/columns`, {
    method: 'GET',
  });
}

/**
 * Sync deliveries from Smartsheet using server-side stored credentials
 * ⚠️ FIXED: Always use current client-side timestamp for accurate "Last Sync" display
 */
export async function syncDeliveriesFromSmartsheet(): Promise<SyncResult> {
  // Use current client-side timestamp (not backend's timestamp)
  const clientTimestamp = new Date().toISOString();
  
  const result = await robustFetch(`${API_BASE_URL}/api/smartsheet/sync-deliveries`, {
    method: 'POST',
  });

  if (result.success && result.deliveries) {
    // Store deliveries in localStorage for offline access
    localStorage.setItem('smartsheet_deliveries', JSON.stringify(result.deliveries));
    // FIXED: Always use current client time, not backend's timestamp
    localStorage.setItem('smartsheet_last_sync', clientTimestamp);
    
    // Override result timestamp with client timestamp for consistency
    result.timestamp = clientTimestamp;
  }

  return result;
}

/**
 * Update a delivery in Smartsheet using server-side stored credentials
 * Supports: status, door, referenceNumber, extensivReceiptId
 */
export async function updateSmartsheetDelivery(
  rowId: string,
  updates: {
    referenceNumber?: string;
    extensivReceiptId?: string;
    status?: string;
    door?: string;
    asn?: boolean;
  }
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  diagnostics?: Record<string, unknown>;
}> {
  return await robustFetch(`${API_BASE_URL}/api/smartsheet/update-delivery`, {
    method: 'POST',
    body: JSON.stringify({ rowId, updates }),
  });
}

/**
 * Get stored deliveries from localStorage (cached)
 */
export function getStoredDeliveries(): SmartsheetDelivery[] {
  try {
    const stored = localStorage.getItem('smartsheet_deliveries');
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load stored deliveries:', error);
    return [];
  }
}

/**
 * Get last sync time
 */
export function getLastSyncTime(): string | null {
  return localStorage.getItem('smartsheet_last_sync');
}

/**
 * Clear cached deliveries (NOT credentials)
 */
export function clearCachedDeliveries(): void {
  localStorage.removeItem('smartsheet_deliveries');
  localStorage.removeItem('smartsheet_last_sync');
}

/**
 * Fallback copy to clipboard (works when navigator.clipboard is blocked)
 */
export function fallbackCopyToClipboard(text: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    console.error('Fallback copy failed:', error);
    return false;
  }
}

/**
 * Copy text to clipboard with fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('Clipboard API failed, trying fallback:', error);
    }
  }

  // Fallback to execCommand
  return fallbackCopyToClipboard(text);
}

/**
 * Format sync result for copying to clipboard
 */
export function formatSyncLogForCopy(result: SyncResult): string {
  return JSON.stringify(
    {
      timestamp: result.timestamp,
      url: result.url,
      success: result.success,
      error: result.error,
      message: result.message,
      status: result.status,
      details: result.details,
      diagnostics: result.diagnostics,
      deliveriesSample: result.deliveries?.slice(0, 5).map(d => ({
        rowId: d.rowId,
        customerName: d.customerName,
        poContainerRaw: d.poContainerRaw,
        statusRaw: d.statusRaw,
        status: d.status,
      })),
    },
    null,
    2
  );
}