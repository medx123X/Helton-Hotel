// Tiny Upstash Redis REST helper. No external deps — uses global fetch
// (Node 18+ on Vercel). Files prefixed with `_` are not exposed as routes.
//
// Required env vars:
//   UPSTASH_REDIS_REST_URL   (e.g. https://abc-xyz.upstash.io)
//   UPSTASH_REDIS_REST_TOKEN

const URL   = process.env.UPSTASH_REDIS_REST_URL   || '';
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

function isConfigured() {
  return Boolean(URL && TOKEN);
}

async function call(commandArr) {
  if (!isConfigured()) throw new Error('Upstash Redis not configured');
  const r = await fetch(URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commandArr)
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.error) {
    throw new Error(`Upstash ${r.status}: ${body.error || 'request failed'}`);
  }
  return body.result;
}

module.exports = {
  isConfigured,
  // Basic key-value
  set:    (key, value)   => call(['SET', key, JSON.stringify(value)]),
  get:    async (key)    => {
    const raw = await call(['GET', key]);
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  },
  del:    (key)          => call(['DEL', key]),
  // Sorted set (used to keep bookings in chronological order)
  zadd:   (key, score, member) => call(['ZADD', key, String(score), member]),
  zrange: (key, start, stop, opts = {}) => {
    const args = ['ZRANGE', key, String(start), String(stop)];
    if (opts.rev) args.push('REV');
    return call(args);
  },
  zcard:  (key) => call(['ZCARD', key]),
  // Multi-key get
  mget:   async (keys) => {
    if (!keys.length) return [];
    const raw = await call(['MGET', ...keys]);
    return raw.map(v => {
      if (v == null) return null;
      try { return JSON.parse(v); } catch { return v; }
    });
  }
};
