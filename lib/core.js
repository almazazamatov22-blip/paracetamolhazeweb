const { getJson, setJson } = require('./store');

let tokenCache = null;
let tokenExpiry = 0;

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

async function getTwitchAppToken() {
  if (tokenCache && Date.now() < tokenExpiry) return tokenCache;

  const clientId = env('TWITCH_CLIENT_ID');
  const clientSecret = env('TWITCH_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('Missing TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials'
  });

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.message || 'Cannot get Twitch token');
  }

  tokenCache = data.access_token;
  tokenExpiry = Date.now() + Math.max(60, (data.expires_in || 3600) - 120) * 1000;
  return tokenCache;
}

async function twitchFetch(path) {
  const token = await getTwitchAppToken();
  const clientId = env('TWITCH_CLIENT_ID');
  const res = await fetch(`https://api.twitch.tv/helix${path}`, {
    headers: {
      'Client-Id': clientId,
      Authorization: `Bearer ${token}`
    }
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || `Twitch error ${res.status}`);
  }

  return json;
}

async function getTwitchUserByLogin(login) {
  const data = await twitchFetch(`/users?login=${encodeURIComponent(login.toLowerCase())}`);
  return data.data?.[0] || null;
}

async function getStreamByLogin(login) {
  const data = await twitchFetch(`/streams?user_login=${encodeURIComponent(login.toLowerCase())}`);
  return data.data?.[0] || null;
}

async function getFollowersTotalByLogin(login) {
  const user = await getTwitchUserByLogin(login);
  if (!user?.id) return 0;
  const data = await twitchFetch(`/channels/followers?broadcaster_id=${encodeURIComponent(user.id)}&first=1`);
  return Number(data.total || 0);
}

async function getLiveMapByLogins(logins) {
  const uniq = [...new Set(logins.filter(Boolean).map((x) => x.toLowerCase()))].slice(0, 100);
  if (!uniq.length) return new Map();

  const params = new URLSearchParams();
  uniq.forEach((login) => params.append('user_login', login));
  const data = await twitchFetch(`/streams?${params.toString()}`);
  const live = new Map();

  for (const s of data.data || []) {
    if (s.user_login) live.set(String(s.user_login).toLowerCase(), s);
  }

  return live;
}

function normalizeSubsPayload(raw) {
  const bucket =
    raw?.subscriptions ||
    raw?.items ||
    raw?.results ||
    raw?.data?.subscriptions ||
    raw?.data?.items ||
    raw?.data ||
    raw?.result ||
    [];

  const arr = Array.isArray(bucket) ? bucket : Array.isArray(bucket?.items) ? bucket.items : [];

  const out = arr
    .map((item, idx) => {
      const login =
        item?.login ||
        item?.channel_login ||
        item?.channel?.login ||
        item?.broadcaster_login ||
        item?.name ||
        '';

      const displayName =
        item?.display_name ||
        item?.channel_display_name ||
        item?.channel?.display_name ||
        item?.name ||
        login;

      const avatar =
        item?.profile_image_url ||
        item?.avatar ||
        item?.channel?.profile_image_url ||
        item?.image ||
        '';

      const subscribedAt =
        item?.subscribed_at ||
        item?.sub_at ||
        item?.created_at ||
        item?.date ||
        item?.sub_date ||
        null;

      const tier =
        item?.tier ||
        item?.sub_tier ||
        item?.plan ||
        item?.subscription_tier ||
        null;

      return {
        id: item?.id || login || `sub-${idx}`,
        login: String(login || '').toLowerCase(),
        displayName: String(displayName || '').trim(),
        avatar: String(avatar || ''),
        subscribedAt,
        tier,
        isLive: Boolean(item?.live)
      };
    })
    .filter((x) => x.login || x.displayName);

  return out;
}

