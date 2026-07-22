-- GuriTube / NouTube — self-hosted sync schema
--
-- Mirrors the client syncers in lib/supabase/sync/*. Every row is owned by the
-- authenticated user; Row Level Security restricts all access to
-- auth.uid() = user_id, so on your own Supabase each account only ever sees its
-- own data. No service role or server code is required for sync itself.
--
-- Apply with the Supabase CLI (`supabase db push`), the dashboard SQL editor,
-- or psql against your self-hosted instance.

-- ---------------------------------------------------------------------------
-- Collection tables (one row per item)
-- ---------------------------------------------------------------------------

create table if not exists public.nou_bookmarks (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  url text,
  title text,
  json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nou_bookmarks_user_idx on public.nou_bookmarks (user_id);

create table if not exists public.nou_folders (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text,
  json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nou_folders_user_idx on public.nou_folders (user_id);

-- Watch history. Kept as a collection so it merges across devices by video.
create table if not exists public.nou_history (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  video_id text,
  url text,
  title text,
  json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nou_history_user_idx on public.nou_history (user_id);
create index if not exists nou_history_user_video_idx on public.nou_history (user_id, video_id);

-- ---------------------------------------------------------------------------
-- Document tables (one row per user)
-- ---------------------------------------------------------------------------

create table if not exists public.nou_settings (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.nou_user_styles (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Plans / entitlement
--
-- Sync is a gated capability (it can become a paid product later). Each account
-- has a plan; only 'free' is blocked client-side. Users can READ their own plan
-- but never change it — the admin (you) grants premium. A signup trigger seeds
-- every new account as 'free'.
-- ---------------------------------------------------------------------------

create table if not exists public.nou_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free',
  updated_at timestamptz not null default now()
);

alter table public.nou_profiles enable row level security;

drop policy if exists nou_profiles_read_own on public.nou_profiles;
create policy nou_profiles_read_own on public.nou_profiles
  for select to authenticated using (auth.uid() = user_id);
-- No insert/update/delete policy for authenticated: plan changes are admin-only
-- (service role, or SQL run as the owner — see the grant snippet below).

create or replace function public.nou_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.nou_profiles (user_id, plan) values (new.id, 'free')
    on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_nou on auth.users;
create trigger on_auth_user_created_nou after insert on auth.users
  for each row execute function public.nou_handle_new_user();

-- Grant yourself premium (run once as admin, after your first sign-in):
--   update public.nou_profiles set plan = 'premium'
--     where user_id = (select id from auth.users where email = 'you@example.com');

-- ---------------------------------------------------------------------------
-- Row Level Security: an account can only read/write its own rows.
-- ---------------------------------------------------------------------------

alter table public.nou_bookmarks enable row level security;
alter table public.nou_folders enable row level security;
alter table public.nou_history enable row level security;
alter table public.nou_settings enable row level security;
alter table public.nou_user_styles enable row level security;

drop policy if exists nou_bookmarks_owner on public.nou_bookmarks;
create policy nou_bookmarks_owner on public.nou_bookmarks
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists nou_folders_owner on public.nou_folders;
create policy nou_folders_owner on public.nou_folders
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists nou_history_owner on public.nou_history;
create policy nou_history_owner on public.nou_history
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists nou_settings_owner on public.nou_settings;
create policy nou_settings_owner on public.nou_settings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists nou_user_styles_owner on public.nou_user_styles;
create policy nou_user_styles_owner on public.nou_user_styles
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at handling.
--
-- Collection tables (bookmarks / folders / history) are client-authoritative:
-- the app sends created_at and updated_at on every upsert and the sync engine
-- compares those timestamps, so the server must PRESERVE them (no trigger).
--
-- Document tables (settings / user_styles) upsert only { user_id, json }, so
-- the server must bump updated_at itself on update.
-- ---------------------------------------------------------------------------

create or replace function public.nou_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists nou_settings_touch on public.nou_settings;
create trigger nou_settings_touch before update on public.nou_settings
  for each row execute function public.nou_touch_updated_at();

drop trigger if exists nou_user_styles_touch on public.nou_user_styles;
create trigger nou_user_styles_touch before update on public.nou_user_styles
  for each row execute function public.nou_touch_updated_at();
