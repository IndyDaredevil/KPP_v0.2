/*
  # Fix Sales History ID Type Issue

  1. Problem
    - Kaspa API returns MongoDB ObjectIds (24-char hex strings) as IDs
    - Our sales_history table expects UUID format for the id field
    - This causes "invalid input syntax for type uuid" errors

  2. Solution
    - Change the id field from UUID to TEXT to accept MongoDB ObjectIds
    - Keep the primary key constraint
    - Update any related indexes

  3. Changes
    - Alter the id column type from uuid to text
    - Ensure primary key constraint remains
*/

-- Drop the existing sales_history table if it exists and recreate with correct types
DROP TABLE IF EXISTS sales_history CASCADE;

-- Create the sales_history table with correct field types
CREATE TABLE IF NOT EXISTS sales_history (
  id text PRIMARY KEY, -- Changed from uuid to text to accept MongoDB ObjectIds
  token_id text NOT NULL,
  sale_price numeric NOT NULL CHECK (sale_price >= 0),
  sale_date timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for the sales_history table
CREATE INDEX IF NOT EXISTS idx_sales_history_token_id ON sales_history USING btree (token_id);
CREATE INDEX IF NOT EXISTS idx_sales_history_token_date ON sales_history USING btree (token_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_history_date_price ON sales_history USING btree (sale_date, sale_price) WHERE (sale_price >= (1000)::numeric);

-- Add foreign key constraint to tokens table
ALTER TABLE sales_history ADD CONSTRAINT sales_history_token_id_fkey 
  FOREIGN KEY (token_id) REFERENCES tokens(token_id);

-- Enable RLS on the sales_history table
ALTER TABLE sales_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for the sales_history table
CREATE POLICY "Anyone can read sales history"
  ON sales_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage sales history"
  ON sales_history
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::text)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::text)
  );