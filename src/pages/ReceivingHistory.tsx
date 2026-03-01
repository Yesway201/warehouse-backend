import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { History, Eye, CheckCircle, XCircle, Clock, Send, Filter, Search } from 'lucide-react';
import { ReceivingSession } from '@/types';

export default function ReceivingHistory() {
  const { receivingSessions = [], syncLogs = [] } = useData();
  const [selectedSession, setSelectedSession] = useState<ReceivingSession | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Get all completed/historical sessions (not in-progress or pending-review)
  const historicalSessions = receivingSessions?.filter(
    (session) => session.status !== 'in-progress' && session.status !== 'pending-review'
  ) || [];

  // Apply filters
  const filteredSessions = historicalSessions.filter((session) => {
    const matchesSearch = 
      (session.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (session.containerNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (session.startedBy || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
    const matchesType = typeFilter === 'all' || session.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Sort by most recent first
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    const dateA = new Date(a.completedAt || a.startedAt).getTime();
    const dateB = new Date(b.completedAt || b.startedAt).getTime();
    return dateB - dateA;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-600">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'in-progress':
        return <Badge className="bg-blue-600">In Progress</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getSyncStatus = (session: ReceivingSession) => {
    if (session.syncedToExtensiv) {
      const syncLog = syncLogs.find((log) => log.receivingSessionId === session.id);
      return (
        <Badge className="bg-blue-600">
          <Send className="h-3 w-3 mr-1" />
          Synced to Extensiv
          {syncLog && ` (${new Date(syncLog.syncedAt).toLocaleDateString()})`}
        </Badge>
      );
    }
    return null;
  };

  const handleViewDetails = (session: ReceivingSession) => {
    setSelectedSession(session);
    setDetailDialogOpen(true);
  };

  const getVarianceInfo = (session: ReceivingSession) => {
    const variances = session.items.filter(
      (item) => item.expectedQty > 0 && item.receivedQty !== item.expectedQty
    );
    const damaged = session.items.filter((item) => item.condition !== 'good');
    return { variances, damaged };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Receiving History & Audit Trail</h1>
        <p className="text-gray-600 mt-1">Complete history of all receiving transactions</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Sessions</p>
                <p className="text-2xl font-bold">{historicalSessions.length}</p>
              </div>
              <History className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-green-600">
                  {historicalSessions.filter((s) => s.status === 'approved').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-red-600">
                  {historicalSessions.filter((s) => s.status === 'rejected').length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Synced to Extensiv</p>
                <p className="text-2xl font-bold text-blue-600">
                  {historicalSessions.filter((s) => s.syncedToExtensiv).length}
                </p>
              </div>
              <Send className="h-8 w-8 text-blue-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Customer, container, or worker..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="asn-based">ASN-Based</SelectItem>
                  <SelectItem value="blind">Blind Receipt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History List */}
      {sortedSessions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-gray-500">
              <History className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No Historical Sessions Found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedSessions.map((session) => {
            const { variances, damaged } = getVarianceInfo(session);
            return (
              <Card key={session.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{session.customerName}</h3>
                        {getStatusBadge(session.status)}
                        {session.type === 'blind' && (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                            Blind
                          </Badge>
                        )}
                        {getSyncStatus(session)}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600 mb-2">
                        <div>
                          <span className="font-medium">Container:</span> {session.containerNumber || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Received by:</span> {session.startedBy || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Completed:</span>{' '}
                          {session.completedAt ? new Date(session.completedAt).toLocaleString() : 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Items:</span> {session.items.length}
                        </div>
                      </div>

                      {session.reviewedBy && (
                        <div className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">Reviewed by:</span> {session.reviewedBy} on{' '}
                          {new Date(session.reviewedAt!).toLocaleString()}
                        </div>
                      )}

                      {(variances.length > 0 || damaged.length > 0) && (
                        <div className="flex gap-2 mb-2">
                          {variances.length > 0 && (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                              {variances.length} Variance{variances.length > 1 ? 's' : ''}
                            </Badge>
                          )}
                          {damaged.length > 0 && (
                            <Badge variant="destructive">
                              {damaged.length} Damaged
                            </Badge>
                          )}
                        </div>
                      )}

                      {session.reviewNotes && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                          <span className="font-medium">Review Notes:</span> {session.reviewNotes}
                        </div>
                      )}

                      {session.rejectionReason && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-sm border border-red-200">
                          <span className="font-medium text-red-800">Rejection Reason:</span> {session.rejectionReason}
                        </div>
                      )}
                    </div>

                    <Button onClick={() => handleViewDetails(session)} size="sm" variant="outline" className="gap-2 ml-4">
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receiving Session Details</DialogTitle>
            <DialogDescription>Complete audit trail and item details</DialogDescription>
          </DialogHeader>

          {selectedSession && (
            <div className="space-y-4">
              {/* Session Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-600">Customer</p>
                  <p className="font-semibold">{selectedSession.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Container</p>
                  <p className="font-semibold">{selectedSession.containerNumber || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Type</p>
                  <p className="font-semibold">{selectedSession.type === 'blind' ? 'Blind Receipt' : 'ASN-Based'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedSession.status)}</div>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Received By</p>
                  <p className="font-semibold">{selectedSession.startedBy || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Started At</p>
                  <p className="font-semibold">{new Date(selectedSession.startedAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Completed At</p>
                  <p className="font-semibold">
                    {selectedSession.completedAt ? new Date(selectedSession.completedAt).toLocaleString() : 'N/A'}
                  </p>
                </div>
                {selectedSession.reviewedBy && (
                  <>
                    <div>
                      <p className="text-xs text-gray-600">Reviewed By</p>
                      <p className="font-semibold">{selectedSession.reviewedBy}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Reviewed At</p>
                      <p className="font-semibold">{new Date(selectedSession.reviewedAt!).toLocaleString()}</p>
                    </div>
                  </>
                )}
                {selectedSession.syncedToExtensiv && (
                  <>
                    <div>
                      <p className="text-xs text-gray-600">Synced to Extensiv</p>
                      <p className="font-semibold">{new Date(selectedSession.syncedAt!).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Extensiv Receipt ID</p>
                      <p className="font-semibold">{selectedSession.extensivReceiptId}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Items */}
              <div>
                <p className="text-sm font-semibold mb-3">Items ({selectedSession.items.length}):</p>
                <div className="space-y-2">
                  {selectedSession.items.map((item, idx) => (
                    <Card key={idx}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold">{item.itemNumber}</p>
                              {item.condition !== 'good' && (
                                <Badge variant="destructive">{item.condition}</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                            <div className="flex gap-4 text-sm">
                              {item.expectedQty > 0 && (
                                <>
                                  <div>
                                    <span className="text-gray-500">Expected:</span>{' '}
                                    <span className="font-medium">{item.expectedQty} {item.uom}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Received:</span>{' '}
                                    <span className={`font-medium ${
                                      item.receivedQty !== item.expectedQty ? 'text-orange-600' : 'text-green-600'
                                    }`}>
                                      {item.receivedQty} {item.uom}
                                    </span>
                                  </div>
                                  {item.receivedQty !== item.expectedQty && (
                                    <div>
                                      <span className="text-gray-500">Variance:</span>{' '}
                                      <span className="font-medium text-orange-600">
                                        {item.receivedQty > item.expectedQty ? '+' : ''}{item.receivedQty - item.expectedQty}
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                              {item.expectedQty === 0 && (
                                <div>
                                  <span className="text-gray-500">Received:</span>{' '}
                                  <span className="font-medium text-blue-600">{item.receivedQty} {item.uom}</span>
                                </div>
                              )}
                            </div>
                            {item.notes && (
                              <div className="mt-2 p-2 bg-yellow-50 rounded text-sm">
                                <span className="font-medium">Notes:</span> {item.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Review Notes */}
              {selectedSession.reviewNotes && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="font-medium text-sm mb-1">Review Notes:</p>
                  <p className="text-sm">{selectedSession.reviewNotes}</p>
                </div>
              )}

              {/* Rejection Reason */}
              {selectedSession.rejectionReason && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="font-medium text-sm mb-1 text-red-800">Rejection Reason:</p>
                  <p className="text-sm text-red-700">{selectedSession.rejectionReason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}