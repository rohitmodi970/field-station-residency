-- Migration: create Photon storage tables for webhook message persistence

create table if not exists public.photon_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete set null,
  platform text not null,
  platform_id text null,
  message_id text null,
  webhook_id text null,
  event_type text not null,
  content_type text not null,
  content_text text null,
  raw_payload jsonb null,
  created_at timestamptz default now()
);

create index if not exists idx_photon_messages_user_id on public.photon_messages (user_id);
create index if not exists idx_photon_messages_platform_id on public.photon_messages (platform_id);
create index if not exists idx_photon_messages_message_id on public.photon_messages (message_id);

-- Row level security so users can only access their own Photon messages
alter table public.photon_messages enable row level security;

create policy "Users can view own photon messages"
  on public.photon_messages for select
  using (auth.uid() = user_id);

create policy "Users can insert own photon messages"
  on public.photon_messages for insert
  with check (auth.uid() = user_id);

create policy "Users can update own photon messages"
  on public.photon_messages for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own photon messages"
  on public.photon_messages for delete
  using (auth.uid() = user_id);

create table if not exists public.photon_webhook_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete set null,
  webhook_id text null,
  message_id text null,
  platform text not null,
  sender_id text null,
  event_type text not null,
  status text not null,
  created_at timestamptz default now()
);

-- Row level security for webhook logs
alter table public.photon_webhook_logs enable row level security;

create policy "Users can view own photon webhook logs"
  on public.photon_webhook_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own photon webhook logs"
  on public.photon_webhook_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own photon webhook logs"
  on public.photon_webhook_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own photon webhook logs"
  on public.photon_webhook_logs for delete
  using (false);

create index if not exists idx_photon_webhook_logs_webhook_id on public.photon_webhook_logs (webhook_id);
create index if not exists idx_photon_webhook_logs_message_id on public.photon_webhook_logs (message_id);
create index if not exists idx_photon_webhook_logs_platform on public.photon_webhook_logs (platform);
