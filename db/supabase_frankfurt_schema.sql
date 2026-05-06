create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

create table if not exists public.game_67_users (
  id uuid primary key default gen_random_uuid(),
  twitch_id text not null unique,
  username text,
  login text,
  image text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.game_67_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.game_67_users(id) on delete cascade,
  score integer default 0,
  pumps integer default 0,
  max_combo integer default 0,
  avg_speed double precision default 0,
  duration integer default 30,
  created_at timestamptz default now()
);

create index if not exists game_67_records_user_id_idx on public.game_67_records(user_id);

create table if not exists public.kinokadr_movies (
  id text primary key,
  title text not null,
  title_ru text not null,
  year integer,
  type text default 'movie',
  category text,
  image_url text not null,
  created_at timestamptz default now(),
  is_textless boolean default false
);

create table if not exists public.kinokadr_scores (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  score integer not null,
  mode text,
  hints_used integer default 0,
  created_at timestamptz default now(),
  username text,
  avatar text
);

create index if not exists kinokadr_scores_mode_idx on public.kinokadr_scores(mode);
create index if not exists kinokadr_scores_user_id_idx on public.kinokadr_scores(user_id);

create table if not exists public.emojino_movies (
  id text primary key,
  title_ru text not null,
  type text,
  year integer,
  emoji text not null,
  hints text[] not null default '{}'::text[],
  created_at timestamptz default now()
);

create table if not exists public.loto_lobbies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text,
  admin_id text,
  status text default 'waiting',
  max_players integer default 10,
  drawn_numbers integer[] not null default '{}'::integer[],
  last_activity timestamptz default now(),
  password text,
  mode text default 'classic',
  started_at timestamptz,
  event jsonb default '{}'::jsonb
);

create table if not exists public.loto_players (
  id text not null,
  nickname text,
  avatar text,
  games_played integer default 0,
  games_won integer default 0,
  lobby_id uuid not null references public.loto_lobbies(id) on delete cascade,
  card jsonb,
  marked_cells integer[] default '{}'::integer[],
  status text default 'waiting',
  joined_at timestamptz default now(),
  is_admin boolean default false,
  primary key (id, lobby_id)
);

create index if not exists loto_players_lobby_id_idx on public.loto_players(lobby_id);

create table if not exists public.loto_chat (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid references public.loto_lobbies(id) on delete cascade,
  user_id text,
  nickname text,
  text text,
  created_at timestamptz default now()
);

create index if not exists loto_chat_lobby_id_idx on public.loto_chat(lobby_id);

create table if not exists public.overlay_configs (
  user_id text primary key,
  settings jsonb default '{}'::jsonb,
  assets jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.poker_lobbies (
  id text primary key,
  name text not null,
  size integer not null,
  buy_in integer not null,
  blind integer not null,
  ante integer default 0,
  with_webcams boolean default false,
  has_password boolean default false,
  password text,
  players_count integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.tof_lobbies (
  id text primary key,
  code text not null unique,
  host_id text not null,
  host_name text not null,
  status text not null default 'waiting',
  current_fact_idx integer not null default 0,
  facts jsonb not null default '[]'::jsonb,
  vote_results jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.tof_players (
  id text not null,
  lobby_id text not null references public.tof_lobbies(id) on delete cascade,
  name text not null,
  score integer not null default 0,
  is_host boolean not null default false,
  twitch_id text,
  avatar_url text,
  submitted_fact boolean not null default false,
  fact_a text,
  fact_b text,
  truth_index integer,
  joined_at timestamptz default now(),
  primary key (id, lobby_id)
);

create index if not exists tof_players_lobby_id_idx on public.tof_players(lobby_id);

create table if not exists public.bred_lobbies (
  id text primary key default gen_random_uuid()::text,
  code text not null unique,
  host_id text not null,
  host_name text not null default 'Бредовуха',
  status text not null default 'waiting',
  current_fact_idx integer not null default 0,
  facts jsonb not null default '[]'::jsonb,
  vote_results jsonb not null default '[]'::jsonb,
  phase_started_at timestamptz,
  phase_deadline_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bred_lobbies_code_idx on public.bred_lobbies(code);

create table if not exists public.bred_players (
  id text not null,
  lobby_id text not null references public.bred_lobbies(id) on delete cascade,
  name text not null,
  score integer not null default 0,
  is_host boolean not null default false,
  twitch_id text,
  avatar_url text,
  submitted_fact boolean not null default false,
  fact_a text,
  fact_b text,
  truth_index integer check (truth_index is null or truth_index in (0, 1)),
  joined_at timestamptz not null default now(),
  primary key (id, lobby_id)
);

create index if not exists bred_players_lobby_id_idx on public.bred_players(lobby_id);

create schema if not exists kinoquiz;

create table if not exists kinoquiz.questions (
  id bigserial primary key,
  tmdb_id bigint not null,
  media_type text not null check (media_type in ('movie', 'series', 'anime')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  title text not null,
  title_ru text not null,
  original_title text not null,
  year integer,
  image_url text not null,
  backdrop_path text,
  poster_path text,
  popularity numeric,
  vote_average numeric,
  vote_count integer,
  created_at timestamptz not null default now(),
  unique (media_type, tmdb_id)
);

create index if not exists kinoquiz_questions_media_type_idx on kinoquiz.questions(media_type);
create index if not exists kinoquiz_questions_difficulty_idx on kinoquiz.questions(difficulty);
create index if not exists kinoquiz_questions_media_difficulty_idx on kinoquiz.questions(media_type, difficulty);

create or replace view public.kinoquiz_questions as
select * from kinoquiz.questions;

insert into storage.buckets (id, name, public)
values ('overlays', 'overlays', true)
on conflict (id) do update set public = excluded.public;

alter table public.game_67_users disable row level security;
alter table public.game_67_records disable row level security;
alter table public.kinokadr_movies disable row level security;
alter table public.kinokadr_scores disable row level security;
alter table public.emojino_movies disable row level security;
alter table public.loto_lobbies disable row level security;
alter table public.loto_players disable row level security;
alter table public.loto_chat disable row level security;
alter table public.overlay_configs disable row level security;
alter table public.poker_lobbies disable row level security;
alter table public.tof_lobbies disable row level security;
alter table public.tof_players disable row level security;
alter table public.bred_lobbies disable row level security;
alter table public.bred_players disable row level security;
alter table kinoquiz.questions disable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema kinoquiz to anon, authenticated, service_role;
grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
grant select on all tables in schema kinoquiz to anon, authenticated, service_role;
grant insert, update, delete on all tables in schema kinoquiz to service_role;
grant usage, select on all sequences in schema kinoquiz to service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema kinoquiz grant select on tables to anon, authenticated, service_role;
alter default privileges in schema kinoquiz grant insert, update, delete on tables to service_role;
alter default privileges in schema kinoquiz grant usage, select on sequences to service_role;

do $$
begin
  alter publication supabase_realtime add table public.loto_lobbies;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.loto_players;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.loto_chat;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.bred_lobbies;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.bred_players;
exception when duplicate_object then null; when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
