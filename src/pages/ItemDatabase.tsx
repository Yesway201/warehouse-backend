import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Search, Download, Copy, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { syncItemsFromExtensiv } from '@/lib/extensivApi';
import { loadExtensivCredentials } from '@/lib/credentialStorage';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Item {
  itemNumber: string;
  description: string;
  uom: string;
  category: string;
  customerId: string;
  barcode?: string;
  extensivId?: string;
  isActive?: boolean;
  lastSyncedAt?: string;
}

interface SyncDiagnostics {
  apiVersion?: string;
  syncStartTime?: string;
  syncEndTime?: string;
  customerId: string | null;
  request: {
    urlTemplate: string;
    pgsiz: number;
    pagesRequested: number[];
    lastUrlCalled: string | null;
  };
  response: {
    httpStatusByPage: Array<{ page: number; status: number }>;
    rawSnippetByPage: Array<{ page: number; snippet: string }>;
    detectedItemsPath: string;
    totalResultsReported?: number | null;
    itemsFoundByPage: Array<{ page: number; count: number }>;
    totalItemsExtracted: number;
  };
  storage: {
    upsertKey: string;
    inserted: number;
    updated: number;
    finalTotalForCustomer: number;
  };
}

export default function ItemDatabase() {
  const { customers } = useData();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    message: string;
    diagnostics?: SyncDiagnostics;
  } | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Load items from localStorage
  useEffect(() => {
    const sessionId = 'warehouse_mgmt';
    const tableName = 'extensiv_items';
    const storageKey = `${sessionId}_${tableName}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const allItems = JSON.parse(stored);
      setItems(allItems);
    }
  }, []);

  // Filter items by selected customer
  useEffect(() => {
    if (selectedCustomerId) {
      const customerItems = items.filter((item) => item.customerId === selectedCustomerId);
      setFilteredItems(customerItems);
    } else {
      setFilteredItems(items);
    }
  }, [items, selectedCustomerId]);

  // Search filter
  const displayedItems = filteredItems.filter(
    (item) =>
      item.itemNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /**
   * Load credentials with retry logic to handle timing issues
   */
  const loadCredentialsWithRetry = async (maxRetries = 3, delayMs = 1500) => {
    console.log('[ItemDatabase] 🔄 Loading credentials with retry logic...');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[ItemDatabase] 🔍 Attempt ${attempt}/${maxRetries} to load credentials...`);
      
      try {
        const credentials = await loadExtensivCredentials();
        
        console.log('[ItemDatabase] 🔍 RAW RETURN VALUE from loadExtensivCredentials:', credentials);
        console.log('[ItemDatabase] 🔍 Type:', typeof credentials);
        console.log('[ItemDatabase] 🔍 Is null?', credentials === null);
        console.log('[ItemDatabase] 🔍 Is undefined?', credentials === undefined);
        console.log('[ItemDatabase] 🔍 Stringified:', JSON.stringify(credentials));
        
        if (credentials && typeof credentials === 'object') {
          console.log('[ItemDatabase] 🔍 Credential fields:', {
            hasClientId: !!credentials.clientId,
            hasClientSecret: !!credentials.clientSecret,
            hasUserLoginId: !!credentials.userLoginId,
            hasFacilityId: !!credentials.facilityId,
            clientIdValue: credentials.clientId,
            clientSecretValue: credentials.clientSecret,
            userLoginIdValue: credentials.userLoginId,
            facilityIdValue: credentials.facilityId
          });
          
          // Validate all required fields
          if (credentials.clientId && credentials.clientSecret && credentials.userLoginId && credentials.facilityId) {
            console.log(`[ItemDatabase] ✅ Credentials validated successfully on attempt ${attempt}`);
            console.log('[ItemDatabase] ✅ RETURNING CREDENTIALS:', credentials);
            return credentials;
          } else {
            console.warn(`[ItemDatabase] ⚠️ Incomplete credentials on attempt ${attempt}:`, {
              noClientId: !credentials.clientId,
              noClientSecret: !credentials.clientSecret,
              noUserLoginId: !credentials.userLoginId,
              noFacilityId: !credentials.facilityId
            });
          }
        } else {
          console.warn(`[ItemDatabase] ⚠️ Credentials is not a valid object on attempt ${attempt}`);
        }
        
        // If not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          console.log(`[ItemDatabase] ⏳ Waiting ${delayMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        console.error(`[ItemDatabase] ❌ Error loading credentials on attempt ${attempt}:`, error);
        
        // If not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          console.log(`[ItemDatabase] ⏳ Waiting ${delayMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    console.error('[ItemDatabase] ❌ Failed to load credentials after all retries');
    return null;
  };

  const handleSync = async () => {
    if (!selectedCustomerId) {
      toast.error('Please select a customer first');
      return;
    }

    console.log('[ItemDatabase] 🔍 Starting sync process...');
    
    // Show loading state for credential loading
    setIsLoadingCredentials(true);
    
    try {
      // Load credentials with retry logic (increased delay to 1500ms)
      const credentials = await loadCredentialsWithRetry(3, 1500);
      
      // Enhanced validation: check if credentials object exists AND has all required fields
      if (!credentials || !credentials.clientId || !credentials.clientSecret || !credentials.userLoginId || !credentials.facilityId) {
        console.error('[ItemDatabase] ❌ Credentials validation failed after retries');
        console.error('[ItemDatabase] ❌ Missing fields:', {
          noCredentials: !credentials,
          noClientId: !credentials?.clientId,
          noClientSecret: !credentials?.clientSecret,
          noUserLoginId: !credentials?.userLoginId,
          noFacilityId: !credentials?.facilityId
        });
        
        toast.error('Missing Credentials', {
          description: 'Please configure your Extensiv credentials in Settings → Extensiv Integration tab first.',
        });
        return;
      }

      console.log('[ItemDatabase] ✅ Credentials validated, proceeding with sync...');

      setIsSyncing(true);
      setSyncResult(null);
      setShowDiagnostics(false);

      const result = await syncItemsFromExtensiv(credentials, selectedCustomerId);

      if (result.success) {
        const message = `Completed: ${result.newItems} new / ${result.updatedItems} updated / ${result.totalItems} total`;
        setSyncResult({
          success: true,
          message,
          diagnostics: result.diagnostics as SyncDiagnostics,
        });
        toast.success(message);

        // Reload items from localStorage
        const sessionId = 'warehouse_mgmt';
        const tableName = 'extensiv_items';
        const storageKey = `${sessionId}_${tableName}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const allItems = JSON.parse(stored);
          setItems(allItems);
        }
      } else {
        setSyncResult({
          success: false,
          message: result.error || 'Sync failed',
          diagnostics: result.diagnostics as SyncDiagnostics,
        });
        toast.error(result.error || 'Sync failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSyncResult({
        success: false,
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setIsSyncing(false);
      setIsLoadingCredentials(false);
    }
  };

  const copySyncLog = () => {
    if (syncResult?.diagnostics) {
      const logText = JSON.stringify(syncResult.diagnostics, null, 2);
      navigator.clipboard.writeText(logText);
      toast.success('Sync log copied to clipboard');
    }
  };

  const handleExport = () => {
    const csv = [
      ['Item Number', 'Description', 'UOM', 'Category', 'Customer ID', 'Barcode', 'Active', 'Last Synced'],
      ...displayedItems.map((item) => [
        item.itemNumber,
        item.description,
        item.uom,
        item.category,
        item.customerId,
        item.barcode || '',
        item.isActive ? 'Yes' : 'No',
        item.lastSyncedAt || '',
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `items_${selectedCustomerId || 'all'}_${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isButtonDisabled = !selectedCustomerId || isSyncing || isLoadingCredentials;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Item Database</h1>
          <p className="text-muted-foreground">
            Manage and sync items from Extensiv 3PL Warehouse Manager
          </p>
        </div>
        <Button onClick={handleExport} variant="outline" disabled={displayedItems.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sync Items from Extensiv</CardTitle>
          <CardDescription>
            Select a customer and sync their items from Extensiv API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="customer">Customer</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger id="customer">
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleSync} disabled={isButtonDisabled}>
                {isLoadingCredentials ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading credentials...
                  </>
                ) : isSyncing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync from Extensiv
                  </>
                )}
              </Button>
            </div>
          </div>

          {syncResult && (
            <Alert className={syncResult.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
              <AlertDescription>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className={`font-semibold ${syncResult.success ? 'text-green-800' : 'text-red-800'}`}>
                      {syncResult.message}
                    </p>
                    {syncResult.diagnostics && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copySyncLog}
                        className="h-7"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Sync Log
                      </Button>
                    )}
                  </div>

                  {syncResult.diagnostics && 
                   syncResult.diagnostics.response.totalItemsExtracted === 0 && (
                    <div className="text-sm text-orange-700 bg-orange-100 p-3 rounded">
                      <p className="font-medium">⚠️ 0 items extracted from Extensiv response</p>
                      <p className="mt-1">
                        Detected path: <code className="bg-orange-200 px-1 rounded">{syncResult.diagnostics.response.detectedItemsPath}</code>
                      </p>
                      <p className="mt-1">Open Sync Details below to see raw API response.</p>
                    </div>
                  )}

                  {syncResult.diagnostics && (
                    <Collapsible open={showDiagnostics} onOpenChange={setShowDiagnostics}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-between">
                          <span className="text-sm font-medium">View Sync Details</span>
                          {showDiagnostics ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {syncResult.diagnostics.apiVersion && (
                              <div>
                                <p className="font-medium text-gray-700">API Version</p>
                                <p className="text-gray-600">{syncResult.diagnostics.apiVersion}</p>
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-700">Customer ID</p>
                              <p className="text-gray-600">{syncResult.diagnostics.customerId}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700">Page Size</p>
                              <p className="text-gray-600">{syncResult.diagnostics.request.pgsiz}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700">Pages Fetched</p>
                              <p className="text-gray-600">{syncResult.diagnostics.request.pagesRequested.join(', ')}</p>
                            </div>
                            {syncResult.diagnostics.response.totalResultsReported !== null && 
                             syncResult.diagnostics.response.totalResultsReported !== undefined && (
                              <div>
                                <p className="font-medium text-gray-700">Total Results (Extensiv)</p>
                                <p className="text-gray-600">{syncResult.diagnostics.response.totalResultsReported}</p>
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-700">Items Extracted</p>
                              <p className="text-gray-600">{syncResult.diagnostics.response.totalItemsExtracted}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700">Detected Path</p>
                              <p className="text-gray-600 break-all">{syncResult.diagnostics.response.detectedItemsPath}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700">Items Saved</p>
                              <p className="text-gray-600">
                                {syncResult.diagnostics.storage.inserted} new, {syncResult.diagnostics.storage.updated} updated
                              </p>
                            </div>
                            {syncResult.diagnostics.syncStartTime && (
                              <div>
                                <p className="font-medium text-gray-700">Sync Started</p>
                                <p className="text-gray-600 text-xs">
                                  {new Date(syncResult.diagnostics.syncStartTime).toLocaleString()}
                                </p>
                              </div>
                            )}
                            {syncResult.diagnostics.syncEndTime && (
                              <div>
                                <p className="font-medium text-gray-700">Sync Completed</p>
                                <p className="text-gray-600 text-xs">
                                  {new Date(syncResult.diagnostics.syncEndTime).toLocaleString()}
                                </p>
                              </div>
                            )}
                          </div>

                          <div>
                            <p className="font-medium text-gray-700 mb-2">HTTP Status by Page</p>
                            <div className="flex flex-wrap gap-2">
                              {syncResult.diagnostics.response.httpStatusByPage.map((item) => (
                                <Badge
                                  key={item.page}
                                  variant={item.status === 200 ? 'default' : 'destructive'}
                                >
                                  Page {item.page}: {item.status}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="font-medium text-gray-700 mb-2">Items Found by Page</p>
                            <div className="flex flex-wrap gap-2">
                              {syncResult.diagnostics.response.itemsFoundByPage.map((item) => (
                                <Badge key={item.page} variant="outline">
                                  Page {item.page}: {item.count} items
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {syncResult.diagnostics.response.rawSnippetByPage.length > 0 && (
                            <div>
                              <p className="font-medium text-gray-700 mb-2">Raw Response Snippets</p>
                              <div className="space-y-2">
                                {syncResult.diagnostics.response.rawSnippetByPage.map((item) => (
                                  <div key={item.page} className="text-xs">
                                    <p className="font-medium text-gray-600">Page {item.page}:</p>
                                    <pre className="bg-gray-100 p-2 rounded overflow-auto max-h-32 text-gray-800">
                                      {item.snippet}
                                    </pre>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <p className="font-medium text-gray-700 mb-2">Last URL Called</p>
                            <code className="text-xs bg-gray-100 p-2 rounded block overflow-auto text-gray-800">
                              {syncResult.diagnostics.request.lastUrlCalled}
                            </code>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Items</CardTitle>
              <CardDescription>
                {displayedItems.length} items
                {selectedCustomerId && ` for selected customer`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Number</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Synced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No items found. Select a customer and sync from Extensiv.
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedItems.map((item) => (
                    <TableRow key={`${item.customerId}-${item.itemNumber}`}>
                      <TableCell className="font-medium">{item.itemNumber}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.uom}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>
                        {customers.find((c) => c.id === item.customerId)?.name || item.customerId}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.isActive ? 'default' : 'secondary'}>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.lastSyncedAt
                          ? new Date(item.lastSyncedAt).toLocaleString()
                          : 'Never'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}