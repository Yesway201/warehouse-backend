// Atoms Backend API Client
// Connects to Railway PostgreSQL backend for customers AND items

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://warehouse-backend-production-4200.up.railway.app';

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

interface Customer {
  id: string;
  name: string;
  thirdPartyLogisticsId: string;
  referencePrefix?: string;
  referenceCounter?: number;
  emails?: string[];
  createdAt: string;
  updatedAt: string;
}

interface SyncResult {
  success: boolean;
  newItems: number;
  updatedItems: number;
  totalItems: number;
  error?: string;
}

export const atomsBackend = {
  // Item Database Operations - Now using PostgreSQL backend

  async fetchItems(customerId?: string): Promise<Item[]> {
    try {
      console.log('[Atoms Backend] Fetching items from PostgreSQL...', customerId ? `customerId: ${customerId}` : 'all');
      const url = customerId
        ? `${API_BASE_URL}/api/items?customerId=${encodeURIComponent(customerId)}`
        : `${API_BASE_URL}/api/items`;

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.items)) {
        console.log(`[Atoms Backend] Fetched ${data.items.length} items from PostgreSQL`);
        return data.items;
      }

      // Handle case where response is directly an array
      if (Array.isArray(data)) {
        console.log(`[Atoms Backend] Fetched ${data.length} items from PostgreSQL (array response)`);
        return data;
      }

      throw new Error(data.error || 'Failed to fetch items');
    } catch (error) {
      console.error('[Atoms Backend] Failed to fetch items from PostgreSQL:', error);
      // Fallback to localStorage if backend is unreachable
      console.warn('[Atoms Backend] Falling back to localStorage for items');
      return this._fetchItemsFromLocalStorage(customerId);
    }
  },

  async getSyncStatus(customerId: string): Promise<{ lastSync: string; itemsCount: number } | null> {
    try {
      console.log('[Atoms Backend] Getting sync status from PostgreSQL for customer:', customerId);
      const response = await fetch(`${API_BASE_URL}/api/items/sync-status/${encodeURIComponent(customerId)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.lastSync) {
        return {
          lastSync: data.lastSync,
          itemsCount: data.itemsCount,
        };
      }

      return null;
    } catch (error) {
      console.error('[Atoms Backend] Failed to get sync status from PostgreSQL:', error);
      // Fallback to localStorage
      return this._getSyncStatusFromLocalStorage(customerId);
    }
  },

  async syncItems(customerId: string, items: Item[]): Promise<SyncResult> {
    try {
      console.log(`[Atoms Backend] Syncing ${items.length} items to PostgreSQL for customer: ${customerId}`);

      const response = await fetch(`${API_BASE_URL}/api/items/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, items }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log(`[Atoms Backend] Sync complete: ${data.newItems} new, ${data.updatedItems} updated, ${data.totalItems} total`);

        // Also update localStorage as cache
        this._syncItemsToLocalStorage(customerId, items);

        return {
          success: true,
          newItems: data.newItems,
          updatedItems: data.updatedItems,
          totalItems: data.totalItems,
        };
      }

      throw new Error(data.error || 'Failed to sync items');
    } catch (error) {
      console.error('[Atoms Backend] Failed to sync items to PostgreSQL:', error);
      // Fallback to localStorage
      console.warn('[Atoms Backend] Falling back to localStorage for sync');
      return this._syncItemsToLocalStorage(customerId, items);
    }
  },

  async addItem(itemData: Item): Promise<{ success: boolean }> {
    try {
      console.log('[Atoms Backend] Adding item to PostgreSQL:', itemData.itemNumber);

      const response = await fetch(`${API_BASE_URL}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: data.success };
    } catch (error) {
      console.error('[Atoms Backend] Failed to add item to PostgreSQL:', error);
      throw error;
    }
  },

  async updateItem(itemNumber: string, customerId: string, itemData: Partial<Item>): Promise<{ success: boolean }> {
    try {
      console.log('[Atoms Backend] Updating item in PostgreSQL:', itemNumber);

      const response = await fetch(`${API_BASE_URL}/api/items/${encodeURIComponent(itemNumber)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, ...itemData }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: data.success };
    } catch (error) {
      console.error('[Atoms Backend] Failed to update item in PostgreSQL:', error);
      throw error;
    }
  },

  async deleteItem(itemNumber: string, customerId: string): Promise<{ success: boolean }> {
    try {
      console.log('[Atoms Backend] Deleting item from PostgreSQL:', itemNumber);

      const response = await fetch(
        `${API_BASE_URL}/api/items/${encodeURIComponent(itemNumber)}?customerId=${encodeURIComponent(customerId)}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: data.success };
    } catch (error) {
      console.error('[Atoms Backend] Failed to delete item from PostgreSQL:', error);
      throw error;
    }
  },

  // ==========================================
  // localStorage fallback methods (for offline/error scenarios)
  // ==========================================

  _fetchItemsFromLocalStorage(customerId?: string): Item[] {
    try {
      const storageKey = 'warehouse_mgmt_extensiv_items';
      const dataJson = localStorage.getItem(storageKey);
      const allItems: Item[] = dataJson ? JSON.parse(dataJson) : [];
      if (customerId) {
        return allItems.filter(item => item.customerId === customerId);
      }
      return allItems;
    } catch {
      return [];
    }
  },

  _getSyncStatusFromLocalStorage(customerId: string): { lastSync: string; itemsCount: number } | null {
    try {
      const storageKey = 'warehouse_mgmt_extensiv_items_sync_status';
      const dataJson = localStorage.getItem(storageKey);
      const allStatus: Array<{ customer_id: string; last_sync_at: string; items_count: number }> = dataJson ? JSON.parse(dataJson) : [];
      const customerStatus = allStatus
        .filter(s => s.customer_id === customerId)
        .sort((a, b) => new Date(b.last_sync_at).getTime() - new Date(a.last_sync_at).getTime());
      if (customerStatus.length > 0) {
        return {
          lastSync: customerStatus[0].last_sync_at,
          itemsCount: customerStatus[0].items_count,
        };
      }
      return null;
    } catch {
      return null;
    }
  },

  _syncItemsToLocalStorage(customerId: string, items: Item[]): SyncResult {
    try {
      const storageKey = 'warehouse_mgmt_extensiv_items';
      const allItemsJson = localStorage.getItem(storageKey);
      const allItems: Item[] = allItemsJson ? JSON.parse(allItemsJson) : [];

      const existingItems = allItems.filter(item => item.customerId === customerId);
      const existingMap = new Map(existingItems.map(item => [item.itemNumber, item]));

      const otherCustomerItems = allItems.filter(item => item.customerId !== customerId);
      let newItems = 0;
      let updatedItems = 0;

      const processedItems: Item[] = items.map(item => {
        if (existingMap.has(item.itemNumber)) {
          updatedItems++;
        } else {
          newItems++;
        }
        return { ...item, customerId, lastSyncedAt: new Date().toISOString() };
      });

      localStorage.setItem(storageKey, JSON.stringify([...otherCustomerItems, ...processedItems]));

      // Update sync status
      const syncStatusKey = 'warehouse_mgmt_extensiv_items_sync_status';
      const syncStatusJson = localStorage.getItem(syncStatusKey);
      const syncStatuses = syncStatusJson ? JSON.parse(syncStatusJson) : [];
      syncStatuses.push({
        customer_id: customerId,
        last_sync_at: new Date().toISOString(),
        items_count: items.length,
        status: 'success',
      });
      localStorage.setItem(syncStatusKey, JSON.stringify(syncStatuses));

      return { success: true, newItems, updatedItems, totalItems: items.length };
    } catch {
      return { success: false, newItems: 0, updatedItems: 0, totalItems: 0, error: 'localStorage fallback failed' };
    }
  },

  // Customer Database Operations - Use PostgreSQL backend

  async fetchCustomers(): Promise<Customer[]> {
    try {
      console.log('[Atoms Backend] Fetching customers from PostgreSQL...');

      const response = await fetch(`${API_BASE_URL}/api/customers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.customers)) {
        console.log('[Atoms Backend] Fetched customers from PostgreSQL:', data.customers.length);
        return data.customers;
      }

      throw new Error(data.error || 'Failed to fetch customers');
    } catch (error) {
      console.error('[Atoms Backend] Failed to fetch customers from PostgreSQL:', error);
      throw error;
    }
  },

  async syncCustomers(customers: Customer[]): Promise<{ success: boolean; customers: Customer[]; count: number }> {
    try {
      console.log('[Atoms Backend] Syncing customers to PostgreSQL...', customers.length);

      const response = await fetch(`${API_BASE_URL}/api/customers/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customers }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.customers)) {
        console.log('[Atoms Backend] Synced customers to PostgreSQL:', data.customers.length);
        return {
          success: true,
          customers: data.customers,
          count: data.count
        };
      }

      throw new Error(data.error || 'Failed to sync customers');
    } catch (error) {
      console.error('[Atoms Backend] Failed to sync customers to PostgreSQL:', error);
      throw error;
    }
  },

  async saveCustomers(customers: Customer[]): Promise<{ success: boolean; count: number }> {
    // Alias for syncCustomers for backward compatibility
    const result = await this.syncCustomers(customers);
    return { success: result.success, count: result.count };
  },

  // Reference Number Operations

  /**
   * Get the next reference number for a customer (atomically increments counter).
   * Format: {prefix}{counter} e.g., "Asco1005"
   */
  async getNextReference(customerId: string, sessionId?: string): Promise<{
    success: boolean;
    referenceNumber?: string;
    prefix?: string;
    counter?: number;
    customerName?: string;
    error?: string;
  }> {
    try {
      console.log(`[Atoms Backend] Getting next reference for customer: ${customerId}`);
      const url = `${API_BASE_URL}/api/customers/${encodeURIComponent(customerId)}/next-reference${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log(`[Atoms Backend] ✅ Next reference: ${data.referenceNumber}`);
        return {
          success: true,
          referenceNumber: data.referenceNumber,
          prefix: data.prefix,
          counter: data.counter,
          customerName: data.customerName,
        };
      }

      throw new Error(data.error || 'Failed to get next reference');
    } catch (error) {
      console.error('[Atoms Backend] Failed to get next reference:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Preview the next reference number WITHOUT incrementing the counter.
   */
  async previewReference(customerId: string): Promise<{
    success: boolean;
    previewReference?: string;
    prefix?: string;
    currentCounter?: number;
    nextCounter?: number;
    error?: string;
  }> {
    try {
      console.log(`[Atoms Backend] Previewing reference for customer: ${customerId}`);
      const url = `${API_BASE_URL}/api/customers/${encodeURIComponent(customerId)}/preview-reference`;

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log(`[Atoms Backend] Preview reference: ${data.previewReference}`);
        return {
          success: true,
          previewReference: data.previewReference,
          prefix: data.prefix,
          currentCounter: data.currentCounter,
          nextCounter: data.nextCounter,
        };
      }

      throw new Error(data.error || 'Failed to preview reference');
    } catch (error) {
      console.error('[Atoms Backend] Failed to preview reference:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Rollback a reference number (decrement counter) if Extensiv submission fails.
   */
  async rollbackReference(customerId: string, expectedCounter: number, referenceNumber: string): Promise<{
    success: boolean;
    currentCounter?: number;
    error?: string;
  }> {
    try {
      console.log(`[Atoms Backend] Rolling back reference for customer: ${customerId} (expected: ${expectedCounter})`);
      const url = `${API_BASE_URL}/api/customers/${encodeURIComponent(customerId)}/rollback-reference`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedCounter, referenceNumber }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`[Atoms Backend] Rollback result:`, data);
      return data;
    } catch (error) {
      console.error('[Atoms Backend] Failed to rollback reference:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};