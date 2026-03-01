import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Eye, RefreshCw, AlertCircle, Info, RotateCw } from 'lucide-react';
import { ASN, ASNItem } from '@/types';
import { toast } from 'sonner';

export default function ASNManagement() {
  const { deliveries = [], slipRequests = [], asns = [], addASN, updateASN, deleteASN, retryASNSync, extensivItems = [], syncExtensivItems, apiConfig, customers = [], updateSlipRequest } = useData();
  const { user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState('');
  const [items, setItems] = useState<ASNItem[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [viewingASN, setViewingASN] = useState<ASN | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [retryingASN, setRetryingASN] = useState<string | null>(null);

  const readyForASN = slipRequests.filter((s) => s.status === 'ready-for-asn');

  // Get the selected delivery
  const selectedDelivery = useMemo(() => {
    return deliveries.find((d) => d.id === selectedDeliveryId);
  }, [deliveries, selectedDeliveryId]);

  // Find the customer ID by matching customer name
  const matchedCustomer = useMemo(() => {
    if (!selectedDelivery) return null;
    
    // First try direct customerId match
    if (selectedDelivery.customerId) {
      const customer = customers.find((c) => c.id === selectedDelivery.customerId);
      if (customer) {
        console.log('[ASNManagement] Direct customerId match:', {
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
      console.log('[ASNManagement] Customer name match found:', {
        deliveryCustomerName: selectedDelivery.customerName,
        matchedCustomerName: matched.name,
        matchedCustomerId: matched.id,
        matched3PLID: matched.thirdPartyLogisticsId
      });
    } else {
      console.log('[ASNManagement] No customer match found:', {
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

  // Filter items by the matched customer's 3PL ID
  const filteredExtensivItems = useMemo(() => {
    if (!selectedDelivery) {
      console.log('[ASNManagement] No delivery selected - showing no items');
      return [];
    }

    // If we found a matching customer, filter items by their 3PL ID
    if (matchedCustomer) {
      const filtered = extensivItems.filter((item) => 
        item.customerId === matchedCustomer.thirdPartyLogisticsId
      );
      
      console.log('[ASNManagement] Filtering items by 3PL ID:', {
        deliveryCustomerName: selectedDelivery.customerName,
        matchedCustomer3PLID: matchedCustomer.thirdPartyLogisticsId,
        totalExtensivItems: extensivItems.length,
        filteredItems: filtered.length,
        sampleExtensivItemCustomerIds: extensivItems.slice(0, 5).map(i => i.customerId)
      });
      
      return filtered;
    }

    // If no match found, show all items but we'll display a warning
    console.log('[ASNManagement] No customer match - showing all items as fallback');
    return extensivItems;
  }, [selectedDelivery, matchedCustomer, extensivItems]);

  const handleSelectDelivery = (deliveryId: string) => {
    setSelectedDeliveryId(deliveryId);
    setItems([{ itemNumber: '', description: '', expectedQty: 0, uom: 'EA' }]);
  };

  const handleAddItem = () => {
    setItems([...items, { itemNumber: '', description: '', expectedQty: 0, uom: 'EA' }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: keyof ASNItem, value: string | number) => {
    const updated = [...items];
    if (field === 'itemNumber' && typeof value === 'string') {
      const extensivItem = filteredExtensivItems.find((item) => item.itemNumber === value);
      if (extensivItem) {
        updated[index] = {
          ...updated[index],
          itemNumber: value,
          description: extensivItem.description,
          uom: extensivItem.uom,
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setItems(updated);
  };

  const handleCreateASN = () => {
    const delivery = deliveries.find((d) => d.id === selectedDeliveryId);
    if (!delivery || !user || items.length === 0 || items.some((i) => !i.itemNumber || i.expectedQty <= 0)) {
      toast.error('Please fill in all item details');
      return;
    }

    // CRITICAL FIX: Include customerId in the ASN object
    const customerId = matchedCustomer?.id || delivery.customerId;
    
    if (!customerId) {
      toast.error('Cannot create ASN: Customer not found. Please add this customer in Customer Management first.');
      return;
    }

    const newASN: ASN = {
      id: `ASN-${Date.now()}`,
      deliveryId: delivery.id,
      customerId: customerId, // ✅ FIXED: Include customerId
      customerName: delivery.customerName,
      containerNumber: delivery.containerNumber,
      door: delivery.door,
      poNumber: delivery.poNumber,
      items,
      createdBy: user.name,
      createdAt: new Date().toISOString(),
      status: 'active',
      specialInstructions,
    };

    console.log('[ASNManagement] Creating ASN with customerId:', customerId);
    addASN(newASN);
    
    // Update slip request status
    const slipRequest = slipRequests.find((s) => s.deliveryId === delivery.id);
    if (slipRequest) {
      updateSlipRequest(slipRequest.id, { status: 'asn-created' });
    }

    toast.success('ASN created successfully');
    
    setIsCreateOpen(false);
    setSelectedDeliveryId('');
    setItems([]);
    setSpecialInstructions('');
  };

  const handleSyncItems = async () => {
    setSyncing(true);
    await syncExtensivItems();
    setSyncing(false);
    toast.success('Items synced from Extensiv');
  };

  const handleDeleteASN = (id: string) => {
    if (confirm('Are you sure you want to delete this ASN?')) {
      deleteASN(id);
      toast.success('ASN deleted');
    }
  };

  const handleRetrySync = async (id: string) => {
    setRetryingASN(id);
    await retryASNSync(id);
    setRetryingASN(null);
  };

  const lastSyncDate = apiConfig?.extensiv.lastItemSync
    ? new Date(apiConfig.extensiv.lastItemSync).toLocaleString()
    : 'Never';

  // Helper function to get sync status badge
  const getSyncStatusBadge = (asn: ASN) => {
    if (!asn.syncStatus || asn.syncStatus === 'synced') {
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          Synced
        </Badge>
      );
    }
    
    if (asn.syncStatus === 'pending') {
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          Syncing...
        </Badge>
      );
    }
    
    if (asn.syncStatus === 'failed') {
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          Sync Failed
        </Badge>
      );
    }
    
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">ASN Management</h1>
          <p className="text-gray-600 mt-1">Create Advanced Shipping Notices for deliveries</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-sm">
            <p className="text-gray-500">Last item sync:</p>
            <p className="font-medium">{lastSyncDate}</p>
          </div>
          <Button
            variant="outline"
            onClick={handleSyncItems}
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync Items
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Active ASNs ({asns.length})</CardTitle>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create ASN
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New ASN</DialogTitle>
                  <DialogDescription>
                    Select a delivery and add item details from Extensiv
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="delivery">Select Delivery</Label>
                    <Select value={selectedDeliveryId} onValueChange={handleSelectDelivery}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a delivery" />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveries.map((delivery) => (
                          <SelectItem key={delivery.id} value={delivery.id}>
                            {delivery.customerName} - {delivery.containerNumber} ({delivery.door})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedDeliveryId && (
                    <>
                      <div className="border rounded-md p-4 bg-blue-50">
                        <h4 className="font-medium mb-2">Delivery Information (Auto-filled)</h4>
                        {selectedDelivery && (
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><span className="text-gray-600">Customer:</span> <span className="font-medium">{selectedDelivery.customerName}</span></div>
                            <div><span className="text-gray-600">Container:</span> <span className="font-medium">{selectedDelivery.containerNumber}</span></div>
                            <div><span className="text-gray-600">Door:</span> <span className="font-medium">{selectedDelivery.door}</span></div>
                            <div><span className="text-gray-600">PO:</span> <span className="font-medium">{selectedDelivery.poNumber}</span></div>
                          </div>
                        )}
                      </div>

                      {/* Customer Matching Info Box */}
                      {selectedDelivery && (
                        <div className={`border rounded-md p-3 flex items-start gap-2 ${
                          matchedCustomer 
                            ? 'bg-green-50 border-green-300' 
                            : 'bg-amber-50 border-amber-300'
                        }`}>
                          {matchedCustomer ? (
                            <Info className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="text-sm flex-1">
                            {matchedCustomer ? (
                              <>
                                <p className="font-medium text-green-900">Customer Match Found</p>
                                <div className="mt-2 space-y-1">
                                  <p className="text-green-700">
                                    <span className="font-medium">Customer Name:</span> {matchedCustomer.name}
                                  </p>
                                  <p className="text-green-700">
                                    <span className="font-medium">3PL ID:</span> {matchedCustomer.thirdPartyLogisticsId}
                                  </p>
                                  <p className="text-green-700 mt-2">
                                    Showing {filteredExtensivItems.length} items filtered by this customer's 3PL ID.
                                  </p>
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="font-medium text-amber-900">No Customer Match Found</p>
                                <p className="text-amber-700 mt-1">
                                  Could not find a customer record matching "{selectedDelivery.customerName}". 
                                  Showing all {extensivItems.length} items from Extensiv.
                                </p>
                                <p className="text-amber-700 mt-2">
                                  <span className="font-medium">To enable filtering:</span> Add this customer to Customer Management 
                                  with the exact name "{selectedDelivery.customerName}" and their 3PL ID from Extensiv.
                                </p>
                                {customers.length > 0 && (
                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-amber-800 font-medium">
                                      Available Customers ({customers.length})
                                    </summary>
                                    <ul className="mt-1 ml-4 text-xs space-y-1">
                                      {customers.map((c) => (
                                        <li key={c.id} className="text-amber-700">
                                          {c.name} (3PL ID: {c.thirdPartyLogisticsId})
                                        </li>
                                      ))}
                                    </ul>
                                  </details>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label>
                            Items ({filteredExtensivItems.length} available
                            {matchedCustomer && filteredExtensivItems.length < extensivItems.length && (
                              <span className="text-green-600 ml-1">
                                - filtered for {matchedCustomer.name}
                              </span>
                            )}
                            {!matchedCustomer && extensivItems.length > 0 && (
                              <span className="text-amber-600 ml-1">
                                - showing all items (no customer match)
                              </span>
                            )})
                          </Label>
                          <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add Item
                          </Button>
                        </div>

                        {filteredExtensivItems.length === 0 && (
                          <div className="border border-red-300 rounded-md p-3 bg-red-50 text-sm text-red-700">
                            <p className="font-medium">No items available</p>
                            <p className="mt-1">
                              {matchedCustomer 
                                ? `No items in Extensiv match the 3PL ID "${matchedCustomer.thirdPartyLogisticsId}". Please verify the 3PL ID is correct or sync items from Extensiv.`
                                : 'Please add this customer to Customer Management with their correct 3PL ID, then sync items from Extensiv.'
                              }
                            </p>
                          </div>
                        )}

                        {items.map((item, index) => (
                          <div key={index} className="border rounded-md p-4 space-y-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">Item {index + 1}</span>
                              {items.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveItem(index)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Item Number *</Label>
                                <Select
                                  value={item.itemNumber}
                                  onValueChange={(value) => handleUpdateItem(index, 'itemNumber', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select or type item number" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {filteredExtensivItems.length > 0 ? (
                                      filteredExtensivItems.map((extItem) => (
                                        <SelectItem key={extItem.itemNumber} value={extItem.itemNumber}>
                                          {extItem.itemNumber} - {extItem.description}
                                        </SelectItem>
                                      ))
                                    ) : (
                                      <SelectItem value="no-items" disabled>
                                        No items available - select a delivery first
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label>Description</Label>
                                <Input
                                  value={item.description}
                                  onChange={(e) => handleUpdateItem(index, 'description', e.target.value)}
                                  placeholder="Item description"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Expected Quantity *</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.expectedQty || ''}
                                  onChange={(e) => handleUpdateItem(index, 'expectedQty', parseInt(e.target.value) || 0)}
                                  placeholder="0"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>UOM</Label>
                                <Select
                                  value={item.uom}
                                  onValueChange={(value) => handleUpdateItem(index, 'uom', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="EA">EA (Each)</SelectItem>
                                    <SelectItem value="BOX">BOX</SelectItem>
                                    <SelectItem value="CASE">CASE</SelectItem>
                                    <SelectItem value="PALLET">PALLET</SelectItem>
                                    <SelectItem value="SET">SET</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="instructions">Special Instructions (Optional)</Label>
                        <Textarea
                          id="instructions"
                          placeholder="Add any special handling instructions..."
                          value={specialInstructions}
                          onChange={(e) => setSpecialInstructions(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateASN}
                    disabled={!selectedDeliveryId || items.length === 0 || filteredExtensivItems.length === 0}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Create ASN
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {asns.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No ASNs created yet</p>
              {readyForASN.length > 0 && (
                <p className="text-sm text-blue-600 mb-4">
                  {readyForASN.length} deliveries ready for ASN creation
                </p>
              )}
              <Button onClick={() => setIsCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Create First ASN
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ASN ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Container</TableHead>
                    <TableHead>Door</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sync Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {asns.map((asn) => (
                    <TableRow key={asn.id}>
                      <TableCell className="font-medium">{asn.id}</TableCell>
                      <TableCell>{asn.customerName}</TableCell>
                      <TableCell>{asn.containerNumber}</TableCell>
                      <TableCell>{asn.door}</TableCell>
                      <TableCell>{asn.items.length} items</TableCell>
                      <TableCell>{new Date(asn.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            asn.status === 'active'
                              ? 'bg-green-100 text-green-800 hover:bg-green-100'
                              : asn.status === 'receiving'
                              ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                              : asn.status === 'completed'
                              ? 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                              : ''
                          }
                        >
                          {asn.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getSyncStatusBadge(asn)}
                          {asn.syncStatus === 'failed' && asn.syncError && (
                            <div className="group relative">
                              <AlertCircle className="h-4 w-4 text-red-600 cursor-help" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                                {asn.syncError}
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingASN(asn)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {asn.syncStatus === 'failed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRetrySync(asn.id)}
                              disabled={retryingASN === asn.id}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <RotateCw className={`h-4 w-4 ${retryingASN === asn.id ? 'animate-spin' : ''}`} />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteASN(asn.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View ASN Dialog */}
      <Dialog open={!!viewingASN} onOpenChange={() => setViewingASN(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>ASN Details - {viewingASN?.id}</DialogTitle>
          </DialogHeader>
          {viewingASN && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-md">
                <div><Label className="text-gray-600">Customer</Label><p className="font-medium">{viewingASN.customerName}</p></div>
                <div><Label className="text-gray-600">Container</Label><p className="font-medium">{viewingASN.containerNumber}</p></div>
                <div><Label className="text-gray-600">Door</Label><p className="font-medium">{viewingASN.door}</p></div>
                <div><Label className="text-gray-600">PO Number</Label><p className="font-medium">{viewingASN.poNumber}</p></div>
                <div><Label className="text-gray-600">Created By</Label><p className="font-medium">{viewingASN.createdBy}</p></div>
                <div><Label className="text-gray-600">Created</Label><p className="font-medium">{new Date(viewingASN.createdAt).toLocaleString()}</p></div>
              </div>

              {/* Sync Status Section */}
              {viewingASN.syncStatus && viewingASN.syncStatus !== 'synced' && (
                <div className={`border rounded-md p-3 ${
                  viewingASN.syncStatus === 'failed' 
                    ? 'bg-red-50 border-red-300' 
                    : 'bg-blue-50 border-blue-300'
                }`}>
                  <div className="flex items-center gap-2">
                    {viewingASN.syncStatus === 'failed' ? (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    ) : (
                      <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                    )}
                    <div className="flex-1">
                      <p className={`font-medium ${
                        viewingASN.syncStatus === 'failed' ? 'text-red-900' : 'text-blue-900'
                      }`}>
                        {viewingASN.syncStatus === 'failed' ? 'Sync Failed' : 'Syncing to Database...'}
                      </p>
                      {viewingASN.syncError && (
                        <p className="text-sm text-red-700 mt-1">{viewingASN.syncError}</p>
                      )}
                      {viewingASN.lastSyncAttempt && (
                        <p className="text-xs text-gray-600 mt-1">
                          Last attempt: {new Date(viewingASN.lastSyncAttempt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-lg font-semibold mb-3 block">Items</Label>
                <div className="space-y-2">
                  {viewingASN.items.map((item, idx) => (
                    <div key={idx} className="border rounded-md p-3 flex justify-between items-center">
                      <div>
                        <p className="font-medium">{item.itemNumber}</p>
                        <p className="text-sm text-gray-600">{item.description}</p>
                      </div>
                      <Badge variant="outline">
                        {item.expectedQty} {item.uom}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {viewingASN.specialInstructions && (
                <div>
                  <Label className="text-gray-600 mb-2 block">Special Instructions</Label>
                  <p className="border rounded-md p-4 bg-amber-50 text-sm">
                    {viewingASN.specialInstructions}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}