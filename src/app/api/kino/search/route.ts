import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const API_KEY = '5ee2ab49-8a04-436d-ae88-cf6943b51018'
const BASE = 'https://kinopoiskapiunofficial.tech/api'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('query') ?? ''
  if (!query.trim()) return NextResponse.json({ films: [] })

  try {
    const res = await fetch(
      `${BASE}/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(query)}&page=1`,
      { headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' } }
    )
    const data = await res.json()
    
    // If quota exceeded or error, use fallback
    if (data.message && data.message.includes('exceeded')) {
      throw new Error('quota')
    }

    if (!data.films || data.films.length === 0) {
      return await dbFallback(query)
    }

    return NextResponse.json(data)
  } catch (err) {
    return await dbFallback(query)
  }
}

async function dbFallback(query: string) {
  // Search in kinokadr_movies
  const { data: kinokadr } = await supabase
    .from('kinokadr_movies')
    .select('*')
    .or(`title.ilike.%${query}%,title_ru.ilike.%${query}%`)
    .limit(10)

  // Search in emojino_movies
  const { data: emojino } = await supabase
    .from('emojino_movies')
    .select('*')
    .ilike('title_ru', `%${query}%`)
    .limit(10)

  const films: any[] = []
  const seenIds = new Set()

  const processItem = (item: any) => {
    const numericId = parseInt(item.id.toString().replace('kp-', ''))
    if (seenIds.has(numericId)) return
    seenIds.add(numericId)
    
    // Fallback poster for items without one (like in emojino_movies)
    const poster = item.image_url || `https://avatars.mds.yandex.net/get-kinopoisk-image/1898899/8efcd024-adcd-46f7-a30b-94c51449b800/orig`

    films.push({
      filmId: numericId,
      nameRu: item.title_ru,
      nameEn: item.title || item.title_ru,
      year: item.year?.toString() || '',
      genres: item.category ? [{ genre: item.category }] : [],
      posterUrlPreview: poster,
      posterUrl: poster
    })
  }

  kinokadr?.forEach(processItem)
  emojino?.forEach(processItem)

  return NextResponse.json({ films })
}
