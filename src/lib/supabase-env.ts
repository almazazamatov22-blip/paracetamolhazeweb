function clean(value: string | undefined) {
  return (value || '').trim();
}

export function getSupabaseUrl() {
  return clean(process.env.NEXT_PUBLIC_SUPABASE_URL) || clean(process.env.SUPABASE_URL);
}

export function getSupabasePublicKey() {
  return (
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    clean(process.env.SUPABASE_ANON_KEY) ||
    clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    clean(process.env.SUPABASE_PUBLISHABLE_KEY)
  );
}

export function getSupabaseServerKey() {
  return (
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    clean(process.env.SUPABASE_SECRET_KEY) ||
    clean(process.env.SUPABASE_SECRET) ||
    getSupabasePublicKey()
  );
}

export const hasSupabasePublicConfig = Boolean(getSupabaseUrl() && getSupabasePublicKey());
export const hasSupabaseServerConfig = Boolean(getSupabaseUrl() && getSupabaseServerKey());
