import { useState } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Mail, Plus, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { PackingSlipRequest } from '@/types';
import { toast } from 'sonner';

export default function Slips() {
  const { deliveries = [], slipRequests = [], addSlipRequest, updateSlipRequest, appSettings } = useData();
  const { user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const handleCreateRequest = () => {
    const delivery = deliveries.find((d) => d.id === selectedDeliveryId);
    if (!delivery || !user || !customerEmail || !dueDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    const newRequest: PackingSlipRequest = {
      id: `SLIP-${Date.now()}`,
      deliveryId: delivery.id,
      requestedDate: new Date().toISOString(),
      requestedBy: user.name,
      dueDate,
      status: 'pending-customer',
      customerEmail,
      remindersSent: 0,
      notes,
    };

    addSlipRequest(newRequest);
    toast.success(`Packing slip request sent to ${customerEmail}`);
    
    setIsCreateOpen(false);
    setSelectedDeliveryId('');
    setCustomerEmail('');
    setDueDate('');
    setNotes('');
  };

  const handleSendReminder = (request: PackingSlipRequest) => {
    updateSlipRequest(request.id, {
      remindersSent: request.remindersSent + 1,
      lastReminderDate: new Date().toISOString(),
    });
    toast.success('Reminder sent to customer');
  };

  const handleMarkReceived = (request: PackingSlipRequest) => {
    updateSlipRequest(request.id, {
      status: 'ready-for-asn',
      receivedDate: new Date().toISOString(),
    });
    toast.success('Packing slip marked as received');
  };

  const getUrgencyColor = (request: PackingSlipRequest) => {
    const daysUntilDue = Math.ceil(
      (new Date(request.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysUntilDue < 0) {
      return 'bg-red-100 text-red-800 border-red-300';
    } else if (daysUntilDue <= appSettings.urgentThresholdDays) {
      return 'bg-amber-100 text-amber-800 border-amber-300';
    }
    return 'bg-green-100 text-green-800 border-green-300';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending-customer':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending Customer</Badge>;
      case 'ready-for-asn':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Ready for ASN</Badge>;
      case 'asn-created':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">ASN Created</Badge>;
      case 'completed':
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const deliveriesWithoutSlips = deliveries.filter(
    (d) => !slipRequests.some((s) => s.deliveryId === d.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Packing Slips / ASN Tracking</h1>
          <p className="text-gray-600 mt-1">Manage packing slip requests and ASN status</p>
        </div>
        <img
          src="https://mgx-backend-cdn.metadl.com/generate/images/881888/2026-01-04/580e82fc-e5cd-4da8-9262-5d2356d0a313.png"
          alt="ASN Document"
          className="h-12 w-12"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Packing Slip Requests ({slipRequests.length})</CardTitle>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Request Packing Slip
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request Packing Slip from Customer</DialogTitle>
                  <DialogDescription>
                    Send a request to the customer for their packing slip
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="delivery">Select Delivery</Label>
                    <Select value={selectedDeliveryId} onValueChange={setSelectedDeliveryId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a delivery" />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveriesWithoutSlips.map((delivery) => (
                          <SelectItem key={delivery.id} value={delivery.id}>
                            {delivery.customerName} - {delivery.containerNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Customer Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="customer@company.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Add any special instructions..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateRequest}
                    disabled={!selectedDeliveryId || !customerEmail || !dueDate}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send Request
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {slipRequests.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No packing slip requests yet</p>
              <Button onClick={() => setIsCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Create First Request
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Container</TableHead>
                    <TableHead>Requested Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reminders</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slipRequests.map((request) => {
                    const delivery = deliveries.find((d) => d.id === request.deliveryId);
                    const daysUntilDue = Math.ceil(
                      (new Date(request.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                    );
                    
                    return (
                      <TableRow key={request.id} className={`border-l-4 ${getUrgencyColor(request)}`}>
                        <TableCell className="font-medium">{delivery?.customerName}</TableCell>
                        <TableCell>{delivery?.containerNumber}</TableCell>
                        <TableCell>{new Date(request.requestedDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {new Date(request.dueDate).toLocaleDateString()}
                            {daysUntilDue < 0 && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {Math.abs(daysUntilDue)}d overdue
                              </Badge>
                            )}
                            {daysUntilDue >= 0 && daysUntilDue <= appSettings.urgentThresholdDays && (
                              <Badge className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-100">
                                <Clock className="h-3 w-3 mr-1" />
                                {daysUntilDue}d left
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{request.remindersSent} sent</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {request.status === 'pending-customer' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSendReminder(request)}
                                >
                                  <Mail className="h-4 w-4 mr-1" />
                                  Remind
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleMarkReceived(request)}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Received
                                </Button>
                              </>
                            )}
                            {request.status === 'ready-for-asn' && (
                              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                                Ready for ASN Creation
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}