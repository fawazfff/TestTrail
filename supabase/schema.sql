create extension if not exists pgcrypto;

create table if not exists public.test_runs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  app_url text not null,
  description text not null default '',
  network text not null default 'devnet' check (network in ('devnet')),
  owner_wallet text,
  created_at timestamptz not null default now()
);

create table if not exists public.test_reports (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.test_runs(id) on delete cascade,
  status text not null check (status in ('passed','failed','blocked')),
  summary text not null,
  details text not null default '',
  screenshot_url text,
  receipt_signature text,
  created_at timestamptz not null default now()
);

create index if not exists test_reports_run_created_idx on public.test_reports(run_id, created_at desc);
alter table public.test_runs enable row level security;
alter table public.test_reports enable row level security;


-- Production access is mediated by the testtrail-api Edge Function.
-- The service role key must never be exposed in browser code.
drop policy if exists "runs readable by everyone" on public.test_runs;
drop policy if exists "runs insertable by everyone" on public.test_runs;
drop policy if exists "runs updateable by everyone" on public.test_runs;
drop policy if exists "reports readable by everyone" on public.test_reports;
drop policy if exists "reports insertable by everyone" on public.test_reports;
drop policy if exists "reports updateable by everyone" on public.test_reports;

drop policy if exists testtrail_deny_public_runs_read on public.test_runs;
drop policy if exists testtrail_deny_public_runs_insert on public.test_runs;
drop policy if exists testtrail_deny_public_runs_update on public.test_runs;
drop policy if exists testtrail_deny_public_runs_delete on public.test_runs;
drop policy if exists testtrail_deny_public_reports_read on public.test_reports;
drop policy if exists testtrail_deny_public_reports_insert on public.test_reports;
drop policy if exists testtrail_deny_public_reports_update on public.test_reports;
drop policy if exists testtrail_deny_public_reports_delete on public.test_reports;

create policy testtrail_deny_public_runs_read on public.test_runs as restrictive for select to anon, authenticated using (false);
create policy testtrail_deny_public_runs_insert on public.test_runs as restrictive for insert to anon, authenticated with check (false);
create policy testtrail_deny_public_runs_update on public.test_runs as restrictive for update to anon, authenticated using (false) with check (false);
create policy testtrail_deny_public_runs_delete on public.test_runs as restrictive for delete to anon, authenticated using (false);
create policy testtrail_deny_public_reports_read on public.test_reports as restrictive for select to anon, authenticated using (false);
create policy testtrail_deny_public_reports_insert on public.test_reports as restrictive for insert to anon, authenticated with check (false);
create policy testtrail_deny_public_reports_update on public.test_reports as restrictive for update to anon, authenticated using (false) with check (false);
create policy testtrail_deny_public_reports_delete on public.test_reports as restrictive for delete to anon, authenticated using (false);

create table if not exists public.testtrail_wallet_challenges (
 wallet text primary key,
 nonce text not null,
 message text not null,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
alter table public.testtrail_wallet_challenges enable row level security;
revoke all on public.testtrail_wallet_challenges from anon, authenticated;
create index if not exists test_runs_owner_wallet_created_idx on public.test_runs(owner_wallet, created_at desc);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('test-screenshots','test-screenshots',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp'];
