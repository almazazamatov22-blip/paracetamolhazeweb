-- Включить Realtime для таблицы overlay_configs

BEGIN;

-- Если publication supabase_realtime не существует, его нужно создать, но обычно он есть по умолчанию:
-- CREATE PUBLICATION supabase_realtime;

-- Добавляем таблицу в публикацию Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE overlay_configs;

COMMIT;

-- Заметка: Также убедитесь, что в Supabase Dashboard (Database -> Replication) 
-- включена репликация для таблицы `overlay_configs` (Insert, Update, Delete).
