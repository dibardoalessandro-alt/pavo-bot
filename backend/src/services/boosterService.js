const crypto = require('crypto');
const db = require('../database/db');

class BoosterService {
  /**
   * Log an audit action to booster_audit_logs
   */
  logAudit(discordUserId, action, actor = 'system', details = null, ipAddress = null) {
    try {
      const stmt = db.prepare(`
        INSERT INTO booster_audit_logs (discord_user_id, action, actor, details, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        discordUserId,
        action,
        actor,
        typeof details === 'object' ? JSON.stringify(details) : details,
        ipAddress,
        new Date().toISOString()
      );
    } catch (err) {
      console.error('[BOOSTER_AUDIT_LOG_ERROR]', err);
    }
  }

  /**
   * Admin / Bot verification of a 2-boost Discord user
   */
  verifyUser({ discordUserId, discordUsername = null, boostCount = 2, verifiedBy = 'admin', notes = null }) {
    if (!discordUserId) {
      throw new Error('discordUserId is required');
    }

    const now = new Date().toISOString();

    // Check if user already exists
    const existing = db.prepare('SELECT * FROM booster_users WHERE discord_user_id = ?').get(discordUserId);

    if (existing) {
      const stmt = db.prepare(`
        UPDATE booster_users
        SET discord_username = COALESCE(?, discord_username),
            is_verified = 1,
            boost_count = ?,
            status = 'active',
            verified_at = ?,
            verified_by = ?,
            revoked_at = NULL,
            revoked_by = NULL,
            revoked_reason = NULL,
            notes = COALESCE(?, notes),
            updated_at = ?
        WHERE discord_user_id = ?
      `);
      stmt.run(discordUsername, boostCount, now, verifiedBy, notes, now, discordUserId);
    } else {
      const stmt = db.prepare(`
        INSERT INTO booster_users (
          discord_user_id, discord_username, is_verified, boost_count,
          status, verified_at, verified_by, notes, updated_at
        ) VALUES (?, ?, 1, ?, 'active', ?, ?, ?, ?)
      `);
      stmt.run(discordUserId, discordUsername, boostCount, now, verifiedBy, notes, now);
    }

    this.logAudit(discordUserId, 'BOOSTER_VERIFIED', verifiedBy, { boostCount, notes });

    return this.getUserStatus(discordUserId);
  }

  /**
   * Instantly revoke booster access for a user and terminate all active sessions
   */
  revokeUser({ discordUserId, revokedBy = 'admin', reason = 'No longer boosting or revoked by admin' }) {
    if (!discordUserId) {
      throw new Error('discordUserId is required');
    }

    const now = new Date().toISOString();
    const user = db.prepare('SELECT * FROM booster_users WHERE discord_user_id = ?').get(discordUserId);

    if (user) {
      const stmt = db.prepare(`
        UPDATE booster_users
        SET is_verified = 0,
            status = 'revoked',
            revoked_at = ?,
            revoked_by = ?,
            revoked_reason = ?,
            updated_at = ?
        WHERE discord_user_id = ?
      `);
      stmt.run(now, revokedBy, reason, now, discordUserId);
    }

    // Invalidate all active sessions for this user
    const revokeSessionsStmt = db.prepare(`
      UPDATE booster_sessions
      SET status = 'revoked'
      WHERE discord_user_id = ? AND status = 'active'
    `);
    const sessionsResult = revokeSessionsStmt.run(discordUserId);

    // Invalidate unused auth codes
    const burnCodesStmt = db.prepare(`
      UPDATE booster_auth_codes
      SET used = 1, used_at = ?
      WHERE discord_user_id = ? AND used = 0
    `);
    burnCodesStmt.run(now, discordUserId);

    this.logAudit(discordUserId, 'BOOSTER_REVOKED', revokedBy, {
      reason,
      revokedSessionsCount: sessionsResult.changes
    });

    return {
      success: true,
      discordUserId,
      status: 'revoked',
      revokedSessions: sessionsResult.changes,
      reason
    };
  }

  /**
   * Get booster user record
   */
  getUserStatus(discordUserId) {
    const user = db.prepare('SELECT * FROM booster_users WHERE discord_user_id = ?').get(discordUserId);
    if (!user) {
      return {
        discordUserId,
        isVerified: false,
        status: 'unverified',
        boostCount: 0,
        activeSessions: 0
      };
    }

    const activeSessions = db.prepare(`
      SELECT COUNT(*) as count FROM booster_sessions
      WHERE discord_user_id = ? AND status = 'active' AND expires_at > ?
    `).get(discordUserId, new Date().toISOString());

    return {
      discordUserId: user.discord_user_id,
      discordUsername: user.discord_username,
      isVerified: user.is_verified === 1 && user.status === 'active',
      boostCount: user.boost_count,
      status: user.status,
      verifiedAt: user.verified_at,
      verifiedBy: user.verified_by,
      revokedAt: user.revoked_at,
      revokedBy: user.revoked_by,
      revokedReason: user.revoked_reason,
      notes: user.notes,
      updatedAt: user.updated_at,
      activeSessions: activeSessions ? activeSessions.count : 0
    };
  }

  /**
   * Generate a single-use short-lived temporary auth code (5 minutes TTL)
   */
  generateAuthCode({ discordUserId, ttlSeconds = 300 }) {
    if (!discordUserId) {
      throw new Error('discordUserId is required');
    }

    // Verify user eligibility first
    const userStatus = this.getUserStatus(discordUserId);
    if (!userStatus.isVerified || userStatus.status !== 'active') {
      throw new Error('User does not have an active Pavo Booster verification.');
    }

    // Generate secure formatted code: PVBOOST-XXXXX-XXXXX
    const rand1 = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
    const rand2 = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
    const code = `PVBOOST-${rand1}-${rand2}`;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

    // Expire previous unused codes for this user to keep only the freshest one
    db.prepare(`
      UPDATE booster_auth_codes
      SET used = 1, used_at = ?
      WHERE discord_user_id = ? AND used = 0
    `).run(now.toISOString(), discordUserId);

    // Insert new temporary code
    const stmt = db.prepare(`
      INSERT INTO booster_auth_codes (code, discord_user_id, created_at, expires_at, used)
      VALUES (?, ?, ?, ?, 0)
    `);
    stmt.run(code, discordUserId, now.toISOString(), expiresAt);

    this.logAudit(discordUserId, 'AUTH_CODE_GENERATED', 'discord_bot', { code, expiresAt });

    return {
      code,
      expiresAt,
      ttlSeconds,
      discordUserId
    };
  }

  /**
   * CLI exchanges temporary auth code for a session token
   */
  exchangeAuthCode({ code, hwid = null, ipAddress = null }) {
    if (!code) {
      throw new Error('Temporary authorization code is required');
    }

    const cleanCode = code.trim().toUpperCase();
    const nowIso = new Date().toISOString();

    const authCode = db.prepare(`
      SELECT * FROM booster_auth_codes
      WHERE code = ? AND used = 0 AND expires_at > ?
    `).get(cleanCode, nowIso);

    if (!authCode) {
      throw new Error('Invalid, expired, or already used authorization code.');
    }

    const discordUserId = authCode.discord_user_id;

    // Verify user is still verified and active
    const user = db.prepare('SELECT * FROM booster_users WHERE discord_user_id = ?').get(discordUserId);
    if (!user || user.is_verified !== 1 || user.status !== 'active') {
      // Burn code immediately
      db.prepare('UPDATE booster_auth_codes SET used = 1, used_at = ? WHERE id = ?').run(nowIso, authCode.id);
      throw new Error('Pavo Booster verification is inactive or revoked.');
    }

    // Mark code as used (single-use)
    db.prepare(`
      UPDATE booster_auth_codes
      SET used = 1, used_at = ?, ip_address = ?
      WHERE id = ?
    `).run(nowIso, ipAddress, authCode.id);

    // Create session (12 hours TTL)
    const sessionId = `pvsess_${crypto.randomBytes(16).toString('hex')}`;
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    const sessionStmt = db.prepare(`
      INSERT INTO booster_sessions (
        session_id, session_token, discord_user_id, discord_username,
        hwid, ip_address, status, created_at, expires_at, last_heartbeat
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `);
    sessionStmt.run(
      sessionId,
      sessionToken,
      discordUserId,
      user.discord_username,
      hwid,
      ipAddress,
      nowIso,
      expiresAt,
      nowIso
    );

    this.logAudit(discordUserId, 'SESSION_CREATED', 'cli_client', { sessionId, hwid }, ipAddress);

    return {
      success: true,
      sessionId,
      sessionToken,
      expiresAt,
      user: {
        discordUserId: user.discord_user_id,
        discordUsername: user.discord_username,
        boostCount: user.boost_count,
        status: user.status
      }
    };
  }

  /**
   * Validate session token & real-time authorization state
   */
  validateSession(sessionToken, ipAddress = null) {
    if (!sessionToken) {
      throw new Error('No session token provided');
    }

    const nowIso = new Date().toISOString();
    const session = db.prepare(`
      SELECT * FROM booster_sessions
      WHERE session_token = ?
    `).get(sessionToken);

    if (!session) {
      const err = new Error('Session not found.');
      err.statusCode = 401;
      throw err;
    }

    if (session.status !== 'active') {
      const err = new Error('Session has been revoked or expired.');
      err.statusCode = 403;
      err.code = 'ACCESS_REVOKED';
      throw err;
    }

    if (session.expires_at <= nowIso) {
      db.prepare("UPDATE booster_sessions SET status = 'expired' WHERE id = ?").run(session.id);
      const err = new Error('Session has expired. Please re-authenticate.');
      err.statusCode = 401;
      throw err;
    }

    // Check underlying booster user state
    const user = db.prepare('SELECT * FROM booster_users WHERE discord_user_id = ?').get(session.discord_user_id);
    if (!user || user.is_verified !== 1 || user.status !== 'active') {
      // Immediately revoke session
      db.prepare("UPDATE booster_sessions SET status = 'revoked' WHERE id = ?").run(session.id);
      this.logAudit(session.discord_user_id, 'SESSION_AUTO_TERMINATED', 'session_validator', {
        reason: 'User booster status no longer active'
      }, ipAddress);

      const err = new Error('ACCESS_REVOKED: Your Discord booster eligibility is no longer valid.');
      err.statusCode = 403;
      err.code = 'ACCESS_REVOKED';
      throw err;
    }

    // Update heartbeat
    db.prepare(`
      UPDATE booster_sessions
      SET last_heartbeat = ?, ip_address = COALESCE(?, ip_address)
      WHERE id = ?
    `).run(nowIso, ipAddress, session.id);

    return {
      valid: true,
      sessionId: session.session_id,
      discordUserId: user.discord_user_id,
      discordUsername: user.discord_username,
      boostCount: user.boost_count,
      status: user.status,
      sessionExpiresAt: session.expires_at,
      lastHeartbeat: nowIso
    };
  }

  /**
   * Terminate active session
   */
  terminateSession(sessionToken, actor = 'cli_client') {
    const session = db.prepare('SELECT * FROM booster_sessions WHERE session_token = ?').get(sessionToken);
    if (session) {
      db.prepare("UPDATE booster_sessions SET status = 'revoked' WHERE id = ?").run(session.id);
      this.logAudit(session.discord_user_id, 'SESSION_LOGOUT', actor, { sessionId: session.session_id });
    }
    return { success: true };
  }

  /**
   * List active/recent sessions for Admin
   */
  listSessions({ status = 'all', limit = 50 } = {}) {
    let query = 'SELECT * FROM booster_sessions';
    const params = [];

    if (status !== 'all') {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);

    return db.prepare(query).all(...params);
  }

  /**
   * List audit logs for Admin
   */
  getAuditLogs({ discordUserId = null, limit = 50 } = {}) {
    let query = 'SELECT * FROM booster_audit_logs';
    const params = [];

    if (discordUserId) {
      query += ' WHERE discord_user_id = ?';
      params.push(discordUserId);
    }

    query += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);

    return db.prepare(query).all(...params);
  }
}

module.exports = new BoosterService();
