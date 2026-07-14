import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.redirect('https://github.com/almazazamatov22-blip/paracetamolhazeweb/releases/download/cs2haze-v2.0.6.2/CS2Haze-Setup.exe');
}
