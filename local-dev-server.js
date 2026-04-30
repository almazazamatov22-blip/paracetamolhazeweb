const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  getStreamsChartsSubscriptions,
  sortSubscriptions,
  extractKinopoiskId,
  buildMirrorList,
  getKinoTimings,
  addKinoTiming,
  removeKinoTiming,
  getRealtimeState,
  setRealtimeState,
  getTwitchUserByLogin,
  getStreamByLogin,
  getFollowersTotalByLogin
} = require('./lib/core');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (_) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

async function routeApi(req, res, url) {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname === '/api/check/subscriptions' && req.method === 'GET') {
    const user = (url.searchParams.get('user') || '').trim().toLowerCase();
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const sort = (url.searchParams.get('sort') || 'date_desc').trim();
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    if (!user) return sendJson(res, 400, { error: 'Missing user' });

    const data = await getStreamsChartsSubscriptions(user);
    if (!data.user) {
      return sendJson(res, 404, { error: 'User not found', user: null, totals: { totalSubs: 0, liveCount: 0 }, items: [], page: 1, pages: 1 });
    }

    let items = data.items;
    if (q) items = items.filter((x) => x.displayName.toLowerCase().includes(q) || x.login.includes(q));
    items = sortSubscriptions(items, sort);
    const liveCount = items.filter((x) => x.isLive).length;
    const pageSize = 24;
    const pages = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.min(page, pages);
    const start = (safePage - 1) * pageSize;
    return sendJson(res, 200, {
      user: data.user,
      totals: { totalSubs: items.length, liveCount },
      items: items.slice(start, start + pageSize),
      page: safePage,
      pages
    });
  }

  if (url.pathname === '/api/kino/resolve' && req.method === 'GET') {
    const id = extractKinopoiskId((url.searchParams.get('id') || '').trim());
    if (!id) return sendJson(res, 400, { error: 'Invalid Kinopoisk id/url' });
    return sendJson(res, 200, {
      movieMeta: { id, sourceUrl: `https://www.kinopoisk.ru/film/${id}/`, title: `Kinopoisk #${id}` },
      mirrors: buildMirrorList(id)
    });
  }

  if (url.pathname === '/api/kino/timings') {
    const id = extractKinopoiskId((url.searchParams.get('id') || '').trim());
    if (!id) return sendJson(res, 400, { error: 'Invalid id' });

    if (req.method === 'GET') {
      return sendJson(res, 200, { id, timings: await getKinoTimings(id) });
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const created = await addKinoTiming(id, {
        time: String(body.time || '').trim(),
        category: String(body.category || '').trim(),
        label: String(body.label || '').trim()
      });
      return sendJson(res, 201, { id, timing: created });
    }
    if (req.method === 'DELETE') {
      const timingId = (url.searchParams.get('timingId') || '').trim();
      return sendJson(res, 200, { id, timings: await removeKinoTiming(id, timingId) });
    }
  }

  if (url.pathname === '/api/roz/participants') {
    const channel = (url.searchParams.get('channel') || '').trim().toLowerCase();
    if (!channel) return sendJson(res, 400, { error: 'Missing channel' });
    if (req.method === 'GET') {
      const state = await getRealtimeState('roz', channel, { participants: [] });
      return sendJson(res, 200, { channel, participants: state.participants || [], updatedAt: state.updatedAt || null });
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const participants = Array.isArray(body.participants) ? body.participants : [];
      const state = await setRealtimeState('roz', channel, { participants });
      return sendJson(res, 200, { channel, participants: state.participants || [], updatedAt: state.updatedAt || null });
    }
  }

  const dynamic = url.pathname.match(/^\/api\/realtime\/state\/([^/]+)\/([^/]+)$/);
  if (dynamic) {
    const moduleName = dynamic[1].toLowerCase();
    const room = dynamic[2].toLowerCase();
    if (req.method === 'GET') {
      return sendJson(res, 200, { module: moduleName, room, state: await getRealtimeState(moduleName, room, {}) });
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const next = await setRealtimeState(moduleName, room, body.state || {}, Number(body.ttlSec || 60 * 60 * 24));
      return sendJson(res, 200, { module: moduleName, room, state: next });
    }
  }

  if (url.pathname === '/api/twitch' && req.method === 'GET') {
    const a = (url.searchParams.get('a') || '').trim();
    const u = (url.searchParams.get('u') || '').trim().toLowerCase();
    if (!u) return sendJson(res, 400, { error: 'Missing u' });

    if (a === 'u') {
      const user = await getTwitchUserByLogin(u);
      return sendJson(res, user ? 200 : 404, user || { error: 'not found' });
    }
    if (a === 's') {
      const stream = await getStreamByLogin(u);
      return sendJson(res, 200, { live: Boolean(stream), stream: stream || null });
    }
    if (a === 'f') {
      const total = await getFollowersTotalByLogin(u);
      return sendJson(res, 200, { total });
    }
    return sendJson(res, 400, { error: 'Unknown action' });
  }

  return sendJson(res, 404, { error: 'Not found' });
}

function safeResolve(p) {
  const normalized = p === '/' ? '/index.html' : p;
  const resolved = path.normalize(path.join(__dirname, normalized));
  if (!resolved.startsWith(__dirname)) return path.join(__dirname, 'index.html');
  return resolved;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      await routeApi(req, res, url);
      return;
    }

    const fullPath = safeResolve(url.pathname);
    let stat = null;
    try {
      stat = fs.statSync(fullPath);
    } catch (_) {}

    if (stat && stat.isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      res.statusCode = 200;
      res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
      fs.createReadStream(fullPath).pipe(res);
      return;
    }

    const indexPath = path.join(__dirname, 'index.html');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    fs.createReadStream(indexPath).pipe(res);
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`Server on http://localhost:${port}`);
});
