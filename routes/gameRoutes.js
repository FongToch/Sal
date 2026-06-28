const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

// កំណត់ផ្លូវសម្រាប់ហៅប្រើ
router.post('/check-player', gameController.checkPlayerId); // ផ្លូវឆែកឈ្មោះ
router.post('/topup-order', gameController.placeOrder);      // ផ្លូវបុកលុយ

module.exports = router;
