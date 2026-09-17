import type {VercelRequest,VercelResponse} from '@vercel/node';
import {json,method,getSession,sql} from '../db';
export default async function handler(req:VercelRequest,res:VercelResponse){
 if(!method(req,res,['GET']))return; const s=getSession(req); if(!s||s.role!=='merchant')return json(res,401,{success:false,error:'Belum login'});
 try{
  const [today,yesterday,all,days,merchant]=await Promise.all([
   sql`SELECT COALESCE(SUM(amount),0)::bigint gross,COUNT(*)::int count FROM transactions WHERE merchant_id=${s.userId} AND status='paid' AND created_at::date=CURRENT_DATE`,
   sql`SELECT COALESCE(SUM(amount),0)::bigint gross,COUNT(*)::int count FROM transactions WHERE merchant_id=${s.userId} AND status='paid' AND created_at::date=CURRENT_DATE-1`,
   sql`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE status='paid')::int paid,COUNT(*) FILTER(WHERE status='pending')::int pending,COUNT(*) FILTER(WHERE status='cancel')::int cancel,COUNT(*) FILTER(WHERE status='expired')::int expired,COALESCE(SUM(amount) FILTER(WHERE status='paid'),0)::bigint gross FROM transactions WHERE merchant_id=${s.userId}`,
   sql`SELECT to_char(d,'YYYY-MM-DD') day,COALESCE(SUM(t.amount) FILTER(WHERE t.status='paid'),0)::bigint gross,COUNT(t.id)::int transactions FROM generate_series(CURRENT_DATE-6,CURRENT_DATE,interval '1 day') d LEFT JOIN transactions t ON t.merchant_id=${s.userId} AND t.created_at::date=d GROUP BY d ORDER BY d`,
   sql`SELECT id,name,email,qris_name,qris_city,active,created_at,api_key,webhook_url,notification_url,notification_threshold FROM merchants WHERE id=${s.userId} LIMIT 1`
  ]);
  const a=all.rows[0],t=today.rows[0],y=yesterday.rows[0]; const pct=Number(y.gross)>0?((Number(t.gross)-Number(y.gross))/Number(y.gross))*100:null;
  json(res,200,{success:true,summary:{todayGross:Number(t.gross),todayCount:t.count,yesterdayGross:Number(y.gross),yesterdayCount:y.count,total:a.total,paid:a.paid,pending:a.pending,cancel:a.cancel,expired:a.expired,gross:Number(a.gross),successRate:a.total?Math.round(a.paid/a.total*100):0,average:a.paid?Math.round(Number(a.gross)/a.paid):0,changePct:pct},daily:days.rows.map(x=>({...x,gross:Number(x.gross)})),merchant:merchant.rows[0]});
 }catch(e){json(res,500,{success:false,error:e instanceof Error?e.message:'Dashboard failed'})}
}
