const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// កំណត់ទីតាំង database.json ឱ្យនៅថតក្រៅបង្អស់ (Root Project)
const DB_FILE = path.join(__dirname, '../database.json');

const ABA_CONFIG = {
    API_URL: 'https://checkout.ababank.com/api/payment-gateway/v1/payments/purchase', 
    MERCHANT_ID: process.env.ABA_MERCHANT_ID || 'YOUR_ABA_MERCHANT_ID', 
    API_KEY: process.env.ABA_API_KEY || 'YOUR_ABA_API_KEY'
};

const G2BULK_CONFIG = {
    BASE_URL: 'https://api.g2bulk.com/v1',
    API_KEY: process.env.G2BULK_API_KEY 
};

// ==========================================
// 🛠️ មុខងារជំនួយ (HELPER FUNCTIONS)
// ==========================================
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

async function autoDeliverDiamond(order, req) {
    const gameCode = filterGameCode(order.game);
    const url = `${G2BULK_CONFIG.BASE_URL}/games/${gameCode}/order`;
    const currentHost = req && req.headers.host ? req.headers.host : (process.env.VERCEL_URL || 'oun-three.vercel.app');

    const requestBody = {
        catalogue_name: order.diamond, 
        player_id: order.playerId,
        charname: 'Customer', 
        remark: `Order ${order.id}`, 
        callback_url: `https://${currentHost}/api/reseller/webhook` 
    };

    let cleanZoneId = order.zoneId ? order.zoneId.toString().trim() : '';
    if (cleanZoneId.toLowerCase() !== 'n/a' && cleanZoneId.toLowerCase() !== 'null' && cleanZoneId.toLowerCase() !== 'undefined' && cleanZoneId !== '' && gameCode === 'mlbb') {
        requestBody.server_id = cleanZoneId;
    }

    console.log(`🤖 [G2BULK] កំពុងរត់បញ្ជាទិញ៖`, requestBody);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': G2BULK_CONFIG.API_KEY },
            body: JSON.stringify(requestBody)
        });
        const result = await response.json();
        if (result.success === true) return true;
        throw new Error(result.message || 'G2BulkRejected');
    } catch (error) {
        console.error('❌ បរាជ័យក្នុងការតភ្ជាប់ទៅ G2Bulk API៖', error.message);
        throw error; 
    }
}

// ==========================================
// 🌐 មុខងារទាញទិន្នន័យ (CONTROLLER ACTIONS)
// ==========================================

// ១. 🔍 មុខងារឆែកឈ្មោះ Player ID
exports.verifyPlayer = async (req, res) => {
    try {
        const game = req.body.game;
        const playerId = req.body.playerId || req.body.player_id;
        const zoneId = req.body.zoneId || req.body.zone_id || req.body.server_id;

        if (!game || !playerId) return res.status(400).json({ success: false, message: 'សូមបញ្ចូលព័ត៌មានឱ្យបានគ្រប់គ្រាន់!' });

        const gameCode = filterGameCode(game);
        const requestData = { game: gameCode, user_id: playerId.toString().trim(), charname: 'check' };

        let cleanZoneId = zoneId ? zoneId.toString().trim() : '';
        if (cleanZoneId.toLowerCase() !== 'n/a' && cleanZoneId.toLowerCase() !== 'null' && cleanZoneId.toLowerCase() !== 'undefined' && cleanZoneId !== '' && gameCode === 'mlbb') {
            requestData.server_id = cleanZoneId;
        }

        const response = await fetch(`${G2BULK_CONFIG.BASE_URL}/games/checkPlayerId`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': G2BULK_CONFIG.API_KEY },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();
        if (result.valid === 'valid' || result.name || result.username) {
            return res.json({ success: true, nickname: result.name || result.username || 'រកឃើញគណនី' });
        } else {
            return res.status(400).json({ success: false, message: result.message || 'រកមិនឃើញគណនីហ្គេម!' });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: 'មានបញ្ហាដាច់អ៊ីនធឺណិតជាមួយខាងម៉ូយឆែកឈ្មោះ!' });
    }
};

// ២. 🛒 មុខងារបង្កើតការកុម្ម៉ង់
exports.createOrder = async (req, res) => {
    const orders = readOrders();
    const { game, playerId, zoneId, diamond, price } = req.body;
    const orderId = 'ORD' + Math.floor(100000 + Math.random() * 900000); 
    const amount = parseFloat(price.replace('$', '')); 
    const req_time = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14); 

    try {
        const newOrder = { id: orderId, game, playerId, zoneId: zoneId || 'N/A', diamond, price, status: 'Pending', createdAt: new Date().toLocaleString('kh-KH') };
        orders.push(newOrder);
        writeOrders(orders);
        res.json({ success: true, order: newOrder, abaQrCode: null });
    } catch (error) {
        res.status(500).json({ success: false, message: 'មានបញ្ហាខុសបច្ចេកទេស' });
    }
};

// ៣. 📊 ឆែកស្ថានភាពលុយរាល់ ២ វិនាទី
exports.getOrderStatus = (req, res) => {
    const orders = readOrders();
    const order = orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ message: 'រកមិនឃើញការកុម្ម៉ង់នេះទេ' });
    res.json({ status: order.status });
};

// ៤. 📋 ទាញយកប្រវត្តិការកុម្មង់ទាំងអស់
exports.getAllOrders = (req, res) => { res.json(readOrders()); };

// ៥. 🔥 WEBHOOK ទទួលដំណឹងពី ABA
exports.abaWebhook = async (req, res) => {
    const { tran_id, status } = req.body; 
    const orders = readOrders();
    const orderIndex = orders.findIndex(o => o.id === tran_id);

    if (orderIndex === -1) return res.status(404).send('Order Not Found');
    const order = orders[orderIndex];

    if (order.status === 'Processing' || order.status === 'Completed') return res.status(200).send('OK');

    if (status === '0' || status === 0 || req.body.status === 'Approved') {
        orders[orderIndex].status = 'Processing'; 
        writeOrders(orders);
        try {
            await autoDeliverDiamond(order, req);
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
};

// ៦. 🔥 WEBHOOK ទទួលដំណឹងពី G2BULK
exports.g2bulkWebhook = (req, res) => {
    const { status, remark } = req.body;
    const localOrderId = remark ? remark.replace('Order ', '').trim() : null;
    if (!localOrderId) return res.status(400).send('Missing Remark');

    const orders = readOrders();
    const orderIndex = orders.findIndex(o => o.id === localOrderId);

    if (orderIndex !== -1) {
        if (status === 'COMPLETED') orders[orderIndex].status = 'Completed'; 
        else if (status === 'FAILED') orders[orderIndex].status = 'Failed'; 
        writeOrders(orders);
    }
    return res.status(200).send('OK');
};
