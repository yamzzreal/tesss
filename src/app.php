<?php
declare(strict_types=1);
session_start();

$dbUrl = getenv('DATABASE_URL') ?: '';
if (!$dbUrl) {
    http_response_code(500);
    exit("DATABASE_URL belum diatur di Vercel.");
}

function db(): PDO {
    static $pdo;
    global $dbUrl;
    if ($pdo) return $pdo;
    $u = parse_url($dbUrl);
    if (!$u || empty($u['host'])) exit("DATABASE_URL tidak valid.");
    $dsn = "pgsql:host={$u['host']};port=".($u['port'] ?? 5432).";dbname=".ltrim($u['path'] ?? '', '/');
    $pdo = new PDO($dsn, $u['user'] ?? '', $u['pass'] ?? '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => true
    ]);
    return $pdo;
}

function init(): void {
    $sql = [
        "CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, email VARCHAR(150) UNIQUE NOT NULL, password_hash TEXT NOT NULL, balance NUMERIC(14,2) DEFAULT 0, role VARCHAR(20) DEFAULT 'user', created_at TIMESTAMPTZ DEFAULT NOW())",
        "CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, title VARCHAR(160) NOT NULL, description TEXT, price NUMERIC(14,2) NOT NULL, category VARCHAR(80) NOT NULL, image TEXT, status VARCHAR(20) DEFAULT 'ready', created_at TIMESTAMPTZ DEFAULT NOW())",
        "CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id), product_id INT REFERENCES products(id), amount NUMERIC(14,2) NOT NULL, type VARCHAR(30) NOT NULL, status VARCHAR(30) DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW())",
        "CREATE TABLE IF NOT EXISTS topups (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id), amount NUMERIC(14,2) NOT NULL, status VARCHAR(30) DEFAULT 'pending', note TEXT, created_at TIMESTAMPTZ DEFAULT NOW())"
    ];

    foreach ($sql as $q) {
        db()->exec($q);
    }

    // Upgrade tables created by older versions of the project.
    $migrations = [
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS title VARCHAR(160)",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(80)",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ready'",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()",
    ];

    foreach ($migrations as $q) {
        db()->exec($q);
    }

    // Give legacy/incomplete product rows safe defaults.
    db()->exec("UPDATE products SET title = COALESCE(NULLIF(title,''),'Produk') WHERE title IS NULL OR title=''");
    db()->exec("UPDATE products SET category = COALESCE(NULLIF(category,''),'Lainnya') WHERE category IS NULL OR category=''");
    db()->exec("UPDATE products SET status = COALESCE(NULLIF(status,''),'ready') WHERE status IS NULL OR status=''");
}
init();

function h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function user(): ?array {
    if (empty($_SESSION['uid'])) return null;
    $s=db()->prepare("SELECT id, username, email, password_hash, balance, role, created_at FROM users WHERE id=?"); $s->execute([$_SESSION['uid']]);
    return $s->fetch() ?: null;
}
function requireLogin(): array { $u=user(); if(!$u){ header("Location: /?page=login"); exit; } return $u; }
function requireAdmin(): array { $u=requireLogin(); if($u['role']!=='admin'){ http_response_code(403); exit("Forbidden"); } return $u; }
function money($n): string { return 'Rp '.number_format((float)$n,0,',','.'); }

