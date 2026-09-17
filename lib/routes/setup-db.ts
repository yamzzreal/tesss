import type {
  VercelRequest,
  VercelResponse
} from '@vercel/node';

import {
  sql,
  json,
  method
} from '../db';


export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {

  if (!method(req, res, ['GET', 'POST'])) {
    return;
  }

  try {

    /*
    =========================================================
    MERCHANTS
    =========================================================
    */

    await sql`
      CREATE TABLE IF NOT EXISTS merchants (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;


    /*
    =========================================================
    PRODUCTS
    =========================================================
    */

    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        price BIGINT NOT NULL DEFAULT 0,
        image TEXT DEFAULT '',
        category TEXT DEFAULT '',
        status TEXT DEFAULT 'ready',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;


    /*
    =========================================================
    TRANSACTIONS
    =========================================================
    */

    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        amount BIGINT NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;


    /*
    =========================================================
    MIGRASI TRANSACTIONS
    =========================================================

    Menambahkan kolom yang dibutuhkan oleh sistem
    payment-create dan payment-status.

    IF NOT EXISTS membuat migrasi aman dijalankan
    berkali-kali tanpa menghapus data transaksi lama.
    */


    await sql`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS customer_name TEXT DEFAULT ''
    `;


    await sql`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS product_name TEXT DEFAULT ''
    `;


    await sql`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS qr_payload TEXT DEFAULT ''
    `;


    await sql`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS qr_url TEXT DEFAULT ''
    `;


    await sql`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP NULL
    `;


    await sql`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP NULL
    `;


    await sql`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS expired_at TIMESTAMP NULL
    `;


    await sql`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
    `;


    /*
    =========================================================
    QRIS
    =========================================================
    */

    await sql`
      CREATE TABLE IF NOT EXISTS merchant_qris (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        qris_payload TEXT NOT NULL,
        qris_image TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;


    /*
    =========================================================
    INDEX TRANSACTIONS
    =========================================================
    */

    await sql`
      CREATE INDEX IF NOT EXISTS idx_transactions_merchant
      ON transactions(merchant_id)
    `;


    await sql`
      CREATE INDEX IF NOT EXISTS idx_transactions_order
      ON transactions(order_id)
    `;


    await sql`
      CREATE INDEX IF NOT EXISTS idx_transactions_status
      ON transactions(status)
    `;


    await sql`
      CREATE INDEX IF NOT EXISTS idx_transactions_created
      ON transactions(created_at)
    `;


    /*
    =========================================================
    RESPONSE
    =========================================================
    */

    return json(res, 200, {

      success: true,

      message:
        'Database berhasil dibuat / dimigrasikan.',

      migrations: [

        'merchants',

        'products',

        'transactions',

        'transactions.customer_name',

        'transactions.product_name',

        'transactions.qr_payload',

        'transactions.qr_url',

        'transactions.paid_at',

        'transactions.canceled_at',

        'transactions.expired_at',

        'transactions.updated_at',

        'merchant_qris'

      ]

    });


  } catch (error) {

    console.error(
      'SETUP DB ERROR:',
      error
    );


    return json(res, 500, {

      success: false,

      error:
        error instanceof Error
          ? error.message
          : 'Database setup failed'

    });

  }

}
