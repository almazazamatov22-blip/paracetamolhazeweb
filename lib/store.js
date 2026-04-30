const memory = global.__PH_STORE__ || new Map();
if (!global.__PH_STORE__) {
  global.__PH_STORE__ = memory;
}

function hasUpstash() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function runUpstashPipeline(commands) {
  const res = await fetch(`${process.env.KV_REST_API_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commands)
  });

  if (!res.ok) {
    throw new Error(`KV request failed: ${res.status}`);
  }

  return res.json();
}

async function getJson(key, fallback = null) {
  if (hasUpstash()) {
    try {
      const out = await runUpstashPipeline([['GET', key]]);
      const value = out?.[0]?.result;
      if (value === null || value === undefined) return fallback;
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  if (!memory.has(key)) return fallback;
  return memory.get(key);
}

async function setJson(key, value, ttlSec = null) {
  if (hasUpstash()) {
    const serialized = JSON.stringify(value);
    const cmd = ttlSec
      ? [['SET', key, serialized, 'EX', String(ttlSec)]]
      : [['SET', key, serialized]];
    await runUpstashPipeline(cmd);
    return value;
  }

  memory.set(key, value);
  return value;
}

module.exports = {
  getJson,
  setJson
};
