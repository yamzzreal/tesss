# Yamzz PHP Marketplace V2

Fitur:
- Register & login
- Session authentication
- Saldo user
- Pengajuan top up
- Admin approve top up
- Pembelian menggunakan saldo
- Riwayat transaksi
- Admin dashboard
- PostgreSQL database
- Deploy ke Vercel

## Database Vercel

Buat database PostgreSQL yang kompatibel dengan Vercel/Neon, lalu tambahkan Environment Variable:

DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE

Project membuat tabel otomatis saat request pertama.

## Membuat admin

Setelah akun dibuat, ubah role akun tersebut menjadi `admin` melalui SQL:

UPDATE users SET role='admin' WHERE email='emailkamu@example.com';

## Deploy

Import repository GitHub ke Vercel, lalu tambahkan DATABASE_URL di Project Settings > Environment Variables dan deploy ulang.

Catatan:
- Jangan menyimpan password/database credential di source code.
- Untuk pembayaran nyata, gunakan payment gateway dan webhook server-side.
- Sistem top up di starter ini masih manual: user mengajukan nominal/catatan, admin melakukan approve.
