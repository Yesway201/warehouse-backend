import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Mail, Clock, CheckCircle, Plus, Search, Filter, AlertCircle, Eye, Edit, Trash2 } from 'lucide-react';
import { Delivery, ASN, PackingSlipRequest } from '@/types';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type StatusFilterType = 'all' | 'no-slip' | 'pending-customer' | 'ready-for-asn' | 'asn-created' | 'completed';

export default function SlipsAndASN() {
  const { slipRequests = [], updateSlipRequest, deliveries = [], asns = [], addASN, updateASN, deleteASN, addSlipRequest, extensivItems = [] } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [viewingASN, setViewingASN] = useState<ASN | null>(null);
  const [editingASN, setEditingASN] = useState<ASN | null>(null);
  const [deletingASNId, setDeletingASNId] = useState<string | null>(null);
  const [asnDialogOpen, setAsnDialogOpen] = useState(false);
  const [viewASNDialogOpen, setViewASNDialogOpen] = useState(false);
  const [editASNDialogOpen, setEditASNDialogOpen] = useState(false);
  const [newASN, setNewASN] = useState({
    deliveryId: '',
    items: [] as { itemNumber: string; expectedQty: number; description: string; uom: string }[],
    specialInstructions: '',
  });

  // Combine ALL deliveries with their slip/ASN status
  const workflowItems = useMemo(() => {
    const items: Array<{
      id: string;
      type: 'delivery';
      deliveryId: string;
      customer: string;
      carrier: string;
      tracking: string;
      expectedDate: string;
      containerNumber: string;
      poNumber: string;
      status: 'no-slip' | 'pending-customer' | 'ready-for-asn' | 'asn-created' | 'completed';
      slipId?: string;
      asnId?: string;
      requestedDate?: string;
      receivedDate?: string;
      asnCreatedDate?: string;
      itemCount?: number;
    }> = [];

    // Safety check
    if (!deliveries) {
      return items;
    }

    // Process each delivery
    deliveries.forEach((delivery) => {
      const slip = slipRequests?.find((s) => s.deliveryId === delivery.id);
      const asn = asns?.find((a) => a.deliveryId === delivery.id);

      let status: 'no-slip' | 'pending-customer' | 'ready-for-asn' | 'asn-created' | 'completed' = 'no-slip';
      
      if (asn) {
        status = asn.status === 'completed' ? 'completed' : 'asn-created';
      } else if (slip) {
        status = slip.status as 'pending-customer' | 'ready-for-asn';
      }

      items.push({
        id: delivery.id,
        type: 'delivery',
        deliveryId: delivery.id,
        customer: delivery.customerName,
        carrier: delivery.carrier || 'N/A',
        tracking: delivery.trackingNumber || 'N/A',
        expectedDate: delivery.expectedDate,
        containerNumber: delivery.containerNumber,
        poNumber: delivery.poNumber,
        status,
        slipId: slip?.id,
        asnId: asn?.id,
        requestedDate: slip?.requestedDate,
        receivedDate: slip?.receivedDate,
        asnCreatedDate: asn?.createdAt,
        itemCount: asn?.items.length,
      });
    });

    return items;
  }, [slipRequests, asns, deliveries]);

  // Filter items
  const filteredItems = useMemo(() => {
    return workflowItems.filter((item) => {
      const matchesSearch =
        item.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.tracking.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.containerNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.poNumber.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [workflowItems, searchTerm, statusFilter]);

  // Count by status
  const statusCounts = useMemo(() => {
    return {
      noSlip: workflowItems.filter((i) => i.status === 'no-slip').length,
      pendingCustomer: workflowItems.filter((i) => i.status === 'pending-customer').length,
      readyForAsn: workflowItems.filter((i) => i.status === 'ready-for-asn').length,
      asnCreated: workflowItems.filter((i) => i.status === 'asn-created').length,
      completed: workflowItems.filter((i) => i.status === 'completed').length,
    };
  }, [workflowItems]);

  const handleRequestSlip = (deliveryId: string) => {
    const delivery = deliveries.find((d) => d.id === deliveryId);
    if (!delivery) return;

    const newSlipRequest: PackingSlipRequest = {
      id: `SLIP-${Date.now()}`,
      deliveryId: deliveryId,
      requestedDate: new Date().toISOString(),
      requestedBy: 'office@warehouse.com',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'pending-customer',
      customerEmail: 'customer@example.com',
      remindersSent: 0,
      notes: 'Packing slip requested',
    };

    addSlipRequest(newSlipRequest);
    toast.success('Packing slip request created');
  };

  const handleMarkReceived = (slipId: string) => {
    updateSlipRequest(slipId, { status: 'ready-for-asn', receivedDate: new Date().toISOString() });
    toast.success('Packing slip marked as received');
  };

  const handleOpenCreateASN = (deliveryId: string) => {
    const delivery = deliveries.find((d) => d.id === deliveryId);
    if (delivery) {
      setSelectedDelivery(delivery);
      setNewASN({ deliveryId: delivery.id, items: [], specialInstructions: '' });
      setAsnDialogOpen(true);
    }
  };

  const handleViewASN = (asnId: string) => {
    const asn = asns.find((a) => a.id === asnId);
    if (asn) {
      setViewingASN(asn);
      setViewASNDialogOpen(true);
    }
  };

  const handleEditASN = (asnId: string) => {
    const asn = asns.find((a) => a.id === asnId);
    if (asn) {
      setEditingASN(asn);
      setEditASNDialogOpen(true);
    }
  };

  const handleDeleteASN = (asnId: string) => {
    setDeletingASNId(asnId);
  };

  const confirmDeleteASN = () => {
    if (deletingASNId) {
      const asn = asns.find((a) => a.id === deletingASNId);
      if (asn) {
        // Reset slip status to ready-for-asn
        const slip = slipRequests.find((s) => s.deliveryId === asn.deliveryId);
        if (slip) {
          updateSlipRequest(slip.id, { status: 'ready-for-asn' });
        }
      }
      deleteASN(deletingASNId);
      toast.success('ASN deleted successfully');
      setDeletingASNId(null);
      setViewASNDialogOpen(false);
    }
  };

  const handleCreateASN = () => {
    if (!selectedDelivery || newASN.items.length === 0) {
      toast.error('Please select a delivery and add items');
      return;
    }

    const asn: ASN = {
      id: `ASN-${Date.now()}`,
      deliveryId: selectedDelivery.id,
      customerName: selectedDelivery.customerName,
      containerNumber: selectedDelivery.containerNumber,
      door: selectedDelivery.door,
      poNumber: selectedDelivery.poNumber,
      items: newASN.items,
      createdBy: 'Current User',
      createdAt: new Date().toISOString(),
      status: 'active',
      specialInstructions: newASN.specialInstructions,
    };

    addASN(asn);
    
    const slipRequest = slipRequests.find((s) => s.deliveryId === selectedDelivery.id);
    if (slipRequest) {
      updateSlipRequest(slipRequest.id, { status: 'asn-created' });
    }
    
    toast.success('ASN created successfully');
    setAsnDialogOpen(false);
    setNewASN({ deliveryId: '', items: [], specialInstructions: '' });
    setSelectedDelivery(null);
  };

  const handleUpdateASN = () => {
    if (!editingASN || editingASN.items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    updateASN(editingASN.id, {
      items: editingASN.items,
      specialInstructions: editingASN.specialInstructions,
    });

    toast.success('ASN updated successfully');
    setEditASNDialogOpen(false);
    setEditingASN(null);
  };

  const addItemToASN = () => {
    setNewASN({
      ...newASN,
      items: [...newASN.items, { itemNumber: '', expectedQty: 1, description: '', uom: 'EA' }],
    });
  };

  const addItemToEditingASN = () => {
    if (editingASN) {
      setEditingASN({
        ...editingASN,
        items: [...editingASN.items, { itemNumber: '', expectedQty: 1, description: '', uom: 'EA' }],
      });
    }
  };

  const updateASNItem = (index: number, field: string, value: string | number) => {
    const updatedItems = [...newASN.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setNewASN({ ...newASN, items: updatedItems });
  };

  const updateEditingASNItem = (index: number, field: string, value: string | number) => {
    if (editingASN) {
      const updatedItems = [...editingASN.items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      setEditingASN({ ...editingASN, items: updatedItems });
    }
  };

  const removeASNItem = (index: number) => {
    setNewASN({
      ...newASN,
      items: newASN.items.filter((_, i) => i !== index),
    });
  };

  const removeEditingASNItem = (index: number) => {
    if (editingASN) {
      setEditingASN({
        ...editingASN,
        items: editingASN.items.filter((_, i) => i !== index),
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'no-slip':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'pending-customer':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'ready-for-asn':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'asn-created':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'completed':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'no-slip':
        return 'No Slip Request';
      case 'pending-customer':
        return 'Pending Customer';
      case 'ready-for-asn':
        return 'Ready for ASN';
      case 'asn-created':
        return 'ASN Created';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Packing Slips & ASN Management</h1>
          <p className="text-gray-600 mt-1">Track all incoming deliveries and manage packing slip requests</p>
        </div>
      </div>

      {/* Create ASN Dialog */}
      <Dialog open={asnDialogOpen} onOpenChange={setAsnDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New ASN</DialogTitle>
            <DialogDescription>Create an Advanced Shipping Notice for this delivery</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedDelivery && (
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold">Customer:</span> {selectedDelivery.customerName}
                    </div>
                    <div>
                      <span className="font-semibold">Container:</span> {selectedDelivery.containerNumber}
                    </div>
                    <div>
                      <span className="font-semibold">PO:</span> {selectedDelivery.poNumber}
                    </div>
                    <div>
                      <span className="font-semibold">Expected:</span> {selectedDelivery.expectedDate}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItemToASN}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {newASN.items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-start p-3 border rounded-lg">
                    <div className="flex-1 space-y-2">
                      <Select
                        value={item.itemNumber}
                        onValueChange={(value) => {
                          const selectedItem = extensivItems?.find((i) => i.itemNumber === value);
                          if (selectedItem) {
                            updateASNItem(index, 'itemNumber', value);
                            updateASNItem(index, 'description', selectedItem.description);
                            updateASNItem(index, 'uom', selectedItem.uom);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Item" />
                        </SelectTrigger>
                        <SelectContent>
                          {extensivItems?.map((extItem) => (
                            <SelectItem key={extItem.itemNumber} value={extItem.itemNumber}>
                              {extItem.itemNumber} - {extItem.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="Quantity"
                        value={item.expectedQty}
                        onChange={(e) => updateASNItem(index, 'expectedQty', parseInt(e.target.value) || 0)}
                        min="1"
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeASNItem(index)}>
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Special Instructions (Optional)</Label>
              <Textarea
                placeholder="Add any special instructions or notes..."
                value={newASN.specialInstructions}
                onChange={(e) => setNewASN({ ...newASN, specialInstructions: e.target.value })}
                rows={3}
              />
            </div>

            <Button onClick={handleCreateASN} className="w-full">
              Create ASN
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit ASN Dialog */}
      <Dialog open={editASNDialogOpen} onOpenChange={setEditASNDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit ASN</DialogTitle>
            <DialogDescription>Update the Advanced Shipping Notice details</DialogDescription>
          </DialogHeader>
          {editingASN && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold">Customer:</span> {editingASN.customerName}
                    </div>
                    <div>
                      <span className="font-semibold">Container:</span> {editingASN.containerNumber}
                    </div>
                    <div>
                      <span className="font-semibold">PO:</span> {editingASN.poNumber}
                    </div>
                    <div>
                      <span className="font-semibold">Door:</span> {editingASN.door}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItemToEditingASN}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </div>
                <div className="space-y-2">
                  {editingASN.items.map((item, index) => (
                    <div key={index} className="flex gap-2 items-start p-3 border rounded-lg">
                      <div className="flex-1 space-y-2">
                        <Select
                          value={item.itemNumber}
                          onValueChange={(value) => {
                            const selectedItem = extensivItems?.find((i) => i.itemNumber === value);
                            if (selectedItem) {
                              updateEditingASNItem(index, 'itemNumber', value);
                              updateEditingASNItem(index, 'description', selectedItem.description);
                              updateEditingASNItem(index, 'uom', selectedItem.uom);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Item" />
                          </SelectTrigger>
                          <SelectContent>
                            {extensivItems?.map((extItem) => (
                              <SelectItem key={extItem.itemNumber} value={extItem.itemNumber}>
                                {extItem.itemNumber} - {extItem.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          placeholder="Quantity"
                          value={item.expectedQty}
                          onChange={(e) => updateEditingASNItem(index, 'expectedQty', parseInt(e.target.value) || 0)}
                          min="1"
                        />
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeEditingASNItem(index)}>
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Special Instructions (Optional)</Label>
                <Textarea
                  placeholder="Add any special instructions or notes..."
                  value={editingASN.specialInstructions}
                  onChange={(e) => setEditingASN({ ...editingASN, specialInstructions: e.target.value })}
                  rows={3}
                />
              </div>

              <Button onClick={handleUpdateASN} className="w-full">
                Update ASN
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View ASN Dialog */}
      <Dialog open={viewASNDialogOpen} onOpenChange={setViewASNDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View ASN Details</DialogTitle>
            <DialogDescription>Advanced Shipping Notice Information</DialogDescription>
          </DialogHeader>
          {viewingASN && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Delivery Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold">Customer:</span> {viewingASN.customerName}
                    </div>
                    <div>
                      <span className="font-semibold">Container:</span> {viewingASN.containerNumber}
                    </div>
                    <div>
                      <span className="font-semibold">PO Number:</span> {viewingASN.poNumber}
                    </div>
                    <div>
                      <span className="font-semibold">Door:</span> {viewingASN.door}
                    </div>
                    <div>
                      <span className="font-semibold">Created By:</span> {viewingASN.createdBy}
                    </div>
                    <div>
                      <span className="font-semibold">Created:</span> {new Date(viewingASN.createdAt).toLocaleString()}
                    </div>
                    <div className="col-span-2">
                      <span className="font-semibold">Status:</span>{' '}
                      <Badge className={viewingASN.status === 'completed' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                        {viewingASN.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Items ({viewingASN.items.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {viewingASN.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-semibold">{item.itemNumber}</p>
                          <p className="text-sm text-gray-600">{item.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{item.expectedQty} {item.uom}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {viewingASN.specialInstructions && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Special Instructions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-700">{viewingASN.specialInstructions}</p>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2">
                <Button onClick={() => handleEditASN(viewingASN.id)} className="flex-1 gap-2">
                  <Edit className="h-4 w-4" />
                  Edit ASN
                </Button>
                <Button onClick={() => handleDeleteASN(viewingASN.id)} variant="destructive" className="flex-1 gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete ASN
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingASNId} onOpenChange={() => setDeletingASNId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this ASN. The delivery will be reset to "Ready for ASN" status. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteASN} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('no-slip')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">No Slip Request</p>
                <p className="text-3xl font-bold text-red-600">{statusCounts.noSlip}</p>
              </div>
              <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('pending-customer')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Customer</p>
                <p className="text-3xl font-bold text-yellow-600">{statusCounts.pendingCustomer}</p>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('ready-for-asn')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ready for ASN</p>
                <p className="text-3xl font-bold text-green-600">{statusCounts.readyForAsn}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('asn-created')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">ASN Created</p>
                <p className="text-3xl font-bold text-blue-600">{statusCounts.asnCreated}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('completed')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-purple-600">{statusCounts.completed}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by customer, tracking, container, or PO number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value: StatusFilterType) => setStatusFilter(value)}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="no-slip">No Slip Request</SelectItem>
            <SelectItem value="pending-customer">Pending Customer</SelectItem>
            <SelectItem value="ready-for-asn">Ready for ASN</SelectItem>
            <SelectItem value="asn-created">ASN Created</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Items List */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No items found matching your filters</p>
            </CardContent>
          </Card>
        ) : (
          filteredItems.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{item.customer}</h3>
                      <Badge className={getStatusColor(item.status)}>{getStatusLabel(item.status)}</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Container:</span> {item.containerNumber}
                      </div>
                      <div>
                        <span className="font-medium">PO:</span> {item.poNumber}
                      </div>
                      <div>
                        <span className="font-medium">Carrier:</span> {item.carrier}
                      </div>
                      <div>
                        <span className="font-medium">Expected:</span> {item.expectedDate}
                      </div>
                    </div>
                    {item.requestedDate && (
                      <p className="text-xs text-gray-500 mt-2">Slip Requested: {new Date(item.requestedDate).toLocaleDateString()}</p>
                    )}
                    {item.receivedDate && (
                      <p className="text-xs text-gray-500 mt-2">Slip Received: {new Date(item.receivedDate).toLocaleDateString()}</p>
                    )}
                    {item.asnCreatedDate && (
                      <p className="text-xs text-gray-500 mt-2">ASN Created: {new Date(item.asnCreatedDate).toLocaleDateString()} ({item.itemCount} items)</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {item.status === 'no-slip' && (
                      <Button size="sm" variant="outline" onClick={() => handleRequestSlip(item.deliveryId)} className="gap-2">
                        <Mail className="h-4 w-4" />
                        Request Slip
                      </Button>
                    )}
                    {item.status === 'pending-customer' && item.slipId && (
                      <Button size="sm" onClick={() => handleMarkReceived(item.slipId!)} className="gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Mark Received
                      </Button>
                    )}
                    {item.status === 'ready-for-asn' && (
                      <Button size="sm" onClick={() => handleOpenCreateASN(item.deliveryId)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Create ASN
                      </Button>
                    )}
                    {(item.status === 'asn-created' || item.status === 'completed') && item.asnId && (
                      <Button size="sm" variant="outline" onClick={() => handleViewASN(item.asnId!)} className="gap-2">
                        <Eye className="h-4 w-4" />
                        View ASN
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}