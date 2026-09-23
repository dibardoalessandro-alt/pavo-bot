const config = require('../config');

/**
 * Middleware to authenticate requests to Admin API endpoints
 */
function adminAuth(req, res, next) {
  const adminKeyHeader = req.headers['x-admin-key'];
  const authHeader = req.headers['authorization'];
  
  let bearerToken = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerToken = authHeader.substring(7).trim();
  }

  const providedKey = adminKeyHeader || bearerToken;

  if (!providedKey || providedKey !== config.adminApiKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or missing Admin API key.'
    });
  }

  next();
}

module.exports = { adminAuth };
