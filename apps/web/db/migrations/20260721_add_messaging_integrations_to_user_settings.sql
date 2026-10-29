alter table public.user_settings
  add column if not exists messaging_integrations jsonb null;
