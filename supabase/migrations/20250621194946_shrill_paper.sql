/*
  # Add bulk upsert RPC function for KasPunk ownership

  1. New Function
    - `upsert_kaspunk_ownership` - Bulk upsert function that accepts an array of records
    - Performs INSERT ... ON CONFLICT (token_id) DO UPDATE for all records in a single operation
    - Returns the number of records processed

  2. Security
    - Function uses SECURITY DEFINER to run with elevated privileges
    - Only accessible to authenticated users with proper permissions
*/

-- Create the bulk upsert function for KasPunk ownership
CREATE OR REPLACE FUNCTION public.upsert_kaspunk_ownership(records JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  record_count INTEGER := 0;
  record_item JSONB;
BEGIN
  -- Validate input
  IF records IS NULL OR jsonb_array_length(records) = 0 THEN
    RETURN 0;
  END IF;

  -- Process each record in the array
  FOR record_item IN SELECT * FROM jsonb_array_elements(records)
  LOOP
    -- Validate required fields
    IF NOT (record_item ? 'token_id' AND record_item ? 'wallet_address') THEN
      CONTINUE; -- Skip invalid records
    END IF;

    -- Perform upsert for this record
    INSERT INTO public.kaspunk_token_ownership (
      token_id,
      wallet_address,
      created_at,
      updated_at
    )
    VALUES (
      (record_item->>'token_id')::INTEGER,
      record_item->>'wallet_address',
      COALESCE((record_item->>'created_at')::TIMESTAMPTZ, NOW()),
      COALESCE((record_item->>'updated_at')::TIMESTAMPTZ, NOW())
    )
    ON CONFLICT (token_id) 
    DO UPDATE SET
      wallet_address = EXCLUDED.wallet_address,
      updated_at = EXCLUDED.updated_at;

    record_count := record_count + 1;
  END LOOP;

  RETURN record_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.upsert_kaspunk_ownership(JSONB) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.upsert_kaspunk_ownership(JSONB) IS 
'Bulk upsert function for KasPunk token ownership. Accepts an array of JSON objects with token_id and wallet_address fields. Returns the number of records processed.';