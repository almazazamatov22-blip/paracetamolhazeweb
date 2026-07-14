import { NextResponse } from 'next/server';
import { CS2_AGENT_SOURCE } from '@/generated/cs2-agent-source';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return new NextResponse(CS2_AGENT_SOURCE, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Disposition': 'attachment; filename="cs2-agent.js"',
      },
    });
  } catch (err: any) {
    console.error('[cs2/agent/download]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
