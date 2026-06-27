const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// =========================================================================
// ⚙️ ផ្នែកកំណត់រចនាសម្ព័ន្ធ API (CONFIGURATION SECTION)
// =========================================================================

// ១. ព័ត៌មានគណនី ABA PAYWAY API
const ABA_CONFIG = {
    API_URL: 'https://checkout.ababank.com/api/payment-gateway/v1/payments/purchase', 
    MERCHANT_ID: process.env.ABA_MERCHANT_ID || 'YOUR_ABA_MERCHANT_ID', 
    API_KEY: process.env.ABA_API_KEY || 'YOUR_ABA_API_KEY'
};

// ២. ព័ត៌មានគណនី G2BULK RESELLER API
const G2BULK_CONFIG = {
    BASE_URL: 'https://api.g2bulk.com/v1',
    API_KEY: '0d38b7cc6876ca4e4c46c4d0dbbfa15c5f058cc053e67a0f6b6ee675dad7ba39' // API Key ពិតរបស់បង
};

// =========================================================================
// 🛠️ មុខងារជំនួយ (HELPER FUNCTIONS)
// =========================================================================

const readOrders = () => {
    if (!fs.existsSync(DB_FILE)) return [];
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (e) { return []; }
};

const writeOrders = (data) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('⚠️ Database local write status:', error.message);
    }
};

// មុខងារបម្លែងឈ្មោះហ្គេមពី Frontend ទៅជា Code របស់ G2Bulk
function filterGameCode(gameName) {
    if (!gameName) return '';
    const name = gameName.toLowerCase().trim();
    if (name.includes('mobile legends') || name.includes('mlbb')) return 'mlbb';
    if (name.includes('pubg')) return 'pubg_mobile';
    if (name.includes('free fire') || name.includes('ff')) return 'free_fire';
    return name.replace(' ', '_');
}

function createAbaHash(req_time, tran_id, amount, items, firstname, lastname, email, phone, type, payment_option) {
    let fields = req_time + ABA_CONFIG.MERCHANT_ID + tran_id + amount + items + firstname + lastname + email + phone + type + payment_option;
    return crypto.createHmac('sha512', ABA_CONFIG.API_KEY).update(fields).digest('base64');
}

// =========================================================================
// 🤖 មុខងាររត់ទៅបុកហ្គេមស្វ័យប្រវត្តតាម G2BULK API
// =========================================================================
async function autoDeliverDiamond(order) {
    const gameCode = filterGameCode(order.game);
    const url = `${G2BULK_CONFIG.BASE_URL}/games/${gameCode}/order`;

    // 🛠️ ជម្រះទិន្នន័យ Zone ID ឱ្យស្អាតមុននឹងផ្ញើទៅបុកលុយហ្គេម
    let cleanZoneId = order.zoneId ? order.zoneId.toString().trim() : '';
    if (
        cleanZoneId.toLowerCase() === 'n/a' || 
        cleanZoneId.toLowerCase() === 'null' || 
        cleanZoneId.toLowerCase() === 'undefined' ||
        gameCode !== 'mlbb' // បើមិនមែន Mobile Legends គឺមិនត្រូវការ Zone ID ឡើយ
    ) {
        cleanZoneId = '';
    }

    console.log(`🤖 [G2BULK] កំពុងកុម្ម៉ង់កញ្ចប់ "${order.diamond}" សម្រាប់ ID: ${order.playerId} | Zone: "${cleanZoneId}"...`);

    const requestBody = {
        catalogue_name: order.diamond, 
        player_id: order.playerId,
        server_id: cleanZoneId,
        charname: 'Customer', 
        remark: `Order ${order.id}`, 
        callback_url: `https://${process.env.VERCEL_URL || 'pharath3.vercel.app'}/api/reseller/webhook` 
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-API-Key': G2BULK_CONFIG.API_KEY 
            },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();
        console.log('📦 លទ្ធផលតបពី G2Bulk ពេលកុម្ម៉ង់៖', result);

        if (result.success === true) {
            console.log(`⏳ [PENDING] G2Bulk បានទទួលការបញ្ជាទិញហើយ កំពុងដំណើរការ...`);
            return true;
        } else {
            throw new Error(result.message || 'G2BulkRejected');
        }
    } catch (error) {
        console.error('❌ បរាជ័យក្នុងការតភ្ជាប់ទៅ G2Bulk API៖', error.message);
        throw error; 
    }
}

// =========================================================================
// 🌐 ផ្នែកអាសយដ្ឋាន API (ROUTE ENDPOINTS)
// =========================================================================

