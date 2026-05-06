create extension if not exists pgcrypto;

create table if not exists public.bred_lobbies (
  id text primary key default gen_random_uuid()::text,
  code text not null unique,
  host_id text not null,
  host_name text not null default 'Бредовуха',
  status text not null default 'waiting' check (
    status in ('waiting', 'lobby', 'input', 'voting', 'reveal', 'leaderboard')
  ),
  current_fact_idx integer not null default 0 check (current_fact_idx >= 0),
  facts jsonb not null default '[]'::jsonb,
  vote_results jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bred_lobbies_code_idx on public.bred_lobbies (code);
create index if not exists bred_lobbies_status_idx on public.bred_lobbies (status);

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

create index if not exists bred_players_lobby_id_idx on public.bred_players (lobby_id);

create or replace function public.set_bred_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_bred_lobbies_updated_at on public.bred_lobbies;
create trigger set_bred_lobbies_updated_at
before update on public.bred_lobbies
for each row execute function public.set_bred_updated_at();

insert into public.bred_lobbies (
  id,
  code,
  host_id,
  host_name,
  status,
  current_fact_idx,
  facts,
  vote_results,
  settings,
  created_at,
  updated_at
)
select
  l.id::text,
  upper(l.code),
  coalesce(nullif(l.admin_id, ''), 'host'),
  coalesce(nullif(l.event->>'host_name', ''), nullif(l.name, ''), 'Бредовуха'),
  case
    when coalesce(l.event, '{}'::jsonb) ? 'status' then
      case
        when l.event->>'status' in ('waiting', 'lobby', 'input', 'voting', 'reveal', 'leaderboard')
          then l.event->>'status'
        else 'waiting'
      end
    when l.status = 'finished' then 'leaderboard'
    when l.status = 'playing' then 'input'
    else 'waiting'
  end,
  case
    when coalesce(l.event->>'current_fact_idx', '') ~ '^[0-9]+$'
      then (l.event->>'current_fact_idx')::integer
    else 0
  end,
  case
    when jsonb_typeof(coalesce(l.event->'facts', '[]'::jsonb)) = 'array'
      then coalesce(l.event->'facts', '[]'::jsonb)
    else '[]'::jsonb
  end,
  case
    when jsonb_typeof(coalesce(l.event->'vote_results', '[]'::jsonb)) = 'array'
      then coalesce(l.event->'vote_results', '[]'::jsonb)
    else '[]'::jsonb
  end,
  jsonb_build_object('legacy_loto_id', l.id::text, 'max_players', coalesce(l.max_players, 14)),
  coalesce(l.started_at, l.last_activity, now()),
  coalesce(l.last_activity, now())
from public.loto_lobbies l
where l.mode = 'bred'
on conflict (id) do update set
  code = excluded.code,
  host_id = excluded.host_id,
  host_name = excluded.host_name,
  status = excluded.status,
  current_fact_idx = excluded.current_fact_idx,
  facts = excluded.facts,
  vote_results = excluded.vote_results,
  settings = public.bred_lobbies.settings || excluded.settings,
  updated_at = excluded.updated_at;

insert into public.bred_players (
  id,
  lobby_id,
  name,
  score,
  is_host,
  twitch_id,
  avatar_url,
  submitted_fact,
  fact_a,
  fact_b,
  truth_index,
  joined_at
)
select
  p.id,
  p.lobby_id::text,
  coalesce(nullif(p.nickname, ''), 'Игрок'),
  case
    when coalesce(p.card->>'score', '') ~ '^-?[0-9]+$'
      then (p.card->>'score')::integer
    else 0
  end,
  coalesce(p.is_admin, false),
  nullif(p.card->>'twitch_id', ''),
  nullif(coalesce(p.card->>'avatar_url', case when coalesce(p.avatar, '') like 'http%' then p.avatar end), ''),
  coalesce(p.card->>'submitted_fact', 'false') = 'true',
  nullif(p.card->>'fact_a', ''),
  nullif(p.card->>'fact_b', ''),
  case
    when coalesce(p.card->>'truth_index', '') in ('0', '1')
      then (p.card->>'truth_index')::integer
    else null
  end,
  coalesce(p.joined_at, now())
from public.loto_players p
join public.loto_lobbies l on l.id = p.lobby_id
where l.mode = 'bred'
on conflict (id, lobby_id) do update set
  name = excluded.name,
  score = excluded.score,
  is_host = excluded.is_host,
  twitch_id = excluded.twitch_id,
  avatar_url = excluded.avatar_url,
  submitted_fact = excluded.submitted_fact,
  fact_a = excluded.fact_a,
  fact_b = excluded.fact_b,
  truth_index = excluded.truth_index;

alter table public.bred_lobbies disable row level security;
alter table public.bred_players disable row level security;

grant select, insert, update, delete on public.bred_lobbies to anon, authenticated, service_role;
grant select, insert, update, delete on public.bred_players to anon, authenticated, service_role;

do $$
begin
  alter publication supabase_realtime add table public.bred_lobbies;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.bred_players;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
