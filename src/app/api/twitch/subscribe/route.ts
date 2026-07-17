import { NextRequest } from 'next/server';
import { sharedSubscribeHandler } from '@/lib/twitch-eventsub';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  return sharedSubscribeHandler(req);
}
