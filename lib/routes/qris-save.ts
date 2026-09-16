import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, json, method } from '../db';
import { inspectPayload } from '../qris';

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
  if (!method(req, res, ['POST'])) return;

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
    // AMBIL PAYLOAD QRIS
    // =========================

    const b = req.body || {};

    const payload = String(
      b.qris_payload || ''
    ).trim();


    if (
      payload.length < 20 ||
      payload.length > 5000
    ) {
      return json(res, 400, {
        success: false,
        error: 'QR payload tidak valid'
      });
    }


    // =========================
    // INSPECT QRIS
    // =========================

    const info = inspectPayload(payload);


    if (
      info.pointOfInitiation !== '11' &&
      info.pointOfInitiation !== '12'
    ) {
      return json(res, 400, {
        success: false,
        error:
          'Payload bukan QR dengan Point of Initiation Method yang dikenali'
      });
    }


    // =========================
    // SIMPAN QRIS
    // =========================

    await sql`
      UPDATE merchants
      SET
        qris_payload = ${payload},
        qris_name = ${info.merchantName || null},
        qris_city = ${info.merchantCity || null}
      WHERE id = ${merchantId}
    `;


    return json(res, 200, {
      success: true,
      qris: info
    });

  } catch (e) {

    console.error(
      'QRIS SAVE ERROR:',
      e
    );

    return json(res, 400, {
      success: false,
      error:
        e instanceof Error
          ? e.message
          : 'QRIS save failed'
    });
  }
}
