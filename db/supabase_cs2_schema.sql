-- ──────────────────────────────────────────────────────────────────────────
-- CS2 Interactive — Twitch Channel Points → действия в CS2
-- Миграция: 4 таблицы + индексы + гранты.
-- Совместимо с повторным запуском (всё через "if not exists" / do-блоки).
-- ──────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- ── 1. Каталог наград стримера ──────────────────────────────────────────────
-- Каждая строка = одна награда Channel Points, привязанная к действию в CS2.
create table if not exists public.cs2_rewards (
  id                 uuid primary key default gen_random_uuid(),
  streamer_id        text not null,                       -- Twitch user_id стримера
  name               text not null,                       -- название награды (для оверлея/админки)
  description        text not null default '',
  action_type        text not null,                       -- drop_weapon | freeze_5 | spin_180 | block_jump | block_crouch | play_sound | ...
  cost               integer not null default 100,        -- стоимость в баллах (информационно)
  cooldown_seconds   integer not null default 0,          -- кулдаун между активациями
  enabled            boolean not null default true,
  twitch_reward_id   text,                                -- ID награды из Twitch Channel Points
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists cs2_rewards_streamer_id_idx         on public.cs2_rewards(streamer_id);
create index if not exists cs2_rewards_twitch_reward_id_idx    on public.cs2_rewards(streamer_id, twitch_reward_id);
create index if not exists cs2_rewards_streamer_enabled_idx    on public.cs2_rewards(streamer_id, enabled);

-- ── 2. Очередь выполнения (pending → processing → done/error) ────────────────
-- EventSub webhook кладёт сюда строку; локальный агент забирает по poll.
create table if not exists public.cs2_reward_queue (
  id              uuid primary key default gen_random_uuid(),
  streamer_id     text not null,
  reward_id       uuid references public.cs2_rewards(id) on delete set null,
  redemption_id   text unique,                            -- Twitch redemption id (анти-дубль на уровне БД)
  user_name       text not null,
  user_avatar     text,
  action_type     text not null,
  reward_name     text not null,
  status          text not null default 'pending'
                  check (status in ('pending','processing','done','error','rejected')),
  error_message   text,
  created_at      timestamptz not null default now(),
  executed_at     timestamptz
);

create index if not exists cs2_reward_queue_streamer_status_idx on public.cs2_reward_queue(streamer_id, status, created_at);
create index if not exists cs2_reward_queue_streamer_created_idx on public.cs2_reward_queue(streamer_id, created_at);
create index if not exists cs2_reward_queue_reward_idx          on public.cs2_reward_queue(reward_id, created_at);

-- ── 3. История успешных активаций (только done) ──────────────────────────────
create table if not exists public.cs2_history (
  id              uuid primary key default gen_random_uuid(),
  streamer_id     text not null,
  user_name       text not null,
  user_avatar     text,
  reward_name     text not null,
  action_type     text not null,
  executed_at     timestamptz not null default now()
);

create index if not exists cs2_history_streamer_executed_idx on public.cs2_history(streamer_id, executed_at desc);

-- ── 4. Лог системных ошибок (webhook / агент / подписка) ─────────────────────
-- Требование #9 — логирование ошибок. Хранит контекст для дебага.
create table if not exists public.cs2_error_logs (
  id              uuid primary key default gen_random_uuid(),
  streamer_id     text,
  source          text not null,                          -- 'cs2_webhook' | 'cs2_agent' | 'cs2_subscribe' | ...
  level           text not null default 'error'
                  check (level in ('warn','error','fatal')),
  message         text not null,
  context         jsonb not null default '{}'::jsonb,     -- произвольный контекст (reward_id, redemption_id и т.д.)
  created_at      timestamptz not null default now()
);

create index if not exists cs2_error_logs_created_idx on public.cs2_error_logs(created_at desc);
create index if not exists cs2_error_logs_source_idx   on public.cs2_error_logs(source, created_at desc);

-- ── RLS off (как в остальных таблицах проекта — доступ через service_role) ──
alter table public.cs2_rewards      disable row level security;
alter table public.cs2_reward_queue disable row level security;
alter table public.cs2_history      disable row level security;
alter table public.cs2_error_logs   disable row level security;

-- ── Гранты ──────────────────────────────────────────────────────────────────
grant usage on schema public to anon, authenticated, service_role;

grant all privileges on public.cs2_rewards      to anon, authenticated, service_role;
grant all privileges on public.cs2_reward_queue to anon, authenticated, service_role;
grant all privileges on public.cs2_history      to anon, authenticated, service_role;
grant all privileges on public.cs2_error_logs   to anon, authenticated, service_role;

grant usage, select on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;

-- ── Realtime для очереди (опционально — для мгновенных оверлеев в будущем) ──
do $$ begin
  alter publication supabase_realtime add table public.cs2_reward_queue;
exception when duplicate_object then null; when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
