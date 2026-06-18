'use client'

import { useState, useEffect, useCallback } from 'react'

const ACTION_ICONS: Record<string, string> = {
  drop_weapon:   '🔫',
  freeze_3:      '🧊',
  freeze_5:      '❄️',
  spin_180:      '🔄',
  block_jump:    '🚫',
  block_crouch:  '🦆',
  play_sound:    '🔊',
}

type HistoryEntry = {
  id: string
  user_name: string
  user_avatar: string | null
  reward_name: string
  action_type: string
  executed_at: string
}

export default function CS2HistoryPage() {
  const [user, setUser] = useState<{ login: string; id: string } | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const LIMIT = 50

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.login) setUser({ login: d.login, id: d.id }) })
      .catch(() => {})
  }, [])

  const loadHistory = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await fetch(`/api/cs2/history?streamerId=${user.id}&limit=${LIMIT}&page=${page}`)
      const data = await res.json()
      if (data.history) {
        setHistory(data.history)
        setTotal(data.total)
      }
    } catch {}
    finally { setLoading(false) }
  }, [user, page])

  useEffect(() => { loadHistory() }, [loadHistory])

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (!user && !loading) {
    return (
      <main className="hist-page">
        <div className="hist-center">
          <h1>🔐 Требуется авторизация</h1>
          <a href="/auth/twitch?source=cs2interactive" className="hist-btn hist-btn-twitch">Войти через Twitch</a>
        </div>
        <style>{histStyles}</style>
      </main>
    )
  }

  const pages = Math.ceil(total / LIMIT)

  return (
    <main className="hist-page">
      <header className="hist-header">
        <div>
          <a href="/cs2interactive/admin" className="hist-back-link">← Назад к настройкам</a>
          <h1 className="hist-title">📜 История активаций</h1>
        </div>
        <div className="hist-meta">
          <span className="hist-count">Всего: {total}</span>
          <button className="hist-btn hist-btn-ghost" onClick={loadHistory}>🔄 Обновить</button>
        </div>
      </header>

      <div className="hist-body">
        {loading && history.length === 0 && (
          <div className="hist-empty">Загрузка...</div>
        )}

        {!loading && history.length === 0 && (
          <div className="hist-empty">История пуста. Активации появятся здесь после выполнения наград.</div>
        )}

        {history.length > 0 && (
          <>
            <div className="hist-table">
              <div className="hist-thead">
                <div className="hist-th">Зритель</div>
                <div className="hist-th">Действие</div>
                <div className="hist-th">Награда</div>
                <div className="hist-th">Время</div>
              </div>
              {history.map(entry => (
                <div key={entry.id} className="hist-row">
                  <div className="hist-td hist-user">
                    {entry.user_avatar && (
                      <img src={entry.user_avatar} alt={entry.user_name} className="hist-avatar" />
                    )}
                    <span>{entry.user_name}</span>
                  </div>
                  <div className="hist-td">
                    <span className="hist-action-icon">{ACTION_ICONS[entry.action_type] ?? '❓'}</span>
                    <span className="hist-action-type">{entry.action_type}</span>
                  </div>
                  <div className="hist-td hist-reward-name">{entry.reward_name}</div>
                  <div className="hist-td hist-time">{formatDate(entry.executed_at)}</div>
                </div>
              ))}
            </div>

            {pages > 1 && (
              <div className="hist-pagination">
                <button
                  className="hist-btn hist-btn-ghost"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  ← Назад
                </button>
                <span className="hist-page-info">Страница {page + 1} из {pages}</span>
                <button
                  className="hist-btn hist-btn-ghost"
                  disabled={page >= pages - 1}
                  onClick={() => setPage(p => p + 1)}
                >
                  Вперёд →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{histStyles}</style>
    </main>
  )
}

const histStyles = `
  .hist-page { min-height: 100vh; background: #080808; color: #fff; font-family: 'Inter', sans-serif; }
  .hist-center {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 100vh; gap: 20px;
  }
  .hist-center h1 { font-size: 24px; }
  .hist-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 32px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
    flex-wrap: wrap;
    gap: 12px;
  }
  .hist-back-link { font-size: 12px; color: rgba(255,255,255,0.35); text-decoration: none; display: block; margin-bottom: 4px; }
  .hist-back-link:hover { color: rgba(255,255,255,0.7); }
  .hist-title { font-size: 20px; font-weight: 700; }
  .hist-meta { display: flex; align-items: center; gap: 12px; }
  .hist-count { font-size: 13px; color: rgba(255,255,255,0.4); }
  .hist-body { max-width: 960px; margin: 0 auto; padding: 32px 24px 80px; }
  .hist-empty { color: rgba(255,255,255,0.3); text-align: center; padding: 60px 0; font-size: 15px; }
  .hist-table {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    overflow: hidden;
  }
  .hist-thead {
    display: grid;
    grid-template-columns: 2fr 1.5fr 2fr 1.5fr;
    padding: 12px 20px;
    background: rgba(255,255,255,0.04);
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .hist-th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.35); }
  .hist-row {
    display: grid;
    grid-template-columns: 2fr 1.5fr 2fr 1.5fr;
    padding: 14px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    transition: background 0.15s;
    align-items: center;
  }
  .hist-row:last-child { border-bottom: none; }
  .hist-row:hover { background: rgba(255,255,255,0.03); }
  .hist-td { font-size: 14px; display: flex; align-items: center; gap: 8px; }
  .hist-user { font-weight: 500; }
  .hist-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
  .hist-action-icon { font-size: 18px; }
  .hist-action-type { font-size: 12px; font-family: monospace; color: rgba(255,255,255,0.45); }
  .hist-reward-name { color: rgba(255,255,255,0.7); }
  .hist-time { font-size: 12px; color: rgba(255,255,255,0.35); white-space: nowrap; }
  .hist-pagination {
    display: flex; align-items: center; justify-content: center;
    gap: 16px; margin-top: 24px;
  }
  .hist-page-info { font-size: 13px; color: rgba(255,255,255,0.4); }
  .hist-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 18px; border-radius: 8px; font-size: 13px;
    font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; text-decoration: none;
    font-family: inherit;
  }
  .hist-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .hist-btn-twitch { background: #9146ff; color: #fff; }
  .hist-btn-ghost { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.1); }
  .hist-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
  @media (max-width: 640px) {
    .hist-header { padding: 16px; }
    .hist-thead, .hist-row { grid-template-columns: 1fr 1fr; }
    .hist-th:nth-child(3), .hist-td:nth-child(3) { display: none; }
  }
`
