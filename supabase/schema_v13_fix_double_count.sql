-- ============================================================
-- ScanovaX — Schema V13: Fix Double-Counting
-- ============================================================
-- PROBLEM: scan_count increments by 2 for each scan because:
--   1. increment_scan RPC does UPDATE scan_count + 1
--   2. An old trigger on scan_events ALSO does UPDATE scan_count + 1
-- FIX: Drop ALL triggers on scan_events table.
-- ============================================================

-- Drop every known trigger name from past migrations
DROP TRIGGER IF EXISTS on_scan_event_recorded ON public.scan_events;
DROP TRIGGER IF EXISTS increment_scan_count_trigger ON public.scan_events;
DROP TRIGGER IF EXISTS sync_scan_count_trigger ON public.scan_events;
DROP TRIGGER IF EXISTS update_qr_scan_count ON public.scan_events;

-- Also drop any trigger functions that may have been created for this purpose
DROP FUNCTION IF EXISTS public.on_scan_event_recorded() CASCADE;
DROP FUNCTION IF EXISTS public.increment_scan_count() CASCADE;
DROP FUNCTION IF EXISTS public.sync_scan_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_qr_scan_count() CASCADE;

-- Reset the scan_count to match actual scan_events rows
-- This corrects the inflated counts from double-counting
UPDATE public.qr_codes 
SET scan_count = (
  SELECT COUNT(*) 
  FROM public.scan_events 
  WHERE scan_events.qr_code_id = qr_codes.id
);

-- Done! After running this:
-- scan_count will match the actual number of scan_events rows
-- Future scans will only increment by 1 (no more trigger doubling)
