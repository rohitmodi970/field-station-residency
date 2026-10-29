-- Migration: create external_accounts table for mapping external provider IDs to users
create table if not exists public.external_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade,
  provider text not null,
  external_id text not null,
  metadata jsonb null,
  created_at timestamptz default now(),
  unique (provider, external_id)
);

-- Index to speed lookups by provider + external_id
create index if not exists idx_external_accounts_provider_external_id on public.external_accounts (provider, external_id);

-- Row level security so users can only manage their own external account mappings
alter table public.external_accounts enable row level security;

create policy "Users can view own external accounts"
  on public.external_accounts for select
  using (auth.uid() = user_id);

create policy "Users can insert own external accounts"
  on public.external_accounts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own external accounts"
  on public.external_accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own external accounts"
  on public.external_accounts for delete
  using (auth.uid() = user_id);
