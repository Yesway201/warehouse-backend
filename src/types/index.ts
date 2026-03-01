export type UserRole = 'dock' | 'office' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Customer {
  id: string;
  name: string;
  thirdPartyLogisticsId: string;
  emails: string[]; // Support up to 8 email addresses
  referencePrefix: string; // Letter prefix for reference numbers (e.g., "ABC")
  referenceCounter: number; // Current 4-digit sequential number
  createdAt: string;
  updatedAt: string;
}

export interface Delivery {
  id: string;
  customerId?: string;
  customerName: string;
  containerNumber: string;
  door: string;
  poNumber: string;
  expectedDate: string;
  status: 'scheduled' | 'in-transit' | 'arrived' | 'unloaded' | 'receiving' | 'completed' | string;
  notes: string;
  carrier?: string;
  trackingNumber?: string;
  asn?: boolean; // Smartsheet ASN checkbox - true = customer sent packing slip
  createdAt: string;
  updatedAt: string;
  smartsheetRowId?: string; // Smartsheet row ID for traceability
  rowId?: string; // Alias for smartsheetRowId (used by sync API)
}

export interface ASN {
  id: string;
  deliveryId: string;
  asnNumber?: string; // ADDED: ASN number for backend compatibility
  customerId?: string; // ADDED: Customer database ID
  customerName: string;
  containerNumber?: string; // Made optional since backend uses asnNumber
  door?: string; // Made optional
  poNumber?: string; // Made optional
  expectedDate?: string; // ADDED: Expected delivery date
  items: Array<{
    itemNumber: string;
    expectedQty: number;
    description: string;
    uom: string;
    palletConfig?: {
      casesPerPallet: number;
      casesPerRow: number;
      rowsHigh: number;
    };
  }>;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'active' | 'receiving'; // UPDATED: Added backend statuses
  createdBy?: string; // Made optional
  createdAt: string;
  specialInstructions?: string;
  syncStatus?: 'synced' | 'pending' | 'failed'; // ADDED: Track sync status with backend
  syncError?: string; // ADDED: Store sync error message if failed
  lastSyncAttempt?: string; // ADDED: Timestamp of last sync attempt
}

export interface PackingSlipRequest {
  id: string;
  deliveryId: string;
  requestedBy: string;
  requestedDate: string;
  dueDate: string;
  status: 'pending-customer' | 'ready-for-asn' | 'asn-created';
  customerEmail: string;
  customerEmails?: string[];
  remindersSent: number;
  notes: string;
  receivedDate?: string;
}

export interface ReceivingSession {
  id: string;
  asnId: string;
  poNumber: string;
  deliveryId: string;
  customerName?: string; // ADDED: For display purposes
  startedAt: string;
  completedAt?: string;
  receivedBy: string;
  status: 'in-progress' | 'pending-review' | 'approved' | 'review'; // UPDATED: Added new statuses
  items: Array<{
    itemNumber: string;
    description: string;
    quantityExpected: number;
    quantityReceived: number;
    condition: 'good' | 'damaged' | 'expired';
    lotNumber?: string;
    expirationDate?: string;
    notes?: string;
  }>;
  notes?: string;
  photos?: string[];
}

export interface ExtensivItem {
  itemNumber: string;
  description: string;
  uom: string;
  category: string;
  customerId: string;
  barcode?: string;
  lastUpdated: string;
  extensivId?: string;
}

export interface APIConfig {
  smartsheet?: {
    apiToken: string;
    sheetId: string;
    autoSync: boolean;
    syncInterval: number;
    columnMappings: {
      containerNumber: string;
      poNumber: string;
      expectedDate: string;
      door: string;
      status: string;
      carrier: string;
      trackingNumber: string;
      notes: string;
      customerName: string;
      done?: string; // ADDED: For "Done" column mapping
    };
    lastSync?: string;
  };
  extensiv?: {
    apiKey?: string;
    clientId?: string;
    clientSecret?: string;
    customerId?: string;
    facilityId?: string;
    userLoginId?: string;
    autoSync?: boolean;
    syncInterval?: number;
    lastSync?: string;
  };
}

export interface SyncLog {
  id: string;
  timestamp: string;
  source: 'smartsheet' | 'extensiv';
  action?: string;
  status: 'success' | 'error';
  details?: string;
  recordsProcessed?: number;
  message?: string;
}

export interface SmartsheetColumn {
  id: number;
  title: string;
  type: string;
  index: number;
}

export interface SmartsheetRow {
  id: number;
  cells: SmartsheetCell[];
}

export interface SmartsheetCell {
  columnId: number;
  value?: string | number | boolean;
  displayValue?: string;
}

export interface ExtensivItemResponse {
  id: string;
  item_number?: string;
  sku?: string;
  description?: string;
  name?: string;
  unit_of_measure?: string;
  category?: string;
  customer_id?: string;
  barcode?: string;
  upc?: string;
  updated_at?: string;
}

// Additional types for better type safety
export interface Item {
  id: string;
  itemNumber: string;
  description: string;
  uom: string;
  category: string;
  customerId: string;
  barcode?: string;
  lastUpdated: string;
}

export interface SlipRequest {
  id: string;
  deliveryId: string;
  requestedBy: string;
  requestedDate: string;
  dueDate: string;
  status: 'pending-customer' | 'ready-for-asn' | 'asn-created';
  customerEmail: string;
  customerEmails?: string[];
  remindersSent: number;
  notes: string;
  receivedDate?: string;
}