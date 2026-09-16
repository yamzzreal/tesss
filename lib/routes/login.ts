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
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email dan password wajib diisi'
      });
    }

    const result = await sql`
      SELECT *
      FROM merchants
      WHERE email = ${String(email).trim().toLowerCase()}
      LIMIT 1
    `;

    if (!result.rows.length) {
      return res.status(401).json({
        success: false,
        error: 'Email atau password salah'
      });
    }

    const merchant = result.rows[0];

    /*
     * Sesuaikan dengan sistem password project.
     * Untuk sementara mengikuti format password yang tersimpan.
     */
    if (String(merchant.password) !== String(password)) {
      return res.status(401).json({
        success: false,
        error: 'Email atau password salah'
      });
    }

    const session = createSession(String(merchant.id));

    res.setHeader(
      'Set-Cookie',
      `ymz_session=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
    );

    return res.status(200).json({
      success: true,
      message: 'Login berhasil',
      merchant: {
        id: merchant.id,
        email: merchant.email
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
