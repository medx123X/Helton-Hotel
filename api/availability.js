const kv = require('./_kv');

const BOOKINGS_INDEX = 'bookings:index';
const BOOKING_KEY    = (ref) => `booking:${ref}`;

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}
function rangesOverlap(aIn, aOut, bIn, bOut) {
  return Date.parse(aIn) < Date.parse(bOut) && Date.parse(bIn) < Date.parse(aOut);
}

async function loadAllBookings() {
  const refs = await kv.zrange(BOOKINGS_INDEX, 0, -1, { rev: true });
  if (!refs || !refs.length) return [];
  const rows = await kv.mget(refs.map(BOOKING_KEY));
  return rows.filter(Boolean);
}

// GET  /api/availability?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD[&type=N&view=N]
// POST /api/availability  body: { checkin, checkout, type?, view? }
//
// If type+view are provided, returns {available: bool, conflict?: {checkin, checkout}}.
// If omitted, returns a map of all (type,view) combos -> availability for those dates.
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!kv.isConfigured()) {
    return res.status(503).json({ error: 'Storage not configured' });
  }

  let params = {};
  if (req.method === 'GET') {
    params = req.query || {};
  } else if (req.method === 'POST') {
    params = typeof req.body === 'object' && req.body !== null
      ? req.body
      : JSON.parse(req.body || '{}');
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { checkin, checkout, type, view } = params;
  if (!isValidDate(checkin) || !isValidDate(checkout)) {
    return res.status(400).json({ error: 'Invalid dates' });
  }
  if (Date.parse(checkout) <= Date.parse(checkin)) {
    return res.status(400).json({ error: 'Check-out must be after check-in' });
  }

  try {
    const bookings = await loadAllBookings();
    const overlapping = bookings.filter(b =>
      b.status !== 'cancelled' && rangesOverlap(checkin, checkout, b.checkin, b.checkout)
    );

    // Specific room+view query
    if (type && view) {
      const t = Number(type), v = Number(view);
      const conflict = overlapping.find(b => b.room?.type === t && b.room?.view === v);
      return res.status(200).json({
        available: !conflict,
        conflict: conflict ? { checkin: conflict.checkin, checkout: conflict.checkout } : null
      });
    }

    // Full matrix: every (type,view) pair we offer
    const matrix = {};
    for (const t of [1, 2]) {
      for (const v of [1, 2]) {
        const c = overlapping.find(b => b.room?.type === t && b.room?.view === v);
        matrix[`${t}-${v}`] = {
          available: !c,
          conflict:  c ? { checkin: c.checkin, checkout: c.checkout } : null
        };
      }
    }
    return res.status(200).json({ matrix });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
