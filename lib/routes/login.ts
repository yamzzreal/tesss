import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { sql } from '../db';

const SESSION_SECRET = process.env.SESSION_SECRET;

function createSession(userId: string) {
  if (!SESSION_SECRET) {
    throw new Error('SESSION_SECRET belum diset');
  }

  const payload = `${userId}.${Date.now()}`;
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('hex');

  return Buffer.from(`${payload}.${signature}`).toString('base64url');
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username dan password wajib diisi'
      });
    }

    const result = await sql`
      SELECT id, username, password
      FROM customers
      WHERE username = ${String(username).trim()}
      LIMIT 1
    `;

    if (!result.rows.length) {
      return res.status(401).json({
        success: false,
        error: 'Username atau password salah'
      });
    }

    const user = result.rows[0];

    /*
     * Pertahankan mekanisme password yang sudah dipakai project.
     * Jika password kamu disimpan plaintext:
     */
    if (String(user.password) !== String(password)) {
      return res.status(401).json({
        success: false,
        error: 'Username atau password salah'
      });
    }

    const session = createSession(String(user.id));

    res.setHeader(
      'Set-Cookie',
      `ymz_session=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
    );

    return res.status(200).json({
      success: true,
      message: 'Login berhasil',
      user: {
        id: user.id,
        username: user.username
      }
    });

  } catch (error) {
    console.error('LOGIN ERROR:', error);

    return res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan server'
    });
  }
  }
