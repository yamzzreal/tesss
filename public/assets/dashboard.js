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

            'Authorization':
                `Bearer ${apiKey}`
        }
    };


    const r = await fetch(
        url,
        options
    );


    let d;

    try {

        d = await r.json();

    } catch {

        throw Error(
            'Response server tidak valid'
        );
    }


    // Token tidak valid
    if (r.status === 401) {

        localStorage.removeItem(
            'merchant'
        );

        localStorage.removeItem(
            'merchant_api_key'
        );

        location.href = '/login.html';

        throw Error(
            d.error ||
            'Login sudah tidak valid'
        );
    }


    if (!r.ok) {

        throw Error(
            d.error ||
            'Request failed'
        );
    }


    return d;
}


// =========================================================
// HELPER
// =========================================================

function money(v) {

    return 'Rp' +
        Number(v || 0)
            .toLocaleString('id-ID');
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


    return `
        <span class="pill ${c}">
            ${s}
        </span>
    `;
}


// =========================================================
// LOAD DASHBOARD
// =========================================================

async function load() {

    try {

        const d =
            await get('/api/me');


        merchant =
            d.merchant;


        // Simpan merchant terbaru
        saveMerchant({

            merchant:
                d.merchant,

            api_key:
                d.api_key ||
                getApiKey()

        });


        // Nama merchant
        if ($('storeTop')) {

            $('storeTop').textContent =
                merchant.name ||
                merchant.email ||
                'Merchant';
        }


        // Informasi merchant
        if ($('me')) {

            $('me').innerHTML = `
                <b>
                    ${merchant.name || ''}
                </b>
                <br>

                ${merchant.email || ''}

                <br>

                <span style="color:#777">
                    QRIS:
                    ${merchant.qris_name || 'belum disimpan'}
                    ${merchant.qris_city || ''}
                </span>
            `;
        }


        // API key
        if ($('key')) {

            $('key').textContent =
                merchant.api_key ||
                getApiKey() ||
                'API key tidak tersedia';
        }


        // QR payload
        if ($('qrpayload')) {

            $('qrpayload').value =
                merchant.qris_payload || '';
        }


        // Render QR yang sudah tersimpan
        if (
            merchant.qris_payload &&
            $('qrPreview')
        ) {

            renderQR(
                merchant.qris_payload
            );
        }


        await Promise.all([
            loadProducts(),
            loadTx()
        ]);


    } catch (e) {

        console.error(
            'LOAD ERROR:',
            e
        );


        /*
         * Jangan langsung logout untuk
         * semua jenis error.
         *
         * Kalau API key masih ada,
         * tampilkan error supaya mudah
         * mengetahui endpoint mana yang
         * bermasalah.
         */

        if (getApiKey()) {

            console.error(
                'Dashboard error:',
                e.message
            );

            alert(e.message);

            return;
        }


        logout();
    }
}


// =========================================================
// QR RENDER
// =========================================================

function renderQR(data) {

    if (!data) {
        return;
    }


    const preview =
        $('qrPreview');


    if (!preview) {
        return;
    }


    const canvas =
        document.createElement('canvas');


    preview.innerHTML = '';


    preview.appendChild(
        canvas
    );


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
                    'QR RENDER ERROR:',
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

    const d =
        await get('/api/products');


    const products =
        d.products || [];


    if ($('sProducts')) {

        $('sProducts').textContent =
            products.length;
    }


    if (!$('productsList')) {
        return;
    }


    $('productsList').innerHTML =
        products.map(p => `

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

        `
            <p
                style="font-size:12px;color:#888"
            >
                Belum ada produk.
            </p>
        `;
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


        await loadProducts();

    } catch (e) {

        alert(
            e.message
        );
    }
}


// =========================================================
// TRANSACTIONS
// =========================================================

async function loadTx() {

    const d =
        await get('/api/transactions');


    const t =
        d.transactions || [];


    if ($('sTotal')) {

        $('sTotal').textContent =
            t.length;
    }


    if ($('sPaid')) {

        $('sPaid').textContent =
            t.filter(
                x => x.status === 'paid'
            ).length;
    }


    if ($('sPending')) {

        $('sPending').textContent =
            t.filter(
                x => x.status === 'pending'
            ).length;
    }


    if (!$('tx')) {
        return;
    }


    $('tx').innerHTML =

        t.map(x => `

            <tr>

                <td>
                    <b>
                        ${x.order_id}
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
                        new Date(
                            x.created_at
                        ).toLocaleString(
                            'id-ID'
                        )
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
}


// =========================================================
// ADD PRODUCT
// =========================================================

if ($('pf')) {

    $('pf').onsubmit =
        async e => {

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

                        body:
                            JSON.stringify(
                                Object.fromEntries(
                                    new FormData(
                                        $('pf')
                                    )
                                )
                            )
                    }
                );


                $('pf').reset();


                await loadProducts();


            } catch (e) {

                alert(
                    e.message
                );
            }
        };
}


