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
  mouse_shake:   '🖱️',
  flash_screen:  '💥',
  random_weapon_switch: '🎲',
  invert_mouse:  '🔃',
  low_sens_10:   '🐢',
  high_sens_10:  '🐇',
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
          <div className="hist-lock-icon">🔐</div>
          <h1>Требуется авторизация</h1>
          <p className="hist-center-sub">Войдите, чтобы просмотреть историю активаций</p>
          <a href="/auth/twitch?source=cs2xtwitch" className="hist-btn hist-btn-twitch">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
            Войти через Twitch
          </a>
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
          <a href="/cs2xtwitch/admin" className="hist-back-link">← Назад к настройкам</a>
          <h1 className="hist-title">История активаций</h1>
        </div>
        <div className="hist-meta">
          <span className="hist-count">Всего: <strong>{total}</strong></span>
          <button className="hist-btn hist-btn-ghost" onClick={loadHistory}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
            Обновить
          </button>
        </div>
      </header>

      <div className="hist-body">
        {loading && history.length === 0 && (
          <div className="hist-empty">
            <div className="hist-spinner" />
            <span>Загрузка...</span>
          </div>
        )}

        {!loading && history.length === 0 && (
          <div className="hist-empty">
            <div className="hist-empty-icon">📭</div>
            <span>История пуста. Активации появятся здесь после выполнения наград.</span>
          </div>
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
                    <span className="hist-action-badge">
                      <span className="hist-action-icon">{ACTION_ICONS[entry.action_type] ?? '❓'}</span>
                      <span className="hist-action-type">{entry.action_type}</span>
                    </span>
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
  * { margin: 0; padding: 0; box-sizing: border-box; }

  .hist-page {
    min-height: 100vh;
    background: #0f1117;
    color: #e5e7eb;
    font-family: 'Inter', system-ui, sans-serif;
  }

  /* ---------- Auth screen ---------- */
  .hist-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 12px;
  }
  .hist-lock-icon {
    font-size: 40px;
    margin-bottom: 4px;
  }
  .hist-center h1 {
    font-size: 22px;
    font-weight: 600;
    color: #e5e7eb;
  }
  .hist-center-sub {
    font-size: 14px;
    color: rgba(229,231,235,0.5);
    margin-bottom: 8px;
  }

  /* ---------- Header ---------- */
  .hist-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 32px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02);
    flex-wrap: wrap;
    gap: 12px;
  }
  .hist-back-link {
    font-size: 12px;
    color: rgba(229,231,235,0.35);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
    transition: color 0.15s ease;
  }
  .hist-back-link:hover {
    color: rgba(229,231,235,0.7);
  }
  .hist-title {
    font-size: 20px;
    font-weight: 600;
    color: #e5e7eb;
    letter-spacing: -0.01em;
  }
  .hist-meta {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .hist-count {
    font-size: 13px;
    color: rgba(229,231,235,0.35);
  }
  .hist-count strong {
    color: rgba(229,231,235,0.6);
    font-weight: 500;
  }

  /* ---------- Body ---------- */
  .hist-body {
    max-width: 960px;
    margin: 0 auto;
    padding: 32px 24px 80px;
  }

  /* ---------- Empty / Loading states ---------- */
  .hist-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: rgba(229,231,235,0.35);
    text-align: center;
    padding: 80px 0;
    font-size: 14px;
  }
  .hist-empty-icon {
    font-size: 32px;
    opacity: 0.6;
  }
  .hist-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(255,255,255,0.06);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: hist-spin 0.7s linear infinite;
  }
  @keyframes hist-spin {
    to { transform: rotate(360deg); }
  }

  /* ---------- Table ---------- */
  .hist-table {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px;
    overflow: hidden;
  }
  .hist-thead {
    display: grid;
    grid-template-columns: 2fr 1.5fr 2fr 1.5fr;
    padding: 12px 20px;
    background: rgba(255,255,255,0.03);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .hist-th {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(229,231,235,0.35);
    font-weight: 500;
  }
  .hist-row {
    display: grid;
    grid-template-columns: 2fr 1.5fr 2fr 1.5fr;
    padding: 14px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: background 0.15s ease;
    align-items: center;
  }
  .hist-row:last-child {
    border-bottom: none;
  }
  .hist-row:hover {
    background: rgba(255,255,255,0.03);
  }
  .hist-td {
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #e5e7eb;
  }
  .hist-user {
    font-weight: 500;
  }
  .hist-avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 1px solid rgba(255,255,255,0.06);
  }

  /* ---------- Action badge ---------- */
  .hist-action-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(99,102,241,0.08);
    border: 1px solid rgba(99,102,241,0.12);
    padding: 3px 10px 3px 6px;
    border-radius: 6px;
  }
  .hist-action-icon {
    font-size: 15px;
    line-height: 1;
  }
  .hist-action-type {
    font-size: 12px;
    font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', monospace;
    color: rgba(229,231,235,0.5);
  }

  .hist-reward-name {
    color: rgba(229,231,235,0.7);
  }
  .hist-time {
    font-size: 12px;
    color: rgba(229,231,235,0.35);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* ---------- Pagination ---------- */
  .hist-pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 24px;
  }
  .hist-page-info {
    font-size: 13px;
    color: rgba(229,231,235,0.35);
  }

  /* ---------- Buttons ---------- */
  .hist-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.15s ease;
    text-decoration: none;
    font-family: inherit;
    line-height: 1;
  }
  .hist-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .hist-btn-twitch {
    background: #9146ff;
    color: #fff;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    border-radius: 8px;
  }
  .hist-btn-twitch:hover {
    background: #a970ff;
  }
  .hist-btn-ghost {
    background: rgba(255,255,255,0.03);
    color: rgba(229,231,235,0.7);
    border: 1px solid rgba(255,255,255,0.06);
  }
  .hist-btn-ghost:hover:not(:disabled) {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.1);
    color: #e5e7eb;
  }

  /* ---------- Mobile ---------- */
  @media (max-width: 640px) {
    .hist-header {
      padding: 16px;
    }
    .hist-body {
      padding: 20px 16px 60px;
    }
    .hist-thead, .hist-row {
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .hist-th:nth-child(3), .hist-td:nth-child(3) {
      display: none;
    }
    .hist-th:nth-child(4), .hist-td:nth-child(4) {
      display: none;
    }
  }
`
