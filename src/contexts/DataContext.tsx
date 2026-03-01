import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Delivery, Item, ReceivingSession, APIConfig, Customer, SlipRequest, ASN, SyncLog } from '@/types';
import { toast } from 'sonner';
import * as smartsheetAPI from '@/lib/smartsheetApi';
import { itemsAPI, customersAPI } from '@/lib/api';
import * as asnAPI from '@/lib/asnApi';
import * as sessionsAPI from '@/lib/sessionsApi';

interface DataContextType {
  deliveries: Delivery[];
  items: Item[];
  receivingSessions: ReceivingSession[];
  apiConfig: APIConfig | null;
  customers: Customer[];
  slipRequests: SlipRequest[];
  asns: ASN[];
  extensivItems: Item[];
  syncLogs: SyncLog[];
  isLoading: boolean;
  addDelivery: (delivery: Delivery) => void;
  updateDelivery: (id: string, updates: Partial<Delivery>) => void;
  deleteDelivery: (id: string) => void;
  setDeliveries: (deliveries: Delivery[]) => void;
  addItem: (item: Item) => void;
  updateItem: (id: string, updates: Partial<Item>) => void;
  setItems: (items: Item[]) => void;
  setExtensivItems: (items: Item[]) => void;
  addReceivingSession: (session: ReceivingSession) => void;
  updateReceivingSession: (id: string, updates: Partial<ReceivingSession>) => void;
  updateAPIConfig: (config: APIConfig) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addSlipRequest: (request: SlipRequest) => void;
  updateSlipRequest: (id: string, updates: Partial<SlipRequest>) => void;
  addASN: (asn: ASN) => void;
  updateASN: (id: string, updates: Partial<ASN>) => void;
  deleteASN: (id: string) => void;
  retryASNSync: (id: string) => Promise<void>;
  syncFromSmartsheet: () => Promise<void>;
  syncExtensivItems: () => Promise<void>;
  addSyncLog: (log: SyncLog) => void;
  loadItemsFromBackend: (customerId?: string) => Promise<void>;
  loadCustomersFromBackend: () => Promise<void>;
  loadASNsFromBackend: () => Promise<void>;
  loadSessionsFromBackend: () => Promise<void>;
  getItemSyncStatus: (customerId: string) => Promise<SyncStatus | null>;
  forceFullSync: () => Promise<void>;
}

