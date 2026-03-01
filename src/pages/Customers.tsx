import { useState, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Plus, Edit, Trash2, Upload, Download, Search, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Customer } from '@/types';
import * as XLSX from 'xlsx';

export default function Customers() {
  const { customers = [], addCustomer, updateCustomer, deleteCustomer, loadCustomersFromBackend } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Form state - all fields except name and 3PL ID are optional
  const [formData, setFormData] = useState({
    name: '',
    thirdPartyLogisticsId: '',
    referencePrefix: '',
    referenceCounter: 0,
    emails: ['', '', '', '', '', '', '', ''], // 8 optional email fields
  });

  // Load customers from backend when component mounts (redundant but safe)
  useEffect(() => {
    loadCustomersFromBackend();
  }, []);

  const handleOpenDialog = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      // Ensure we have exactly 8 email slots
      const emails = [...(customer.emails || [])];
      while (emails.length < 8) emails.push('');
      setFormData({
        name: customer.name,
        thirdPartyLogisticsId: customer.thirdPartyLogisticsId,
        referencePrefix: customer.referencePrefix || '',
        referenceCounter: customer.referenceCounter || 0,
        emails,
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: '',
        thirdPartyLogisticsId: '',
        referencePrefix: '',
        referenceCounter: 0,
        emails: ['', '', '', '', '', '', '', ''],
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCustomer(null);
    setFormData({
      name: '',
      thirdPartyLogisticsId: '',
      referencePrefix: '',
      referenceCounter: 0,
      emails: ['', '', '', '', '', '', '', ''],
    });
  };

  const handleSubmit = () => {
    // Validation - ONLY name and 3PL ID are required
    if (!formData.name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (!formData.thirdPartyLogisticsId.trim()) {
      toast.error('3PL ID is required');
      return;
    }

    // Check for duplicate 3PL ID
    const duplicate = customers.find(
      (c) => c.thirdPartyLogisticsId === formData.thirdPartyLogisticsId && c.id !== editingCustomer?.id
    );
    if (duplicate) {
      toast.error('A customer with this 3PL ID already exists');
      return;
    }

    // Filter out empty emails and validate non-empty ones
    const validEmails = formData.emails.filter(email => email.trim() !== '');
    
    // Validate email format for non-empty emails only
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of validEmails) {
      if (!emailRegex.test(email)) {
        toast.error(`Invalid email address: ${email}`);
        return;
      }
    }

    if (editingCustomer) {
      // Update existing customer
      updateCustomer(editingCustomer.id, {
        name: formData.name,
        thirdPartyLogisticsId: formData.thirdPartyLogisticsId,
        referencePrefix: formData.referencePrefix.trim() || undefined,
        referenceCounter: formData.referenceCounter || undefined,
        emails: validEmails.length > 0 ? validEmails : [],
        updatedAt: new Date().toISOString(),
      });
      toast.success('Customer updated successfully');
    } else {
      // Add new customer
      const newCustomer: Customer = {
        id: `CUST-${Date.now()}`,
        name: formData.name,
        thirdPartyLogisticsId: formData.thirdPartyLogisticsId,
        referencePrefix: formData.referencePrefix.trim() || '',
        referenceCounter: formData.referenceCounter || 0,
        emails: validEmails,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addCustomer(newCustomer);
      toast.success('Customer added successfully');
    }

    handleCloseDialog();
  };

  const handleDelete = () => {
    if (!selectedCustomer) return;

    deleteCustomer(selectedCustomer.id);
    toast.success('Customer deleted successfully');
    setDeleteDialogOpen(false);
    setSelectedCustomer(null);
  };

  const handleExportToExcel = () => {
    if (customers.length === 0) {
      toast.error('No customers to export');
      return;
    }

    const exportData = customers.map((customer) => ({
      'Customer Name': customer.name,
      '3PL ID': customer.thirdPartyLogisticsId,
      'Reference Prefix': customer.referencePrefix || '',
      'Reference Counter': customer.referenceCounter || '',
      'Email 1': customer.emails?.[0] || '',
      'Email 2': customer.emails?.[1] || '',
      'Email 3': customer.emails?.[2] || '',
      'Email 4': customer.emails?.[3] || '',
      'Email 5': customer.emails?.[4] || '',
      'Email 6': customer.emails?.[5] || '',
      'Email 7': customer.emails?.[6] || '',
      'Email 8': customer.emails?.[7] || '',
      'Created Date': new Date(customer.createdAt).toLocaleDateString(),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');

    // Auto-size columns
    ws['!cols'] = [
      { wch: 25 }, // Customer Name
      { wch: 10 }, // 3PL ID
      { wch: 18 }, // Reference Prefix
      { wch: 18 }, // Reference Counter
      { wch: 30 }, // Email 1
      { wch: 30 }, // Email 2
      { wch: 30 }, // Email 3
      { wch: 30 }, // Email 4
      { wch: 30 }, // Email 5
      { wch: 30 }, // Email 6
      { wch: 30 }, // Email 7
      { wch: 30 }, // Email 8
      { wch: 15 }, // Created Date
    ];

    XLSX.writeFile(wb, `customers_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Customer list exported successfully');
  };

  const handleImportFromExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<Record<string, string | number>>;

        let imported = 0;
        let skipped = 0;

        jsonData.forEach((row) => {
          // ONLY Customer Name and 3PL ID are required
          const name = (row['Customer Name'] || row['customer name'])?.toString().trim();
          const thirdPartyLogisticsId = (row['3PL ID'] || row['3pl id'])?.toString().trim();

          // Optional fields
          const referencePrefix = (row['Reference Prefix'] || row['reference prefix'])?.toString().trim() || '';
          const referenceCounter = parseInt((row['Reference Counter'] || row['reference counter'])?.toString() || '0') || 0;

          // Collect all emails from columns E-L (Email 1 through Email 8) - all optional
          const emails = [
            row['Email 1'] || row['email 1'],
            row['Email 2'] || row['email 2'],
            row['Email 3'] || row['email 3'],
            row['Email 4'] || row['email 4'],
            row['Email 5'] || row['email 5'],
            row['Email 6'] || row['email 6'],
            row['Email 7'] || row['email 7'],
            row['Email 8'] || row['email 8'],
          ]
            .map(email => email?.toString().trim())
            .filter(email => email && email !== 'NaN' && email.length > 0);

          // Validation - ONLY name and 3PL ID required
          if (!name || !thirdPartyLogisticsId) {
            console.warn('Skipping row - missing required fields (Name or 3PL ID):', { 
              name, 
              thirdPartyLogisticsId,
              row 
            });
            skipped++;
            return;
          }

          // Check for duplicate 3PL ID
          const duplicate = customers.find((c) => c.thirdPartyLogisticsId === thirdPartyLogisticsId);
          if (duplicate) {
            console.warn('Skipping row - duplicate 3PL ID:', thirdPartyLogisticsId);
            skipped++;
            return;
          }

          // Email validation - only validate non-empty emails
          if (emails.length > 0) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const invalidEmail = emails.find(email => !emailRegex.test(email));
            if (invalidEmail) {
              console.warn(`Skipping row with invalid email: ${invalidEmail}`);
              skipped++;
              return;
            }
          }

          const newCustomer: Customer = {
            id: `CUST-${Date.now()}-${imported}`,
            name,
            thirdPartyLogisticsId,
            referencePrefix,
            referenceCounter,
            emails,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          addCustomer(newCustomer);
          imported++;
        });

        if (imported > 0) {
          toast.success(`Successfully imported ${imported} customer${imported > 1 ? 's' : ''}`);
        }
        if (skipped > 0) {
          toast.warning(`Skipped ${skipped} row${skipped > 1 ? 's' : ''} (duplicate or invalid data)`);
        }
        if (imported === 0 && skipped === 0) {
          toast.error('No valid data found in the file');
        }
      } catch (error) {
        toast.error('Failed to import Excel file. Please check the format.');
        console.error('Import error:', error);
      }
    };

    reader.readAsArrayBuffer(file);
    event.target.value = ''; // Reset input
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Customer Name': 'A & S Collection',
        '3PL ID': '208',
        'Reference Prefix': 'Asco',
        'Reference Counter': 1004,
        'Email 1': 'clikclak53@gmail.com',
        'Email 2': '',
        'Email 3': '',
        'Email 4': '',
        'Email 5': '',
        'Email 6': '',
        'Email 7': '',
        'Email 8': '',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');

    ws['!cols'] = [
      { wch: 25 },
      { wch: 10 },
      { wch: 18 },
      { wch: 18 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
    ];

    XLSX.writeFile(wb, 'customer_import_template.xlsx');
    toast.success('Template downloaded successfully');
  };

  // Filter customers based on search query
  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.thirdPartyLogisticsId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (customer.referencePrefix && customer.referencePrefix.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (customer.emails && customer.emails.some(email => email.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
          <p className="text-gray-600 mt-1">Manage customer information and 3PL IDs</p>
        </div>
        <Users className="h-12 w-12 text-gray-400" />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Customer
        </Button>
        <Button onClick={handleExportToExcel} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export to Excel
        </Button>
        <Button onClick={handleDownloadTemplate} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Download Template
        </Button>
        <label htmlFor="excel-upload">
          <Button variant="outline" className="gap-2" asChild>
            <span>
              <Upload className="h-4 w-4" />
              Import from Excel
            </span>
          </Button>
          <input
            id="excel-upload"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportFromExcel}
            className="hidden"
          />
        </label>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by customer name, 3PL ID, reference, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customer List */}
      <Card>
        <CardHeader>
          <CardTitle>Customer List ({filteredCustomers.length})</CardTitle>
          <CardDescription>View and manage all customer records</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? 'No customers found' : 'No customers yet'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchQuery
                  ? 'Try adjusting your search criteria'
                  : 'Add your first customer or import from Excel to get started'}
              </p>
              {!searchQuery && (
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => handleOpenDialog()} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Customer
                  </Button>
                  <label htmlFor="excel-upload-empty">
                    <Button variant="outline" className="gap-2" asChild>
                      <span>
                        <Upload className="h-4 w-4" />
                        Import Excel
                      </span>
                    </Button>
                    <input
                      id="excel-upload-empty"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleImportFromExcel}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>3PL ID</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Emails</TableHead>
                    <TableHead>Created Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>
                        <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                          {customer.thirdPartyLogisticsId}
                        </span>
                      </TableCell>
                      <TableCell>
                        {customer.referencePrefix ? (
                          <div className="space-y-0.5">
                            <span className="font-mono text-sm font-medium">
                              {customer.referencePrefix}{customer.referenceCounter || 0}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              Next: {customer.referencePrefix}{(customer.referenceCounter || 0) + 1}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">Not configured</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {customer.emails && customer.emails.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-gray-400" />
                            <span className="text-sm">{customer.emails.length} email{customer.emails.length > 1 ? 's' : ''}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>{new Date(customer.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button onClick={() => handleOpenDialog(customer)} size="sm" variant="outline" className="gap-1">
                            <Edit className="h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setDeleteDialogOpen(true);
                            }}
                            size="sm"
                            variant="destructive"
                            className="gap-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
            <DialogDescription>
              {editingCustomer 
                ? 'Update customer information below. Only Customer Name and 3PL ID are required.' 
                : 'Enter customer information below. Only Customer Name and 3PL ID are required - all other fields are optional.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name" className="flex items-center gap-2">
                  <span>Customer Name <span className="text-red-500">*</span></span>
                  <span className="text-xs text-muted-foreground font-mono">(Col A)</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter customer name"
                />
              </div>

              <div>
                <Label htmlFor="thirdPartyLogisticsId" className="flex items-center gap-2">
                  <span>3PL ID <span className="text-red-500">*</span></span>
                  <span className="text-xs text-muted-foreground font-mono">(Col B)</span>
                </Label>
                <Input
                  id="thirdPartyLogisticsId"
                  value={formData.thirdPartyLogisticsId}
                  onChange={(e) => setFormData({ ...formData, thirdPartyLogisticsId: e.target.value })}
                  placeholder="e.g., 208"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="referencePrefix" className="flex items-center gap-2">
                  <span>Reference Prefix</span>
                  <span className="text-xs text-muted-foreground">(Optional)</span>
                  <span className="text-xs text-muted-foreground font-mono">(Col C)</span>
                </Label>
                <Input
                  id="referencePrefix"
                  value={formData.referencePrefix}
                  onChange={(e) => setFormData({ ...formData, referencePrefix: e.target.value })}
                  placeholder="e.g., Asco"
                  className="font-mono"
                />
              </div>

              <div>
                <Label htmlFor="referenceCounter" className="flex items-center gap-2">
                  <span>Reference Counter</span>
                  <span className="text-xs text-muted-foreground">(Optional)</span>
                  <span className="text-xs text-muted-foreground font-mono">(Col D)</span>
                </Label>
                <Input
                  id="referenceCounter"
                  type="number"
                  value={formData.referenceCounter}
                  onChange={(e) => setFormData({ ...formData, referenceCounter: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 1004"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Email Addresses
                <span className="text-sm text-gray-500 ml-2">(All optional - Columns E-L)</span>
              </Label>
              {formData.emails.map((email, index) => (
                <div key={index}>
                  <Label htmlFor={`email-${index}`} className="text-xs text-muted-foreground font-mono mb-1 block">
                    Email {index + 1} (Col {String.fromCharCode(69 + index)}) - Optional
                  </Label>
                  <Input
                    id={`email-${index}`}
                    type="email"
                    value={email}
                    onChange={(e) => {
                      const newEmails = [...formData.emails];
                      newEmails[index] = e.target.value;
                      setFormData({ ...formData, emails: newEmails });
                    }}
                    placeholder={`Email ${index + 1} (Optional)`}
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>{editingCustomer ? 'Update' : 'Add'} Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription>Are you sure you want to delete this customer? This action cannot be undone.</DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm font-medium text-red-800 mb-2">Customer Details:</p>
              <div className="text-sm text-red-700 space-y-1">
                <p>Name: {selectedCustomer.name}</p>
                <p>3PL ID: {selectedCustomer.thirdPartyLogisticsId}</p>
                {selectedCustomer.referencePrefix && (
                  <p>Reference: {selectedCustomer.referencePrefix}{selectedCustomer.referenceCounter || 0} (next: {selectedCustomer.referencePrefix}{(selectedCustomer.referenceCounter || 0) + 1})</p>
                )}
                {selectedCustomer.emails && selectedCustomer.emails.length > 0 && (
                  <p>Emails: {selectedCustomer.emails.join(', ')}</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}