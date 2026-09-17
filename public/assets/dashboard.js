const $ = id => document.getElementById(id);

let merchant = null;

// =========================================================
// API HELPER
// =========================================================

async function get(url, opt = {}) {
    const options = Object.assign({
        credentials: 'include',
        cache: 'no-store'
    }, opt);

    const r = await fetch(url, options);

    const text = await r.text();

    let d;

    try {
        d = JSON.parse(text);
    } catch {
        throw new Error(
            `Response ${r.status} bukan JSON`
        );
    }

    if (!r.ok) {
        throw new Error(
            d.error || `Request gagal (${r.status})`
        );
    }

    return d;
}

// =========================================================
// FORMAT MONEY
// =========================================================

function money(v) {
    return 'Rp' + Number(v || 0)
        .toLocaleString('id-ID');
}

// =========================================================
// STATUS
// =========================================================

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

        console.log('[DASHBOARD] Memeriksa session...');

        // =================================================
        // CEK SESSION
        // =================================================

        const d = await get('/api/me');

        console.log('[DASHBOARD] /api/me:', d);

        /*
         * HANYA redirect ke login jika memang session
         * tidak valid.
         */

        if (
            !d ||
            d.success !== true ||
            !d.merchant
        ) {
            console.warn(
                '[DASHBOARD] Session tidak valid:',
                d
            );

            location.href = '/login.html';
            return;
        }

        merchant = d.merchant;

        console.log(
            '[DASHBOARD] Merchant:',
            merchant
        );

        // =================================================
        // MERCHANT INFO
        // =================================================

        const storeTop = $('storeTop');

        if (storeTop) {
            storeTop.textContent =
                merchant.name ||
                merchant.email ||
                'Merchant';
        }

        const me = $('me');

        if (me) {
            me.innerHTML = `
                <b>${merchant.name || '-'}</b><br>
                ${merchant.email || '-'}<br>
                <span style="color:#777">
                    QRIS:
                    ${merchant.qris_name || 'belum disimpan'}
                    ${merchant.qris_city || ''}
                </span>
            `;
        }

        const key = $('key');

        if (key) {
            key.textContent =
                merchant.api_key ||
                'API key tidak tersedia';
        }

        const qrpayload = $('qrpayload');

        if (qrpayload) {
            qrpayload.value =
                merchant.qris_payload || '';
        }

        // =================================================
        // QR PREVIEW
        // =================================================

        if (
            merchant.qris_payload &&
            typeof QRCode !== 'undefined'
        ) {
            renderQR(
                merchant.qris_payload
            );
        }

        // =================================================
        // LOAD DATA
        // =================================================

        await Promise.all([
            loadProducts(),
            loadTx()
        ]);

        console.log(
            '[DASHBOARD] Dashboard berhasil dimuat'
        );

    } catch (e) {

        console.error(
            '[DASHBOARD] ERROR:',
            e
        );

        /*
         * JANGAN redirect ke login untuk error lain.
         */

        const msg =
            e && e.message
                ? e.message
                : String(e);

        console.error(
            '[DASHBOARD] Detail:',
            msg
        );

        alert(
            'Dashboard gagal dimuat:\n\n' +
            msg
        );
    }
}

// =========================================================
// QR RENDER
// =========================================================

function renderQR(data) {

    const preview = $('qrPreview');

    if (!preview) {
        console.warn(
            '[QR] Element #qrPreview tidak ditemukan'
        );
        return;
    }

    if (
        typeof QRCode === 'undefined' ||
        !QRCode.toCanvas
    ) {
        console.warn(
            '[QR] Library QRCode belum tersedia'
        );
        return;
    }

    const canvas =
        document.createElement('canvas');

    preview.innerHTML = '';

    preview.appendChild(canvas);

    QRCode.toCanvas(
        canvas,
        data,
        {
            width: 145,
            margin: 1
        },
        error => {

            if (error) {
                console.error(
                    '[QR] Gagal membuat QR:',
                    error
                );
            }

        }
    );
}

// =========================================================
// PRODUCTS
// =========================================================

async function loadProducts() {

    try {

        const d =
            await get('/api/products');

        const products =
            d.products || [];

        const sProducts =
            $('sProducts');

        if (sProducts) {
            sProducts.textContent =
                products.length;
        }

        const list =
            $('productsList');

        if (!list) {
            console.warn(
                '[PRODUCTS] #productsList tidak ditemukan'
            );
            return;
        }

        list.innerHTML =
            products.map(p => `
                <div class="product-item">

                    <div>
                        <b style="font-size:12px">
                            ${escapeHTML(p.name || '')}
                        </b>

                        <br>

                        <small>
                            ${money(p.price)}
                        </small>
                    </div>

                    <button
                        class="mini danger"
                        onclick="delProduct('${escapeAttribute(p.id)}')"
                    >
                        Hapus
                    </button>

                </div>
            `).join('') ||
            `
                <p style="font-size:12px;color:#888">
                    Belum ada produk.
                </p>
            `;

    } catch (e) {

        console.error(
            '[PRODUCTS] ERROR:',
            e
        );

        throw e;
    }
}

// =========================================================
// DELETE PRODUCT
// =========================================================

async function delProduct(id) {

    try {

        await get(
            '/api/products?id=' +
            encodeURIComponent(id),
            {
                method: 'DELETE'
            }
        );

        await loadProducts();

    } catch (e) {

        alert(
            e.message ||
            'Gagal menghapus produk'
        );
    }
}

