import crypto from 'node:crypto';
import {sql} from './db';

function safe(v:any){return v==null?'':String(v)}
function sign(body:string,secret:string){return crypto.createHmac('sha256',secret).update(body).digest('hex')}

async function claim(merchantId:string,transactionId:string,channel:string){
  try{
    const r=await sql`INSERT INTO notifications(id,merchant_id,transaction_id,channel,status,detail) VALUES(${crypto.randomUUID()},${merchantId},${transactionId},${channel},'sending','') ON CONFLICT (transaction_id,channel) DO NOTHING RETURNING id`;
    return !!r.rowCount;
  }catch{return false}
}
async function finish(id:string,ok:boolean,detail:string){try{await sql`UPDATE notifications SET status=${ok?'sent':'failed'},detail=${detail.slice(0,1000)} WHERE id=${id}`}catch{}}

export async function deliverStatus(tx:any, merchant:any, status?:string){
  const currentStatus=safe(status || tx.status).toLowerCase();
  const results:any[]=[];
  const paidAt=tx.paid_at || new Date().toISOString();
  const labels:any={pending:'Menunggu Pembayaran',paid:'Pembayaran Berhasil',expired:'Transaksi Kedaluwarsa',cancel:'Transaksi Dibatalkan'};
  const icons:any={pending:'⏳',paid:'💰',expired:'⌛',cancel:'❌'};
  const label=labels[currentStatus] || `Status ${currentStatus.toUpperCase()}`;
  const payload={
    transactionId:safe(tx.id),orderId:safe(tx.order_id),amount:Number(tx.amount||0),
    packageName:safe(tx.product_name || tx.metadata?.packageName || ''),appName:safe(merchant.name),status:currentStatus,
    paidAt:currentStatus==='paid'?paidAt:null
  };
  const raw=JSON.stringify(payload);

  if(currentStatus==='paid' && merchant.webhook_url){
    const claimed=await claim(merchant.id,tx.id,'webhook');
    if(claimed){
      const noteId=await sql`SELECT id FROM notifications WHERE transaction_id=${tx.id} AND channel='webhook' LIMIT 1`;
      try{
        const signature=merchant.webhook_secret?sign(raw,String(merchant.webhook_secret)):'';
        const r=await fetch(merchant.webhook_url,{method:'POST',headers:{'Content-Type':'application/json','X-Casaku-Signature':`hmac-sha256=${signature}`,'X-Yamzz-Signature':`hmac-sha256=${signature}`},body:raw});
        const text=await r.text().catch(()=> '');const ok=r.ok;results.push({channel:'webhook',ok,status:r.status});if(noteId.rowCount)await finish(noteId.rows[0].id,ok,`HTTP ${r.status} ${text}`);
      }catch(e){results.push({channel:'webhook',ok:false,error:String(e)});if(noteId.rowCount)await finish(noteId.rows[0].id,false,String(e))}
    }else results.push({channel:'webhook',ok:true,skipped:true});
  }

  const token=safe(process.env.TELEGRAM_BOT_TOKEN),chat=safe(merchant.telegram_chat_id);
  if(token&&chat){
    const channel=`telegram_${currentStatus}`;
    const claimed=await claim(merchant.id,tx.id,channel);
    if(claimed){
      const noteId=await sql`SELECT id FROM notifications WHERE transaction_id=${tx.id} AND channel=${channel} LIMIT 1`;
      try{
        const timeValue=currentStatus==='paid' ? paidAt : (tx.created_at || new Date().toISOString());
        const text=`${icons[currentStatus]||'🔔'} *${label}*\n\nMerchant: *${safe(merchant.name)}*\nOrder ID: *${safe(tx.order_id)}*\nID Transaksi: \`${safe(tx.id)}\`\nNominal: *Rp ${Number(tx.amount||0).toLocaleString('id-ID')}*\nStatus: *${currentStatus.toUpperCase()}*\nWaktu: ${new Date(timeValue).toLocaleString('id-ID')}`;
        const r=await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chat,text,parse_mode:'Markdown'})});
        const t=await r.text().catch(()=> '');const ok=r.ok;results.push({channel:'telegram',status:currentStatus,ok,statusCode:r.status});if(noteId.rowCount)await finish(noteId.rows[0].id,ok,`HTTP ${r.status} ${t}`);
      }catch(e){results.push({channel:'telegram',status:currentStatus,ok:false,error:String(e)});if(noteId.rowCount)await finish(noteId.rows[0].id,false,String(e))}
    }else results.push({channel:'telegram',status:currentStatus,ok:true,skipped:true});
  }

  if(currentStatus==='paid'){
    const discord=safe(merchant.discord_webhook_url);
    if(discord){
      const claimed=await claim(merchant.id,tx.id,'discord');
      if(claimed){
        const noteId=await sql`SELECT id FROM notifications WHERE transaction_id=${tx.id} AND channel='discord' LIMIT 1`;
        try{
          const r=await fetch(discord,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:`💰 **Pembayaran Berhasil**\nMerchant: **${safe(merchant.name)}**\nOrder ID: **${safe(tx.order_id)}**\nID Transaksi: \`${safe(tx.id)}\`\nNominal: **Rp ${Number(tx.amount||0).toLocaleString('id-ID')}**\nStatus: **PAID**`})});
          const t=await r.text().catch(()=> '');const ok=r.ok;results.push({channel:'discord',ok,status:r.status});if(noteId.rowCount)await finish(noteId.rows[0].id,ok,`HTTP ${r.status} ${t}`);
        }catch(e){results.push({channel:'discord',ok:false,error:String(e)});if(noteId.rowCount)await finish(noteId.rows[0].id,false,String(e))}
      }else results.push({channel:'discord',ok:true,skipped:true});
    }
  }
  return results;
}

export async function notifyStatusOnce(transactionId:string,status?:string){
  const r=await sql`SELECT t.*,m.name,m.webhook_url,m.webhook_secret,m.telegram_chat_id,m.discord_webhook_url FROM transactions t JOIN merchants m ON m.id=t.merchant_id WHERE t.id=${transactionId} LIMIT 1`;
  if(!r.rowCount)return {sent:[],skipped:true};
  const tx=r.rows[0];
  const wanted=safe(status || tx.status).toLowerCase();
  if(!['pending','paid','expired','cancel'].includes(wanted))return {sent:[],skipped:true};
  return {sent:await deliverStatus(tx,r.rows[0],wanted)};
}

export async function notifyPaidOnce(transactionId:string){
  return notifyStatusOnce(transactionId,'paid');
}
