import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ChevronRight, ChevronDown, Plus, Trash2, Check, Camera, AlertTriangle, Hash, Pause, Play, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

interface MixedPalletGroup {
  id: string;
  palletNumber: string;
  items: { itemId: string; itemNumber: string; quantity: number }[];
}

interface ReceivingItem {
  id: string;
  itemNumber: string;
  description: string;
  expectedQty: number;
  receivedQty: number;
  casesPerPallet: number;
  fullPallets: number;
  partialCases: number;
  mixedPallet: boolean;
  mixedPalletQty: number;
  lotNumber: string;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  photo?: string;
  isEditingSkuDropdown?: boolean; // Track if dropdown is open for this item
}

interface InProgressSession {
  sessionId: string;
  mode: 'asn' | 'quick' | 'new';
  asnId?: string;
  deliveryId?: string;
  deliveryInfo?: {
    customerName: string;
    containerNumber: string;
    poNumber: string;
    door: string;
  };
  items: ReceivingItem[];
  startedAt: string;
  lastSavedAt: string;
}

export default function Receiving() {
  const navigate = useNavigate();
  const location = useLocation();
  const { asnId, deliveryId } = useParams();
  const { user } = useAuth();
  const { asns = [], deliveries = [], updateASN, receivingSessions = [], addReceivingSession, addDelivery, customers = [], extensivItems = [] } = useData();

  // Determine receiving mode
  const isQuickMode = location.pathname.includes('/quick/');
  const isNewMode = location.pathname.includes('/new');
  const mode: 'asn' | 'quick' | 'new' = isNewMode ? 'new' : isQuickMode ? 'quick' : 'asn';

  // Load data based on mode
  const asn = mode === 'asn' && asnId ? asns.find((a) => a.id === asnId) : null;
  const delivery = mode === 'asn' && asn 
    ? deliveries.find((d) => d.id === asn.deliveryId)
    : mode === 'quick' && deliveryId
    ? deliveries.find((d) => d.id === deliveryId)
    : null;

  // Session ID for saving
  const sessionId = mode === 'asn' && asnId 
    ? `asn-${asnId}` 
    : mode === 'quick' && deliveryId 
    ? `quick-${deliveryId}` 
    : 'new-walkin';

  // Check for saved in-progress session
  const getSavedSession = (): InProgressSession | null => {
    const saved = localStorage.getItem(`receiving-session-${sessionId}`);
    return saved ? JSON.parse(saved) : null;
  };

  const savedSession = getSavedSession();

  // Delivery info state (for new mode)
  const [deliveryInfo, setDeliveryInfo] = useState({
    customerName: savedSession?.deliveryInfo?.customerName || delivery?.customerName || '',
    containerNumber: savedSession?.deliveryInfo?.containerNumber || delivery?.containerNumber || '',
    poNumber: savedSession?.deliveryInfo?.poNumber || delivery?.poNumber || '',
    door: savedSession?.deliveryInfo?.door || delivery?.door || '',
  });

  const [items, setItems] = useState<ReceivingItem[]>(
    savedSession?.items ||
    (asn?.items.map((item) => ({
      id: `${item.itemNumber}-${Date.now()}`,
      itemNumber: item.itemNumber,
      description: item.description,
      expectedQty: item.expectedQty,
      receivedQty: 0,
      casesPerPallet: 0,
      fullPallets: 0,
      partialCases: 0,
      mixedPallet: false,
      mixedPalletQty: 0,
      lotNumber: '',
      dimensions: { length: 0, width: 0, height: 0 },
      isEditingSkuDropdown: false,
    })) || [])
  );

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [discrepancyDialogOpen, setDiscrepancyDialogOpen] = useState(false);
  const [discrepancies, setDiscrepancies] = useState<{ itemNumber: string; expected: number; received: number }[]>([]);
  const [sessionStartTime] = useState(savedSession?.startedAt || new Date().toISOString());
  const [lastSavedTime, setLastSavedTime] = useState(savedSession?.lastSavedAt || new Date().toISOString());

  // Auto-save session every 30 seconds
  useEffect(() => {
    const saveSession = () => {
      const session: InProgressSession = {
        sessionId,
        mode,
        asnId: mode === 'asn' ? asnId : undefined,
        deliveryId: mode === 'quick' ? deliveryId : undefined,
        deliveryInfo: mode === 'new' || mode === 'quick' ? deliveryInfo : undefined,
        items,
        startedAt: sessionStartTime,
        lastSavedAt: new Date().toISOString(),
      };
      
      localStorage.setItem(`receiving-session-${sessionId}`, JSON.stringify(session));
      setLastSavedTime(session.lastSavedAt);
    };

    const interval = setInterval(saveSession, 30000); // Save every 30 seconds
    
    return () => clearInterval(interval);
  }, [sessionId, mode, asnId, deliveryId, deliveryInfo, items, sessionStartTime]);

  // Save on unmount (when navigating away)
  useEffect(() => {
    return () => {
      const session: InProgressSession = {
        sessionId,
        mode,
        asnId: mode === 'asn' ? asnId : undefined,
        deliveryId: mode === 'quick' ? deliveryId : undefined,
        deliveryInfo: mode === 'new' || mode === 'quick' ? deliveryInfo : undefined,
        items,
        startedAt: sessionStartTime,
        lastSavedAt: new Date().toISOString(),
      };
      localStorage.setItem(`receiving-session-${sessionId}`, JSON.stringify(session));
    };
  }, [sessionId, mode, asnId, deliveryId, deliveryInfo, items, sessionStartTime]);

  const toggleItemExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const updateItem = (itemId: string, field: string, value: string | number | boolean) => {
    setItems(
      items.map((item) => {
        if (item.id !== itemId) return item;

        const updatedItem = { ...item };

        if (field.startsWith('dimensions.')) {
          const dimField = field.split('.')[1] as 'length' | 'width' | 'height';
          updatedItem.dimensions = { ...updatedItem.dimensions, [dimField]: value };
        } else if (field === 'fullPallets' || field === 'partialCases' || field === 'casesPerPallet') {
          (updatedItem as Record<string, number | string | boolean>)[field] = value as number;
          // Recalculate received quantity
          const fullPalletQty = updatedItem.fullPallets * updatedItem.casesPerPallet;
          updatedItem.receivedQty = fullPalletQty + updatedItem.partialCases + updatedItem.mixedPalletQty;
        } else if (field === 'mixedPallet') {
          updatedItem.mixedPallet = value as boolean;
          if (!value) {
            updatedItem.mixedPalletQty = 0;
            updatedItem.receivedQty = updatedItem.fullPallets * updatedItem.casesPerPallet + updatedItem.partialCases;
          }
        } else if (field === 'mixedPalletQty') {
          updatedItem.mixedPalletQty = value as number;
          updatedItem.receivedQty = updatedItem.fullPallets * updatedItem.casesPerPallet + updatedItem.partialCases + (value as number);
        } else {
          (updatedItem as Record<string, number | string | boolean>)[field] = value;
        }

        return updatedItem;
      })
    );
  };

  // Handle SKU selection from dropdown
  const handleSkuSelect = (itemId: string, selectedItemNumber: string) => {
    const selectedItem = extensivItems.find(i => i.itemNumber === selectedItemNumber);
    
    setItems(items.map(item => {
      if (item.id !== itemId) return item;
      
      return {
        ...item,
        itemNumber: selectedItemNumber,
        description: selectedItem?.description || item.description,
        isEditingSkuDropdown: false,
      };
    }));
  };

  const addItem = () => {
    const newItem: ReceivingItem = {
      id: `NEW-${Date.now()}`,
      itemNumber: '',
      description: '',
      expectedQty: 0,
      receivedQty: 0,
      casesPerPallet: 0,
      fullPallets: 0,
      partialCases: 0,
      mixedPallet: false,
      mixedPalletQty: 0,
      lotNumber: '',
      dimensions: { length: 0, width: 0, height: 0 },
      isEditingSkuDropdown: false,
    };
    setItems([...items, newItem]);
  };

  const removeItem = (itemId: string) => {
    setItems(items.filter((item) => item.id !== itemId));
  };

  const handlePauseSession = () => {
    const session: InProgressSession = {
      sessionId,
      mode,
      asnId: mode === 'asn' ? asnId : undefined,
      deliveryId: mode === 'quick' ? deliveryId : undefined,
      deliveryInfo: mode === 'new' || mode === 'quick' ? deliveryInfo : undefined,
      items,
      startedAt: sessionStartTime,
      lastSavedAt: new Date().toISOString(),
    };
    
    localStorage.setItem(`receiving-session-${sessionId}`, JSON.stringify(session));
    toast.success('Session saved. You can resume later.');
    navigate('/receive');
  };

  const getReceivedDisplay = (item: ReceivingItem) => {
    const diff = item.receivedQty - item.expectedQty;
    
    if (item.receivedQty === 0) {
      return { text: '0', color: 'text-gray-400', showCheck: false, showDiff: false };
    }
    
    if (mode !== 'asn' || item.receivedQty === item.expectedQty) {
      return { text: item.receivedQty.toString(), color: 'text-green-600', showCheck: true, showDiff: false };
    }
    
    if (item.receivedQty < item.expectedQty) {
      return { text: `${item.receivedQty} (${diff})`, color: 'text-orange-600', showCheck: false, showDiff: true };
    }
    
    // Over expected
    return { text: `${item.receivedQty} (+${diff})`, color: 'text-red-600', showCheck: false, showDiff: true };
  };

  const checkDiscrepancies = () => {
    if (mode !== 'asn') return true; // Skip discrepancy check for quick/new modes
    
    const foundDiscrepancies = items
      .filter((item) => item.receivedQty !== item.expectedQty)
      .map((item) => ({
        itemNumber: item.itemNumber,
        expected: item.expectedQty,
        received: item.receivedQty,
      }));

    if (foundDiscrepancies.length > 0) {
      setDiscrepancies(foundDiscrepancies);
      setDiscrepancyDialogOpen(true);
      return false;
    }
    return true;
  };

  const handleCompleteReceipt = (forceComplete = false) => {
    // Validate delivery info for new mode
    if (mode === 'new' && (!deliveryInfo.customerName || !deliveryInfo.containerNumber)) {
      toast.error('Please enter customer name and container number');
      return;
    }

    // Validate items
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    const hasInvalidItems = items.some(item => !item.itemNumber || item.receivedQty === 0);
    if (hasInvalidItems) {
      toast.error('Please fill in all item numbers and received quantities');
      return;
    }

    if (!forceComplete && !checkDiscrepancies()) {
      return;
    }

    // Get customer name and container number based on mode
    const customerName = mode === 'new' || mode === 'quick' 
      ? deliveryInfo.customerName 
      : asn?.customerName || delivery?.customerName || '';
    
    const containerNumber = mode === 'new' || mode === 'quick'
      ? deliveryInfo.containerNumber
      : asn?.containerNumber || delivery?.containerNumber || '';
    
    const poNumber = mode === 'new' || mode === 'quick'
      ? deliveryInfo.poNumber || ''
      : asn?.poNumber || delivery?.poNumber || '';

    // Find customer ID from customers list
    const customer = customers.find(c => c.name === customerName);
    const customerId = customer?.thirdPartyLogisticsId || customer?.id || '';

    console.log('[Receiving] Creating session with:', {
      customerName,
      customerId,
      containerNumber,
      poNumber,
      customerFound: !!customer
    });

    // Create or get delivery record
    let targetDeliveryId = delivery?.id;

    if (mode === 'new') {
      // Create new delivery for walk-in
      const newDelivery = {
        id: `DELIVERY-${Date.now()}`,
        customerId: customerId,
        customerName: customerName,
        containerNumber: containerNumber,
        poNumber: poNumber || 'N/A',
        door: deliveryInfo.door || 'N/A',
        expectedDate: new Date().toISOString().split('T')[0],
        status: 'Received',
        carrier: 'Walk-in',
        notes: 'Walk-in delivery - no prior notice',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addDelivery(newDelivery);
      targetDeliveryId = newDelivery.id;
    }

    // Create receiving session with ALL required fields INCLUDING PALLET DATA
    const session = {
      id: `SESSION-${Date.now()}`,
      customerName: customerName,
      customerId: customerId,
      containerNumber: containerNumber,
      poNumber: poNumber,
      startedBy: user?.name || 'Dock Worker',
      startedAt: sessionStartTime,
      completedAt: new Date().toISOString(),
      status: 'pending-review' as const,
      type: mode === 'new' ? 'walk-in' : mode === 'quick' ? 'quick-receive' : 'asn-receive',
      items: items.map((item) => ({
        itemNumber: item.itemNumber,
        description: item.description,
        expectedQty: item.expectedQty,
        receivedQty: item.receivedQty,
        uom: 'EA', // Default unit of measure
        condition: 'good', // Default condition
        notes: item.lotNumber ? `Lot: ${item.lotNumber}` : undefined,
        // PRESERVE PALLET DATA FOR EXTENSIV SPLITTING
        casesPerPallet: item.casesPerPallet,
        fullPallets: item.fullPallets,
        partialCases: item.partialCases,
        mixedPallet: item.mixedPallet,
        mixedPalletQty: item.mixedPalletQty,
        dimensions: item.dimensions,
      })),
      reviewNotes: mode === 'new' 
        ? 'Walk-in delivery receipt' 
        : mode === 'quick'
        ? 'Quick receipt without ASN'
        : discrepancies.length > 0 
        ? 'Completed with quantity discrepancies' 
        : 'Receipt completed successfully',
    };

    console.log('[Receiving] Final session object with pallet data:', session);

    addReceivingSession(session);
    
    if (mode === 'asn' && asn) {
      updateASN(asn.id, { status: 'completed' });
    }

    // Clear saved session
    localStorage.removeItem(`receiving-session-${sessionId}`);

    toast.success('Receipt completed and sent for review');
    
    // IMPROVEMENT 1: Navigate back to /receive instead of /review-queue
    navigate('/receive');
  };

  const totalExpected = items.reduce((sum, item) => sum + item.expectedQty, 0);
  const totalReceived = items.reduce((sum, item) => sum + item.receivedQty, 0);
  const totalDiff = totalReceived - totalExpected;

  const mixedPalletItems = items.filter((item) => item.mixedPallet && item.mixedPalletQty > 0);

  // Show error only for ASN mode
  if (mode === 'asn' && (!asn || !delivery)) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ASN Not Found</h2>
          <p className="text-gray-600 mb-4">The requested ASN could not be found.</p>
          <Button onClick={() => navigate('/receive')}>Back to Receive</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {mode === 'new' ? 'New Receipt (Walk-in)' : mode === 'quick' ? 'Quick Receive' : 'Receive'}
        </h1>
        {savedSession && (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            <Play className="h-3 w-3 mr-1" />
            Resumed Session
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/receive')} className="pl-0">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Shipments
        </Button>
        <Button variant="outline" size="sm" onClick={handlePauseSession}>
          <Pause className="h-4 w-4 mr-2" />
          Pause & Save
        </Button>
      </div>

      {/* Shipment Info Card */}
      <Card>
        <CardContent className="pt-6">
          {mode === 'new' ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Delivery Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Customer Name *</Label>
                  <Input
                    value={deliveryInfo.customerName}
                    onChange={(e) => setDeliveryInfo({ ...deliveryInfo, customerName: e.target.value })}
                    placeholder="Enter customer name"
                  />
                </div>
                <div>
                  <Label>Container # *</Label>
                  <Input
                    value={deliveryInfo.containerNumber}
                    onChange={(e) => setDeliveryInfo({ ...deliveryInfo, containerNumber: e.target.value })}
                    placeholder="Enter container number"
                  />
                </div>
                <div>
                  <Label>PO #</Label>
                  <Input
                    value={deliveryInfo.poNumber}
                    onChange={(e) => setDeliveryInfo({ ...deliveryInfo, poNumber: e.target.value })}
                    placeholder="Enter PO number (optional)"
                  />
                </div>
                <div>
                  <Label>Dock Door</Label>
                  <Input
                    value={deliveryInfo.door}
                    onChange={(e) => setDeliveryInfo({ ...deliveryInfo, door: e.target.value })}
                    placeholder="Enter door number (optional)"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {mode === 'quick' ? deliveryInfo.customerName : asn?.customerName}
                </h2>
                <p className="text-gray-600">
                  Container: {mode === 'quick' ? deliveryInfo.containerNumber : asn?.containerNumber}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  Dock Door: {mode === 'quick' ? deliveryInfo.door : asn?.door || '—'}
                </p>
                <Badge className="mt-2">
                  {mode === 'quick' ? 'Quick Receipt' : 'Palletized Receipt'}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Items ({items.length})</h3>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Cases/Plt</TableHead>
                  <TableHead>Full Plt</TableHead>
                  <TableHead>Partial</TableHead>
                  <TableHead>Mixed Pallet</TableHead>
                  {mode === 'asn' && <TableHead>Expected</TableHead>}
                  <TableHead>Received</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const receivedDisplay = getReceivedDisplay(item);
                  return (
                    <>
                      <TableRow key={item.id}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleItemExpanded(item.id)}
                            className="h-8 w-8"
                          >
                            {expandedItems.has(item.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          {/* IMPROVEMENT 3: SKU with edit button and dropdown */}
                          <div className="flex items-center gap-2">
                            {item.isEditingSkuDropdown ? (
                              <Select
                                value={item.itemNumber}
                                onValueChange={(value) => handleSkuSelect(item.id, value)}
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue placeholder="Select SKU" />
                                </SelectTrigger>
                                <SelectContent>
                                  {extensivItems.map((extensivItem) => (
                                    <SelectItem key={extensivItem.id} value={extensivItem.itemNumber}>
                                      {extensivItem.itemNumber} - {extensivItem.description?.substring(0, 30)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <>
                                <Input
                                  value={item.itemNumber}
                                  onChange={(e) => updateItem(item.id, 'itemNumber', e.target.value)}
                                  placeholder="SKU"
                                  className="w-32"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateItem(item.id, 'isEditingSkuDropdown', true)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.casesPerPallet || ''}
                            onChange={(e) => updateItem(item.id, 'casesPerPallet', parseInt(e.target.value) || 0)}
                            className="w-20"
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.fullPallets || ''}
                            onChange={(e) => updateItem(item.id, 'fullPallets', parseInt(e.target.value) || 0)}
                            className="w-20"
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.partialCases || ''}
                            onChange={(e) => updateItem(item.id, 'partialCases', parseInt(e.target.value) || 0)}
                            className="w-20"
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={item.mixedPallet}
                              onCheckedChange={(checked) => updateItem(item.id, 'mixedPallet', checked as boolean)}
                              id={`mixed-${item.id}`}
                            />
                            <Label htmlFor={`mixed-${item.id}`} className="text-sm cursor-pointer">
                              Mixed Pallet
                            </Label>
                          </div>
                        </TableCell>
                        {mode === 'asn' && (
                          <TableCell>
                            <span className="font-semibold">{item.expectedQty}</span>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.mixedPallet && (
                              <>
                                <Hash className="h-4 w-4 text-blue-600" />
                                <span className="text-sm text-gray-600">1</span>
                                <span className="text-sm text-gray-600">Qty:</span>
                                <Input
                                  type="number"
                                  value={item.mixedPalletQty || ''}
                                  onChange={(e) => updateItem(item.id, 'mixedPalletQty', parseInt(e.target.value) || 0)}
                                  className="w-16 h-7"
                                  placeholder="0"
                                />
                              </>
                            )}
                            <span className={`font-semibold ${receivedDisplay.color}`}>{receivedDisplay.text}</span>
                            {receivedDisplay.showCheck && <Check className="h-4 w-4 text-green-600" />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Details */}
                      {expandedItems.has(item.id) && (
                        <TableRow>
                          <TableCell colSpan={mode === 'asn' ? 9 : 8} className="bg-gray-50">
                            <div className="p-4 space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Description</Label>
                                  <Input
                                    value={item.description}
                                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                    placeholder="Product description"
                                  />
                                </div>
                                <div>
                                  <Label>Lot Number</Label>
                                  <Input
                                    value={item.lotNumber}
                                    onChange={(e) => updateItem(item.id, 'lotNumber', e.target.value)}
                                    placeholder="Enter lot number"
                                  />
                                </div>
                              </div>

                              <div>
                                <Label>Dimensions (L x W x H)</Label>
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                  <Input
                                    type="number"
                                    placeholder="L"
                                    value={item.dimensions.length || ''}
                                    onChange={(e) => updateItem(item.id, 'dimensions.length', parseInt(e.target.value) || 0)}
                                  />
                                  <Input
                                    type="number"
                                    placeholder="W"
                                    value={item.dimensions.width || ''}
                                    onChange={(e) => updateItem(item.id, 'dimensions.width', parseInt(e.target.value) || 0)}
                                  />
                                  <Input
                                    type="number"
                                    placeholder="H"
                                    value={item.dimensions.height || ''}
                                    onChange={(e) => updateItem(item.id, 'dimensions.height', parseInt(e.target.value) || 0)}
                                  />
                                </div>
                              </div>

                              <div>
                                <Label>Photo</Label>
                                <Button variant="outline" size="sm" className="mt-2">
                                  <Camera className="h-4 w-4 mr-2" />
                                  Take Photo
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mixed Pallet Summary */}
      {mixedPalletItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Mixed Pallet Summary</h3>
            <Badge variant="secondary">{mixedPalletItems.length} pallet{mixedPalletItems.length !== 1 ? 's' : ''}</Badge>
          </div>
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div>
                  <span className="font-semibold">MP-1</span>
                  <span className="text-sm text-gray-600 ml-2">
                    {mixedPalletItems.length} SKU{mixedPalletItems.length !== 1 ? 's' : ''} (
                    {mixedPalletItems.reduce((sum, item) => sum + item.mixedPalletQty, 0)} units)
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {mixedPalletItems.map((item) => (
                    <Badge key={item.id} variant="outline" className="bg-white">
                      {item.itemNumber}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom Summary Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:pl-72">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex gap-8">
            {mode === 'asn' && (
              <div>
                <span className="text-gray-600">Total Expected: </span>
                <span className="font-bold text-lg">{totalExpected}</span>
              </div>
            )}
            <div>
              <span className="text-gray-600">Total Received: </span>
              <span
                className={`font-bold text-lg ${
                  mode !== 'asn' || totalReceived === totalExpected
                    ? 'text-green-600'
                    : totalReceived > totalExpected
                    ? 'text-red-600'
                    : 'text-orange-600'
                }`}
              >
                {totalReceived}
                {mode === 'asn' && totalDiff !== 0 && ` (${totalDiff > 0 ? '+' : ''}${totalDiff})`}
              </span>
            </div>
          </div>
          <Button onClick={() => handleCompleteReceipt(false)} className="bg-orange-500 hover:bg-orange-600">
            <Check className="h-4 w-4 mr-2" />
            Complete Receipt
          </Button>
        </div>
      </div>

      {/* Quantity Discrepancies Dialog */}
      <Dialog open={discrepancyDialogOpen} onOpenChange={setDiscrepancyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Quantity Discrepancies
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-orange-600 mb-2">Missing/Short:</h4>
              <ul className="list-disc list-inside space-y-1">
                {discrepancies.map((disc, index) => (
                  <li key={index} className="text-sm">
                    <span className="font-semibold">{disc.itemNumber}:</span> Expected {disc.expected}, Received {disc.received} (
                    {disc.received > disc.expected ? '+' : ''}
                    {disc.received - disc.expected})
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-sm text-gray-600">Do you want to complete anyway?</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscrepancyDialogOpen(false)}>
              Review Items
            </Button>
            <Button
              onClick={() => {
                setDiscrepancyDialogOpen(false);
                handleCompleteReceipt(true);
              }}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Complete Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}