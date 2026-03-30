-- ============================================================
-- ScanovaX — Schema V10 Production-Grade Analytics & Tracking
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Definitive Atomic Increment RPC
-- We separate "Total Scans" (global counter) from "Scan Events" (detailed logs).
-- This ensures the number always goes up on every hit, but we don't spam 
-- the log table with rapid refreshes or pre-fetch hits.

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
  -- A. UPDATE TOTAL COUNTS (No de-duplication here, every hit counts)
  -- 1. Global QR master counter
  UPDATE public.qr_codes
  SET scan_count = coalesce(scan_count, 0) + 1
  WHERE id = target_qr_id;

  -- 2. Profile monthly counter (for billing/limits)
  UPDATE public.profiles 
  SET monthly_scan_count = coalesce(monthly_scan_count, 0) + 1 
  WHERE id = (SELECT user_id FROM public.qr_codes WHERE id = target_qr_id);

  -- B. LOG DETAILED EVENT (De-duplication layer for Unique/Geo Tracking)
  -- We only record a fresh event row if the same user hasn't scanned 
  -- this QR in the last 10 seconds. This keeps "Unique Scans" and "Maps" accurate.
  IF NOT EXISTS (
    SELECT 1 FROM public.scan_events 
    WHERE qr_code_id = target_qr_id 
    AND public.scan_events.user_identifier = increment_scan.user_identifier 
    AND scanned_at > now() - interval '10 seconds'
  ) THEN
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
  END IF;
END;
$$;

-- 2. Maintenance: Ensure scan_events table is fully structured for V10
ALTER TABLE public.scan_events ADD COLUMN IF NOT EXISTS ip_address TEXT DEFAULT 'Unknown';
ALTER TABLE public.scan_events ADD COLUMN IF NOT EXISTS user_identifier TEXT DEFAULT 'Anonymous';
ALTER TABLE public.scan_events ADD COLUMN IF NOT EXISTS device_type TEXT DEFAULT 'desktop';

-- 3. Security: Explicit RLS policies (The data owner must see their own data)
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own QR scan events" ON public.scan_events;
CREATE POLICY "Users can view their own QR scan events" ON public.scan_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.qr_codes 
      WHERE public.qr_codes.id = public.scan_events.qr_code_id 
      AND public.qr_codes.user_id = auth.uid()
    )
  );
