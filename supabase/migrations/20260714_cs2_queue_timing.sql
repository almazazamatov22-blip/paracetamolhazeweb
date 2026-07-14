-- Migration: 20260714_cs2_queue_timing.sql
-- Description: Add timing and tracking columns to cs2_reward_queue

ALTER TABLE public.cs2_reward_queue 
  ADD COLUMN IF NOT EXISTS started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS duration_ms integer NULL,
  ADD COLUMN IF NOT EXISTS helper_command_id text NULL,
  ADD COLUMN IF NOT EXISTS error text NULL;

ALTER TABLE public.cs2_reward_queue
  ADD CONSTRAINT check_duration_ms CHECK (duration_ms IS NULL OR duration_ms >= 0);

CREATE INDEX IF NOT EXISTS idx_cs2_reward_queue_processing
  ON public.cs2_reward_queue (streamer_id, status, created_at);

-- Rollback Instructions (if needed):
-- ALTER TABLE public.cs2_reward_queue DROP CONSTRAINT IF EXISTS check_duration_ms;
-- DROP INDEX IF EXISTS public.idx_cs2_reward_queue_processing;
-- ALTER TABLE public.cs2_reward_queue DROP COLUMN IF EXISTS started_at, DROP COLUMN IF EXISTS finished_at, DROP COLUMN IF EXISTS duration_ms, DROP COLUMN IF EXISTS helper_command_id, DROP COLUMN IF EXISTS error;
