'use strict';
const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const money=v=>'Rp '+Number(v||0).toLocaleString('id-ID');
const api=(route,q='')=>'/api/index?route='+encodeURIComponent(route)+(q?('&'+q):'');
let merchant=null, chart=null, allTx=[];
async function get(route,q=''){const r=await fetch(api(route,q),{credentials:'include',cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Request gagal');return d}
async function send(route,method,body){const r=await fetch(api(route),{method,credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Request gagal');return d}
function toast(msg,bad=false){const x=$('toast');x.textContent=msg;x.className='toast show '+(bad?'bad':'');clearTimeout(window.__toast);window.__toast=setTimeout(()=>x.className='toast',2600)}
function setActive(page){document.querySelectorAll('[data-page]').forEach(a=>a.classList.toggle('active',a.dataset.page===page));}
function page(){return location.hash.replace('#','')||'dashboard'}
function header(kicker,title,desc,action=''){return `<div class="page-head2"><div><small>${kicker}</small><h1>${title}</h1><p>${desc}</p></div>${action}</div>`}
function stat(label,value,sub,icon='↗',tone=''){return `<div class="metric"><div class="metric-icon ${tone}">${icon}</div><small>${label}</small><strong>${value}</strong><span>${sub||''}</span></div>`}
function statusPill(s){return `<span class="status ${s}"><i></i>${esc(s)}</span>`}
async function loadMe(){const d=await get('me');merchant=d.merchant;$('topName').textContent=merchant.name||'Merchant';$('sideName').textContent=merchant.name||'Merchant';$('sideEmail').textContent=merchant.email||'';$('avatar').textContent=(merchant.name||'Y').slice(0,1).toUpperCase()}
async function render(){const p=page();setActive(p);try{if(!merchant)await loadMe();const views={dashboard:renderDashboard,qris:renderQris,payment:renderPayment,keys:renderKeys,invoices:renderInvoices,download:renderDownload,docs:renderDocs,account:renderAccount,status:renderStatus,settings:renderSettings,webhook:renderWebhook,notifications:renderNotifications};await (views[p]||renderDashboard)()}catch(e){if(/Belum login|Session/i.test(e.message))location='/login.html';else {$('main').innerHTML=`<div class="error-page"><b>Terjadi kesalahan</b><p>${esc(e.message)}</p><button class="btn" onclick="render()">Coba lagi</button></div>`}}}
async function renderDashboard(){const d=await get('dashboard'),s=d.summary;$('main').innerHTML=header('SISTEM GATEWAY','Dashboard','Kelola dan pantau log transaksi gateway pembayaran kamu secara real-time.','<button class="btn pink" onclick="location.hash=\'qris\'">Atur QRIS</button>')+`<section class="metrics">${stat('PENDAPATAN HARI INI',money(s.todayGross),s.changePct==null?'Belum ada pembanding':`${s.changePct>=0?'↗':'↘'} ${Math.abs(s.changePct).toFixed(0)}% vs kemarin`,'✦',s.changePct>=0?'up':'down')}${stat('PENDAPATAN KEMARIN',money(s.yesterdayGross),`${s.yesterdayCount} transaksi sukses`,'◷')}${stat('RASIO KEBERHASILAN',s.successRate+'%',`${s.paid} dari ${s.total} transaksi sukses`,'✓','blue')}${stat('RERATA TRANSAKSI',money(s.average),'Rata-rata transaksi sukses','◌')}${stat('TRANSAKSI PENDING',s.pending,'Menunggu status pembayaran','◔','warn')}${stat('TRANSAKSI EXPIRED',s.expired,'Melewati batas waktu','⌁')}${stat('TOTAL OMZET',money(s.gross),'Akumulasi transaksi paid','↗','blue')}${stat('STATUS GATEWAY','ONLINE','API & database terhubung','●','up')}</section><section class="panel chart-panel"><div class="panel-head"><div><h2>Grafik Pendapatan Harian</h2><p>Pergerakan dana transaksi sukses selama 7 hari terakhir.</p></div><div class="seg"><button class="selected">PENDAPATAN</button><button>TRANSAKSI</button></div></div><div class="chart-wrap"><canvas id="incomeChart"></canvas></div></section><section class="panel"><div class="panel-head"><div><h2>Sumber & Status</h2><p>Ringkasan transaksi berdasarkan status.</p></div></div><div class="status-grid">${stat('PAID',s.paid,'Berhasil','●','up')}${stat('PENDING',s.pending,'Belum selesai','●','warn')}${stat('CANCEL',s.cancel,'Dibatalkan','●','down')}${stat('EXPIRED',s.expired,'Kedaluwarsa','●')}</div></section>`;if(chart)chart.destroy();chart=new Chart($('incomeChart'),{type:'line',data:{labels:d.daily.map(x=>new Date(x.day).toLocaleDateString('id-ID',{day:'2-digit',month:'short'})),datasets:[{label:'Pendapatan',data:d.daily.map(x=>x.gross),borderWidth:2,tension:.35,fill:false}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{callback:v=>money(v)}},x:{grid:{display:false}}}}})}
async function renderQris(){const d=await get('me');merchant=d.merchant;$('main').innerHTML=header('QRIS MANAGER','QRIS Saya','Unggah dan kelola QRIS statis merchant. QR ini digunakan untuk membuat nominal transaksi.','<button class="btn" onclick="decodeQR()">Baca QR Gambar</button>')+`<section class="panel qris-manager"><div class="qris-preview" id="qprev">${merchant.qris_payload?'<canvas id="qcanvas"></canvas>':'<div class="empty-icon">▧</div><span>Belum ada QRIS</span>'}</div><div class="qris-form"><div class="notice">Gunakan QRIS milik merchant sendiri. Gateway hanya mengolah payload untuk membuat QR nominal.</div><label class="field"><span>Upload gambar QRIS</span><input id="qrfile" type="file" accept="image/*"></label><label class="field"><span>Payload QRIS</span><textarea id="qrpayload" rows="7" placeholder="Payload QRIS...">${esc(merchant.qris_payload||'')}</textarea></label><div class="actions-left"><button class="btn" onclick="decodeQR()">Baca QR</button><button class="btn pink" onclick="saveQris()">Simpan QRIS</button></div><pre id="qrinfo" class="codebox">${merchant.qris_payload?esc(JSON.stringify({name:merchant.qris_name,city:merchant.qris_city},null,2)):''}</pre></div></div><section class="panel"><div class="panel-head"><div><h2>Status QRIS</h2><p>Informasi QRIS yang tersimpan di akun merchant.</p></div></div><div class="info-grid"><div><span>Merchant</span><b>${esc(merchant.qris_name||'-')}</b></div><div><span>Kota</span><b>${esc(merchant.qris_city||'-')}</b></div><div><span>Status</span><b>${merchant.qris_payload?'Aktif':'Belum diatur'}</b></div><div><span>Payload</span><b>${merchant.qris_payload?'Tersimpan':'-'}</b></div></div></section>`;if(merchant.qris_payload)drawQR('qcanvas',merchant.qris_payload)}
function drawQR(id,data){const c=$(id);if(c&&window.QRCode)QRCode.toCanvas(c,data,{width:230,margin:1},()=>{})}
async function saveQris(){try{const d=await send('qris-save','POST',{qris_payload:$('qrpayload').value});$('qrinfo').textContent=JSON.stringify(d.qris,null,2);toast('QRIS berhasil disimpan');await renderQris()}catch(e){toast(e.message,true)}}
function decodeQR(){const f=$('qrfile')?.files[0];if(!f)return toast('Pilih gambar QRIS terlebih dahulu',true);const img=new Image(),c=document.createElement('canvas'),x=c.getContext('2d');img.onload=()=>{const sc=Math.min(1800/img.width,1800/img.height,1);c.width=img.width*sc;c.height=img.height*sc;x.drawImage(img,0,0,c.width,c.height);const d=x.getImageData(0,0,c.width,c.height),r=window.jsQR?.(d.data,d.width,d.height,{inversionAttempts:'attemptBoth'});if(!r)return toast('QR tidak terbaca',true);$('qrpayload').value=r.data;toast('QR berhasil dibaca')};img.src=URL.createObjectURL(f)}
async function renderPayment(){const d=await get('dashboard');$('main').innerHTML=header('PAYMENT PAGE','Payment Page','Buat halaman pembayaran hosted dari transaksi yang dibuat melalui API.')+`<section class="panel"><div class="panel-head"><div><h2>Hosted Payment Page</h2><p>Setiap transaksi mendapatkan halaman pembayaran sendiri.</p></div></div><div class="flow"><div><b>01</b><strong>POST payment-create</strong><span>Merchant mengirim order_id dan amount.</span></div><div><b>02</b><strong>QR nominal</strong><span>Gateway menghasilkan QR dari QRIS merchant.</span></div><div><b>03</b><strong>Payment Page</strong><span>Customer diarahkan ke halaman checkout.</span></div><div><b>04</b><strong>Status</strong><span>Halaman polling status transaksi.</span></div></div><div class="notice blue-note">Endpoint payment page tersedia dari response <code>payment_url</code>. Status PAID tetap membutuhkan kanal verifikasi pembayaran yang sah.</div></section><section class="panel"><h2>Contoh Response</h2><pre class="codebox">{\n  "transaction_id": "tx_...",\n  "order_id": "ORDER-001",\n  "amount": 25000,\n  "status": "pending",\n  "payment_url": "/payment.html?transaction_id=tx_..."\n}</pre></section>`}
async function renderKeys(){const d=await get('dashboard'),m=d.merchant;$('main').innerHTML=header('KREDENSIAL OTORISASI','API Key','Kelola credential untuk integrasi API payment gateway.')+`<section class="panel key-panel"><div class="notice">Jangan ekspose API key di frontend publik. Simpan sebagai environment variable di server merchant.</div><div class="credential"><div class="cred-title"><span class="big-icon">⚿</span><div><h2>API Key</h2><p>Autentikasi header <code>X-API-Key</code> pada API request.</p></div><span class="badge">AKTIF</span></div><div class="secret-row"><input id="apiKey" type="password" readonly value="${esc(m.api_key||'')}"><button onclick="toggleSecret()">◉</button><button onclick="copyText('apiKey')">▢</button></div><button class="btn" onclick="regenKey()">↻ Regenerate API Key</button></div></section>`}
function toggleSecret(){const x=$('apiKey');x.type=x.type==='password'?'text':'password'}
async function regenKey(){if(!confirm('Regenerate API key? Key lama akan tidak berlaku.'))return;try{const d=await send('api-key-regenerate','POST',{});$('apiKey').value=d.api_key;toast('API key baru dibuat')}catch(e){toast(e.message,true)}}
function filterTx(){const q=($('txSearch')?.value||'').toLowerCase(),s=$('txFilter')?.value||'';const arr=allTx.filter(x=>(!s||x.status===s)&&(!q||x.id.toLowerCase().includes(q)||x.order_id.toLowerCase().includes(q)));$('txCount').textContent=`${arr.length} dari ${allTx.length} data`;$('txList').innerHTML=arr.map(x=>`<div class="tx-row"><div class="tx-main"><b>${esc(x.order_id)}</b><span>${esc(x.id)}</span><small>Dibuat: ${new Date(x.created_at).toLocaleString('id-ID')} ${x.paid_at?' · Lunas: '+new Date(x.paid_at).toLocaleString('id-ID'):''}</small></div><div class="tx-amount"><b>${money(x.amount)}</b>${statusPill(x.status)}</div><div class="tx-actions"><button class="mini" onclick="detailTx('${esc(x.id)}')">Detail</button><button class="mini" onclick="copyValue('${esc(x.id)}')">Salin ID</button>${x.status==='pending'?`<button class="mini" onclick="markPaid('${esc(x.id)}')">Tandai Lunas</button><button class="mini" onclick="cancelTx('${esc(x.id)}')">Batalkan</button>`:''}</div></div>`).join('')||'<div class="empty">Belum ada transaksi.</div>'}
async function markPaid(id){if(!confirm('Tandai transaksi ini sebagai LUNAS / PAID? Pastikan pembayaran sudah benar-benar diterima.'))return;try{const d=await send('mark-paid','POST',{transaction_id:id});toast(d.message||'Transaksi ditandai lunas');await renderInvoices()}catch(e){toast(e.message,true)}}
async function cancelTx(id){if(!confirm('Batalkan transaksi ini? Status akan menjadi CANCEL dan notifikasi Telegram akan dikirim.'))return;try{const d=await send('cancel','POST',{transaction_id:id});toast(d.message||'Transaksi dibatalkan');await renderInvoices()}catch(e){toast(e.message,true)}}
async function detailTx(id){try{const d=await get('invoice-detail','id='+encodeURIComponent(id)),x=d.invoice;alert(`Invoice ${x.order_id}\n\nNominal: ${money(x.amount)}\nStatus: ${x.status}\nCustomer: ${x.customer_name||'-'}\nEmail: ${x.customer_email||'-'}\nDibuat: ${new Date(x.created_at).toLocaleString('id-ID')}`)}catch(e){toast(e.message,true)}}
function exportCSV(){const rows=[['id','order_id','amount','status','created_at','paid_at'],...allTx.map(x=>[x.id,x.order_id,x.amount,x.status,x.created_at,x.paid_at||''])];const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='yamzz-invoices.csv';a.click();URL.revokeObjectURL(a.href)}
async function renderInvoices(){
  const d=await get('transactions','limit=200');
  allTx=Array.isArray(d.transactions)?d.transactions:[];
  $('main').innerHTML=header('AKTIVITAS','Riwayat Invoice','Lihat dan kelola seluruh transaksi yang dibuat melalui API gateway.')+
  `<section class="panel">
    <div class="toolbar">
      <div class="search"><input id="txSearch" placeholder="Cari order ID..."></div>
      <select id="txFilter"><option value="">Semua status</option><option value="paid">paid</option><option value="pending">pending</option><option value="expired">expired</option><option value="cancel">cancel</option></select>
      <button class="btn" type="button" id="exportBtn">Export CSV</button>
    </div>
    <div class="panel-head"><div><h2>Invoice & Transaksi</h2><p id="txCount">${allTx.length} data</p></div></div>
    <div id="txList"></div>
  </section>`;
  $('txSearch').addEventListener('input',filterTx);
  $('txFilter').addEventListener('change',filterTx);
  $('exportBtn').addEventListener('click',exportCSV);
  filterTx();
}


async function renderWebhook(){
  const d=await get('integrations'),m=d.integrations||{};
  $('main').innerHTML=header('INTEGRASI SISTEM','Endpoint Callback','Tentukan tujuan pengiriman callback setiap transaksi lunas.')+
  `<section class="panel integration-hero"><div class="integration-icon">⌁</div><div><h2>Endpoint Callback</h2><p>Gateway akan mengirim POST JSON ketika transaksi berstatus <b>PAID</b>.</p></div></section>
  <section class="panel">
    <div class="panel-head"><div><h2>URL Webhook Kustom</h2><p>Gunakan HTTPS dan endpoint publik yang bisa menerima request dari server.</p></div><span class="badge">OPSIONAL</span></div>
    <label class="field"><span>URL Webhook Kustom</span><input id="webhookUrl" type="url" placeholder="https://domainkamu.com/api/webhook" value="${esc(m.webhook_url||'')}"></label>
    <div class="actions-left"><button class="btn" onclick="testWebhook()">➤ Test Webhook</button><button class="btn pink" onclick="saveIntegrations('webhook')">▣ Simpan Perubahan</button></div>
    <div class="notice blue-note">Wajib HTTPS port 443 dengan domain publik. Server tujuan sebaiknya membalas HTTP <b>200 OK</b> dalam 10 detik.</div>
  </section>
  <section class="panel code-panel"><div class="panel-head"><div><h2>Payload Preview</h2><p>Format callback yang dikirim saat transaksi lunas.</p></div><span class="code-label">application/json</span></div>
  <pre class="codebox">POST /your-endpoint HTTP/1.1
Content-Type: application/json
X-Casaku-Signature: hmac-sha256=&lt;signature&gt;

{
  "transactionId": "CSK-f81d4fae-...",
  "orderId": "ORDER-001",
  "amount": 55000,
  "packageName": "com.company.paymentapp",
  "appName": "${esc(merchant?.name||'Yamzz Payment')}",
  "status": "paid",
  "paidAt": "2026-09-24T03:38:35.000Z"
}</pre></section>
  <section class="panel"><div class="panel-head"><div><h2>Verifikasi Signature (HMAC-SHA256)</h2><p>Gunakan raw body request sebelum JSON di-parse untuk memverifikasi callback.</p></div></div>
    <div class="steps-mini"><div><b>1</b><span><strong>Ambil raw body request</strong><br>Jangan di-parse dahulu karena perubahan whitespace dapat merusak signature.</span></div><div><b>2</b><span><strong>Hitung HMAC-SHA256</strong><br>Kunci yang dipakai adalah <b>Webhook Secret</b> merchant.</span></div><div><b>3</b><span><strong>Bandingkan constant-time</strong><br>Gunakan <code>crypto.timingSafeEqual</code>.</span></div></div>
    <div class="secret-row"><input id="webhookSecret" type="password" readonly value="${esc(m.webhook_secret||'Belum dibuat — simpan konfigurasi dulu')}"><button onclick="toggleWebhookSecret()">◉</button><button onclick="copyValue(document.getElementById('webhookSecret').value)">▢</button></div>
  </section>`;
}
async function renderNotifications(){
  const d=await get('integrations'),m=d.integrations||{},logs=Array.isArray(d.notifications)?d.notifications:[];
  $('main').innerHTML=header('INTEGRASI SISTEM','Notifikasi Saldo','Kelola saluran Telegram dan webhook Discord untuk menerima alert transaksi masuk secara otomatis.')+
  `<section class="panel integration-hero"><div class="integration-icon">♢</div><div><h2>Saluran Notifikasi</h2><p>Dapatkan alert instan setiap ada pembayaran sukses masuk.</p></div></section>
  <section class="panel"><div class="panel-head"><div><h2>Telegram</h2><p>Notifikasi dikirim melalui bot Telegram.</p></div><span class="badge">OPSIONAL</span></div>
    <label class="field"><span>◉ ID Telegram Bot</span><input id="telegramChat" placeholder="Contoh: 8920279824" value="${esc(m.telegram_chat_id||'')}"></label>
    <button class="btn" onclick="testNotifications()">➤ Test Notifikasi</button>
    <div class="notice">Atur environment variable <code>TELEGRAM_BOT_TOKEN</code> di Vercel. Kirim <code>/start</code> ke bot lalu masukkan <b>Chat ID numerik</b> di atas.</div>
  </section>
  <section class="panel"><div class="panel-head"><div><h2>Discord</h2><p>Kirim alert ke channel Discord menggunakan Incoming Webhook.</p></div><span class="badge">OPSIONAL</span></div>
    <label class="field"><span>◉ URL Webhook Discord</span><input id="discordWebhook" type="url" placeholder="https://discord.com/api/webhooks/..." value="${esc(m.discord_webhook_url||'')}"></label>
    <button class="btn" onclick="testNotifications()">➤ Test Notifikasi</button>
  </section>
  <section class="panel"><div class="panel-head"><div><h2>Riwayat Notifikasi</h2><p>Log pengiriman alert untuk status pending, paid, expired, dan cancel.</p></div></div>
    <div class="notification-log">${logs.length?logs.map(x=>`<div class="notification-row"><div><b>${esc(x.channel)}</b><span>${esc(x.transaction_id)}</span></div><div>${statusPill(x.status)}<small>${new Date(x.created_at).toLocaleString('id-ID')}</small></div></div>`).join(''):'<div class="empty">Belum ada notifikasi.</div>'}</div>
  </section>
  <div class="actions-left"><button class="btn pink" onclick="saveIntegrations('notifications')">▣ Simpan Perubahan</button></div>`;
}
async function saveIntegrations(kind){try{const body={action:'save',webhook_url:$('webhookUrl')?.value||undefined,telegram_chat_id:$('telegramChat')?.value||undefined,discord_webhook_url:$('discordWebhook')?.value||undefined};const d=await send('integrations','POST',body);toast('Perubahan berhasil disimpan');if(kind==='webhook')await renderWebhook();else await renderNotifications();}catch(e){toast(e.message,true)}}
async function testWebhook(){try{await saveIntegrations('webhook');const d=await send('integrations','POST',{action:'test-webhook'});toast(d.success?'Test webhook berhasil':'Test webhook gagal',!d.success)}catch(e){toast(e.message,true)}}
async function testNotifications(){try{await saveIntegrations('notifications');const d=await send('integrations','POST',{action:'test-notification'});const bad=(d.results||[]).filter(x=>!x.ok);toast(bad.length?'Sebagian notifikasi gagal':'Test notifikasi berhasil',!!bad.length);if(page()==='notifications')await renderNotifications()}catch(e){toast(e.message,true)}}
function toggleWebhookSecret(){const x=$('webhookSecret');if(x)x.type=x.type==='password'?'text':'password'}

function renderDownload(){$('main').innerHTML=header('APLIKASI','Download App','Pasang Yamzz Payment sebagai aplikasi di perangkat untuk akses dashboard lebih cepat.')+`<section class="panel install-card"><div class="app-icon">Y</div><h2>Yamzz Payment</h2><p>Versi 3.0.0 · Progressive Web App</p><button class="btn pink" id="installBtn">⇩ Install App</button><div class="notice">Jika tombol install belum muncul, gunakan menu browser “Add to Home screen”.</div></section>`;$('installBtn').onclick=async()=>{if(window.__deferred){window.__deferred.prompt();await window.__deferred.userChoice;window.__deferred=null}else toast('Browser belum menyediakan prompt install. Gunakan Add to Home screen.')}}
function renderDocs(){$('main').innerHTML=header('DOKUMENTASI','Docs API','Dokumentasi endpoint utama Yamzz Payment Gateway.')+`<section class="panel docs"><h2>Authentication</h2><pre class="codebox">X-API-Key: YOUR_MERCHANT_API_KEY</pre><h2>1. Create Payment</h2><pre class="codebox">POST /api/index?route=payment-create\nContent-Type: application/json\nX-API-Key: ...\n\n{"order_id":"ORDER-001","amount":25000}</pre><h2>2. Check Status</h2><pre class="codebox">GET /api/index?route=payment-status&transaction_id=tx_...\nX-API-Key: ...</pre><h2>3. Public Payment Page</h2><pre class="codebox">/payment.html?transaction_id=tx_...</pre><div class="notice">PAID tidak boleh dianggap valid hanya karena QR berhasil dibuat. Gunakan kanal verifikasi/notifikasi pembayaran yang sah.</div></section>`}
async function renderAccount(){const d=await get('account'),a=d.account;$('main').innerHTML=header('AKUN','Akun Saya','Kelola identitas merchant dan keamanan akun.')+`<section class="panel"><form id="accForm" class="form-grid"><label class="field"><span>Nama bisnis</span><input name="name" value="${esc(a.name)}" required></label><label class="field"><span>Email</span><input name="email" type="email" value="${esc(a.email)}" required></label><div class="actions-left"><button class="btn pink">Simpan perubahan</button></div></form></section><section class="panel"><h2>Ganti Password</h2><form id="pwForm" class="form-grid"><label class="field"><span>Password saat ini</span><input name="current_password" type="password" required></label><label class="field"><span>Password baru</span><input name="new_password" type="password" minlength="8" required></label><div class="actions-left"><button class="btn">Update password</button></div></form></section>`;$('accForm').onsubmit=async e=>{e.preventDefault();try{await send('account','POST',Object.fromEntries(new FormData(e.target)));toast('Profil diperbarui');await loadMe()}catch(x){toast(x.message,true)}};$('pwForm').onsubmit=async e=>{e.preventDefault();try{await send('account','PUT',Object.fromEntries(new FormData(e.target)));e.target.reset();toast('Password berhasil diubah')}catch(x){toast(x.message,true)}}}
async function renderStatus(){const d=await get('app-status');$('main').innerHTML=header('SISTEM','Status Aplikasi','Pantau ketersediaan komponen utama gateway.')+`<section class="status-hero"><div class="online-dot"></div><div><h2>${d.status==='operational'?'Semua sistem operasional':'Sistem mengalami gangguan'}</h2><p>Terakhir diperiksa ${new Date(d.time).toLocaleString('id-ID')}</p></div></section><section class="status-grid big">${stat('API','ONLINE','Endpoint gateway','●','up')}${stat('DATABASE',d.database.toUpperCase(),`${d.latencyMs} ms`,'◉',d.database==='online'?'up':'down')}${stat('VERSION',d.version,'Current release','◇','blue')}${stat('LATENCY',d.latencyMs+' ms','Health check','◷')}</section>`}
async function renderSettings(){const d=await get('dashboard'),m=d.merchant;$('main').innerHTML=header('PENGATURAN','Pengaturan','Konfigurasi dasar akun dan preferensi gateway.')+`<section class="panel"><h2>Informasi Gateway</h2><div class="info-grid"><div><span>Nama</span><b>${esc(m.name)}</b></div><div><span>Email</span><b>${esc(m.email)}</b></div><div><span>Merchant ID</span><b>${esc(m.id)}</b></div><div><span>Terdaftar</span><b>${new Date(m.created_at).toLocaleDateString('id-ID')}</b></div></div></section><section class="panel"><h2>Keamanan</h2><div class="notice">API key hanya gunakan pada backend merchant. Jangan commit credential ke GitHub atau menaruhnya di frontend.</div><button class="btn" onclick="location.hash='keys'">Kelola API Key</button></section>`}
async function copyText(id){const v=$(id).value||$(id).textContent;await navigator.clipboard.writeText(v);toast('Disalin')}
async function copyValue(v){await navigator.clipboard.writeText(v);toast('ID disalin')}
window.copyText=copyText;window.copyValue=copyValue;window.render=render;window.testWebhook=testWebhook;window.testNotifications=testNotifications;window.saveIntegrations=saveIntegrations;window.toggleWebhookSecret=toggleWebhookSecret;window.saveQris=saveQris;window.decodeQR=decodeQR;window.toggleSecret=toggleSecret;window.regenKey=regenKey;window.detailTx=detailTx;window.exportCSV=exportCSV;window.cancelTx=cancelTx;
$('logout').onclick=async()=>{await fetch(api('logout'),{method:'POST',credentials:'include'});location='/login.html'};
$('menuBtn').onclick=()=>$('sidebar').classList.toggle('open');
(function(){
  const key='yamzz-theme', saved=localStorage.getItem(key);
  if(saved==='light') document.body.classList.add('light');
  function sync(){
    const light=document.body.classList.contains('light');
    const b=$('themeBtn');
    if(b){b.textContent=light?'☀':'☾';b.title=light?'Mode terang':'Mode gelap';}
  }
  $('themeBtn').onclick=()=>{
    document.body.classList.toggle('light');
    localStorage.setItem(key,document.body.classList.contains('light')?'light':'dark');
    sync();
  };
  sync();
})();window.addEventListener('hashchange',render);window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();window.__deferred=e});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});render();
  
