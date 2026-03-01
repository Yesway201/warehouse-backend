import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Plus, Edit, Trash2, Upload, Download, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Customer } from '@/types';
import * as XLSX from 'xlsx';

export default function CustomerManagement() {
  const { customers = [], addCustomer, updateCustomer, deleteCustomer } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Form state with support for up to 8 emails
  const [formData, setFormData] = useState({
    name: '',
    thirdPartyLogisticsId: '',
    emails: [''] as string[],
    referencePrefix: '',
    referenceCounter: 1,
  });

  const handleOpenDialog = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        thirdPartyLogisticsId: customer.thirdPartyLogisticsId,
        emails: customer.emails.length > 0 ? customer.emails : [''],
        referencePrefix: customer.referencePrefix || '',
        referenceCounter: customer.referenceCounter || 1,
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: '',
        thirdPartyLogisticsId: '',
        emails: [''],
        referencePrefix: '',
        referenceCounter: 1,
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
      emails: [''],
      referencePrefix: '',
      referenceCounter: 1,
    });
  };

  const handleAddEmail = () => {
    if (formData.emails.length < 8) {
      setFormData({ ...formData, emails: [...formData.emails, ''] });
    } else {
      toast.error('Maximum 8 email addresses allowed');
    }
  };

  const handleRemoveEmail = (index: number) => {
    if (formData.emails.length > 1) {
      const newEmails = formData.emails.filter((_, i) => i !== index);
      setFormData({ ...formData, emails: newEmails });
    }
  };

  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...formData.emails];
    newEmails[index] = value;
    setFormData({ ...formData, emails: newEmails });
  };

  const handleSubmit = () => {
    // Validation
    if (!formData.name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (!formData.thirdPartyLogisticsId.trim()) {
      toast.error('3PL ID is required');
      return;
    }
    if (!formData.referencePrefix.trim()) {
      toast.error('Reference prefix is required');
      return;
    }
    if (formData.referenceCounter < 1 || formData.referenceCounter > 9999) {
      toast.error('Reference counter must be between 1 and 9999');
      return;
    }

    // Filter out empty emails and validate
    const validEmails = formData.emails.filter((email) => email.trim() !== '');
    if (validEmails.length === 0) {
      toast.error('At least one email address is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of validEmails) {
      if (!emailRegex.test(email)) {
        toast.error(`Invalid email address: ${email}`);
        return;
      }
    }

    // Check for duplicate 3PL ID
    const duplicate = customers.find(
      (c) => c.thirdPartyLogisticsId === formData.thirdPartyLogisticsId && c.id !== editingCustomer?.id
    );
    if (duplicate) {
      toast.error('A customer with this 3PL ID already exists');
      return;
    }

    if (editingCustomer) {
      // Update existing customer
      updateCustomer(editingCustomer.id, {
        ...formData,
        emails: validEmails,
        updatedAt: new Date().toISOString(),
      });
      toast.success('Customer updated successfully');
    } else {
      // Add new customer
      const newCustomer: Customer = {
        id: `CUST-${Date.now()}`,
        ...formData,
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
      'Reference Prefix': customer.referencePrefix,
      'Reference Counter': customer.referenceCounter,
      'Current Reference': `${customer.referencePrefix}${customer.referenceCounter.toString().padStart(4, '0')}`,
      'Email 1': customer.emails[0] || '',
      'Email 2': customer.emails[1] || '',
      'Email 3': customer.emails[2] || '',
      'Email 4': customer.emails[3] || '',
      'Email 5': customer.emails[4] || '',
      'Email 6': customer.emails[5] || '',
      'Email 7': customer.emails[6] || '',
      'Email 8': customer.emails[7] || '',
      'Created Date': new Date(customer.createdAt).toLocaleDateString(),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');

    ws['!cols'] = [
      { wch: 25 }, // Customer Name
      { wch: 15 }, // 3PL ID
      { wch: 15 }, // Reference Prefix
      { wch: 15 }, // Reference Counter
      { wch: 18 }, // Current Reference
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

    console.log('[Import] Starting import for file:', file.name, 'Type:', file.type, 'Size:', file.size);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        console.log('[Import] Workbook loaded. Sheet names:', workbook.SheetNames);
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Get all data including headers
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
        console.log('[Import] Raw data (first 3 rows):', rawData.slice(0, 3));
        
        // Get headers from first row
        const headers = rawData[0] as string[];
        console.log('[Import] Detected headers:', headers);
        
        // Parse data with flexible column matching
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<Record<string, unknown>>;
        console.log('[Import] Parsed JSON data:', jsonData.length, 'rows');
        console.log('[Import] First row sample:', jsonData[0]);

        if (jsonData.length === 0) {
          toast.error('Excel file is empty. Please add customer data.');
          return;
        }

        // Flexible column name mapping (case-insensitive, handles variations)
        const findColumn = (row: Record<string, unknown>, patterns: string[]): string | undefined => {
          const keys = Object.keys(row);
          for (const pattern of patterns) {
            const found = keys.find(key => 
              key.toLowerCase().trim() === pattern.toLowerCase().trim() ||
              key.toLowerCase().replace(/[^a-z0-9]/g, '').includes(pattern.toLowerCase().replace(/[^a-z0-9]/g, ''))
            );
            if (found && row[found]) return row[found] as string;
          }
          return undefined;
        };

        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        jsonData.forEach((row, index) => {
          const rowNum = index + 2; // Excel row number (accounting for header)
          
          console.log(`[Import] Processing row ${rowNum}:`, row);
          
          // Flexible column matching
          const name = findColumn(row, ['Customer Name', 'customer name', 'name', 'customer'])?.toString().trim();
          const thirdPartyLogisticsId = findColumn(row, ['3PL ID', '3pl id', 'thirdpartylogisticsid', '3pl', 'tpl id'])?.toString().trim();
          const referencePrefix = findColumn(row, ['Reference Prefix', 'reference prefix', 'prefix', 'ref prefix'])?.toString().trim();
          const referenceCounterRaw = findColumn(row, ['Reference Counter', 'reference counter', 'counter', 'ref counter']);
          const referenceCounter = referenceCounterRaw ? Number(referenceCounterRaw) : 1;

          // Collect all emails with flexible matching
          const emails = [
            findColumn(row, ['Email 1', 'email 1', 'email1', 'primary email', 'email'])?.toString().trim(),
            findColumn(row, ['Email 2', 'email 2', 'email2', 'secondary email'])?.toString().trim(),
            findColumn(row, ['Email 3', 'email 3', 'email3'])?.toString().trim(),
            findColumn(row, ['Email 4', 'email 4', 'email4'])?.toString().trim(),
            findColumn(row, ['Email 5', 'email 5', 'email5'])?.toString().trim(),
            findColumn(row, ['Email 6', 'email 6', 'email6'])?.toString().trim(),
            findColumn(row, ['Email 7', 'email 7', 'email7'])?.toString().trim(),
            findColumn(row, ['Email 8', 'email 8', 'email8'])?.toString().trim(),
          ].filter((email) => email && email !== '') as string[];

          console.log(`[Import] Row ${rowNum} parsed:`, { name, thirdPartyLogisticsId, referencePrefix, referenceCounter, emails });

          // Detailed validation with specific error messages
          if (!name) {
            errors.push(`Row ${rowNum}: Missing Customer Name`);
            skipped++;
            return;
          }
          
          if (!thirdPartyLogisticsId) {
            errors.push(`Row ${rowNum}: Missing 3PL ID`);
            skipped++;
            return;
          }
          
          if (!referencePrefix) {
            errors.push(`Row ${rowNum}: Missing Reference Prefix`);
            skipped++;
            return;
          }
          
          if (emails.length === 0) {
            errors.push(`Row ${rowNum}: At least one email is required`);
            skipped++;
            return;
          }

          // Check for duplicate 3PL ID
          const duplicate = customers.find((c) => c.thirdPartyLogisticsId === thirdPartyLogisticsId);
          if (duplicate) {
            errors.push(`Row ${rowNum}: Duplicate 3PL ID "${thirdPartyLogisticsId}"`);
            skipped++;
            return;
          }

          // Email validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          const invalidEmail = emails.find((email) => !emailRegex.test(email));
          if (invalidEmail) {
            errors.push(`Row ${rowNum}: Invalid email "${invalidEmail}"`);
            skipped++;
            return;
          }

          const newCustomer: Customer = {
            id: `CUST-${Date.now()}-${imported}`,
            name,
            thirdPartyLogisticsId,
            emails,
            referencePrefix,
            referenceCounter,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          console.log(`[Import] Row ${rowNum} valid, adding customer:`, newCustomer);
          addCustomer(newCustomer);
          imported++;
        });

        console.log('[Import] Import complete. Imported:', imported, 'Skipped:', skipped);

        // Show detailed results
        if (imported > 0) {
          toast.success(`✅ Successfully imported ${imported} customer${imported > 1 ? 's' : ''}`);
        }
        
        if (skipped > 0) {
          const errorMessage = errors.slice(0, 5).join('\n');
          const moreErrors = errors.length > 5 ? `\n...and ${errors.length - 5} more errors` : '';
          toast.error(`❌ Skipped ${skipped} row${skipped > 1 ? 's' : ''}:\n${errorMessage}${moreErrors}`, {
            duration: 10000,
          });
        }

        if (imported === 0 && skipped === 0) {
          toast.error('No valid data found in Excel file. Please check the format.');
        }
      } catch (error) {
        console.error('[Import] Error reading file:', error);
        toast.error(`Failed to read Excel file: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure it matches the template format.`);
      }
    };

    reader.onerror = (error) => {
      console.error('[Import] FileReader error:', error);
      toast.error('Failed to read file. Please try again.');
    };

    reader.readAsArrayBuffer(file);
    event.target.value = ''; // Reset input
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Customer Name': 'Example Corp',
        '3PL ID': '3PL-001',
        'Reference Prefix': 'EXM',
        'Reference Counter': 1,
        'Email 1': 'contact@example.com',
        'Email 2': 'backup@example.com',
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
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
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
      customer.referencePrefix.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.emails.some((email) => email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Helper function to format reference number
  const formatReferenceNumber = (prefix: string, counter: number) => {
    return `${prefix}${counter.toString().padStart(4, '0')}`;
  };

  return (
    <div className="space-y-6">
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
              placeholder="Search by customer name, 3PL ID, reference prefix, or email..."
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
                    <TableHead>Current Reference #</TableHead>
                    <TableHead>Email Contacts</TableHead>
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
                        <span className="font-mono text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold">
                          {formatReferenceNumber(customer.referencePrefix, customer.referenceCounter)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          {customer.emails.slice(0, 2).map((email, idx) => (
                            <div key={idx}>{email}</div>
                          ))}
                          {customer.emails.length > 2 && (
                            <div className="text-gray-500 text-xs">+{customer.emails.length - 2} more</div>
                          )}
                        </div>
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
              {editingCustomer ? 'Update customer information below' : 'Enter customer information below'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">
                Customer Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter customer name"
              />
            </div>

            <div>
              <Label htmlFor="thirdPartyLogisticsId">
                3PL ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="thirdPartyLogisticsId"
                value={formData.thirdPartyLogisticsId}
                onChange={(e) => setFormData({ ...formData, thirdPartyLogisticsId: e.target.value })}
                placeholder="e.g., 3PL-001"
                className="font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="referencePrefix">
                  Reference Prefix <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="referencePrefix"
                  value={formData.referencePrefix}
                  onChange={(e) => setFormData({ ...formData, referencePrefix: e.target.value.toUpperCase() })}
                  placeholder="e.g., ABC"
                  className="font-mono uppercase"
                  maxLength={10}
                />
                <p className="text-xs text-gray-500 mt-1">Letters for receipt reference numbers</p>
              </div>

              <div>
                <Label htmlFor="referenceCounter">
                  Starting Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="referenceCounter"
                  type="number"
                  min="1"
                  max="9999"
                  value={formData.referenceCounter}
                  onChange={(e) => setFormData({ ...formData, referenceCounter: parseInt(e.target.value) || 1 })}
                  placeholder="1"
                  className="font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">Current 4-digit number (1-9999)</p>
              </div>
            </div>

            {formData.referencePrefix && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Current Reference Number:</strong>{' '}
                  <span className="font-mono font-bold">
                    {formatReferenceNumber(formData.referencePrefix, formData.referenceCounter)}
                  </span>
                </p>
              </div>
            )}

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label>
                  Email Contacts <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-500 ml-2">(Up to 8 emails)</span>
                </Label>
                <Button
                  type="button"
                  onClick={handleAddEmail}
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={formData.emails.length >= 8}
                >
                  <Plus className="h-3 w-3" />
                  Add Email
                </Button>
              </div>

              <div className="space-y-3">
                {formData.emails.map((email, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => handleEmailChange(index, e.target.value)}
                        placeholder={`Email ${index + 1}`}
                      />
                    </div>
                    {formData.emails.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => handleRemoveEmail(index)}
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
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
                <p>Reference: {formatReferenceNumber(selectedCustomer.referencePrefix, selectedCustomer.referenceCounter)}</p>
                <p>Emails: {selectedCustomer.emails.join(', ')}</p>
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