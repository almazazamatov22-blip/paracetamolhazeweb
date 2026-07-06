import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSupabaseServerKey, getSupabaseUrl } from '@/lib/supabase-env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOMAL_USER_ID = 'tomal-overlay';
const TOMAL_SETTINGS_KEY = 'tomal';
const MAX_VALUE = 100;
const DEFAULT_COLOR = '#ffffff';

type FontFamily = 'geist' | 'arial' | 'impact' | 'georgia' | 'courier' | 'trebuchet' | 'waffle';

type TomalState = {
  value: number;
  text: string;
  color: string;
  fontSize: number;
  fontFamily: FontFamily;
  updatedAt: string;
};

const DEFAULT_STATE: TomalState = {
  value: 0,
  text: '',
  color: DEFAULT_COLOR,
  fontSize: 120,
  fontFamily: 'geist',
  updatedAt: new Date(0).toISOString(),
};

let memoryState: TomalState = DEFAULT_STATE;

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Content-Type': 'application/json',
      Expires: '0',
      Pragma: 'no-cache',
      ...(init?.headers || {}),
    },
  });
}

function clampCounter(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_VALUE, Math.max(0, Math.trunc(value)));
}

function clampFontSize(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_STATE.fontSize;
  return Math.min(220, Math.max(32, Math.trunc(value)));
}

function normalizeColor(value: unknown) {
  if (typeof value !== 'string') return DEFAULT_COLOR;
  const color = value.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_COLOR;
}

function normalizeFontFamily(value: unknown): FontFamily {
  return value === 'arial' ||
    value === 'impact' ||
    value === 'georgia' ||
    value === 'courier' ||
    value === 'trebuchet' ||
    value === 'waffle'
    ? value
    : 'geist';
}

function normalizeState(input: Partial<TomalState>): TomalState {
  return {
    value: clampCounter(Number(input.value ?? DEFAULT_STATE.value)),
    text: typeof input.text === 'string' ? input.text.slice(0, 80) : '',
    color: normalizeColor(input.color),
    fontSize: clampFontSize(Number(input.fontSize ?? DEFAULT_STATE.fontSize)),
    fontFamily: normalizeFontFamily(input.fontFamily),
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : new Date().toISOString(),
  };
}

function getSupabase() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseServerKey();

  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

async function readStoredState() {
  const supabase = getSupabase();
  if (!supabase) return memoryState;

  const { data, error } = await supabase
    .from('overlay_configs')
    .select('settings')
    .eq('user_id', TOMAL_USER_ID)
    .maybeSingle();

  if (error) throw error;

  return normalizeState(data?.settings?.[TOMAL_SETTINGS_KEY] || memoryState);
}

async function writeStoredState(nextState: TomalState) {
  const supabase = getSupabase();
  memoryState = nextState;

  if (!supabase) return nextState;

  const { data: current, error: currentError } = await supabase
    .from('overlay_configs')
    .select('settings, assets')
    .eq('user_id', TOMAL_USER_ID)
    .maybeSingle();

  if (currentError) return nextState;

  const settings = current?.settings || {};
  settings[TOMAL_SETTINGS_KEY] = nextState;

  const { error } = await supabase
    .from('overlay_configs')
    .upsert({
      user_id: TOMAL_USER_ID,
      settings,
      assets: current?.assets || {},
      updated_at: nextState.updatedAt,
    }, { onConflict: 'user_id' });

  if (error) return nextState;

  return nextState;
}

export async function GET() {
  try {
    const state = await readStoredState();
    memoryState = state;
    return jsonNoStore(state);
  } catch {
    return jsonNoStore(memoryState);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const nextState = normalizeState({
      ...body,
      updatedAt: new Date().toISOString(),
    });

    const savedState = await writeStoredState(nextState);
    return jsonNoStore(savedState);
  } catch (error) {
    return jsonNoStore({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
