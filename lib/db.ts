import {sql} from '@vercel/postgres';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export {sql};

export function id(prefix:string){
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;
}

export function apiKey(){
  return `ymz_live_${crypto.randomBytes(24).toString('base64url')}`;
}

export async function hash(v:string){
  return bcrypt.hash(v,12);
}

export async function compare(v:string,h:string){
  return bcrypt.compare(v,h);
}

export function cookie(name:string,value:string,maxAge:number){
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearCookie(name:string){
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function secret(){
  return process.env.SESSION_SECRET || 'dev-only-change-me';
}

export function signSession(payload:string){
  const sig=crypto.createHmac('sha256',secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySession(token:string){
  try{
    const dot=token.lastIndexOf('.');
    if(dot<=0)return null;

    const payload=token.slice(0,dot);
    const sig=token.slice(dot+1);
    if(!payload||!sig)return null;

    const expected=crypto.createHmac('sha256',secret()).update(payload).digest('base64url');

    const a=Buffer.from(sig,'utf8');
    const b=Buffer.from(expected,'utf8');
    if(a.length!==b.length || !crypto.timingSafeEqual(a,b))return null;

    const obj=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    if(!obj || !obj.userId || !obj.role || !obj.exp || Number(obj.exp)<Date.now())return null;

    return obj;
  }catch{
    return null;
  }
}

export function sessionCookie(userId:string,role:string){
  const payload=Buffer.from(JSON.stringify({
    userId:String(userId),
    role:String(role),
    exp:Date.now()+7*86400000
  })).toString('base64url');

  return cookie('ymz_session',signSession(payload),7*86400);
}

export function getSession(req:any){
  const raw=String(req?.headers?.cookie || '');
  if(!raw)return null;

  const cookies=raw.split(';');

  for(const item of cookies){
    const eq=item.indexOf('=');
    if(eq<0)continue;

    const name=item.slice(0,eq).trim();
    if(name!=='ymz_session')continue;

    const value=item.slice(eq+1).trim();
    if(!value)return null;

    try{
      return verifySession(decodeURIComponent(value));
    }catch{
      return null;
    }
  }

  return null;
}

export function json(res:any,status:number,body:any){
  res.status(status).setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function method(req:any,res:any,allowed:string[]){
  if(!allowed.includes(req.method)){
    res.setHeader('Allow',allowed.join(', '));
    json(res,405,{success:false,error:'Method not allowed'});
    return false;
  }
  return true;
}

export function body(req:any){
  return req.body&&typeof req.body==='object'?req.body:{};
}

export function amount(v:any){
  const n=Number(v);
  if(!Number.isInteger(n)||n<1||n>999999999)return null;
  return n;
}

export function requireSession(req:any,res:any,role?:string){
  const s=getSession(req);
  if(!s)return null;
  if(role&&s.role!==role)return null;
  return s;
}

export function requireApi(req:any){
  return String(req.headers['x-api-key']||'');
}
