'use client'

import { useEffect, useState, type CSSProperties } from 'react'

import { ACTION_REGISTRY } from '@/lib/cs2-actions'

const UI_COLORS: Record<string, string> = {
  drop_weapon: '#ef4444',
  freeze_3: '#60a5fa',
  freeze_5: '#38bdf8',
  spin_180: '#a78bfa',
  block_jump: '#f87171',
  block_crouch: '#fbbf24',
  play_sound: '#34d399',
  mouse_shake: '#fb923c',
  flash_screen: '#fcd34d',
  random_weapon_switch: '#c084fc',
  invert_mouse: '#22d3ee',
  low_sens_10: '#86efac',
  high_sens_10: '#fca5a5',
  spinbot: '#f472b6',
}

const ACTION_LABELS = Object.fromEntries(
  Object.entries(ACTION_REGISTRY).map(([key, value]) => [
    key,
    {
      label: value.label,
      icon: value.icon,
      color: UI_COLORS[key] || '#94a3b8',
      desc: value.description,
      durationMs: value.durationMs,
    },
  ])
)

function formatDuration(durationMs: number) {
  if (durationMs < 1000) return `${durationMs} мс`
  return `${durationMs / 1000} сек`
}

export default function CS2InteractivePage() {
  const [user, setUser] = useState<{ login: string; id: string; avatar?: string } | null>(null)
  const [subscribing, setSubscribing] = useState(false)
  const [subscribeMsg, setSubscribeMsg] = useState('')
  const [copiedOverlay, setCopiedOverlay] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(response => response.json())
      .then(data => {
        if (data.login) {
          setUser({ login: data.login, id: data.id, avatar: data.profile_image_url })
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!user) return

    fetch('/api/cs2/subscribe')
      .then(response => response.json())
      .then(data => {
        if (typeof data.isSubscribed === 'boolean') {
          setIsSubscribed(data.isSubscribed)
        }
      })
      .catch(() => {})
  }, [user])

  async function handleSubscribe() {
    setSubscribing(true)
    setSubscribeMsg('')

    try {
      const response = await fetch('/api/cs2/subscribe', { method: 'POST' })
      const data = await response.json()

      if (data.success) {
        setSubscribeMsg('Интеграция успешно активирована')
        setIsSubscribed(true)
      } else {
        setSubscribeMsg(`Ошибка подключения: ${data.error}`)
      }
    } catch (error: unknown) {
      setSubscribeMsg(error instanceof Error ? error.message : 'Не удалось подключиться')
    } finally {
      setSubscribing(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopiedOverlay(true)
    setTimeout(() => setCopiedOverlay(false), 2000)
  }

  const overlayUrl = user
    ? `https://paracetamolhaze.ru/overlays/cs2.html?streamerId=${user.id}`
    : ''

  return (
    <main className="cs2-page">
      <div className="cs2-ambient cs2-ambient-one" aria-hidden="true" />
      <div className="cs2-ambient cs2-ambient-two" aria-hidden="true" />

      <div className="cs2-container">
        <header className="cs2-hero animate-fade-in">
          <span className="cs2-eyebrow">CS2 INTERACTIVE</span>
          <div className="cs2-logo" aria-label="CS2 и Twitch">
            <span className="cs2-logo-cs">CS2</span>
            <span className="cs2-logo-x">×</span>
            <span className="cs2-logo-twitch">TWITCH</span>
          </div>
          <h1>Зрители запускают эффекты. Вы управляете правилами.</h1>
          <p className="cs2-tagline">
            Подключите баллы канала Twitch к действиям в CS2 — без ручных скриптов и сложной настройки.
          </p>

          <div className="cs2-hero-actions">
            {user ? (
              <div className="cs2-user-card">
                {user.avatar && <img src={user.avatar} alt="" className="cs2-user-avatar" />}
                <span className="cs2-user-name">{user.login}</span>
                <span className="cs2-user-status">Twitch подключён</span>
                <a href="/cs2interactive/admin" className="cs2-btn cs2-btn-primary">
                  Открыть панель управления
                </a>
              </div>
            ) : (
              <a href="/auth/twitch?source=cs2interactive" className="cs2-btn cs2-btn-twitch">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                </svg>
                Войти через Twitch
              </a>
            )}
          </div>
        </header>

        <section className="cs2-launch-section animate-slide-up" aria-labelledby="launch-title">
          <div className="cs2-section-heading cs2-section-heading-centered">
            <span className="cs2-section-kicker">БЫСТРЫЙ СТАРТ</span>
            <h2 id="launch-title">Как запустить интерактив — 1–2 минуты</h2>
          </div>

          <div className="cs2-launch-grid">
            <article className="cs2-launch-card">
              <span className="cs2-step-badge">1</span>
              <div className="cs2-step-icon" aria-hidden="true">↓</div>
              <h3>Скачайте лаунчер</h3>
              <p>Установщик для Windows 10/11. Node.js и ручная настройка не нужны.</p>
              <a href="/download/cs2haze" className="cs2-card-link">
                Скачать CS2Haze
              </a>
            </article>

            <article className="cs2-launch-card cs2-smartscreen-card">
              <span className="cs2-step-badge">2</span>
              <div className="cs2-smartscreen-preview" aria-label="Пример предупреждения Windows SmartScreen">
                <strong>Система Windows защитила компьютер</strong>
                <span>Приложение пока без цифровой подписи.</span>
                <b>Подробнее</b>
              </div>
              <h3>Подтвердите запуск</h3>
              <p>
                Если появится предупреждение, проверьте, что скачивание началось по кнопке на этой странице,
                нажмите <strong>«Подробнее»</strong>, затем <strong>«Выполнить в любом случае»</strong>.
              </p>
            </article>

            <article className="cs2-launch-card">
              <span className="cs2-step-badge">3</span>
              <div className="cs2-step-icon cs2-step-icon-twitch" aria-hidden="true">▣</div>
              <h3>Войдите через Twitch</h3>
              <p>Без передачи пароля: авторизация проходит на официальной странице Twitch OAuth.</p>
              {!user && <span className="cs2-card-muted">Кнопка входа находится выше</span>}
              {user && <span className="cs2-card-complete">Готово · {user.login}</span>}
            </article>

            <article className="cs2-launch-card">
              <span className="cs2-step-badge">4</span>
              <div className="cs2-step-icon" aria-hidden="true">◇</div>
              <h3>Создайте награды</h3>
              <p>Выберите эффекты, стоимость и задержку — CS2Haze создаст награды на Twitch.</p>
              {user ? (
                <a href="/cs2interactive/admin" className="cs2-card-link">
                  Настроить награды
                </a>
              ) : (
                <span className="cs2-card-muted">После входа в Twitch</span>
              )}
            </article>
          </div>

          <p className="cs2-oauth-note">
            <span aria-hidden="true">●</span> Мы не просим пароль — используется только официальный OAuth Twitch.
          </p>
        </section>

        {user && (
          <section className="cs2-control-section animate-slide-up" aria-labelledby="control-title">
            <div className="cs2-section-heading">
              <span className="cs2-section-kicker">ВАША НАСТРОЙКА</span>
              <h2 id="control-title">Подготовьте стрим к работе</h2>
              <p>Три действия перед запуском трансляции.</p>
            </div>

            <div className="cs2-control-grid">
              <article className="cs2-control-card">
                <div className="cs2-control-topline">
                  <span className={`cs2-status-dot ${isSubscribed ? 'is-ready' : ''}`} />
                  <span>{isSubscribed ? 'EventSub активен' : 'Требуется подключение'}</span>
                </div>
                <h3>События Twitch</h3>
                <p>Разрешите серверу получать активации наград канала.</p>
                <button
                  className="cs2-btn cs2-btn-primary"
                  onClick={handleSubscribe}
                  disabled={subscribing || isSubscribed}
                  id="subscribe-btn"
                >
                  {subscribing ? 'Подключаем…' : isSubscribed ? 'Интеграция активна' : 'Активировать интеграцию'}
                </button>
                {subscribeMsg && (
                  <span className={`cs2-inline-message ${isSubscribed ? 'is-success' : 'is-error'}`}>
                    {subscribeMsg}
                  </span>
                )}
              </article>

              <article className="cs2-control-card">
                <div className="cs2-control-topline">
                  <span className="cs2-status-dot" />
                  <span>OBS Browser Source</span>
                </div>
                <h3>Оверлей уведомлений</h3>
                <p>Добавьте источник-браузер 1920×1080 и вставьте персональную ссылку.</p>
                <div className="cs2-copy-wrapper">
                  <code className="cs2-copy-input">{overlayUrl}</code>
                  <button
                    onClick={() => copyToClipboard(overlayUrl)}
                    className={`cs2-btn ${copiedOverlay ? 'cs2-btn-copied' : 'cs2-btn-ghost'}`}
                  >
                    {copiedOverlay ? 'Скопировано' : 'Копировать'}
                  </button>
                </div>
              </article>

              <article className="cs2-control-card">
                <div className="cs2-control-topline">
                  <span className="cs2-status-dot is-ready" />
                  <span>Панель управления</span>
                </div>
                <h3>Эффекты и награды</h3>
                <p>Создавайте, включайте и редактируйте награды в одном месте.</p>
                <a href="/cs2interactive/admin" className="cs2-btn cs2-btn-primary">
                  Перейти к наградам
                </a>
              </article>
            </div>
          </section>
        )}

        <section className="cs2-actions-section animate-slide-up" aria-labelledby="actions-title">
          <div className="cs2-section-heading">
            <span className="cs2-section-kicker">КАТАЛОГ ЭФФЕКТОВ</span>
            <h2 id="actions-title">Доступные действия в CS2</h2>
            <p>От короткого звука до полного хаоса с мышью — выберите то, что подходит вашему стриму.</p>
          </div>

          <div className="cs2-actions-grid">
            {Object.entries(ACTION_LABELS).map(([key, info]) => (
              <article
                key={key}
                className="cs2-action-card"
                style={{ '--accent': info.color } as CSSProperties}
              >
                <div className="cs2-action-header">
                  <span className="cs2-action-icon" aria-hidden="true">{info.icon}</span>
                  <span className="cs2-action-key">{key}</span>
                </div>
                <h3 className="cs2-action-title">{info.label}</h3>
                <p className="cs2-action-desc">{info.desc}</p>
                <span className="cs2-action-duration">до {formatDuration(info.durationMs)}</span>
              </article>
            ))}
          </div>
        </section>

        <nav className="cs2-nav animate-fade-in" aria-label="Навигация CS2 Interactive">
          {user && (
            <>
              <a href="/cs2interactive/admin" className="cs2-nav-link">Настройки наград</a>
              <a href="/cs2interactive/history" className="cs2-nav-link">История активаций</a>
            </>
          )}
          <a href="/" className="cs2-nav-link cs2-nav-back">← На главную</a>
        </nav>
      </div>

      <style>{`
        .cs2-page {
          --bg: #0b0c12;
          --panel: #13151d;
          --panel-strong: #181a24;
          --line: rgba(255,255,255,0.085);
          --line-strong: rgba(255,255,255,0.14);
          --text: #f5f7fb;
          --muted: #8d93a5;
          --purple: #9146ff;
          --purple-light: #ad72ff;
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          position: relative;
          overflow-x: hidden;
        }
        .cs2-page * { box-sizing: border-box; }
        .cs2-ambient {
          position: fixed;
          width: 520px;
          height: 520px;
          border-radius: 50%;
          filter: blur(120px);
          opacity: .12;
          pointer-events: none;
        }
        .cs2-ambient-one { background: #6d28d9; top: -280px; left: 12%; }
        .cs2-ambient-two { background: #2563eb; top: 240px; right: -360px; opacity: .07; }
        .cs2-container {
          width: min(1080px, calc(100% - 32px));
          margin: 0 auto;
          padding: 54px 0 72px;
          display: flex;
          flex-direction: column;
          gap: 76px;
          position: relative;
          z-index: 1;
        }
        .animate-fade-in { animation: cs2Fade .45s ease both; }
        .animate-slide-up { animation: cs2Rise .5s ease both; }
        @keyframes cs2Fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cs2Rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in, .animate-slide-up { animation: none; }
        }

        .cs2-hero {
          max-width: 760px;
          margin: 0 auto;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .cs2-eyebrow, .cs2-section-kicker {
          color: var(--purple-light);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .18em;
        }
        .cs2-logo {
          display: flex;
          align-items: center;
          gap: .12em;
          font-size: clamp(50px, 8vw, 78px);
          font-weight: 950;
          letter-spacing: -.06em;
          line-height: .9;
        }
        .cs2-logo-cs, .cs2-logo-twitch {
          background: linear-gradient(135deg, #6d78ff, #b34cff);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .cs2-logo-twitch { background-image: linear-gradient(135deg, #9d69ff, #d044ff); }
        .cs2-logo-x { color: #343744; font-size: .6em; font-weight: 300; }
        .cs2-hero h1 {
          max-width: 650px;
          font-size: clamp(24px, 4vw, 38px);
          line-height: 1.08;
          letter-spacing: -.04em;
          margin: 5px 0 0;
        }
        .cs2-tagline {
          max-width: 610px;
          color: var(--muted);
          font-size: 16px;
          line-height: 1.65;
          margin: 0;
        }
        .cs2-hero-actions { margin-top: 8px; min-height: 46px; }
        .cs2-user-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 7px 6px 10px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,.035);
          border-radius: 12px;
        }
        .cs2-user-avatar { width: 30px; height: 30px; border-radius: 8px; object-fit: cover; }
        .cs2-user-name { font-size: 14px; font-weight: 700; }
        .cs2-user-status { color: #55d88b; font-size: 12px; margin-right: 4px; }

        .cs2-btn, .cs2-card-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 42px;
          padding: 10px 18px;
          border-radius: 8px;
          border: 1px solid transparent;
          font: inherit;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          text-decoration: none;
          transition: transform .18s ease, background .18s ease, border-color .18s ease;
        }
        .cs2-btn:hover, .cs2-card-link:hover { transform: translateY(-1px); }
        .cs2-btn:disabled { opacity: .58; cursor: default; transform: none; }
        .cs2-btn-twitch { color: white; background: var(--purple); box-shadow: 0 10px 30px rgba(145,70,255,.22); }
        .cs2-btn-twitch:hover { background: #a45dff; }
        .cs2-btn-primary { color: white; background: #7650f5; }
        .cs2-btn-primary:hover { background: #8968f8; }
        .cs2-btn-ghost { color: #d9dce6; background: rgba(255,255,255,.05); border-color: var(--line); }
        .cs2-btn-copied { color: #7ee2a8; background: rgba(50,190,110,.1); border-color: rgba(80,220,140,.22); }

        .cs2-section-heading { max-width: 690px; margin-bottom: 24px; }
        .cs2-section-heading-centered { text-align: center; margin: 0 auto 24px; }
        .cs2-section-heading h2 {
          margin: 7px 0 0;
          color: var(--text);
          font-size: clamp(23px, 3vw, 31px);
          line-height: 1.2;
          letter-spacing: -.035em;
        }
        .cs2-section-heading p { color: var(--muted); line-height: 1.6; margin: 10px 0 0; }
        .cs2-launch-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        .cs2-launch-card, .cs2-control-card, .cs2-action-card {
          position: relative;
          border: 1px solid var(--line);
          background: linear-gradient(180deg, rgba(255,255,255,.038), rgba(255,255,255,.022));
          border-radius: 12px;
        }
        .cs2-launch-card {
          min-height: 250px;
          padding: 26px 18px 20px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
        }
        .cs2-launch-card:hover, .cs2-control-card:hover { border-color: rgba(164,93,255,.35); }
        .cs2-step-badge {
          position: absolute;
          top: 10px;
          left: 10px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          color: white;
          background: var(--purple);
          font-size: 11px;
          font-weight: 800;
          box-shadow: 0 0 0 4px rgba(145,70,255,.1);
        }
        .cs2-step-icon {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          margin: 20px auto 8px;
          border-radius: 50%;
          color: #c89cff;
          background: rgba(145,70,255,.13);
          border: 1px solid rgba(164,93,255,.28);
          font-size: 25px;
          align-self: center;
        }
        .cs2-step-icon-twitch { border-radius: 11px; }
        .cs2-launch-card h3, .cs2-control-card h3, .cs2-action-card h3 { margin: 0; color: var(--text); }
        .cs2-launch-card h3 { font-size: 15px; align-self: center; text-align: center; }
        .cs2-launch-card p { color: var(--muted); font-size: 12px; line-height: 1.55; margin: 0; text-align: center; }
        .cs2-card-link {
          min-height: auto;
          margin-top: auto;
          padding: 7px 10px;
          width: 100%;
          color: #cda9ff;
          background: rgba(145,70,255,.08);
          border-color: rgba(145,70,255,.18);
          font-size: 12px;
        }
        .cs2-card-complete, .cs2-card-muted {
          width: 100%;
          margin-top: auto;
          text-align: center;
          color: #65d99a;
          font-size: 12px;
          font-weight: 700;
        }
        .cs2-card-muted { color: #666c7d; }
        .cs2-smartscreen-preview {
          width: 100%;
          min-height: 88px;
          margin: 10px 0 2px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          color: #111827;
          background: #edf4ff;
          border: 1px solid #90bfff;
          border-radius: 5px;
          font-family: 'Segoe UI', sans-serif;
          text-align: left;
        }
        .cs2-smartscreen-preview strong { font-size: 10px; }
        .cs2-smartscreen-preview span { color: #46556e; font-size: 8px; line-height: 1.35; }
        .cs2-smartscreen-preview b {
          align-self: flex-end;
          margin-top: auto;
          padding: 3px 7px;
          color: white;
          background: #0a67c7;
          border-radius: 2px;
          font-size: 8px;
        }
        .cs2-smartscreen-card p strong { color: #e6d7ff; }
        .cs2-oauth-note { margin: 12px 0 0; text-align: center; color: #666c7d; font-size: 11px; }
        .cs2-oauth-note span { color: #55d88b; margin-right: 5px; }

        .cs2-control-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; }
        .cs2-control-card { padding: 22px; display: flex; flex-direction: column; align-items: flex-start; gap: 13px; }
        .cs2-control-card h3 { font-size: 17px; }
        .cs2-control-card p { color: var(--muted); font-size: 13px; line-height: 1.55; margin: 0; }
        .cs2-control-topline { display: flex; align-items: center; gap: 8px; color: #8f96a8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
        .cs2-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #f0ad4e; box-shadow: 0 0 0 4px rgba(240,173,78,.08); }
        .cs2-status-dot.is-ready { background: #4bd38a; box-shadow: 0 0 0 4px rgba(75,211,138,.09); }
        .cs2-inline-message { color: #f29a9a; font-size: 12px; }
        .cs2-inline-message.is-success { color: #62d997; }
        .cs2-copy-wrapper { width: 100%; display: flex; flex-direction: column; gap: 8px; margin-top: auto; }
        .cs2-copy-input { width: 100%; padding: 9px 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #aeb4c4; background: #0d0f15; border: 1px solid var(--line); border-radius: 7px; font-size: 10px; }

        .cs2-actions-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .cs2-action-card { min-height: 166px; padding: 19px; display: flex; flex-direction: column; gap: 10px; transition: transform .18s ease, border-color .18s ease, background .18s ease; }
        .cs2-action-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: var(--panel-strong); }
        .cs2-action-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .cs2-action-icon { font-size: 24px; }
        .cs2-action-key { max-width: 68%; overflow: hidden; text-overflow: ellipsis; padding: 3px 7px; color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 18%, transparent); border-radius: 5px; font: 10px ui-monospace, SFMono-Regular, Consolas, monospace; }
        .cs2-action-title { font-size: 15px; }
        .cs2-action-desc { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.55; }
        .cs2-action-duration { margin-top: auto; color: #626878; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; }

        .cs2-nav { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; padding-top: 22px; border-top: 1px solid var(--line); }
        .cs2-nav-link { padding: 8px 11px; color: #878d9d; text-decoration: none; font-size: 12px; border-radius: 7px; }
        .cs2-nav-link:hover { color: white; background: rgba(255,255,255,.04); }
        .cs2-nav-back { color: #646978; }

        @media (max-width: 900px) {
          .cs2-launch-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .cs2-control-grid { grid-template-columns: 1fr; }
          .cs2-actions-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
        }
        @media (max-width: 620px) {
          .cs2-container { width: min(100% - 24px, 1080px); padding: 36px 0 54px; gap: 58px; }
          .cs2-hero { gap: 13px; }
          .cs2-hero h1 { font-size: 26px; }
          .cs2-tagline { font-size: 14px; }
          .cs2-user-card { flex-wrap: wrap; justify-content: center; }
          .cs2-user-status { display: none; }
          .cs2-launch-grid, .cs2-actions-grid { grid-template-columns: 1fr; }
          .cs2-launch-card { min-height: auto; padding: 22px 18px 18px; }
          .cs2-smartscreen-preview { max-width: 250px; align-self: center; }
          .cs2-section-heading h2 { font-size: 24px; }
        }
      `}</style>
    </main>
  )
}
