const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// Middleware សម្រាប់អានទិន្នន័យ JSON និងឯកសារ Static ពី public 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// =========================================================================
// ⚙️ ផ្នែកកំណត់រចនាសម្ព័ន្ធ API (CONFIGURATION SECTION)
// =========================================================================

// ១. ព័ត៌មានគណនី ABA PAYWAY API
const ABA_CONFIG = {
    API_URL: 'https://checkout.ababank.com/api/payment-gateway/v1/payments/purchase', 
    MERCHANT_ID: 'https://link.payway.com.kh/ABAPAYUo468330o',  
    API_KEY: 'ak_83a65343a71de372c5f97f37c7b7a03be93d4ac4f123b987'           
};

// ២. ព័ត៌មានគណនី RESELLER GAME API (ម៉ូយបុកហ្គេមរបស់អ្នក)
const RESELLER_CONFIG = {
    API_URL: 'https://api.supplier.com/v1/order', 
    API_KEY: '0d38b7cc6876ca4e4c46c4d0dbbfa15c5f058cc053e67a0f6b6ee675dad7ba39',             
    MERCHANT_ID: 'https://api.g2bulk.com/v1'      
};

// =========================================================================
// 🛠️ មុខងារជំនួយ (HELPER FUNCTIONS)
// =========================================================================

const readOrders = () => {
    if (!fs.existsSync(DB_FILE)) return [];
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data || '[]');
};

const writeOrders = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
};

// បង្កើតកូដសម្ងាត់ Hash ផ្ញើទៅ ABA (តាមច្បាប់សុវត្ថិភាព ABA PayWay)
function createAbaHash(req_time, tran_id, amount, items, firstname, lastname, email, phone, type, payment_option) {
    let fields = req_time + ABA_CONFIG.MERCHANT_ID + tran_id + amount + items + firstname + lastname + email + phone + type + payment_option;
    return crypto.createHmac('sha512', ABA_CONFIG.API_KEY).update(fields).digest('base64');
}

