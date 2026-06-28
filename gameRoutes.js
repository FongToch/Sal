const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

// 🔍 ផ្លូវឆែកឈ្មោះ
router.post('/games/verify', gameController.verifyPlayer);

// 🛒 ផ្លូវបង្កើត និងឆែកស្ថានភាព Order
router.post('/orders/create', gameController.createOrder);
router.get('/orders/status/:id', gameController.getOrderStatus);
router.get('/orders', gameController.getAllOrders);

// 🔥 ផ្លូវ Webhooks
router.post('/aba/webhook', gameController.abaWebhook);
router.post('/reseller/webhook', gameController.g2bulkWebhook);

module.exports = router;
