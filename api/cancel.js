const crypto = require('crypto');
const https  = require('https');
const kv     = require('./_kv');

const BREVO_KEY   = process.env.BREVO_KEY   || '';
const HOTEL_EMAIL = process.env.HOTEL_EMAIL || 'noreply.heltonhotel@gmail.com';
const HOTEL_NAME  = 'Helton Hotel';
const OTP_SECRET  = process.env.OTP_SECRET  || ('helton-otp-' + BREVO_KEY);

const BOOKING_KEY = (ref) => `booking:${ref}`;

function signCancelToken(ref, expiry) {
  return crypto
    .createHmac('sha256', OTP_SECRET)
    .update(`cancel|${ref}|${expiry}`)
    .digest('hex');
}
function timingSafeEqStr(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

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

// GET  /api/cancel?ref=&token=&exp=    → preview booking (no mutation)
// POST /api/cancel  body: { ref, token, exp } → cancel
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!kv.isConfigured())       return res.status(503).json({ error: 'Storage not configured' });
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const params = req.method === 'GET'
    ? (req.query || {})
    : (typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(req.body || '{}'));

  const { ref, token } = params;
  const exp = params.exp || params.expiry;
  if (!ref || !token || !exp) {
    return res.status(400).json({ error: 'Missing ref / token / exp' });
  }
  if (Date.now() > Number(exp)) {
    return res.status(400).json({ error: 'This cancellation link has expired. Please contact the hotel directly.' });
  }
  const expected = signCancelToken(ref, Number(exp));
  if (!timingSafeEqStr(expected, token)) {
    return res.status(401).json({ error: 'Invalid cancellation link.' });
  }

  try {
    const booking = await kv.get(BOOKING_KEY(ref));
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    // GET = preview only
    if (req.method === 'GET') {
      // Strip personal-ish data not needed for the preview page
      return res.status(200).json({
        ok: true,
        booking: {
          ref: booking.ref,
          status: booking.status,
          checkin: booking.checkin,
          checkout: booking.checkout,
          nights: booking.nights,
          guest: { name: booking.guest?.name, email: booking.guest?.email },
          room: booking.room,
          totals: booking.totals
        }
      });
    }

    // POST = perform cancellation
    if (booking.status === 'cancelled') {
      return res.status(200).json({ ok: true, alreadyCancelled: true, booking });
    }
    const updated = { ...booking, status: 'cancelled', cancelledAt: Date.now(), cancelledBy: 'guest' };
    await kv.set(BOOKING_KEY(ref), updated);

    // Best-effort confirmation email
    if (BREVO_KEY && booking.guest && booking.guest.email) {
      try {
        await sendBrevoEmail({
          sender: { name: HOTEL_NAME, email: HOTEL_EMAIL },
          to: [{ email: booking.guest.email, name: booking.guest.name || '' }],
          subject: `Helton Hotel — Reservation ${ref} Cancelled`,
          htmlContent: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0D0D0D;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;"><tr><td align="center">
<table width="500" cellpadding="0" cellspacing="0" style="max-width:500px;">
<tr><td align="center" style="background:#141414;border:1px solid rgba(201,168,76,0.3);padding:40px;">
<p style="margin:0 0 6px;font-size:10px;letter-spacing:4px;color:#8A7F6E;text-transform:uppercase;">Reservation Cancelled</p>
<h1 style="margin:0 0 24px;font-size:22px;font-weight:300;letter-spacing:4px;color:#C9A84C;text-transform:uppercase;">Helton Hotel</h1>
<p style="margin:0 0 16px;font-size:14px;color:#E8E0D0;line-height:1.7;">Dear <strong style="color:#E8C97A;">${booking.guest.name || 'Guest'}</strong>,</p>
<p style="margin:0 0 16px;font-size:13px;color:#8A7F6E;line-height:1.8;">Your reservation <strong style="color:#E8C97A;">${ref}</strong> has been cancelled at your request.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;">
<tr><td style="padding:6px 0;font-size:12px;color:#8A7F6E;text-transform:uppercase;width:50%;">Check-In</td><td style="padding:6px 0;font-size:13px;color:#E8E0D0;text-align:right;">${booking.checkin || '—'}</td></tr>
<tr><td style="padding:6px 0;font-size:12px;color:#8A7F6E;text-transform:uppercase;border-top:1px solid rgba(255,255,255,0.05);">Check-Out</td><td style="padding:6px 0;font-size:13px;color:#E8E0D0;text-align:right;border-top:1px solid rgba(255,255,255,0.05);">${booking.checkout || '—'}</td></tr>
</table>
<p style="margin:0 0 8px;font-size:12px;color:#8A7F6E;line-height:1.8;">We hope to welcome you another time. If this was a mistake, please contact our front desk and we will be glad to assist.</p>
<p style="margin:24px 0 0;font-size:11px;color:#4A4540;">Helton Hotel — Where every detail is a luxury</p>
</td></tr></table></td></tr></table></body></html>`
        });
      } catch (e) { /* swallow */ }
    }

    return res.status(200).json({ ok: true, booking: updated });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
