'use client'

import { useState, useEffect } from 'react'

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string; desc: string }> = {
  drop_weapon:   { label: 'Выбросить оружие',          icon: '🔫', color: '#1ed760', desc: 'Автоматически нажимает клавишу "G", выбрасывая активное оружие в игре.' },
  freeze_3:      { label: 'Заморозка 3 сек',            icon: '🧊', color: '#60d4f5', desc: 'Блокирует клавиши передвижения стримера на 3 секунды.' },
  freeze_5:      { label: 'Заморозка 5 сек',            icon: '❄️', color: '#38bdf8', desc: 'Блокирует клавиши передвижения стримера на 5 секунд.' },
  spin_180:      { label: 'Разворот 180°',              icon: '🔄', color: '#a78bfa', desc: 'Мгновенно разворачивает камеру игрока на 180 градусов.' },
  block_jump:    { label: 'Блок прыжка 30 сек',         icon: '🚫', color: '#fb7185', desc: 'Запрещает прыгать в течение 30 секунд (спамит кнопку прыжка).' },
  block_crouch:  { label: 'Блок приседания 30 сек',     icon: '🦆', color: '#fbbf24', desc: 'Запрещает приседать на 30 секунд (спамит кнопку приседания).' },
  play_sound:    { label: 'Звук на стриме',             icon: '🔊', color: '#34d399', desc: 'Проигрывает выбранный звуковой эффект на ПК стримера.' },
}

