import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  sql,
  json,
  method,
  sessionCookie,
  verifyPassword
} from '../db';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (!method(req, res, ['POST'])) return;

  try {
    const b = req.body || {};

    const email = String(b.email || '')
      .trim()
      .toLowerCase();

    const password = String(b.password || '');

    if (!email || !password) {
      return json(res, 400, {
        success: false,
        error: 'Email dan password wajib diisi'
      });
    }

    const result = await sql`
      SELECT id, email, name, password_hash, api_key
      FROM merchants
      WHERE email = ${email}
      LIMIT 1
    `;

    if (!result.rowCount) {
      return json(res, 401, {
        success: false,
        error: 'Email atau password salah'
      });
    }

    const merchant = result.rows[0];

    const valid = await verifyPassword(
      password,
      merchant.password_hash
    );

    if (!valid) {
      return json(res, 401, {
        success: false,
        error: 'Email atau password salah'
      });
    }

    // Session merchant
    res.setHeader(
      'Set-Cookie',
      sessionCookie(String(merchant.id), 'merchant')
    );

    return json(res, 200, {
      success: true,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email
      },
      api_key: merchant.api_key
    });

  } catch (e) {
    console.error('LOGIN ERROR:', e);

    return json(res, 500, {
      success: false,
      error: e instanceof Error
        ? e.message
        : 'Login failed'
    });
  }
}