// ១. 🔍 API ផ្ទៀងផ្ទាត់ឈ្មោះគណនីហ្គេមពិតៗពី G2Bulk (គាំទ្រគ្រប់ហ្គេម ១០០%)
app.post('/api/games/verify', async (req, res) => {
    try {
        const { game, playerId, zoneId } = req.body;

        if (!game || !playerId) {
            return res.status(400).json({ success: false, message: 'សូមបញ្ចូលព័ត៌មានឱ្យបានគ្រប់គ្រាន់!' });
        }

        const gameCode = filterGameCode(game);

        // 🛠️ ជម្រះទិន្នន័យ Zone ID ឱ្យស្អាតដាច់ខាតសម្រាប់ PUBG នឹង Free Fire កុំឱ្យ G2Bulk បដិសេធ
        let cleanZoneId = zoneId ? zoneId.toString().trim() : '';
        if (
            cleanZoneId.toLowerCase() === 'n/a' || 
            cleanZoneId.toLowerCase() === 'null' || 
            cleanZoneId.toLowerCase() === 'undefined' ||
            gameCode !== 'mlbb' // បើមិនមែន Mobile Legends គឺដក Zone ចោលទាំងអស់
        ) {
            cleanZoneId = '';
        }

        console.log(`🔍 ឆែកឈ្មោះទៅ G2Bulk -> ហ្គេម: ${gameCode} | ID: ${playerId} | Zone: "${cleanZoneId}"`);

        const response = await fetch(`${G2BULK_CONFIG.BASE_URL}/games/checkPlayerId`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': G2BULK_CONFIG.API_KEY
            },
            body: JSON.stringify({
                game: gameCode,
                user_id: playerId,
                server_id: cleanZoneId, 
                charname: 'check'
            })
        });

        const result = await response.json();
        console.log('📦 លទ្ធផលឆ្លើយតបឆែកឈ្មោះពី G2Bulk:', result);

        if (result.valid === 'valid' || result.name) {
            return res.json({ success: true, nickname: result.name });
        } else {
            return res.status(400).json({ success: false, message: 'រកមិនឃើញគណនីហ្គេម ឬទិន្នន័យមិនត្រឹមត្រូវឡើយ!' });
        }

    } catch (error) {
        console.error('Verify Live Error:', error);
        return res.status(500).json({ success: false, message: 'មានបញ្ហាដាច់អ៊ីនធឺណិតជាមួយខាងម៉ូយឆែកឈ្មោះ!' });
    }
});

// ២. API: បង្កើតការកុម្ម៉ង់ និងទាក់ទងទៅ ABA
app.post('/api/orders/create', async (req, res) => {
    const orders = readOrders();
    const { game, playerId, zoneId, diamond, price } = req.body;

    const orderId = 'ORD' + Math.floor(100000 + Math.random() * 900000); 
    const amount = parseFloat(price.replace('$', '')); 
    const req_time = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14); 

    const abaHash = createAbaHash(req_time, orderId, amount, '', 'Pharath', 'Customer', '', '', 'purchase', 'abapay_khqr');

    try {
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
            abaQrCode: null 
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'មានបញ្ហាខុសបច្ចេកទេសជាមួយ ABA API' });
    }
});

// ៣. API: សម្រាប់ឱ្យ Frontend ឆែកមើលស្ថានភាពលុយរាល់ ២ វិនាទី
app.get('/api/orders/status/:id', (req, res) => {
    const orders = readOrders();
    const order = orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ message: 'រកមិនឃើញការកុម្ម៉ង់នេះទេ' });
    res.json({ status: order.status });
});

// ៤. API: ទាញយកប្រវត្តិការកុម្ម៉ង់ទាំងអស់បង្ហាញលើតារាង
app.get('/api/orders', (req, res) => {
    res.json(readOrders());
});

// ៥. 🔥 WEBHOOK ទី១: ទទួលដំណឹងពី ABA ភ្លាមៗពេលភ្ញៀវស្កែនលុយរួច រួចបញ្ជាទៅ G2Bulk
app.post('/api/aba/webhook', async (req, res) => {
    const { tran_id, status } = req.body; 
    const orders = readOrders();
    const orderIndex = orders.findIndex(o => o.id === tran_id);

    if (orderIndex === -1) return res.status(404).send('Order Not Found');
    const order = orders[orderIndex];

    if (order.status === 'Processing' || order.status === 'Completed') {
        return res.status(200).send('OK');
    }

    if (status === '0' || status === 0 || req.body.status === 'Approved') {
        orders[orderIndex].status = 'Processing'; 
        writeOrders(orders);

        try {
            await autoDeliverDiamond(order);
        } catch (error) {
            orders[orderIndex].status = 'Failed';
            writeOrders(orders);
        }
        return res.status(200).send('OK');
    } else {
        orders[orderIndex].status = 'Failed';
        writeOrders(orders);
        return res.status(200).send('Payment Failed');
    }
});

// ៦. 🔥 WEBHOOK ទី២: ទទួលដំណឹងពី G2BULK ពេលគេបុកហ្គេមចូលគណនីភ្ញៀវរួចរាល់
app.post('/api/reseller/webhook', (req, res) => {
    console.log('📥 [G2BULK WEBHOOK] ទទួលបានការអាប់ដេតស្ថានភាពបញ្ជាទិញ៖', req.body);
    
    const { status, remark } = req.body;
    const localOrderId = remark ? remark.replace('Order ', '').trim() : null;

    if (!localOrderId) return res.status(400).send('Missing Remark');

    const orders = readOrders();
    const orderIndex = orders.findIndex(o => o.id === localOrderId);

    if (orderIndex !== -1) {
        if (status === 'COMPLETED') {
            orders[orderIndex].status = 'Completed'; 
            console.log(`✅ ការបញ្ជាទិញ ${localOrderId} ត្រូវបានបញ្ចូលទៅក្នុងហ្គេមរួចរាល់!`);
        } else if (status === 'FAILED') {
            orders[orderIndex].status = 'Failed'; 
            console.log(`❌ ការបញ្ជាទិញ ${localOrderId} បានបរាជ័យពីខាង G2Bulk!`);
        }
        writeOrders(orders);
    }

    return res.status(200).send('OK');
});

// ដំណើរការ Server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
