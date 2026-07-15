import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_GITHUB_REPOSITORY = 'almazazamatov22-blip/paracetamolhazeweb';
const configuredRepository = process.env.CS2HAZE_GITHUB_REPOSITORY?.trim();
const GITHUB_REPOSITORY = configuredRepository
  && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(configuredRepository)
  ? configuredRepository
  : DEFAULT_GITHUB_REPOSITORY;
const RELEASE_METADATA_URL =
  `https://github.com/${GITHUB_REPOSITORY}/releases/latest/download/cs2haze-release.json`;
const MINIMUM_SELF_UPDATING_VERSION = '1.0.4';
const FALLBACK_LAUNCHER_VERSION = '1.0.3';
const RUNTIME_VERSION = '2.0.6';

type ReleaseMetadata = {
  releaseTag: string;
  launcherVersion: string;
  launcherSha256: string;
  runtimeVersion: string;
  runtimeSha256: string;
};

function isVersion(value: unknown): value is string {
  return typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f\d]{64}$/i.test(value);
}

function compareVersions(left: string, right: string): number {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function isReleaseMetadata(value: unknown): value is ReleaseMetadata {
  if (!value || typeof value !== 'object') return false;
  const metadata = value as Partial<ReleaseMetadata>;
  return (
    typeof metadata.releaseTag === 'string'
    && /^cs2haze-v[\w.-]+$/.test(metadata.releaseTag)
    && isVersion(metadata.launcherVersion)
    && compareVersions(metadata.launcherVersion, MINIMUM_SELF_UPDATING_VERSION) >= 0
    && isSha256(metadata.launcherSha256)
    && isVersion(metadata.runtimeVersion)
    && isSha256(metadata.runtimeSha256)
  );
}

async function getPublishedLauncher(): Promise<ReleaseMetadata | null> {
  try {
    const response = await fetch(RELEASE_METADATA_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => 'Failed to read response body');
      console.error(`[Manifest API] GitHub returned HTTP ${response.status}: ${text}`);
      return null;
    }

    const metadata: unknown = await response.json();
    if (!isReleaseMetadata(metadata)) {
      console.error('[Manifest API] GitHub returned invalid JSON or schema mismatch:', JSON.stringify(metadata));
      return null;
    }
    return metadata;
  } catch (err) {
    console.error('[Manifest API] Failed to fetch from GitHub (Timeout or Network error):', err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const launcherVersionQuery = req.nextUrl.searchParams.get('launcherVersion') || FALLBACK_LAUNCHER_VERSION;
  const runtimeVersionQuery = req.nextUrl.searchParams.get('runtimeVersion') || RUNTIME_VERSION;

  try {
    const published = await getPublishedLauncher();
    
    if (!published) {
      // Return safe fallback instead of 500 error
      return NextResponse.json({
        launcherVersion: launcherVersionQuery,
        runtimeVersion: runtimeVersionQuery,
        mandatory: false,
        runtimeUrl: null,
        runtimeSha256: null,
        launcherUrl: null,
        launcherSha256: null,
        requireAuthentication: true,
        requireSubscription: false,
        updateUnavailable: true
      }, { status: 200 });
    }

    const launcherVersion = published.launcherVersion;
    const launcherUrl = `https://github.com/${GITHUB_REPOSITORY}/releases/download/${encodeURIComponent(published.releaseTag)}/cs2haze-launcher.zip`;
    
    const runtimeVersion = published.runtimeVersion;
    const runtimeUrl = `https://github.com/${GITHUB_REPOSITORY}/releases/download/${encodeURIComponent(published.releaseTag)}/cs2haze-runtime.zip`;

    return NextResponse.json({
      launcherVersion,
      runtimeVersion,
      mandatory: true,
      runtimeUrl,
      runtimeSha256: published.runtimeSha256,
      launcherUrl,
      launcherSha256: published.launcherSha256,
      requireAuthentication: true,
      requireSubscription: false,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err) {
    console.error('[Manifest API] Unexpected error handling request:', err);
    return NextResponse.json({
      launcherVersion: launcherVersionQuery,
      runtimeVersion: runtimeVersionQuery,
      mandatory: false,
      runtimeUrl: null,
      runtimeSha256: null,
      launcherUrl: null,
      launcherSha256: null,
      requireAuthentication: true,
      requireSubscription: false,
      updateUnavailable: true
    }, { status: 200 });
  }
}
