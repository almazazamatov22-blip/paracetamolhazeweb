'use client'

import { useState, useEffect } from 'react'

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  drop_weapon:   { label: 'Выбросить оружие',          icon: '🔫', color: '#ff6b35' },
  freeze_3:      { label: 'Заморозка 3 сек',            icon: '🧊', color: '#60d4f5' },
  freeze_5:      { label: 'Заморозка 5 сек',            icon: '❄️', color: '#38bdf8' },
  spin_180:      { label: 'Разворот 180°',              icon: '🔄', color: '#a78bfa' },
  block_jump:    { label: 'Блок прыжка 30 сек',         icon: '🚫', color: '#fb7185' },
  block_crouch:  { label: 'Блок приседания 30 сек',     icon: '🦆', color: '#fbbf24' },
  play_sound:    { label: 'Звук на стриме',             icon: '🔊', color: '#34d399' },
}

export default function CS2Page() {
  const [user, setUser] = useState<{ login: string; id: string; avatar?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [subscribeMsg, setSubscribeMsg] = useState('')

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.login) setUser({ login: d.login, id: d.id, avatar: d.profile_image_url })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSubscribe() {
    setSubscribing(true)
    setSubscribeMsg('')
    try {
      const res = await fetch('/api/cs2/subscribe', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setSubscribeMsg(`✅ Подключено! Streamer ID: ${data.streamerId}`)
      } else {
        setSubscribeMsg(`❌ Ошибка: ${data.error}`)
      }
    } catch (e: any) {
      setSubscribeMsg(`❌ ${e.message}`)
    } finally {
      setSubscribing(false)
    }
  }

  return (
    <main className="cs2-page">
      {/* Background particles */}
      <div className="cs2-bg">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="cs2-particle" style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>

      <div className="cs2-container">
        {/* Header */}
        <header className="cs2-header">
          <div className="cs2-logo">
            <span className="cs2-logo-cs">CS2</span>
            <span className="cs2-logo-x">×</span>
            <span className="cs2-logo-twitch">TWITCH</span>
          </div>
          <p className="cs2-tagline">
            Зрители управляют стримером через Channel Points
          </p>

          {!loading && (
            <div className="cs2-auth-strip">
              {user ? (
                <div className="cs2-user-pill">
                  {user.avatar && <img src={user.avatar} alt={user.login} className="cs2-user-avatar" />}
                  <span>{user.login}</span>
                  <a href="/cs2/admin" className="cs2-btn cs2-btn-primary">
                    Открыть Админ-панель →
                  </a>
                </div>
              ) : (
                <a href="/auth/twitch?source=cs2" className="cs2-btn cs2-btn-twitch">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                  </svg>
                  Войти через Twitch
                </a>
              )}
            </div>
          )}
        </header>

        {/* Quick connect for authorized user */}
        {user && (
          <section className="cs2-connect-section">
            <div className="cs2-card cs2-connect-card">
              <h2 className="cs2-section-title">🔌 Быстрое подключение</h2>
              <p className="cs2-muted">
                Нажми кнопку чтобы зарегистрировать Webhook на твой канал.
                Делать это нужно один раз.
              </p>
              <button
                className="cs2-btn cs2-btn-primary"
                onClick={handleSubscribe}
                disabled={subscribing}
                id="subscribe-btn"
              >
                {subscribing ? '⏳ Подключение...' : '⚡ Подключить EventSub'}
              </button>
              {subscribeMsg && (
                <p className={`cs2-msg ${subscribeMsg.startsWith('✅') ? 'cs2-msg-ok' : 'cs2-msg-err'}`}>
                  {subscribeMsg}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Actions showcase */}
        <section className="cs2-actions-section">
          <h2 className="cs2-section-title">⚔️ Доступные действия</h2>
          <div className="cs2-actions-grid">
            {Object.entries(ACTION_LABELS).map(([key, info]) => (
              <div key={key} className="cs2-action-card" style={{ '--accent': info.color } as React.CSSProperties}>
                <div className="cs2-action-icon">{info.icon}</div>
                <div className="cs2-action-label">{info.label}</div>
                <div className="cs2-action-key">{key}</div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="cs2-how-section">
          <h2 className="cs2-section-title">🛠️ Как это работает</h2>
          <div className="cs2-steps">
            {[
              { n: '01', title: 'Настройка наград', desc: 'Создай награды Channel Points на Twitch и привяжи их в Админ-панели' },
              { n: '02', title: 'Локальный агент', desc: 'Скачай и запусти cs2-agent.js на своём ПК. Он подключается к сайту через polling' },
              { n: '03', title: 'OBS оверлей', desc: 'Добавь Browser Source в OBS с URL оверлея — зрители увидят анимацию активации' },
              { n: '04', title: 'В эфир!', desc: 'Зрители покупают награды → агент мгновенно выполняет действие в CS2' },
            ].map(step => (
              <div key={step.n} className="cs2-step">
                <div className="cs2-step-num">{step.n}</div>
                <div>
                  <div className="cs2-step-title">{step.title}</div>
                  <div className="cs2-step-desc">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Setup panel for logged in user */}
        {user && (
          <section className="cs2-setup-section">
            <h2 className="cs2-section-title">📋 Параметры подключения агента</h2>
            <div className="cs2-card">
              <div className="cs2-code-row">
                <span className="cs2-code-label">Streamer ID:</span>
                <code className="cs2-code-val" id="streamer-id-val">{user.id}</code>
              </div>
              <div className="cs2-code-row">
                <span className="cs2-code-label">Poll URL:</span>
                <code className="cs2-code-val">
                  {typeof window !== 'undefined' ? window.location.origin : 'https://paracetamolhaze.vercel.app'}/api/cs2/agent/poll?streamerId={user.id}
                </code>
              </div>
              <div className="cs2-code-row">
                <span className="cs2-code-label">Overlay URL:</span>
                <code className="cs2-code-val">
                  {typeof window !== 'undefined' ? window.location.origin : 'https://paracetamolhaze.vercel.app'}/overlays/cs2.html?streamerId={user.id}
                </code>
              </div>
              <div className="cs2-info-box">
                💡 Скачай <strong>cs2-agent.js</strong> из репозитория и запусти через:<br />
                <code>node cs2-agent.js --streamerId={user.id}</code>
              </div>
            </div>
          </section>
        )}

        {/* Nav links */}
        <nav className="cs2-nav">
          {user && (
            <>
              <a href="/cs2/admin" className="cs2-nav-link">⚙️ Настройки наград</a>
              <a href="/cs2/history" className="cs2-nav-link">📜 История активаций</a>
            </>
          )}
          <a href="/" className="cs2-nav-link cs2-nav-back">← Главная</a>
        </nav>
      </div>

      <style>{`
        .cs2-page {
          min-height: 100vh;
          background: radial-gradient(ellipse at 20% 0%, rgba(30,215,96,0.06) 0%, transparent 50%),
                      radial-gradient(ellipse at 80% 100%, rgba(255,107,53,0.08) 0%, transparent 50%),
                      #0a0a0a;
          color: #fff;
          font-family: 'Inter', sans-serif;
          position: relative;
          overflow-x: hidden;
        }
        .cs2-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }
        .cs2-particle {
          position: absolute;
          width: 2px;
          height: 2px;
          border-radius: 50%;
          background: rgba(30,215,96,0.3);
          left: calc(var(--i, 0) * 3.3% + 1%);
          top: calc(var(--i, 0) * 3.1% + 2%);
          animation: cs2-float calc(10s + var(--i, 0) * 0.4s) ease-in-out infinite alternate;
        }
        @keyframes cs2-float {
          from { transform: translateY(0) scale(1); opacity: 0.2; }
          to { transform: translateY(-60px) scale(2); opacity: 0.6; }
        }
        .cs2-container {
          position: relative;
          z-index: 1;
          max-width: 900px;
          margin: 0 auto;
          padding: 48px 24px 80px;
          display: flex;
          flex-direction: column;
          gap: 48px;
        }
        .cs2-header {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .cs2-logo {
          font-size: clamp(40px, 10vw, 80px);
          font-weight: 900;
          letter-spacing: -0.04em;
          line-height: 1;
          display: flex;
          align-items: baseline;
          gap: 0.12em;
        }
        .cs2-logo-cs {
          background: linear-gradient(135deg, #1ed760, #0aad48);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .cs2-logo-x {
          color: rgba(255,255,255,0.3);
          font-weight: 200;
        }
        .cs2-logo-twitch {
          background: linear-gradient(135deg, #9146ff, #bf9bff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .cs2-tagline {
          color: rgba(255,255,255,0.5);
          font-size: 16px;
          letter-spacing: 0.04em;
          max-width: 480px;
        }
        .cs2-auth-strip { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .cs2-user-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 50px;
          padding: 6px 16px 6px 8px;
          font-size: 14px;
        }
        .cs2-user-avatar {
          width: 28px; height: 28px;
          border-radius: 50%;
          object-fit: cover;
        }
        .cs2-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 22px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
          text-decoration: none;
          white-space: nowrap;
        }
        .cs2-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .cs2-btn-twitch {
          background: #9146ff;
          color: #fff;
        }
        .cs2-btn-twitch:hover { background: #772ce8; transform: translateY(-1px); }
        .cs2-btn-primary {
          background: linear-gradient(135deg, #1ed760, #0aad48);
          color: #000;
        }
        .cs2-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .cs2-section-title {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 20px;
          letter-spacing: -0.01em;
        }
        .cs2-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .cs2-connect-card { border-color: rgba(30,215,96,0.2); }
        .cs2-muted { color: rgba(255,255,255,0.5); font-size: 14px; line-height: 1.6; }
        .cs2-msg { font-size: 14px; padding: 10px 16px; border-radius: 8px; }
        .cs2-msg-ok { background: rgba(30,215,96,0.1); color: #1ed760; border: 1px solid rgba(30,215,96,0.2); }
        .cs2-msg-err { background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
        .cs2-actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 16px;
        }
        .cs2-action-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 20px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: all 0.25s;
          cursor: default;
        }
        .cs2-action-card:hover {
          border-color: var(--accent, rgba(255,255,255,0.2));
          background: rgba(255,255,255,0.06);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }
        .cs2-action-icon { font-size: 28px; }
        .cs2-action-label { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.9); }
        .cs2-action-key {
          font-size: 11px;
          font-family: monospace;
          color: var(--accent, rgba(255,255,255,0.3));
          background: rgba(255,255,255,0.05);
          padding: 2px 8px;
          border-radius: 4px;
          width: fit-content;
        }
        .cs2-steps { display: flex; flex-direction: column; gap: 20px; }
        .cs2-step {
          display: flex;
          align-items: flex-start;
          gap: 20px;
          padding: 20px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
        }
        .cs2-step-num {
          font-size: 32px;
          font-weight: 900;
          color: rgba(30,215,96,0.4);
          line-height: 1;
          flex-shrink: 0;
          width: 52px;
          text-align: center;
        }
        .cs2-step-title { font-weight: 600; margin-bottom: 4px; }
        .cs2-step-desc { font-size: 14px; color: rgba(255,255,255,0.5); line-height: 1.6; }
        .cs2-code-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .cs2-code-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.4); }
        .cs2-code-val {
          font-family: monospace;
          font-size: 13px;
          background: rgba(0,0,0,0.4);
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.08);
          word-break: break-all;
          color: #1ed760;
          user-select: all;
        }
        .cs2-info-box {
          background: rgba(30,215,96,0.06);
          border: 1px solid rgba(30,215,96,0.15);
          border-radius: 8px;
          padding: 14px 16px;
          font-size: 13px;
          line-height: 1.7;
          color: rgba(255,255,255,0.7);
        }
        .cs2-info-box code { color: #1ed760; font-family: monospace; }
        .cs2-nav {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          justify-content: center;
          padding-top: 16px;
          border-top: 1px solid rgba(255,255,255,0.07);
        }
        .cs2-nav-link {
          font-size: 14px;
          color: rgba(255,255,255,0.5);
          text-decoration: none;
          padding: 8px 16px;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .cs2-nav-link:hover { color: #fff; background: rgba(255,255,255,0.06); }
        .cs2-nav-back { color: rgba(255,255,255,0.3); }
        @media (max-width: 600px) {
          .cs2-container { padding: 32px 16px 60px; gap: 32px; }
          .cs2-actions-grid { grid-template-columns: repeat(2, 1fr); }
          .cs2-step { flex-direction: column; gap: 10px; }
          .cs2-step-num { font-size: 20px; width: auto; }
        }
      `}</style>
    </main>
  )
}