// =========================================================================
// 🤖 មុខងាររត់ទៅបុកហ្គេមស្វ័យប្រវត្ត (RESELLER AUTO-BUY API CALL)
// =========================================================================
async function autoDeliverDiamond(order) {
    console.log(`🤖 [API RESELLER] កំពុងរត់ទៅបញ្ជាទិញកញ្ចប់ ${order.diamond} សម្រាប់ ID: ${order.playerId}...`);

    const requestBody = {
        api_key: RESELLER_CONFIG.API_KEY,
        merchant_id: RESELLER_CONFIG.MERCHANT_ID,
        game: order.game,
        user_id: order.playerId,
        zone_id: order.zoneId === 'N/A' ? '' : order.zoneId,
        product_id: order.diamond 
    };

    try {
        const response = await fetch(RESELLER_CONFIG.API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESELLER_CONFIG.API_KEY}` 
            },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();
        console.log('📦 លទ្ធផលតបពីម៉ូយបុកហ្គេម៖', result);

        if (result.status === 'success' || result.success === true || result.code === 200) {
            console.log(`✅ [SUCCESS] បុកហ្គេមចូលគណនីភ្ញៀវ ID: ${order.playerId} ជោគជ័យហើយ!`);
            return true;
        } else {
            throw new Error(result.message || 'SupplierRejectedOrder');
        }
    } catch (error) {
        console.error('❌ បរាជ័យក្នុងការហៅទៅ API Reseller៖', error.message);
        throw error; 
    }
}

// =========================================================================
// 🌐 ផ្នែកអាសយដ្ឋាន API (ROUTE ENDPOINTS)
// =========================================================================

// ១. API: បង្កើតការកុម្ម៉ង់ និងទាក់ទងទៅ ABA ដើម្បីសុំ Dynamic KHQR
app.post('/api/orders/create', async (req, res) => {
    const orders = readOrders();
    const { game, playerId, zoneId, diamond, price } = req.body;

    const orderId = 'ORD' + Math.floor(100000 + Math.random() * 900000); 
    const amount = parseFloat(price.replace('$', '')); 
    const req_time = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14); 

    const abaHash = createAbaHash(req_time, orderId, amount, '', 'Pharath', 'Customer', '', '', 'purchase', 'abapay_khqr');

    try {
        /* // កូដប្រើប្រាស់ពិតប្រាកដជាមួយ ABA API
        const abaResponse = await fetch(ABA_CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                merchant_id: ABA_CONFIG.MERCHANT_ID,
                tran_id: orderId,
                amount: amount,
                req_time: req_time,
                hash: abaHash,
                payment_option: 'abapay_khqr'
            })
        });
        const abaData = await abaResponse.json();
        */

        const newOrder = {
            id: orderId,
            game, playerId, zoneId: zoneId || 'N/A', diamond, price,
            status: 'Pending', 
            createdAt: new Date().toLocaleString('kh-KH')
        };

        orders.push(newOrder);
        writeOrders(orders);

        res.json({ 
            success: true, 
            order: newOrder,
            abaQrCode: null // ជំនួសដោយ abaData.qr_image ពេលដាក់ប្រព័ន្ធពិត
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'មានបញ្ហាខុសបច្ចេកទេសជាមួយ ABA API' });
    }
});

// ២. API: សម្រាប់ឱ្យ Frontend ឆែកមើលស្ថានភាពលុយរាល់ ២ វិនាទី (Polling)
app.get('/api/orders/status/:id', (req, res) => {
    const orders = readOrders();
    const order = orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ message: 'រកមិនឃើញការកុម្ម៉ង់នេះទេ' });
    res.json({ status: order.status });
});

// ៣. API: ទាញយកប្រវត្តិការកុម្ម៉ង់ទាំងអស់បង្ហាញលើតារាង
app.get('/api/orders', (req, res) => {
    res.json(readOrders());
});

// ៤. 🔍 API: សម្រាប់ផ្ទៀងផ្ទាត់ឈ្មោះគណនីហ្គេម (VERIFY ACCOUNT - បន្ថែមថ្មី)
app.post('/api/games/verify', async (req, res) => {
    try {
        const { game, playerId, zoneId } = req.body;

        if (!game || !playerId) {
            return res.status(400).json({ success: false, message: 'សូមបញ្ចូលព័ត៌មានឱ្យបានគ្រប់គ្រាន់!' });
        }

        let nickname = '';

        // 💡 កូដគំរូសម្រាប់តេស្តសាកល្បង បងអាចកែច្នៃ ឬភ្ជាប់ទៅ API ក្រៅបានតាមចិត្ត
        if (game === 'Mobile Legends') {
            if (playerId === '12345678' && zoneId === '1234') {
                nickname = 'FONG_MLBB_🔥';
            } else {
                nickname = `MLBB_Player_${playerId}`;
            }
        } else if (game === 'PUBG Mobile') {
            nickname = `PUBG_User_${playerId}`;
        } else if (game === 'Free Fire') {
            nickname = `FF_Gamer_${playerId}`;
        } else {
            nickname = `Gamer_${playerId}`;
        }

        return res.json({ success: true, nickname: nickname });

    } catch (error) {
        return res.status(500).json({ success: false, message: 'មានបញ្ហាខាងក្នុង Server ក្នុងការឆែកឈ្មោះ!' });
    }
});

// ៥. 🔥 WEBHOOK ENDPOINT: ទទួលដំណឹងពី ABA ភ្លាមៗពេលភ្ញៀវស្កែនលុយរួច រួចរត់ទៅបុកហ្គេមស្វ័យប្រវត្តិ (បន្ថែមថ្មី)
app.post('/api/aba/webhook', async (req, res) => {
    console.log('📥 [ABA WEBHOOK] ទទួលបានទិន្នន័យបង់ប្រាក់ថ្មីពី ABA៖', req.body);

    // ចាប់យកលេខ ID នៃការបញ្ជាទិញ និងស្ថានភាពផ្ញើពី ABA (ABA ច្រើនផ្ញើមកជា status ឬ status=0 ជោគជ័យ)
    const { tran_id, status } = req.body; 

    const orders = readOrders();
    const orderIndex = orders.findIndex(o => o.id === tran_id);

    if (orderIndex === -1) {
        return res.status(404).send('Order Not Found');
    }

    const order = orders[orderIndex];

    // ការពារកុំឱ្យ Webhook រត់ជាន់គ្នា បើកូដកំពុងដើរ ឬរួចរាល់ហើយ មិនបាច់ធ្វើទៀតទេ
    if (order.status === 'Processing' || order.status === 'Completed') {
        return res.status(200).send('OK');
    }

    // ពិនិត្យមើលថាតើការបង់ប្រាក់ពិតជាជោគជ័យមែនអត់ (តាមបច្ចេកទេស ABA លេខ 0 គឺជោគជ័យ)
    if (status === '0' || status === 0 || req.body.status === 'Approved') {
        
        // កែប្រែស្ថានភាពទៅជា កំពុងបុកហ្គេម (Processing) ដើម្បីឱ្យផ្ទាំង Frontend ដូរពណ៌លឿង
        orders[orderIndex].status = 'Processing';
        writeOrders(orders);

        try {
            // 🤖 ហៅអនុគមន៍ឱ្យរត់ទៅបញ្ជាទិញនៅម៉ូយបុកហ្គេម
            const deliverySuccess = await autoDeliverDiamond(order);

            if (deliverySuccess) {
                orders[orderIndex].status = 'Completed'; // បើជោគជ័យ ដូរជា Completed
            } else {
                orders[orderIndex].status = 'Failed';    // បើម៉ូយបដិសេធ ដូរជា Failed
            }
        } catch (error) {
            orders[orderIndex].status = 'Failed';        // បើដាច់ Internet ដូរជា Failed
        }

        // រក្សាទុកស្ថានភាពចុងក្រោយចូល Database
        writeOrders(orders);
        return res.status(200).send('OK');
    } else {
        // ករណីភ្ញៀវមិនបានបង់ប្រាក់ ឬការបង់ប្រាក់បរាជ័យ
        orders[orderIndex].status = 'Failed';
        writeOrders(orders);
        return res.status(200).send('Payment Failed');
    }
});

// ដំណើរការ Server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
