-- ============================================================
-- ScanovaX — Schema V12 Analytics De-Confliction
-- ============================================================

-- 1. DEFENSIVELY REMOVE LEGACY TRIGGERS
-- We suspect old triggers from previous versions are causing double-counting.
-- These commands will drop them if they exist.

DROP TRIGGER IF EXISTS handle_new_scan ON public.scan_events;
DROP TRIGGER IF EXISTS increment_total_scans ON public.scan_events;
DROP TRIGGER IF EXISTS on_scan_event ON public.scan_events;
DROP TRIGGER IF EXISTS sync_qr_counts ON public.scan_events;
DROP TRIGGER IF EXISTS increment_scan_count ON public.scan_events;

-- 2. RE-ESTABLISH HIGH-FIDELITY RPC WITH DEDUPLICATION
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
BEGIN
  -- DEDUPLICATION: Prevent duplicate scans from same user within 5 seconds
  -- This handles React Strict Mode double-effects, double-clicks, client retries, etc.
  IF EXISTS (
    SELECT 1 FROM public.scan_events 
    WHERE qr_code_id = target_qr_id 
    AND user_identifier = increment_scan.user_identifier 
    AND scanned_at > now() - interval '5 seconds'
  ) THEN
    RETURN;
  END IF;

  -- A. UPDATE ATOMIC COUNTERS (only if not a duplicate)
  -- 1. Total Global Counter
  UPDATE public.qr_codes
  SET scan_count = coalesce(scan_count, 0) + 1
  WHERE id = target_qr_id;

  -- 2. Monthly Limit Counter
  UPDATE public.profiles 
  SET monthly_scan_count = coalesce(monthly_scan_count, 0) + 1 
  WHERE id = (SELECT user_id FROM public.qr_codes WHERE id = target_qr_id);

  -- B. LOG AUDIT EVENT
  INSERT INTO public.scan_events (
    qr_code_id,
    scanner_email,
    device_type,
    country,
    state,
    city,
    ip_address,
    user_identifier,
    scanned_at
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
    now()
  );
END;
$$;

-- 3. PERMISSIONS
GRANT EXECUTE ON FUNCTION public.increment_scan TO anon, authenticated;

-- 4. VERIFICATION LOG
DO $$ BEGIN
  RAISE NOTICE 'Analytics De-Confliction Successful: Legacy triggers purged.';
END $$;
