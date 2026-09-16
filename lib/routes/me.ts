import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../db';

function getBearerToken(req: VercelRequest) {
  const authorization = req.headers.authorization || '';

  if (!authorization.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice(7).trim() || null;
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
    const apiKey = getBearerToken(req);

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Belum login'
      });
    }

    const result = await sql`
      SELECT id, username, balance
      FROM customers
      WHERE api_key = ${apiKey}
      LIMIT 1
    `;

    if (!result.rows.length) {
      return res.status(401).json({
        success: false,
        error: 'Token login tidak valid'
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
