const crypto = require('crypto');
const https  = require('https');
const kv     = require('./_kv');

const BREVO_KEY      = process.env.BREVO_KEY      || '';
const HOTEL_EMAIL    = process.env.HOTEL_EMAIL    || 'noreply.heltonhotel@gmail.com';
const HOTEL_NAME     = 'Helton Hotel';
const OTP_SECRET     = process.env.OTP_SECRET     || ('helton-otp-' + BREVO_KEY);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';
const ADMIN_SECRET   = process.env.ADMIN_SECRET   || ('helton-admin-' + ADMIN_PASSWORD);

const BOOKINGS_INDEX = 'bookings:index'; // sorted set: member=ref, score=createdAt
const BOOKING_KEY    = (ref) => `booking:${ref}`;

// ── Lightweight Brevo email (only used for cancellation notice) ──
function sendBrevoEmail(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.brevo.com', path: '/v3/smtp/email', method: 'POST',
      headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => res.statusCode < 300 ? resolve(d) : reject(new Error(`Brevo ${res.statusCode}: ${d}`)));
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

// ── Token helpers ────────────────────────────────────────────────
function verifySessionToken(email, token, expiry) {
  if (!email || !token || !expiry) return false;
  if (Date.now() > Number(expiry)) return false;
  const expected = crypto
    .createHmac('sha256', OTP_SECRET)
    .update(`session|${String(email).toLowerCase()}|${expiry}`)
    .digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(token));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Cancel token (long-lived, ~1 year) so the guest can self-cancel from the email.
function signCancelToken(ref, expiry) {
  return crypto
    .createHmac('sha256', OTP_SECRET)
    .update(`cancel|${ref}|${expiry}`)
    .digest('hex');
}

function verifyAdminToken(token, expiry) {
  if (!token || !expiry || Date.now() > Number(expiry)) return false;
  const expected = crypto
    .createHmac('sha256', ADMIN_SECRET)
    .update(`admin|${expiry}`)
    .digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(token));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Booking helpers ──────────────────────────────────────────────