interface SyncStatus {
  lastSync: string;
  itemsCount: number;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Helper function to deduplicate customers by name (case-insensitive)
const deduplicateCustomers = (customers: Customer[]): Customer[] => {
  const customerMap = new Map<string, Customer>();
  
  customers.forEach(customer => {
    const normalizedName = customer.name.toLowerCase().trim();
    
    // Keep the customer with the most recent updatedAt timestamp
    const existing = customerMap.get(normalizedName);
    if (!existing || new Date(customer.updatedAt) > new Date(existing.updatedAt)) {
      customerMap.set(normalizedName, customer);
    }
  });
  
  return Array.from(customerMap.values());
};

// Helper function to convert backend ASN to frontend ASN format
const convertBackendASNToFrontend = (backendASN: asnAPI.BackendASN): ASN => {
  return {
    id: String(backendASN.id),
    deliveryId: backendASN.delivery_id || '',
    asnNumber: backendASN.asn_number,
    customerId: String(backendASN.customer_id),
    customerName: backendASN.customer_name || '',
    containerNumber: '',
    door: '',
    poNumber: '',
    items: backendASN.items || [],
    createdBy: '',
    createdAt: backendASN.created_at,
    status: backendASN.status as 'active' | 'completed' | 'cancelled',
    specialInstructions: '',
    syncStatus: 'synced', // Mark as synced since it came from backend
  };
};

// Helper function to convert frontend ASN to backend format
const convertFrontendASNToBackend = async (asn: Partial<ASN>, customers: Customer[]): Promise<asnAPI.CreateASNRequest | null> => {
  const asn_number = asn.asnNumber || asn.id;
  if (!asn_number) {
    console.error('[DataContext] ❌ Cannot convert ASN: missing asn_number and id');
    return null;
  }
  
  let customer_id = asn.customerId;
  
  if (!customer_id || customer_id.startsWith('CUST-') || customer_id.startsWith('ASN-')) {
    if (asn.customerName) {
      const customer = customers.find(c => c.name === asn.customerName);
      if (customer) {
        customer_id = customer.id;
        console.log(`[DataContext] 🔍 Found customer ID for "${asn.customerName}": ${customer_id}`);
      } else {
        console.error(`[DataContext] ❌ Cannot find customer ID for name: "${asn.customerName}"`);
        console.error('[DataContext] Available customers:', customers.map(c => ({ name: c.name, id: c.id })));
        
        console.log('[DataContext] 🔄 Attempting to sync customer to database...');
        try {
          const customerToSync: Customer = {
            id: `CUST-${Date.now()}`,
            name: asn.customerName,
            thirdPartyLogisticsId: `3PL-${asn.customerName.replace(/\s+/g, '-').toUpperCase()}`,
            emails: [],
            referencePrefix: 'REF',
            referenceCounter: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          const syncResult = await customersAPI.syncCustomers([customerToSync]);
          if (syncResult.success && syncResult.customers.length > 0) {
            const syncedCustomer = syncResult.customers[0];
            customer_id = syncedCustomer.id;
            console.log(`[DataContext] ✅ Customer synced to database with ID: ${customer_id}`);
          } else {
            console.error('[DataContext] ❌ Failed to sync customer to database');
            return null;
          }
        } catch (error) {
          console.error('[DataContext] ❌ Exception during customer sync:', error);
          return null;
        }
      }
    } else {
      console.error('[DataContext] ❌ Cannot convert ASN: missing both customerId and customerName');
      return null;
    }
  }
  
  const backendRequest: asnAPI.CreateASNRequest = {
    asn_number,
    customer_id,
    delivery_id: asn.deliveryId,
    expected_date: asn.expectedDate || null,
    status: asn.status || 'pending',
    items: asn.items || [],
  };
  
  console.log('[DataContext] ✅ Converted frontend ASN to backend format:', {
    asn_number: backendRequest.asn_number,
    customer_id: backendRequest.customer_id,
    delivery_id: backendRequest.delivery_id,
    items_count: backendRequest.items?.length || 0
  });
  
  return backendRequest;
};

// Helper function to migrate old session statuses
const migrateSessionStatuses = (sessions: ReceivingSession[]): ReceivingSession[] => {
  let migrated = false;
  
  const updatedSessions = sessions.map(session => {
    if (session.status === 'completed') {
      migrated = true;
      console.log(`[Migration] Fixing session ${session.id}: 'completed' -> 'pending-review'`);
      return { ...session, status: 'pending-review' as const };
    }
    return session;
  });
  
  if (migrated) {
    console.log('[Migration] Session statuses migrated successfully');
    toast.success('Session data updated - please refresh the page');
    localStorage.setItem('receivingSessions', JSON.stringify(updatedSessions));
  }
  
  return updatedSessions;
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [deliveries, setDeliveriesState] = useState<Delivery[]>([]);
  const [items, setItemsState] = useState<Item[]>([]);
  const [receivingSessions, setReceivingSessionsState] = useState<ReceivingSession[]>([]);
  const [customers, setCustomersState] = useState<Customer[]>([]);
  const [slipRequests, setSlipRequestsState] = useState<SlipRequest[]>([]);
  const [asns, setASNsState] = useState<ASN[]>([]);
  const [extensivItems, setExtensivItemsState] = useState<Item[]>([]);
  const [syncLogs, setSyncLogsState] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiConfig, setAPIConfig] = useState<APIConfig | null>(() => {
    const saved = localStorage.getItem('apiConfig');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      smartsheet: {
        apiToken: 'q9MgMjegggjqp24oi9sfaLVqJjnMFOMevnnqv',
        sheetId: '8551818792488836',
        autoSync: false,
        syncInterval: 15,
        columnMappings: {
          containerNumber: 'PO # / Container #',
          customerName: 'Customer Name',
          poNumber: 'PO # / Container #',
          door: 'Door #',
          expectedDate: 'Date',
          carrier: 'Carrier',
          status: 'Status',
          notes: 'Additional Information',
          trackingNumber: '3PL # ',
          done: 'Done',
        },
      },
      extensiv: {
        apiKey: '',
        facilityId: '',
        autoSync: false,
        syncInterval: 30,
      },
    };
  });

  const initialLoadComplete = useRef(false);

