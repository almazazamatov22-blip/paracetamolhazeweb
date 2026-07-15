import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GITHUB_REPOSITORY = 'almazazamatov22-blip/paracetamolhazeweb';
const RELEASE_METADATA_URL =
  `https://github.com/${GITHUB_REPOSITORY}/releases/latest/download/cs2haze-release.json`;
const MINIMUM_SELF_UPDATING_VERSION = '1.0.4';
const FALLBACK_LAUNCHER_VERSION = '1.0.3';
const RUNTIME_VERSION = '2.0.6';

type ReleaseMetadata = {
  releaseTag: string;
  launcherVersion: string;
  launcherSha256: string;
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
  );
}

async function getPublishedLauncher(): Promise<ReleaseMetadata | null> {
  try {
    const response = await fetch(RELEASE_METADATA_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;

    const metadata: unknown = await response.json();
    return isReleaseMetadata(metadata) ? metadata : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const published = await getPublishedLauncher();
  const launcherVersion = published?.launcherVersion || FALLBACK_LAUNCHER_VERSION;
  const launcherUrl = published
    ? `https://github.com/${GITHUB_REPOSITORY}/releases/download/${encodeURIComponent(published.releaseTag)}/cs2haze-launcher.zip`
    : null;

  return NextResponse.json({
    launcherVersion,
    runtimeVersion: RUNTIME_VERSION,
    mandatory: true,
    runtimeUrl: null,
    runtimeSha256: null,
    launcherUrl,
    launcherSha256: published?.launcherSha256 || null,
    requireAuthentication: true,
    requireSubscription: false,
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
