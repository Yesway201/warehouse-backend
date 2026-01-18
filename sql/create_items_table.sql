-- Create extensiv_items table for storing item master data
CREATE TABLE IF NOT EXISTS extensiv_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_number TEXT NOT NULL,
  description TEXT NOT NULL,
  uom TEXT NOT NULL,
  category TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  barcode TEXT,
  extensiv_id TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(item_number, customer_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_extensiv_items_customer_id ON extensiv_items(customer_id);
CREATE INDEX IF NOT EXISTS idx_extensiv_items_item_number ON extensiv_items(item_number);
CREATE INDEX IF NOT EXISTS idx_extensiv_items_category ON extensiv_items(category);

-- Create sync_status table to track last sync per customer
CREATE TABLE IF NOT EXISTS extensiv_items_sync_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE,
  last_sync TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  items_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index for sync status
CREATE INDEX IF NOT EXISTS idx_sync_status_customer_id ON extensiv_items_sync_status(customer_id);

-- Enable Row Level Security (RLS)
ALTER TABLE extensiv_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE extensiv_items_sync_status ENABLE ROW LEVEL SECURITY;

-- Create policies for extensiv_items
CREATE POLICY "Allow read all items" ON extensiv_items
  FOR SELECT
  USING (true);

CREATE POLICY "Allow insert items" ON extensiv_items
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update items" ON extensiv_items
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete items" ON extensiv_items
  FOR DELETE
  USING (true);

-- Create policies for sync_status
CREATE POLICY "Allow read sync status" ON extensiv_items_sync_status
  FOR SELECT
  USING (true);

CREATE POLICY "Allow insert sync status" ON extensiv_items_sync_status
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update sync status" ON extensiv_items_sync_status
  FOR UPDATE
  USING (true);