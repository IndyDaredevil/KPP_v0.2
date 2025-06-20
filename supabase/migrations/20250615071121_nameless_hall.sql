/*
  # Fix kaspunk_owners and collection stats tables

  1. New Tables (if not exist)
    - `kaspunk_owners` - Stores wallet addresses and token counts
    - `kaspunk_collection_stats` - Stores collection-wide statistics

  2. Security
    - Enable RLS on both tables
    - Add policies for public read access (with safety checks)
*/

-- Create kaspunk_owners table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.kaspunk_owners (
  wallet_address TEXT PRIMARY KEY,
  token_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on token_count for efficient sorting
CREATE INDEX IF NOT EXISTS idx_kaspunk_owners_token_count ON public.kaspunk_owners (token_count DESC);

-- Enable RLS on kaspunk_owners
ALTER TABLE public.kaspunk_owners ENABLE ROW LEVEL SECURITY;

-- Add public read access policy to kaspunk_owners (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'kaspunk_owners' 
    AND policyname = 'Allow public read access to kaspunk_owners'
  ) THEN
    CREATE POLICY "Allow public read access to kaspunk_owners" 
      ON public.kaspunk_owners
      FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;

-- Create kaspunk_collection_stats table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.kaspunk_collection_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_supply INTEGER NOT NULL,
  total_minted INTEGER NOT NULL,
  total_holders INTEGER NOT NULL,
  average_holding NUMERIC NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on kaspunk_collection_stats
ALTER TABLE public.kaspunk_collection_stats ENABLE ROW LEVEL SECURITY;

-- Add public read access policy to kaspunk_collection_stats (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'kaspunk_collection_stats' 
    AND policyname = 'Allow public read access to kaspunk_collection_stats'
  ) THEN
    CREATE POLICY "Allow public read access to kaspunk_collection_stats" 
      ON public.kaspunk_collection_stats
      FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;