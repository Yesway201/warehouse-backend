-- Create extensiv_credentials table
CREATE TABLE IF NOT EXISTS extensiv_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  user_login_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_extensiv_credentials_user_id ON extensiv_credentials(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE extensiv_credentials ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own credentials
CREATE POLICY "Users can read own credentials" ON extensiv_credentials
  FOR SELECT
  USING (true);

-- Create policy to allow users to insert their own credentials
CREATE POLICY "Users can insert own credentials" ON extensiv_credentials
  FOR INSERT
  WITH CHECK (true);

-- Create policy to allow users to update their own credentials
CREATE POLICY "Users can update own credentials" ON extensiv_credentials
  FOR UPDATE
  USING (true);

-- Create policy to allow users to delete their own credentials
CREATE POLICY "Users can delete own credentials" ON extensiv_credentials
  FOR DELETE
  USING (true);
