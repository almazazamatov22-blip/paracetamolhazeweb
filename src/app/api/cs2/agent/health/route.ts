import { NextResponse } from 'next/server';
import { CS2_AGENT_VERSION, CS2_AGENT_SOURCE_LENGTH, CS2_AGENT_SHA256 } from '@/generated/cs2-agent-source';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      agentVersion: CS2_AGENT_VERSION,
      sourceLength: CS2_AGENT_SOURCE_LENGTH,
      sha256: CS2_AGENT_SHA256
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (err: any) {
    console.error('[cs2/agent/health]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
