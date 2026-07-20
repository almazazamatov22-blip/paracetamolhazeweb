import { NextRequest } from 'next/server';
import { sharedSubscribeHandler, getSubscriptionStatus } from '@/lib/twitch-eventsub';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  return sharedSubscribeHandler(req, '/api/cs2/webhook');
}

export async function GET(req: NextRequest) {
  return getSubscriptionStatus(req, '/api/cs2/webhook');
}
