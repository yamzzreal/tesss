import type {VercelRequest,VercelResponse} from '@vercel/node';import {getSession,json,method,sql,webhookSecret,hmacSha256} from '../db';
export default async function handler(req:VercelRequest,res:VercelResponse){
 const s=getSession(req);if(!s||s.role!=='merchant')return json(res,401,{success:false,error:'Belum login'});
 try{
  if(req.method==='GET'){const r=await sql`SELECT webhook_url,webhook_secret FROM merchants WHERE id=${s.userId}`;const x=r.rows[0]||{};return json(res,200,{success:true,webhook_url:x.webhook_url||'',webhook_secret:x.webhook_secret||null})}
  if(req.method==='POST'){const b=req.body||{};const url=String(b.webhook_url||'').trim();if(url&&!/^https:\/\//i.test(url))return json(res,400,{success:false,error:'Webhook URL harus HTTPS'});let secret=String(b.webhook_secret||'').trim();if(b.regenerate_secret===true||!secret){secret=webhookSecret()}await sql`UPDATE merchants SET webhook_url=${url||null},webhook_secret=${secret} WHERE id=${s.userId}`;return json(res,200,{success:true,webhook_url:url,webhook_secret:secret})}
  if(req.method==='PUT'){const r=await sql`SELECT webhook_url,webhook_secret FROM merchants WHERE id=${s.userId}`;const x=r.rows[0]||{};if(!x.webhook_url||!x.webhook_secret)return json(res,409,{success:false,error:'Webhook belum dikonfigurasi'});const payload={transactionId:'YMZ-TEST',amount:10000,status:'paid',paidAt:new Date().toISOString()};const raw=JSON.stringify(payload);const sig='hmac-sha256='+hmacSha256(x.webhook_secret,raw);const rr=await fetch(x.webhook_url,{method:'POST',headers:{'Content-Type':'application/json','X-Yamzz-Signature':sig},body:raw});return json(res,200,{success:rr.ok,status:rr.status,signature:sig})}
  return method(req,res,['GET','POST','PUT']);
 }catch(e){json(res,500,{success:false,error:e instanceof Error?e.message:'Webhook failed'})}
}
