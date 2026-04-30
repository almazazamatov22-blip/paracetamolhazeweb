import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const API_KEY = '5ee2ab49-8a04-436d-ae88-cf6943b51018'
const BASE = 'https://kinopoiskapiunofficial.tech/api'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'No id' }, { status: 400 })

  try {
    const res = await fetch(
      `${BASE}/v2.2/films/${id}`,
      { headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' } }
    )
    const data = await res.json()
    
    if (data.message && data.message.includes('exceeded')) {
      throw new Error('quota')
    }

    return NextResponse.json(data)
  } catch (err) {
    // Fallback search by ID in database
    const kpId = id.startsWith('kp-') ? id : `kp-${id}`
    
    const { data: kinokadr } = await supabase
      .from('kinokadr_movies')
      .select('*')
      .eq('id', kpId)
      .single()

    if (kinokadr) {
      return NextResponse.json({
        kinopoiskId: parseInt(id),
        nameRu: kinokadr.title_ru,
        nameEn: kinokadr.title,
        nameOriginal: kinokadr.title,
        year: kinokadr.year,
        posterUrl: kinokadr.image_url,
        posterUrlPreview: kinokadr.image_url,
        genres: [{ genre: kinokadr.category || '' }],
        countries: [],
        type: kinokadr.type?.toUpperCase() || 'FILM',
        description: 'Информация загружена из локальной базы (API лимит исчерпан).',
        webUrl: `https://www.kinopoisk.ru/film/${id}/`
      })
    }

    const { data: emojino } = await supabase
      .from('emojino_movies')
      .select('*')
      .eq('id', kpId)
      .single()

    if (emojino) {
      return NextResponse.json({
        kinopoiskId: parseInt(id),
        nameRu: emojino.title_ru,
        nameEn: null,
        nameOriginal: null,
        year: emojino.year,
        posterUrl: `https://avatars.mds.yandex.net/get-kinopoisk-image/1898899/8efcd024-adcd-46f7-a30b-94c51449b800/orig`, // fallback image or something
        posterUrlPreview: `https://avatars.mds.yandex.net/get-kinopoisk-image/1898899/8efcd024-adcd-46f7-a30b-94c51449b800/orig`,
        genres: [],
        countries: [],
        type: 'FILM',
        description: 'Информация загружена из локальной базы (API лимит исчерпан).',
        webUrl: `https://www.kinopoisk.ru/film/${id}/`
      })
    }

    return NextResponse.json({ error: 'Not found even in fallback' }, { status: 404 })
  }
}
