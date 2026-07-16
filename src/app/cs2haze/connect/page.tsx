"use client";

import { useEffect, useState } from "react";

export default function ConnectPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me", {
      credentials: "include",
      cache: "no-store"
    })
      .then(async (res) => {
        if (!res.ok) {
          setUser(null);
          return;
        }

        const data = await res.json();

        if (data?.id && data?.login) {
          setUser(data);
        } else {
          setUser(null);
        }
      })
      .catch((err) => {
        console.error(err);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    setError("");
    try {
      const res = await fetch("/api/cs2/launcher/connect-token", {
        method: "POST"
      });
      if (!res.ok) throw new Error("Ошибка получения токена подключения");
      const data = await res.json();
      if (data.token) {
        window.location.href = `cs2haze://connect?token=${encodeURIComponent(data.token)}&origin=${encodeURIComponent(window.location.origin)}`;
        // Показываем сообщение об успехе после небольшого таймаута
        setTimeout(() => {
          setConnecting(false);
          setError("Запрос отправлен в приложение cs2haze. Можете закрыть эту вкладку.");
        }, 1500);
      } else {
        throw new Error("Неверный ответ сервера");
      }
    } catch (err: any) {
      setError(err.message || "Произошла ошибка");
      setConnecting(false);
    }
  };

  if (loading) return <div style={{ minHeight: '100vh', background: '#0f1117', padding: 40, color: '#fff', textAlign: 'center' }}>Загрузка...</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', color: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 40, maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>Подключение CS2Haze</h1>
        
        {!user ? (
          <div>
            <p style={{ marginBottom: 24, color: 'rgba(255,255,255,0.6)' }}>Войдите через Twitch, чтобы подключить этот компьютер.</p>
            <a href="/auth/twitch?source=cs2haze" style={{ display: 'inline-block', background: '#9146ff', color: '#fff', padding: '12px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 'bold' }}>
              Войти через Twitch
            </a>
          </div>
        ) : (
          <div>
            <p style={{ marginBottom: 24, color: 'rgba(255,255,255,0.6)' }}>Вы вошли как <strong>{user.display_name || user.login}</strong></p>
            
            {error && <div style={{ color: error.includes("Запрос отправлен") ? '#22c55e' : '#ef4444', marginBottom: 16 }}>{error}</div>}
            
            <button 
              onClick={handleConnect} 
              disabled={connecting}
              style={{ background: '#6366f1', color: '#fff', padding: '12px 24px', borderRadius: 8, border: 'none', fontWeight: 'bold', cursor: connecting ? 'not-allowed' : 'pointer', opacity: connecting ? 0.7 : 1 }}
            >
              {connecting ? "Подключение..." : "Подключить этот компьютер к cs2haze"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
