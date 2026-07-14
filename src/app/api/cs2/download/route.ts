import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.redirect('https://github.com/almazazamatov22-blip/paracetamolhazeweb/releases/latest/download/CS2Haze-Setup.exe');
}
