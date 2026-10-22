create extension if not exists pgcrypto;

create table if not exists public.test_runs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  app_url text not null,
  description text not null default '',
  network text not null default 'devnet' check (network in ('devnet')),
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

-- Public demo/testing access: anyone can read and create test runs/reports.
-- For production, replace these policies with authenticated ownership and rate limits.
drop policy if exists "runs readable by everyone" on public.test_runs;
create policy "runs readable by everyone" on public.test_runs for select using (true);
drop policy if exists "runs insertable by everyone" on public.test_runs;
create policy "runs insertable by everyone" on public.test_runs for insert with check (true);
drop policy if exists "reports readable by everyone" on public.test_reports;
create policy "reports readable by everyone" on public.test_reports for select using (true);
drop policy if exists "reports insertable by everyone" on public.test_reports;
create policy "reports insertable by everyone" on public.test_reports for insert with check (true);
