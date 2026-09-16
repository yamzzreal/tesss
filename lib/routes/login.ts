import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  sql,
  compare,
  json,
  method
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

    // Cocokkan password input dengan bcrypt hash
    const validPassword = await compare(
      password,
      merchant.password_hash
    );

    if (!validPassword) {
      return json(res, 401, {
        success: false,
        error: 'Email atau password salah'
      });
    }

    /*
     * Tidak menggunakan session/cookie.
     * Credential dikirim ke frontend dan disimpan
     * oleh frontend menggunakan localStorage.
     */

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
