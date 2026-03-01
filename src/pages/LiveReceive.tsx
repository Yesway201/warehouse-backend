import { useState, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Eye, Clock, User, Package, TrendingUp, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ReceivingSession } from '@/types';

export default function LiveReceive() {
  const { receivingSessions = [] } = useData();
  const [selectedSession, setSelectedSession] = useState<ReceivingSession | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // REMOVED: Aggressive forceFullSync() - DataContext handles initial load

  // Update time every second for elapsed time calculation
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter active receiving sessions (in-progress)
  const activeSessions = receivingSessions.filter(
    (session) => session.status === 'in-progress'
  );

  const getElapsedTime = (startedAt: string) => {
    const start = new Date(startedAt);
    const diff = Math.floor((currentTime.getTime() - start.getTime()) / 1000);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getProgress = (session: ReceivingSession) => {
    const totalItems = session.items.length;
    const completedItems = session.items.filter(
      (item) => item.receivedQty > 0 || item.condition !== 'good'
    ).length;
    return totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
  };

  const getTotalReceived = (session: ReceivingSession) => {
    return session.items.reduce((sum, item) => sum + item.receivedQty, 0);
  };

  const getTotalExpected = (session: ReceivingSession) => {
    return session.items.reduce((sum, item) => sum + item.expectedQty, 0);
  };

  const handleViewDetails = (session: ReceivingSession) => {
    setSelectedSession(session);
    setViewDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Live Receiving Monitor</h1>
        <p className="text-gray-600 mt-1">Real-time view of active receiving sessions (Read-Only)</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Sessions</p>
                <p className="text-3xl font-bold text-blue-600">{activeSessions.length}</p>
              </div>
              <Package className="h-10 w-10 text-blue-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Items In Progress</p>
                <p className="text-3xl font-bold text-green-600">
                  {activeSessions.reduce((sum, s) => sum + s.items.length, 0)}
                </p>
              </div>
              <TrendingUp className="h-10 w-10 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Dock Workers Active</p>
                <p className="text-3xl font-bold text-purple-600">
                  {new Set(activeSessions.map((s) => s.startedBy)).size}
                </p>
              </div>
              <User className="h-10 w-10 text-purple-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Sessions */}
      {activeSessions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-gray-500">
              <Clock className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No Active Receiving Sessions</p>
              <p className="text-sm mt-1">All dock workers are currently idle</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activeSessions.map((session) => {
            const progress = getProgress(session);
            const totalReceived = getTotalReceived(session);
            const totalExpected = getTotalExpected(session);
            const hasVariances = session.items.some(
              (item) => item.expectedQty > 0 && item.receivedQty !== item.expectedQty
            );
            const hasDamaged = session.items.some((item) => item.condition !== 'good');

            return (
              <Card key={session.id} className="border-blue-200 shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-xl">{session.customerName}</CardTitle>
                        <Badge className="bg-blue-600">
                          <Clock className="h-3 w-3 mr-1" />
                          In Progress
                        </Badge>
                        {session.type === 'blind' && (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                            Blind Receipt
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {session.startedBy}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Started {getElapsedTime(session.startedAt)} ago
                        </span>
                        <span>Container: {session.containerNumber || 'Not set'}</span>
                      </CardDescription>
                    </div>
                    <Button onClick={() => handleViewDetails(session)} size="sm" variant="outline" className="gap-2">
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-medium">{Math.round(progress)}% Complete</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{session.items.filter((i) => i.receivedQty > 0).length} of {session.items.length} items started</span>
                      <span>{totalReceived} / {totalExpected} units received</span>
                    </div>
                  </div>

                  {/* Alerts */}
                  {(hasVariances || hasDamaged) && (
                    <div className="flex gap-2">
                      {hasVariances && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Quantity Variances Detected
                        </Badge>
                      )}
                      {hasDamaged && (
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Damaged Items Reported
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Recent Items (Last 3) */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Recent Activity:</p>
                    <div className="space-y-1">
                      {session.items
                        .filter((item) => item.receivedQty > 0)
                        .slice(-3)
                        .reverse()
                        .map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm py-2 px-3 bg-gray-50 rounded">
                            <span className="font-medium">{item.itemNumber}</span>
                            <div className="flex items-center gap-2">
                              <span className={item.receivedQty !== item.expectedQty ? 'text-orange-600 font-semibold' : 'text-gray-600'}>
                                {item.receivedQty} / {item.expectedQty} {item.uom}
                              </span>
                              {item.condition !== 'good' && (
                                <Badge variant="destructive" className="text-xs">
                                  {item.condition}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      {session.items.filter((i) => i.receivedQty > 0).length === 0 && (
                        <p className="text-sm text-gray-500 italic py-2">No items received yet</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* View Details Dialog (Read-Only) */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receiving Session Details (Read-Only)</DialogTitle>
            <DialogDescription>
              Live view of receiving in progress - Office cannot edit while dock worker is active
            </DialogDescription>
          </DialogHeader>

          {selectedSession && (
            <div className="space-y-4">
              {/* Session Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <p className="text-xs text-gray-600">Customer</p>
                  <p className="font-semibold">{selectedSession.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Container</p>
                  <p className="font-semibold">{selectedSession.containerNumber || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Dock Worker</p>
                  <p className="font-semibold">{selectedSession.startedBy}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Elapsed Time</p>
                  <p className="font-semibold">{getElapsedTime(selectedSession.startedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Progress</p>
                  <p className="font-semibold">{Math.round(getProgress(selectedSession))}% Complete</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total Received</p>
                  <p className="font-semibold">{getTotalReceived(selectedSession)} / {getTotalExpected(selectedSession)} units</p>
                </div>
              </div>

              {/* All Items */}
              <div>
                <p className="text-sm font-semibold mb-3">All Items ({selectedSession.items.length}):</p>
                <div className="space-y-2">
                  {selectedSession.items.map((item, idx) => (
                    <Card key={idx} className={item.receivedQty > 0 ? 'border-blue-200 bg-blue-50' : ''}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold">{item.itemNumber}</p>
                              {item.receivedQty > 0 && (
                                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                                  In Progress
                                </Badge>
                              )}
                              {item.condition !== 'good' && (
                                <Badge variant="destructive">{item.condition}</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                            <div className="flex gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Expected:</span>{' '}
                                <span className="font-medium">{item.expectedQty} {item.uom}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Received:</span>{' '}
                                <span className={`font-medium ${
                                  item.receivedQty === 0 ? 'text-gray-400' :
                                  item.receivedQty !== item.expectedQty ? 'text-orange-600' : 'text-green-600'
                                }`}>
                                  {item.receivedQty} {item.uom}
                                </span>
                              </div>
                              {item.receivedQty > 0 && item.receivedQty !== item.expectedQty && (
                                <div>
                                  <span className="text-gray-500">Variance:</span>{' '}
                                  <span className="font-medium text-orange-600">
                                    {item.receivedQty > item.expectedQty ? '+' : ''}{item.receivedQty - item.expectedQty}
                                  </span>
                                </div>
                              )}
                            </div>
                            {item.notes && (
                              <div className="mt-2 p-2 bg-yellow-50 rounded text-sm border border-yellow-200">
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

              <div className="p-4 bg-gray-100 rounded-lg text-sm text-gray-700">
                <p className="font-medium mb-1">📋 Office View Only</p>
                <p>This session is currently being worked on by {selectedSession.startedBy}. You can monitor progress but cannot make changes until they complete or pause the session.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}