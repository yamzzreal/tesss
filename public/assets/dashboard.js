const $ = id => document.getElementById(id);

let merchant;

// =========================================================
// AUTH
// =========================================================

function getApiKey() {
    return localStorage.getItem('merchant_api_key');
}

function saveMerchant(data) {
    if (data.merchant) {
        localStorage.setItem(
            'merchant',
            JSON.stringify(data.merchant)
        );
    }

    if (data.api_key) {
        localStorage.setItem(
            'merchant_api_key',
            data.api_key
        );
    }
}

function getMerchant() {
    try {
        return JSON.parse(
            localStorage.getItem('merchant') || 'null'
        );
    } catch {
        return null;
    }
}

function logout() {
    localStorage.removeItem('merchant');
    localStorage.removeItem('merchant_api_key');

    location.href = '/login.html';
}


// =========================================================
// API REQUEST
// =========================================================

async function get(url, opt = {}) {

    const apiKey = getApiKey();

    if (!apiKey) {
        logout();
        throw Error('Belum login');
    }

    const options = {
        ...opt,
        headers: {
            ...(opt.headers || {}),
            'Authorization': `Bearer ${apiKey}`
        }
    };

    const r = await fetch(url, options);

    let d;

    try {
        d = await r.json();
    } catch {
        throw Error('Response server tidak valid');
    }

    // Token sudah tidak valid
    if (r.status === 401) {
        logout();
        throw Error(d.error || 'Login sudah tidak valid');
    }

    if (!r.ok) {
        throw Error(d.error || 'Request failed');
    }

    return d;
}


// =========================================================
// HELPER
// =========================================================

function money(v) {
    return 'Rp' + Number(v || 0).toLocaleString('id-ID');
}

function status(s) {
    const c =
        s === 'paid'
            ? 'paid'
            : s === 'pending'
            ? 'pending'
            : s === 'expired'
            ? 'expired'
            : 'cancel';

    return `<span class="pill ${c}">${s}</span>`;
}


// =========================================================
// LOAD DASHBOARD
// =========================================================

async function load() {

    try {

        const d = await get('/api/me');

        merchant = d.merchant;

        // Simpan data merchant terbaru
        saveMerchant({
            merchant: d.merchant,
            api_key: d.api_key
        });

        $('storeTop').textContent =
            merchant.name || merchant.email;

        $('me').innerHTML = `
            <b>${merchant.name || ''}</b><br>
            ${merchant.email || ''}<br>
            <span style="color:#777">
                QRIS:
                ${merchant.qris_name || 'belum disimpan'}
                ${merchant.qris_city || ''}
            </span>
        `;

        $('key').textContent =
            merchant.api_key || getApiKey() || 'API key tidak tersedia';

        $('qrpayload').value =
            merchant.qris_payload || '';

        if (merchant.qris_payload) {
            renderQR(merchant.qris_payload);
        }

        await Promise.all([
            loadProducts(),
            loadTx()
        ]);

    } catch (e) {

        console.error('LOAD ERROR:', e);

        // get() sudah menangani 401
        if (getApiKey()) {
            alert(e.message);
        }

        logout();
    }
}


// =========================================================
// QR
// =========================================================

function renderQR(data) {

    const canvas = document.createElement('canvas');

    $('qrPreview').innerHTML = '';

    $('qrPreview').appendChild(canvas);

    QRCode.toCanvas(
        canvas,
        data,
        {
            width: 145,
            margin: 1
        },
        () => {}
    );
}


// =========================================================
// PRODUCTS
// =========================================================

async function loadProducts() {

    const d = await get('/api/products');

    $('sProducts').textContent =
        d.products.length;

    $('productsList').innerHTML =
        d.products.map(p => `
            <div class="product-item">
                <div>
                    <b style="font-size:12px">
                        ${p.name}
                    </b>
                    <br>
                    <small>
                        ${money(p.price)}
                    </small>
                </div>

                <button
                    class="mini danger"
                    onclick="delProduct('${p.id}')"
                >
                    Hapus
                </button>
            </div>
        `).join('') ||
        '<p style="font-size:12px;color:#888">Belum ada produk.</p>';
}


async function delProduct(id) {

    try {

        await get(
            '/api/products?id=' +
            encodeURIComponent(id),
            {
                method: 'DELETE'
            }
        );

        loadProducts();

    } catch (e) {
        alert(e.message);
    }
}


// =========================================================
// TRANSACTIONS
// =========================================================

async function loadTx() {

    const d = await get('/api/transactions');

    const t = d.transactions || [];

    $('sTotal').textContent = t.length;

    $('sPaid').textContent =
        t.filter(x => x.status === 'paid').length;

    $('sPending').textContent =
        t.filter(x => x.status === 'pending').length;

    $('tx').innerHTML =
        t.map(x => `
            <tr>
                <td>
                    <b>${x.order_id}</b>
                </td>

                <td>
                    ${money(x.amount)}
                </td>

                <td>
                    ${status(x.status)}
                </td>

                <td>
                    ${new Date(
                        x.created_at
                    ).toLocaleString('id-ID')}
                </td>
            </tr>
        `).join('') ||
        `
            <tr>
                <td colspan="4" style="color:#888">
                    Belum ada transaksi.
                </td>
            </tr>
        `;
}


// =========================================================
// ADD PRODUCT
// =========================================================

$('pf').onsubmit = async e => {

    e.preventDefault();

    try {

        await get('/api/products', {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify(
                Object.fromEntries(
                    new FormData($('pf'))
                )
            )
        });

        $('pf').reset();

        loadProducts();

    } catch (e) {

        alert(e.message);
    }
};


// =========================================================
// SAVE QRIS
// =========================================================

$('save').onclick = async () => {

    try {

        const d = await get('/api/qris-save', {

            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({
                qris_payload:
                    $('qrpayload').value
            })
        });

        $('qrinfo').textContent =
            JSON.stringify(
                d.qris,
                null,
                2
            );

        renderQR(
            $('qrpayload').value
        );

        await load();

    } catch (e) {

        alert(e.message);
    }
};


// =========================================================
// DECODE QR IMAGE
// =========================================================

$('decode').onclick = () => {

    const f = $('qrfile').files[0];

    if (!f) {
        return alert(
            'Pilih gambar QRIS dulu'
        );
    }

    const img = new Image();

    const c = document.createElement('canvas');

    const x = c.getContext('2d');

    img.onload = () => {

        const scale =
            Math.min(
                1600 / img.width,
                1600 / img.height,
                1
            );

        c.width =
            img.width * scale;

        c.height =
            img.height * scale;

        x.drawImage(
            img,
            0,
            0,
            c.width,
            c.height
        );

        const d =
            x.getImageData(
                0,
                0,
                c.width,
                c.height
            );

        const r = jsQR(
            d.data,
            d.width,
            d.height,
            {
                inversionAttempts:
                    'attemptBoth'
            }
        );

        if (!r) {
            return alert(
                'QR tidak terbaca. Coba gambar yang lebih jelas.'
            );
        }

        $('qrpayload').value =
            r.data;

        renderQR(r.data);

        alert(
            'QR berhasil dibaca. Klik Simpan QRIS.'
        );
    };

    img.src =
        URL.createObjectURL(f);
};


// =========================================================
// LOGOUT
// =========================================================

$('logout').onclick = () => {
    logout();
};


// =========================================================
// START
// =========================================================

load();
