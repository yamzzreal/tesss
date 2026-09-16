import {sql} from '@vercel/postgres';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export {sql};
export function id(prefix:string){return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`}
export function apiKey(){return `ymz_live_${crypto.randomBytes(24).toString('base64url')}`}
export async function hash(v:string){return bcrypt.hash(v,12)}
export async function compare(v:string,h:string){return bcrypt.compare(v,h)}
export function cookie(name:string,value:string,maxAge:number){return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}
export function clearCookie(name:string){return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}
export function signSession(payload:string){const secret=process.env.SESSION_SECRET||'dev-only-change-me';const sig=crypto.createHmac('sha256',secret).update(payload).digest('base64url');return `${payload}.${sig}`}
export function verifySession(token:string){try{const [payload,sig]=token.split('.');if(!payload||!sig)return null;const secret=process.env.SESSION_SECRET||'dev-only-change-me';const exp=crypto.createHmac('sha256',secret).update(payload).digest('base64url');if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(exp)))return null;const obj=JSON.parse(Buffer.from(payload,'base64url').toString());if(!obj.exp||obj.exp<Date.now())return null;return obj}catch{return null}}
export function sessionCookie(userId:string,role:string){const payload=Buffer.from(JSON.stringify({userId,role,exp:Date.now()+7*86400000})).toString('base64url');return cookie('ymz_session',signSession(payload),7*86400)}
export function getSession(req:any){const raw=String(req.headers.cookie||'');const match=raw.match(/(?:^|;\\s*)ymz_session=([^;]+)/);return match?verifySession(decodeURIComponent(match[1])):null}
export function json(res:any,status:number,body:any){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body))}
export function method(req:any,res:any,allowed:string[]){if(!allowed.includes(req.method)){res.setHeader('Allow',allowed.join(', '));json(res,405,{success:false,error:'Method not allowed'});return false}return true}
export function body(req:any){return req.body&&typeof req.body==='object'?req.body:{} }
export function amount(v:any){const n=Number(v);if(!Number.isInteger(n)||n<1||n>999999999)return null;return n}
export function requireSession(req:any,res:any,role?:string){const s=getSession(req);if(!s)return null;if(role&&s.role!==role)return null;return s}
export function requireApi(req:any){const key=String(req.headers['x-api-key']||'');return key}
