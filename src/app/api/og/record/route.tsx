import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const score = searchParams.get('score') || '0';
    const game = searchParams.get('game') || '67';
    const user = searchParams.get('user') || 'Игрок';

    const is67 = game === '67';
    const color = is67 ? '#06b6d4' : '#22d3ee'; // Cyan theme matching current UI
    const bg = is67 ? 'linear-gradient(to bottom right, #050505, #0a0a0a)' : 'linear-gradient(to bottom right, #050505, #080808)';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: bg,
            fontFamily: 'sans-serif',
            padding: '60px',
            position: 'relative'
          }}
        >
          {/* Decorative Circles */}
          <div style={{ position: 'absolute', top: -100, left: -100, width: 400, height: 400, borderRadius: 200, background: `${color}15`, filter: 'blur(80px)' }} />
          <div style={{ position: 'absolute', bottom: -100, right: -100, width: 400, height: 400, borderRadius: 200, background: '#a855f710', filter: 'blur(80px)' }} />

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '60px',
              padding: '60px 80px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 40px 100px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 20, textTransform: 'uppercase' }}>
              РЕКОРД УСТАНОВЛЕН
            </div>

            <div
              style={{
                fontSize: 180,
                fontWeight: 900,
                color: '#fff',
                lineHeight: 1,
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {score}
            </div>

            <div style={{ fontSize: 40, fontWeight: 900, color: color, textTransform: 'uppercase', letterSpacing: 4, marginBottom: 40, background: `linear-gradient(to bottom, #fff, ${color})`, backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent' }}>
              {is67 ? 'PROJECT 67' : 'УГАДАЙ КАДР'}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 15, padding: '20px 40px', background: 'rgba(255,255,255,0.05)', borderRadius: 30 }}>
               <div style={{ fontSize: 32, fontWeight: 800, color: '#fff' }}>{user}</div>
            </div>
          </div>

          <div style={{ position: 'absolute', bottom: 40, fontSize: 18, color: 'rgba(255,255,255,0.2)', fontWeight: 800, letterSpacing: 2 }}>
            PARACETAMOLHAZE.VERCEL.APP
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    return new Response(`Failed to generate image`, { status: 500 });
  }
}
