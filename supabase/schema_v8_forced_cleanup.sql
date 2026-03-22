-- ============================================================
-- FORCED CLEANUP: PURGE ALL POTENTIAL DOUBLE-COUNTING TRIGGERS
-- ============================================================

-- 1. Identify and DROP any triggers that might be firing on scan_events
-- We drop by name if known, but also provide a way to drop ALL if needed.
DROP TRIGGER IF EXISTS on_scan_event_recorded ON public.scan_events;
DROP TRIGGER IF EXISTS increment_scan_count_trigger ON public.scan_events;
DROP TRIGGER IF EXISTS sync_scan_count_trigger ON public.scan_events;
DROP TRIGGER IF EXISTS update_qr_scan_count ON public.scan_events;

-- 2. Add scanned_minute column and unique constraint to prevent duplicate scan events
-- This prevents the same user from scanning the same QR code multiple times within a minute
ALTER TABLE public.scan_events 
ADD COLUMN IF NOT EXISTS scanned_minute timestamptz;

-- Create unique index on the computed minute
CREATE UNIQUE INDEX IF NOT EXISTS unique_scan_event_idx 
ON public.scan_events (qr_code_id, user_identifier, scanned_minute);

-- (If the above fails because of existing duplicates, run this cleanup first:
-- DELETE FROM public.scan_events 
-- WHERE id NOT IN (
--   SELECT MIN(id) 
--   FROM public.scan_events 
--   GROUP BY qr_code_id, user_identifier, date_trunc('minute', scanned_at)
-- );
-- Then re-run the ALTER TABLE and CREATE UNIQUE INDEX.)

-- 3. Re-create the DEFINITIVE increment_scan function (v3.4)
-- This function prevents double-counting by using exception handling with unique index
CREATE OR REPLACE FUNCTION public.increment_scan(
  target_qr_id uuid,
  scanner_email text DEFAULT NULL,
  device_type text DEFAULT 'desktop',
  country text DEFAULT 'Unknown',
  state text DEFAULT 'Unknown',
  city text DEFAULT 'Unknown',
  ip_address text DEFAULT 'Unknown',
  user_identifier text DEFAULT 'Anonymous'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_id uuid;
BEGIN
  -- A. Attempt to insert the scan event
  -- If it fails due to unique constraint, the exception will be caught
  BEGIN
    INSERT INTO public.scan_events (
      qr_code_id,
      scanner_email,
      device_type,
      country,
      state,
      city,
      ip_address,
      user_identifier,
      scanned_at,
      scanned_minute
    )
    VALUES (
      target_qr_id,
      scanner_email,
      device_type,
      country,
      state,
      city,
      ip_address,
      user_identifier,
      now(),
      date_trunc('minute', now())
    )
    RETURNING id INTO inserted_id;

    -- B. Only increment counts if the insert succeeded
    IF inserted_id IS NOT NULL THEN
      -- Increment QR code total scans
      UPDATE public.qr_codes
      SET scan_count = coalesce(scan_count, 0) + 1
      WHERE id = target_qr_id;

      -- Update profile monthly scan count
      UPDATE public.profiles
      SET monthly_scan_count = coalesce(monthly_scan_count, 0) + 1
      WHERE id = (SELECT user_id FROM public.qr_codes WHERE id = target_qr_id);
    END IF;

  EXCEPTION
    WHEN unique_violation THEN
      -- Duplicate scan detected, do nothing (don't increment counts)
      RETURN;
  END;

END;
$$;

-- 4. Final verification: Ensure we don't have any generic triggers left on scan_events
-- that might call any function starting with 'sync' or 'increment'
-- (This part requires manual check if the above doesn't work)
