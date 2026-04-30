import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import fs from 'fs'
import path from 'path'
import os from 'os'

export interface Timing {
  id: string
  filmId: string
  author: string
  timeStr: string // e.g. "01:23:45"
  description: string
  createdAt: string
  isSystem?: boolean
}

// Fallback to /tmp/timings.json if Redis is not configured
const DATA_FILE = path.join(os.tmpdir(), 'velcam_timings.json')

const redis = (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  ? new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
  : null;

// Mock system timings (like for popular films)
const MOCK_SYSTEM_TIMINGS: Timing[] = [
  {
    id: 'sys-301-1',
    filmId: '301', // Matrix
    author: 'Система (Кинопоиск / IMDB)',
    timeStr: '00:00:00',
    description: 'В фильме нет эротических сцен. Присутствует умеренное насилие.',
    createdAt: new Date().toISOString(),
    isSystem: true,
  },
  {
    id: 'sys-409424-1', // Dune
    filmId: '409424', // Dune
    author: 'Система (IMDB Parents Guide)',
    timeStr: '00:00:00',
    description: 'В фильме нет сцен с обнаженной натурой. Присутствует насилие / фантастика.',
    createdAt: new Date().toISOString(),
    isSystem: true,
  },
  {
    id: 'sys-4648722-1', // Besstyzhie Example
    filmId: '571335', // Shameless
    author: 'Система',
    timeStr: '00:00:00',
    description: 'В сериале множество откровенных эротических сцен. Стримить с максимальной осторожностью!',
    createdAt: new Date().toISOString(),
    isSystem: true,
  }
]

async function readTimings(): Promise<Timing[]> {
  try {
    if (redis) {
      const data = await redis.get<Timing[]>('kino_timings_db')
      return data || []
    } else {
      if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf-8')
        return JSON.parse(data)
      }
    }
  } catch (e) {
    console.error('Failed to read db', e)
  }
  return []
}

async function writeTimings(timings: Timing[]) {
  try {
    if (redis) {
      await redis.set('kino_timings_db', timings)
    } else {
      fs.writeFileSync(DATA_FILE, JSON.stringify(timings, null, 2))
    }
  } catch (e) {
    console.error('Failed to write db', e)
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const filmId = url.searchParams.get('filmId')
  if (!filmId) return NextResponse.json({ error: 'Missing filmId' }, { status: 400 })

  const allTimings = await readTimings()
  let filmTimings = allTimings.filter(t => t.filmId === filmId)

  // Append any system mocked ones if they match
  const systemTimings = MOCK_SYSTEM_TIMINGS.filter(t => t.filmId === filmId)
  
  // Combine and sort ascending by timeStr (HH:MM:SS)
  const result = [...systemTimings, ...filmTimings].sort((a, b) => a.timeStr.localeCompare(b.timeStr))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { filmId, author, timeStr, description } = body

    if (!filmId || !author || !description || !timeStr) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const newTiming: Timing = {
      id: Math.random().toString(36).substr(2, 9),
      filmId: String(filmId),
      author: String(author).trim(),
      timeStr: String(timeStr).trim(),
      description: String(description).trim(),
      createdAt: new Date().toISOString(),
    }

    const timings = await readTimings()
    timings.push(newTiming)
    await writeTimings(timings)

    return NextResponse.json(newTiming)
  } catch (e) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, adminKey } = body

    if (adminKey !== (process.env.ADMIN_KEY || 'almaz')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const timings = await readTimings()
    const newTimings = timings.filter(t => t.id !== id)
    await writeTimings(newTimings)

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, adminKey, timeStr, description, author } = body

    if (adminKey !== (process.env.ADMIN_KEY || 'almaz')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    if (!id || !timeStr || !description || !author) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const timings = await readTimings()
    const timingIndex = timings.findIndex(t => t.id === id)
    if (timingIndex === -1) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    timings[timingIndex] = {
      ...timings[timingIndex],
      timeStr: String(timeStr).trim(),
      description: String(description).trim(),
      author: String(author).trim()
    }
    await writeTimings(timings)

    return NextResponse.json(timings[timingIndex])
  } catch (e) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
