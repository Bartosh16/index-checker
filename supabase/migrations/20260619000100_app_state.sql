create table if not exists public.index_checker_app_state (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.index_checker_app_state (key, value)
values ('project_store', '{"projects":[],"runs":[]}'::jsonb)
on conflict (key) do nothing;
