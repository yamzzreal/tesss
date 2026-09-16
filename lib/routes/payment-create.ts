import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  amount,
  body,
  id,
  json,
  method,
  requireApi,
  sql
} from '../db';
import { staticToNominal } from '../qris';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (!method(req, res, ['POST'])) return;

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
    // MERCHANT
    // =========================

    const merchantResult = await sql`
      SELECT
        id,
        qris_payload,
        name,
        active
      FROM merchants
      WHERE api_key = ${key}
      LIMIT 1
    `;

    if (
      !merchantResult.rowCount ||
      !merchantResult.rows[0].active
    ) {
      return json(res, 401, {
        success: false,
        error: 'API key tidak valid'
      });
    }

    const merchant = merchantResult.rows[0];


    // =========================
    // REQUEST BODY
    // =========================

    const b = body(req);

    const total = amount(b.amount);

    if (!total) {
      return json(res, 400, {
        success: false,
        error: 'amount harus bilangan bulat positif'
      });
    }


    // =========================
    // ORDER ID
    // =========================

    const orderId = String(
      b.order_id || id('ord')
    ).trim();

    if (!orderId) {
      return json(res, 400, {
        success: false,
        error: 'order_id tidak valid'
      });
    }


    // =========================
    // PRODUCT
    // =========================

    const productId = b.product_id
      ? String(b.product_id).trim()
      : null;


    // =========================
    // QRIS MERCHANT
    // =========================

    if (!merchant.qris_payload) {
      return json(res, 409, {
        success: false,
        error: 'Merchant belum mengunggah QRIS statis'
      });
    }


    // =========================
    // VALIDATE PRODUCT
    // =========================

    if (productId) {

      const productResult = await sql`
        SELECT id
        FROM products
        WHERE id = ${productId}
          AND merchant_id = ${merchant.id}
        LIMIT 1
      `;

      if (!productResult.rowCount) {
        return json(res, 400, {
          success: false,
          error: 'product_id tidak ditemukan'
        });
      }
    }


    // =========================
    // CREATE DYNAMIC QR
    // =========================

    const qr = staticToNominal(
      merchant.qris_payload,
      total
    );


    // =========================
    // EXPIRATION
    // =========================

    const tx = id('tx');

    const requestedMinutes = Number(
      b.expired_minutes || 15
    );

    const minutes = Math.min(
      Math.max(
        Number.isFinite(requestedMinutes)
          ? requestedMinutes
          : 15,
        1
      ),
      1440
    );

    const exp = new Date(
      Date.now() + minutes * 60000
    );


    // =========================
    // SAVE TRANSACTION
    // =========================

    await sql`
      INSERT INTO transactions(
        id,
        merchant_id,
        product_id,
        order_id,
        amount,
        qr_payload,
        expires_at
      )
      VALUES(
        ${tx},
        ${merchant.id},
        ${productId},
        ${orderId},
        ${total},
        ${qr},
        ${exp.toISOString()}
      )
    `;


    // =========================
    // RESPONSE
    // =========================

    return json(res, 201, {
      success: true,
      transaction_id: tx,
      order_id: orderId,
      amount: total,
      status: 'pending',
      expires_at: exp.toISOString(),
      qr_string: qr,
      notice:
        'QR dibuat dari payload QRIS merchant. Status paid tidak dapat dipastikan hanya dari QR generator.'
    });

  } catch (e) {

    console.error(
      'PAYMENT CREATE ERROR:',
      e
    );

    return json(res, 400, {
      success: false,
      error:
        e instanceof Error
          ? e.message
          : 'Create failed'
    });
  }
  }