$action=$_POST['action']??'';
if($action==='register'){
    try{
        $s=db()->prepare("INSERT INTO users(username,email,password_hash) VALUES(?,?,?)");
        $s->execute([trim($_POST['username']),trim($_POST['email']),password_hash($_POST['password'],PASSWORD_DEFAULT)]);
        header("Location: /?page=login&registered=1"); exit;
    }catch(Throwable $e){ $error="Username/email sudah digunakan."; }
}
if($action==='login'){
    $s=db()->prepare("SELECT id, username, email, password_hash, balance, role, created_at FROM users WHERE email=?"); $s->execute([trim($_POST['email'])]); $u=$s->fetch();
    if($u && password_verify($_POST['password'],$u['password_hash'])){ $_SESSION['uid']=$u['id']; header("Location: /"); exit; }
    $error="Email atau password salah.";
}
if($action==='logout'){ session_destroy(); header("Location: /"); exit; }
if($action==='topup'){
    $u=requireLogin(); $amt=max(1,(float)$_POST['amount']);
    $s=db()->prepare("INSERT INTO topups(user_id,amount,note) VALUES(?,?,?)");
    $s->execute([$u['id'],$amt,trim($_POST['note']??'')]);
    header("Location: /?page=account&msg=topup"); exit;
}
if($action==='buy'){
    $u=requireLogin(); $id=(int)$_POST['product_id'];
    db()->beginTransaction();
    try{
        $s=db()->prepare("SELECT id, title, description, price, category, image, status, created_at FROM products WHERE id=? FOR UPDATE"); $s->execute([$id]); $p=$s->fetch();
        if(!$p || ($p['status'] ?? 'ready')!=='ready') throw new Exception("Produk tidak tersedia.");
        if((float)$u['balance'] < (float)$p['price']) throw new Exception("Saldo tidak cukup.");
        db()->prepare("UPDATE users SET balance=balance-? WHERE id=?")->execute([$p['price'],$u['id']]);
        db()->prepare("UPDATE products SET status='sold' WHERE id=?")->execute([$id]);
        db()->prepare("INSERT INTO transactions(user_id,product_id,amount,type,status) VALUES(?,?,?,'purchase','paid')")->execute([$u['id'],$id,$p['price']]);
        db()->commit(); header("Location: /?page=transactions&ok=1"); exit;
    }catch(Throwable $e){ db()->rollBack(); $error=$e->getMessage(); }
}
if($action==='admin_topup'){
    requireAdmin(); $id=(int)$_POST['topup_id'];
    db()->beginTransaction();
    $s=db()->prepare("SELECT * FROM topups WHERE id=? FOR UPDATE"); $s->execute([$id]); $t=$s->fetch();
    if($t && $t['status']==='pending'){
        db()->prepare("UPDATE topups SET status='approved' WHERE id=?")->execute([$id]);
        db()->prepare("UPDATE users SET balance=balance+? WHERE id=?")->execute([$t['amount'],$t['user_id']]);
    }
    db()->commit(); header("Location: /?page=admin"); exit;
}
if($action==='admin_product'){
    requireAdmin();
    db()->prepare("INSERT INTO products(title,description,price,category,image) VALUES(?,?,?,?,?)")
      ->execute([$_POST['title'],$_POST['description'],$_POST['price'],$_POST['category'],$_POST['image']]);
    header("Location: /?page=admin"); exit;
}

$page = $_GET['page'] ?? 'home';
$u = user();