// =========================================================
// SAVE QRIS
// =========================================================

if ($('save')) {

    $('save').onclick =
        async () => {

            try {

                const payload =
                    String(
                        $('qrpayload').value ||
                        ''
                    ).trim();


                if (!payload) {

                    return alert(
                        'QRIS payload masih kosong.'
                    );
                }


                console.log(
                    'SAVING QRIS PAYLOAD:',
                    payload
                );


                const d =
                    await get(
                        '/api/qris-save',
                        {
                            method: 'POST',

                            headers: {
                                'Content-Type':
                                    'application/json'
                            },

                            body:
                                JSON.stringify({
                                    qris_payload:
                                        payload
                                })
                        }
                    );


                if ($('qrinfo')) {

                    $('qrinfo').textContent =
                        JSON.stringify(
                            d.qris,
                            null,
                            2
                        );
                }


                renderQR(
                    payload
                );


                alert(
                    'QRIS berhasil disimpan.'
                );


                await load();


            } catch (e) {

                console.error(
                    'SAVE QRIS ERROR:',
                    e
                );

                alert(
                    e.message
                );
            }
        };
}


// =========================================================
// DECODE QR IMAGE
// =========================================================

if ($('decode')) {

    $('decode').onclick =
        () => {

            const f =
                $('qrfile').files[0];


            if (!f) {

                return alert(
                    'Pilih gambar QRIS dulu.'
                );
            }


            const img =
                new Image();


            const c =
                document.createElement(
                    'canvas'
                );


            const x =
                c.getContext(
                    '2d',
                    {
                        willReadFrequently:
                            true
                    }
                );


            if (!x) {

                return alert(
                    'Browser tidak mendukung pembacaan gambar.'
                );
            }


            img.onload =
                () => {

                    try {

                        /*
                         * Batasi maksimal
                         * 1600px agar proses
                         * tidak terlalu berat.
                         */

                        const scale =
                            Math.min(
                                1600 / img.width,
                                1600 / img.height,
                                1
                            );


                        c.width =
                            Math.round(
                                img.width *
                                scale
                            );


                        c.height =
                            Math.round(
                                img.height *
                                scale
                            );


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

                            return alert(
                                'QR tidak terbaca.\n\n' +
                                'Coba gunakan screenshot/foto QRIS yang lebih jelas dan pastikan seluruh QR terlihat.'
                            );
                        }


                        /*
                         * Payload hasil scan
                         */

                        const payload =
                            String(
                                r.data || ''
                            ).trim();


                        console.log(
                            '================================='
                        );

                        console.log(
                            'QRIS PAYLOAD:',
                            payload
                        );

                        console.log(
                            'QRIS PAYLOAD LENGTH:',
                            payload.length
                        );

                        console.log(
                            'QRIS TYPE:',
                            typeof payload
                        );

                        console.log(
                            '================================='
                        );


                        if (!payload) {

                            return alert(
                                'QR berhasil dibaca tetapi payload kosong.'
                            );
                        }


                        if (
                            payload.length < 20
                        ) {

                            console.warn(
                                'Payload QR terlalu pendek:',
                                payload
                            );

                            return alert(
                                'QR terbaca, tetapi data QR terlalu pendek untuk QRIS.\n\n' +
                                'Panjang data: ' +
                                payload.length +
                                ' karakter.'
                            );
                        }


                        /*
                         * Masukkan payload
                         * ke textarea/input.
                         */

                        if ($('qrpayload')) {

                            $('qrpayload').value =
                                payload;
                        }


                        /*
                         * Render ulang QR
                         */

                        renderQR(
                            payload
                        );


                        alert(
                            'QR berhasil dibaca.\n\n' +
                            'Panjang payload: ' +
                            payload.length +
                            ' karakter.\n\n' +
                            'Silakan klik "Simpan QRIS".'
                        );


                    } catch (error) {

                        console.error(
                            'QR DECODE ERROR:',
                            error
                        );

                        alert(
                            'Terjadi kesalahan saat membaca QR.'
                        );
                    }

                };


            img.onerror =
                () => {

                    alert(
                        'Gambar QRIS gagal dibuka.'
                    );
                };


            img.src =
                URL.createObjectURL(f);
        };
}


// =========================================================
// LOGOUT
// =========================================================

if ($('logout')) {

    $('logout').onclick =
        () => {

            logout();
        };
}


// =========================================================
// START
// =========================================================

load();