  useEffect(() => {
    const savedDeliveries = localStorage.getItem('deliveries');
    const savedItems = localStorage.getItem('items');
    const savedSessions = localStorage.getItem('receivingSessions');
    const savedCustomers = localStorage.getItem('customers');
    const savedSlipRequests = localStorage.getItem('slipRequests');
    const savedASNs = localStorage.getItem('asns');
    const savedSyncLogs = localStorage.getItem('syncLogs');

    if (savedDeliveries) setDeliveriesState(JSON.parse(savedDeliveries));
    if (savedItems) setItemsState(JSON.parse(savedItems));
    if (savedSessions) {
      const sessions = JSON.parse(savedSessions);
      console.log('[DataContext] Loaded sessions from localStorage:', sessions.length);
      sessions.forEach((s: ReceivingSession, idx: number) => {
        console.log(`[DataContext] Session ${idx + 1}:`, {
          id: s.id,
          status: s.status,
          customer: s.customerName,
          completedAt: s.completedAt
        });
      });
      const migratedSessions = migrateSessionStatuses(sessions);
      setReceivingSessionsState(migratedSessions);
    }
    if (savedCustomers) {
      const loadedCustomers = JSON.parse(savedCustomers);
      console.log('[DataContext] Loaded customers from localStorage:', loadedCustomers.length);
      
      const uniqueCustomers = deduplicateCustomers(loadedCustomers);
      
      if (uniqueCustomers.length < loadedCustomers.length) {
        console.log(`[DataContext] Deduplication: ${loadedCustomers.length} -> ${uniqueCustomers.length} customers`);
        toast.info(`Removed ${loadedCustomers.length - uniqueCustomers.length} duplicate customer entries`);
      }
      
      setCustomersState(uniqueCustomers);
    }
    if (savedSlipRequests) setSlipRequestsState(JSON.parse(savedSlipRequests));
    if (savedASNs) {
      const loadedASNs = JSON.parse(savedASNs);
      console.log('[DataContext] Loaded ASNs from localStorage:', loadedASNs.length);
      setASNsState(loadedASNs);
    }
    if (savedSyncLogs) setSyncLogsState(JSON.parse(savedSyncLogs));

    const initializeBackendData = async () => {
      try {
        console.log('[DataContext] 🚀 Starting initial backend data load...');
        await Promise.all([
          loadItemsFromBackend(),
          loadCustomersFromBackend(),
          loadASNsFromBackend(),
          loadSessionsFromBackend()
        ]);
        console.log('[DataContext] ✅ Initial backend data load complete');
      } catch (error) {
        console.error('[DataContext] ❌ Error during initial data load:', error);
      } finally {
        initialLoadComplete.current = true;
        console.log('[DataContext] Initial load complete, localStorage saves now enabled');
      }
    };
    
    initializeBackendData();
  }, []);

  useEffect(() => {
    if (!initialLoadComplete.current) return;
    localStorage.setItem('deliveries', JSON.stringify(deliveries));
  }, [deliveries]);

