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
      SELECT
        id,
        email,
        name,
        api_key,
        qris_name,
        qris_city,
        qris_payload
      FROM merchants
      WHERE api_key = ${apiKey}
      LIMIT 1
    `;

    if (!result.rows.length) {
      return res.status(401).json({
        success: false,
        error: 'Token login tidak valid'
      });
    }

    const merchant = result.rows[0];

    return res.status(200).json({
      success: true,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        api_key: merchant.api_key,
        qris_name: merchant.qris_name || '',
        qris_city: merchant.qris_city || '',
        qris_payload: merchant.qris_payload || ''
      }
    });

  } catch (error) {
    console.error('MERCHANT ME ERROR:', error);

    return res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan server'
    });
  }
}
