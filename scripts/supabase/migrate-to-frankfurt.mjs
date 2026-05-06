import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const FRANKFURT_URL = 'https://xolotswmuxugfqdcuzzj.supabase.co';
const PAGE_SIZE = 1000;
const DATA_CHUNK_SIZE = 500;
const STORAGE_BUCKETS = ['overlays'];

const TABLES = [
  { schema: 'public', table: 'game_67_users', onConflict: 'id' },
  { schema: 'public', table: 'game_67_records', onConflict: 'id' },
  { schema: 'public', table: 'kinokadr_movies', onConflict: 'id' },
  { schema: 'public', table: 'emojino_movies', onConflict: 'id' },
  { schema: 'public', table: 'kinokadr_scores', onConflict: 'id' },
  { schema: 'public', table: 'loto_lobbies', onConflict: 'id' },
  { schema: 'public', table: 'loto_players', onConflict: 'id,lobby_id' },
  { schema: 'public', table: 'loto_chat', onConflict: 'id' },
  { schema: 'public', table: 'overlay_configs', onConflict: 'user_id' },
  { schema: 'public', table: 'poker_lobbies', onConflict: 'id' },
  { schema: 'public', table: 'tof_lobbies', onConflict: 'id' },
  { schema: 'public', table: 'tof_players', onConflict: 'id,lobby_id' },
  { schema: 'public', table: 'bred_lobbies', onConflict: 'id', optional: true },
  { schema: 'public', table: 'bred_players', onConflict: 'id,lobby_id', optional: true },
  {
    schema: 'kinoquiz',
    table: 'questions',
    targetSchema: 'public',
    targetTable: 'kinoquiz_questions',
    onConflict: 'id',
  },
];

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const oldUrl = process.env.OLD_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const oldKey = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const newUrl = process.env.NEW_SUPABASE_URL || process.env.SUPABASE_FRANKFURT_URL || FRANKFURT_URL;
const newKey = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_FRANKFURT_SERVICE_ROLE_KEY;

if (!oldUrl || !oldKey) {
  throw new Error('Old Supabase URL/service key is missing. Check .env.local or OLD_SUPABASE_* env vars.');
}

if (!newUrl || !newKey) {
  throw new Error('New Frankfurt Supabase service role key is missing. Set NEW_SUPABASE_SERVICE_ROLE_KEY.');
}

const oldClient = createClient(oldUrl, oldKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const newClient = createClient(newUrl, newKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function db(client, schema) {
  return schema === 'public' ? client : client.schema(schema);
}

function rewriteProjectUrls(value) {
  if (typeof value === 'string') return value.split(oldUrl).join(newUrl);
  if (Array.isArray(value)) return value.map(rewriteProjectUrls);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteProjectUrls(item)]));
  }
  return value;
}

async function tableExists(client, { schema, table }) {
  const { error } = await db(client, schema)
    .from(table)
    .select('*', { count: 'exact', head: true });
  return !error;
}

async function readAllRows(config) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await db(oldClient, config.schema)
      .from(config.table)
      .select('*')
      .range(from, to);

    if (error) {
      if (config.optional && /schema cache|Could not find the table|PGRST205/i.test(error.message)) {
        console.log(`skip missing optional ${config.schema}.${config.table}`);
        return [];
      }
      throw new Error(`read ${config.schema}.${config.table}: ${error.message}`);
    }

    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function upsertRows(config, rows) {
  if (!rows.length) {
    console.log(`${config.schema}.${config.table}: 0 rows`);
    return;
  }

  const targetConfig = {
    schema: config.targetSchema || config.schema,
    table: config.targetTable || config.table,
  };
  const destinationExists = await tableExists(newClient, targetConfig);
  if (!destinationExists) {
    throw new Error(`Target table ${targetConfig.schema}.${targetConfig.table} is missing. Run db/supabase_frankfurt_schema.sql in the new project first.`);
  }

  const rewritten = rows.map(rewriteProjectUrls);
  for (let index = 0; index < rewritten.length; index += DATA_CHUNK_SIZE) {
    const chunk = rewritten.slice(index, index + DATA_CHUNK_SIZE);
    const { error } = await db(newClient, targetConfig.schema)
      .from(targetConfig.table)
      .upsert(chunk, { onConflict: config.onConflict });

    if (error) throw new Error(`write ${targetConfig.schema}.${targetConfig.table}: ${error.message}`);
  }

  console.log(`${targetConfig.schema}.${targetConfig.table}: ${rewritten.length} rows`);
}

async function copyStorageObject(bucket, path) {
  const { data: file, error: downloadError } = await oldClient.storage.from(bucket).download(path);
  if (downloadError) throw new Error(`download storage ${bucket}/${path}: ${downloadError.message}`);

  const body = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await newClient.storage.from(bucket).upload(path, body, {
    upsert: true,
    contentType: file.type || undefined,
  });

  if (uploadError) throw new Error(`upload storage ${bucket}/${path}: ${uploadError.message}`);
}

async function copyStoragePrefix(bucket, prefix = '') {
  const { data, error } = await oldClient.storage.from(bucket).list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) {
    if (/not found|does not exist|bucket/i.test(error.message)) {
      console.log(`skip missing storage bucket ${bucket}`);
      return 0;
    }
    throw new Error(`list storage ${bucket}/${prefix}: ${error.message}`);
  }

  let copied = 0;
  for (const item of data || []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (!item.id && item.metadata === null) {
      copied += await copyStoragePrefix(bucket, path);
      continue;
    }
    await copyStorageObject(bucket, path);
    copied += 1;
  }

  return copied;
}

async function copyStorage() {
  for (const bucket of STORAGE_BUCKETS) {
    const { error } = await newClient.storage.createBucket(bucket, { public: true });
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`create storage bucket ${bucket}: ${error.message}`);
    }

    const copied = await copyStoragePrefix(bucket);
    console.log(`storage.${bucket}: ${copied} objects`);
  }
}

async function main() {
  console.log(`old: ${oldUrl}`);
  console.log(`new: ${newUrl}`);

  for (const config of TABLES) {
    const rows = await readAllRows(config);
    await upsertRows(config, rows);
  }

  await copyStorage();
  console.log('migration complete');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
