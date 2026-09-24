import type {VercelRequest,VercelResponse} from '@vercel/node';
import {sql,compare,json,method,sessionCookie} from '../db';

export default async function handler(req:VercelRequest,res:VercelResponse){
  if(!method(req,res,['POST']))return;

  try{
    const b=req.body||{};
    const email=String(b.email||'').trim().toLowerCase();
    const password=String(b.password||'');

    if(!email||!password){
      return json(res,400,{success:false,error:'Email dan password wajib diisi'});
    }

    const r=await sql`
      SELECT id,email,password_hash,name,active,api_key
      FROM merchants
      WHERE email=${email}
      LIMIT 1
    `;

    if(!r.rowCount){
      return json(res,401,{success:false,error:'Email atau password salah'});
    }

    const m=r.rows[0];

    if(m.active===false || m.active===0 || m.active==='0'){
      return json(res,403,{success:false,error:'Akun merchant tidak aktif'});
    }

    const valid=await compare(password,String(m.password_hash||''));

    if(!valid){
      return json(res,401,{success:false,error:'Email atau password salah'});
    }

    const session=sessionCookie(String(m.id),'merchant');

    res.setHeader('Set-Cookie',session);
    res.setHeader('Cache-Control','no-store');

    return json(res,200,{
      success:true,
      merchant:{
        id:m.id,
        name:m.name,
        email:m.email,
        api_key:m.api_key
      }
    });
  }catch(e){
    console.error('LOGIN ERROR',e);
    return json(res,500,{success:false,error:e instanceof Error?e.message:'Login failed'});
  }
}
