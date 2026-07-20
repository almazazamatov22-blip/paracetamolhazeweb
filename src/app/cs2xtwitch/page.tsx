'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { Download, Twitch, Settings2 } from 'lucide-react'
import { TwitchConsentNotice } from '@/components/legal/TwitchConsentNotice'

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

export default function cs2xtwitchPage() {
  const [user, setUser] = useState<{ login: string; id: string; avatar?: string } | null>(null)
  const [subscribing, setSubscribing] = useState(false)
  const [subscribeMsg, setSubscribeMsg] = useState('')
  const [copiedOverlay, setCopiedOverlay] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isCurrentOrigin, setIsCurrentOrigin] = useState(true)
  const [callbackOrigin, setCallbackOrigin] = useState('')

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

  const refreshSubscriptionStatus = async () => {
    try {
      const response = await fetch('/api/cs2/subscribe')
      const data = await response.json()
      if (typeof data.isSubscribed === 'boolean') {
        setIsSubscribed(data.isSubscribed)
        setIsCurrentOrigin(!!data.isCurrentOrigin)
        setCallbackOrigin(data.callbackOrigin || '')
      } else if (data.error) {
        setIsSubscribed(false)
        setSubscribeMsg(`Ошибка проверки статуса: ${data.error}`)
      }
    } catch {
      setIsSubscribed(false)
      setSubscribeMsg('Не удалось проверить статус подписки')
    }
  }

  useEffect(() => {
    if (!user) return
    refreshSubscriptionStatus()
  }, [user])

  async function handleSubscribe(mode?: 'reconnect') {
    if (mode === 'reconnect') {
       if (!confirm(`Вы уверены, что хотите перенести обработку наград на этот домен?\nНа старом зеркале интеграция перестанет работать.`)) return;
    }

    setSubscribing(true)
    setSubscribeMsg('')

    try {
      const url = mode === 'reconnect' ? '/api/cs2/subscribe?mode=reconnect' : '/api/cs2/subscribe'
      const response = await fetch(url, { method: 'POST' })
      const data = await response.json()

      if (data.success) {
        await refreshSubscriptionStatus()
        setSubscribeMsg('Интеграция успешно активирована')
      } else {
        if (data.rollbackRestored !== undefined) {
           setSubscribeMsg(`Ошибка подключения: ${data.error}. ${data.rollbackRestored ? 'Прежняя подписка сохранена.' : 'Внимание: старая подписка потеряна!'}`)
        } else {
           setSubscribeMsg(`Ошибка подключения: ${data.error}`)
        }
        await refreshSubscriptionStatus()
      }
    } catch (error: unknown) {
      setSubscribeMsg(error instanceof Error ? error.message : 'Не удалось подключиться')
      await refreshSubscriptionStatus()
    } finally {
      setSubscribing(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopiedOverlay(true)
    setTimeout(() => setCopiedOverlay(false), 2000)
  }

  const [overlayUrl, setOverlayUrl] = useState('')
  useEffect(() => {
    if (user) {
      setOverlayUrl(`${window.location.origin}/overlays/cs2.html?streamerId=${user.id}`)
    } else {
      setOverlayUrl('')
    }
  }, [user])

  return (
    <main className="cs2-page">
      <div className="cs2-ambient cs2-ambient-one" aria-hidden="true" />
      <div className="cs2-ambient cs2-ambient-two" aria-hidden="true" />

      <div className="cs2-container">
        <header className="cs2-hero animate-fade-in">
          <h1 className="cs2-logo" aria-label="CS2 и Twitch">
            <span className="cs2-logo-cs">CS2</span>
            <span className="cs2-logo-x">×</span>
            <span className="cs2-logo-twitch">TWITCH</span>
          </h1>
          <h2 className="cs2-hero-title">Зрители управляют твоей игрой</h2>
          <p className="cs2-tagline">
            Подключите баллы канала Twitch к действиям в CS2
          </p>

          <div className="cs2-hero-actions">
            {user ? (
              <div className="cs2-user-card">
                {user.avatar && <img src={user.avatar} alt="" className="cs2-user-avatar" />}
                <span className="cs2-user-name">{user.login}</span>
                <span className="cs2-user-status">Twitch подключён</span>
                <a href="/cs2xtwitch/admin" className="cs2-btn cs2-btn-primary">
                  Открыть панель управления
                </a>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <a href="/auth/twitch?source=cs2xtwitch" className="cs2-btn cs2-btn-twitch">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                  </svg>
                  Войти через Twitch
                </a>
                <TwitchConsentNotice />
              </div>
            )}
          </div>
        </header>

        <section className="cs2-launch-section animate-slide-up" aria-labelledby="launch-title">
          <div className="cs2-section-heading cs2-section-heading-centered">
            <h2 id="launch-title" className="cs2-main-title">Быстрый старт</h2>
          </div>

          <div className="cs2-launch-grid">
            <article className="cs2-launch-card">
              <span className="cs2-step-badge">1</span>
              <div className="cs2-step-icon" aria-hidden="true"><Download size={24} /></div>
              <h3>Скачайте лаунчер</h3>
              <p>Установщик для Windows 10/11.</p>
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
              <p className="cs2-desc" style={{marginTop: '10px', fontSize: '14px'}}>
                  Это стандартная проверка нового приложения. Нажмите <strong>«Подробнее»</strong>, затем <strong>«Выполнить в любом случае»</strong>.
              </p>
            </article>

            <article className="cs2-launch-card">
              <span className="cs2-step-badge">3</span>
              <div className="cs2-step-icon cs2-step-icon-twitch" aria-hidden="true"><Twitch size={24} /></div>
              <h3 className="cs2-step-title">Авторизуйтесь через Twitch</h3>
              <p className="cs2-desc">
                Для работы нужно привязать аккаунт. Откройте приложение и нажмите кнопку <strong>Login with Twitch</strong>.
              </p>
              {!user ? (
                <div className="flex flex-col items-center mt-auto w-full">
                  <a href="/auth/twitch?source=cs2xtwitch" className="cs2-btn cs2-btn-twitch" style={{width: '100%', minHeight: 'auto', padding: '7px 10px', fontSize: '12px'}}>
                    Войти через Twitch
                  </a>
                  <TwitchConsentNotice />
                </div>
              ) : (
                <span className="cs2-card-complete">Готово · {user.login}</span>
              )}
            </article>

            <article className="cs2-launch-card">
              <span className="cs2-step-badge">4</span>
              <div className="cs2-step-icon" aria-hidden="true"><Settings2 size={24} /></div>
              <h3>Создайте награды</h3>
              <p>Выберите эффекты, стоимость и задержку — CS2Haze создаст награды на Twitch.</p>
              {user ? (
                <a href="/cs2xtwitch/admin" className="cs2-card-link">
                  Настроить награды
                </a>
              ) : (
                <span className="cs2-card-muted">После входа в Twitch</span>
              )}
            </article>
          </div>
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
                  <span className={`cs2-status-dot ${isSubscribed && isCurrentOrigin ? 'is-ready' : isSubscribed ? 'is-warning' : ''}`} />
                  <span>
                    {!isSubscribed 
                       ? 'Требуется подключение' 
                       : (isCurrentOrigin ? 'EventSub активен' : `Интеграция активна через ${callbackOrigin}`)}
                  </span>
                </div>
                <h3>События Twitch</h3>
                <p>Разрешите серверу получать активации наград канала.</p>
                
                <div className="flex gap-2">
                  <button
                    className="cs2-btn cs2-btn-primary"
                    onClick={() => handleSubscribe()}
                    disabled={subscribing || (isSubscribed && isCurrentOrigin)}
                    id="subscribe-btn"
                    style={{ flex: 1, minHeight: 'auto', padding: '8px' }}
                  >
                    {subscribing 
                      ? 'Подключаем…' 
                      : (isSubscribed && isCurrentOrigin ? 'Интеграция активна' : 'Активировать интеграцию')}
                  </button>
                  {isSubscribed && !isCurrentOrigin && (
                     <button
                        className="cs2-btn cs2-btn-ghost"
                        onClick={() => handleSubscribe('reconnect')}
                        disabled={subscribing}
                        style={{ padding: '8px 12px', fontSize: '13px' }}
                     >
                        Переключить на текущий домен
                     </button>
                  )}
                </div>

                {subscribeMsg && (
                  <span className={`cs2-inline-message ${isSubscribed && isCurrentOrigin ? 'is-success' : 'is-error'}`}>
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
                <p>Добавьте источник-браузер 1920×1080. В настройках источника установите галочки «Управление аудио через OBS» и «Обновить браузер, когда сцена становится активной». В расширенных свойствах аудио включите «Прослушивание и вывод».</p>
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
                <a href="/cs2xtwitch/admin" className="cs2-btn cs2-btn-primary">
                  Перейти к наградам
                </a>
              </article>
            </div>
          </section>
        )}

        <section className="cs2-actions-section animate-slide-up" aria-labelledby="actions-title">
          <div className="cs2-section-heading">
            <h2 id="actions-title">Доступные действия в CS2</h2>
          </div>

          <div className="cs2-actions-grid">
            {Object.entries(ACTION_LABELS).map(([key, info]) => (
              <article
                key={key}
                className="cs2-action-card"
                style={{ '--accent': info.color } as CSSProperties}
              >
                <div className="cs2-action-header">
                  <span className="cs2-action-icon" aria-hidden="true">
                    <img src={info.icon} alt="" style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '4px' }} />
                  </span>
                  <span className="cs2-action-key">{key}</span>
                </div>
                <h3 className="cs2-action-title">{info.label}</h3>
                <p className="cs2-action-desc">{info.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* GEO Informational Section */}
        <section className="cs2-info-section animate-slide-up" aria-labelledby="geo-title">
          <div className="cs2-section-heading">
            <h2 id="geo-title">Интерактивный CS2 для Twitch-стримеров</h2>
          </div>
          <div className="cs2-info-content">
            <article>
              <h3>Что такое CS2 × Twitch?</h3>
              <p>Это бесплатная интеграция, которая позволяет зрителям вашей трансляции напрямую влиять на игровой процесс в Counter-Strike 2. Используя баллы канала Twitch (Channel Points), зрители могут активировать различные визуальные и геймплейные эффекты: от безобидных звуков до блокировки прыжка или инверсии мыши.</p>
            </article>
            <article>
              <h3>Как это работает?</h3>
              <p>Вы скачиваете легковесный клиент <strong>CS2Haze</strong>, который работает в фоновом режиме. Он подключается к нашему серверу для отслеживания событий с вашего Twitch-канала. Как только зритель покупает награду в чате, приложение мгновенно передает команду в CS2 через встроенные возможности игры.</p>
            </article>
            <article>
              <h3>Кому это подходит?</h3>
              <p>Это приложение связывает события из CS2 (убийства, смерти, раунды) с вашим Twitch-каналом в реальном времени. Оно помогает повысить вовлечённость аудитории и дать зрителям больше способов участвовать в трансляции с помощью баллов канала.</p>
            </article>
            <article>
              <h3>Требования</h3>
              <p>Вам понадобится ОС Windows 10 или Windows 11, аккаунт Twitch со статусом Компаньона или Партнера (для создания наград за баллы) и установленная игра Counter-Strike 2.</p>
            </article>
          </div>
        </section>

        <nav className="cs2-nav animate-fade-in" aria-label="Навигация CS2 Interactive">
          {user && (
            <>
              <a href="/cs2xtwitch/admin" className="cs2-nav-link">Настройки наград</a>
              <a href="/cs2xtwitch/history" className="cs2-nav-link">История активаций</a>
            </>
          )}
          <a href="/" className="cs2-nav-link cs2-nav-back">← На главную</a>
        </nav>
      </div>

      <style>{`
        .cs2-page {
          --bg: #090a0f;
          --panel: #14161f;
          --panel-strong: #1b1e29;
          --text: #f5f7fb;
          --muted: #8d93a5;
          --purple: #9146ff;
          --purple-light: #ad72ff;
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          font-family: var(--font-outfit), 'Outfit', system-ui, -apple-system, sans-serif;
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
        .cs2-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: .12em;
          font-size: clamp(50px, 8vw, 78px);
          font-weight: 900;
          letter-spacing: -.04em;
          line-height: .9;
          margin: 0;
        }
        .cs2-logo-cs, .cs2-logo-twitch {
          background: linear-gradient(135deg, #6d78ff, #b34cff);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .cs2-logo-twitch { background-image: linear-gradient(135deg, #9d69ff, #d044ff); }
        .cs2-logo-x { color: #343744; font-size: .6em; font-weight: 300; }
        .cs2-hero-title {
          max-width: 650px;
          font-size: clamp(24px, 4vw, 38px);
          line-height: 1.08;
          letter-spacing: -.03em;
          margin: 5px 0 0;
          font-weight: 700;
        }
        .cs2-tagline {
          max-width: 610px;
          color: var(--muted);
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
          font-weight: 400;
        }
        .cs2-hero-actions { margin-top: 8px; min-height: 46px; }
        .cs2-user-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 8px 8px 12px;
          background: var(--panel);
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        }
        .cs2-user-avatar { width: 34px; height: 34px; border-radius: 10px; object-fit: cover; }
        .cs2-user-name { font-size: 15px; font-weight: 700; }
        .cs2-user-status { color: #55d88b; font-size: 13px; margin-right: 6px; font-weight: 500; }

        .cs2-btn, .cs2-card-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 44px;
          padding: 10px 20px;
          border-radius: 12px;
          border: none;
          font: inherit;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
          transition: transform .18s ease, background .18s ease;
        }
        .cs2-btn:hover, .cs2-card-link:hover { transform: translateY(-2px); }
        .cs2-btn:disabled { opacity: .58; cursor: default; transform: none; }
        .cs2-btn-twitch { color: white; background: var(--purple); box-shadow: 0 10px 30px rgba(145,70,255,.22); }
        .cs2-btn-twitch:hover { background: #a45dff; }
        .cs2-btn-primary { color: white; background: #7650f5; }
        .cs2-btn-primary:hover { background: #8968f8; }
        .cs2-btn-ghost { color: #d9dce6; background: #222633; }
        .cs2-btn-copied { color: #7ee2a8; background: #1c3d2a; }

        .cs2-section-heading { max-width: 690px; margin-bottom: 32px; }
        .cs2-section-heading-centered { text-align: center; margin: 0 auto 32px; }
        .cs2-main-title {
          font-size: clamp(32px, 5vw, 42px);
          font-weight: 800;
          margin: 0;
          letter-spacing: -.02em;
        }
        .cs2-section-heading h2 {
          margin: 0;
          color: var(--text);
          font-size: clamp(26px, 3.5vw, 34px);
          font-weight: 800;
          line-height: 1.2;
          letter-spacing: -.02em;
        }
        .cs2-launch-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }
        .cs2-launch-card, .cs2-control-card, .cs2-action-card {
          position: relative;
          background: var(--panel);
          border-radius: 20px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.15);
          border: none;
        }
        .cs2-launch-card {
          min-height: 260px;
          padding: 30px 22px 24px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
        }
        .cs2-launch-card:hover, .cs2-control-card:hover { transform: translateY(-4px); transition: transform 0.2s ease; }
        .cs2-step-badge {
          position: absolute;
          top: 14px;
          left: 14px;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          color: white;
          background: var(--purple);
          font-size: 13px;
          font-weight: 800;
          box-shadow: 0 0 0 5px rgba(145,70,255,.15);
        }
        .cs2-step-icon {
          width: 52px;
          height: 52px;
          display: grid;
          place-items: center;
          margin: 18px auto 10px;
          border-radius: 16px;
          color: #c89cff;
          background: #251b3d;
          font-size: 26px;
          align-self: center;
        }
        .cs2-step-icon-twitch { border-radius: 16px; }
        .cs2-launch-card h3, .cs2-control-card h3, .cs2-action-card h3 { margin: 0; color: var(--text); font-weight: 700; }
        .cs2-launch-card h3 { font-size: 17px; align-self: center; text-align: center; }
        .cs2-launch-card p { color: var(--muted); font-size: 14px; line-height: 1.5; margin: 0; text-align: center; }
        .cs2-card-link {
          min-height: auto;
          margin-top: auto;
          padding: 8px 12px;
          width: 100%;
          color: #cda9ff;
          background: #291b40;
          font-size: 13px;
        }
        .cs2-card-complete, .cs2-card-muted {
          width: 100%;
          margin-top: auto;
          text-align: center;
          color: #65d99a;
          font-size: 14px;
          font-weight: 700;
        }
        .cs2-card-muted { color: #666c7d; }
        .cs2-smartscreen-preview {
          width: 100%;
          min-height: 88px;
          margin: 10px 0 6px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          color: #111827;
          background: #edf4ff;
          border-radius: 8px;
          font-family: 'Segoe UI', sans-serif;
          text-align: left;
        }
        .cs2-smartscreen-preview strong { font-size: 11px; }
        .cs2-smartscreen-preview span { color: #46556e; font-size: 9px; line-height: 1.35; }
        .cs2-smartscreen-preview b {
          align-self: flex-end;
          margin-top: auto;
          padding: 4px 8px;
          color: white;
          background: #0a67c7;
          border-radius: 4px;
          font-size: 9px;
        }
        .cs2-smartscreen-card p strong { color: #e6d7ff; }
        .cs2-oauth-note { margin: 16px 0 0; text-align: center; color: #666c7d; font-size: 13px; font-weight: 500;}
        .cs2-oauth-note span { color: #55d88b; margin-right: 5px; }

        .cs2-control-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; }
        .cs2-control-card { padding: 26px; display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
        .cs2-control-card h3 { font-size: 19px; }
        .cs2-control-card p { color: var(--muted); font-size: 15px; line-height: 1.5; margin: 0; }
        .cs2-control-topline { display: flex; align-items: center; gap: 8px; color: #8f96a8; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
        .cs2-status-dot { width: 10px; height: 10px; border-radius: 50%; background: #f0ad4e; box-shadow: 0 0 0 4px rgba(240,173,78,.15); }
        .cs2-status-dot.is-ready { background: #4bd38a; box-shadow: 0 0 0 4px rgba(75,211,138,.2); }
        .cs2-status-dot.is-warning { background: #eab308; box-shadow: 0 0 0 4px rgba(234, 179, 8, 0.2); }
        .cs2-inline-message { color: #f29a9a; font-size: 14px; font-weight: 500; }
        .cs2-inline-message.is-success { color: #62d997; }
        .cs2-copy-wrapper { width: 100%; display: flex; flex-direction: column; gap: 10px; margin-top: auto; }
        .cs2-copy-input { width: 100%; padding: 12px 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #aeb4c4; background: #08090d; border: none; border-radius: 10px; font-size: 12px; font-family: monospace; }

        .cs2-actions-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        .cs2-action-card { min-height: 166px; padding: 22px; display: flex; flex-direction: column; gap: 12px; transition: transform .18s ease, background .18s ease; }
        .cs2-action-card:hover { transform: translateY(-4px); background: var(--panel-strong); box-shadow: 0 12px 40px rgba(0,0,0,0.3); }
        .cs2-action-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .cs2-action-icon { font-size: 28px; }
        .cs2-action-key { max-width: 68%; overflow: hidden; text-overflow: ellipsis; padding: 4px 8px; color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); border: none; border-radius: 6px; font: 12px ui-monospace, SFMono-Regular, Consolas, monospace; font-weight: 700; }
        .cs2-action-title { font-size: 17px; }
        .cs2-action-desc { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.5; }

        .cs2-nav { display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; padding-top: 32px; border-top: 2px solid #1a1c24; }
        .cs2-nav-link { padding: 10px 16px; color: #878d9d; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 10px; }
        .cs2-nav-link:hover { color: white; background: #222633; }
        .cs2-nav-back { color: #646978; }

        .cs2-info-section { max-width: 900px; margin: 0 auto; padding: 40px 0; border-top: 1px solid rgba(255,255,255,0.05); }
        .cs2-info-content { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px; }
        .cs2-info-content article h3 { color: #f5f7fb; font-size: 18px; font-weight: 700; margin: 0 0 12px 0; }
        .cs2-info-content article p { color: #8d93a5; font-size: 15px; line-height: 1.6; margin: 0; }
        .cs2-info-content article strong { color: #cda9ff; font-weight: 600; }

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
          .cs2-launch-grid, .cs2-actions-grid, .cs2-info-content { grid-template-columns: 1fr; }
          .cs2-launch-card { min-height: auto; padding: 22px 18px 18px; }
          .cs2-smartscreen-preview { max-width: 250px; align-self: center; }
          .cs2-section-heading h2 { font-size: 24px; }
        }
      `}</style>
    </main>
  )
}
