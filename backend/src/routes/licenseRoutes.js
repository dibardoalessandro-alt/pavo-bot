const express = require('express');
const router = express.Router();
const licenseController = require('../controllers/licenseController');
const { publicLimiter } = require('../middleware/rateLimiter');

// Public endpoints called by Pavo Tweak Desktop client
router.post('/validate', publicLimiter, licenseController.validate);
router.post('/activate', publicLimiter, licenseController.activate);
router.post('/heartbeat', publicLimiter, licenseController.heartbeat);

module.exports = router;
