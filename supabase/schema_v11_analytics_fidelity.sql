-- ============================================================
-- ScanovaX — Schema V11 High-Fidelity Analytics & Tracking
-- ============================================================

-- 1. Definitively Atomic Independent Increment RPC
-- This version removes ALL de-duplication to ensure that 
-- Total Scans = All-time global hits
-- Unique Scans = Count of distinct user_identifiers in log
-- Performance: Global scan_count is kept on qr_codes for fast dashboard loading.

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
  -- A. UPDATE TOTAL COUNTS (Always increment, no exceptions)
  -- 1. Master QR Scan Counter
  UPDATE public.qr_codes
  SET scan_count = coalesce(scan_count, 0) + 1
  WHERE id = target_qr_id;

  -- 2. User Profile Monthly Counter
  UPDATE public.profiles 
  SET monthly_scan_count = coalesce(monthly_scan_count, 0) + 1 
  WHERE id = (SELECT user_id FROM public.qr_codes WHERE id = target_qr_id);

  -- B. LOG EVERY SCAN EVENT (Audit Trail)
  -- No IF NOT EXISTS check here. Every hit creates a row.
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
