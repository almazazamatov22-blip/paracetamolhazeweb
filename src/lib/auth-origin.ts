import { NextRequest } from 'next/server';

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(',')[0]?.trim();
  return first || null;
}

function sanitizeHost(host: string | null): string | null {
  if (!host) return null;
  const normalized = host.trim().toLowerCase();
  if (!normalized) return null;
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(normalized)) return null;
  return normalized;
}

function sanitizeProto(proto: string | null): 'http' | 'https' | null {
  if (!proto) return null;
  const normalized = proto.trim().toLowerCase();
  if (normalized === 'http' || normalized === 'https') return normalized;
  return null;
}

function sanitizeConfiguredUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function getRequestBaseUrl(request: NextRequest): string {
  const configured = sanitizeConfiguredUrl(process.env.TWITCH_AUTH_BASE_URL);

  if (configured) return configured;

  const proto =
    sanitizeProto(firstHeaderValue(request.headers.get('x-forwarded-proto'))) ??
    sanitizeProto(request.nextUrl.protocol.replace(':', ''));

  const host =
    sanitizeHost(firstHeaderValue(request.headers.get('x-forwarded-host'))) ??
    sanitizeHost(firstHeaderValue(request.headers.get('host'))) ??
    sanitizeHost(request.nextUrl.host);

  if (proto && host) {
    return `${proto}://${host}`;
  }

  return request.nextUrl.origin;
}
