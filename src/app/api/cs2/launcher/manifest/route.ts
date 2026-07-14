import { NextResponse } from 'next/server';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    launcherVersion: "1.0.2",
    runtimeVersion: "2.0.6",
    mandatory: true,
    runtimeUrl: null,
    runtimeSha256: null,
    launcherUrl: null,
    launcherSha256: null,
    requireAuthentication: true,
    requireSubscription: false
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }
  });
}
