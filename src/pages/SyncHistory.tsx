import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { History, CheckCircle, XCircle, Filter, Search, RefreshCw, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SyncHistory() {
  const { syncLogs = [], clearSyncLogs } = useData();
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');

  // Filter and search logs
  const filteredLogs = useMemo(() => {
    let filtered = [...syncLogs];

    // Filter by source
    if (sourceFilter !== 'all') {
      filtered = filtered.filter((log) => log.source === sourceFilter);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((log) => log.status === statusFilter);
    }

    // Filter by date
    if (dateFilter !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();

      switch (dateFilter) {
        case 'today':
          cutoffDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
      }

      filtered = filtered.filter((log) => new Date(log.timestamp) >= cutoffDate);
    }

    // Search in action and details
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.action.toLowerCase().includes(query) ||
          log.details.toLowerCase().includes(query)
      );
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return filtered;
  }, [syncLogs, sourceFilter, statusFilter, searchQuery, dateFilter]);

  const handleClearLogs = () => {
    if (confirm('Are you sure you want to clear all sync logs? This action cannot be undone.')) {
      clearSyncLogs();
      toast.success('Sync logs cleared successfully');
    }
  };

  const handleExportLogs = () => {
    const csv = [
      ['Timestamp', 'Source', 'Action', 'Status', 'Details'].join(','),
      ...filteredLogs.map((log) =>
        [
          new Date(log.timestamp).toLocaleString(),
          log.source,
          log.action,
          log.status,
          `"${log.details.replace(/"/g, '""')}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sync-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Sync logs exported successfully');
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'smartsheet':
        return 'bg-blue-100 text-blue-800';
      case 'extensiv':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      fetch_deliveries: 'Fetch Deliveries',
      update_status: 'Update Status',
      add_delivery: 'Add Delivery',
      sync_items: 'Sync Items',
      send_receiving: 'Send Receiving',
    };
    return labels[action] || action;
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const total = syncLogs.length;
    const successful = syncLogs.filter((log) => log.status === 'success').length;
    const failed = syncLogs.filter((log) => log.status === 'error').length;
    const smartsheetOps = syncLogs.filter((log) => log.source === 'smartsheet').length;
    const extensivOps = syncLogs.filter((log) => log.source === 'extensiv').length;

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? ((successful / total) * 100).toFixed(1) : '0',
      smartsheetOps,
      extensivOps,
    };
  }, [syncLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Sync History</h1>
        <p className="text-gray-600 mt-1">View and manage all API synchronization operations</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Operations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Successful</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.successful}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">By Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Smartsheet:</span>
                <span className="font-semibold">{stats.smartsheetOps}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Extensiv:</span>
                <span className="font-semibold">{stats.extensivOps}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Sync Logs
              </CardTitle>
              <CardDescription>All synchronization operations and their results</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleExportLogs} variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button onClick={handleClearLogs} variant="outline" size="sm" className="gap-2">
                <Trash2 className="h-4 w-4" />
                Clear Logs
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search action or details..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Source</label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="smartsheet">Smartsheet</SelectItem>
                  <SelectItem value="extensiv">Extensiv</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Time Period</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results Summary */}
          {(sourceFilter !== 'all' || statusFilter !== 'all' || searchQuery || dateFilter !== 'all') && (
            <Alert className="mb-4">
              <AlertDescription>
                Showing {filteredLogs.length} of {syncLogs.length} sync operations
                {sourceFilter !== 'all' && ` • Source: ${sourceFilter}`}
                {statusFilter !== 'all' && ` • Status: ${statusFilter}`}
                {dateFilter !== 'all' && ` • Period: ${dateFilter}`}
                {searchQuery && ` • Search: "${searchQuery}"`}
              </AlertDescription>
            </Alert>
          )}

          {/* Logs Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      {syncLogs.length === 0 ? (
                        <div className="space-y-2">
                          <History className="h-12 w-12 mx-auto text-gray-300" />
                          <p>No sync operations yet</p>
                          <p className="text-sm">Sync operations will appear here after you sync data from Smartsheet or Extensiv</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Filter className="h-12 w-12 mx-auto text-gray-300" />
                          <p>No sync operations match your filters</p>
                          <p className="text-sm">Try adjusting your search or filter criteria</p>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={getSourceBadgeColor(log.source)}>
                          {log.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {getActionLabel(log.action)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(log.status)}>
                          {log.status === 'success' ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="text-sm text-gray-600 truncate" title={log.details}>
                          {log.details}
                        </div>
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