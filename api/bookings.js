const crypto = require('crypto');
const kv     = require('./_kv');

const BREVO_KEY      = process.env.BREVO_KEY      || '';
const OTP_SECRET     = process.env.OTP_SECRET     || ('helton-otp-' + BREVO_KEY);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';
const ADMIN_SECRET   = process.env.ADMIN_SECRET   || ('helton-admin-' + ADMIN_PASSWORD);

const BOOKINGS_INDEX = 'bookings:index'; // sorted set: member=ref, score=createdAt
const BOOKING_KEY    = (ref) => `booking:${ref}`;

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

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

    return res.status(200).json({ success: true, ref, booking });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