function generateRef() {
  // 8 hex chars, prefixed for readability
  return 'HLT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}
function nightsBetween(checkin, checkout) {
  const ms = Date.parse(checkout) - Date.parse(checkin);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}
function rangesOverlap(aIn, aOut, bIn, bOut) {
  // Two date ranges [in, out) overlap iff aIn < bOut && bIn < aOut
  return Date.parse(aIn) < Date.parse(bOut) && Date.parse(bIn) < Date.parse(aOut);
}

async function loadAllBookings() {
  const refs = await kv.zrange(BOOKINGS_INDEX, 0, -1, { rev: true });
  if (!refs || !refs.length) return [];
  const keys = refs.map(BOOKING_KEY);
  const rows = await kv.mget(keys);
  return rows.filter(Boolean);
}

// ── Handler ──────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token, X-Admin-Expiry');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!kv.isConfigured()) {
    return res.status(503).json({
      error: 'Storage not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.'
    });
  }

  // ── GET: admin lists bookings ──────────────────────────────────
  if (req.method === 'GET') {
    const token  = req.headers['x-admin-token'];
    const expiry = req.headers['x-admin-expiry'];
    if (!verifyAdminToken(token, expiry)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const bookings = await loadAllBookings();
      return res.status(200).json({ bookings });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── DELETE: admin cancels a booking (status -> 'cancelled') ────
  if (req.method === 'DELETE') {
    const token  = req.headers['x-admin-token'];
    const expiry = req.headers['x-admin-expiry'];
    if (!verifyAdminToken(token, expiry)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const data = typeof req.body === 'object' && req.body !== null
        ? req.body
        : JSON.parse(req.body || '{}');
      const ref = data.ref || (req.query && req.query.ref);
      if (!ref) return res.status(400).json({ error: 'Missing booking ref' });

      const existing = await kv.get(BOOKING_KEY(ref));
      if (!existing) return res.status(404).json({ error: 'Booking not found' });
      if (existing.status === 'cancelled') {
        return res.status(200).json({ success: true, booking: existing, alreadyCancelled: true });
      }

      const updated = {
        ...existing,
        status: 'cancelled',
        cancelledAt: Date.now()
      };
      await kv.set(BOOKING_KEY(ref), updated);

      // Best-effort cancellation email — don't block the API on email failure.
      let emailSent = false;
      if (BREVO_KEY && existing.guest && existing.guest.email) {
        try {
          await sendBrevoEmail({
            sender: { name: HOTEL_NAME, email: HOTEL_EMAIL },
            to: [{ email: existing.guest.email, name: existing.guest.name || '' }],
            subject: `Helton Hotel — Reservation ${ref} Cancelled`,
            htmlContent: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0D0D0D;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;"><tr><td align="center">
<table width="500" cellpadding="0" cellspacing="0" style="max-width:500px;">
<tr><td align="center" style="background:#141414;border:1px solid rgba(201,168,76,0.3);padding:40px;">
<p style="margin:0 0 6px;font-size:10px;letter-spacing:4px;color:#8A7F6E;text-transform:uppercase;">Reservation Update</p>
<h1 style="margin:0 0 24px;font-size:22px;font-weight:300;letter-spacing:4px;color:#C9A84C;text-transform:uppercase;">Helton Hotel</h1>
<p style="margin:0 0 16px;font-size:14px;color:#E8E0D0;line-height:1.7;">Dear <strong style="color:#E8C97A;">${existing.guest.name || 'Guest'}</strong>,</p>
<p style="margin:0 0 16px;font-size:13px;color:#8A7F6E;line-height:1.8;">We are writing to inform you that your reservation <strong style="color:#E8C97A;">${ref}</strong> has been cancelled.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;">
<tr><td style="padding:6px 0;font-size:12px;color:#8A7F6E;text-transform:uppercase;width:50%;">Check-In</td><td style="padding:6px 0;font-size:13px;color:#E8E0D0;text-align:right;">${existing.checkin || '—'}</td></tr>
<tr><td style="padding:6px 0;font-size:12px;color:#8A7F6E;text-transform:uppercase;border-top:1px solid rgba(255,255,255,0.05);">Check-Out</td><td style="padding:6px 0;font-size:13px;color:#E8E0D0;text-align:right;border-top:1px solid rgba(255,255,255,0.05);">${existing.checkout || '—'}</td></tr>
</table>
<p style="margin:0 0 8px;font-size:12px;color:#8A7F6E;line-height:1.8;">If this was a mistake or you have questions, please contact our front desk and we will be happy to assist.</p>
<p style="margin:24px 0 0;font-size:11px;color:#4A4540;">Helton Hotel — Where every detail is a luxury</p>
</td></tr></table></td></tr></table></body></html>`
          });
          emailSent = true;
        } catch (e) { /* swallow — cancellation already saved */ }
      }

      return res.status(200).json({ success: true, booking: updated, emailSent });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST: create a booking (requires verified session) ─────────
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const data = typeof req.body === 'object' && req.body !== null
      ? req.body
      : JSON.parse(req.body || '{}');

    const {
      sessionToken, sessionExpiry,
      guest, room, services, checkin, checkout, totals
    } = data;

    if (!guest || !guest.email) return res.status(400).json({ error: 'Missing guest info' });
    if (!verifySessionToken(guest.email, sessionToken, sessionExpiry)) {
      return res.status(401).json({ error: 'Session invalid or expired. Please verify your email again.' });
    }
    if (!isValidDate(checkin) || !isValidDate(checkout)) {
      return res.status(400).json({ error: 'Invalid check-in/check-out dates' });
    }
    const nights = nightsBetween(checkin, checkout);
    if (nights < 1)  return res.status(400).json({ error: 'Check-out must be after check-in' });
    if (nights > 30) return res.status(400).json({ error: 'Stays longer than 30 nights are not supported online' });

    // Check-in cannot be in the past (allow today)
    const today = new Date(); today.setHours(0,0,0,0);
    if (Date.parse(checkin) < today.getTime()) {
      return res.status(400).json({ error: 'Check-in date cannot be in the past' });
    }

    if (!room || !room.type || !room.view) {
      return res.status(400).json({ error: 'Room type and view are required' });
    }

    // Conflict check: same room+view with overlapping dates
    const existing = await loadAllBookings();
    const conflict = existing.find(b =>
      b.room && b.room.type === room.type && b.room.view === room.view &&
      b.status !== 'cancelled' &&
      rangesOverlap(checkin, checkout, b.checkin, b.checkout)
    );
    if (conflict) {
      return res.status(409).json({
        error: `That room is already booked between ${conflict.checkin} and ${conflict.checkout}. Please pick different dates or a different room.`
      });
    }

    const ref = generateRef();
    const createdAt = Date.now();
    const booking = {
      ref,
      createdAt,
      status: 'confirmed',
      guest: {
        name:    String(guest.name || '').slice(0, 100),
        email:   String(guest.email).toLowerCase().slice(0, 200),
        nid:     String(guest.nid || '').slice(0, 50),
        phone:   String(guest.phone || '').slice(0, 50),
        persons: Number(guest.persons) || 1
      },
      room: {
        type: Number(room.type),
        view: Number(room.view)
      },
      services: services || {},
      checkin,
      checkout,
      nights,
      totals: totals || {}
    };

    await kv.set(BOOKING_KEY(ref), booking);
    await kv.zadd(BOOKINGS_INDEX, createdAt, ref);

    // Build a self-serve cancellation URL the guest can click in the confirmation email.
    const cancelExpiry = createdAt + 365 * 24 * 60 * 60 * 1000;
    const cancelToken  = signCancelToken(ref, cancelExpiry);
    const proto = (req.headers['x-forwarded-proto'] || 'https').toString().split(',')[0];
    const host  = req.headers['host'] || '';
    const origin = host ? `${proto}://${host}` : '';
    const cancelUrl = origin
      ? `${origin}/cancel.html?ref=${encodeURIComponent(ref)}&token=${cancelToken}&exp=${cancelExpiry}`
      : '';

    return res.status(200).json({
      success: true, ref, booking,
      cancelToken, cancelExpiry, cancelUrl
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
