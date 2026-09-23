const rateLimit = require('express-rate-limit');
const config = require('../config');

const publicLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxPublic,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    valid: false,
    code: 'RATE_LIMITED',
    message: 'Too many requests from this IP. Please wait a few minutes before trying again.'
  }
});

const adminLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxAdmin,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too Many Requests',
    message: 'Admin rate limit exceeded.'
  }
});

module.exports = { publicLimiter, adminLimiter };
