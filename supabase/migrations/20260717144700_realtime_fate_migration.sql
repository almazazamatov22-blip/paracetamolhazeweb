-- Migration: Fate Overlays Realtime Architecture
-- This migration updates `overlay_configs` and creates `overlay_events`

BEGIN;

-- 1. Create or update `overlay_configs`
-- If it already exists with `user_id` as PK, we need to alter it.
-- Let's check if it exists, if yes, we migrate it.
-- The safest approach without knowing exact constraints is to create a temp table, copy data, drop old, create new.
-- However, we can just alter if we know the schema. Currently it's likely:
-- user_id (text PK), settings (jsonb), assets (jsonb), updated_at (timestamptz)
-- To be safe, let's create a robust migration.

CREATE TABLE IF NOT EXISTS overlay_configs_new (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  overlay_type text not null default 'fate',
  settings jsonb not null default '{}',
  assets jsonb not null default '{}',
  eventsub_status text,
  eventsub_subscription_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, overlay_type)
);

-- Copy data if old table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'overlay_configs') THEN
    -- Insert old configs. We assume overlay_type='fate' for existing.
    INSERT INTO overlay_configs_new (user_id, overlay_type, settings, assets, updated_at)
    SELECT user_id, 'fate', settings, assets, updated_at
    FROM overlay_configs
    ON CONFLICT (user_id, overlay_type) DO NOTHING;
    
    -- Drop old table
    DROP TABLE overlay_configs;
  END IF;
END $$;

-- Rename new table
ALTER TABLE IF EXISTS overlay_configs_new RENAME TO overlay_configs;

-- 2. Create `overlay_events`
CREATE TABLE IF NOT EXISTS overlay_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  overlay_type text not null,
  event_type text not null,
  source text not null,
  external_event_id text,
  reward_id text,
  reward_name text,
  viewer_id text,
  viewer_name text,
  viewer_avatar text,
  user_input text,
  payload jsonb not null default '{}',
  status text not null default 'pending',
  created_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  unique(source, external_event_id)
);

-- 3. Add Indexes
CREATE INDEX IF NOT EXISTS overlay_events_user_created_idx ON overlay_events(user_id, created_at desc);
CREATE INDEX IF NOT EXISTS overlay_events_pending_idx ON overlay_events(user_id, overlay_type, status, created_at);

-- 4. Enable Realtime
-- If publication doesn't exist, this might fail, but usually Supabase creates it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Add tables to publication, catching errors if they are already there
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE overlay_configs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE overlay_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. RPC function to claim event atomically
CREATE OR REPLACE FUNCTION claim_overlay_event(p_event_id uuid, p_user_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status 
  FROM overlay_events 
  WHERE id = p_event_id AND user_id = p_user_id 
  FOR UPDATE SKIP LOCKED;

  IF v_status = 'pending' THEN
    UPDATE overlay_events 
    SET status = 'processing', started_at = now()
    WHERE id = p_event_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMIT;
