const https  = require('https');
const crypto = require('crypto');

// ── CONFIG ──────────────────────────────────────────────────────
const BREVO_KEY   = process.env.BREVO_KEY   || '';
const HOTEL_EMAIL = process.env.HOTEL_EMAIL || 'noreply.heltonhotel@gmail.com';
const HOTEL_NAME  = 'Helton Hotel';
// Used to sign OTP tokens. If unset, derived from BREVO_KEY so old tokens
// invalidate when the API key rotates. NEVER expose this to the client.
const OTP_SECRET  = process.env.OTP_SECRET || ('helton-otp-' + BREVO_KEY);

// ── OTP HELPERS (server-side, stateless) ─────────────────────────
function generateOtpCode() {
  // Cryptographically random 6-digit code
  return (crypto.randomInt(0, 1000000)).toString().padStart(6, '0');
}
function signOtp(email, code, expiry) {
  return crypto
    .createHmac('sha256', OTP_SECRET)
    .update(`${email.toLowerCase()}|${code}|${expiry}`)
    .digest('hex');
}

// ── HELPER: call Brevo API ───────────────────────────────────────
function sendBrevoEmail(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'api-key': BREVO_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, body: data });
        } else {
          reject(new Error(`Brevo ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── MAIN HANDLER (Vercel) ───────────────────────────────────────
module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).send('Method not allowed');

  try {
    // Vercel auto-parses JSON when content-type is application/json,
    // but fall back to manual parse just in case.
    const data = typeof req.body === 'object' && req.body !== null
      ? req.body
      : JSON.parse(req.body || '{}');
    const { type } = data;

    // ── OTP EMAIL ────────────────────────────────────────────────
    if (type === 'otp') {
      const { to_email, guest_name } = data;
      if (!to_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to_email)) {
        return res.status(400).json({ error: 'Invalid email' });
      }
      // Generate code + signed token entirely on the server.
      const otp_code = generateOtpCode();
      const expiry   = Date.now() + 10 * 60 * 1000; // 10 minutes
      const token    = signOtp(to_email, otp_code, expiry);

      await sendBrevoEmail({
        sender: { name: HOTEL_NAME, email: HOTEL_EMAIL },
        to: [{ email: to_email, name: guest_name }],
        subject: 'Your Helton Hotel Verification Code',
        htmlContent: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0D0D0D;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;"><tr><td align="center">
<table width="500" cellpadding="0" cellspacing="0" style="max-width:500px;">
<tr><td align="center" style="background:#141414;border:1px solid rgba(201,168,76,0.3);padding:40px;">
<p style="margin:0 0 6px;font-size:10px;letter-spacing:4px;color:#8A7F6E;text-transform:uppercase;">★ ★ ★ ★ ★</p>
<h1 style="margin:0 0 24px;font-size:24px;font-weight:300;letter-spacing:5px;color:#C9A84C;text-transform:uppercase;">Helton Hotel</h1>
<p style="margin:0 0 8px;font-size:13px;color:#8A7F6E;">Dear <strong style="color:#E8E0D0;">${guest_name}</strong>,</p>
<p style="margin:0 0 28px;font-size:13px;color:#8A7F6E;line-height:1.7;">Your verification code is:</p>
<div style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);padding:20px 40px;margin-bottom:24px;">
  <p style="margin:0;font-size:42px;font-weight:600;letter-spacing:12px;color:#E8C97A;text-align:center;">${otp_code}</p>
</div>
<p style="margin:0 0 6px;font-size:12px;color:#8A7F6E;">This code expires in <strong style="color:#E8E0D0;">10 minutes</strong>.</p>
<p style="margin:0;font-size:11px;color:#4A4540;">If you did not request this, please ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`
      });
      // Token + expiry are public (HMAC-protected); the code itself is secret.
      return res.status(200).json({ success: true, token, expiry });
    }

    // ── BOOKING CONFIRMATION EMAIL ───────────────────────────────
    if (type === 'booking') {
      const { to_email, guest_name, ref_code, room_type, room_view, nights, grand_total, services_list } = data;
      await sendBrevoEmail({
        sender: { name: HOTEL_NAME, email: HOTEL_EMAIL },
        to: [{ email: to_email, name: guest_name }],
        subject: `Helton Hotel — Booking Confirmation ${ref_code}`,
        htmlContent: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0D0D0D;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td align="center" style="background:#141414;border:1px solid rgba(201,168,76,0.3);border-bottom:none;padding:40px 40px 30px;">
<p style="margin:0 0 8px;font-size:11px;letter-spacing:4px;color:#8A7F6E;text-transform:uppercase;">★ ★ ★ ★ ★</p>
<h1 style="margin:0 0 6px;font-size:32px;font-weight:300;letter-spacing:6px;color:#C9A84C;text-transform:uppercase;">HELTON HOTEL</h1>
<p style="margin:0;font-size:10px;letter-spacing:3px;color:#8A7F6E;text-transform:uppercase;">Booking Confirmation</p>
</td></tr>
<tr><td align="center" style="background:rgba(201,168,76,0.1);border-left:1px solid rgba(201,168,76,0.3);border-right:1px solid rgba(201,168,76,0.3);padding:18px 40px;">
<p style="margin:0 0 4px;font-size:10px;letter-spacing:3px;color:#8A7F6E;text-transform:uppercase;">Reservation Reference</p>
<p style="margin:0;font-size:28px;font-weight:300;color:#E8C97A;letter-spacing:4px;">${ref_code}</p>
</td></tr>
<tr><td style="background:#1E1B16;border:1px solid rgba(201,168,76,0.3);border-top:none;padding:32px 40px 20px;">
<p style="margin:0 0 16px;font-size:15px;color:#E8E0D0;line-height:1.6;">Dear <strong style="color:#E8C97A;">${guest_name}</strong>,</p>
<p style="margin:0;font-size:14px;color:#8A7F6E;line-height:1.8;">We are delighted to confirm your reservation. Please find your booking details below.</p>
</td></tr>
<tr><td style="background:#1E1B16;border-left:1px solid rgba(201,168,76,0.3);border-right:1px solid rgba(201,168,76,0.3);padding:0 40px 28px;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td colspan="2" style="padding-bottom:14px;"><p style="margin:0;font-size:10px;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;border-bottom:1px solid rgba(201,168,76,0.2);padding-bottom:10px;">Booking Details</p></td></tr>
<tr><td style="padding:8px 0;font-size:12px;color:#8A7F6E;text-transform:uppercase;width:50%;">Room Type</td><td style="padding:8px 0;font-size:13px;color:#E8E0D0;text-align:right;">${room_type}</td></tr>
<tr><td style="padding:8px 0;font-size:12px;color:#8A7F6E;text-transform:uppercase;border-top:1px solid rgba(255,255,255,0.04);">Room View</td><td style="padding:8px 0;font-size:13px;color:#E8E0D0;text-align:right;border-top:1px solid rgba(255,255,255,0.04);">${room_view}</td></tr>
<tr><td style="padding:8px 0;font-size:12px;color:#8A7F6E;text-transform:uppercase;border-top:1px solid rgba(255,255,255,0.04);">Nights</td><td style="padding:8px 0;font-size:13px;color:#E8E0D0;text-align:right;border-top:1px solid rgba(255,255,255,0.04);">${nights}</td></tr>
<tr><td style="padding:8px 0;font-size:12px;color:#8A7F6E;text-transform:uppercase;border-top:1px solid rgba(255,255,255,0.04);">Services</td><td style="padding:8px 0;font-size:13px;color:#E8E0D0;text-align:right;border-top:1px solid rgba(255,255,255,0.04);">${services_list}</td></tr>
</table></td></tr>
<tr><td style="background:rgba(201,168,76,0.07);border:1px solid rgba(201,168,76,0.3);border-top:none;padding:20px 40px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:12px;letter-spacing:2px;color:#8A7F6E;text-transform:uppercase;">Grand Total</td>
<td style="text-align:right;font-size:26px;font-weight:300;color:#E8C97A;letter-spacing:2px;">${grand_total}</td>
</tr></table></td></tr>
<tr><td style="background:#141414;border:1px solid rgba(201,168,76,0.3);border-top:none;padding:24px 40px;">
<p style="margin:0 0 8px;font-size:10px;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;">Check-In Information</p>
<p style="margin:0;font-size:13px;color:#8A7F6E;line-height:1.8;">Please present your reservation reference <strong style="color:#E8C97A;">${ref_code}</strong> at the front desk. Check-in from <strong style="color:#E8E0D0;">2:00 PM</strong>, check-out by <strong style="color:#E8E0D0;">12:00 PM</strong>.</p>
</td></tr>
<tr><td align="center" style="background:#0D0D0D;border:1px solid rgba(201,168,76,0.15);border-top:none;padding:28px 40px;">
<p style="margin:0 0 6px;font-size:18px;font-weight:300;letter-spacing:4px;color:#C9A84C;text-transform:uppercase;">Helton Hotel</p>
<p style="margin:0;font-size:11px;color:#4A4540;">Where every detail is a luxury</p>
</td></tr>
</table></td></tr></table></body></html>`
      });
      return res.status(200).json({ success: true });
    }

    // ── FEEDBACK EMAILS ──────────────────────────────────────────
    if (type === 'feedback') {
      const { guest_name, guest_email, rating, comment, extra } = data;
      const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);

      // To hotel
      await sendBrevoEmail({
        sender: { name: 'Helton Hotel Feedback', email: HOTEL_EMAIL },
        to: [{ email: HOTEL_EMAIL, name: HOTEL_NAME }],
        subject: `New Feedback from ${guest_name} — ${rating} Stars`,
        htmlContent: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0D0D0D;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;"><tr><td align="center">
<table width="500" cellpadding="0" cellspacing="0" style="max-width:500px;">
<tr><td style="background:#141414;border:1px solid rgba(201,168,76,0.3);padding:40px;">
<p style="margin:0 0 6px;font-size:10px;letter-spacing:4px;color:#8A7F6E;text-transform:uppercase;">Guest Feedback Received</p>
<h1 style="margin:0 0 24px;font-size:22px;font-weight:300;letter-spacing:4px;color:#C9A84C;text-transform:uppercase;">Helton Hotel</h1>
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:8px 0;font-size:12px;color:#8A7F6E;text-transform:uppercase;width:40%;">Guest</td><td style="font-size:13px;color:#E8E0D0;">${guest_name}</td></tr>
<tr><td style="padding:8px 0;font-size:12px;color:#8A7F6E;text-transform:uppercase;border-top:1px solid rgba(255,255,255,0.05);">Email</td><td style="font-size:13px;color:#E8E0D0;border-top:1px solid rgba(255,255,255,0.05);">${guest_email || 'Not provided'}</td></tr>
<tr><td style="padding:8px 0;font-size:12px;color:#8A7F6E;text-transform:uppercase;border-top:1px solid rgba(255,255,255,0.05);">Rating</td><td style="font-size:18px;color:#C9A84C;border-top:1px solid rgba(255,255,255,0.05);">${stars} (${rating}/5)</td></tr>
<tr><td style="padding:8px 0;font-size:12px;color:#8A7F6E;text-transform:uppercase;border-top:1px solid rgba(255,255,255,0.05);">Comment</td><td style="font-size:13px;color:#E8E0D0;border-top:1px solid rgba(255,255,255,0.05);">${comment}</td></tr>
<tr><td style="padding:8px 0;font-size:12px;color:#8A7F6E;text-transform:uppercase;border-top:1px solid rgba(255,255,255,0.05);">Additional</td><td style="font-size:13px;color:#E8E0D0;border-top:1px solid rgba(255,255,255,0.05);">${extra}</td></tr>
</table></td></tr></table></td></tr></table></body></html>`
      });

      // To guest
      if (guest_email) {
        await sendBrevoEmail({
          sender: { name: HOTEL_NAME, email: HOTEL_EMAIL },
          to: [{ email: guest_email, name: guest_name }],
          subject: 'Thank You for Your Feedback — Helton Hotel',
          htmlContent: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0D0D0D;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;"><tr><td align="center">
<table width="500" cellpadding="0" cellspacing="0" style="max-width:500px;">
<tr><td align="center" style="background:#141414;border:1px solid rgba(201,168,76,0.3);padding:40px;">
<p style="margin:0 0 6px;font-size:10px;letter-spacing:4px;color:#8A7F6E;text-transform:uppercase;">★ ★ ★ ★ ★</p>
<h1 style="margin:0 0 6px;font-size:24px;font-weight:300;letter-spacing:5px;color:#C9A84C;text-transform:uppercase;">Helton Hotel</h1>
<p style="margin:0 0 28px;font-size:10px;letter-spacing:3px;color:#8A7F6E;text-transform:uppercase;">Thank You</p>
<p style="margin:0 0 16px;font-size:14px;color:#E8E0D0;line-height:1.8;">Dear <strong style="color:#E8C97A;">${guest_name}</strong>,</p>
<p style="margin:0 0 20px;font-size:13px;color:#8A7F6E;line-height:1.8;">Thank you for your <strong style="color:#E8C97A;">${rating}-star</strong> rating. Your feedback means a great deal to our team.</p>
<p style="margin:0 0 28px;font-size:13px;color:#8A7F6E;line-height:1.8;">We hope to welcome you back to Helton Hotel very soon.</p>
<div style="width:60px;height:1px;background:linear-gradient(90deg,transparent,#C9A84C,transparent);margin:0 auto 20px;"></div>
<p style="margin:0;font-size:11px;color:#4A4540;">Helton Hotel — Where every detail is a luxury</p>
</td></tr></table></td></tr></table></body></html>`
        });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown email type' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
