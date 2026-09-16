CREATE TABLE IF NOT EXISTS merchants (
 id TEXT PRIMARY KEY,
 email TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 name TEXT NOT NULL,
 api_key TEXT UNIQUE NOT NULL,
 qris_payload TEXT,
 qris_name TEXT,
 qris_city TEXT,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS products (
 id TEXT PRIMARY KEY,
 merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 description TEXT DEFAULT '',
 price BIGINT NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS transactions (
 id TEXT PRIMARY KEY,
 merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
 product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
 order_id TEXT NOT NULL,
 amount BIGINT NOT NULL,
 qr_payload TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 expires_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(merchant_id,order_id)
);
CREATE INDEX IF NOT EXISTS tx_merchant_created ON transactions(merchant_id,created_at DESC);
