const axios = require('axios');

// 1. មុខងារឆែកឈ្មោះ Player ID (មុនពេលឱ្យភ្ញៀវបុកលុយ)
exports.checkPlayerId = async (req, res) => {
    try {
        const { game, user_id, server_id, charname } = req.body;

        // បាញ់ទៅ G2Bulk API តាមឯកសារកំណត់
        const response = await axios.post('https://api.g2bulk.com/v1/games/checkPlayerId', {
            game,
            user_id,
            server_id: server_id || "", // បើគ្មាន server_id ទេ ផ្ញើខ្សែអក្សរទទេ
            charname: charname || ""
        }, {
            headers: { 
                'X-API-Key': process.env.G2BULK_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        // ហុចលទ្ធផលឈ្មោះត្រឡប់ទៅឱ្យ App/Frontend វិញ
        return res.status(200).json(response.data);
    } catch (error) {
        console.error("Error Checking Player ID:", error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || "មានបញ្ហាក្នុងការឆែកឈ្មោះអ្នកលេង!"
        });
    }
};

// 2. មុខងារបញ្ជាទិញ / បុកពេជ្រចូល ID ភ្ញៀវ
exports.placeOrder = async (req, res) => {
    try {
        const { game_code, catalogue_name, player_id, server_id, charname, remark, callback_url } = req.body;

        // បាញ់កូដកម្មង់ទិញទៅ G2Bulk (តាមទម្រង់ /v1/games/:code/order)
        const response = await axios.post(`https://api.g2bulk.com/v1/games/${game_code}/order`, {
            catalogue_name,
            player_id,
            server_id: server_id || "",
            charname: charname || "",
            remark: remark || "Order via API",
            callback_url: callback_url || "" // សម្រាប់ចាំទទួល Webhook ពេលជោគជ័យ
        }, {
            headers: { 
                'X-API-Key': process.env.G2BULK_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        // ហុចលទ្ធផលបញ្ជាទិញ (Status: PENDING) ទៅឱ្យភ្ញៀវវិញ
        return res.status(200).json(response.data);
    } catch (error) {
        console.error("Error Placing Order:", error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || "ការកុម្មង់បុកលុយហ្គេមបានបរាជ័យ!"
        });
    }
};
