alter table public.user_settings
  add column if not exists memory_opt_in boolean not null default true,
  add column if not exists memory_retention_days integer not null default 365,
  add column if not exists memory_rollout_percent integer not null default 100,
  add column if not exists memory_last_cleared_at timestamptz null;

alter table public.user_settings
  add constraint user_settings_memory_rollout_percent_check
  check (memory_rollout_percent >= 0 and memory_rollout_percent <= 100);