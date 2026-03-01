import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PackageCheck, ChevronRight, Plus, TruckIcon, Eye, Play } from 'lucide-react';
import { Delivery } from '@/types';

export default function Receive() {
  const navigate = useNavigate();
  const { deliveries = [], asns = [], slipRequests = [], receivingSessions = [], customers = [] } = useData();

  // Helper to get reference preview for a customer
  const getCustomerReference = (customerName: string): string => {
    const customer = customers.find(c => c.name === customerName);
    if (customer?.referencePrefix && customer?.referenceCounter !== undefined) {
      return `${customer.referencePrefix}${(customer.referenceCounter || 0) + 1}`;
    }
    return '';
  };

  // Filter deliveries that are ready to receive (arrived, dropped, unloaded, or checked in status)
  const receivableDeliveries = deliveries.filter((delivery) => {
    const status = delivery.status?.toLowerCase() || '';
    return ['arrived', 'dropped', 'unloaded', 'checked in'].includes(status);
  });

  // Get ASN status info for each delivery (matching IncomingDeliveries logic)
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
    if (delivery && (delivery as Delivery & { asn?: boolean }).asn === true) {
      return { 
        status: 'ready-for-asn', 
        label: 'Slip Received', 
        color: 'bg-green-100 text-green-800' 
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

  // Check receiving session status for a delivery
  const getReceivingSessionStatus = (asnId?: string, deliveryId?: string): 'none' | 'in-progress' | 'completed' => {
    // First check localStorage for in-progress sessions
    if (asnId) {
      const sessionKey = `receiving-session-asn-${asnId}`;
      if (localStorage.getItem(sessionKey) !== null) {
        return 'in-progress';
      }
    }
    if (deliveryId) {
      const sessionKey = `receiving-session-quick-${deliveryId}`;
      if (localStorage.getItem(sessionKey) !== null) {
        return 'in-progress';
      }
    }

    // Then check completed sessions in receivingSessions
    // Find session by ASN ID or delivery container/PO number
    const delivery = deliveries.find(d => d.id === deliveryId);
    const session = receivingSessions.find(s => {
      if (asnId && s.asnId === asnId) return true;
      if (deliveryId && s.deliveryId === deliveryId) return true;
      // Also match by container/PO number for quick receives
      if (delivery && (s.containerNumber === delivery.containerNumber || s.poNumber === delivery.poNumber)) {
        return true;
      }
      return false;
    });

    if (session && (session.status === 'pending-review' || session.status === 'approved' || session.status === 'review')) {
      return 'completed';
    }

    return 'none';
  };

  // Get ASN for each delivery (if exists) - using synced asns from DataContext
  // Only exclude 'completed' or 'cancelled' ASNs
  const deliveriesWithInfo = useMemo(() => {
    return receivableDeliveries.map((delivery) => {
      const asn = asns.find((a) => 
        a.deliveryId === delivery.id && 
        a.status !== 'completed' && 
        a.status !== 'cancelled'
      );
      const asnInfo = getASNStatusInfo(delivery.id);
      
      // Check receiving session status
      const sessionStatus = getReceivingSessionStatus(asn?.id, delivery.id);
      
      console.log('[Receive] Delivery check:', {
        deliveryId: delivery.id,
        customerName: delivery.customerName,
        containerNumber: delivery.containerNumber,
        asnFound: !!asn,
        asnId: asn?.id,
        sessionStatus,
      });
      
      return { delivery, asn, asnInfo, sessionStatus };
    }).filter(({ sessionStatus }) => {
      // FILTER OUT deliveries with completed receipts
      return sessionStatus !== 'completed';
    });
  }, [receivableDeliveries, asns, slipRequests, receivingSessions]);

  const handleStartReceiving = (asnId: string) => {
    navigate(`/receive/${asnId}`);
  };

  const handleQuickReceive = (deliveryId: string) => {
    // Navigate to receiving page without ASN (manual entry mode)
    navigate(`/receive/quick/${deliveryId}`);
  };

  const handleViewReceipt = (asnId?: string, deliveryId?: string) => {
    // Find the completed session
    const delivery = deliveries.find(d => d.id === deliveryId);
    const session = receivingSessions.find(s => {
      if (asnId && s.asnId === asnId) return true;
      if (deliveryId && s.deliveryId === deliveryId) return true;
      if (delivery && (s.containerNumber === delivery.containerNumber || s.poNumber === delivery.poNumber)) {
        return true;
      }
      return false;
    });

    if (session) {
      navigate(`/review-queue/${session.id}`);
    }
  };

  const handleNewReceipt = () => {
    // Navigate to new receipt page (walk-in truck, no delivery record)
    navigate('/receive/new');
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'arrived':
        return 'bg-green-100 text-green-800';
      case 'dropped':
        return 'bg-yellow-100 text-yellow-800';
      case 'unloaded':
        return 'bg-purple-100 text-purple-800';
      case 'checked in':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Receive</h1>
          <p className="text-gray-600 mt-1">Start receiving deliveries that have arrived at the dock</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleNewReceipt} variant="default" className="gap-2">
            <TruckIcon className="h-4 w-4" />
            New Receipt (Walk-in)
          </Button>
          <PackageCheck className="h-12 w-12 text-gray-400" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scheduled Deliveries</CardTitle>
              <CardDescription>
                Deliveries with status: Arrived, Dropped, Unloaded, or Checked In
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {deliveriesWithInfo.length === 0 ? (
            <div className="text-center py-12">
              <PackageCheck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Scheduled Deliveries Ready</h3>
              <p className="text-gray-600 mb-4">
                There are no scheduled deliveries currently ready for receiving. Change delivery status to Arrived, Dropped, Unloaded, or Checked In in the Incoming Deliveries page.
              </p>
              <p className="text-sm text-gray-500 mb-4">
                For walk-in trucks without prior notice, use the "New Receipt (Walk-in)" button above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>PO/Container #</TableHead>
                    <TableHead>Reference #</TableHead>
                    <TableHead>Door</TableHead>
                    <TableHead>Expected Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>ASN Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveriesWithInfo.map(({ delivery, asn, asnInfo, sessionStatus }) => (
                    <TableRow key={delivery.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{delivery.customerName}</TableCell>
                      <TableCell>{delivery.containerNumber || delivery.poNumber}</TableCell>
                      <TableCell>
                        {(() => {
                          const ref = getCustomerReference(delivery.customerName);
                          return ref ? (
                            <span className="font-mono text-sm font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                              {ref}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          );
                        })()}
                      </TableCell>
                      <TableCell>{delivery.door}</TableCell>
                      <TableCell>{delivery.expectedDate}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(delivery.status)}>{delivery.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={asnInfo.color}>{asnInfo.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {sessionStatus === 'in-progress' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => asn ? handleStartReceiving(asn.id) : handleQuickReceive(delivery.id)}
                            className="gap-1"
                          >
                            <Play className="h-4 w-4" />
                            Resume
                          </Button>
                        ) : asn ? (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleStartReceiving(asn.id)}
                            className="gap-1"
                          >
                            Start Receiving
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickReceive(delivery.id)}
                            className="gap-1"
                          >
                            <Plus className="h-4 w-4" />
                            Quick Receive
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile View */}
      <div className="md:hidden space-y-3">
        {deliveriesWithInfo.map(({ delivery, asn, asnInfo, sessionStatus }) => (
          <Card key={delivery.id} className="cursor-pointer">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{delivery.customerName}</h3>
                    <p className="text-sm text-gray-600">{delivery.containerNumber || delivery.poNumber}</p>
                  </div>
                  <Badge className={getStatusColor(delivery.status)}>{delivery.status}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Door:</span> <span className="font-medium">{delivery.door}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">ASN:</span>{' '}
                    <Badge className={asnInfo.color} variant="outline">{asnInfo.label}</Badge>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">Expected:</span> <span className="font-medium">{delivery.expectedDate}</span>
                  </div>
                </div>
                {sessionStatus === 'in-progress' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1"
                    onClick={() => asn ? handleStartReceiving(asn.id) : handleQuickReceive(delivery.id)}
                  >
                    <Play className="h-4 w-4" />
                    Resume
                  </Button>
                ) : asn ? (
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full gap-1"
                    onClick={() => handleStartReceiving(asn.id)}
                  >
                    Start Receiving
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1"
                    onClick={() => handleQuickReceive(delivery.id)}
                  >
                    <Plus className="h-4 w-4" />
                    Quick Receive
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}