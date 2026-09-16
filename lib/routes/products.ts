import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, json, method, id, amount } from '../db';

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
  if (!method(req, res, ['GET', 'POST', 'DELETE'])) return;

  try {

    const merchantId = await getMerchantId(req);

    if (!merchantId) {
      return json(res, 401, {
        success: false,
        error: 'Belum login'
      });
    }


    // =========================
    // GET PRODUCTS
    // =========================

    if (req.method === 'GET') {

      const r = await sql`
        SELECT
          id,
          name,
          description,
          price,
          active,
          created_at
        FROM products
        WHERE merchant_id = ${merchantId}
        ORDER BY created_at DESC
      `;

      return json(res, 200, {
        success: true,
        products: r.rows
      });
    }


    // =========================
    // DELETE PRODUCT
    // =========================

    if (req.method === 'DELETE') {

      const pid = String(req.query.id || '');

      if (!pid) {
        return json(res, 400, {
          success: false,
          error: 'ID produk wajib diisi'
        });
      }

      await sql`
        DELETE FROM products
        WHERE id = ${pid}
        AND merchant_id = ${merchantId}
      `;

      return json(res, 200, {
        success: true
      });
    }


    // =========================
    // CREATE PRODUCT
    // =========================

    const b = req.body || {};

    const name = String(
      b.name || ''
    ).trim();

    const description = String(
      b.description || ''
    ).trim();

    const price = amount(b.price);


    if (name.length < 1 || !price) {
      return json(res, 400, {
        success: false,
        error: 'Nama dan harga wajib valid'
      });
    }


    const pid = id('prd');


    await sql`
      INSERT INTO products(
        id,
        merchant_id,
        name,
        description,
        price
      )
      VALUES(
        ${pid},
        ${merchantId},
        ${name},
        ${description},
        ${price}
      )
    `;


    return json(res, 201, {
      success: true,
      id: pid
    });

  } catch (e) {

    console.error('PRODUCTS ERROR:', e);

    return json(res, 500, {
      success: false,
      error: e instanceof Error
        ? e.message
        : 'Products failed'
    });
  }
}
