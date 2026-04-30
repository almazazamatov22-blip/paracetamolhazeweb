import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  ? new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
  : null;

export async function GET() {
  if (!redis) {
    return NextResponse.json({
      success: true,
      total_searches: 0,
      unique_users: 0
    });
  }

  try {
    const [totalResults, uniqueResults] = await Promise.all([
      redis.get<number>('twitch_total_searches'),
      redis.scard('twitch_unique_users')
    ]);

    return NextResponse.json({
      success: true,
      total_searches: totalResults || 0,
      unique_users: uniqueResults || 0
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ 
      success: true, 
      total_searches: 0, 
      unique_users: 0 
    });
  }
}
