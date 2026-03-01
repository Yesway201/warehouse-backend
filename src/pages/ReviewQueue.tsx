import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, AlertCircle, Send, Loader2, Copy, Check, Edit, Hash } from 'lucide-react';
import { sendReceivingToExtensiv } from '@/lib/extensivApi';
import { loadExtensivCredentials } from '@/lib/credentialStorage';
import { customersAPI } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ReceivingSession {
  id: string;
  customerName: string;
  customerId: string;
  containerNumber: string;
  poNumber?: string;
  startedBy: string;
  startedAt: string;
  completedAt?: string;
  status: 'in-progress' | 'pending-review' | 'completed' | 'sent-to-extensiv';
  type?: string;
  reviewNotes?: string;
  referenceNumber?: string;
  items: Array<{
    itemNumber: string;
    description: string;
    expectedQty: number;
    receivedQty: number;
    uom: string;
    condition?: string;
    notes?: string;
  }>;
}

export default function ReviewQueue() {
  const { receivingSessions, updateReceivingSession, customers = [], loadCustomersFromBackend } = useData();
  const [selectedSession, setSelectedSession] = useState<ReceivingSession | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [sendingToExtensiv, setSendingToExtensiv] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{
    title: string;
    message: string;
    technicalDetails?: string;
    timestamp: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // Reference number editing state
  const [editingRefSessionId, setEditingRefSessionId] = useState<string | null>(null);
  const [editRefValue, setEditRefValue] = useState('');
  // Preview references for each session
  const [previewRefs, setPreviewRefs] = useState<Record<string, string>>({});
  const [loadingPreviews, setLoadingPreviews] = useState(false);

  const completedSessions = useMemo(() => {
    return receivingSessions.filter(
      (session) => session.status === 'pending-review' || session.status === 'completed' || session.status === 'sent-to-extensiv'
    );
  }, [receivingSessions]);

  // Load preview references for all sessions that don't have one yet
  const loadPreviewReferences = async () => {
    if (loadingPreviews) return;
    setLoadingPreviews(true);
    
    const newPreviews: Record<string, string> = { ...previewRefs };
    
    for (const session of completedSessions) {
      if (session.status === 'sent-to-extensiv') continue; // Already sent
      if (session.referenceNumber) continue; // Already has a reference
      if (newPreviews[session.id]) continue; // Already previewed
      
      try {
        const customer = customers.find(c => c.id === session.customerId || c.name === session.customerName);
        if (customer?.id) {
          const preview = await customersAPI.previewReference(customer.id);
          if (preview.success && preview.previewReference) {
            newPreviews[session.id] = preview.previewReference;
          }
        }
      } catch (err) {
        console.warn('[ReviewQueue] Could not preview reference for session:', session.id, err);
      }
    }
    
    setPreviewRefs(newPreviews);
    setLoadingPreviews(false);
  };

  // Load previews when sessions change
  useMemo(() => {
    if (completedSessions.length > 0 && customers.length > 0) {
      loadPreviewReferences();
    }
  }, [completedSessions.length, customers.length]);

  // Get the reference display for a session
  const getSessionReference = (session: ReceivingSession): string => {
    if (session.referenceNumber) return session.referenceNumber;
    if (previewRefs[session.id]) return previewRefs[session.id];
    
    // Try to compute from customer data
    const customer = customers.find(c => c.id === session.customerId || c.name === session.customerName);
    if (customer?.referencePrefix && customer?.referenceCounter !== undefined) {
      return `${customer.referencePrefix}${(customer.referenceCounter || 0) + 1}`;
    }
    
    return '';
  };

  const handleApprove = (session: ReceivingSession) => {
    const updatedSession = {
      ...session,
      status: 'completed' as const,
      reviewNotes: reviewNotes || session.reviewNotes,
    };
    updateReceivingSession(session.id, updatedSession);
    setSelectedSession(null);
    setReviewNotes('');
  };

  const handleReject = (session: ReceivingSession) => {
    const updatedSession = {
      ...session,
      status: 'in-progress' as const,
      reviewNotes: reviewNotes || session.reviewNotes,
    };
    updateReceivingSession(session.id, updatedSession);
    setSelectedSession(null);
    setReviewNotes('');
  };

  const handleEditReference = (session: ReceivingSession) => {
    setEditingRefSessionId(session.id);
    setEditRefValue(getSessionReference(session));
  };

  const handleSaveReference = (session: ReceivingSession) => {
    const updatedSession = {
      ...session,
      referenceNumber: editRefValue.trim(),
    };
    updateReceivingSession(session.id, updatedSession);
    setEditingRefSessionId(null);
    setEditRefValue('');
  };

  const handleCancelEditReference = () => {
    setEditingRefSessionId(null);
    setEditRefValue('');
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSendToExtensiv = async (session: ReceivingSession) => {
    setSendingToExtensiv(true);
    
    try {
      console.log('[ReviewQueue] Loading credentials from backend...');
      
      // Load credentials from backend (same as item sync)
      const credentials = await loadExtensivCredentials();
      
      if (!credentials) {
        console.error('[ReviewQueue] ❌ No credentials found');
        
        setErrorDetails({
          title: 'Missing Credentials',
          message: 'Extensiv credentials are not configured. Please go to Settings and configure your Extensiv API credentials.',
          technicalDetails: 'No credentials found in backend storage. User needs to configure credentials in Settings page.',
          timestamp: new Date().toISOString(),
        });
        setErrorDialogOpen(true);
        setSendingToExtensiv(false);
        return;
      }
      
      console.log('[ReviewQueue] ✅ Credentials loaded successfully');
      
      // Step 1: Preview the reference number (for logging)
      let previewRef = '';
      try {
        const customer = customers.find(c => c.id === session.customerId || c.name === session.customerName);
        if (customer?.id) {
          const preview = await customersAPI.previewReference(customer.id);
          if (preview.success && preview.previewReference) {
            previewRef = preview.previewReference;
            console.log(`[ReviewQueue] 📋 Preview reference: ${previewRef}`);
          }
        }
      } catch (previewErr) {
        console.warn('[ReviewQueue] Could not preview reference:', previewErr);
      }
      
      // Step 2: Send to Extensiv (backend will auto-generate reference number atomically)
      console.log('[ReviewQueue] Sending to Extensiv with auto-generated reference number...');
      
      const result = await sendReceivingToExtensiv(credentials, {
        id: session.id,
        customerName: session.customerName,
        customerId: session.customerId,
        containerNumber: session.containerNumber,
        poNumber: session.poNumber,
        startedBy: session.startedBy,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        type: session.type,
        reviewNotes: session.reviewNotes,
        items: session.items,
      });

      if (result.success) {
        const refNum = result.referenceNumber || result.receiverNumber || '';
        
        console.log('[ReviewQueue] ✅ Successfully sent to Extensiv');
        console.log('[ReviewQueue] Receiver ID:', result.receiverId);
        console.log('[ReviewQueue] Receiver Number:', result.receiverNumber);
        console.log('[ReviewQueue] Reference Number:', refNum);
        
        const updatedSession = {
          ...session,
          status: 'sent-to-extensiv' as const,
          referenceNumber: refNum,
          reviewNotes: `${session.reviewNotes || ''}\n\nSent to Extensiv - Receiver ID: ${result.receiverId}, Receiver #: ${result.receiverNumber}, Reference #: ${refNum}`.trim(),
        };
        updateReceivingSession(session.id, updatedSession);
        
        // Refresh customer data to show updated counter
        try {
          await loadCustomersFromBackend();
          console.log('[ReviewQueue] ✅ Customer data refreshed after send');
        } catch (refreshErr) {
          console.warn('[ReviewQueue] Could not refresh customer data:', refreshErr);
        }
        
        alert(`Successfully sent to Extensiv!\n\nReceiver ID: ${result.receiverId}\nReceiver Number: ${result.receiverNumber}\nReference Number: ${refNum}`);
      } else {
        console.error('[ReviewQueue] ❌ Failed to send to Extensiv:', result.error);
        console.log('[ReviewQueue] Note: Backend handles reference rollback automatically on failure');
        
        // Create detailed error information
        const technicalDetails = [
          `Error: ${result.error}`,
          result.details ? `Details: ${result.details}` : '',
          `Session ID: ${session.id}`,
          `Customer: ${session.customerName} (ID: ${session.customerId})`,
          `Container: ${session.containerNumber}`,
          `Items: ${session.items.length}`,
          previewRef ? `Preview Reference (not consumed): ${previewRef}` : '',
        ].filter(Boolean).join('\n');

        setErrorDetails({
          title: 'Failed to Send to Extensiv',
          message: result.error || 'An unknown error occurred while sending the receiving transaction to Extensiv.',
          technicalDetails,
          timestamp: new Date().toISOString(),
        });
        setErrorDialogOpen(true);
      }
    } catch (error) {
      console.error('[ReviewQueue] ❌ Exception while sending to Extensiv:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      
      const technicalDetails = [
        `Exception: ${errorMessage}`,
        errorStack ? `Stack Trace:\n${errorStack}` : '',
        `Session ID: ${session.id}`,
        `Customer: ${session.customerName} (ID: ${session.customerId})`,
        `Container: ${session.containerNumber}`,
      ].filter(Boolean).join('\n');

      setErrorDetails({
        title: 'Unexpected Error',
        message: `An unexpected error occurred: ${errorMessage}`,
        technicalDetails,
        timestamp: new Date().toISOString(),
      });
      setErrorDialogOpen(true);
    } finally {
      setSendingToExtensiv(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending-review':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending Review</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>;
      case 'sent-to-extensiv':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Sent to Extensiv</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getConditionIcon = (condition?: string) => {
    // Default to "good" if condition is undefined or empty
    const normalizedCondition = condition?.toLowerCase() || 'good';
    
    switch (normalizedCondition) {
      case 'good':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'damaged':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Review Queue</h1>
          <p className="text-muted-foreground mt-1">
            Review and approve completed receiving sessions
          </p>
        </div>
      </div>

      {completedSessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No sessions to review</p>
            <p className="text-sm text-muted-foreground mt-1">
              Completed receiving sessions will appear here for review
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {completedSessions.map((session) => {
            const refDisplay = getSessionReference(session);
            const isEditingRef = editingRefSessionId === session.id;
            
            return (
              <Card key={session.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">
                        {session.customerName} - {session.containerNumber}
                      </CardTitle>
                      <div className="flex gap-2 text-sm text-muted-foreground">
                        <span>Started: {new Date(session.startedAt).toLocaleString()}</span>
                        {session.completedAt && (
                          <span>• Completed: {new Date(session.completedAt).toLocaleString()}</span>
                        )}
                      </div>
                      {session.poNumber && (
                        <div className="text-sm text-muted-foreground">
                          PO Number: {session.poNumber}
                        </div>
                      )}
                      
                      {/* Reference Number Display */}
                      <div className="flex items-center gap-2 mt-2">
                        <Hash className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-700">Reference #:</span>
                        
                        {isEditingRef ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editRefValue}
                              onChange={(e) => setEditRefValue(e.target.value)}
                              className="h-7 w-40 text-sm font-mono"
                              placeholder="e.g., Asco1005"
                              autoFocus
                            />
                            <Button size="sm" variant="default" className="h-7 px-2 text-xs" onClick={() => handleSaveReference(session)}>
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleCancelEditReference}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
                              {session.referenceNumber || refDisplay || 'Auto-generated on send'}
                            </span>
                            {session.status !== 'sent-to-extensiv' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => handleEditReference(session)}
                                title="Edit reference number"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            )}
                            {session.status === 'sent-to-extensiv' && session.referenceNumber && (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                Sent
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(session.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-3 font-medium">Item</th>
                          <th className="text-left p-3 font-medium">Description</th>
                          <th className="text-right p-3 font-medium">Expected</th>
                          <th className="text-right p-3 font-medium">Received</th>
                          <th className="text-left p-3 font-medium">Condition</th>
                          <th className="text-left p-3 font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {session.items.map((item, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-3 font-mono text-sm">{item.itemNumber}</td>
                            <td className="p-3">{item.description}</td>
                            <td className="p-3 text-right">{item.expectedQty} {item.uom}</td>
                            <td className="p-3 text-right font-medium">{item.receivedQty} {item.uom}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                {getConditionIcon(item.condition)}
                                <span className="capitalize">{item.condition || 'good'}</span>
                              </div>
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">{item.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {session.reviewNotes && (
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm font-medium mb-1">Review Notes:</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{session.reviewNotes}</p>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    {(session.status === 'pending-review' || session.status === 'completed') && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedSession(session);
                            setReviewNotes(session.reviewNotes || '');
                          }}
                        >
                          Review
                        </Button>
                        <Button
                          variant="default"
                          onClick={() => handleSendToExtensiv(session)}
                          disabled={sendingToExtensiv}
                          className="gap-2"
                        >
                          {sendingToExtensiv ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4" />
                              Send to Extensiv
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Dialog */}
      {selectedSession && (
        <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Review Session</DialogTitle>
              <DialogDescription>
                Add notes and approve or reject this receiving session
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="review-notes">Review Notes</Label>
                <Textarea
                  id="review-notes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add any notes about this receiving session..."
                  rows={4}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSelectedSession(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={() => handleReject(selectedSession)}>
                  Reject & Return
                </Button>
                <Button onClick={() => handleApprove(selectedSession)}>
                  Approve
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Error Dialog with Copy Functionality */}
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              {errorDetails?.title || 'Error'}
            </DialogTitle>
            <DialogDescription>
              {errorDetails?.timestamp && (
                <span className="text-xs text-muted-foreground">
                  {new Date(errorDetails.timestamp).toLocaleString()}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* User-friendly error message */}
            <Alert variant="destructive">
              <AlertDescription className="text-sm">
                {errorDetails?.message}
              </AlertDescription>
            </Alert>

            {/* Technical details section */}
            {errorDetails?.technicalDetails && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Technical Details</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(errorDetails.technicalDetails || '', 'technical')}
                    className="h-8 gap-2"
                  >
                    {copiedField === 'technical' ? (
                      <>
                        <Check className="h-3 w-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <div className="bg-muted p-3 rounded-lg font-mono text-xs whitespace-pre-wrap overflow-x-auto">
                  {errorDetails.technicalDetails}
                </div>
              </div>
            )}

            {/* Full error report for support */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Full Error Report (for support)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const fullReport = [
                      `Error Title: ${errorDetails?.title}`,
                      `Timestamp: ${errorDetails?.timestamp}`,
                      `Message: ${errorDetails?.message}`,
                      '',
                      'Technical Details:',
                      errorDetails?.technicalDetails || 'None',
                    ].join('\n');
                    copyToClipboard(fullReport, 'full');
                  }}
                  className="h-8 gap-2"
                >
                  {copiedField === 'full' ? (
                    <>
                      <Check className="h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy All
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Copy this information when contacting support for faster resolution.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setErrorDialogOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}