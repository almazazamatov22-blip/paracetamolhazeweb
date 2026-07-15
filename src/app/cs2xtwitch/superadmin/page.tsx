'use client'

import { useState, useEffect } from 'react'
import { Activity, Users, Zap, ShieldCheck } from 'lucide-react'

export default function SuperAdminPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<any>(null)
  const [user, setUser] = useState<{ login: string; id: string } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(userData => {
        if (!userData.id) {
          setError('Требуется авторизация')
          setLoading(false)
          return
        }
        setUser({ login: userData.login, id: userData.id })
        if (userData.id !== '119989080') {
          setError('Доступ запрещен. У вас нет прав Super Admin.')
          setLoading(false)
          return
        }
        
        // Fetch super admin data
        fetch('/api/cs2/superadmin')
          .then(res => res.json())
          .then(adminData => {
            if (adminData.error) {
              setError(adminData.error)
            } else {
              setData(adminData)
            }
            setLoading(false)
          })
          .catch(err => {
            setError(err.message)
            setLoading(false)
          })
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="adm-page adm-loading">
        <div className="adm-loading-small">Загрузка данных...</div>
        <style>{adminStyles}</style>
      </div>
    )
  }

  if (error || !user || user.id !== '119989080') {
    return (
      <div className="adm-page">
        <div className="adm-unauth">
          <ShieldCheck size={48} color="#f87171" />
          <h1>Доступ закрыт</h1>
          <p className="adm-unauth-desc">{error || 'У вас нет прав для просмотра этой страницы.'}</p>
          <a href="/cs2xtwitch" className="adm-btn adm-btn-ghost">На главную</a>
        </div>
        <style>{adminStyles}</style>
      </div>
    )
  }

  return (
    <div className="adm-page">
      <header className="adm-header">
        <div className="adm-header-left">
          <span className="adm-kicker">CS2×TWITCH SUPER ADMIN</span>
          <h1 className="adm-title">Глобальная панель управления</h1>
        </div>
        <div className="adm-user">
          <a href="/cs2xtwitch" className="adm-btn adm-btn-sm adm-btn-ghost">Выйти из панели</a>
        </div>
      </header>

      <main className="adm-body">
        <div className="sadm-grid">
          <div className="sadm-card">
            <div className="sadm-card-icon"><Users size={24} /></div>
            <div className="sadm-card-val">{data?.global.totalStreamers}</div>
            <div className="sadm-card-label">Активных стримеров</div>
          </div>
          <div className="sadm-card">
            <div className="sadm-card-icon" style={{ color: '#22c55e', background: '#13271d' }}><Activity size={24} /></div>
            <div className="sadm-card-val">{data?.global.totalRewards}</div>
            <div className="sadm-card-label">Создано наград</div>
          </div>
          <div className="sadm-card">
            <div className="sadm-card-icon" style={{ color: '#fbbf24', background: '#3b2a0c' }}><Zap size={24} /></div>
            <div className="sadm-card-val">{data?.global.recentActivationsCount}</div>
            <div className="sadm-card-label">Событий за последнее время</div>
          </div>
        </div>

        <div className="sadm-sections">
          <div className="sadm-section">
            <h2 className="adm-section-title">Стримеры ({data?.streamers.length})</h2>
            <div className="sadm-list">
              {data?.streamers.map((s: any) => (
                <div key={s.id} className="sadm-item">
                  <img src={s.twitch.avatar || 'https://static-cdn.jtvnw.net/user-default-pictures-uv/13e5fa74def22896-profile_image-70x70.png'} className="sadm-avatar" alt="" />
                  <div className="sadm-item-info">
                    <div className="sadm-item-name">{s.twitch.displayName}</div>
                    <div className="sadm-item-sub">ID: {s.id}</div>
                  </div>
                  <div className="sadm-item-stats">
                    <span className="adm-badge">{s.rewardsCount} наград</span>
                    <span className="adm-badge adm-badge-twitch">{s.activationsCount} запусков</span>
                  </div>
                </div>
              ))}
              {data?.streamers.length === 0 && <div className="adm-empty">Нет стримеров</div>}
            </div>
          </div>

          <div className="sadm-section">
            <h2 className="adm-section-title">Последние активации</h2>
            <div className="sadm-list">
              {data?.historyFeed.map((h: any) => {
                const streamer = data?.streamers.find((s: any) => s.id === h.streamer_id)?.twitch?.displayName || h.streamer_id;
                return (
                  <div key={h.id} className="sadm-history-item">
                    <div className="sadm-history-time">
                      {new Date(h.executed_at).toLocaleString('ru-RU')}
                    </div>
                    <div className="sadm-history-main">
                      <span className="sadm-history-user">{h.user_name}</span>
                      <span className="sadm-history-text">активировал(а)</span>
                      <span className="sadm-history-reward">«{h.reward_name}»</span>
                      <span className="sadm-history-text">у</span>
                      <span className="sadm-history-streamer">{streamer}</span>
                    </div>
                  </div>
                )
              })}
              {data?.historyFeed.length === 0 && <div className="adm-empty">Нет событий</div>}
            </div>
          </div>
        </div>
      </main>

      <style>{adminStyles}</style>
    </div>
  )
}

const adminStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');
  .adm-page {
    --adm-bg: #090a0f;
    --adm-panel: #14161f;
    --adm-panel-strong: #1b1e29;
    --adm-text: #f5f7fb;
    --adm-muted: #8d93a5;
    --adm-purple: #9146ff;
    min-height: 100vh;
    background: var(--adm-bg);
    color: var(--adm-text);
    font-family: 'Outfit', system-ui, -apple-system, sans-serif;
  }
  .adm-page * { box-sizing: border-box; }
  .adm-loading, .adm-unauth {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 20px;
    color: var(--adm-muted);
  }
  .adm-unauth {
    width: min(440px, calc(100% - 32px));
    min-height: auto;
    margin: 12vh auto 0;
    padding: 42px 32px;
    background: var(--adm-panel);
    border: none;
    border-radius: 20px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.2);
  }
  .adm-unauth h1 { font-size: 26px; color: var(--adm-text); font-weight: 800; letter-spacing: -0.03em; margin: 0;}
  .adm-unauth-desc { font-size: 15px; color: var(--adm-muted); max-width: 360px; text-align: center; line-height: 1.6; }
  .adm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 32px;
    background: #090a0f;
    border-bottom: 2px solid #14161f;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .adm-header-left { display: flex; flex-direction: column; gap: 3px; }
  .adm-kicker { color: #f87171; font-size: 11px; font-weight: 800; letter-spacing: 0.16em; }
  .adm-title { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.025em; }
  .adm-user {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 15px;
    color: #a8adbb;
    font-weight: 600;
  }
  .adm-body {
    max-width: 1200px;
    margin: 0 auto;
    padding: 46px 24px 80px;
    display: flex;
    flex-direction: column;
    gap: 48px;
  }
  .adm-section-title { font-size: 24px; font-weight: 800; letter-spacing: -0.025em; margin: 0 0 20px; color: var(--adm-text); }
  
  .sadm-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  .sadm-card {
    background: var(--adm-panel);
    border-radius: 20px;
    padding: 30px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.15);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .sadm-card-icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: #251b3d;
    color: #c89cff;
    display: grid;
    place-items: center;
    margin-bottom: 8px;
  }
  .sadm-card-val { font-size: 42px; font-weight: 900; line-height: 1; letter-spacing: -0.03em; }
  .sadm-card-label { font-size: 15px; color: var(--adm-muted); font-weight: 500; }

  .sadm-sections {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
  }
  .sadm-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 600px;
    overflow-y: auto;
    padding-right: 10px;
  }
  .sadm-list::-webkit-scrollbar { width: 6px; }
  .sadm-list::-webkit-scrollbar-thumb { background: #222633; border-radius: 6px; }

  .sadm-item {
    background: var(--adm-panel);
    border-radius: 16px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .sadm-avatar {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    object-fit: cover;
  }
  .sadm-item-info { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .sadm-item-name { font-weight: 800; font-size: 16px; }
  .sadm-item-sub { font-size: 13px; color: var(--adm-muted); }
  .sadm-item-stats { display: flex; gap: 8px; }

  .sadm-history-item {
    background: var(--adm-panel);
    border-radius: 16px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sadm-history-time { font-size: 12px; color: var(--adm-muted); font-weight: 600; }
  .sadm-history-main { font-size: 15px; line-height: 1.5; }
  .sadm-history-user { font-weight: 800; color: #fff; }
  .sadm-history-reward { font-weight: 700; color: #a78bfa; }
  .sadm-history-streamer { font-weight: 800; color: #60a5fa; }
  .sadm-history-text { color: var(--adm-muted); margin: 0 5px; }

  .adm-badge {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 8px;
    background: #222633;
    color: #a0a6b5;
    white-space: nowrap;
    font-weight: 600;
  }
  .adm-badge-twitch { color: #c084fc; background: #26163f; }
  
  .adm-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 22px;
    border-radius: 12px;
    font-weight: 700;
    font-size: 15px;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
    text-decoration: none;
    white-space: nowrap;
    font-family: inherit;
  }
  .adm-btn-ghost {
    background: #222633;
    color: #c6cad6;
  }
  .adm-btn-ghost:hover { background: #2a2e3d; }
  .adm-btn-sm { padding: 8px 14px; font-size: 14px; }
  
  .adm-empty {
    color: #757b8c;
    padding: 32px;
    text-align: center;
    border: 2px dashed #222633;
    border-radius: 16px;
    font-size: 15px;
  }

  @media (max-width: 900px) {
    .sadm-grid { grid-template-columns: 1fr; }
    .sadm-sections { grid-template-columns: 1fr; }
  }
`
