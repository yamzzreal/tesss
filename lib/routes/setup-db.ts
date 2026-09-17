import type {VercelRequest,VercelResponse} from '@vercel/node';
import {json,method,sql} from '../db';
export default async function handler(req:VercelRequest,res:VercelResponse){
 if(!method(req,res,['POST']))return;
 try{
  await sql`CREATE TABLE IF NOT EXISTS merchants (id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,name TEXT NOT NULL,api_key TEXT UNIQUE NOT NULL,webhook_secret TEXT UNIQUE,webhook_url TEXT,notification_url TEXT,notification_threshold BIGINT DEFAULT 0,qris_payload TEXT,qris_name TEXT,qris_city TEXT,active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY,merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,name TEXT NOT NULL,description TEXT DEFAULT '',price BIGINT NOT NULL,active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY,merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,product_id TEXT REFERENCES products(id) ON DELETE SET NULL,order_id TEXT NOT NULL,amount BIGINT NOT NULL,qr_payload TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',expires_at TIMESTAMPTZ NOT NULL,paid_at TIMESTAMPTZ,canceled_at TIMESTAMPTZ,customer_name TEXT,customer_email TEXT,metadata JSONB,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(merchant_id,order_id))`;
  const alters=[
   `ALTER TABLE merchants ADD COLUMN IF NOT EXISTS webhook_secret TEXT UNIQUE`,
   `ALTER TABLE merchants ADD COLUMN IF NOT EXISTS webhook_url TEXT`,
   `ALTER TABLE merchants ADD COLUMN IF NOT EXISTS notification_url TEXT`,
   `ALTER TABLE merchants ADD COLUMN IF NOT EXISTS notification_threshold BIGINT DEFAULT 0`,
   `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`,
   `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ`,
   `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_name TEXT`,
   `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_email TEXT`,
   `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS metadata JSONB`
  ];
  for(const q of alters) await sql.query(q);
  await sql`CREATE INDEX IF NOT EXISTS tx_merchant_created ON transactions(merchant_id,created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS tx_merchant_status ON transactions(merchant_id,status,created_at DESC)`;
  json(res,200,{success:true,message:'Database siap dan migrasi selesai'});
 }catch(e){json(res,500,{success:false,error:e instanceof Error?e.message:'DB setup failed'})}
}
