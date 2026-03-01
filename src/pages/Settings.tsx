import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, XCircle, Copy, AlertCircle, Plus, RefreshCw, Save } from 'lucide-react';
import { testConnection } from '@/lib/extensivApi';
import { saveExtensivCredentials, loadExtensivCredentials } from '@/lib/credentialStorage';
import { 
  loadSmartsheetSettings,
  saveSmartsheetSettings,
  saveSmartsheetMappings,
  clearSmartsheetSettings,
  testSmartsheetConnection,
  fetchSmartsheetColumns,
  copyToClipboard
} from '@/lib/smartsheetApi';
import type { SmartsheetColumn } from '@/lib/smartsheetApi';
import { useData } from '@/contexts/DataContext';
import { toast } from 'sonner';
import { useItemSync } from '@/hooks/useItemSync';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Column mapping interface
interface ColumnMapping {
  smartsheetColumn: string;
  appField: string;
}

interface DiagnosticInfo {
  error?: string;
  rawResponse?: string;
  exception?: string;
  status?: string | number;
  url?: string;
  details?: string;
  isHtml?: boolean;
  [key: string]: unknown;
}

// Default column mappings for V1 - merged PO/Container into single field
const DEFAULT_COLUMN_MAPPINGS: ColumnMapping[] = [
  { smartsheetColumn: 'Customer Name', appField: 'customerName' },
  { smartsheetColumn: 'PO/Container #', appField: 'containerNumber' },
  { smartsheetColumn: 'Expected Delivery Date', appField: 'expectedDeliveryDate' },
  { smartsheetColumn: 'Door', appField: 'door' },
  { smartsheetColumn: 'Carrier', appField: 'carrier' },
  { smartsheetColumn: 'ASN', appField: 'asn' },
  { smartsheetColumn: 'Status', appField: 'status' },
  { smartsheetColumn: 'Done', appField: 'done' },
  { smartsheetColumn: 'Reference #', appField: 'referenceNumber' },
  { smartsheetColumn: '3PL Transaction #', appField: 'extensivReceiptId' },
];