  useEffect(() => {
    if (!initialLoadComplete.current) return;
    localStorage.setItem('items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (!initialLoadComplete.current) return;
    console.log('[DataContext] Saving sessions to localStorage:', receivingSessions.length);
    receivingSessions.forEach((s, idx) => {
      console.log(`[DataContext] Saving session ${idx + 1}:`, {
        id: s.id,
        status: s.status,
        customer: s.customerName
      });
    });
    localStorage.setItem('receivingSessions', JSON.stringify(receivingSessions));
  }, [receivingSessions]);

  useEffect(() => {
    if (!initialLoadComplete.current) return;
    
    const uniqueCustomers = deduplicateCustomers(customers);
    
    if (uniqueCustomers.length !== customers.length) {
      console.log(`[DataContext] Deduplicating before save: ${customers.length} -> ${uniqueCustomers.length}`);
      setCustomersState(uniqueCustomers);
      return;
    }
    
    console.log('[DataContext] Saving customers to localStorage:', customers.length);
    localStorage.setItem('customers', JSON.stringify(customers));
    
    if (customers.length > 0) {
      customersAPI.syncCustomers(customers).then(result => {
        if (result.success) {
          console.log('[DataContext] ✅ Auto-synced customers to PostgreSQL:', result.count);
        } else {
          console.error('[DataContext] ❌ Failed to auto-sync customers to PostgreSQL');
        }
      }).catch(error => {
        console.error('[DataContext] ❌ Exception during customer auto-sync:', error);
      });
    }
  }, [customers]);

  useEffect(() => {
    if (!initialLoadComplete.current) return;
    localStorage.setItem('slipRequests', JSON.stringify(slipRequests));
  }, [slipRequests]);

  useEffect(() => {
    if (!initialLoadComplete.current) return;
    console.log('[DataContext] Saving ASNs to localStorage:', asns.length);
    localStorage.setItem('asns', JSON.stringify(asns));
  }, [asns]);

  useEffect(() => {
    if (!initialLoadComplete.current) return;
    localStorage.setItem('syncLogs', JSON.stringify(syncLogs));
  }, [syncLogs]);

  useEffect(() => {
    if (apiConfig) {
      localStorage.setItem('apiConfig', JSON.stringify(apiConfig));
    }
  }, [apiConfig]);

  const loadItemsFromBackend = async (customerId?: string) => {
    try {
      console.log('[DataContext] Loading items from backend for customer:', customerId || 'all');
      const backendItems = await itemsAPI.fetchItems(customerId);
      console.log('[DataContext] Loaded items from backend:', backendItems.length);
      setExtensivItemsState(backendItems);
    } catch (error) {
      console.error('[DataContext] Error loading items from backend:', error);
    }
  };

  const loadCustomersFromBackend = async () => {
    try {
      console.log('[DataContext] Loading customers from backend database');
      const result = await customersAPI.fetchCustomers();
      
      // fetchCustomers returns Customer[] (array) directly from atomsBackend
      // Handle both array response and {success, customers} object response
      const backendCustomers: Customer[] = Array.isArray(result) 
        ? result 
        : (result as { success?: boolean; customers?: Customer[] }).customers || [];
      
      if (backendCustomers.length > 0) {
        console.log('[DataContext] Loaded customers from backend:', backendCustomers.length);
        
        setCustomersState(currentCustomers => {
          const backendCustomerIds = new Set(backendCustomers.map(c => c.id));
          const localOnlyCustomers = currentCustomers.filter(c => !backendCustomerIds.has(c.id));
          const merged = [...backendCustomers, ...localOnlyCustomers];
          console.log('[DataContext] Customers merged with backend data:', merged.length);
          return merged;
        });
      } else {
        console.log('[DataContext] ⚠️ Backend returned empty customer list');
      }
    } catch (error) {
      console.error('[DataContext] ❌ Error loading customers from backend:', error);
    }
  };

  const loadASNsFromBackend = async () => {
    try {
      console.log('[DataContext] 📥 Loading ASNs from backend database...');
      const result = await asnAPI.fetchASNs();
      
      if (result.success && result.asns && result.asns.length > 0) {
        console.log('[DataContext] ✅ Loaded ASNs from backend:', result.asns.length);
        
        const backendASNs = result.asns.map(convertBackendASNToFrontend);
        
        console.log('[DataContext] 🔍 Backend ASNs with items:', backendASNs.map(a => ({
          id: a.id,
          asnNumber: a.asnNumber,
          customerName: a.customerName,
          itemsCount: a.items?.length || 0
        })));
        
        // FIXED: Preserve ALL local ASNs, merge with backend ASNs
        setASNsState(currentASNs => {
          const backendASNIds = new Set(backendASNs.map(a => a.id));
          
          // Keep local ASNs that don't exist in backend (regardless of age)
          const localOnlyASNs = currentASNs.filter(asn => {
            if (backendASNIds.has(asn.id)) return false;
            
            console.log(`[DataContext] 🔒 Preserving local-only ASN:`, {
              id: asn.id,
              asnNumber: asn.asnNumber,
              syncStatus: asn.syncStatus,
              createdAt: asn.createdAt
            });
            
            return true;
          });
          
          const merged = [...backendASNs, ...localOnlyASNs];
          console.log('[DataContext] ✅ ASNs merged:', {
            backend: backendASNs.length,
            localOnly: localOnlyASNs.length,
            total: merged.length
          });
          return merged;
        });
      } else {
        console.log('[DataContext] ⚠️ Backend returned empty ASN list - preserving all local ASNs');
        
        // FIXED: Preserve ALL local ASNs when backend returns empty
        setASNsState((currentASNs) => {
          if (currentASNs.length > 0) {
            console.log(`[DataContext] 🔒 Preserving ${currentASNs.length} local ASNs`);
            currentASNs.forEach(asn => {
              console.log(`[DataContext] Local ASN:`, {
                id: asn.id,
                asnNumber: asn.asnNumber,
                syncStatus: asn.syncStatus
              });
            });
          }
          return currentASNs;
        });
      }
    } catch (error) {
      console.error('[DataContext] ❌ Error loading ASNs from backend:', error);
    }
  };

  const loadSessionsFromBackend = async () => {
    try {
      console.log('[DataContext] 📥 Loading sessions from backend database...');
      const result = await sessionsAPI.fetchSessions();

      if (result.success && result.sessions.length > 0) {
        console.log('[DataContext] ✅ Loaded sessions from backend:', result.sessions.length);

        setReceivingSessionsState(currentSessions => {
          const backendSessionIds = new Set(result.sessions.map(s => s.id));

          // Keep local-only sessions (not yet in backend)
          const localOnlySessions = currentSessions.filter(s => !backendSessionIds.has(s.id));

          // Convert backend sessions to frontend format
          const backendSessions = result.sessions.map(s => ({
            ...s,
            // Ensure all frontend fields exist
            asnId: s.asnId || '',
            deliveryId: s.deliveryId || '',
            receivedBy: s.receivedBy || s.startedBy || '',
          })) as unknown as ReceivingSession[];

          const merged = [...backendSessions, ...localOnlySessions];
          console.log('[DataContext] ✅ Sessions merged:', {
            backend: backendSessions.length,
            localOnly: localOnlySessions.length,
            total: merged.length
          });

          // Migrate any local-only sessions to backend
          if (localOnlySessions.length > 0) {
            console.log(`[DataContext] 🔄 Migrating ${localOnlySessions.length} local-only sessions to backend...`);
            sessionsAPI.bulkUpsertSessions(localOnlySessions as unknown as sessionsAPI.BackendSession[])
              .then(bulkResult => {
                if (bulkResult.success) {
                  console.log('[DataContext] ✅ Local sessions migrated to backend:', bulkResult);
                } else {
                  console.error('[DataContext] ❌ Failed to migrate local sessions:', bulkResult);
                }
              })
              .catch(err => console.error('[DataContext] ❌ Exception migrating local sessions:', err));
          }

          return merged;
        });
      } else {
        console.log('[DataContext] ⚠️ Backend returned empty session list - preserving local sessions');

        // If we have local sessions, migrate them to backend
        setReceivingSessionsState(currentSessions => {
          if (currentSessions.length > 0) {
            console.log(`[DataContext] 🔄 Migrating ${currentSessions.length} local sessions to backend (first time)...`);
            sessionsAPI.bulkUpsertSessions(currentSessions as unknown as sessionsAPI.BackendSession[])
              .then(bulkResult => {
                if (bulkResult.success) {
                  console.log('[DataContext] ✅ Initial migration complete:', bulkResult);
                }
              })
              .catch(err => console.error('[DataContext] ❌ Exception during initial migration:', err));
          }
          return currentSessions;
        });
      }
    } catch (error) {
      console.error('[DataContext] ❌ Error loading sessions from backend:', error);
    }
  };

  const forceFullSync = async () => {
    console.log('[DataContext] 🔄 Force full sync - MERGE strategy (preserve local data)');
    
    setIsLoading(true);
    try {
      await Promise.all([
        loadItemsFromBackend(),
        loadCustomersFromBackend(),
        loadASNsFromBackend(),
        loadSessionsFromBackend()
      ]);
      console.log('[DataContext] ✅ Force full sync complete');
      toast.success('All data synced successfully');
    } catch (error) {
      console.error('[DataContext] ❌ Error during force sync:', error);
      toast.error('Failed to sync all data');
    } finally {
      setIsLoading(false);
    }
  };

  const getItemSyncStatus = async (customerId: string): Promise<SyncStatus | null> => {
    try {
      const result = await itemsAPI.getSyncStatus(customerId);
      return result.syncStatus;
    } catch (error) {
      console.error('Error getting sync status:', error);
      return null;
    }
  };

  const addDelivery = (delivery: Delivery) => {
    setDeliveriesState((prev) => [...prev, delivery]);
  };

  const updateDelivery = (id: string, updates: Partial<Delivery>) => {
    setDeliveriesState((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  };

  const deleteDelivery = (id: string) => {
    setDeliveriesState((prev) => prev.filter((d) => d.id !== id));
  };

  const setDeliveries = (deliveries: Delivery[]) => {
    setDeliveriesState(deliveries);
  };

  const addItem = (item: Item) => {
    setItemsState((prev) => [...prev, item]);
  };

  const updateItem = (id: string, updates: Partial<Item>) => {
    setItemsState((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  };

  const setItems = (items: Item[]) => {
    setItemsState(items);
  };

  const setExtensivItems = (items: Item[]) => {
    setExtensivItemsState(items);
  };

  const addReceivingSession = async (session: ReceivingSession) => {
    console.log('[DataContext] Adding new receiving session:', {
      id: session.id,
      status: session.status,
      customer: session.customerName,
      itemCount: session.items?.length
    });
    setReceivingSessionsState((prev) => [...prev, session]);

    // Save to backend database
    try {
      const result = await sessionsAPI.createSession(session as unknown as sessionsAPI.BackendSession);
      if (result.success) {
        console.log('[DataContext] ✅ Session saved to backend:', session.id);
      } else {
        console.error('[DataContext] ❌ Failed to save session to backend:', result.error);
      }
    } catch (error) {
      console.error('[DataContext] ❌ Exception saving session to backend:', error);
    }
  };

  const updateReceivingSession = async (id: string, updates: Partial<ReceivingSession>) => {
    console.log('[DataContext] Updating receiving session:', id, updates);
    setReceivingSessionsState((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));

    // Update in backend database
    try {
      const result = await sessionsAPI.updateSession(id, updates as unknown as Partial<sessionsAPI.BackendSession>);
      if (result.success) {
        console.log('[DataContext] ✅ Session updated in backend:', id);
      } else {
        console.error('[DataContext] ❌ Failed to update session in backend:', result.error);
      }
    } catch (error) {
      console.error('[DataContext] ❌ Exception updating session in backend:', error);
    }
  };

  const updateAPIConfig = (config: APIConfig) => {
    setAPIConfig(config);
  };

  const addCustomer = (customer: Customer) => {
    setCustomersState((prev) => [...prev, customer]);
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setCustomersState((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const deleteCustomer = (id: string) => {
    setCustomersState((prev) => prev.filter((c) => c.id !== id));
  };

  const addSlipRequest = (request: SlipRequest) => {
    setSlipRequestsState((prev) => [...prev, request]);
  };

  const updateSlipRequest = (id: string, updates: Partial<SlipRequest>) => {
    setSlipRequestsState((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const addASN = async (asn: ASN) => {
    console.log('[DataContext] ✅ Adding new ASN - FULL DATA:', JSON.stringify(asn, null, 2));
    console.log('[DataContext] 🕐 ASN created at:', asn.createdAt, '(timestamp:', new Date(asn.createdAt).getTime(), ')');
    console.log('[DataContext] 🔗 ASN deliveryId:', asn.deliveryId);
    console.log('[DataContext] 📦 ASN items count:', asn.items?.length || 0);
    
    // Mark as pending sync initially
    const asnWithSyncStatus: ASN = {
      ...asn,
      syncStatus: 'pending',
      lastSyncAttempt: new Date().toISOString()
    };
    
    // Optimistically update state first
    setASNsState((prev) => [...prev, asnWithSyncStatus]);
    
    // Then save to backend with ENHANCED ERROR HANDLING
    try {
      const backendData = await convertFrontendASNToBackend(asn, customers);
      
      if (!backendData) {
        console.error('[DataContext] ❌ Failed to convert ASN to backend format');
        
        // Update ASN with failed status
        setASNsState((prev) => prev.map(a => 
          a.id === asn.id 
            ? { ...a, syncStatus: 'failed', syncError: 'Could not find or create customer in database' }
            : a
        ));
        
        toast.error('ASN created locally but failed to sync: Customer not found in database', {
          duration: 5000,
          action: {
            label: 'Retry',
            onClick: () => retryASNSync(asn.id)
          }
        });
        return;
      }
      
      console.log('[DataContext] 📤 Sending to backend API:', JSON.stringify(backendData, null, 2));
      
      const result = await asnAPI.createASN(backendData);
      
      console.log('[DataContext] 📥 Backend response:', JSON.stringify(result, null, 2));
      
      if (result.success && result.asn) {
        console.log('[DataContext] ✅ ASN saved to backend successfully! ID:', result.asn.id);
        console.log('[DataContext] ✅ Backend ASN deliveryId:', result.asn.delivery_id);
        console.log('[DataContext] ✅ Backend ASN items count:', result.asn.items?.length || 0);
        
        // Update state with backend-generated data and mark as synced
        const backendASN = convertBackendASNToFrontend(result.asn);
        setASNsState((prev) => prev.map(a => a.id === asn.id ? backendASN : a));
        
        toast.success(`ASN synced to database with ${result.asn.items?.length || 0} items`);
      } else {
        console.error('[DataContext] ❌ Backend save FAILED:', result.error);
        console.error('[DataContext] ❌ Error details:', result.details);
        
        // Update ASN with failed status
        setASNsState((prev) => prev.map(a => 
          a.id === asn.id 
            ? { ...a, syncStatus: 'failed', syncError: result.error || 'Unknown error' }
            : a
        ));
        
        toast.error(`ASN created locally but failed to sync: ${result.error}`, {
          duration: 5000,
          action: {
            label: 'Retry',
            onClick: () => retryASNSync(asn.id)
          }
        });
      }
    } catch (error) {
      console.error('[DataContext] ❌ Exception during backend save:', error);
      
      // Update ASN with failed status
      setASNsState((prev) => prev.map(a => 
        a.id === asn.id 
          ? { ...a, syncStatus: 'failed', syncError: error instanceof Error ? error.message : 'Network error' }
          : a
      ));
      
      toast.error('ASN created locally but failed to sync to database', {
        duration: 5000,
        action: {
          label: 'Retry',
          onClick: () => retryASNSync(asn.id)
        }
      });
    }
  };

  const retryASNSync = async (id: string) => {
    const asn = asns.find(a => a.id === id);
    if (!asn) {
      toast.error('ASN not found');
      return;
    }
    
    console.log('[DataContext] 🔄 Retrying ASN sync:', id);
    
    // Update status to pending
    setASNsState((prev) => prev.map(a => 
      a.id === id 
        ? { ...a, syncStatus: 'pending', lastSyncAttempt: new Date().toISOString() }
        : a
    ));
    
    try {
      const backendData = await convertFrontendASNToBackend(asn, customers);
      
      if (!backendData) {
        setASNsState((prev) => prev.map(a => 
          a.id === id 
            ? { ...a, syncStatus: 'failed', syncError: 'Could not find or create customer in database' }
            : a
        ));
        toast.error('Retry failed: Customer not found in database');
        return;
      }
      
      const result = await asnAPI.createASN(backendData);
      
      if (result.success && result.asn) {
        const backendASN = convertBackendASNToFrontend(result.asn);
        setASNsState((prev) => prev.map(a => a.id === id ? backendASN : a));
        toast.success('ASN successfully synced to database');
      } else {
        setASNsState((prev) => prev.map(a => 
          a.id === id 
            ? { ...a, syncStatus: 'failed', syncError: result.error || 'Unknown error' }
            : a
        ));
        toast.error(`Retry failed: ${result.error}`);
      }
    } catch (error) {
      setASNsState((prev) => prev.map(a => 
        a.id === id 
          ? { ...a, syncStatus: 'failed', syncError: error instanceof Error ? error.message : 'Network error' }
          : a
      ));
      toast.error('Retry failed: Network error');
    }
  };

  const updateASN = async (id: string, updates: Partial<ASN>) => {
    console.log('[DataContext] 🔄 Updating ASN:', id, updates);
    
    const currentASN = asns.find(a => a.id === id);
    if (!currentASN) {
      console.error('[DataContext] ❌ ASN not found in state:', id);
      toast.error('ASN not found');
      return;
    }
    
    // Optimistically update state first
    setASNsState((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
    
    // Then save to backend
    try {
      const mergedASN = { ...currentASN, ...updates };
      const backendUpdates = await convertFrontendASNToBackend(mergedASN, customers);
      
      if (!backendUpdates) {
        console.error('[DataContext] ❌ Failed to convert ASN updates to backend format');
        toast.error('ASN updated locally but failed to sync to database');
        return;
      }
      
      console.log('[DataContext] 📤 Sending update to backend with ID:', id);
      const result = await asnAPI.updateASN(id, backendUpdates as asnAPI.UpdateASNRequest);
      
      if (result.success && result.asn) {
        console.log('[DataContext] ✅ ASN updated in backend successfully:', result.asn.id);
        console.log('[DataContext] ✅ Updated items count:', result.asn.items?.length || 0);
        
        const backendASN = convertBackendASNToFrontend(result.asn);
        setASNsState((prev) => prev.map(a => a.id === id ? backendASN : a));
        
        toast.success('ASN updated successfully');
      } else {
        console.error('[DataContext] ❌ Failed to update ASN in backend:', result.error);
        console.error('[DataContext] ❌ Error details:', result.details);
        toast.error(`Failed to update ASN: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[DataContext] ❌ Error updating ASN in backend:', error);
      toast.error('ASN updated locally but failed to sync to database');
    }
  };

  const deleteASN = async (id: string) => {
    console.log('[DataContext] Deleting ASN:', id);
    
    // Optimistically update state first
    setASNsState((prev) => prev.filter((a) => a.id !== id));
    
    // Then delete from backend
    try {
      const result = await asnAPI.deleteASN(id);
      
      if (result.success) {
        console.log('[DataContext] ASN deleted from backend successfully:', id);
      } else {
        console.error('[DataContext] Failed to delete ASN from backend:', result.error);
        toast.error('ASN deleted locally but failed to sync to database');
      }
    } catch (error) {
      console.error('[DataContext] Error deleting ASN from backend:', error);
      toast.error('ASN deleted locally but failed to sync to database');
    }
  };

  const syncFromSmartsheet = async () => {
    if (!apiConfig?.smartsheet) {
      toast.error('Smartsheet configuration is missing');
      return;
    }

    setIsLoading(true);

    try {
      const result = await smartsheetAPI.syncDeliveriesFromSmartsheet();

      if (result.deliveries) {
        setDeliveriesState(result.deliveries);
      }

      const log: SyncLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        source: 'smartsheet',
        status: 'success',
        recordsProcessed: result.deliveries?.length || 0,
        message: `Successfully synced ${result.deliveries?.length || 0} deliveries from Smartsheet`,
      };
      addSyncLog(log);

      toast.success(`Synced ${result.deliveries?.length || 0} deliveries from Smartsheet`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const log: SyncLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        source: 'smartsheet',
        status: 'error',
        recordsProcessed: 0,
        message: `Failed to sync: ${errorMessage}`,
      };
      addSyncLog(log);

      toast.error(`Failed to sync from Smartsheet: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const syncExtensivItems = async () => {
    if (!apiConfig?.extensiv?.apiKey || !apiConfig?.extensiv?.facilityId) {
      toast.error('Extensiv configuration is missing');
      return;
    }

    setIsLoading(true);

    try {
      toast.info('Extensiv sync functionality will be implemented with real API integration');

      const log: SyncLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        source: 'extensiv',
        status: 'success',
        recordsProcessed: 0,
        message: 'Extensiv sync placeholder - awaiting API integration',
      };
      addSyncLog(log);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const log: SyncLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        source: 'extensiv',
        status: 'error',
        recordsProcessed: 0,
        message: `Failed to sync: ${errorMessage}`,
      };
      addSyncLog(log);

      toast.error(`Failed to sync from Extensiv: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const addSyncLog = (log: SyncLog) => {
    setSyncLogsState((prev) => [log, ...prev].slice(0, 100));
  };

  return (
    <DataContext.Provider
      value={{
        deliveries,
        items,
        receivingSessions,
        apiConfig,
        customers,
        slipRequests,
        asns,
        extensivItems,
        syncLogs,
        isLoading,
        addDelivery,
        updateDelivery,
        deleteDelivery,
        setDeliveries,
        addItem,
        updateItem,
        setItems,
        setExtensivItems,
        addReceivingSession,
        updateReceivingSession,
        updateAPIConfig,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        addSlipRequest,
        updateSlipRequest,
        addASN,
        updateASN,
        deleteASN,
        retryASNSync,
        syncFromSmartsheet,
        syncExtensivItems,
        addSyncLog,
        loadItemsFromBackend,
        loadCustomersFromBackend,
        loadASNsFromBackend,
        loadSessionsFromBackend,
        getItemSyncStatus,
        forceFullSync,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}