import { sql } from '@vercel/postgres';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export { sql };

// =========================================================
// ID GENERATOR
// =========================================================

export function id(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${crypto
    .randomBytes(5)
    .toString('hex')}`;
}

// =========================================================
// API KEY
// =========================================================

export function apiKey() {
  return `ymz_live_${crypto.randomBytes(24).toString('base64url')}`;
}

// =========================================================
// PASSWORD
// =========================================================

export async function hash(v: string) {
  return bcrypt.hash(v, 12);
}

export async function compare(v: string, h: string) {
  return bcrypt.compare(v, h);
}

// =========================================================
// COOKIE
// =========================================================

export function cookie(
  name: string,
  value: string,
  maxAge: number
) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAge}`
  ].join('; ');
}

export function clearCookie(name: string) {
  return [
    `${name}=`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=0'
  ].join('; ');
}

// =========================================================
// SESSION SECRET
// =========================================================

function secret() {
  return (
    process.env.SESSION_SECRET ||
    'dev-only-change-me'
  );
}

// =========================================================
// SIGN SESSION
// =========================================================

export function signSession(payload: string) {
  const sig = crypto
    .createHmac('sha256', secret())
    .update(payload)
    .digest('base64url');

  return `${payload}.${sig}`;
}

// =========================================================
// VERIFY SESSION
// =========================================================

export function verifySession(token: string) {
  try {
    if (!token) return null;

    // Ambil titik terakhir agar payload tetap aman
    // jika suatu saat mengandung karakter titik.
    const dot = token.lastIndexOf('.');

    if (dot <= 0) return null;

    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);

    if (!payload || !sig) return null;

    const expected = crypto
      .createHmac('sha256', secret())
      .update(payload)
      .digest('base64url');

    const receivedBuffer = Buffer.from(sig, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    // timingSafeEqual membutuhkan panjang buffer yang sama.
    if (
      receivedBuffer.length !== expectedBuffer.length
    ) {
      return null;
    }

    if (
      !crypto.timingSafeEqual(
        receivedBuffer,
        expectedBuffer
      )
    ) {
      return null;
    }

    // Decode payload
    const decoded = Buffer.from(
      payload,
      'base64url'
    ).toString('utf8');

    const obj = JSON.parse(decoded);

    if (!obj) return null;

    if (!obj.userId) return null;

    if (!obj.role) return null;

    if (!obj.exp) return null;

    // Session expired
    if (Number(obj.exp) < Date.now()) {
      return null;
    }

    return obj;
  } catch {
    return null;
  }
}

// =========================================================
// CREATE SESSION COOKIE
// =========================================================

export function sessionCookie(
  userId: string,
  role: string
) {
  const payload = Buffer.from(
    JSON.stringify({
      userId: String(userId),
      role: String(role),
      exp: Date.now() + 7 * 86400000
    })
  ).toString('base64url');

  const token = signSession(payload);

  // 7 hari
  return cookie(
    'ymz_session',
    token,
    7 * 86400
  );
}

// =========================================================
// GET SESSION FROM REQUEST
// =========================================================

export function getSession(req: any) {
  try {
    const raw = String(
      req?.headers?.cookie || ''
    );

    if (!raw) return null;

    /*
      Cookie browser biasanya berbentuk:

      ymz_session=xxxxx;
      other=value;
      another=value
    */

    const cookies = raw.split(';');

    for (const item of cookies) {
      const eq = item.indexOf('=');

      if (eq < 0) continue;

      const name = item
        .slice(0, eq)
        .trim();

      if (name !== 'ymz_session') {
        continue;
      }

      const value = item
        .slice(eq + 1)
        .trim();

      if (!value) {
        return null;
      }

      let decodedValue: string;

      try {
        decodedValue =
          decodeURIComponent(value);
      } catch {
        return null;
      }

      return verifySession(decodedValue);
    }

    return null;
  } catch {
    return null;
  }
}

// =========================================================
// JSON RESPONSE
// =========================================================

export function json(
  res: any,
  status: number,
  body: any
) {
  res
    .status(status)
    .setHeader(
      'Content-Type',
      'application/json; charset=utf-8'
    );

  res.end(
    JSON.stringify(body)
  );
}

// =========================================================
// METHOD CHECK
// =========================================================

export function method(
  req: any,
  res: any,
  allowed: string[]
) {
  if (!allowed.includes(req.method)) {
    res.setHeader(
      'Allow',
      allowed.join(', ')
    );

    json(res, 405, {
      success: false,
      error: 'Method not allowed'
    });

    return false;
  }

  return true;
}

// =========================================================
// REQUEST BODY
// =========================================================

export function body(req: any) {
  return req.body &&
    typeof req.body === 'object'
    ? req.body
    : {};
}

// =========================================================
// AMOUNT VALIDATION
// =========================================================

export function amount(v: any) {
  const n = Number(v);

  if (
    !Number.isInteger(n) ||
    n < 1 ||
    n > 999999999
  ) {
    return null;
  }

  return n;
}

// =========================================================
// REQUIRE SESSION
// =========================================================

export function requireSession(
  req: any,
  res: any,
  role?: string
) {
  const session = getSession(req);

  if (!session) {
    return null;
  }

  if (
    role &&
    session.role !== role
  ) {
    return null;
  }

  return session;
}

// =========================================================
// REQUIRE API KEY
// =========================================================

export function requireApi(req: any) {
  return String(
    req?.headers?.['x-api-key'] || ''
  );
}
