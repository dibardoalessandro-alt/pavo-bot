const express = require('express');
const router = express.Router();
const boosterService = require('../services/boosterService');
const { adminAuth } = require('../middleware/auth');
const { publicLimiter, adminLimiter } = require('../middleware/rateLimiter');

// ─────────────────────────────────────────────────────────────────────────────
// Client Endpoints (CLI)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/booster/auth/exchange
 * Exchange temporary Discord code for a session token
 */
router.post('/auth/exchange', publicLimiter, (req, res) => {
  try {
    const { code, hwid } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Temporary authentication code is required.'
      });
    }

    const result = boosterService.exchangeAuthCode({ code, hwid, ipAddress });
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: 'AuthenticationFailed',
      message: err.message
    });
  }
});

/**
 * GET /api/booster/auth/session
 * Session validation & heartbeat
 */
router.get('/auth/session', publicLimiter, (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    let sessionToken = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionToken = authHeader.substring(7).trim();
    } else if (req.headers['x-session-token']) {
      sessionToken = req.headers['x-session-token'];
    }

    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Session token required in Authorization header.'
      });
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const validation = boosterService.validateSession(sessionToken, ipAddress);

    return res.status(200).json({
      success: true,
      data: validation
    });
  } catch (err) {
    const statusCode = err.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      error: err.code || 'Unauthorized',
      message: err.message
    });
  }
});

/**
 * POST /api/booster/auth/logout
 * Cleanly terminates the active session
 */
router.post('/auth/logout', publicLimiter, (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    let sessionToken = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionToken = authHeader.substring(7).trim();
    }

    if (sessionToken) {
      boosterService.terminateSession(sessionToken, 'cli_logout');
    }

    return res.status(200).json({
      success: true,
      message: 'Session closed successfully.'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'LogoutError',
      message: err.message
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin / Bot Protected Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/booster/admin/verify
 * Record that a user was verified with the 2-boost requirement
 */
router.post('/admin/verify', adminAuth, adminLimiter, (req, res) => {
  try {
    const { discordUserId, discordUsername, boostCount, verifiedBy, notes } = req.body;

    if (!discordUserId) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'discordUserId is required.'
      });
    }

    const result = boosterService.verifyUser({
      discordUserId,
      discordUsername,
      boostCount: boostCount ? parseInt(boostCount, 10) : 2,
      verifiedBy: verifiedBy || 'admin',
      notes
    });

    return res.status(200).json({
      success: true,
      message: `User ${discordUserId} verified successfully for PavoTweak Booster access.`,
      data: result
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'VerificationError',
      message: err.message
    });
  }
});

/**
 * POST /api/booster/admin/revoke
 * Instantly revoke a user's booster access and all active sessions
 */
router.post('/admin/revoke', adminAuth, adminLimiter, (req, res) => {
  try {
    const { discordUserId, revokedBy, reason } = req.body;

    if (!discordUserId) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'discordUserId is required.'
      });
    }

    const result = boosterService.revokeUser({
      discordUserId,
      revokedBy: revokedBy || 'admin',
      reason: reason || 'Booster status revoked'
    });

    return res.status(200).json({
      success: true,
      message: `User ${discordUserId} booster access has been revoked.`,
      data: result
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'RevocationError',
      message: err.message
    });
  }
});

/**
 * POST /api/booster/code/generate
 * Discord bot generates a single-use 5-minute code for an eligible user
 */
router.post('/code/generate', adminAuth, adminLimiter, (req, res) => {
  try {
    const { discordUserId, ttlSeconds } = req.body;

    if (!discordUserId) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'discordUserId is required.'
      });
    }

    const result = boosterService.generateAuthCode({
      discordUserId,
      ttlSeconds: ttlSeconds ? parseInt(ttlSeconds, 10) : 300
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: 'CodeGenerationFailed',
      message: err.message
    });
  }
});

/**
 * GET /api/booster/admin/status/:userId
 * Check booster status of a specific Discord user
 */
router.get('/admin/status/:userId', adminAuth, adminLimiter, (req, res) => {
  try {
    const status = boosterService.getUserStatus(req.params.userId);
    return res.status(200).json({
      success: true,
      data: status
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'StatusError',
      message: err.message
    });
  }
});

/**
 * GET /api/booster/admin/sessions
 * List active & recent booster sessions
 */
router.get('/admin/sessions', adminAuth, adminLimiter, (req, res) => {
  try {
    const { status, limit } = req.query;
    const sessions = boosterService.listSessions({
      status: status || 'all',
      limit: limit ? parseInt(limit, 10) : 50
    });
    return res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'SessionListError',
      message: err.message
    });
  }
});

/**
 * GET /api/booster/admin/audit-logs
 * List booster audit logs
 */
router.get('/admin/audit-logs', adminAuth, adminLimiter, (req, res) => {
  try {
    const { userId, limit } = req.query;
    const logs = boosterService.getAuditLogs({
      discordUserId: userId || null,
      limit: limit ? parseInt(limit, 10) : 50
    });
    return res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'AuditLogsError',
      message: err.message
    });
  }
});

module.exports = router;
