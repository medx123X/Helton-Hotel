const crypto = require('crypto');

// Must match the secret used to sign tokens in /api/send-email
const BREVO_KEY  = process.env.BREVO_KEY  || '';
const OTP_SECRET = process.env.OTP_SECRET || ('helton-otp-' + BREVO_KEY);

// Per-token attempt counter. In-memory + best-effort: a Vercel lambda
// instance may serve hundreds of requests before recycling, so this
// blocks brute-force within a single warm container. For stronger
// guarantees, swap this for Vercel KV / Upstash Redis.
const ATTEMPTS = new Map(); // token -> { count, firstAt }
const MAX_ATTEMPTS = 6;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

function signOtp(email, code, expiry) {
  return crypto
    .createHmac('sha256', OTP_SECRET)
    .update(`${email.toLowerCase()}|${code}|${expiry}`)
    .digest('hex');
}

function timingSafeEq(a, b) {
  const ab = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const data = typeof req.body === 'object' && req.body !== null
      ? req.body
      : JSON.parse(req.body || '{}');
    const { email, code, token, expiry } = data;

    if (!email || !code || !token || !expiry) {
      return res.status(400).json({ valid: false, error: 'Missing fields' });
    }
    if (!/^\d{6}$/.test(String(code))) {
      return res.status(400).json({ valid: false, error: 'Invalid code format' });
    }
    if (Date.now() > Number(expiry)) {
      return res.status(400).json({ valid: false, error: 'Code expired' });
    }

    // Brute-force guard
    const now = Date.now();
    let rec = ATTEMPTS.get(token);
    if (rec && now - rec.firstAt > ATTEMPT_WINDOW_MS) { rec = null; ATTEMPTS.delete(token); }
    if (!rec) { rec = { count: 0, firstAt: now }; ATTEMPTS.set(token, rec); }
    if (rec.count >= MAX_ATTEMPTS) {
      return res.status(429).json({ valid: false, error: 'Too many attempts. Request a new code.' });
    }
    rec.count++;

    const expected = signOtp(email, String(code), Number(expiry));
    if (!timingSafeEq(expected, String(token))) {
      return res.status(200).json({ valid: false, error: 'Incorrect code' });
    }

    // Success — invalidate token by maxing out attempts so it can't be reused.
    rec.count = MAX_ATTEMPTS;
    return res.status(200).json({ valid: true });
  } catch (err) {
    return res.status(500).json({ valid: false, error: err.message });
  }
};
