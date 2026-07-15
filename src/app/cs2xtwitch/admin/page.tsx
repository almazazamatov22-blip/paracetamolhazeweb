'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2, Power, Download } from 'lucide-react'

import { ACTION_REGISTRY } from '@/lib/cs2-actions';

const ACTION_OPTIONS = Object.values(ACTION_REGISTRY).map(a => ({
  value: a.actionType,
  label: a.label
}));

type Reward = {
  id: string
  name: string
  description: string
  action_type: string
  cost: number
  cooldown_seconds: number
  enabled: boolean
  twitch_reward_id: string | null
}

type TwitchReward = {
  id: string
  title: string
  cost: number
  is_enabled: boolean
  background_color: string | null
  image_url: string | null
}

type FormState = Omit<Reward, 'id'>

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  action_type: 'drop_weapon',
  cost: 100,
  cooldown_seconds: 30,
  enabled: true,
  twitch_reward_id: '',
}

export default function CS2AdminPage() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [user, setUser] = useState<{ login: string; id: string; avatar?: string } | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.login) setUser({ login: d.login, id: d.id, avatar: d.profile_image_url })
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false))
  }, [])

  const loadRewards = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await fetch('/api/cs2/rewards')
      const data = await res.json()
      if (data.rewards) {
        setRewards(data.rewards)
        setError(data.syncWarning || '')
      }
      else setError(data.error || 'Ошибка загрузки')
    } catch {
      setError('Сетевая ошибка')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadRewards()
  }, [loadRewards])

  function flash(msg: string, isErr = false) {
    if (isErr) { setError(msg); setTimeout(() => setError(''), 4000) }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  async function handleSave() {
    if (!form.name.trim()) return flash('Введите название награды', true)
    if (form.cost <= 0) return flash('Стоимость должна быть больше 0', true)

    setLoading(true)
    try {
      const body = {
        ...form,
        ...(editingId ? { id: editingId } : {}),
      }
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch('/api/cs2/rewards', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) return flash(data.error || 'Ошибка сохранения', true)

      setForm(EMPTY_FORM)
      setEditingId(null)
      await loadRewards()
      flash(data.syncWarning || (editingId ? 'Награда обновлена' : 'Награда создана'), Boolean(data.syncWarning))
    } catch {
      flash('Сетевая ошибка', true)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    setLoading(true)
    try {
      const res = await fetch('/api/cs2/rewards', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) return flash(data.error || 'Ошибка удаления', true)
      setDeleteConfirm(null)
      flash('Удалено')
      loadRewards()
    } catch {
      flash('Сетевая ошибка', true)
    } finally {
      setLoading(false)
    }
  }

  async function toggleEnabled(r: Reward) {
    setLoading(true)
    try {
      const res = await fetch('/api/cs2/rewards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, enabled: !r.enabled }),
      })
      const data = await res.json()
      if (!res.ok) return flash(data.error || 'Ошибка обновления', true)
      await loadRewards()
      if (data.syncWarning) flash(data.syncWarning, true)
    } catch {
      flash('Сетевая ошибка', true)
    } finally {
      setLoading(false)
    }
  }

  function startEdit(r: Reward) {
    setEditingId(r.id)
    setForm({
      name: r.name,
      description: r.description,
      action_type: r.action_type,
      cost: r.cost,
      cooldown_seconds: r.cooldown_seconds,
      enabled: r.enabled,
      twitch_reward_id: r.twitch_reward_id ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (authLoading) {
    return (
      <main className="adm-page">
        <div className="adm-loading">Загрузка...</div>
        <style>{adminStyles}</style>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="adm-page">
        <div className="adm-unauth">
          <h1>Требуется авторизация</h1>
          <p className="adm-unauth-desc">Войдите через Twitch, чтобы настроить награды CS2 Interactive.</p>
          <a href="/auth/twitch?source=cs2xtwitch" className="adm-btn adm-btn-twitch">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
            </svg>
            Войти через Twitch
          </a>
          <a href="/cs2xtwitch" className="adm-back">← Назад</a>
        </div>
        <style>{adminStyles}</style>
      </main>
    )
  }

  // 
  return (
    <main className="adm-page">
      {/* Header */}
      <header className="adm-header">
        <div className="adm-header-left">
          <span className="adm-kicker">CS2 INTERACTIVE</span>
          <h1 className="adm-title">Настройка наград</h1>
          <a href="/cs2xtwitch" className="adm-back-link">← Вернуться к странице проекта</a>
        </div>
        <div className="adm-user">
          {user.avatar && <img src={user.avatar} alt={user.login} className="adm-avatar" />}
          <span>{user.login}</span>
          <a href="/api/auth/logout?source=cs2xtwitch" className="adm-btn adm-btn-sm adm-btn-ghost" style={{ marginLeft: 8 }} title="Выйти">
            Выйти
          </a>
        </div>
      </header>

      {/* Flash messages */}
      {error && <div className="adm-flash adm-flash-err">{error}</div>}
      {success && <div className="adm-flash adm-flash-ok">{success}</div>}

      <div className="adm-body">
        {/* Form */}
        <section className="adm-form-section">
          <h2 className="adm-section-title">
            {editingId ? 'Редактировать награду' : 'Новая награда'}
          </h2>
          <div className="adm-form">
             <div className="adm-field">
              <label className="adm-label">Тип действия *</label>
              <select
                className="adm-input"
                id="reward-action"
                value={form.action_type}
                onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}
              >
                {ACTION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="adm-row">
              <div className="adm-field">
                <label className="adm-label">Название награды *</label>
                <input
                  className="adm-input"
                  id="reward-name"
                  type="text"
                  placeholder="Например: Бросить оружие"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
            </div>
            <div className="adm-row">
              <div className="adm-field">
                <label className="adm-label">Стоимость (баллы) *</label>
                <input
                  className="adm-input"
                  id="reward-cost"
                  type="number"
                  min={1}
                  value={form.cost}
                  onChange={e => setForm(f => ({ ...f, cost: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="adm-field">
                <label className="adm-label">Кулдаун (сек)</label>
                <input
                  className="adm-input"
                  id="reward-cooldown"
                  type="number"
                  min={0}
                  value={form.cooldown_seconds}
                  onChange={e => setForm(f => ({ ...f, cooldown_seconds: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>



            <div className="adm-checkbox-row">
              <input
                type="checkbox"
                id="reward-enabled"
                checked={form.enabled}
                onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                className="adm-checkbox"
              />
              <label htmlFor="reward-enabled" className="adm-label">Активна</label>
            </div>
            <div className="adm-form-actions">
              <button
                id="save-reward-btn"
                className="adm-btn adm-btn-primary"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? '⏳' : editingId ? 'Сохранить' : 'Создать'}
              </button>
              {editingId && (
                <button
                  className="adm-btn adm-btn-ghost"
                  onClick={() => { setEditingId(null); setForm(EMPTY_FORM) }}
                >
                  Отмена
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Rewards list */}
        <section className="adm-list-section">
          <h2 className="adm-section-title">Мои награды ({rewards.length})</h2>

          {loading && rewards.length === 0 && (
            <div className="adm-loading-small">Загрузка...</div>
          )}

          {!loading && rewards.length === 0 && (
            <div className="adm-empty">
              Наград пока нет. Создайте первую с помощью формы выше.
            </div>
          )}

          <div className="adm-rewards-list">
            {rewards.map(r => {
              return (
                <div key={r.id} className={`adm-reward-item ${!r.enabled ? 'is-disabled' : ''}`}>
                  <div className="adm-reward-main">
                    <div className="adm-reward-info">
                      <span className="adm-reward-name">
                        {ACTION_REGISTRY[r.action_type]?.icon && (
                          <img 
                            src={ACTION_REGISTRY[r.action_type].icon} 
                            style={{ width: '20px', height: '20px', verticalAlign: 'middle', marginRight: '8px', borderRadius: '4px' }} 
                            alt="" 
                          />
                        )}
                        {r.name}
                      </span>
                      <span className="adm-reward-action">
                        {ACTION_OPTIONS.find(a => a.value === r.action_type)?.label ?? r.action_type}
                      </span>
                      {r.description && (
                        <span className="adm-reward-desc">{r.description}</span>
                      )}
                    </div>
                    <div className="adm-reward-meta">
                      <span className="adm-badge adm-badge-cost">{r.cost} pts</span>
                      <span className="adm-badge">⏱ {r.cooldown_seconds}s</span>
                      {r.twitch_reward_id && (
                        <span className="adm-badge adm-badge-id" title={r.twitch_reward_id}>
                          ID: {r.twitch_reward_id.substring(0, 8)}…
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="adm-reward-actions">
                    <a
                      href={`/icons/${r.action_type}.zip`}
                      download
                      className="adm-btn adm-btn-sm adm-btn-ghost"
                      title="Скачать иконки"
                      aria-label={`Скачать иконки для ${r.name}`}
                    >
                      <Download size={16} />
                    </a>
                    <button
                      className={`adm-toggle ${r.enabled ? 'adm-toggle-on' : 'adm-toggle-off'}`}
                      onClick={() => toggleEnabled(r)}
                      title={r.enabled ? 'Отключить' : 'Включить'}
                      aria-label={`${r.enabled ? 'Отключить' : 'Включить'} награду ${r.name}`}
                    >
                      <Power size={16} />
                    </button>
                    <button
                      className="adm-btn adm-btn-sm adm-btn-ghost"
                      onClick={() => startEdit(r)}
                      aria-label={`Редактировать награду ${r.name}`}
                    >
                      <Pencil size={16} />
                    </button>
                    {deleteConfirm === r.id ? (
                      <div className="adm-delete-confirm">
                        <button className="adm-btn adm-btn-sm adm-btn-danger" onClick={() => handleDelete(r.id)}>
                          Удалить
                        </button>
                        <button className="adm-btn adm-btn-sm adm-btn-ghost" onClick={() => setDeleteConfirm(null)}>
                          Нет
                        </button>
                      </div>
                    ) : (
                      <button
                        className="adm-btn adm-btn-sm adm-btn-ghost"
                        onClick={() => setDeleteConfirm(r.id)}
                        aria-label={`Удалить награду ${r.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Links */}
        <nav className="adm-nav">
          <a href="/cs2xtwitch/history" className="adm-nav-link">История активаций</a>
          <a href="/cs2xtwitch" className="adm-nav-link">← CS2 Interactive</a>
        </nav>
      </div>

      <style>{adminStyles}</style>
    </main>
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
  .adm-kicker { color: #ad72ff; font-size: 11px; font-weight: 800; letter-spacing: 0.16em; }
  .adm-back-link { font-size: 13px; color: #6f7586; text-decoration: none; transition: color 0.2s; font-weight: 500;}
  .adm-back-link:hover { color: #c8ccda; }
  .adm-title { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.025em; }
  .adm-user {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 15px;
    color: #a8adbb;
    font-weight: 600;
  }
  .adm-avatar { width: 36px; height: 36px; border-radius: 10px; object-fit: cover; }
  .adm-flash {
    padding: 14px 32px;
    font-size: 15px;
    font-weight: 600;
  }
  .adm-flash-err { background: #2f1315; color: #f87171; }
  .adm-flash-ok { background: #13271d; color: #22c55e; }
  .adm-body {
    max-width: 980px;
    margin: 0 auto;
    padding: 46px 24px 80px;
    display: flex;
    flex-direction: column;
    gap: 48px;
  }
  .adm-section-title { font-size: 24px; font-weight: 800; letter-spacing: -0.025em; margin: 0 0 20px; color: var(--adm-text); }
  .adm-form {
    background: var(--adm-panel);
    border: none;
    border-radius: 20px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.15);
    padding: 32px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .adm-field { display: flex; flex-direction: column; gap: 8px; }
  .adm-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #808697; font-weight: 800; }
  .adm-input {
    min-height: 46px;
    background: #090a0f;
    border: none;
    border-radius: 12px;
    padding: 12px 16px;
    color: var(--adm-text);
    font-size: 15px;
    outline: none;
    transition: background 0.2s;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
  }
  .adm-input:focus { background: #000; box-shadow: 0 0 0 3px rgba(145,70,255,0.2); }
  .adm-input option { background: #171923; color: var(--adm-text); }
  .adm-hint { font-size: 11px; color: rgba(229,231,235,0.3); line-height: 1.5; }
  .adm-hint-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .adm-warning-box {
    font-size: 13px;
    color: #fbbf24;
    background: rgba(251,191,36,0.06);
    border: 1px solid rgba(251,191,36,0.15);
    border-radius: 8px;
    padding: 10px 14px;
    line-height: 1.5;
  }
  .adm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .adm-checkbox-row { display: flex; align-items: center; gap: 10px; }
  .adm-checkbox { width: 17px; height: 17px; accent-color: var(--adm-purple); cursor: pointer; }
  .adm-form-actions { display: flex; gap: 12px; }
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
  .adm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .adm-btn-primary { background: #7650f5; color: #fff; box-shadow: 0 8px 22px rgba(118,80,245,0.16); }
  .adm-btn-primary:hover:not(:disabled) { background: #8968f8; transform: translateY(-2px); }
  .adm-btn-twitch { background: #9146ff; color: #fff; }
  .adm-btn-twitch:hover { background: #a970ff; }
  .adm-btn-ghost {
    background: #222633;
    color: #c6cad6;
  }
  .adm-btn-ghost:hover { background: #2a2e3d; }
  .adm-btn-danger { background: #2f1315; color: #f87171; }
  .adm-btn-danger:hover { background: #3f181c; }
  .adm-btn-sm { padding: 8px 14px; font-size: 14px; }
  .adm-loading-small { color: rgba(229,231,235,0.3); padding: 20px 0; }
  .adm-empty {
    color: #757b8c;
    padding: 32px;
    text-align: center;
    border: 2px dashed #222633;
    border-radius: 16px;
    font-size: 15px;
  }
  .adm-rewards-list { display: flex; flex-direction: column; gap: 14px; }
  .adm-reward-item {
    background: var(--adm-panel);
    border: none;
    border-radius: 20px;
    padding: 22px 24px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    transition: transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  }
  .adm-reward-item:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.2); background: var(--adm-panel-strong); }
  .adm-reward-item.is-disabled { opacity: 0.5; }
  .adm-reward-main { flex: 1; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .adm-reward-info { display: flex; flex-direction: column; gap: 4px; }
  .adm-reward-name { font-weight: 800; font-size: 17px; color: var(--adm-text); }
  .adm-reward-action { font-size: 14px; color: #aeb3c2; font-weight: 500; }
  .adm-reward-desc { font-size: 14px; color: #777d8d; line-height: 1.5; white-space: pre-line; margin-top: 4px;}
  .adm-reward-meta { display: flex; gap: 8px; flex-wrap: wrap; }
  .adm-badge {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 8px;
    background: #222633;
    color: #a0a6b5;
    white-space: nowrap;
    font-weight: 600;
  }
  .adm-badge-cost { color: #c9a2ff; background: #26163f; }
  .adm-badge-twitch { color: #c084fc; background: #26163f; }
  .adm-badge-id { font-family: monospace; font-weight: 400; }
  .adm-badge-warn { color: #fbbf24; background: #3b2a0c; }
  .adm-reward-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .adm-toggle { background: #222633; border: none; border-radius: 10px; cursor: pointer; color: #fff; padding: 10px; transition: transform 0.15s, background 0.15s; display: grid; place-items: center; }
  .adm-toggle-on { background: #22c55e; }
  .adm-toggle-off { background: #3f3f46; color: #a1a1aa; }
  .adm-toggle:hover { transform: scale(1.05); }
  .adm-delete-confirm { display: flex; gap: 8px; }
  .adm-back { color: #7e8495; text-decoration: none; font-size: 15px; transition: color 0.2s; font-weight: 600; }
  .adm-back:hover { color: var(--adm-text); }
  .adm-nav { display: flex; gap: 10px; flex-wrap: wrap; padding-top: 24px; border-top: 2px solid #14161f; }
  .adm-nav-link {
    font-size: 15px;
    color: #7e8495;
    text-decoration: none;
    padding: 10px 16px;
    border-radius: 10px;
    transition: all 0.2s;
    font-weight: 600;
  }
  .adm-nav-link:hover { color: var(--adm-text); background: rgba(255,255,255,0.04); }
  @media (max-width: 600px) {
    .adm-header { padding: 14px 16px; align-items: flex-start; gap: 14px; }
    .adm-user { flex-wrap: wrap; justify-content: flex-end; }
    .adm-body { padding: 24px 16px 60px; }
    .adm-row { grid-template-columns: 1fr; }
    .adm-reward-item { flex-direction: column; }
    .adm-form { padding: 18px; }
    .adm-reward-actions { width: 100%; justify-content: flex-end; }
  }
`
