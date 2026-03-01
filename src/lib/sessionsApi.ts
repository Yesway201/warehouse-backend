// Sessions API Client - Connects frontend to backend PostgreSQL database
// Backend API: /workspace/warehouse-atoms/server/routes/sessions.js
// Replaces localStorage-based session storage for multi-user warehouse support

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://warehouse-backend-production-4200.up.railway.app';

export interface SessionItem {
  itemNumber: string;
  description: string;
  expectedQty: number;
  receivedQty: number;
  uom?: string;
  condition?: string;
  notes?: string;
  casesPerPallet?: number;
  fullPallets?: number;
  partialCases?: number;
  mixedPallet?: boolean;
  mixedPalletQty?: number;
  dimensions?: string;
  lotNumber?: string;
  expirationDate?: string;
}

export interface BackendSession {
  id: string;
  customerName?: string;
  customerId?: string;
  containerNumber?: string;
  poNumber?: string;
  status: string;
  type?: string;
  startedBy?: string;
  receivedBy?: string;
  startedAt?: string;
  completedAt?: string;
  referenceNumber?: string;
  reviewNotes?: string;
  notes?: string;
  items: SessionItem[];
  photos?: string[];
  asnId?: string;
  deliveryId?: string;
}

// Fetch all sessions from backend
export async function fetchSessions(filters?: { status?: string; customer_id?: string }): Promise<{ success: boolean; sessions: BackendSession[] }> {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.customer_id) params.set('customer_id', filters.customer_id);

    const queryString = params.toString();
    const url = `${API_BASE_URL}/api/sessions${queryString ? `?${queryString}` : ''}`;

    console.log('[SessionsAPI] Fetching sessions from:', url);
    const response = await fetch(url);

    if (!response.ok) {
      console.error('[SessionsAPI] Fetch failed:', response.status, response.statusText);
      return { success: false, sessions: [] };
    }

    const data = await response.json();
    console.log('[SessionsAPI] Fetched sessions:', data.sessions?.length || 0);
    return { success: true, sessions: data.sessions || [] };
  } catch (error) {
    console.error('[SessionsAPI] Fetch error:', error);
    return { success: false, sessions: [] };
  }
}

// Create or upsert a single session
export async function createSession(session: BackendSession): Promise<{ success: boolean; session?: BackendSession; error?: string }> {
  try {
    const url = `${API_BASE_URL}/api/sessions`;
    console.log('[SessionsAPI] Creating session:', session.id);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[SessionsAPI] Create failed:', response.status, errorData);
      return { success: false, error: errorData.error || response.statusText };
    }

    const data = await response.json();
    console.log('[SessionsAPI] Created session:', data.session?.id);
    return { success: true, session: data.session };
  } catch (error) {
    console.error('[SessionsAPI] Create error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

// Update an existing session
export async function updateSession(id: string, updates: Partial<BackendSession>): Promise<{ success: boolean; session?: BackendSession; error?: string }> {
  try {
    const url = `${API_BASE_URL}/api/sessions/${encodeURIComponent(id)}`;
    console.log('[SessionsAPI] Updating session:', id);

    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[SessionsAPI] Update failed:', response.status, errorData);
      return { success: false, error: errorData.error || response.statusText };
    }

    const data = await response.json();
    console.log('[SessionsAPI] Updated session:', data.session?.id);
    return { success: true, session: data.session };
  } catch (error) {
    console.error('[SessionsAPI] Update error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

// Delete a session
export async function deleteSession(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${API_BASE_URL}/api/sessions/${encodeURIComponent(id)}`;
    console.log('[SessionsAPI] Deleting session:', id);

    const response = await fetch(url, { method: 'DELETE' });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || response.statusText };
    }

    console.log('[SessionsAPI] Deleted session:', id);
    return { success: true };
  } catch (error) {
    console.error('[SessionsAPI] Delete error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

// Bulk upsert sessions (for migrating localStorage data to backend)
export async function bulkUpsertSessions(sessions: BackendSession[]): Promise<{ success: boolean; created: number; updated: number; errors: number }> {
  try {
    const url = `${API_BASE_URL}/api/sessions/bulk`;
    console.log('[SessionsAPI] Bulk upserting sessions:', sessions.length);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[SessionsAPI] Bulk upsert failed:', response.status, errorData);
      return { success: false, created: 0, updated: 0, errors: sessions.length };
    }

    const data = await response.json();
    console.log('[SessionsAPI] Bulk upsert result:', data);
    return data;
  } catch (error) {
    console.error('[SessionsAPI] Bulk upsert error:', error);
    return { success: false, created: 0, updated: 0, errors: sessions.length };
  }
}