async function getStreamsChartsSubscriptions(login) {
  const user = await getTwitchUserByLogin(login);
  if (!user) return { user: null, items: [] };

  const scToken = env('STREAMSCHARTS_TOKEN');
  const scClientId = env('STREAMSCHARTS_CLIENT_ID');
  const scBase = env('STREAMSCHARTS_URL', 'https://streamscharts.com/api/token');

  if (!scToken || !scClientId) {
    throw new Error('Missing STREAMSCHARTS_TOKEN / STREAMSCHARTS_CLIENT_ID');
  }

  const url = scBase.includes('?')
    ? `${scBase}&login=${encodeURIComponent(user.id)}`
    : `${scBase}?login=${encodeURIComponent(user.id)}`;

  const scRes = await fetch(url, {
    headers: {
      Authorization: `Bearer ${scToken}`,
      'Client-ID': scClientId
    }
  });

  const scData = await scRes.json();
  if (!scRes.ok) {
    throw new Error(scData?.message || `StreamsCharts error ${scRes.status}`);
  }

  const items = normalizeSubsPayload(scData);
  const liveMap = await getLiveMapByLogins(items.map((x) => x.login));

  const hydrated = items.map((item) => {
    const stream = liveMap.get(item.login);
    return {
      ...item,
      isLive: item.isLive || Boolean(stream),
      viewerCount: stream?.viewer_count || 0,
      gameName: stream?.game_name || null
    };
  });

  return {
    user: {
      id: user.id,
      login: user.login,
      displayName: user.display_name,
      avatar: user.profile_image_url || ''
    },
    items: hydrated
  };
}

function sortSubscriptions(items, sort) {
  const clone = [...items];
  const toTs = (val) => {
    const ts = Date.parse(val || '');
    return Number.isFinite(ts) ? ts : 0;
  };

  switch (sort) {
    case 'name_asc':
      clone.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru'));
      break;
    case 'name_desc':
      clone.sort((a, b) => b.displayName.localeCompare(a.displayName, 'ru'));
      break;
    case 'date_asc':
      clone.sort((a, b) => toTs(a.subscribedAt) - toTs(b.subscribedAt));
      break;
    case 'live':
      clone.sort((a, b) => Number(b.isLive) - Number(a.isLive) || b.displayName.localeCompare(a.displayName, 'ru'));
      break;
    case 'date_desc':
    default:
      clone.sort((a, b) => toTs(b.subscribedAt) - toTs(a.subscribedAt));
      break;
  }

  return clone;
}

function extractKinopoiskId(input) {
  if (!input) return null;
  const value = String(input).trim();
  if (/^\d{2,10}$/.test(value)) return value;
  const match = value.match(/\/film\/(\d+)/i) || value.match(/(?:^|\D)(\d{5,10})(?:\D|$)/);
  return match ? match[1] : null;
}

function buildMirrorList(id) {
  return [
    {
      id: 'fbsite',
      label: 'fbsite.top',
      embedUrl: `https://fbsite.top/film/${id}/`,
      openUrl: `https://fbsite.top/film/${id}/`
    },
    {
      id: 'kinopoisk-vip',
      label: 'kinopoisk.vip',
      embedUrl: `https://www.kinopoisk.vip/film/${id}/`,
      openUrl: `https://www.kinopoisk.vip/film/${id}/`
    },
    {
      id: 'kinopoisk-ru',
      label: 'kinopoisk.ru',
      embedUrl: `https://www.kinopoisk.ru/film/${id}/`,
      openUrl: `https://www.kinopoisk.ru/film/${id}/`
    }
  ];
}

async function getKinoTimings(id) {
  return getJson(`kino:timings:${id}`, []);
}

async function addKinoTiming(id, payload) {
  const timings = await getKinoTimings(id);
  const next = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time: payload.time,
    category: payload.category,
    label: payload.label,
    createdAt: new Date().toISOString()
  };
  timings.push(next);
  timings.sort((a, b) => String(a.time).localeCompare(String(b.time)));
  await setJson(`kino:timings:${id}`, timings);
  return next;
}

async function removeKinoTiming(id, timingId) {
  const timings = await getKinoTimings(id);
  const filtered = timings.filter((x) => x.id !== timingId);
  await setJson(`kino:timings:${id}`, filtered);
  return filtered;
}

async function getRealtimeState(moduleName, room, fallback = {}) {
  const key = `rt:${moduleName}:${room}`;
  return getJson(key, fallback);
}

async function setRealtimeState(moduleName, room, patch, ttlSec = 60 * 60 * 24) {
  const key = `rt:${moduleName}:${room}`;
  const current = await getJson(key, {});
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  await setJson(key, next, ttlSec);
  return next;
}

module.exports = {
  getTwitchUserByLogin,
  getStreamByLogin,
  getFollowersTotalByLogin,
  getStreamsChartsSubscriptions,
  sortSubscriptions,
  extractKinopoiskId,
  buildMirrorList,
  getKinoTimings,
  addKinoTiming,
  removeKinoTiming,
  getRealtimeState,
  setRealtimeState
};
