# Yamzz Payment Gateway — Merchant-Owned QRIS

Versi ini **tidak memakai Casaku/Pakasir sebagai payment provider**. Modelnya:

1. Merchant membuat akun.
2. Merchant upload QRIS statis miliknya. Browser membaca QR dari gambar menggunakan jsQR, lalu hanya payload QR yang disimpan.
3. Merchant mendapat API key.
4. Website merchant memanggil `POST /api/payment-create` dengan `order_id` + `amount`.
5. Server membuat payload QR nominal dari QRIS merchant dan mengembalikan `qr_string`.
6. Pembeli membayar QR tersebut; dana diarahkan ke QRIS merchant karena QR berasal dari payload merchant.

## Hal yang sangat penting

Kode ini **bukan acquirer/PJP QRIS** dan tidak memindahkan atau menahan dana. Transformasi QR yang dilakukan adalah transformasi TLV EMVCo/QRIS-style (tag 01 menjadi dynamic dan tag 54 diisi nominal, lalu CRC dihitung ulang). **Itu bukan jaminan bahwa semua PJP/acquirer akan menerima payload hasil transformasi.** Merchant harus menguji QR hasil dengan kanal pembayaran dan QRIS miliknya serta memastikan model dynamic QR tersebut diperbolehkan oleh penerbit QRIS.

Selain itu, **QR generator tidak bisa mengetahui pembayaran secara otomatis hanya dari QR**. Endpoint status pada proyek ini hanya membaca status transaksi yang disimpan gateway (`pending`/`expired`). Untuk `paid` otomatis, kamu perlu kanal notifikasi/status transaksi resmi dari PJP/acquirer merchant. Jangan menganggap screenshot bukti transfer sebagai verifikasi pembayaran otomatis.

## Database

Vercel serverless tidak menyimpan data ke file lokal secara permanen. Karena itu proyek ini memakai Vercel Postgres/Neon-compatible database untuk akun, merchant QR payload, produk, API key, dan transaksi. Ini adalah **database**, bukan payment provider.

### Deploy

1. Buat project Vercel dan pasang integrasi Postgres/Neon.
2. Set `POSTGRES_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `APP_URL` di Environment Variables.
3. Deploy.
4. Buka `POST /api/setup-db` sekali (bisa via curl/Postman) untuk membuat tabel.
5. Buka `/register.html`.

### API create payment

```http
POST /api/payment-create
X-API-Key: ymz_live_xxx
Content-Type: application/json

{"order_id":"ORDER-001","amount":25000,"expired_minutes":15}
```

Response:

```json
{
  "success": true,
  "transaction_id": "tx_...",
  "order_id": "ORDER-001",
  "amount": 25000,
  "status": "pending",
  "expires_at": "...",
  "qr_string": "000201...6304...."
}
```

Website merchant dapat mengubah `qr_string` menjadi gambar QR memakai library QR generator di frontend.

### Status

```http
GET /api/payment-status?transaction_id=tx_xxx
X-API-Key: ymz_live_xxx
```

## Jangan lakukan

- Jangan meminta merchant mengunggah username/password bank atau e-wallet.
- Jangan menyimpan PIN/OTP/kredensial pembayaran.
- Jangan menganggap payload QR hasil generator sebagai jaminan acceptance oleh seluruh PJP.
- Jangan menandai transaksi `paid` hanya karena user mengirim screenshot.

## Struktur

- `public/` — landing, register, login, merchant dashboard, admin.
- `api/` — serverless API Vercel.
- `lib/qris.ts` — parser TLV, CRC16, static-to-nominal transform.
- `lib/db.ts` — database, session, hashing, API key.
- `schema.sql` — schema database.
