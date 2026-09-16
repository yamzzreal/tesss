import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  json,
  method,
  requireApi,
  sql
} from '../db';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (!method(req, res, ['GET'])) return;

  try {

    // =========================
    // API KEY
    // =========================

    const key = requireApi(req);

    if (!key) {
      return json(res, 401, {
        success: false,
        error: 'X-API-Key wajib'
      });
    }


    // =========================
    // TRANSACTION ID
    // =========================

    const transactionId = String(
      req.query.transaction_id || ''
    ).trim();

    if (!transactionId) {
      return json(res, 400, {
        success: false,
        error: 'transaction_id wajib diisi'
      });
    }


    // =========================
    // FIND TRANSACTION
    // =========================

    const result = await sql`
      SELECT
        t.id,
        t.order_id,
        t.amount,
        t.status,
        t.expires_at,
        t.created_at
      FROM transactions t
      JOIN merchants m
        ON m.id = t.merchant_id
      WHERE t.id = ${transactionId}
        AND m.api_key = ${key}
      LIMIT 1
    `;


    if (!result.rowCount) {
      return json(res, 404, {
        success: false,
        error: 'Transaksi tidak ditemukan'
      });
    }


    const transaction = result.rows[0];

    let status = transaction.status;


    // =========================
    // CHECK EXPIRATION
    // =========================

    if (
      status === 'pending' &&
      transaction.expires_at &&
      new Date(transaction.expires_at).getTime() < Date.now()
    ) {
      status = 'expired';
    }


    // =========================
    // RESPONSE
    // =========================

    return json(res, 200, {
      success: true,
      transaction: {
        ...transaction,
        status
      }
    });

  } catch (e) {

    console.error(
      'PAYMENT STATUS ERROR:',
      e
    );

    return json(res, 500, {
      success: false,
      error:
        e instanceof Error
          ? e.message
          : 'Payment status failed'
    });
  }
}
