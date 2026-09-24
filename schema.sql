CREATE TABLE IF NOT EXISTS merchants (
 id TEXT PRIMARY KEY,
 email TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 name TEXT NOT NULL,
 api_key TEXT UNIQUE NOT NULL,
 webhook_secret TEXT UNIQUE,
 webhook_url TEXT,
 notification_url TEXT,
 notification_threshold BIGINT DEFAULT 0,
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
 paid_at TIMESTAMPTZ,
 canceled_at TIMESTAMPTZ,
 customer_name TEXT,
 customer_email TEXT,
 metadata JSONB,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(merchant_id,order_id)
);
CREATE INDEX IF NOT EXISTS tx_merchant_created ON transactions(merchant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS tx_merchant_status ON transactions(merchant_id,status,created_at DESC);

ALTER TABLE merchants ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT '';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS discord_webhook_url TEXT DEFAULT '';
CREATE TABLE IF NOT EXISTS notifications (
 id TEXT PRIMARY KEY,
 merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
 transaction_id TEXT NOT NULL,
 channel TEXT NOT NULL,
 status TEXT NOT NULL,
 detail TEXT DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(transaction_id,channel)
);
CREATE INDEX IF NOT EXISTS notifications_merchant_created ON notifications(merchant_id,created_at DESC);
