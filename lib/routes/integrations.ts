import type {VercelRequest,VercelResponse} from '@vercel/node';
import crypto from 'node:crypto';
import {getSession,json,method,sql} from '../db';

async function migrate(){
  await sql`ALTER TABLE merchants ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT ''`;
  await sql`ALTER TABLE merchants ADD COLUMN IF NOT EXISTS discord_webhook_url TEXT DEFAULT ''`;
  await sql`ALTER TABLE merchants ADD COLUMN IF NOT EXISTS webhook_secret TEXT`;
  await sql`CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE, transaction_id TEXT NOT NULL, channel TEXT NOT NULL, status TEXT NOT NULL, detail TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(transaction_id,channel))`;
  await sql`CREATE INDEX IF NOT EXISTS notifications_merchant_created ON notifications(merchant_id,created_at DESC)`;
}

export default async function handler(req:VercelRequest,res:VercelResponse){
  if(!method(req,res,['GET','POST']))return;
  const s=getSession(req);if(!s||s.role!=='merchant')return json(res,401,{success:false,error:'Belum login'});
  try{
    await migrate();
    if(req.method==='GET'){
      const m=await sql`SELECT webhook_url,webhook_secret,telegram_chat_id,discord_webhook_url FROM merchants WHERE id=${s.userId} LIMIT 1`;
      const n=await sql`SELECT transaction_id,channel,status,detail,created_at FROM notifications WHERE merchant_id=${s.userId} ORDER BY created_at DESC LIMIT 30`;
      return json(res,200,{success:true,integrations:m.rows[0]||{},notifications:n.rows});
    }
    const b=req.body||{};const action=String(b.action||'save');
    if(action==='save'){
      const webhookUrl=String(b.webhook_url||'').trim();
      if(webhookUrl && !/^https:\/\//i.test(webhookUrl))return json(res,400,{success:false,error:'URL webhook harus HTTPS'});
      const telegram=String(b.telegram_chat_id||'').trim();
      const discord=String(b.discord_webhook_url||'').trim();
      if(discord && !/^https:\/\//i.test(discord))return json(res,400,{success:false,error:'Webhook Discord harus HTTPS'});
      const current=await sql`SELECT webhook_secret FROM merchants WHERE id=${s.userId}`;
      const secret=String(current.rows[0]?.webhook_secret||'')||crypto.randomBytes(32).toString('hex');
      await sql`UPDATE merchants SET webhook_url=${webhookUrl||null},webhook_secret=${secret},telegram_chat_id=${telegram},discord_webhook_url=${discord} WHERE id=${s.userId}`;
      return json(res,200,{success:true,webhook_secret:secret});
    }
    if(action==='test-webhook'){
      const m=await sql`SELECT id,name,webhook_url,webhook_secret FROM merchants WHERE id=${s.userId}`;const x=m.rows[0];
      if(!x?.webhook_url)return json(res,400,{success:false,error:'URL webhook belum diatur'});
      const sample={transactionId:'CSK-'+crypto.randomBytes(4).toString('hex'),amount:55000,packageName:'com.example.payment',appName:x.name,status:'paid',paidAt:new Date().toISOString()};const raw=JSON.stringify(sample);const sig=crypto.createHmac('sha256',String(x.webhook_secret||'')).update(raw).digest('hex');
      const r=await fetch(x.webhook_url,{method:'POST',headers:{'Content-Type':'application/json','X-Casaku-Signature':`hmac-sha256=${sig}`,'X-Yamzz-Signature':`hmac-sha256=${sig}`},body:raw});
      return json(res,r.ok?200:502,{success:r.ok,status:r.status,signature:`hmac-sha256=${sig}`,payload:sample,response:(await r.text().catch(()=>'' )).slice(0,1000)});
    }
    if(action==='test-notification'){
      const m=await sql`SELECT id,name,telegram_chat_id,discord_webhook_url FROM merchants WHERE id=${s.userId}`;const x=m.rows[0];
      const fake={id:'TEST-'+crypto.randomBytes(4).toString('hex'),order_id:'TEST-NOTIFICATION',amount:55000,paid_at:new Date().toISOString()};
      const results:any[]=[];
      const token=String(process.env.TELEGRAM_BOT_TOKEN||'');
      if(x.telegram_chat_id && token){const r=await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:x.telegram_chat_id,text:`🔔 Yamzz Payment\nTest notifikasi berhasil.\nNominal: Rp 55.000`,parse_mode:'Markdown'})});results.push({channel:'telegram',ok:r.ok,status:r.status})}else results.push({channel:'telegram',ok:false,error:x.telegram_chat_id?'TELEGRAM_BOT_TOKEN belum diatur':'ID Telegram belum diatur'});
      if(x.discord_webhook_url){const r=await fetch(x.discord_webhook_url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:'🔔 **Yamzz Payment**\nTest notifikasi berhasil.\nNominal: **Rp 55.000**'})});results.push({channel:'discord',ok:r.ok,status:r.status})}else results.push({channel:'discord',ok:false,error:'Webhook Discord belum diatur'});
      return json(res,200,{success:true,results});
    }
    return json(res,400,{success:false,error:'Action tidak dikenal'});
  }catch(e){return json(res,500,{success:false,error:e instanceof Error?e.message:'Integration failed'})}
}