// Authentication/authorization must happen before HTML output,
// otherwise header("Location: ...") would fail with "headers already sent".
if ($page === 'account' || $page === 'transactions') {
    $u = requireLogin();
}
if ($page === 'admin') {
    $u = requireAdmin();
}
?>
<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Yamzz Market V2</title><link rel="stylesheet" href="/style.css"></head><body>
<header><a class="brand" href="/">YAMZZ <span>MARKET</span></a><nav>
<a href="/">Beranda</a><a href="/?page=transactions">Transaksi</a>
<?php if($u): ?><a href="/?page=account">Akun (<?=money($u['balance'])?>)</a><?php if($u['role']==='admin'): ?><a href="/?page=admin">Admin</a><?php endif; ?><form method="post" class="inline"><button name="action" value="logout">Keluar</button></form>
<?php else: ?><a href="/?page=login">Login</a><?php endif; ?></nav></header>
<main>
<?php if(!empty($error)): ?><div class="alert"><?=h($error)?></div><?php endif; ?>
<?php if($page==='login'): ?>
<section class="panel"><h1>Login</h1><form method="post"><input type="hidden" name="action" value="login"><input name="email" type="email" placeholder="Email" required><input name="password" type="password" placeholder="Password" required><button>Masuk</button></form><p>Belum punya akun? <a href="/?page=register">Daftar</a></p></section>
<?php elseif($page==='register'): ?>
<section class="panel"><h1>Buat Akun</h1><form method="post"><input type="hidden" name="action" value="register"><input name="username" placeholder="Username" required><input name="email" type="email" placeholder="Email" required><input name="password" type="password" placeholder="Password" required><button>Daftar</button></form></section>
<?php elseif($page==='account'): ?>
<section class="hero"><h1>Halo, <?=h($u['username'])?> 👋</h1><p>Saldo tersedia: <b><?=money($u['balance'])?></b></p></section>
<section class="panel"><h2>Top Up Saldo</h2><form method="post"><input type="hidden" name="action" value="topup"><input name="amount" type="number" min="1" placeholder="Nominal"><input name="note" placeholder="Catatan / bukti pembayaran"><button>Ajukan Top Up</button></form></section>
<?php elseif($page==='transactions'): $s=db()->prepare("SELECT t.*,p.title FROM transactions t LEFT JOIN products p ON p.id=t.product_id WHERE t.user_id=? ORDER BY t.id DESC");$s->execute([$u['id']]); ?>
<section class="panel"><h1>Transaksi Saya</h1><?php foreach($s as $t): ?><div class="row"><span><?=h($t['title']??'Top Up')?> · <?=h($t['type'])?></span><b><?=money($t['amount'])?></b></div><?php endforeach; ?></section>
<?php elseif($page==='admin'): $products=db()->query("SELECT id, title, description, price, category, image, status, created_at FROM products ORDER BY id DESC")->fetchAll(); $tops=db()->query("SELECT t.*,u.username FROM topups t JOIN users u ON u.id=t.user_id WHERE t.status='pending' ORDER BY t.id DESC")->fetchAll(); ?>
<section class="hero"><h1>Admin Dashboard</h1><p>Kelola produk dan top up pengguna.</p></section>
<section class="panel"><h2>Tambah Produk</h2><form method="post"><input type="hidden" name="action" value="admin_product"><input name="title" placeholder="Nama produk" required><input name="price" type="number" placeholder="Harga" required><input name="category" placeholder="Kategori" required><input name="image" placeholder="URL gambar"><textarea name="description" placeholder="Deskripsi"></textarea><button>Tambah Produk</button></form></section>
<section class="panel"><h2>Top Up Pending</h2><?php foreach($tops as $t): ?><div class="row"><span><?=h($t['username'])?> · <?=money($t['amount'])?></span><form method="post"><input type="hidden" name="action" value="admin_topup"><input type="hidden" name="topup_id" value="<?=$t['id']?>"><button>Approve</button></form></div><?php endforeach; ?></section>
<section class="panel"><h2>Produk</h2><?php foreach($products as $p): ?><div class="row"><span><?=h(($p['title'] ?? 'Produk'))?></span><span><?=money($p['price'])?> · <?=h(($p['status'] ?? 'ready'))?></span></div><?php endforeach; ?></section>
<?php else: $products=db()->query("SELECT id, title, description, price, category, image, status, created_at FROM products ORDER BY id DESC")->fetchAll(); ?>
<section class="hero"><h1>Marketplace sederhana, siap dikembangkan.</h1><p>Login, saldo, top up, transaksi, dan dashboard admin dalam satu project PHP.</p></section>
<div class="grid"><?php foreach($products as $p): ?><article class="card"><?php if(($p['image'] ?? '')): ?><img src="<?=h(($p['image'] ?? ''))?>" alt=""><?php endif; ?><small><?=h(($p['category'] ?? 'Lainnya'))?></small><h3><?=h(($p['title'] ?? 'Produk'))?></h3><p><?=h($p['description'] ?? '')?></p><strong><?=money($p['price'])?></strong><?php if(($p['status'] ?? 'ready')==='ready'): ?><form method="post"><input type="hidden" name="action" value="buy"><input type="hidden" name="product_id" value="<?=$p['id']?>"><button>Beli dengan Saldo</button></form><?php else: ?><button disabled>SOLD</button><?php endif; ?></article><?php endforeach; ?></div>
<?php endif; ?>
</main></body></html>
