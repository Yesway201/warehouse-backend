import { useState, useEffect, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Truck, Edit, FileText, Plus, CheckCircle, Eye, ChevronDown, ChevronRight, RefreshCw, ArrowLeft, Trash2, Filter, Download, Copy, AlertCircle, X, MoreVertical, Search, ArrowUpDown, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { Delivery, ASN } from '@/types';
import { cn } from '@/lib/utils';
import { copyToClipboard, formatSyncLogForCopy, SyncResult, getLastSyncTime, getStoredDeliveries, clearCachedDeliveries, updateSmartsheetDelivery } from '@/lib/smartsheetApi';
import { useSmartsheetAutoSync } from '@/hooks/useSmartsheetAutoSync';
import { syncExtensivItems } from '@/lib/extensivApi';
import { requestPackingSlip } from '@/lib/deliveriesApi';

interface ASNItem {
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

interface ASNFormData {
  customerId?: string;
  customerName: string;
  containerNumber: string;
  door: string;
  carrier: string;
  trailerNumber: string;
  expectedDate: string;
  notes: string;
  items: ASNItem[];
}

type SortField = 'customerName' | 'containerNumber' | 'door' | 'expectedDate' | 'carrier' | 'status' | 'asnStatus';
type SortDirection = 'asc' | 'desc';

export default function IncomingDeliveries() {
  const { user } = useAuth();
  const { apiConfig, customers = [], deliveries = [], updateDelivery, addDelivery, setDeliveries, slipRequests = [], addSlipRequest, updateSlipRequest, asns = [], addASN, updateASN, deleteASN, extensivItems = [], setExtensivItems, forceFullSync } = useData();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [editForm, setEditForm] = useState<Partial<Delivery>>({});
  const [asnDialogOpen, setASNDialogOpen] = useState(false);
  const [editingASN, setEditingASN] = useState<ASN | null>(null);
  const [slipDialogOpen, setSlipDialogOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [asnForm, setASNForm] = useState<ASNFormData>({
    customerName: '',
    containerNumber: '',
    door: '',
    carrier: '',
    trailerNumber: '',
    expectedDate: '',
    notes: '',
    items: [],
  });
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('expectedDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [syncError, setSyncError] = useState<SyncResult | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [dataSource, setDataSource] = useState<'live' | 'cached'>('cached');
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null>(null);
  const [syncingSKUs, setSyncingSKUs] = useState(false);
  const [skuComboboxOpen, setSkuComboboxOpen] = useState<Record<number, boolean>>({});

  const isSmartsheetConfigured = apiConfig?.smartsheet?.apiToken && apiConfig?.smartsheet?.sheetId;

  // Find matched customer for the selected delivery (for ASN dialog filtering)
  const matchedCustomer = useMemo(() => {
    if (!selectedDelivery) return null;
    
    // First try direct customerId match
    if (selectedDelivery.customerId) {
      const customer = customers.find((c) => c.id === selectedDelivery.customerId);
      if (customer) {
        console.log('[IncomingDeliveries] Direct customerId match:', {
          deliveryCustomerId: selectedDelivery.customerId,
          customerName: customer.name,
          customer3PLID: customer.thirdPartyLogisticsId
        });
        return customer;
      }
    }
    
    // Otherwise, try to match by customer name (case-insensitive, trimmed)
    const deliveryName = selectedDelivery.customerName.toLowerCase().trim();
    const matched = customers.find(
      (c) => c.name.toLowerCase().trim() === deliveryName
    );
    
    if (matched) {
      console.log('[IncomingDeliveries] Customer name match found:', {
        deliveryCustomerName: selectedDelivery.customerName,
        matchedCustomerName: matched.name,
        matchedCustomerId: matched.id,
        matched3PLID: matched.thirdPartyLogisticsId
      });
    } else {
      console.log('[IncomingDeliveries] No customer match found:', {
        deliveryCustomerName: selectedDelivery.customerName,
        availableCustomers: customers.map(c => ({
          name: c.name,
          id: c.id,
          thirdPartyLogisticsId: c.thirdPartyLogisticsId
        }))
      });
    }
    
    return matched || null;
  }, [selectedDelivery, customers]);

  // Filter Extensiv items by matched customer's 3PL ID
  const filteredExtensivItems = useMemo(() => {
    if (!selectedDelivery) {
      return extensivItems;
    }

    // If we found a matching customer, filter items by their 3PL ID
    if (matchedCustomer) {
      const filtered = extensivItems.filter((item) => 
        item.customerId === matchedCustomer.thirdPartyLogisticsId
      );
      
      console.log('[IncomingDeliveries] Filtering items by 3PL ID:', {
        deliveryCustomerName: selectedDelivery.customerName,
        matchedCustomer3PLID: matchedCustomer.thirdPartyLogisticsId,
        totalExtensivItems: extensivItems.length,
        filteredItems: filtered.length,
        sampleExtensivItemCustomerIds: extensivItems.slice(0, 5).map(i => i.customerId)
      });
      
      return filtered;
    }

    // If no match found, show all items
    console.log('[IncomingDeliveries] No customer match - showing all items');
    return extensivItems;
  }, [selectedDelivery, matchedCustomer, extensivItems]);

  // Auto-sync integration
  const { isSyncing: autoSyncing, performSync } = useSmartsheetAutoSync({
    onSyncComplete: (result) => {
      if (result.deliveries) {
        const newDeliveries: Delivery[] = result.deliveries.map((delivery) => ({
          id: delivery.rowId,
          smartsheetRowId: delivery.rowId,
          rowId: delivery.rowId,
          customerName: delivery.customerName,
          containerNumber: delivery.containerNumber || delivery.poNumber,
          poNumber: delivery.poNumber || delivery.containerNumber,
          expectedDate: delivery.expectedDeliveryDate,
          door: delivery.door,
          carrier: delivery.carrier,
          trackingNumber: delivery.trackingNumber,
          status: delivery.status || 'Expected',
          asn: delivery.asn === true, // ✅ Map ASN checkbox from Smartsheet
          notes: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

        setDeliveries(newDeliveries);
        setDataSource('live');
        setLastSyncTimestamp(new Date().toISOString());
        setLastSyncResult(result);
      }
    },
    onSyncError: (error) => {
      setSyncError(error);
    },
    isConfigured: isSmartsheetConfigured,
  });

  // Load cached deliveries on mount (REMOVED forceFullSync - DataContext handles initial load)
  useEffect(() => {
    const cachedTime = getLastSyncTime();
    setLastSyncTimestamp(cachedTime);
    
    // Load cached Smartsheet deliveries if available
    const cachedSmartsheetDeliveries = getStoredDeliveries();
    
    if (cachedSmartsheetDeliveries.length > 0) {
      console.log('[IncomingDeliveries] Loading cached deliveries from localStorage:', cachedSmartsheetDeliveries.length);
      
      // Convert cached Smartsheet deliveries to app format
      const cachedDeliveries: Delivery[] = cachedSmartsheetDeliveries.map((delivery) => ({
        id: delivery.rowId,
        smartsheetRowId: delivery.rowId,
        rowId: delivery.rowId,
        customerName: delivery.customerName,
        containerNumber: delivery.containerNumber || delivery.poNumber,
        poNumber: delivery.poNumber || delivery.containerNumber,
        expectedDate: delivery.expectedDeliveryDate,
        door: delivery.door,
        carrier: delivery.carrier,
        trackingNumber: delivery.trackingNumber,
        status: delivery.status || 'Expected',
        asn: delivery.asn === true, // ✅ Map ASN checkbox from Smartsheet
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      
      // Only load cached deliveries if current deliveries are empty
      if (deliveries.length === 0) {
        setDeliveries(cachedDeliveries);
        setDataSource('cached');
        console.log('[IncomingDeliveries] Loaded cached deliveries into state');
      }
    }

    // REMOVED: forceFullSync() call - DataContext already loads backend data on app startup
    console.log('[IncomingDeliveries] ✅ Skipping forceFullSync - DataContext handles initial backend load');
  }, []);

  const handleFullSync = async () => {
    console.log('[IncomingDeliveries] 🔄 Manual full sync triggered');
    
    // Sync Smartsheet deliveries first
    if (isSmartsheetConfigured) {
      await performSync(false);
    }
    
    // Then sync backend data (ASNs, items, customers)
    // FIXED: Keep forceFullSync for manual sync button, but it won't cause infinite loop
    // because we fixed the DataContext auto-sync issue
    await forceFullSync();
  };

  const handleSyncFromSmartsheet = async () => {
    if (!isSmartsheetConfigured) {
      toast.error('Smartsheet is not configured. Please configure it in Settings.');
      return;
    }

    setSyncError(null);
    setLastSyncResult(null);

    // Use the auto-sync hook's performSync method
    await performSync(false); // false = not silent, show toast
  };

  const handleSyncSKUs = async () => {
    setSyncingSKUs(true);
    try {
      const items = await syncExtensivItems();
      setExtensivItems(items);
      toast.success(`Synced ${items.length} SKUs from localStorage`);
    } catch (error) {
      toast.error('Failed to sync SKUs from Extensiv');
      console.error(error);
    } finally {
      setSyncingSKUs(false);
    }
  };

  const handleCopySyncLog = async () => {
    const logToCopy = syncError || lastSyncResult;
    if (!logToCopy) {
      toast.error('No sync log available');
      return;
    }

    const formatted = formatSyncLogForCopy(logToCopy);
    const success = await copyToClipboard(formatted);

    if (success) {
      toast.success('Sync log copied to clipboard');
    } else {
      toast.error('Failed to copy sync log');
    }
  };

  const handleClearCache = () => {
    clearCachedDeliveries();
    setDataSource('live');
    setLastSyncTimestamp(null);
    toast.success('Cached deliveries cleared');
  };

  // Phase 1: Immediate push for status changes
  const handleQuickStatusChange = async (delivery: Delivery, newStatus: string) => {
    // Update local state immediately
    updateDelivery(delivery.id, { status: newStatus });
    
    // Push to Smartsheet if rowId exists
    if (delivery.smartsheetRowId || delivery.rowId) {
      const rowId = delivery.smartsheetRowId || delivery.rowId || '';
      
      try {
        const result = await updateSmartsheetDelivery(rowId, { status: newStatus });
        
        if (result.success) {
          toast.success(`Status updated to ${newStatus} (synced to Smartsheet)`);
        } else {
          toast.error(`Status updated locally, but failed to sync to Smartsheet: ${result.error}`);
          console.error('[IncomingDeliveries] Failed to push status to Smartsheet:', result);
        }
      } catch (error) {
        toast.error('Status updated locally, but failed to sync to Smartsheet');
        console.error('[IncomingDeliveries] Error pushing status to Smartsheet:', error);
      }
    } else {
      toast.success(`Status updated to ${newStatus}`);
    }
  };

  const handleEditDelivery = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    
    // Try to find matching customer by customerId or customerName
    let matchedCustomerId = delivery.customerId;
    if (!matchedCustomerId) {
      const matchedCustomer = customers.find(
        (c) => c.name.toLowerCase().trim() === delivery.customerName.toLowerCase().trim()
      );
      matchedCustomerId = matchedCustomer?.id;
    }
    
    // Auto-fill ALL fields from the delivery
    setEditForm({
      customerId: matchedCustomerId,
      customerName: delivery.customerName,
      containerNumber: delivery.containerNumber,
      poNumber: delivery.poNumber,
      door: delivery.door,
      expectedDate: delivery.expectedDate,
      carrier: delivery.carrier,
      trackingNumber: delivery.trackingNumber,
      status: delivery.status,
      notes: delivery.notes,
    });
    setEditDialogOpen(true);
  };

  // Phase 1: Immediate push for door changes (and status if changed in edit dialog)
  const handleSaveDelivery = async () => {
    if (!selectedDelivery) return;

    // If customer was selected, update customer name from customer record
    if (editForm.customerId) {
      const customer = customers.find((c) => c.id === editForm.customerId);
      if (customer) {
        editForm.customerName = customer.name;
      }
    }

    // Update local state
    updateDelivery(selectedDelivery.id, editForm);
    
    // Push status and door to Smartsheet if changed
    const rowId = selectedDelivery.smartsheetRowId || selectedDelivery.rowId;
    if (rowId) {
      const updates: { status?: string; door?: string } = {};
      
      if (editForm.status && editForm.status !== selectedDelivery.status) {
        updates.status = editForm.status;
      }
      
      if (editForm.door !== undefined && editForm.door !== selectedDelivery.door) {
        updates.door = editForm.door;
      }
      
      if (Object.keys(updates).length > 0) {
        try {
          const result = await updateSmartsheetDelivery(rowId, updates);
          
          if (result.success) {
            toast.success('Delivery updated and synced to Smartsheet');
          } else {
            toast.warning(`Delivery updated locally, but failed to sync to Smartsheet: ${result.error}`);
            console.error('[IncomingDeliveries] Failed to push updates to Smartsheet:', result);
          }
        } catch (error) {
          toast.warning('Delivery updated locally, but failed to sync to Smartsheet');
          console.error('[IncomingDeliveries] Error pushing updates to Smartsheet:', error);
        }
      } else {
        toast.success('Delivery updated successfully');
      }
    } else {
      toast.success('Delivery updated successfully');
    }
    
    setEditDialogOpen(false);
    setSelectedDelivery(null);
    setEditForm({});
  };

  const handleRequestPackingSlip = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setSlipDialogOpen(true);
  };

  const handleConfirmSlipRequest = async () => {
    if (!selectedDelivery) return;

    setSendingEmail(true);

    try {
      const existingRequest = slipRequests.find((req) => req.deliveryId === selectedDelivery.id);
      const isFollowUp = !!existingRequest;
      const reminderCount = existingRequest ? existingRequest.remindersSent : 0;

      // Get ALL customer emails (not just the first one)
      const matchedCustomer = customers.find(
        (c) => c.name.toLowerCase().trim() === selectedDelivery.customerName.toLowerCase().trim()
      );
      const customerEmails = matchedCustomer?.emails?.filter((e: string) => e && e.trim()) || [];
      
      // Fallback to generated email if no emails found
      if (customerEmails.length === 0) {
        customerEmails.push(`contact@${selectedDelivery.customerName.toLowerCase().replace(/\s+/g, '')}.com`);
      }

      console.log(`[IncomingDeliveries] Sending slip request to ${customerEmails.length} email(s):`, customerEmails);

      // Call backend API to send email to ALL addresses
      const result = await requestPackingSlip({
        deliveryId: selectedDelivery.id,
        customerEmails,
        customerName: selectedDelivery.customerName,
        containerNumber: selectedDelivery.containerNumber || selectedDelivery.poNumber || '',
        expectedDate: selectedDelivery.expectedDate,
        requestedBy: user?.email || 'warehouse@company.com',
        reminderCount,
      });

      if (result.success) {
        // Update local slip request tracking
        if (isFollowUp) {
          // Follow-up request
          updateSlipRequest(existingRequest.id, {
            remindersSent: existingRequest.remindersSent + 1,
            notes: `Follow-up request sent (${existingRequest.remindersSent + 1} reminders total)`,
          });
          toast.success(`Follow-up packing slip request sent (Reminder #${existingRequest.remindersSent + 1})`);
        } else {
          // Initial request
          const request = {
            id: `SLIP-${Date.now()}`,
            deliveryId: selectedDelivery.id,
            requestedDate: new Date().toISOString(),
            requestedBy: user?.email || 'office@warehouse.com',
            dueDate: selectedDelivery.expectedDate,
            status: 'pending-customer' as const,
            customerEmail: customerEmails[0],
            customerEmails,
            remindersSent: 0,
            notes: `Initial packing slip request - email sent to ${customerEmails.length} recipient(s)`,
          };

          addSlipRequest(request);
          toast.success('Packing slip request email sent to customer');
        }
      } else {
        toast.error(`Failed to send email: ${result.error}`);
        console.error('[IncomingDeliveries] Email send failed:', result);
      }
    } catch (error) {
      toast.error('Failed to send packing slip request email');
      console.error('[IncomingDeliveries] Exception during email send:', error);
    } finally {
      setSendingEmail(false);
      setSlipDialogOpen(false);
      setSelectedDelivery(null);
    }
  };

  const handleMarkSlipReceived = async (delivery: Delivery) => {
    const request = slipRequests.find((req) => req.deliveryId === delivery.id);
    if (!request) {
      toast.error('No packing slip request found for this delivery');
      return;
    }

    updateSlipRequest(request.id, {
      status: 'ready-for-asn',
      receivedDate: new Date().toISOString(),
      notes: 'Packing slip received - ready to create ASN',
    });

    // Write ASN checkbox back to Smartsheet (Mark Received → check ASN column)
    const rowId = delivery.smartsheetRowId || delivery.rowId;
    if (rowId) {
      try {
        const result = await updateSmartsheetDelivery(rowId, { asn: true });
        if (result.success) {
          console.log('[IncomingDeliveries] ✅ ASN checkbox updated in Smartsheet');
          // Update local delivery state to reflect the change
          updateDelivery(delivery.id, { asn: true } as Partial<Delivery>);
          toast.success('Packing slip marked as received & Smartsheet ASN updated');
        } else {
          console.error('[IncomingDeliveries] ❌ Failed to update ASN in Smartsheet:', result.error);
          toast.success('Packing slip marked as received (Smartsheet update failed - will sync on next refresh)');
        }
      } catch (error) {
        console.error('[IncomingDeliveries] ❌ Error updating ASN in Smartsheet:', error);
        toast.success('Packing slip marked as received (Smartsheet update failed - will sync on next refresh)');
      }
    } else {
      toast.success('Packing slip marked as received');
    }
  };

  const handleCreateASN = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setEditingASN(null);
    
    // Try to find matching customer by customerId or customerName
    let matchedCustomerId = delivery.customerId;
    if (!matchedCustomerId) {
      const matchedCustomer = customers.find(
        (c) => c.name.toLowerCase().trim() === delivery.customerName.toLowerCase().trim()
      );
      matchedCustomerId = matchedCustomer?.id;
    }
    
    // Start with 1 blank item
    setASNForm({
      customerId: matchedCustomerId,
      customerName: delivery.customerName,
      containerNumber: delivery.containerNumber,
      door: delivery.door,
      carrier: delivery.carrier,
      trailerNumber: delivery.trackingNumber || '',
      expectedDate: delivery.expectedDate,
      notes: delivery.notes || '',
      items: [
        {
          itemNumber: '',
          expectedQty: 1,
          description: '',
          uom: 'EA',
          palletConfig: { casesPerPallet: 0, casesPerRow: 0, rowsHigh: 0 },
        },
      ],
    });
    setExpandedItems(new Set());
    setItemSearchTerm('');
    setSkuComboboxOpen({});
    setASNDialogOpen(true);
  };

  const handleEditASN = (deliveryId: string) => {
    const asn = asns.find((a) => a.deliveryId === deliveryId);
    const delivery = deliveries.find((d) => d.id === deliveryId);
    if (!asn || !delivery) return;

    setSelectedDelivery(delivery);
    setEditingASN(asn);
    
    // Try to find matching customer by customerId or customerName
    let matchedCustomerId = delivery.customerId;
    if (!matchedCustomerId) {
      const matchedCustomer = customers.find(
        (c) => c.name.toLowerCase().trim() === asn.customerName.toLowerCase().trim()
      );
      matchedCustomerId = matchedCustomer?.id;
    }
    
    setASNForm({
      customerId: matchedCustomerId,
      customerName: asn.customerName,
      containerNumber: asn.containerNumber,
      door: asn.door,
      carrier: delivery.carrier,
      trailerNumber: delivery.trackingNumber || '',
      expectedDate: delivery.expectedDate,
      notes: asn.specialInstructions || '',
      items: asn.items.map((item) => ({
        ...item,
        palletConfig: item.palletConfig || { casesPerPallet: 0, casesPerRow: 0, rowsHigh: 0 },
      })),
    });
    setExpandedItems(new Set());
    setItemSearchTerm('');
    setSkuComboboxOpen({});
    setASNDialogOpen(true);
  };

  const validateASNItems = (): boolean => {
    // Check for empty SKUs
    const emptySkus = asnForm.items.filter((item) => !item.itemNumber.trim());
    if (emptySkus.length > 0) {
      toast.error('Please enter SKU for all items');
      return false;
    }

    // Check for zero or negative quantities
    const invalidQty = asnForm.items.filter((item) => item.expectedQty <= 0);
    if (invalidQty.length > 0) {
      toast.error('All items must have quantity greater than 0');
      return false;
    }

    // Check for duplicate SKUs
    const skuCounts = new Map<string, number>();
    asnForm.items.forEach((item) => {
      const sku = item.itemNumber.trim().toUpperCase();
      skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
    });

    const duplicates = Array.from(skuCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([sku]) => sku);

    if (duplicates.length > 0) {
      toast.error(`Duplicate SKUs found: ${duplicates.join(', ')}`);
      return false;
    }

    return true;
  };

  const handleSaveASN = () => {
    if (!selectedDelivery) return;

    if (asnForm.items.length === 0) {
      toast.error('Please add at least one item to the ASN');
      return;
    }

    // Validate items
    if (!validateASNItems()) {
      return;
    }

    if (editingASN) {
      // Update existing ASN
      updateASN(editingASN.id, {
        customerName: asnForm.customerName,
        containerNumber: asnForm.containerNumber,
        door: asnForm.door,
        items: asnForm.items,
        specialInstructions: asnForm.notes,
      });
      toast.success('ASN updated successfully');
    } else {
      // Create new ASN
      const existingASN = asns.find((asn) => asn.deliveryId === selectedDelivery.id);
      if (existingASN) {
        toast.info('ASN already exists for this delivery');
        setASNDialogOpen(false);
        return;
      }

      // CRITICAL FIX: Include customerId in the ASN object
      const customerId = asnForm.customerId || matchedCustomer?.id || selectedDelivery.customerId;
      
      if (!customerId) {
        toast.error('Cannot create ASN: Customer not found. Please add this customer in Customer Management first.');
        return;
      }

      const asn = {
        id: `ASN-${Date.now()}`,
        deliveryId: selectedDelivery.id,
        customerId: customerId, // ✅ FIXED: Include customerId
        customerName: asnForm.customerName,
        containerNumber: asnForm.containerNumber,
        door: asnForm.door,
        poNumber: selectedDelivery.poNumber,
        items: asnForm.items,
        createdBy: user?.name || 'Office Staff',
        createdAt: new Date().toISOString(),
        status: 'active' as const,
        specialInstructions: asnForm.notes,
      };

      console.log('[IncomingDeliveries] Creating ASN with customerId:', customerId);
      addASN(asn);

      // Update slip request status
      const request = slipRequests.find((req) => req.deliveryId === selectedDelivery.id);
      if (request) {
        updateSlipRequest(request.id, { status: 'asn-created' });
      }

      toast.success('ASN created successfully');
    }

    setASNDialogOpen(false);
    setSelectedDelivery(null);
    setEditingASN(null);
    setASNForm({
      customerName: '',
      containerNumber: '',
      door: '',
      carrier: '',
      trailerNumber: '',
      expectedDate: '',
      notes: '',
      items: [],
    });
  };

  const handleDeleteASN = () => {
    if (!editingASN) return;

    if (confirm('Are you sure you want to delete this ASN?')) {
      deleteASN(editingASN.id);
      toast.success('ASN deleted successfully');
      setASNDialogOpen(false);
      setEditingASN(null);
    }
  };

  const addItemToASN = () => {
    setASNForm({
      ...asnForm,
      items: [
        ...asnForm.items,
        {
          itemNumber: '',
          expectedQty: 1,
          description: '',
          uom: 'EA',
          palletConfig: { casesPerPallet: 0, casesPerRow: 0, rowsHigh: 0 },
        },
      ],
    });
  };

  const updateASNItem = (index: number, field: string, value: string | number) => {
    const updatedItems = [...asnForm.items];
    if (field.startsWith('palletConfig.')) {
      const configField = field.split('.')[1];
      updatedItems[index] = {
        ...updatedItems[index],
        palletConfig: {
          ...updatedItems[index].palletConfig!,
          [configField]: value,
        },
      };
    } else {
      updatedItems[index] = { ...updatedItems[index], [field]: value };
    }
    setASNForm({ ...asnForm, items: updatedItems });
  };

  const selectSKUFromList = (index: number, sku: string) => {
    const updatedItems = [...asnForm.items];
    const selectedItem = filteredExtensivItems?.find((i) => i.itemNumber === sku);
    
    if (selectedItem) {
      updatedItems[index] = {
        ...updatedItems[index],
        itemNumber: selectedItem.itemNumber,
        description: selectedItem.description || '',
        uom: selectedItem.uom || 'EA',
      };
    } else {
      updatedItems[index] = {
        ...updatedItems[index],
        itemNumber: sku,
      };
    }
    
    setASNForm({ ...asnForm, items: updatedItems });
    setSkuComboboxOpen({ ...skuComboboxOpen, [index]: false });
  };

  const removeASNItem = (index: number) => {
    setASNForm({
      ...asnForm,
      items: asnForm.items.filter((_, i) => i !== index),
    });
  };

  const toggleItemExpanded = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const getASNStatusInfo = (deliveryId: string) => {
    const request = slipRequests.find((req) => req.deliveryId === deliveryId);
    const asnRecord = asns.find((a) => a.deliveryId === deliveryId);
    const delivery = deliveries.find((d) => d.id === deliveryId);

    // Check if ASN record exists in local database
    if (asnRecord) {
      return { 
        status: 'asn-created', 
        label: `ASN Created (${asnRecord.items.length} items)`, 
        color: 'bg-blue-100 text-blue-800',
        itemCount: asnRecord.items.length
      };
    }

    // Check Smartsheet ASN checkbox (true = customer sent packing slip)
    // When ASN is checked on Smartsheet → status becomes "Office Pending" & Request Slip is disabled
    if (delivery && delivery.asn === true) {
      return { 
        status: 'pending-office', 
        label: 'Office Pending', 
        color: 'bg-orange-100 text-orange-800' 
      };
    }

    if (!request) {
      return { status: 'no-asn', label: 'No ASN', color: 'bg-red-100 text-red-800' };
    }

    switch (request.status) {
      case 'pending-customer':
        return { status: 'pending-customer', label: 'Pending Customer', color: 'bg-yellow-100 text-yellow-800' };
      case 'ready-for-asn':
        return { status: 'pending-office', label: 'Pending Office', color: 'bg-orange-100 text-orange-800' };
      case 'asn-created':
        return { status: 'asn-created', label: 'ASN Created', color: 'bg-blue-100 text-blue-800' };
      default:
        return { status: 'no-asn', label: 'No ASN', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'blank':
      case '':
      case 'expected':
        return 'bg-gray-100 text-gray-800';
      case 'scheduled':
        return 'bg-gray-100 text-gray-800';
      case 'in-transit':
        return 'bg-blue-100 text-blue-800';
      case 'arrived':
        return 'bg-green-100 text-green-800';
      case 'dropped':
        return 'bg-yellow-100 text-yellow-800';
      case 'unloaded':
        return 'bg-purple-100 text-purple-800';
      case 'checked in':
        return 'bg-indigo-100 text-indigo-800';
      case 'receiving':
        return 'bg-orange-100 text-orange-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter items in ASN dialog
  const filteredASNItems = useMemo(() => {
    if (!itemSearchTerm) return asnForm.items;
    const search = itemSearchTerm.toLowerCase();
    return asnForm.items.filter(
      (item, index) =>
        item.itemNumber.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search) ||
        `item ${index + 1}`.includes(search)
    );
  }, [asnForm.items, itemSearchTerm]);

  // Filter and sort deliveries
  const filteredAndSortedDeliveries = useMemo(() => {
    let filtered = deliveries;

    // Filter by customer
    if (customerFilter !== 'all') {
      filtered = filtered.filter((d) => d.customerId === customerFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.customerName.toLowerCase().includes(search) ||
          d.containerNumber?.toLowerCase().includes(search) ||
          d.poNumber?.toLowerCase().includes(search) ||
          d.carrier?.toLowerCase().includes(search)
      );
    }

    // Filter by tab
    if (activeTab !== 'all') {
      filtered = filtered.filter((d) => {
        const asnInfo = getASNStatusInfo(d.id);
        switch (activeTab) {
          case 'awaiting-slip':
            return asnInfo.status === 'no-asn' || asnInfo.status === 'pending-customer';
          case 'ready-asn':
            return asnInfo.status === 'pending-office';
          case 'asn-created':
            return asnInfo.status === 'asn-created';
          default:
            return true;
        }
      });
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let aValue: string | number = '';
      let bValue: string | number = '';

      switch (sortField) {
        case 'customerName':
          aValue = a.customerName || '';
          bValue = b.customerName || '';
          break;
        case 'containerNumber':
          aValue = a.containerNumber || a.poNumber || '';
          bValue = b.containerNumber || b.poNumber || '';
          break;
        case 'door':
          aValue = a.door || '';
          bValue = b.door || '';
          break;
        case 'expectedDate':
          aValue = a.expectedDate || '';
          bValue = b.expectedDate || '';
          break;
        case 'carrier':
          aValue = a.carrier || '';
          bValue = b.carrier || '';
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'asnStatus':
          aValue = getASNStatusInfo(a.id).label;
          bValue = getASNStatusInfo(b.id).label;
          break;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc' 
        ? (aValue > bValue ? 1 : -1)
        : (bValue > aValue ? 1 : -1);
    });

    return sorted;
  }, [deliveries, customerFilter, searchTerm, activeTab, sortField, sortDirection, slipRequests, asns]);

  // Count by status
  const statusCounts = useMemo(() => {
    return {
      all: deliveries.length,
      awaitingSlip: deliveries.filter((d) => {
        const info = getASNStatusInfo(d.id);
        return info.status === 'no-asn' || info.status === 'pending-customer';
      }).length,
      readyAsn: deliveries.filter((d) => getASNStatusInfo(d.id).status === 'pending-office').length,
      asnCreated: deliveries.filter((d) => getASNStatusInfo(d.id).status === 'asn-created').length,
    };
  }, [deliveries, slipRequests, asns]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Incoming Deliveries</h1>
        <p className="text-gray-600 mt-1">Office planning and data preparation - manage delivery information and create ASNs</p>
      </div>

      {/* Smartsheet Sync Alert */}
      {!isSmartsheetConfigured && (
        <Alert>
          <AlertDescription>
            <strong>Smartsheet not configured.</strong> Go to Settings to configure Smartsheet API to enable automatic delivery sync.
          </AlertDescription>
        </Alert>
      )}

      {/* Sync Error Alert */}
      {syncError && (
        <Alert variant="destructive" className="py-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <strong>Sync Failed:</strong> {syncError.error}
            <Button size="sm" variant="outline" onClick={handleCopySyncLog} className="ml-2">
              <Copy className="h-3 w-3 mr-1" />
              Copy Log
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSyncError(null)} className="ml-2">
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Delivery Management
              </CardTitle>
              <CardDescription>Track deliveries and manage packing slip workflow</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {dataSource === 'live' ? '🟢 Live' : '🔵 Cached'} · Last sync: {formatTimestamp(lastSyncTimestamp)}
              </span>
              <Button
                onClick={handleFullSync}
                disabled={autoSyncing || !isSmartsheetConfigured}
                variant="default"
                size="sm"
                className="gap-2"
              >
                <Download className={cn("h-3 w-3", autoSyncing && "animate-spin")} />
                {autoSyncing ? 'Syncing...' : 'Sync All'}
              </Button>
              {lastSyncTimestamp && (
                <Button
                  onClick={handleClearCache}
                  variant="outline"
                  size="sm"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filter Bar */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by customer, PO, container, carrier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" className="gap-2">
                All ({statusCounts.all})
              </TabsTrigger>
              <TabsTrigger value="awaiting-slip" className="gap-2">
                Awaiting Slip ({statusCounts.awaitingSlip})
              </TabsTrigger>
              <TabsTrigger value="ready-asn" className="gap-2">
                Ready for ASN ({statusCounts.readyAsn})
              </TabsTrigger>
              <TabsTrigger value="asn-created" className="gap-2">
                ASN Created ({statusCounts.asnCreated})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer" onClick={() => handleSort('customerName')}>
                        <div className="flex items-center gap-1">
                          Customer
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort('containerNumber')}>
                        <div className="flex items-center gap-1">
                          PO/Container #
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort('door')}>
                        <div className="flex items-center gap-1">
                          Door
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort('expectedDate')}>
                        <div className="flex items-center gap-1">
                          Expected Date
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort('carrier')}>
                        <div className="flex items-center gap-1">
                          Carrier
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort('status')}>
                        <div className="flex items-center gap-1">
                          Status
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort('asnStatus')}>
                        <div className="flex items-center gap-1">
                          ASN Status
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedDeliveries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                          {searchTerm || customerFilter !== 'all' 
                            ? 'No deliveries found matching your filters' 
                            : 'No deliveries found. Click "Sync All" to load deliveries.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAndSortedDeliveries.map((delivery) => {
                        const asnInfo = getASNStatusInfo(delivery.id);
                        const existingRequest = slipRequests.find((req) => req.deliveryId === delivery.id);
                        const isFollowUp = !!existingRequest;

                        return (
                          <TableRow key={delivery.id}>
                            <TableCell className="font-medium">{delivery.customerName}</TableCell>
                            <TableCell>{delivery.containerNumber || delivery.poNumber}</TableCell>
                            <TableCell>{delivery.door}</TableCell>
                            <TableCell>{delivery.expectedDate}</TableCell>
                            <TableCell className="text-sm">{delivery.carrier}</TableCell>
                            <TableCell>
                              <Select
                                value={delivery.status || 'Expected'}
                                onValueChange={(value) => handleQuickStatusChange(delivery, value)}
                              >
                                <SelectTrigger className="w-[140px] h-7">
                                  <Badge className={getStatusColor(delivery.status)}>
                                    {delivery.status || 'Expected'}
                                  </Badge>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Expected">Expected</SelectItem>
                                  <SelectItem value="Blank">Blank</SelectItem>
                                  <SelectItem value="Arrived">Arrived</SelectItem>
                                  <SelectItem value="Dropped">Dropped</SelectItem>
                                  <SelectItem value="Unloaded">Unloaded</SelectItem>
                                  <SelectItem value="Checked In">Checked In</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Badge className={asnInfo.color}>{asnInfo.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditDelivery(delivery)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit Delivery
                                  </DropdownMenuItem>
                                  
                                  {/* Only show Create ASN if no ASN exists */}
                                  {asnInfo.status !== 'asn-created' && (
                                    <DropdownMenuItem onClick={() => handleCreateASN(delivery)}>
                                      <Plus className="h-4 w-4 mr-2" />
                                      Create ASN
                                    </DropdownMenuItem>
                                  )}

                                  {/* Show Request Slip or Follow Up — disabled when ASN already checked (pending-office) */}
                                  {(asnInfo.status === 'no-asn' || asnInfo.status === 'pending-customer') && (
                                    <DropdownMenuItem onClick={() => handleRequestPackingSlip(delivery)}>
                                      <FileText className="h-4 w-4 mr-2" />
                                      {isFollowUp ? 'Follow Up' : 'Request Slip'}
                                    </DropdownMenuItem>
                                  )}

                                  {/* Show Mark Received when slip is pending from customer */}
                                  {asnInfo.status === 'pending-customer' && (
                                    <DropdownMenuItem onClick={() => handleMarkSlipReceived(delivery)}>
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Mark Received
                                    </DropdownMenuItem>
                                  )}

                                  {asnInfo.status === 'asn-created' && (
                                    <DropdownMenuItem onClick={() => handleEditASN(delivery.id)}>
                                      <Eye className="h-4 w-4 mr-2" />
                                      View/Edit ASN
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Delivery Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Delivery</DialogTitle>
            <DialogDescription>Update delivery information in Smartsheet</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="customerId">Customer *</Label>
              <Select
                value={editForm.customerId || ''}
                onValueChange={(value) => {
                  const customer = customers.find((c) => c.id === value);
                  setEditForm({ 
                    ...editForm, 
                    customerId: value,
                    customerName: customer?.name || ''
                  });
                }}
              >
                <SelectTrigger id="customerId">
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} ({customer.thirdPartyLogisticsId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="poContainerNumber">PO/Container Number</Label>
              <Input
                id="poContainerNumber"
                value={editForm.containerNumber || editForm.poNumber || ''}
                onChange={(e) => setEditForm({ 
                  ...editForm, 
                  containerNumber: e.target.value,
                  poNumber: e.target.value 
                })}
                placeholder="Enter PO or Container number"
              />
              <p className="text-xs text-gray-500 mt-1">
                This value will be used for both PO # and Container # fields
              </p>
            </div>

            <div>
              <Label htmlFor="door">Door</Label>
              <Input id="door" value={editForm.door || ''} onChange={(e) => setEditForm({ ...editForm, door: e.target.value })} />
            </div>

            <div>
              <Label htmlFor="expectedDate">Expected Date</Label>
              <Input
                id="expectedDate"
                type="date"
                value={editForm.expectedDate || ''}
                onChange={(e) => setEditForm({ ...editForm, expectedDate: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="carrier">Carrier</Label>
              <Input
                id="carrier"
                value={editForm.carrier || ''}
                onChange={(e) => setEditForm({ ...editForm, carrier: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="trackingNumber">Tracking Number</Label>
              <Input
                id="trackingNumber"
                value={editForm.trackingNumber || ''}
                onChange={(e) => setEditForm({ ...editForm, trackingNumber: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={editForm.status || 'Expected'}
                onValueChange={(value) => setEditForm({ ...editForm, status: value })}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Expected">Expected</SelectItem>
                  <SelectItem value="Blank">Blank</SelectItem>
                  <SelectItem value="Arrived">Arrived</SelectItem>
                  <SelectItem value="Dropped">Dropped</SelectItem>
                  <SelectItem value="Unloaded">Unloaded</SelectItem>
                  <SelectItem value="Checked In">Checked In</SelectItem>
                  <SelectItem value="Receiving">Receiving</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={editForm.notes || ''}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDelivery}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Packing Slip Dialog */}
      <Dialog open={slipDialogOpen} onOpenChange={setSlipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDelivery && slipRequests.find((req) => req.deliveryId === selectedDelivery.id) 
                ? 'Follow-Up Packing Slip Request' 
                : 'Request Packing Slip'}
            </DialogTitle>
            <DialogDescription>Send packing slip request email to customer</DialogDescription>
          </DialogHeader>

          {selectedDelivery && (
            <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between">
                <span className="text-gray-600">Customer:</span>
                <span className="font-semibold">{selectedDelivery.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">PO/Container:</span>
                <span className="font-semibold">{selectedDelivery.containerNumber || selectedDelivery.poNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Expected Date:</span>
                <span className="font-semibold">{selectedDelivery.expectedDate}</span>
              </div>
              {slipRequests.find((req) => req.deliveryId === selectedDelivery.id) && (
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="text-gray-600">Previous Reminders:</span>
                  <span className="font-semibold">
                    {slipRequests.find((req) => req.deliveryId === selectedDelivery.id)?.remindersSent || 0}
                  </span>
                </div>
              )}
            </div>
          )}

          <p className="text-sm text-gray-600">
            {selectedDelivery && slipRequests.find((req) => req.deliveryId === selectedDelivery.id)
              ? 'This will send a follow-up reminder email to the customer.'
              : 'This will send a real email request to the customer asking for the packing slip for this delivery.'}
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSlipDialogOpen(false)} disabled={sendingEmail}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSlipRequest} disabled={sendingEmail}>
              {sendingEmail ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ASN Dialog - Complete implementation remains unchanged */}
      <Dialog open={asnDialogOpen} onOpenChange={setASNDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setASNDialogOpen(false)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <DialogTitle className="text-2xl">{editingASN ? 'Edit ASN' : 'Create ASN'}</DialogTitle>
              </div>
              {editingASN && (
                <Button variant="destructive" size="sm" onClick={handleDeleteASN}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete ASN
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Shipment Details */}
            <Card>
              <CardHeader>
                <CardTitle>Shipment Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Customer *</Label>
                    <Select
                      value={asnForm.customerId || ''}
                      onValueChange={(value) => {
                        const customer = customers.find((c) => c.id === value);
                        setASNForm({ 
                          ...asnForm, 
                          customerId: value,
                          customerName: customer?.name || ''
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name} ({customer.thirdPartyLogisticsId})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>PO/Container #</Label>
                    <Input
                      value={asnForm.containerNumber}
                      onChange={(e) => setASNForm({ ...asnForm, containerNumber: e.target.value })}
                      placeholder="PO or Container number"
                    />
                  </div>
                  <div>
                    <Label>Dock Door</Label>
                    <Input value={asnForm.door} onChange={(e) => setASNForm({ ...asnForm, door: e.target.value })} placeholder="Door 5" />
                  </div>
                  <div>
                    <Label>Carrier</Label>
                    <Input
                      value={asnForm.carrier}
                      onChange={(e) => setASNForm({ ...asnForm, carrier: e.target.value })}
                      placeholder="Carrier"
                    />
                  </div>
                  <div>
                    <Label>Trailer #</Label>
                    <Input
                      value={asnForm.trailerNumber}
                      onChange={(e) => setASNForm({ ...asnForm, trailerNumber: e.target.value })}
                      placeholder="Trailer #"
                    />
                  </div>
                  <div>
                    <Label>Expected Date</Label>
                    <Input
                      type="date"
                      value={asnForm.expectedDate}
                      onChange={(e) => setASNForm({ ...asnForm, expectedDate: e.target.value })}
                    />
                  </div>
                  <div className="col-span-3">
                    <Label>Notes</Label>
                    <Textarea
                      value={asnForm.notes}
                      onChange={(e) => setASNForm({ ...asnForm, notes: e.target.value })}
                      placeholder="Additional notes..."
                      rows={3}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Expected Items */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle>Expected Items ({asnForm.items.length})</CardTitle>
                    {matchedCustomer && (
                      <Badge variant="outline" className="text-xs">
                        {filteredExtensivItems.length} SKUs filtered
                      </Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleSyncSKUs} disabled={syncingSKUs}>
                    <RefreshCw className={cn("h-4 w-4 mr-2", syncingSKUs && "animate-spin")} />
                    {syncingSKUs ? 'Syncing...' : 'Sync SKUs'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Item Search */}
                {asnForm.items.length > 3 && (
                  <div className="mb-4 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search items by SKU or description..."
                      value={itemSearchTerm}
                      onChange={(e) => setItemSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                )}

                <div className="space-y-3">
                  {(itemSearchTerm ? filteredASNItems : asnForm.items).map((item, index) => {
                    const actualIndex = asnForm.items.indexOf(item);
                    return (
                      <div key={actualIndex} className="border rounded-lg p-4 space-y-3">
                        <div className="flex gap-2 items-start">
                          <div className="flex-1">
                            <Label className="text-xs text-gray-600 mb-1">SKU *</Label>
                            <Popover open={skuComboboxOpen[actualIndex]} onOpenChange={(open) => setSkuComboboxOpen({ ...skuComboboxOpen, [actualIndex]: open })}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={skuComboboxOpen[actualIndex]}
                                  className={cn("w-full justify-between", !item.itemNumber && "border-red-300")}
                                >
                                  {item.itemNumber || "Select SKU..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-0">
                                <Command>
                                  <CommandInput placeholder="Search SKU..." />
                                  <CommandList>
                                    <CommandEmpty>No SKU found.</CommandEmpty>
                                    <CommandGroup>
                                      {filteredExtensivItems.map((extItem) => (
                                        <CommandItem
                                          key={extItem.itemNumber}
                                          value={extItem.itemNumber}
                                          onSelect={() => selectSKUFromList(actualIndex, extItem.itemNumber)}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              item.itemNumber === extItem.itemNumber ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          <div className="flex flex-col">
                                            <span className="font-medium">{extItem.itemNumber}</span>
                                            <span className="text-xs text-gray-500">{extItem.description}</span>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs text-gray-600 mb-1">Description</Label>
                            <Input
                              placeholder="Description"
                              value={item.description}
                              onChange={(e) => updateASNItem(actualIndex, 'description', e.target.value)}
                            />
                          </div>
                          <div className="w-24">
                            <Label className="text-xs text-gray-600 mb-1">Qty *</Label>
                            <Input
                              type="number"
                              placeholder="Qty"
                              value={item.expectedQty}
                              onChange={(e) => updateASNItem(actualIndex, 'expectedQty', parseInt(e.target.value) || 0)}
                              min="1"
                              className={cn(item.expectedQty <= 0 && "border-red-300")}
                            />
                          </div>
                          <div className="pt-5">
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeASNItem(actualIndex)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Pallet Config Collapsible */}
                        <Collapsible open={expandedItems.has(actualIndex)} onOpenChange={() => toggleItemExpanded(actualIndex)}>
                          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                            {expandedItems.has(actualIndex) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            Pallet Config
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-3">
                            <div className="grid grid-cols-3 gap-3 pl-6">
                              <div>
                                <Label className="text-xs">Cases/Pallet</Label>
                                <Input
                                  type="number"
                                  placeholder="Total"
                                  value={item.palletConfig?.casesPerPallet || ''}
                                  onChange={(e) =>
                                    updateASNItem(actualIndex, 'palletConfig.casesPerPallet', parseInt(e.target.value) || 0)
                                  }
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Cases/Row</Label>
                                <Input
                                  type="number"
                                  placeholder="Row"
                                  value={item.palletConfig?.casesPerRow || ''}
                                  onChange={(e) => updateASNItem(actualIndex, 'palletConfig.casesPerRow', parseInt(e.target.value) || 0)}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Rows High</Label>
                                <Input
                                  type="number"
                                  placeholder="Layers"
                                  value={item.palletConfig?.rowsHigh || ''}
                                  onChange={(e) => updateASNItem(actualIndex, 'palletConfig.rowsHigh', parseInt(e.target.value) || 0)}
                                />
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    );
                  })}

                  <Button type="button" variant="outline" className="w-full" onClick={addItemToASN}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setASNDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveASN} className="bg-orange-500 hover:bg-orange-600">
              {editingASN ? 'Update ASN' : 'Create ASN'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}