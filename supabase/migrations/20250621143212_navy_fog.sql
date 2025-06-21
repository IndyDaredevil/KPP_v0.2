/*
  # Fix kaspunk_token_ownership unique constraint

  1. Problem
    - Current table has unique constraint on (token_id, wallet_address) combination
    - This prevents updating ownership when a token changes hands
    - Each token should have only one current owner (unique token_id)
    - But wallets can own multiple tokens (non-unique wallet_address)

  2. Solution
    - Drop the existing composite unique constraint
    - Add new unique constraint on token_id only
    - This allows proper upsert behavior for ownership changes

  3. Changes
    - Remove unique_token_ownership constraint
    - Add unique_token_id constraint
    - Maintain existing indexes for performance
*/

-- Drop the existing composite unique constraint that's causing the conflict
ALTER TABLE public.kaspunk_token_ownership
DROP CONSTRAINT IF EXISTS unique_token_ownership;

-- Add a new unique constraint on token_id only
-- This ensures each token has only one current owner
ALTER TABLE public.kaspunk_token_ownership
ADD CONSTRAINT unique_token_id UNIQUE (token_id);

-- Verify the constraint was added correctly
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'kaspunk_token_ownership' 
    AND constraint_name = 'unique_token_id'
    AND constraint_type = 'UNIQUE'
  ) THEN
    RAISE NOTICE 'SUCCESS: unique_token_id constraint added to kaspunk_token_ownership';
  ELSE
    RAISE EXCEPTION 'FAILED: unique_token_id constraint was not added properly';
  END IF;
END $$;