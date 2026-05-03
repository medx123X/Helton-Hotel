const crypto = require('crypto');

const ADMIN_USER     = process.env.ADMIN_USER     || 'Admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';
const ADMIN_SECRET   = process.env.ADMIN_SECRET   || ('helton-admin-' + ADMIN_PASSWORD);

// Per-IP rate limit (best-effort, in-memory)
const ATTEMPTS = new Map();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

function timingSafeEqStr(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function signAdmin(expiry) {
  return crypto
    .createHmac('sha256', ADMIN_SECRET)
    .update(`admin|${expiry}`)
    .digest('hex');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const now = Date.now();
    let rec = ATTEMPTS.get(ip);
    if (rec && now - rec.firstAt > WINDOW_MS) { ATTEMPTS.delete(ip); rec = null; }
    if (!rec) { rec = { count: 0, firstAt: now }; ATTEMPTS.set(ip, rec); }
    if (rec.count >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
    }
    rec.count++;

    const data = typeof req.body === 'object' && req.body !== null
      ? req.body
      : JSON.parse(req.body || '{}');
    const { user, password } = data;

    const userOk = timingSafeEqStr(user || '', ADMIN_USER);
    const passOk = timingSafeEqStr(password || '', ADMIN_PASSWORD);
    if (!userOk || !passOk) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    // Reset attempt counter on success
    ATTEMPTS.delete(ip);

    const adminExpiry = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
    const adminToken  = signAdmin(adminExpiry);
    return res.status(200).json({ ok: true, adminToken, adminExpiry });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
