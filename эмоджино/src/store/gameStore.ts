'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Movie, movies } from '@/data/movies'

export interface GameResult {
  date: string
  score: number
  mode: string
  correct: number
}

export interface LeaderboardEntry {
  name: string
  score: number
  isCurrentUser: boolean
  isTwitch: boolean
  mode: 'all' | 'film' | 'serial'
}

interface GameStore {
  username: string
  twitchLogin: string
  isTwitchAuth: boolean
gamesPlayed: number
  bestScore: number
  bestScoreFilm: number
  bestScoreSerial: number
  history: GameResult[]
  isPlaying: boolean
  currentQuestion: number
  score: number
  hintsUsed: number
  questions: Movie[]
  answers: (boolean | null)[]
  setUsername: (name: string) => void
  loginWithTwitch: (twitchLogin: string) => void
  logout: () => void
  startGame: (mode: 'all' | 'film' | 'serial') => void
  answerQuestion: (answer: string) => boolean
  useHint: () => string | null
  nextQuestion: () => void
  endGame: () => void
  resetGame: () => void
  getLeaderboard: (period: 'day' | 'week' | 'all') => LeaderboardEntry[]
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function normalizeAnswer(answer: string): string {
  return answer.toLowerCase().trim().replace(/ё/g, 'е').replace(/[-:.,!?'"\s]+/g, ' ')
}

function checkAnswer(input: string, movie: Movie): boolean {
  const normalized = normalizeAnswer(input)
  for (const alias of movie.aliases) {
    const normAlias = normalizeAnswer(alias)
    if (normalized === normAlias) return true
    if (normalized.length >= 2 && (normAlias.includes(normalized) || normalized.includes(normAlias))) return true
    if (normalized.length >= 3 && levenshtein(normalized, normAlias) <= 2) return true
  }
  return false
}

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const matrix = []
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
      }
    }
  }
  return matrix[b.length][a.length]
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      username: '',
      twitchLogin: '',
      isTwitchAuth: false,
      gamesPlayed: 0,
      bestScore: 0,
      bestScoreFilm: 0,
      bestScoreSerial: 0,
      history: [],
      isPlaying: false,
      currentQuestion: 0,
      score: 0,
      hintsUsed: 0,
      questions: [],
      answers: [],

      setUsername: (name) => set({ username: name }),

      loginWithTwitch: (twitchLogin) => set({ 
        username: twitchLogin, 
        twitchLogin, 
        isTwitchAuth: true 
      }),

      logout: () => set({ 
        username: '', 
        twitchLogin: '', 
        isTwitchAuth: false,
        gamesPlayed: 0,
        bestScore: 0,
        bestScoreFilm: 0,
        bestScoreSerial: 0,
        history: [] as GameResult[],
        isPlaying: false,
        currentQuestion: 0,
        score: 0,
        hintsUsed: 0,
        questions: [] as Movie[],
        answers: [] as (boolean | null)[]
      }),

      startGame: (mode) => {
        const pool = mode === 'all' ? movies : movies.filter(m => m.type === mode)
        const questions = shuffle(pool).slice(0, 5)
        set({
          isPlaying: true,
          currentQuestion: 0,
          score: 0,
          hintsUsed: 0,
          questions,
          answers: [] as (boolean | null)[],
          history: [] as GameResult[],
          gamesPlayed: 0,
          bestScore: 0,
          bestScoreFilm: 0,
          bestScoreSerial: 0
        })
      },

      answerQuestion: (answer) => {
        const { questions, currentQuestion, score } = get()
        const movie = questions[currentQuestion]
        const isCorrect = checkAnswer(answer, movie)
        
        set((state) => ({
          score: isCorrect ? state.score + Math.max(2, 5 - state.hintsUsed) : state.score,
          answers: [...state.answers, isCorrect]
        }))
        
        return isCorrect
      },

      useHint: () => {
        const { questions, currentQuestion, hintsUsed } = get()
        if (hintsUsed >= 3) return null
        set({ hintsUsed: hintsUsed + 1 })
        return questions[currentQuestion].hints[hintsUsed]
      },

      nextQuestion: () => {
        const { currentQuestion, questions } = get()
        if (currentQuestion < questions.length - 1) {
          set({ currentQuestion: currentQuestion + 1, hintsUsed: 0 })
        } else {
          get().endGame()
        }
      },

      endGame: () => {
        const { score, bestScore, bestScoreFilm, bestScoreSerial, gamesPlayed, history, username, questions } = get()
        const currentMode = questions[0]?.type === 'film' ? 'film' : questions[0]?.type === 'serial' ? 'serial' : 'all'
        
        const newHistory: GameResult = {
          date: new Date().toLocaleDateString('ru'),
          score,
          mode: currentMode,
          correct: get().answers.filter(a => a === true).length
        }
        
        let newBestScore = bestScore
        let newBestScoreFilm = bestScoreFilm
        let newBestScoreSerial = bestScoreSerial
        
        if (score > bestScore) newBestScore = score
        if (currentMode === 'film' && score > bestScoreFilm) newBestScoreFilm = score
        if (currentMode === 'serial' && score > bestScoreSerial) newBestScoreSerial = score
        
        set({
          isPlaying: false,
          gamesPlayed: gamesPlayed + 1,
          bestScore: newBestScore,
          bestScoreFilm: newBestScoreFilm,
          bestScoreSerial: newBestScoreSerial,
          history: [newHistory, ...history].slice(0, 20)
        })
      },

      resetGame: () => set({
        isPlaying: false,
        currentQuestion: 0,
        score: 0,
        hintsUsed: 0,
        questions: [],
        answers: []
      }),

      getLeaderboard: (period) => {
        const { username, bestScore, bestScoreFilm, bestScoreSerial, isTwitchAuth } = get()
        
        const entries: LeaderboardEntry[] = []
        
        if (username && bestScore > 0) {
          entries.push({ name: username, score: bestScore, isCurrentUser: true, isTwitch: isTwitchAuth, mode: 'all' })
        }
        if (username && bestScoreFilm > 0) {
          entries.push({ name: username + ' 🎬', score: bestScoreFilm, isCurrentUser: true, isTwitch: isTwitchAuth, mode: 'film' })
        }
        if (username && bestScoreSerial > 0) {
          entries.push({ name: username + ' 📺', score: bestScoreSerial, isCurrentUser: true, isTwitch: isTwitchAuth, mode: 'serial' })
        }
        
        entries.sort((a, b) => b.score - a.score)
        return entries.slice(0, 30)
      }
    }),
    {
      name: 'emoji-cinema-storage'
    }
  )
)