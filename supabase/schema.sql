-- ============================================================
-- ScanovaX — Supabase Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- 1. PROFILES (extends auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  plan        text not null default 'free' check (plan in ('free', 'pro')),
  created_at  timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. QR CODES
create table if not exists public.qr_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'My QR Code',
  type        text not null default 'url',
  content     text not null default '',
  fg_color    text not null default '#0f172a',
  bg_color    text not null default '#ffffff',
  ec_level    text not null default 'M',
  frame       text not null default 'None',
  shape       text not null default 'Square',
  status      text not null default 'active' check (status in ('active', 'paused')),
  scan_count  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- 3. SCAN EVENTS
create table if not exists public.scan_events (
  id           uuid primary key default gen_random_uuid(),
  qr_code_id   uuid not null references public.qr_codes(id) on delete cascade,
  scanned_at   timestamptz not null default now(),
  country      text,
  device_type  text check (device_type in ('desktop', 'mobile'))
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles    enable row level security;
alter table public.qr_codes    enable row level security;
alter table public.scan_events enable row level security;

-- Profiles: own row only
drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

-- QR Codes: own rows only
drop policy if exists "qr_codes: select own" on public.qr_codes;
create policy "qr_codes: select own" on public.qr_codes
  for select using (auth.uid() = user_id);
drop policy if exists "qr_codes: insert own" on public.qr_codes;
create policy "qr_codes: insert own" on public.qr_codes
  for insert with check (auth.uid() = user_id);
drop policy if exists "qr_codes: update own" on public.qr_codes;
create policy "qr_codes: update own" on public.qr_codes
  for update using (auth.uid() = user_id);
drop policy if exists "qr_codes: delete own" on public.qr_codes;
create policy "qr_codes: delete own" on public.qr_codes
  for delete using (auth.uid() = user_id);

-- Scan Events: readable by owner of the parent QR code
drop policy if exists "scan_events: select own" on public.scan_events;
create policy "scan_events: select own" on public.scan_events
  for select using (
    exists (
      select 1 from public.qr_codes
      where qr_codes.id = scan_events.qr_code_id
        and qr_codes.user_id = auth.uid()
    )
  );
drop policy if exists "scan_events: insert anon" on public.scan_events;
create policy "scan_events: insert anon" on public.scan_events
  for insert with check (true);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists qr_codes_user_id_idx    on public.qr_codes (user_id);
create index if not exists scan_events_qr_code_idx on public.scan_events (qr_code_id);
create index if not exists scan_events_scanned_at  on public.scan_events (scanned_at);

-- ============================================================
-- ANALYTICS: Additional columns and functions
-- ============================================================

-- Add missing columns for analytics if they don't exist
alter table public.profiles add column if not exists monthly_scan_count bigint default 0;
alter table public.scan_events add column if not exists scanner_email text;
alter table public.scan_events add column if not exists state text;
alter table public.scan_events add column if not exists city text;
alter table public.scan_events add column if not exists ip_address text;
alter table public.scan_events add column if not exists user_identifier text;

-- ============================================================
-- SCAN COUNTER FUNCTION WITH DEDUPLICATION
-- ============================================================

-- Increment scan count with 5-second deduplication window
-- This prevents double-counting from React Strict Mode, double-clicks, retries, etc.
create or replace function public.increment_scan(
  target_qr_id uuid,
  scanner_email text default null,
  device_type text default 'desktop',
  country text default 'Unknown',
  state text default 'Unknown',
  city text default 'Unknown',
  ip_address text default 'Unknown',
  user_identifier text default 'Anonymous'
)
returns void
language plpgsql
security definer
as $$
begin
  -- DEDUPLICATION: Prevent duplicate scans from same user within 5 seconds
  -- Handles React Strict Mode, double-clicks, client retries, etc.
  if exists (
    select 1 from public.scan_events 
    where qr_code_id = target_qr_id 
    and user_identifier = increment_scan.user_identifier 
    and scanned_at > now() - interval '5 seconds'
  ) then
    return;
  end if;

  -- A. UPDATE ATOMIC COUNTERS (only if not a duplicate)
  -- 1. Total scan counter
  update public.qr_codes
  set scan_count = coalesce(scan_count, 0) + 1
  where id = target_qr_id;

  -- 2. Monthly scan counter for the user
  update public.profiles 
  set monthly_scan_count = coalesce(monthly_scan_count, 0) + 1 
  where id = (select user_id from public.qr_codes where id = target_qr_id);

  -- B. LOG AUDIT EVENT
  insert into public.scan_events (
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
  values (
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
end;
$$;

-- Grant permissions to call the function
grant execute on function public.increment_scan to anon, authenticated;
