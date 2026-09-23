const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Admin API Key for Discord Bot & Admin dashboard actions
  adminApiKey: process.env.ADMIN_API_KEY || 'pavo_secret_admin_key_change_me_in_production_2026',
  
  // Secret for HMAC signing of client responses
  jwtSecret: process.env.SIGNING_SECRET || 'pavo_signing_hmac_secret_key_super_secure_998877',
  
  // SQLite Database Path
  dbPath: process.env.DB_PATH || path.resolve(__dirname, '../../data/licenses.db'),
  
  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxPublic: parseInt(process.env.RATE_LIMIT_PUBLIC || '60', 10), // 60 requests per 15 min per IP
    maxAdmin: parseInt(process.env.RATE_LIMIT_ADMIN || '300', 10),  // 300 requests per 15 min
  },
  
  // License settings
  defaultMaxDevices: parseInt(process.env.DEFAULT_MAX_DEVICES || '1', 10),
  heartbeatToleranceSeconds: parseInt(process.env.HEARTBEAT_TOLERANCE_SECONDS || '300', 10), // 5 min
};

module.exports = config;
