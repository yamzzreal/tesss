import type {VercelRequest,VercelResponse} from '@vercel/node';
import {amount,body,id,json,method,requireApi,sql} from '../db';
import {staticToNominal} from '../qris';
export default async function handler(req:VercelRequest,res:VercelResponse){
 if(!method(req,res,['POST']))return;
 try{
  const key=requireApi(req);if(!key)return json(res,401,{success:false,error:'X-API-Key wajib'});
  const mr=await sql`SELECT id,qris_payload,name,active FROM merchants WHERE api_key=${key} LIMIT 1`;
  if(!mr.rowCount||!mr.rows[0].active)return json(res,401,{success:false,error:'API key tidak valid'});
  const m=mr.rows[0],b=body(req),total=amount(b.amount);
  if(!total)return json(res,400,{success:false,error:'amount harus bilangan bulat positif'});
  const orderId=String(b.order_id||id('ord')).trim();if(orderId.length<1||orderId.length>120)return json(res,400,{success:false,error:'order_id tidak valid'});
  const existing=await sql`SELECT id,order_id,amount,status,qr_payload,expires_at,created_at FROM transactions WHERE merchant_id=${m.id} AND order_id=${orderId} LIMIT 1`;
  if(existing.rowCount){const x=existing.rows[0];if(Number(x.amount)!==total)return json(res,409,{success:false,error:'order_id sudah pernah digunakan dengan nominal berbeda'});return json(res,200,{success:true,duplicate:true,transaction_id:x.id,order_id:x.order_id,amount:Number(x.amount),status:x.status,expires_at:x.expires_at,qr_string:x.qr_payload,payment_url:`/payment.html?transaction_id=${encodeURIComponent(x.id)}`})}
  const productId=b.product_id?String(b.product_id):null;
  if(!m.qris_payload)return json(res,409,{success:false,error:'Merchant belum mengunggah QRIS statis'});
  if(productId){const p=await sql`SELECT id FROM products WHERE id=${productId} AND merchant_id=${m.id} LIMIT 1`;if(!p.rowCount)return json(res,400,{success:false,error:'product_id tidak ditemukan'})}
  const qr=staticToNominal(m.qris_payload,total),tx=id('tx'),minutes=Math.min(Math.max(Number(b.expired_minutes||15),1),1440),exp=new Date(Date.now()+minutes*60000);
  const customerName=String(b.customer_name||'').trim().slice(0,120)||null,customerEmail=String(b.customer_email||'').trim().slice(0,160)||null;
  const metadata=b.metadata&&typeof b.metadata==='object'?JSON.stringify(b.metadata):null;
  await sql`INSERT INTO transactions(id,merchant_id,product_id,order_id,amount,qr_payload,expires_at,customer_name,customer_email,metadata) VALUES(${tx},${m.id},${productId},${orderId},${total},${qr},${exp.toISOString()},${customerName},${customerEmail},${metadata}::jsonb)`;
  json(res,201,{success:true,transaction_id:tx,order_id:orderId,amount:total,status:'pending',expires_at:exp.toISOString(),qr_string:qr,payment_url:`/payment.html?transaction_id=${encodeURIComponent(tx)}`,notice:'Status PAID harus berasal dari kanal verifikasi/notifikasi pembayaran yang sah; pembuatan QR saja tidak membuktikan pembayaran.'});
 }catch(e){json(res,400,{success:false,error:e instanceof Error?e.message:'Create failed'})}
}
