import type {VercelRequest,VercelResponse} from '@vercel/node';
import {getSession,json,method,sql} from '../db';
import {notifyStatusOnce} from '../notify';

export default async function handler(req:VercelRequest,res:VercelResponse){
  if(!method(req,res,['POST']))return;
  const s=getSession(req);
  if(!s||s.role!=='merchant')return json(res,401,{success:false,error:'Belum login'});
  const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  const id=String(body.transaction_id||body.id||'').trim();
  if(!id)return json(res,400,{success:false,error:'transaction_id wajib'});
  try{
    const current=await sql`SELECT id,order_id,amount,status,merchant_id FROM transactions WHERE id=${id} AND merchant_id=${s.userId} LIMIT 1`;
    if(!current.rowCount)return json(res,404,{success:false,error:'Transaksi tidak ditemukan'});
    const tx=current.rows[0];
    if(tx.status==='cancel')return json(res,200,{success:true,alreadyCanceled:true,message:'Transaksi sudah berstatus CANCEL',transaction:tx});
    if(tx.status!=='pending')return json(res,409,{success:false,error:`Transaksi berstatus ${tx.status} dan tidak dapat dibatalkan.`});
    const updated=await sql`UPDATE transactions SET status='cancel',canceled_at=NOW() WHERE id=${id} AND merchant_id=${s.userId} AND status='pending' RETURNING *`;
    if(!updated.rowCount)return json(res,409,{success:false,error:'Status transaksi berubah. Muat ulang halaman.'});
    const notification=await notifyStatusOnce(id,'cancel');
    return json(res,200,{success:true,message:'Transaksi berhasil dibatalkan.',transaction:updated.rows[0],notification});
  }catch(e){return json(res,500,{success:false,error:e instanceof Error?e.message:'Gagal membatalkan transaksi'})}
}
