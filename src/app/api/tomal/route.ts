import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSupabaseServerKey, getSupabaseUrl } from '@/lib/supabase-env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOMAL_USER_ID = 'tomal-global';
const TOMAL_SETTINGS_KEY = 'tomal';
const DEFAULT_MAX_VALUE = 100;
const MIN_MAX_VALUE = 1;
const MAX_MAX_VALUE = 9999;
const DEFAULT_COLOR = '#ffffff';
const DEFAULT_OUTLINE_COLOR = '#000000';

type FontFamily =
  | 'geist'
  | 'system'
  | 'arial'
  | 'impact'
  | 'georgia'
  | 'courier'
  | 'trebuchet'
  | 'waffle'
  | 'verdana'
  | 'tahoma'
  | 'times'
  | 'comic'
  | 'lucida'
  | 'segoe'
  | 'garamond'
  | 'palatino'
  | 'franklin'
  | 'monospace'
  | 'serif';

type TextPosition = 'top' | 'bottom';
type OverlayAnimation = 'none' | 'fade' | 'pulse' | 'pop' | 'slide' | 'float' | 'glow' | 'bounce';

type TomalState = {
  value: number;
  maxValue: number;
  text: string;
  color: string;
  fontSize: number;
  letterSpacing: number;
  fontFamily: FontFamily;
  textPosition: TextPosition;
  outlineEnabled: boolean;
  outlineColor: string;
  outlineWidth: number;
  animation: OverlayAnimation;
  updatedAt: string;
};

const DEFAULT_STATE: TomalState = {
  value: 0,
  maxValue: DEFAULT_MAX_VALUE,
  text: '',
  color: DEFAULT_COLOR,
  fontSize: 120,
  letterSpacing: 0,
  fontFamily: 'geist',
  textPosition: 'top',
  outlineEnabled: false,
  outlineColor: DEFAULT_OUTLINE_COLOR,
  outlineWidth: 3,
  animation: 'none',
  updatedAt: new Date(0).toISOString(),
};

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Content-Type': 'application/json',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
      ...(init?.headers || {}),
    },
  });
}

function clampMaxValue(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_STATE.maxValue;
  return Math.min(MAX_MAX_VALUE, Math.max(MIN_MAX_VALUE, Math.trunc(value)));
}

function clampCounter(value: number, maxValue = DEFAULT_STATE.maxValue) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(maxValue, Math.max(0, Math.trunc(value)));
}

function clampFontSize(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_STATE.fontSize;
  return Math.min(240, Math.max(32, Math.trunc(value)));
}

function clampLetterSpacing(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_STATE.letterSpacing;
  return Math.min(32, Math.max(0, Math.trunc(value)));
}

function clampOutlineWidth(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_STATE.outlineWidth;
  return Math.min(14, Math.max(0, Math.trunc(value)));
}

function normalizeColor(value: unknown, fallback = DEFAULT_COLOR) {
  if (typeof value !== 'string') return fallback;
  const color = value.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function normalizeFontFamily(value: unknown): FontFamily {
  return value === 'system' ||
    value === 'arial' ||
    value === 'impact' ||
    value === 'georgia' ||
    value === 'courier' ||
    value === 'trebuchet' ||
    value === 'waffle' ||
    value === 'verdana' ||
    value === 'tahoma' ||
    value === 'times' ||
    value === 'comic' ||
    value === 'lucida' ||
    value === 'segoe' ||
    value === 'garamond' ||
    value === 'palatino' ||
    value === 'franklin' ||
    value === 'monospace' ||
    value === 'serif'
    ? value
    : 'geist';
}

function normalizeTextPosition(value: unknown): TextPosition {
  return value === 'bottom' ? value : 'top';
}

function normalizeAnimation(value: unknown): OverlayAnimation {
  return value === 'fade' ||
    value === 'pulse' ||
    value === 'pop' ||
    value === 'slide' ||
    value === 'float' ||
    value === 'glow' ||
    value === 'bounce'
    ? value
    : 'none';
}

function normalizeState(input: Partial<TomalState>): TomalState {
  const maxValue = clampMaxValue(Number(input.maxValue ?? DEFAULT_STATE.maxValue));

  return {
    value: clampCounter(Number(input.value ?? DEFAULT_STATE.value), maxValue),
    maxValue,
    text: typeof input.text === 'string' ? input.text.slice(0, 120) : '',
    color: normalizeColor(input.color),
    fontSize: clampFontSize(Number(input.fontSize ?? DEFAULT_STATE.fontSize)),
    letterSpacing: clampLetterSpacing(Number(input.letterSpacing ?? DEFAULT_STATE.letterSpacing)),
    fontFamily: normalizeFontFamily(input.fontFamily),
    textPosition: normalizeTextPosition(input.textPosition),
    outlineEnabled: Boolean(input.outlineEnabled),
    outlineColor: normalizeColor(input.outlineColor, DEFAULT_OUTLINE_COLOR),
    outlineWidth: clampOutlineWidth(Number(input.outlineWidth ?? DEFAULT_STATE.outlineWidth)),
    animation: normalizeAnimation(input.animation),
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : new Date().toISOString(),
  };
}

function getSupabase() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseServerKey();

  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

async function readStoredState(): Promise<TomalState> {
  const supabase = getSupabase();
  if (!supabase) return DEFAULT_STATE;

  const { data, error } = await supabase
    .from('overlay_configs')
    .select('settings')
    .eq('user_id', TOMAL_USER_ID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeState(data?.settings?.[TOMAL_SETTINGS_KEY] || DEFAULT_STATE);
}

async function writeStoredState(nextState: TomalState): Promise<TomalState> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase configuration missing');

  const { data: current, error: currentError } = await supabase
    .from('overlay_configs')
    .select('settings, assets')
    .eq('user_id', TOMAL_USER_ID)
    .maybeSingle();

  if (currentError && currentError.code !== 'PGRST116') {
    throw currentError;
  }

  const settings = current?.settings || {};
  settings[TOMAL_SETTINGS_KEY] = nextState;

  const { error } = await supabase
    .from('overlay_configs')
    .upsert({
      user_id: TOMAL_USER_ID,
      overlay_type: 'tomal',
      settings,
      assets: current?.assets || {},
      updated_at: nextState.updatedAt,
    }, { onConflict: 'user_id' });

  if (error) {
    throw error;
  }

  return nextState;
}

export async function GET() {
  try {
    const state = await readStoredState();
    return jsonNoStore(state);
  } catch (error) {
    return jsonNoStore(DEFAULT_STATE);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body || typeof body !== 'object') {
      return jsonNoStore({ success: false, error: 'Invalid body' }, { status: 400 });
    }

    if ('value' in body && typeof body.value !== 'number') {
      return jsonNoStore({ success: false, error: 'value must be a number' }, { status: 400 });
    }

    if ('maxValue' in body && typeof body.maxValue !== 'number') {
      return jsonNoStore({ success: false, error: 'maxValue must be a number' }, { status: 400 });
    }

    if ('value' in body && (!Number.isFinite(body.value) || Number.isNaN(body.value))) {
      return jsonNoStore({ success: false, error: 'value must be finite' }, { status: 400 });
    }

    const nextState = normalizeState({
      ...body,
      updatedAt: new Date().toISOString(),
    });

    const savedState = await writeStoredState(nextState);
    return jsonNoStore({ success: true, ...savedState });
  } catch (error) {
    return jsonNoStore({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
