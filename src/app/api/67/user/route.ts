import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('twitch_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(`${request.nextUrl.origin}/api/auth/me`, {
      headers: { Cookie: `twitch_token=${token}` }
    });
    const data = await res.json();
    
    if (!res.ok) return NextResponse.json(data, { status: res.status });

    return NextResponse.json({
      success: true,
      user: {
        id: data.id,
        name: data.display_name,
        image: data.profile_image_url,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
