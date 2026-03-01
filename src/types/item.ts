export interface ItemData {
  itemNumber: string;
  description: string;
  uom: string;
  category: string;
  customerId: string;
  barcode?: string;
}

export interface ItemFromBackend {
  id: string;
  item_number: string;
  description: string;
  uom: string;
  category: string;
  customer_id: string;
  barcode?: string;
  extensiv_id?: string;
  last_updated: string;
  created_at: string;
}

export interface SyncStatus {
  id: string;
  customer_id: string;
  last_sync: string;
  items_count: number;
  created_at: string;
}

export interface SyncResult {
  success: boolean;
  newItems?: number;
  updatedItems?: number;
  totalItems?: number;
  error?: string;
}