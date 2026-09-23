const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { adminAuth } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimiter');

// Protect all admin endpoints with Admin API authentication & rate limiting
router.use(adminLimiter);
router.use(adminAuth);

// Admin License Operations
router.post('/licenses/create', adminController.create);
router.post('/licenses/ban', adminController.ban);
router.post('/licenses/unban', adminController.unban);
router.post('/licenses/delete', adminController.delete);
router.post('/licenses/reset-hwid', adminController.resetHwid);

router.get('/licenses', adminController.list);
router.get('/licenses/:license', adminController.getOne);

module.exports = router;
