import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, json, method } from '../db';

function getBearerToken(req: VercelRequest) {
  const authorization = req.headers.authorization || '';

  if (!authorization.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice(7).trim() || null;
}

async function getMerchantId(req: VercelRequest) {
  const apiKey = getBearerToken(req);

  if (!apiKey) {
    return null;
  }

  const result = await sql`
    SELECT id
    FROM merchants
    WHERE api_key = ${apiKey}
    LIMIT 1
  `;

  if (!result.rows.length) {
    return null;
  }

  return result.rows[0].id;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (!method(req, res, ['GET'])) return;

  try {

    // =========================
    // AUTH MERCHANT
    // =========================

    const merchantId = await getMerchantId(req);

    if (!merchantId) {
      return json(res, 401, {
        success: false,
        error: 'Belum login'
      });
    }


    // =========================
    // AMBIL TRANSAKSI
    // =========================

    const r = await sql`
      SELECT
        id,
        order_id,
        amount,
        status,
        expires_at,
        created_at
      FROM transactions
      WHERE merchant_id = ${merchantId}
      ORDER BY created_at DESC
      LIMIT 100
    `;


    return json(res, 200, {
      success: true,
      transactions: r.rows
    });

  } catch (e) {

    console.error(
      'TRANSACTIONS ERROR:',
      e
    );

    return json(res, 500, {
      success: false,
      error:
        e instanceof Error
          ? e.message
          : 'Transactions failed'
    });
  }
}