export default function CS2InteractivePage() {
  const [user, setUser] = useState<{ login: string; id: string; avatar?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [subscribeMsg, setSubscribeMsg] = useState('')
  const [copiedOverlay, setCopiedOverlay] = useState(false)

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
        setSubscribeMsg(`✅ Интеграция успешно активирована!`)
      } else {
        setSubscribeMsg(`❌ Ошибка подключения: ${data.error}`)
      }
    } catch (e: any) {
      setSubscribeMsg(`❌ ${e.message}`)
    } finally {
      setSubscribing(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopiedOverlay(true)
    setTimeout(() => setCopiedOverlay(false), 2000)
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
        <header className="cs2-header animate-fade-in">
          <div className="cs2-logo">
            <span className="cs2-logo-cs">CS2</span>
            <span className="cs2-logo-x">×</span>
            <span className="cs2-logo-twitch">TWITCH</span>
          </div>
          <p className="cs2-tagline">
            Позвольте вашим зрителям управлять игровым процессом в CS2 за баллы канала Twitch
          </p>

          {!loading && (
            <div className="cs2-auth-strip">
              {user ? (
                <div className="cs2-user-pill">
                  {user.avatar && <img src={user.avatar} alt={user.login} className="cs2-user-avatar" />}
                  <span className="cs2-user-name">{user.login}</span>
                  <a href="/cs2interactive/admin" className="cs2-btn cs2-btn-primary">
                    ⚙️ Панель управления
                  </a>
                </div>
              ) : (
                <a href="/auth/twitch?source=cs2interactive" className="cs2-btn cs2-btn-twitch">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                  </svg>
                  Войти через Twitch
                </a>
              )}
            </div>
          )}
        </header>

        {/* Step-by-Step Setup Wizard for logged in users */}
        {user && (
          <section className="cs2-wizard-section animate-slide-up">
            <h2 className="cs2-section-title">🔌 Мастер настройки интерактивности</h2>
            
            <div className="cs2-wizard-card">
              <div className="cs2-wizard-timeline">
                
                {/* Step 1 */}
                <div className="cs2-wizard-step">
                  <div className="cs2-step-node">
                    <span className="cs2-step-number">1</span>
                  </div>
                  <div className="cs2-step-content">
                    <h3 className="cs2-step-title">Подключение к Twitch</h3>
                    <p className="cs2-step-desc">
                      Активируйте подписку на события Twitch EventSub, чтобы сервер мог мгновенно получать сигналы о трате баллов на вашем канале.
                    </p>
                    <div className="cs2-step-actions">
                      <button
                        className="cs2-btn cs2-btn-primary"
                        onClick={handleSubscribe}
                        disabled={subscribing}
                        id="subscribe-btn"
                      >
                        {subscribing ? '⏳ Подключение...' : '⚡ Активировать интеграцию'}
                      </button>
                      {subscribeMsg && (
                        <span className={`cs2-step-msg-pill ${subscribeMsg.startsWith('✅') ? 'msg-ok' : 'msg-err'}`}>
                          {subscribeMsg}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="cs2-wizard-step">
                  <div className="cs2-step-node">
                    <span className="cs2-step-number">2</span>
                  </div>
                  <div className="cs2-step-content">
                    <h3 className="cs2-step-title">Скачивание и запуск Агента</h3>
                    <p className="cs2-step-desc">
                      Загрузите наш готовый скрипт авто-запуска. Он сам проверит наличие Node.js на компьютере, скачает портативную версию (если её нет), установит необходимые библиотеки для эмуляции ввода и запустит агент.
                    </p>
                    <div className="cs2-step-actions">
                      <a
                        href={`/api/cs2/agent/download-bat?streamerId=${user.id}`}
                        className="cs2-btn cs2-btn-download"
                      >
                        📥 Скачать авто-запуск (.bat)
                      </a>
                    </div>
                    <div className="cs2-tip-box">
                      💡 <strong>Как запустить:</strong> Переместите скачанный файл в любую удобную пустую папку и запустите двойным кликом. В этой папке также появится файл <code>start.bat</code> для удобного запуска в будущем.
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="cs2-wizard-step">
                  <div className="cs2-step-node">
                    <span className="cs2-step-number">3</span>
                  </div>
                  <div className="cs2-step-content">
                    <h3 className="cs2-step-title">Настройка OBS оверлея</h3>
                    <p className="cs2-step-desc">
                      Добавьте в OBS источник-браузер (Browser Source) с разрешением 1920x1080 и ссылкой ниже, чтобы вы и ваши зрители видели всплывающие уведомления и анимации во время активации наград.
                    </p>
                    <div className="cs2-copy-wrapper">
                      <div className="cs2-copy-input">
                        {typeof window !== 'undefined' ? window.location.origin : 'https://paracetamolhaze.ru'}/overlays/cs2.html?streamerId={user.id}
                      </div>
                      <button
                        onClick={() => copyToClipboard(`${typeof window !== 'undefined' ? window.location.origin : 'https://paracetamolhaze.ru'}/overlays/cs2.html?streamerId={user.id}`)}
                        className={`cs2-btn ${copiedOverlay ? 'cs2-btn-copied' : 'cs2-btn-copy'}`}
                      >
                        {copiedOverlay ? '✅ Скопировано!' : '📋 Копировать'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="cs2-wizard-step">
                  <div className="cs2-step-node">
                    <span className="cs2-step-number">4</span>
                  </div>
                  <div className="cs2-step-content">
                    <h3 className="cs2-step-title">Привязка наград</h3>
                    <p className="cs2-step-desc">
                      Создайте награды на Twitch за баллы канала, затем перейдите в панель управления наградами и сопоставьте ID наград с действиями в игре.
                    </p>
                    <div className="cs2-step-actions">
                      <a href="/cs2interactive/admin" className="cs2-btn cs2-btn-primary">
                        ⚙️ Перейти к привязке наград →
                      </a>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </section>
        )}

        {/* Actions showcase */}
        <section className="cs2-actions-section animate-slide-up">
          <h2 className="cs2-section-title">⚔️ Доступные действия в CS2</h2>
          <div className="cs2-actions-grid">
            {Object.entries(ACTION_LABELS).map(([key, info]) => (
              <div key={key} className="cs2-action-card" style={{ '--accent': info.color } as React.CSSProperties}>
                <div className="cs2-action-header">
                  <span className="cs2-action-icon">{info.icon}</span>
                  <span className="cs2-action-key">{key}</span>
                </div>
                <h3 className="cs2-action-title">{info.label}</h3>
                <p className="cs2-action-desc">{info.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works for guest users */}
        {!user && (
          <section className="cs2-how-section animate-slide-up">
            <h2 className="cs2-section-title">🛠️ Как это устроено?</h2>
            <div className="cs2-steps-grid">
              <div className="cs2-step-card">
                <div className="cs2-step-card-num">01</div>
                <h4>Twitch Webhooks</h4>
                <p>Наш сервер мгновенно ловит события покупки наград на вашем стриме через официальный Twitch EventSub API.</p>
              </div>
              <div className="cs2-step-card">
                <div className="cs2-step-card-num">02</div>
                <h4>Локальный Агент</h4>
                <p>Легковесный скрипт на ПК опрашивает очередь сервера и эмулирует нажатие клавиш в вашей игре.</p>
              </div>
              <div className="cs2-step-card">
                <div className="cs2-step-card-num">03</div>
                <h4>Анимированный оверлей</h4>
                <p>Оверлей в OBS показывает красивую карточку с ником зрителя и действием, которое он активировал.</p>
              </div>
            </div>
            
            <div className="cs2-guest-cta">
              <p>Готовы добавить интерактива на свои стримы?</p>
              <a href="/auth/twitch?source=cs2interactive" className="cs2-btn cs2-btn-twitch">
                Войти и начать настройку
              </a>
            </div>
          </section>
        )}

        {/* Nav links */}
        <nav className="cs2-nav animate-fade-in">
          {user && (
            <>
              <a href="/cs2interactive/admin" className="cs2-nav-link">⚙️ Настройки наград</a>
              <a href="/cs2interactive/history" className="cs2-nav-link">📜 История активаций</a>
            </>
          )}
          <a href="/" className="cs2-nav-link cs2-nav-back">← На главную</a>
        </nav>
      </div>

      <style>{`
        .cs2-page {
          min-height: 100vh;
          background: radial-gradient(ellipse at 20% 0%, rgba(30,215,96,0.08) 0%, transparent 50%),
                      radial-gradient(ellipse at 80% 100%, rgba(30,215,96,0.06) 0%, transparent 50%),
                      #08090d;
          color: #f1f3f9;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
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
          background: rgba(30,215,96,0.25);
          left: calc(var(--i, 0) * 3.3% + 1%);
          top: calc(var(--i, 0) * 3.1% + 2%);
          animation: cs2-float calc(12s + var(--i, 0) * 0.5s) ease-in-out infinite alternate;
        }
        @keyframes cs2-float {
          from { transform: translateY(0) scale(1); opacity: 0.1; }
          to { transform: translateY(-80px) scale(2.5); opacity: 0.5; }
        }
        
        /* Animations */
        .animate-fade-in {
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slide-up {
          animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .cs2-container {
          position: relative;
          z-index: 1;
          max-width: 960px;
          margin: 0 auto;
          padding: 64px 24px 96px;
          display: flex;
          flex-direction: column;
          gap: 64px;
        }
        
        /* Header */
        .cs2-header {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }
        .cs2-logo {
          font-size: clamp(48px, 12vw, 88px);
          font-weight: 900;
          letter-spacing: -0.05em;
          line-height: 0.9;
          display: flex;
          align-items: center;
          gap: 0.1em;
        }
        .cs2-logo-cs {
          background: linear-gradient(135deg, #1ed760, #1db954);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .cs2-logo-x {
          color: rgba(255,255,255,0.15);
          font-weight: 200;
          font-size: 0.7em;
        }
        .cs2-logo-twitch {
          background: linear-gradient(135deg, #a78bfa, #9146ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .cs2-tagline {
          color: rgba(241,243,249,0.6);
          font-size: 17px;
          line-height: 1.5;
          letter-spacing: -0.01em;
          max-width: 540px;
        }

        /* Buttons & Auth */
        .cs2-auth-strip {
          display: flex;
          gap: 16px;
          justify-content: center;
          margin-top: 12px;
        }
        .cs2-user-pill {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(8px);
          border-radius: 50px;
          padding: 6px 16px 6px 8px;
          font-size: 14px;
        }
        .cs2-user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
          border: 1.5px solid #1ed760;
        }
        .cs2-user-name {
          font-weight: 600;
          color: #fff;
        }
        
        .cs2-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 24px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          border: none;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          text-decoration: none;
          white-space: nowrap;
        }
        .cs2-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .cs2-btn-twitch {
          background: #9146ff;
          color: #fff;
          box-shadow: 0 4px 20px rgba(145, 70, 255, 0.25);
        }
        .cs2-btn-twitch:hover {
          background: #772ce8;
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(145, 70, 255, 0.4);
        }
        
        .cs2-btn-primary {
          background: linear-gradient(135deg, #1ed760, #1db954);
          color: #050608;
          box-shadow: 0 4px 16px rgba(30, 215, 96, 0.2);
        }
        .cs2-btn-primary:hover {
          opacity: 0.95;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(30, 215, 96, 0.35);
        }

        .cs2-btn-download {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        .cs2-btn-download:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: #1ed760;
          transform: translateY(-2px);
        }

        /* Wizard Cards */
        .cs2-section-title {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 24px;
          position: relative;
        }
        
        .cs2-wizard-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(16px);
          border-radius: 20px;
          padding: 32px 40px;
        }
        
        .cs2-wizard-timeline {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 40px;
        }
        .cs2-wizard-timeline::before {
          content: '';
          position: absolute;
          left: 17px;
          top: 8px;
          bottom: 8px;
          width: 2px;
          background: linear-gradient(to bottom, #1ed760 0%, rgba(255, 255, 255, 0.05) 100%);
          z-index: 0;
        }
        
        .cs2-wizard-step {
          display: flex;
          gap: 24px;
          position: relative;
          z-index: 1;
        }
        
        .cs2-step-node {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #08090d;
          border: 2px solid rgba(255, 255, 255, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
          flex-shrink: 0;
          transition: all 0.3s ease;
        }
        .cs2-wizard-step:hover .cs2-step-node {
          border-color: #1ed760;
          box-shadow: 0 0 12px rgba(30, 215, 96, 0.4);
          color: #1ed760;
        }
        
        .cs2-step-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .cs2-step-title {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin-top: 6px;
        }
        .cs2-step-desc {
          font-size: 14px;
          line-height: 1.6;
          color: rgba(241, 243, 249, 0.65);
        }
        .cs2-step-actions {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-top: 4px;
        }

        .cs2-step-msg-pill {
          font-size: 13px;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 550;
        }
        .msg-ok {
          background: rgba(30, 215, 96, 0.08);
          color: #1ed760;
          border: 1px solid rgba(30, 215, 96, 0.2);
        }
        .msg-err {
          background: rgba(239, 68, 68, 0.08);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .cs2-tip-box {
          background: rgba(30, 215, 96, 0.03);
          border: 1px solid rgba(30, 215, 96, 0.1);
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 13px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.8);
          margin-top: 6px;
        }
        .cs2-tip-box code {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          color: #1ed760;
        }

        /* Copy link inputs */
        .cs2-copy-wrapper {
          display: flex;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 4px;
          overflow: hidden;
          margin-top: 4px;
          max-width: 100%;
        }
        .cs2-copy-input {
          flex: 1;
          background: transparent;
          border: none;
          color: #1ed760;
          font-family: monospace;
          font-size: 13px;
          padding: 10px 14px;
          overflow-x: auto;
          white-space: nowrap;
          user-select: all;
          align-self: center;
        }
        .cs2-btn-copy {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          border-radius: 8px;
          padding: 8px 16px;
        }
        .cs2-btn-copy:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .cs2-btn-copied {
          background: rgba(30, 215, 96, 0.15);
          color: #1ed760;
          border-radius: 8px;
          padding: 8px 16px;
          border: 1px solid rgba(30, 215, 96, 0.3);
        }

        /* Actions Grid */
        .cs2-actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 20px;
        }
        .cs2-action-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }
        .cs2-action-card:hover {
          transform: translateY(-4px);
          background: rgba(255, 255, 255, 0.04);
          border-color: var(--accent, #1ed760);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 0 0 15px rgba(30, 215, 96, 0.05);
        }
        .cs2-action-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .cs2-action-icon {
          font-size: 32px;
        }
        .cs2-action-key {
          font-size: 11px;
          font-family: monospace;
          color: var(--accent, #1ed760);
          background: rgba(30, 215, 96, 0.05);
          border: 1px solid rgba(30, 215, 96, 0.15);
          padding: 2px 8px;
          border-radius: 4px;
        }
        .cs2-action-title {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
        }
        .cs2-action-desc {
          font-size: 13px;
          line-height: 1.6;
          color: rgba(241, 243, 249, 0.55);
        }

        /* How it works for guests */
        .cs2-steps-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        .cs2-step-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 32px 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          position: relative;
        }
        .cs2-step-card-num {
          font-size: 40px;
          font-weight: 900;
          color: rgba(30, 215, 96, 0.15);
          line-height: 1;
        }
        .cs2-step-card h4 {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
        }
        .cs2-step-card p {
          font-size: 14px;
          line-height: 1.6;
          color: rgba(241, 243, 249, 0.6);
        }
        
        .cs2-guest-cta {
          text-align: center;
          margin-top: 48px;
          background: rgba(30, 215, 96, 0.03);
          border: 1px solid rgba(30, 215, 96, 0.15);
          padding: 32px;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .cs2-guest-cta p {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
        }

        /* Navigation */
        .cs2-nav {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          justify-content: center;
          padding-top: 32px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        .cs2-nav-link {
          font-size: 14px;
          color: rgba(241, 243, 249, 0.6);
          text-decoration: none;
          padding: 8px 18px;
          border-radius: 8px;
          transition: all 0.2s;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
        }
        .cs2-nav-link:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
        }
        .cs2-nav-back {
          color: rgba(255, 255, 255, 0.4);
          background: transparent;
          border: none;
        }
        .cs2-nav-back:hover {
          background: transparent;
          color: #fff;
        }

        @media (max-width: 768px) {
          .cs2-container {
            padding: 48px 16px 64px;
            gap: 48px;
          }
          .cs2-wizard-card {
            padding: 24px;
          }
          .cs2-wizard-timeline::before {
            left: 11px;
          }
          .cs2-step-node {
            width: 24px;
            height: 24px;
            font-size: 12px;
          }
          .cs2-wizard-step {
            gap: 16px;
          }
          .cs2-steps-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .cs2-actions-grid {
            grid-template-columns: 1fr;
          }
          .cs2-copy-wrapper {
            flex-direction: column;
            gap: 8px;
            background: transparent;
            border: none;
            padding: 0;
          }
          .cs2-copy-input {
            width: 100%;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            box-sizing: border-box;
          }
          .cs2-btn-copy, .cs2-btn-copied {
            width: 100%;
          }
        }
      `}</style>
    </main>
  )
}
