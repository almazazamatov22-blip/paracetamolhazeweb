import { NextRequest } from 'next/server';
import { GET as supabaseGET, POST as supabasePOST } from '../loto-supabase/route';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return supabaseGET(req);
}

export async function POST(req: NextRequest) {
  return supabasePOST(req);
}