export default function Settings() {
  // Smartsheet credentials loaded indicator
  const [smartsheetCredentialsLoaded, setSmartsheetCredentialsLoaded] = useState(false);
  const [smartsheetApiTokenMasked, setSmartsheetApiTokenMasked] = useState<string | null>(null);

  // Smartsheet columns from API
  const [smartsheetColumns, setSmartsheetColumns] = useState<SmartsheetColumn[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);

  // Connection Status
  const [connectionStatus, setConnectionStatus] = useState<{
    smartsheet: 'connected' | 'disconnected' | 'checking';
    extensiv: 'connected' | 'disconnected' | 'checking';
  }>({
    smartsheet: 'disconnected',
    extensiv: 'disconnected',
  });

  // Smartsheet Configuration
  const [smartsheetConfig, setSmartsheetConfig] = useState({
    apiToken: '',
    sheetId: '',
  });

  // Column Mapping
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>(DEFAULT_COLUMN_MAPPINGS);
  const [savingMappings, setSavingMappings] = useState(false);

  // Smartsheet Auto-Sync Configuration
  const [smartsheetAutoSyncConfig, setSmartsheetAutoSyncConfig] = useState({
    enabled: localStorage.getItem('smartsheet_auto_sync_enabled') === 'true',
    intervalMinutes: parseInt(localStorage.getItem('smartsheet_auto_sync_interval') || '15'),
    syncOnStartup: localStorage.getItem('smartsheet_auto_sync_on_startup') === 'true',
  });

  // Smartsheet test result
  const [smartsheetTestResult, setSmartsheetTestResult] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message?: string;
    sheetName?: string;
    rowCount?: number;
    diagnostics?: DiagnosticInfo;
  }>({ status: 'idle' });

  // Extensiv Configuration - Load from backend on mount
  const [extensivConfig, setExtensivConfig] = useState({
    clientId: '',
    clientSecret: '',
    userLoginId: '',
    facilityId: '',
  });
  
  const [extensivCredentialsLoaded, setExtensivCredentialsLoaded] = useState(false);
  const [saveCredentials, setSaveCredentials] = useState(true);

  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message?: string;
    diagnostics?: DiagnosticInfo;
  }>({ status: 'idle' });

  // Item Database - Get data from context
  const dataContext = useData();
  const customers = dataContext.customers || [];
  const extensivItems = dataContext.extensivItems || [];

  // Item Database Configuration
  const [itemDbConfig, setItemDbConfig] = useState({
    autoSync: localStorage.getItem('item_db_auto_sync') === 'true',
    syncInterval: parseInt(localStorage.getItem('item_db_sync_interval') || '60'),
    enableNotifications: localStorage.getItem('item_db_notifications') === 'true',
    lowStockThreshold: parseInt(localStorage.getItem('item_db_low_stock') || '10'),
    syncOnStartup: localStorage.getItem('item_db_sync_startup') === 'true',
  });

  // Item sync functionality
  const { syncItems, isSyncing, lastSyncTime } = useItemSync();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  // Load credentials from backend on mount
  useEffect(() => {
    const loadCredentials = async () => {
      console.log('[Settings] Loading Smartsheet settings from backend...');
      const result = await loadSmartsheetSettings();
      
      if (result.success && result.settings) {
        const { settings } = result;
        setSmartsheetConfig({
          apiToken: '', // Never show full token
          sheetId: settings.sheetId || '',
        });
        // Merge saved mappings with any new defaults that were added after the user last saved
        const savedMappings: ColumnMapping[] = settings.mappings || [];
        if (savedMappings.length > 0) {
          const savedAppFields = new Set(savedMappings.map((m: ColumnMapping) => m.appField));
          const newDefaults = DEFAULT_COLUMN_MAPPINGS.filter(d => !savedAppFields.has(d.appField));
          setColumnMappings([...savedMappings, ...newDefaults]);
        } else {
          setColumnMappings(DEFAULT_COLUMN_MAPPINGS);
        }
        setSmartsheetCredentialsLoaded(settings.configured);
        setSmartsheetApiTokenMasked(settings.apiTokenMasked);
        console.log('[Settings] ✅ Credentials loaded from backend');
      } else {
        setSmartsheetCredentialsLoaded(false);
        setSmartsheetApiTokenMasked(null);
        console.log('[Settings] ❌ No credentials found on backend');
      }
      
      // Load Extensiv credentials from backend
      console.log('[Settings] Loading Extensiv credentials from backend...');
      const extensivCreds = await loadExtensivCredentials();
      if (extensivCreds) {
        setExtensivConfig(extensivCreds);
        setExtensivCredentialsLoaded(true);
        console.log('[Settings] ✅ Extensiv credentials loaded from backend');
      } else {
        setExtensivCredentialsLoaded(false);
        console.log('[Settings] ❌ No Extensiv credentials found on backend');
      }
    };

    loadCredentials();
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    // Check Smartsheet - load from backend
    setConnectionStatus(prev => ({ ...prev, smartsheet: 'checking' }));
    const result = await loadSmartsheetSettings();
    setConnectionStatus(prev => ({
      ...prev,
      smartsheet: result.success && result.settings?.configured ? 'connected' : 'disconnected',
    }));

    // Check Extensiv - load from backend
    setConnectionStatus(prev => ({ ...prev, extensiv: 'checking' }));
    const extensivCreds = await loadExtensivCredentials();
    const hasExtensivCreds = extensivCreds && extensivCreds.clientId && extensivCreds.clientSecret && extensivCreds.userLoginId;
    setConnectionStatus(prev => ({
      ...prev,
      extensiv: hasExtensivCreds ? 'connected' : 'disconnected',
    }));
  };

  const handleFetchColumns = async () => {
    setLoadingColumns(true);
    const result = await fetchSmartsheetColumns();
    
    if (result.success && result.columns) {
      setSmartsheetColumns(result.columns);
      toast.success(`Fetched ${result.columns.length} columns from ${result.sheetName}`);
    } else {
      toast.error(result.error || 'Failed to fetch columns');
    }
    
    setLoadingColumns(false);
  };

  const handleSmartsheetSave = async () => {
    if (!smartsheetConfig.apiToken && !smartsheetConfig.sheetId) {
      toast.error('API Token and Sheet ID are required');
      return;
    }

    // Save to backend
    const result = await saveSmartsheetSettings(
      smartsheetConfig.apiToken,
      smartsheetConfig.sheetId,
      columnMappings
    );

    if (result.success) {
      setSmartsheetCredentialsLoaded(true);
      setSmartsheetApiTokenMasked(result.apiTokenMasked || null);
      // Clear the token input after save
      setSmartsheetConfig(prev => ({ ...prev, apiToken: '' }));
      toast.success('Smartsheet credentials saved to server');
      checkConnectionStatus();
    } else {
      toast.error(result.error || 'Failed to save credentials');
    }
  };

  const handleSaveMappings = async () => {
    setSavingMappings(true);
    
    const result = await saveSmartsheetMappings(columnMappings);
    
    if (result.success) {
      toast.success('Column mappings saved successfully');
    } else {
      toast.error(result.error || 'Failed to save mappings');
    }
    
    setSavingMappings(false);
  };

  const handleSmartsheetClear = async () => {
    if (confirm('Are you sure you want to clear Smartsheet credentials? This cannot be undone.')) {
      const result = await clearSmartsheetSettings();
      
      if (result.success) {
        setSmartsheetConfig({ apiToken: '', sheetId: '' });
        setColumnMappings(DEFAULT_COLUMN_MAPPINGS);
        setSmartsheetCredentialsLoaded(false);
        setSmartsheetApiTokenMasked(null);
        setSmartsheetColumns([]);
        toast.success('Smartsheet credentials cleared from server');
        checkConnectionStatus();
      } else {
        toast.error(result.error || 'Failed to clear credentials');
      }
    }
  };

  const handleSmartsheetTest = async () => {
    setSmartsheetTestResult({ status: 'testing' });

    const result = await testSmartsheetConnection();

    if (result.success) {
      setSmartsheetTestResult({
        status: 'success',
        message: result.message || 'Connection successful!',
        sheetName: result.sheetName,
        rowCount: result.rowCount,
      });
      checkConnectionStatus();
    } else {
      setSmartsheetTestResult({
        status: 'error',
        message: result.error || 'Connection failed',
        diagnostics: {
          error: result.error,
          status: result.status,
          url: result.url,
          details: result.details,
          isHtml: result.isHtml,
        },
      });
    }
  };

  const handleSmartsheetAutoSyncSave = () => {
    localStorage.setItem('smartsheet_auto_sync_enabled', String(smartsheetAutoSyncConfig.enabled));
    localStorage.setItem('smartsheet_auto_sync_interval', String(smartsheetAutoSyncConfig.intervalMinutes));
    localStorage.setItem('smartsheet_auto_sync_on_startup', String(smartsheetAutoSyncConfig.syncOnStartup));
    toast.success('Auto-sync settings saved. Reload the page to apply changes.');
  };

  const handleExtensivSave = async () => {
    if (!extensivConfig.clientId || !extensivConfig.clientSecret || !extensivConfig.userLoginId || !extensivConfig.facilityId) {
      toast.error('All Extensiv fields are required');
      return;
    }

    if (saveCredentials) {
      try {
        const success = await saveExtensivCredentials(extensivConfig);
        if (success) {
          setExtensivCredentialsLoaded(true);
          toast.success('Extensiv credentials saved to backend');
          checkConnectionStatus();
        } else {
          toast.error('Failed to save credentials to backend');
        }
      } catch (error) {
        console.error('[Settings] Error saving Extensiv credentials:', error);
        toast.error('Failed to save credentials: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    } else {
      toast.success('Extensiv credentials will be used for this session only');
      checkConnectionStatus();
    }
  };

  const handleTestConnection = async () => {
    setTestResult({ status: 'testing' });

    try {
      const result = await testConnection(extensivConfig);

      if (result.success) {
        setTestResult({
          status: 'success',
          message: 'Connection successful! OAuth token obtained.',
        });
        checkConnectionStatus();
      } else {
        setTestResult({
          status: 'error',
          message: result.error || 'Connection failed',
          diagnostics: result.diagnostics,
        });
      }
    } catch (error) {
      setTestResult({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        diagnostics: { exception: String(error) },
      });
    }
  };

  const copyDiagnostics = async (diagnostics?: DiagnosticInfo) => {
    if (diagnostics) {
      const diagnosticsText = JSON.stringify(diagnostics, null, 2);
      const success = await copyToClipboard(diagnosticsText);
      
      if (success) {
        toast.success('Diagnostics copied to clipboard');
      } else {
        toast.error('Copy failed – please manually select text');
      }
    }
  };

  const addColumnMapping = () => {
    setColumnMappings([...columnMappings, { smartsheetColumn: '', appField: '' }]);
  };

  const updateColumnMapping = (index: number, field: 'smartsheetColumn' | 'appField', value: string) => {
    const updated = [...columnMappings];
    updated[index][field] = value;
    setColumnMappings(updated);
  };

  const removeColumnMapping = (index: number) => {
    setColumnMappings(columnMappings.filter((_, i) => i !== index));
  };

  const handleItemDbSave = () => {
    localStorage.setItem('item_db_auto_sync', String(itemDbConfig.autoSync));
    localStorage.setItem('item_db_sync_interval', String(itemDbConfig.syncInterval));
    localStorage.setItem('item_db_notifications', String(itemDbConfig.enableNotifications));
    localStorage.setItem('item_db_low_stock', String(itemDbConfig.lowStockThreshold));
    localStorage.setItem('item_db_sync_startup', String(itemDbConfig.syncOnStartup));
    toast.success('Item Database settings saved');
  };

  const handleSyncItems = async () => {
    const customerId = selectedCustomerId === 'all' ? undefined : selectedCustomerId;
    await syncItems(customerId);
  };

  const filteredItems = (extensivItems || []).filter(item => {
    const matchesSearch = !itemSearchQuery || 
      item.itemNumber.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
      item.customerId.toLowerCase().includes(itemSearchQuery.toLowerCase());
    
    const matchesCustomer = selectedCustomerId === 'all' || item.customerId === selectedCustomerId;
    
    return matchesSearch && matchesCustomer;
  });

  const appFields = [
    { value: 'customerName', label: 'Customer Name' },
    { value: 'containerNumber', label: 'PO/Container #' },
    { value: 'expectedDeliveryDate', label: 'Expected Delivery Date' },
    { value: 'door', label: 'Door' },
    { value: 'carrier', label: 'Carrier' },
    { value: 'asn', label: 'ASN' },
    { value: 'status', label: 'Status' },
    { value: 'done', label: 'Done (Checkbox)' },
    { value: 'referenceNumber', label: 'Reference #' },
    { value: 'extensivReceiptId', label: '3PL Transaction # / Extensiv Receipt ID' },
  ];

  // DEBUG: Log appFields and columnMappings on every render
  console.log('[DEBUG Settings] appFields:', JSON.stringify(appFields.map(f => f.value)));
  console.log('[DEBUG Settings] columnMappings count:', columnMappings.length);
  console.log('[DEBUG Settings] columnMappings:', JSON.stringify(columnMappings.map((m, i) => ({
    index: i,
    smartsheet: m.smartsheetColumn,
    appField: m.appField,
    appFieldInList: appFields.some(f => f.value === m.appField)
  }))));

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      {/* Connection Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-semibold">Smartsheet</p>
                <p className="text-sm text-muted-foreground">Incoming deliveries sync</p>
                {smartsheetCredentialsLoaded ? (
                  <p className="text-xs text-green-600 font-medium mt-1">✅ Credentials loaded from backend</p>
                ) : (
                  <p className="text-xs text-red-600 font-medium mt-1">❌ Smartsheet not configured</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {connectionStatus.smartsheet === 'checking' ? (
                  <AlertCircle className="h-5 w-5 text-yellow-500 animate-pulse" />
                ) : connectionStatus.smartsheet === 'connected' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="text-sm font-medium">
                  {connectionStatus.smartsheet === 'checking' ? 'Checking...' : 
                   connectionStatus.smartsheet === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-semibold">Extensiv 3PL</p>
                <p className="text-sm text-muted-foreground">Item database sync</p>
                {extensivCredentialsLoaded ? (
                  <p className="text-xs text-green-600 font-medium mt-1">✅ Credentials loaded from backend</p>
                ) : (
                  <p className="text-xs text-red-600 font-medium mt-1">❌ Extensiv not configured</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {connectionStatus.extensiv === 'checking' ? (
                  <AlertCircle className="h-5 w-5 text-yellow-500 animate-pulse" />
                ) : connectionStatus.extensiv === 'connected' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="text-sm font-medium">
                  {connectionStatus.extensiv === 'checking' ? 'Checking...' : 
                   connectionStatus.extensiv === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="smartsheet" className="w-full">
        <TabsList>
          <TabsTrigger value="smartsheet">Smartsheet</TabsTrigger>
          <TabsTrigger value="extensiv">Extensiv Integration</TabsTrigger>
          <TabsTrigger value="itemdb">Item Database</TabsTrigger>
        </TabsList>

        {/* Smartsheet Tab */}
        <TabsContent value="smartsheet">
          <Card>
            <CardHeader>
              <CardTitle>Smartsheet Integration</CardTitle>
              <CardDescription>
                Configure your Smartsheet API credentials and column mappings for delivery tracking
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Credentials Status Alert */}
              {smartsheetCredentialsLoaded ? (
                <Alert className="border-green-500 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <p className="font-semibold">✅ Credentials Saved on Server</p>
                    <p className="text-sm mt-1">
                      Your Smartsheet credentials are stored on the Railway backend and will persist across all reloads and redeployments.
                    </p>
                    {smartsheetApiTokenMasked && (
                      <p className="text-xs mt-2 font-mono bg-green-100 px-2 py-1 rounded inline-block">
                        API Token: {smartsheetApiTokenMasked}
                      </p>
                    )}
                    <p className="text-xs mt-2 text-green-700">
                      💡 The input fields below appear empty for security, but your credentials are safely stored on the server.
                    </p>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-red-500 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <p className="font-semibold">❌ Smartsheet Not Configured</p>
                    <p className="text-sm mt-1">
                      Please enter your API Token and Sheet ID below, then click "Save Settings" to store them on the server.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apiToken">
                    API Token
                    {smartsheetCredentialsLoaded && (
                      <span className="ml-2 text-xs text-green-600 font-medium">(Already saved on server)</span>
                    )}
                  </Label>
                  <Input
                    id="apiToken"
                    type="password"
                    value={smartsheetConfig.apiToken}
                    onChange={(e) =>
                      setSmartsheetConfig({ ...smartsheetConfig, apiToken: e.target.value })
                    }
                    placeholder={smartsheetCredentialsLoaded ? "Leave empty to keep existing token, or enter new token to update" : "Enter your Smartsheet API token"}
                  />
                  <p className="text-xs text-muted-foreground">
                    Generate an API token from your Smartsheet Account → Apps & Integrations → API Access
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sheetId">Sheet ID</Label>
                  <Input
                    id="sheetId"
                    value={smartsheetConfig.sheetId}
                    onChange={(e) =>
                      setSmartsheetConfig({ ...smartsheetConfig, sheetId: e.target.value })
                    }
                    placeholder="Enter your Smartsheet Sheet ID"
                  />
                  <p className="text-xs text-muted-foreground">
                    Find the Sheet ID in the URL: smartsheet.com/sheets/[SHEET_ID]
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button onClick={handleSmartsheetSave}>
                  {smartsheetCredentialsLoaded ? 'Update Settings' : 'Save Settings'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSmartsheetTest}
                  disabled={smartsheetTestResult.status === 'testing'}
                >
                  {smartsheetTestResult.status === 'testing' ? 'Testing...' : 'Test Connection'}
                </Button>
                {smartsheetCredentialsLoaded && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleFetchColumns}
                      disabled={loadingColumns}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${loadingColumns ? 'animate-spin' : ''}`} />
                      {loadingColumns ? 'Fetching...' : 'Fetch Columns'}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleSmartsheetClear}
                    >
                      Clear Smartsheet Settings
                    </Button>
                  </>
                )}
              </div>

              {smartsheetTestResult.status === 'success' && (
                <Alert className="border-green-500 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <div className="space-y-1">
                      <p className="font-semibold">{smartsheetTestResult.message}</p>
                      {smartsheetTestResult.sheetName && (
                        <p className="text-sm">Sheet: {smartsheetTestResult.sheetName}</p>
                      )}
                      {smartsheetTestResult.rowCount !== undefined && (
                        <p className="text-sm">Total Rows: {smartsheetTestResult.rowCount}</p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {smartsheetTestResult.status === 'error' && (
                <Alert className="border-red-500 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="text-red-800 font-semibold">{smartsheetTestResult.message}</p>
                      {smartsheetTestResult.diagnostics && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-red-700">Error Details:</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyDiagnostics(smartsheetTestResult.diagnostics)}
                              className="h-7"
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy Error Log
                            </Button>
                          </div>
                          <pre className="text-xs bg-red-100 p-3 rounded overflow-auto max-h-60 text-red-900">
                            {JSON.stringify(smartsheetTestResult.diagnostics, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Auto-Sync Settings */}
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <h3 className="font-semibold">Auto-Sync Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure automatic synchronization from Smartsheet. Manual sync is always available in the Incoming Deliveries page.
                  </p>
                </div>

                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="smartsheetAutoSync"
                      checked={smartsheetAutoSyncConfig.enabled}
                      onChange={(e) =>
                        setSmartsheetAutoSyncConfig({ ...smartsheetAutoSyncConfig, enabled: e.target.checked })
                      }
                      className="h-4 w-4"
                    />
                    <Label htmlFor="smartsheetAutoSync" className="cursor-pointer">
                      Enable automatic synchronization from Smartsheet
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smartsheetSyncInterval">Sync Interval (minutes)</Label>
                    <Select
                      value={String(smartsheetAutoSyncConfig.intervalMinutes)}
                      onValueChange={(value) =>
                        setSmartsheetAutoSyncConfig({ ...smartsheetAutoSyncConfig, intervalMinutes: parseInt(value) })
                      }
                      disabled={!smartsheetAutoSyncConfig.enabled}
                    >
                      <SelectTrigger id="smartsheetSyncInterval">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">Every 5 minutes</SelectItem>
                        <SelectItem value="10">Every 10 minutes</SelectItem>
                        <SelectItem value="15">Every 15 minutes</SelectItem>
                        <SelectItem value="30">Every 30 minutes</SelectItem>
                        <SelectItem value="60">Every 60 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      How often to automatically sync deliveries from Smartsheet
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="smartsheetSyncOnStartup"
                      checked={smartsheetAutoSyncConfig.syncOnStartup}
                      onChange={(e) =>
                        setSmartsheetAutoSyncConfig({ ...smartsheetAutoSyncConfig, syncOnStartup: e.target.checked })
                      }
                      className="h-4 w-4"
                    />
                    <Label htmlFor="smartsheetSyncOnStartup" className="cursor-pointer">
                      Sync deliveries automatically when opening the app
                    </Label>
                  </div>
                </div>

                <Button onClick={handleSmartsheetAutoSyncSave}>Save Auto-Sync Settings</Button>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <p className="font-medium mb-1">Note:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Auto-sync runs in the background and updates deliveries silently</li>
                      <li>Manual sync button is always available in the Incoming Deliveries page</li>
                      <li>Changes take effect after reloading the page</li>
                      <li>For the write-back feature, only Status and Door will be updated to Smartsheet when editing deliveries</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>

              {/* Column Mapping */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Column Mapping</h3>
                <div className="bg-yellow-100 border border-yellow-400 p-3 rounded text-xs font-mono mb-4">
                  <p className="font-bold text-yellow-800 mb-1">🔍 DEBUG INFO (will be removed):</p>
                  <p>App Fields ({appFields.length}): {appFields.map(f => f.label).join(', ')}</p>
                  <p className="mt-1">Mappings loaded ({columnMappings.length}):</p>
                  {columnMappings.map((m, i) => (
                    <p key={i} className={m.appField === 'asn' ? 'text-green-700 font-bold' : ''}>
                      {i+1}. "{m.smartsheetColumn}" → "{m.appField}" {appFields.some(f => f.value === m.appField) ? '✅' : '❌ NOT IN DROPDOWN'}
                    </p>
                  ))}
                  <p className="mt-1 font-bold">ASN in appFields: {appFields.some(f => f.value === 'asn') ? '✅ YES' : '❌ NO'}</p>
                  <p>trackingNumber in appFields: {appFields.some(f => f.value === 'trackingNumber') ? '⚠️ YES' : '✅ REMOVED'}</p>
                  <p>trackingNumber in saved mappings: {columnMappings.some(m => m.appField === 'trackingNumber') ? '⚠️ YES (orphaned - no dropdown match!)' : '✅ NOT PRESENT'}</p>
                </div>
                    <p className="text-sm text-muted-foreground">
                      Map Smartsheet columns to application fields (V1 delivery tracking)
                    </p>
                    {smartsheetColumns.length > 0 && (
                      <p className="text-xs text-green-600 font-medium mt-1">
                        ✅ {smartsheetColumns.length} columns fetched from Smartsheet
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={addColumnMapping}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Mapping
                    </Button>
                    {smartsheetCredentialsLoaded && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={handleSaveMappings}
                        disabled={savingMappings}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        {savingMappings ? 'Saving...' : 'Save Mappings'}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {columnMappings.map((mapping, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 border rounded-lg">
                      <div className="space-y-2">
                        <Label>Smartsheet Column</Label>
                        {smartsheetColumns.length > 0 ? (
                          <Select
                            value={mapping.smartsheetColumn}
                            onValueChange={(value) => updateColumnMapping(index, 'smartsheetColumn', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Smartsheet column" />
                            </SelectTrigger>
                            <SelectContent>
                              {smartsheetColumns.map(col => (
                                <SelectItem key={col.id} value={col.title}>
                                  {col.title} {col.primary ? '(Primary)' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={mapping.smartsheetColumn}
                            onChange={(e) => updateColumnMapping(index, 'smartsheetColumn', e.target.value)}
                            placeholder="Column name in Smartsheet"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>App Field</Label>
                        <div className="flex gap-2">
                          <select
                            value={mapping.appField}
                            onChange={(e) => updateColumnMapping(index, 'appField', e.target.value)}
                            className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          >
                            <option value="">Select field</option>
                            {appFields.map(field => (
                              <option key={field.value} value={field.value}>
                                {field.label}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => removeColumnMapping(index)}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <p className="font-medium mb-1">V1 Workflow:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Deliveries with "Done" checked will be hidden from the app</li>
                      <li>Only deliveries with Status: Arrived, Dropped, or Unloaded will be shown</li>
                      <li>App will write back Status and Door when editing deliveries (Reference # and 3PL Transaction # coming later)</li>
                      <li><strong>Note:</strong> PO # and Container # have been merged into a single "PO/Container #" field</li>
                      <li><strong>Important:</strong> After updating mappings, click "Save Mappings" to persist changes</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Extensiv Tab */}
        <TabsContent value="extensiv">
          <Card>
            <CardHeader>
              <CardTitle>Extensiv 3PL Warehouse Manager</CardTitle>
              <CardDescription>
                Configure your Extensiv API credentials. These are used to sync items and manage inventory.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Credentials Status Alert */}
              {extensivCredentialsLoaded ? (
                <Alert className="border-green-500 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <p className="font-semibold">✅ Credentials Saved on Server</p>
                    <p className="text-sm mt-1">
                      Your Extensiv credentials are stored on the Railway backend and will persist across all reloads and redeployments.
                    </p>
                    <p className="text-xs mt-2 text-green-700">
                      💡 The input fields show your current credentials. You can update them and click "Save Credentials" to store changes.
                    </p>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-red-500 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <p className="font-semibold">❌ Extensiv Not Configured</p>
                    <p className="text-sm mt-1">
                      Please enter your Extensiv credentials below, then click "Save Credentials" to store them on the server.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  value={extensivConfig.clientId}
                  onChange={(e) =>
                    setExtensivConfig({ ...extensivConfig, clientId: e.target.value })
                  }
                  placeholder="Enter your Extensiv Client ID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientSecret">Client Secret</Label>
                <Input
                  id="clientSecret"
                  type="password"
                  value={extensivConfig.clientSecret}
                  onChange={(e) =>
                    setExtensivConfig({ ...extensivConfig, clientSecret: e.target.value })
                  }
                  placeholder="Enter your Extensiv Client Secret"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="userLoginId">User Login ID</Label>
                <Input
                  id="userLoginId"
                  value={extensivConfig.userLoginId}
                  onChange={(e) =>
                    setExtensivConfig({ ...extensivConfig, userLoginId: e.target.value })
                  }
                  placeholder="Enter your Extensiv User Login ID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="facilityId">Facility ID</Label>
                <Input
                  id="facilityId"
                  value={extensivConfig.facilityId}
                  onChange={(e) =>
                    setExtensivConfig({ ...extensivConfig, facilityId: e.target.value })
                  }
                  placeholder="Enter your Extensiv Facility ID"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="saveCredentials"
                  checked={saveCredentials}
                  onChange={(e) => setSaveCredentials(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="saveCredentials" className="cursor-pointer">
                  Save credentials securely to backend server (encrypted storage)
                </Label>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleExtensivSave}>
                  {extensivCredentialsLoaded ? 'Update Credentials' : 'Save Credentials'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={
                    testResult.status === 'testing' ||
                    !extensivConfig.clientId ||
                    !extensivConfig.clientSecret ||
                    !extensivConfig.userLoginId
                  }
                >
                  {testResult.status === 'testing' ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>

              {testResult.status === 'success' && (
                <Alert className="border-green-500 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    {testResult.message}
                  </AlertDescription>
                </Alert>
              )}

              {testResult.status === 'error' && (
                <Alert className="border-red-500 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="text-red-800 font-semibold">{testResult.message}</p>
                      {testResult.diagnostics && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-red-700">Error Details:</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyDiagnostics(testResult.diagnostics)}
                              className="h-7"
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy Error Log
                            </Button>
                          </div>
                          <pre className="text-xs bg-red-100 p-3 rounded overflow-auto max-h-60 text-red-900">
                            {JSON.stringify(testResult.diagnostics, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Item Database Tab */}
        <TabsContent value="itemdb">
          <Card>
            <CardHeader>
              <CardTitle>Item Database</CardTitle>
              <CardDescription>View and manage items synced from Extensiv</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-medium">Last Sync</p>
                    <p className="text-xs text-muted-foreground">
                      {lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Never'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customerFilter" className="text-xs">Filter by Customer</Label>
                    <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                      <SelectTrigger id="customerFilter" className="w-[200px]">
                        <SelectValue placeholder="All Customers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Customers</SelectItem>
                        {customers.map(customer => (
                          <SelectItem key={customer.id} value={customer.thirdPartyLogisticsId}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleSyncItems} disabled={isSyncing}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync from Extensiv'}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="itemSearch">Search Items</Label>
                <Input
                  id="itemSearch"
                  placeholder="Search by item number, description, or customer ID..."
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                />
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Number</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Customer ID</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          {extensivItems.length === 0 
                            ? 'No items synced yet. Click "Sync from Extensiv" to load items.'
                            : 'No items match your search criteria.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.itemNumber}</TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{item.customerId}</TableCell>
                          <TableCell>{item.uom}</TableCell>
                          <TableCell>{item.category}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(item.lastUpdated).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="text-sm text-muted-foreground">
                Showing {filteredItems.length} of {extensivItems.length} items
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">Sync Settings</h3>
                
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="autoSync"
                      checked={itemDbConfig.autoSync}
                      onChange={(e) =>
                        setItemDbConfig({ ...itemDbConfig, autoSync: e.target.checked })
                      }
                      className="h-4 w-4"
                    />
                    <Label htmlFor="autoSync" className="cursor-pointer">
                      Enable automatic synchronization with Extensiv
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="syncInterval">Sync Interval (minutes)</Label>
                    <Input
                      id="syncInterval"
                      type="number"
                      min="5"
                      max="1440"
                      value={itemDbConfig.syncInterval}
                      onChange={(e) =>
                        setItemDbConfig({ ...itemDbConfig, syncInterval: parseInt(e.target.value) || 60 })
                      }
                      disabled={!itemDbConfig.autoSync}
                    />
                    <p className="text-sm text-muted-foreground">
                      How often to sync items from Extensiv (5-1440 minutes)
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="syncOnStartup"
                      checked={itemDbConfig.syncOnStartup}
                      onChange={(e) =>
                        setItemDbConfig({ ...itemDbConfig, syncOnStartup: e.target.checked })
                      }
                      className="h-4 w-4"
                    />
                    <Label htmlFor="syncOnStartup" className="cursor-pointer">
                      Sync items automatically on application startup
                    </Label>
                  </div>
                </div>

                <Button onClick={handleItemDbSave}>Save Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}// cache bust 1771135741
