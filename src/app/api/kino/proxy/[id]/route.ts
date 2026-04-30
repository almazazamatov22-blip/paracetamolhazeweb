import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id
  if (!id) return new NextResponse('Missing id', { status: 400 })

  const targetUrl = `https://fbsite.fun/${id}/`

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'Referer': 'https://velcam.ru/',
        'Origin': 'https://velcam.ru',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      return new NextResponse(`Upstream error: ${res.status}`, { status: res.status })
    }

    let html = await res.text()

    // Fix relative links — make them point to fbsite.fun
    html = html
      .replace(/src="\/\//g, 'src="https://')
      .replace(/href="\/\//g, 'href="https://')
      .replace(/src="\//g, 'src="https://fbsite.fun/')
      .replace(/href="\//g, 'href="https://fbsite.fun/')
      // Inject base tag so relative JS/CSS loads from fbsite.fun
      .replace('<head>', '<head><base href="https://fbsite.fun/" />')

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'ALLOWALL',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=59',
      },
    })
  } catch (err) {
    console.error('Proxy error:', err)
    return new NextResponse('Proxy error', { status: 500 })
  }
}
