import { NextRequest } from 'next/server';
import { handleTwitchWebhook } from '@/lib/twitch-webhook-handler';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  return handleTwitchWebhook(req);
}
