-- ============================================================
-- ScanovaX — Schema V3 Analytics Enhancement
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add scanner_email column to scan_events if it doesn't exist
alter table public.scan_events add column if not exists scanner_email text;

-- 2. Create the increment_scan function for atomic updates
create or replace function public.increment_scan(
  target_qr_id uuid,
  scanner_email text default null,
  device_type text default 'desktop',
  country text default 'Unknown',
  state text default 'Unknown',
  city text default 'Unknown'
)
returns void language plpgsql security definer
as $$
declare
  owner_id uuid;
  current_month text;
begin
  -- 1. Get owner ID from the QR code
  select user_id into owner_id from public.qr_codes where id = target_qr_id;
  
  if owner_id is null then
    return;
  end if;

  -- 2. Increment QR code total scans
  update public.qr_codes 
  set scan_count = coalesce(scan_count, 0) + 1 
  where id = target_qr_id;
  
  -- 3. Update profile monthly scan count and scan_month
  current_month := to_char(now(), 'YYYY-MM');
  
  update public.profiles 
  set 
    monthly_scan_count = case 
      when scan_month = current_month then coalesce(monthly_scan_count, 0) + 1 
      else 1 
    end,
    scan_month = current_month
  where id = owner_id;
  
  -- 4. Record the scan event
  insert into public.scan_events (
    qr_code_id, 
    scanner_email, 
    device_type, 
    country, 
    state, 
    city,
    scanned_at
  )
  values (
    target_qr_id, 
    scanner_email, 
    device_type, 
    country, 
    state, 
    city,
    now()
  );
end;
$$;

-- 5. Add public select policy for QR codes (needed for redirection)
drop policy if exists "qr_codes: select public" on public.qr_codes;
create policy "qr_codes: select public" on public.qr_codes
  for select using (status = 'active');
