let _token = null;
let _expiry = 0;

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

async function getToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET');
  }
  if (_token && Date.now() < _expiry) return _token;
  const r = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`
  });
  const d = await r.json();
  _token = d.access_token;
  _expiry = Date.now() + (d.expires_in - 300) * 1000;
  return _token;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { a, u } = req.query;

  try {
    const token = await getToken();
    const headers = { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${token}` };

    // User info
    if (a === 'u' && u) {
      const r = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(u)}`, { headers });
      const d = await r.json();
      return res.json(d.data?.[0] ?? null);
    }

    // Stream status
    if (a === 's' && u) {
      const r = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(u)}`, { headers });
      const d = await r.json();
      return res.json({ live: !!(d.data?.length), stream: d.data?.[0] ?? null });
    }

    // Followers count
    if (a === 'f' && u) {
      const ur = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(u)}`, { headers });
      const ud = await ur.json();
      const uid = ud.data?.[0]?.id;
      if (!uid) return res.json({ total: 0 });
      const fr = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${uid}&first=1`, { headers });
      const fd = await fr.json();
      return res.json({ total: fd.total ?? 0 });
    }

    res.status(400).json({ error: 'bad request' });
  } catch (e) {
    console.error('Twitch API error:', e);
    res.status(500).json({ error: e.message });
  }
};
