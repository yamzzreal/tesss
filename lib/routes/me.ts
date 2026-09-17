import type {VercelRequest,VercelResponse} from '@vercel/node';
import {getSession,json,method,sql} from '../db';

export default async function handler(req:VercelRequest,res:VercelResponse){
  if(!method(req,res,['GET']))return;

  try{
    const s=getSession(req);

    if(!s){
      res.setHeader('Cache-Control','no-store');
      return json(res,401,{success:false,error:'Belum login'});
    }

    if(s.role!=='merchant'){
      return json(res,401,{success:false,error:'Session tidak valid'});
    }

    const r=await sql`
      SELECT id,email,name,api_key,qris_payload,qris_name,qris_city,active,created_at
      FROM merchants
      WHERE id=${s.userId}
      LIMIT 1
    `;

    if(!r.rowCount){
      return json(res,404,{success:false,error:'Merchant tidak ditemukan'});
    }

    const merchant=r.rows[0];

    if(merchant.active===false || merchant.active===0 || merchant.active==='0'){
      return json(res,403,{success:false,error:'Akun merchant tidak aktif'});
    }

    res.setHeader('Cache-Control','no-store');

    return json(res,200,{success:true,merchant});
  }catch(e){
    console.error('ME ERROR',e);
    return json(res,500,{success:false,error:e instanceof Error?e.message:'Session check failed'});
  }
}
