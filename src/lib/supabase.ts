import { createClient } from '@supabase/supabase-js';
import { getSupabasePublicKey, getSupabaseUrl, hasSupabasePublicConfig } from './supabase-env';

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabasePublicKey();

if (!hasSupabasePublicConfig) {
  console.error('CRITICAL: Supabase credentials missing from environment!');
}

// Use a safe placeholder during build if env vars are missing.
const safeUrl = supabaseUrl || 'https://example.supabase.co';
const safeKey = supabaseAnonKey || 'public-anon-key-placeholder';

export const supabase = createClient(safeUrl, safeKey);
