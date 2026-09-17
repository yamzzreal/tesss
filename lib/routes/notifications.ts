import type {VercelRequest,VercelResponse} from '@vercel/node';import {getSession,json,method,sql} from '../db';
export default async function handler(req:VercelRequest,res:VercelResponse){const s=getSession(req);if(!s||s.role!=='merchant')return json(res,401,{success:false,error:'Belum login'});try{
 if(req.method==='GET'){const r=await sql`SELECT notification_url,notification_threshold FROM merchants WHERE id=${s.userId}`;return json(res,200,{success:true,...r.rows[0]})}
 if(req.method==='POST'){const b=req.body||{},url=String(b.notification_url||'').trim(),threshold=Number(b.notification_threshold||0);if(url&&!/^https:\/\//i.test(url))return json(res,400,{success:false,error:'URL notifikasi harus HTTPS'});if(!Number.isInteger(threshold)||threshold<0)return json(res,400,{success:false,error:'Threshold tidak valid'});await sql`UPDATE merchants SET notification_url=${url||null},notification_threshold=${threshold} WHERE id=${s.userId}`;return json(res,200,{success:true})}
 return method(req,res,['GET','POST']);
}catch(e){json(res,500,{success:false,error:e instanceof Error?e.message:'Notifications failed'})}}