// =========================================================
// TRANSACTIONS
// =========================================================

async function loadTx() {

    try {

        const d =
            await get('/api/transactions');

        const t =
            d.transactions || [];

        const total =
            $('sTotal');

        if (total) {
            total.textContent =
                t.length;
        }

        const paid =
            $('sPaid');

        if (paid) {
            paid.textContent =
                t.filter(
                    x => x.status === 'paid'
                ).length;
        }

        const pending =
            $('sPending');

        if (pending) {
            pending.textContent =
                t.filter(
                    x => x.status === 'pending'
                ).length;
        }

        const tx =
            $('tx');

        if (!tx) {
            console.warn(
                '[TX] #tx tidak ditemukan'
            );
            return;
        }

        tx.innerHTML =
            t.map(x => `
                <tr>

                    <td>
                        <b>
                            ${escapeHTML(
                                x.order_id || '-'
                            )}
                        </b>
                    </td>

                    <td>
                        ${money(x.amount)}
                    </td>

                    <td>
                        ${status(x.status)}
                    </td>

                    <td>
                        ${
                            x.created_at
                                ? new Date(
                                    x.created_at
                                ).toLocaleString(
                                    'id-ID'
                                )
                                : '-'
                        }
                    </td>

                </tr>
            `).join('') ||

            `
                <tr>
                    <td
                        colspan="4"
                        style="color:#888"
                    >
                        Belum ada transaksi.
                    </td>
                </tr>
            `;

    } catch (e) {

        console.error(
            '[TX] ERROR:',
            e
        );

        throw e;
    }
}

// =========================================================
// ADD PRODUCT
// =========================================================

const pf = $('pf');

if (pf) {

    pf.onsubmit = async e => {

        e.preventDefault();

        try {

            await get(
                '/api/products',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify(
                        Object.fromEntries(
                            new FormData(pf)
                        )
                    )
                }
            );

            pf.reset();

            await loadProducts();

        } catch (e) {

            alert(
                e.message ||
                'Gagal menambahkan produk'
            );
        }
    };

}

// =========================================================
// SAVE QRIS
// =========================================================

const saveButton = $('save');

if (saveButton) {

    saveButton.onclick = async () => {

        const qrpayload =
            $('qrpayload');

        if (!qrpayload) {
            alert(
                'Input QRIS tidak ditemukan'
            );
            return;
        }

        const payload =
            qrpayload.value.trim();

        if (!payload) {
            alert(
                'QRIS belum diisi'
            );
            return;
        }

        try {

            const d =
                await get(
                    '/api/qris-save',
                    {
                        method: 'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body: JSON.stringify({
                            qris_payload:
                                payload
                        })
                    }
                );

            const qrinfo =
                $('qrinfo');

            if (qrinfo) {
                qrinfo.textContent =
                    JSON.stringify(
                        d.qris,
                        null,
                        2
                    );
            }

            renderQR(payload);

            alert(
                'QRIS berhasil disimpan'
            );

            await load();

        } catch (e) {

            alert(
                e.message ||
                'Gagal menyimpan QRIS'
            );
        }
    };

}

// =========================================================
// DECODE QR IMAGE
// =========================================================

const decodeButton =
    $('decode');

if (decodeButton) {

    decodeButton.onclick = () => {

        const fileInput =
            $('qrfile');

        if (!fileInput) {
            alert(
                'Input gambar QRIS tidak ditemukan'
            );
            return;
        }

        const f =
            fileInput.files[0];

        if (!f) {
            alert(
                'Pilih gambar QRIS dulu'
            );
            return;
        }

        if (
            typeof jsQR === 'undefined'
        ) {
            alert(
                'Library jsQR belum dimuat'
            );
            return;
        }

        const img =
            new Image();

        const c =
            document.createElement(
                'canvas'
            );

        const x =
            c.getContext('2d');

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

            const imageData =
                x.getImageData(
                    0,
                    0,
                    c.width,
                    c.height
                );

            const r =
                jsQR(
                    imageData.data,
                    imageData.width,
                    imageData.height,
                    {
                        inversionAttempts:
                            'attemptBoth'
                    }
                );

            if (!r) {
                alert(
                    'QR tidak terbaca. Coba gambar yang lebih jelas.'
                );
                return;
            }

            const qrpayload =
                $('qrpayload');

            if (qrpayload) {
                qrpayload.value =
                    r.data;
            }

            renderQR(r.data);

            alert(
                'QR berhasil dibaca. Klik Simpan QRIS.'
            );

            URL.revokeObjectURL(
                img.src
            );
        };

        img.onerror = () => {

            alert(
                'Gagal membaca gambar QRIS'
            );

        };

        img.src =
            URL.createObjectURL(f);
    };

}

// =========================================================
// LOGOUT
// =========================================================

const logout =
    $('logout');

if (logout) {

    logout.onclick = async () => {

        try {

            await fetch(
                '/api/logout',
                {
                    method: 'POST',
                    credentials: 'include',
                    cache: 'no-store'
                }
            );

        } catch (e) {

            console.error(
                '[LOGOUT] ERROR:',
                e
            );

        } finally {

            location.href =
                '/login.html';

        }
    };

}

// =========================================================
// HTML ESCAPE
// =========================================================

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttribute(value) {

    return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
}

// =========================================================
// START
// =========================================================

load();
