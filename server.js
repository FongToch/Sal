const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// 🔑 API Key របស់បងត្រូវបានកំណត់ចូលក្នុងប្រព័ន្ធរួចរាល់
const G2BULK_API_KEY = '3e1a5b9fbad481ab61df64fccbb2cb60f03474249e0cc5ae3e736c54ed9ac8f6'; 
const BASE_URL = 'https://api.g2bulk.com/v1';

/**
 * 🔍 ១. Endpoint សម្រាប់ Verify ឈ្មោះ ID ហ្គេមគ្រប់ប្រភេទ (MLBB, PUBG, FF...)
 * URL សម្រាប់ទាញទិន្នន័យ៖ POST http://localhost:3000/api/verify-player
 */
app.post('/api/verify-player', async (req, res) => {
    try {
        const { game, user_id, server_id, charname } = req.body;

        if (!game || !user_id) {
            return res.status(400).json({
                success: false,
                message: 'សូមបំពេញព័ត៌មានប្រភេទហ្គេម និង User ID ឱ្យបានត្រឹមត្រូវ!'
            });
        }

        // បញ្ជូនទៅកាន់ប្រព័ន្ធ G2Bulk ដើម្បីឆែកឈ្មោះពិត
        const response = await axios.post(`${BASE_URL}/games/checkPlayerId`, {
            game: game,         // ឧទាហរណ៍: "mlbb", "pubg_mobile", "free_fire"
            user_id: user_id,   // លេខ ID ហ្គេមរបស់ភ្ញៀវ
            server_id: server_id || '', // លេខ Zone/Server ID (បើមាន)
            charname: charname || ''    // ឈ្មោះ (បើមាន)
        }, {
            headers: { 'X-API-Key': G2BULK_API_KEY }
        });

        // បើរកឃើញឈ្មោះពិត ផ្ញើត្រឡប់ទៅ Front-End វិញ
        res.json({
            success: true,
            name: response.data.name,
            openid: response.data.openid
        });

    } catch (error) {
        console.error('Verify Error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'មិនអាចស្វែងរក ឬភ្ជាប់ទៅកាន់ប្រព័ន្ធហ្គេមបានទេ! សូមពិនិត្យលេខ ID ឡើងវិញ។'
        });
    }
});

/**
 * 🛒 ២. Endpoint សម្រាប់កម្ម៉ង់ទិញ Diamond ឬ UC ស្វ័យប្រវត្តិ
 * URL សម្រាប់ទាញទិន្នន័យ៖ POST http://localhost:3000/api/buy-topup
 */
app.post('/api/buy-topup', async (req, res) => {
    try {
        const { game, catalogue_name, player_id, server_id, charname, remark } = req.body;

        if (!game || !catalogue_name || !player_id) {
            return res.status(400).json({
                success: false,
                message: 'សូមបំពេញព័ត៌មានចាំបាច់ឱ្យបានគ្រប់គ្រាន់ (ប្រភេទហ្គេម, ចំនួនកញ្ចប់, លេខ ID)!'
            });
        }

        // បញ្ជូនបញ្ជាទិញទៅកាន់ប្រព័ន្ធ G2Bulk API
        const response = await axios.post(`${BASE_URL}/games/${game}/order`, {
            catalogue_name: catalogue_name, // ឧទាហរណ៍: "86 Diamonds" ឬ "60 UC"
            player_id: player_id,
            server_id: server_id || '',
            charname: charname || '',
            remark: remark || 'Order from NM-FONG Shop'
        }, {
            headers: { 'X-API-Key': G2BULK_API_KEY }
        });

        res.json({
            success: true,
            message: 'ការទិញជោគជ័យ! ប្រព័ន្ធកំពុងដំណើរការផ្ទេរចូលគណនីហ្គេម។',
            order_details: response.data
        });

    } catch (error) {
        console.error('Purchase Error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'ការទិញបរាជ័យ! សូមពិនិត្យមើលទឹកប្រាក់ក្នុងកាបូប G2Bulk ឬព័ត៌មានហ្គេមឡើងវិញ។'
        });
    }
});

// រត់ Server លើ Port 3000
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
