import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { sql } from '../db';

const SESSION_SECRET = process.env.SESSION_SECRET;

function getCookie(req: VercelRequest, name: string) {
  const cookie = req.headers.cookie || '';

  const parts = cookie.split(';');

  for (const part of parts) {
    const [key, ...value] = part.trim().split('=');

    if (key === name) {
      return decodeURIComponent(value.join('='));
    }
  }

  return null;
}

function verifySession(token: string) {
  if (!SESSION_SECRET || !token) return null;

  try {
    const decoded = Buffer
      .from(token, 'base64url')
      .toString('utf8');

    const parts = decoded.split('.');

    if (parts.length !== 3) return null;

    const [userId, timestamp, signature] = parts;

    const payload = `${userId}.${timestamp}`;

    const expected = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payload)
      .digest('hex');

    if (signature !== expected) {
      return null;
    }

    // Session berlaku 7 hari
    const age = Date.now() - Number(timestamp);

    if (!Number.isFinite(age) || age > 604800000 || age < 0) {
      return null;
    }

    return userId;

  } catch {
    return null;
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const token = getCookie(req, 'ymz_session');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Belum login'
      });
    }

    const userId = verifySession(token);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Session tidak valid'
      });
    }

    const result = await sql`
      SELECT id, username, balance
      FROM customers
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (!result.rows.length) {
      return res.status(401).json({
        success: false,
        error: 'Akun tidak ditemukan'
      });
    }

    const user = result.rows[0];

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        balance: user.balance
      }
    });

  } catch (error) {
    console.error('ME ERROR:', error);

    return res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan server'
    });
  }
        }
