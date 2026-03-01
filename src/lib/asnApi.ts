// ASN API Client - Connects frontend to backend PostgreSQL database
// Backend API: /workspace/warehouse-atoms/routes/asns.js
// Pattern: Following smartsheetApi.ts structure

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://warehouse-backend-production-4200.up.railway.app';

export interface ASNItem {
  itemNumber: string;
  description: string;
  expectedQty: number;
  uom: string;
  palletConfig?: {
    casesPerPallet: number;
    casesPerRow: number;
    rowsHigh: number;
  };
}

export interface BackendASN {
  id: string;
  asn_number: string;
  customer_id: string;
  delivery_id?: string | null;
  customer_name?: string;
  threel_id?: string;
  expected_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  items?: ASNItem[]; // ADDED: Items array
}

export interface CreateASNRequest {
  asn_number: string;
  customer_id: string;
  delivery_id?: string;
  expected_date?: string;
  status?: string;
  items?: ASNItem[]; // ADDED: Items array
}

export interface UpdateASNRequest {
  asn_number?: string;
  customer_id?: string;
  delivery_id?: string;
  expected_date?: string;
  status?: string;
  items?: ASNItem[]; // ADDED: Items array
}

/**
 * Robust fetch with JSON/text fallback
 * Same pattern as smartsheetApi.ts
 */
async function robustFetch(url: string, options: RequestInit = {}) {
  const timestamp = new Date().toISOString();
  
  try {
    console.log(`[ASN API] ${options.method || 'GET'} ${url}`);
    
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

      console.error(`[ASN API] Error ${response.status}:`, errorBody);
      
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
        url,
        timestamp,
        details: errorBody,
      };
    }

    // Success - parse JSON
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      console.log(`[ASN API] Success:`, data);
      return { success: true, data, timestamp, url };
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
    console.error(`[ASN API] Network error:`, error);
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
 * Fetch all ASNs from backend database
 * GET /api/asns
 */
export async function fetchASNs(): Promise<{
  success: boolean;
  asns?: BackendASN[];
  error?: string;
  details?: string;
}> {
  const result = await robustFetch(`${API_BASE_URL}/api/asns`, {
    method: 'GET',
  });

  if (result.success && Array.isArray(result.data)) {
    return {
      success: true,
      asns: result.data,
    };
  }

  return {
    success: false,
    error: result.error || 'Failed to fetch ASNs',
    details: result.details,
  };
}

/**
 * Create new ASN in backend database
 * POST /api/asns
 */
export async function createASN(asn: CreateASNRequest): Promise<{
  success: boolean;
  asn?: BackendASN;
  error?: string;
  details?: string;
}> {
  const result = await robustFetch(`${API_BASE_URL}/api/asns`, {
    method: 'POST',
    body: JSON.stringify(asn),
  });

  if (result.success && result.data) {
    return {
      success: true,
      asn: result.data,
    };
  }

  return {
    success: false,
    error: result.error || 'Failed to create ASN',
    details: result.details,
  };
}

/**
 * Update existing ASN in backend database
 * PUT /api/asns/:id
 */
export async function updateASN(id: string, updates: UpdateASNRequest): Promise<{
  success: boolean;
  asn?: BackendASN;
  error?: string;
  details?: string;
}> {
  const result = await robustFetch(`${API_BASE_URL}/api/asns/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });

  if (result.success && result.data) {
    return {
      success: true,
      asn: result.data,
    };
  }

  return {
    success: false,
    error: result.error || 'Failed to update ASN',
    details: result.details,
  };
}

/**
 * Delete ASN from backend database
 * DELETE /api/asns/:id
 */
export async function deleteASN(id: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
}> {
  const result = await robustFetch(`${API_BASE_URL}/api/asns/${id}`, {
    method: 'DELETE',
  });

  if (result.success) {
    return {
      success: true,
      message: result.data?.message || 'ASN deleted successfully',
    };
  }

  return {
    success: false,
    error: result.error || 'Failed to delete ASN',
    details: result.details,
  };
}

/**
 * Get stored ASNs from localStorage (cache)
 * Fallback for offline access
 */
export function getStoredASNs(): BackendASN[] {
  try {
    const stored = localStorage.getItem('backend_asns');
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('[ASN API] Failed to load stored ASNs:', error);
    return [];
  }
}

/**
 * Store ASNs in localStorage (cache)
 */
export function storeASNs(asns: BackendASN[]): void {
  try {
    localStorage.setItem('backend_asns', JSON.stringify(asns));
    localStorage.setItem('backend_asns_last_sync', new Date().toISOString());
    console.log(`[ASN API] Cached ${asns.length} ASNs to localStorage`);
  } catch (error) {
    console.error('[ASN API] Failed to store ASNs:', error);
  }
}

/**
 * Get last sync time
 */
export function getLastASNSyncTime(): string | null {
  return localStorage.getItem('backend_asns_last_sync');
}