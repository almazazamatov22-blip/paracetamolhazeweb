'use client'

import { useState, useEffect, useCallback } from 'react'
import { TwitchConsentNotice } from '@/components/legal/TwitchConsentNotice'

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
      if (data.rewards) setRewards(data.rewards)
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
    if (!form.name.trim()) return flash('Введите название', true)
    setLoading(true)
    try {
      const body = {
        ...form,
        twitch_reward_id: form.twitch_reward_id || null,
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
      flash(editingId ? '✅ Награда обновлена' : '✅ Награда создана')
      loadRewards()
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
      flash('🗑️ Удалено')
      loadRewards()
    } catch {
      flash('Сетевая ошибка', true)
    } finally {
      setLoading(false)
    }
  }

  async function toggleEnabled(r: Reward) {
    try {
      await fetch('/api/cs2/rewards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, enabled: !r.enabled }),
      })
      loadRewards()
    } catch {}
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
          <h1>🔐 Требуется авторизация</h1>
          <a href="/auth/twitch?source=cs2" className="adm-btn adm-btn-twitch">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
            </svg>
            Войти через Twitch
          </a>
          <TwitchConsentNotice />
          <a href="/cs2" className="adm-back mt-2">← Назад</a>
        </div>
        <style>{adminStyles}</style>
      </main>
    )
  }

  return (
    <main className="adm-page">
      {/* Header */}
      <header className="adm-header">
        <div className="adm-header-left">
          <a href="/cs2" className="adm-back-link">← CS2</a>
          <h1 className="adm-title">⚙️ Настройки CS2 наград</h1>
        </div>
        <div className="adm-user">
          {user.avatar && <img src={user.avatar} alt={user.login} className="adm-avatar" />}
          <span>{user.login}</span>
        </div>
      </header>

      {/* Flash messages */}
      {error && <div className="adm-flash adm-flash-err">{error}</div>}
      {success && <div className="adm-flash adm-flash-ok">{success}</div>}

      <div className="adm-body">
        {/* Form */}
        <section className="adm-form-section">
          <h2 className="adm-section-title">
            {editingId ? '✏️ Редактировать награду' : '➕ Новая награда'}
          </h2>
          <div className="adm-form">
            <div className="adm-field">
              <label className="adm-label">Название *</label>
              <input
                className="adm-input"
                id="reward-name"
                placeholder="Например: Выбросить оружие"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="adm-field">
              <label className="adm-label">Описание</label>
              <input
                className="adm-input"
                id="reward-desc"
                placeholder="Описание для зрителей"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
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
                <label className="adm-label">Стоимость (баллы)</label>
                <input
                  className="adm-input"
                  id="reward-cost"
                  type="number"
                  min={0}
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
            <div className="adm-field">
              <label className="adm-label">Twitch Reward ID</label>
              <input
                className="adm-input"
                id="reward-twitch-id"
                placeholder="ID из настроек Channel Points на Twitch"
                value={form.twitch_reward_id ?? ''}
                onChange={e => setForm(f => ({ ...f, twitch_reward_id: e.target.value }))}
              />
              <span className="adm-hint">
                Найди в Twitch → Канал → Channel Points → Управление наградами → ID награды
              </span>
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
                {loading ? '⏳' : editingId ? '💾 Сохранить' : '➕ Создать'}
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
          <h2 className="adm-section-title">📋 Мои награды ({rewards.length})</h2>

          {loading && rewards.length === 0 && (
            <div className="adm-loading-small">Загрузка...</div>
          )}

          {!loading && rewards.length === 0 && (
            <div className="adm-empty">
              Наград пока нет. Создай первую →
            </div>
          )}

          <div className="adm-rewards-list">
            {rewards.map(r => (
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
                    <span className="adm-badge adm-badge-cost">💜 {r.cost} pts</span>
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
                    ⬇️
                  </a>
                  <button
                    className={`adm-toggle ${r.enabled ? 'adm-toggle-on' : 'adm-toggle-off'}`}
                    onClick={() => toggleEnabled(r)}
                    title={r.enabled ? 'Отключить' : 'Включить'}
                  >
                    {r.enabled ? '✅' : '⭕'}
                  </button>
                  <button className="adm-btn adm-btn-sm adm-btn-ghost" onClick={() => startEdit(r)}>
                    ✏️
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
                    <button className="adm-btn adm-btn-sm adm-btn-ghost" onClick={() => setDeleteConfirm(r.id)}>
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Links */}
        <nav className="adm-nav">
          <a href="/cs2/history" className="adm-nav-link">📜 История активаций</a>
          <a href="/cs2" className="adm-nav-link">← Назад к CS2</a>
        </nav>
      </div>

      <style>{adminStyles}</style>
    </main>
  )
}

const adminStyles = `
  .adm-page {
    min-height: 100vh;
    background: #080808;
    color: #fff;
    font-family: 'Inter', sans-serif;
  }
  .adm-loading, .adm-unauth {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 20px;
    color: rgba(255,255,255,0.4);
  }
  .adm-unauth h1 { font-size: 24px; color: #fff; }
  .adm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 32px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
    backdrop-filter: blur(8px);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .adm-header-left { display: flex; flex-direction: column; gap: 4px; }
  .adm-back-link { font-size: 12px; color: rgba(255,255,255,0.35); text-decoration: none; }
  .adm-back-link:hover { color: rgba(255,255,255,0.7); }
  .adm-title { font-size: 20px; font-weight: 700; }
  .adm-user {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: rgba(255,255,255,0.6);
  }
  .adm-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
  .adm-flash {
    padding: 12px 32px;
    font-size: 14px;
    font-weight: 500;
  }
  .adm-flash-err { background: rgba(239,68,68,0.15); color: #f87171; border-bottom: 1px solid rgba(239,68,68,0.2); }
  .adm-flash-ok { background: rgba(30,215,96,0.1); color: #1ed760; border-bottom: 1px solid rgba(30,215,96,0.15); }
  .adm-body {
    max-width: 860px;
    margin: 0 auto;
    padding: 40px 24px 80px;
    display: flex;
    flex-direction: column;
    gap: 48px;
  }
  .adm-section-title { font-size: 18px; font-weight: 700; margin-bottom: 20px; }
  .adm-form {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .adm-field { display: flex; flex-direction: column; gap: 6px; }
  .adm-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.45); }
  .adm-input {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 10px 14px;
    color: #fff;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
  }
  .adm-input:focus { border-color: rgba(30,215,96,0.5); }
  .adm-input option { background: #1a1a1a; }
  .adm-hint { font-size: 11px; color: rgba(255,255,255,0.3); line-height: 1.5; }
  .adm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .adm-checkbox-row { display: flex; align-items: center; gap: 10px; }
  .adm-checkbox { width: 16px; height: 16px; accent-color: #1ed760; cursor: pointer; }
  .adm-form-actions { display: flex; gap: 12px; }
  .adm-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
    text-decoration: none;
    white-space: nowrap;
  }
  .adm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .adm-btn-primary { background: linear-gradient(135deg, #1ed760, #0aad48); color: #000; }
  .adm-btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  .adm-btn-twitch { background: #9146ff; color: #fff; }
  .adm-btn-twitch:hover { background: #772ce8; }
  .adm-btn-ghost {
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.7);
    border: 1px solid rgba(255,255,255,0.1);
  }
  .adm-btn-ghost:hover { background: rgba(255,255,255,0.1); }
  .adm-btn-danger { background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
  .adm-btn-danger:hover { background: rgba(239,68,68,0.3); }
  .adm-btn-sm { padding: 6px 12px; font-size: 13px; }
  .adm-loading-small { color: rgba(255,255,255,0.3); padding: 20px 0; }
  .adm-empty { color: rgba(255,255,255,0.3); padding: 32px; text-align: center; border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px; }
  .adm-rewards-list { display: flex; flex-direction: column; gap: 12px; }
  .adm-reward-item {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 18px 20px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    transition: border-color 0.2s;
  }
  .adm-reward-item:hover { border-color: rgba(255,255,255,0.15); }
  .adm-reward-item.is-disabled { opacity: 0.4; }
  .adm-reward-main { flex: 1; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .adm-reward-info { display: flex; flex-direction: column; gap: 3px; }
  .adm-reward-name { font-weight: 600; font-size: 15px; }
  .adm-reward-action { font-size: 13px; color: rgba(255,255,255,0.5); }
  .adm-reward-desc { font-size: 12px; color: rgba(255,255,255,0.35); }
  .adm-reward-meta { display: flex; gap: 8px; flex-wrap: wrap; }
  .adm-badge {
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.5);
    white-space: nowrap;
  }
  .adm-badge-cost { color: #a78bfa; }
  .adm-badge-id { font-family: monospace; }
  .adm-reward-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .adm-toggle { background: none; border: none; cursor: pointer; font-size: 18px; padding: 4px; transition: transform 0.15s; }
  .adm-toggle:hover { transform: scale(1.2); }
  .adm-delete-confirm { display: flex; gap: 6px; }
  .adm-back { color: rgba(255,255,255,0.4); text-decoration: none; font-size: 14px; }
  .adm-back:hover { color: #fff; }
  .adm-nav { display: flex; gap: 16px; flex-wrap: wrap; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.07); }
  .adm-nav-link { font-size: 14px; color: rgba(255,255,255,0.4); text-decoration: none; padding: 8px 12px; border-radius: 6px; transition: all 0.2s; }
  .adm-nav-link:hover { color: #fff; background: rgba(255,255,255,0.05); }
  @media (max-width: 600px) {
    .adm-header { padding: 16px; }
    .adm-body { padding: 24px 16px 60px; }
    .adm-row { grid-template-columns: 1fr; }
    .adm-reward-item { flex-direction: column; }
  }
`
