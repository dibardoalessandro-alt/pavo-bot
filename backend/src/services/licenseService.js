const crypto = require('crypto');
const db = require('../database/db');
const config = require('../config');

class LicenseService {
  /**
   * Generates a cryptographically secure license key
   * Format: PAVO-XXXX-XXXX-XXXX
   */
  generateKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Base32 without ambiguous 0/O, 1/I
    const getRandomSegment = (len) => {
      const bytes = crypto.randomBytes(len);
      let result = '';
      for (let i = 0; i < len; i++) {
        result += chars[bytes[i] % chars.length];
      }
      return result;
    };
    return `PAVO-${getRandomSegment(4)}-${getRandomSegment(4)}-${getRandomSegment(4)}`;
  }

  /**
   * Computes an HMAC signature for client-server tamper verification
   */
  signPayload(payload) {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHmac('sha256', config.jwtSecret).update(data).digest('hex');
  }

  /**
   * Log an audit action to the database
   */
  logAudit(licenseKey, action, actor, hwid, ipAddress, details) {
    try {
      const stmt = db.prepare(`
        INSERT INTO audit_logs (license_key, action, actor, hwid, ip_address, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        licenseKey || null,
        action,
        actor || 'system',
        hwid || null,
        ipAddress || null,
        details ? JSON.stringify(details) : null,
        new Date().toISOString()
      );
    } catch (err) {
      console.error('[AUDIT LOG ERROR]', err);
    }
  }

  /**
   * Create a new license
   */
  createLicense({
    durationDays = null,
    discordUserId = null,
    discordUsername = null,
    notes = null,
    maxDevices = 1,
    createdBy = 'admin',
    customKey = null
  }) {
    let key = customKey ? customKey.trim().toUpperCase() : this.generateKey();
    
    // Ensure uniqueness if auto-generated
    if (!customKey) {
      let attempts = 0;
      while (attempts < 5) {
        const check = db.prepare('SELECT id FROM licenses WHERE license_key = ?').get(key);
        if (!check) break;
        key = this.generateKey();
        attempts++;
      }
    }

    const now = new Date();
    let expiresAt = null;
    if (durationDays && parseInt(durationDays, 10) > 0) {
      const expDate = new Date(now.getTime() + parseInt(durationDays, 10) * 24 * 60 * 60 * 1000);
      expiresAt = expDate.toISOString();
    }

    const stmt = db.prepare(`
      INSERT INTO licenses (
        license_key, status, discord_user_id, discord_username,
        created_at, expires_at, notes, max_devices, created_by
      ) VALUES (?, 'active', ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      key,
      discordUserId || null,
      discordUsername || null,
      now.toISOString(),
      expiresAt,
      notes || null,
      maxDevices || config.defaultMaxDevices,
      createdBy || 'admin'
    );

    this.logAudit(key, 'LICENSE_CREATED', createdBy, null, null, { durationDays, expiresAt, discordUserId });

    return this.getLicense(key);
  }

  /**
   * Find license by key
   */
  getLicense(key) {
    if (!key) return null;
    const cleanKey = key.trim().toUpperCase();
    return db.prepare('SELECT * FROM licenses WHERE license_key = ?').get(cleanKey);
  }

  /**
   * Validate license key + HWID + expiration + status
   */
  validateLicense({ licenseKey, hwid, ipAddress }) {
    if (!licenseKey) {
      return {
        valid: false,
        code: 'INVALID_INPUT',
        message: 'License key is required.'
      };
    }

    const cleanKey = licenseKey.trim().toUpperCase();
    const license = this.getLicense(cleanKey);

    if (!license) {
      this.logAudit(cleanKey, 'VALIDATION_FAILED_NOT_FOUND', 'client', hwid, ipAddress);
      return {
        valid: false,
        code: 'NOT_FOUND',
        message: 'Invalid license. Please enter a valid license key.'
      };
    }

    // Check Ban Status
    if (license.status === 'banned') {
      this.logAudit(cleanKey, 'VALIDATION_BLOCKED_BANNED', 'client', hwid, ipAddress, { reason: license.ban_reason });
      return {
        valid: false,
        code: 'BANNED',
        message: 'License banned. This license is no longer valid. Please enter a new license.',
        reason: license.ban_reason || 'Violation of terms of service'
      };
    }

    // Check Revoked Status
    if (license.status === 'revoked') {
      return {
        valid: false,
        code: 'REVOKED',
        message: 'This license has been revoked. Please contact support.'
      };
    }

    // Check Expiration
    if (license.expires_at) {
      const expiry = new Date(license.expires_at);
      if (expiry < new Date()) {
        db.prepare("UPDATE licenses SET status = 'expired' WHERE id = ?").run(license.id);
        this.logAudit(cleanKey, 'LICENSE_EXPIRED', 'system', hwid, ipAddress);
        return {
          valid: false,
          code: 'EXPIRED',
          message: 'Your license has expired. Please renew your subscription.'
        };
      }
    }

    // Check HWID binding
    if (license.hwid) {
      if (hwid && license.hwid !== hwid.trim()) {
        this.logAudit(cleanKey, 'VALIDATION_HWID_MISMATCH', 'client', hwid, ipAddress, { expectedHwid: license.hwid });
        return {
          valid: false,
          code: 'HWID_MISMATCH',
          message: 'Hardware ID mismatch. This license is registered on another device.'
        };
      }
    }

    // Update heartbeat and IP
    const nowIso = new Date().toISOString();
    db.prepare('UPDATE licenses SET last_heartbeat = ?, ip_address = ? WHERE id = ?')
      .run(nowIso, ipAddress || license.ip_address, license.id);

    const payload = {
      valid: true,
      code: 'VALID',
      license_key: license.license_key,
      status: license.status,
      expires_at: license.expires_at,
      activated_at: license.activated_at,
      discord_user_id: license.discord_user_id,
      timestamp: Date.now()
    };

    return {
      ...payload,
      signature: this.signPayload(payload)
    };
  }

  /**
   * Activate license on a device (bind HWID)
   */
  activateLicense({ licenseKey, hwid, ipAddress }) {
    if (!licenseKey || !hwid) {
      return {
        valid: false,
        code: 'INVALID_INPUT',
        message: 'Both license key and HWID are required.'
      };
    }

    const cleanKey = licenseKey.trim().toUpperCase();
    const cleanHwid = hwid.trim();
    const license = this.getLicense(cleanKey);

    if (!license) {
      this.logAudit(cleanKey, 'ACTIVATION_FAILED_NOT_FOUND', 'client', cleanHwid, ipAddress);
      return {
        valid: false,
        code: 'NOT_FOUND',
        message: 'Invalid license. Please enter a valid license key.'
      };
    }

    if (license.status === 'banned') {
      this.logAudit(cleanKey, 'ACTIVATION_BLOCKED_BANNED', 'client', cleanHwid, ipAddress);
      return {
        valid: false,
        code: 'BANNED',
        message: 'License banned. This license is no longer valid. Please enter a new license.',
        reason: license.ban_reason
      };
    }

    if (license.status === 'revoked') {
      return {
        valid: false,
        code: 'REVOKED',
        message: 'This license has been revoked.'
      };
    }

    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      db.prepare("UPDATE licenses SET status = 'expired' WHERE id = ?").run(license.id);
      return {
        valid: false,
        code: 'EXPIRED',
        message: 'Your license has expired.'
      };
    }

    // Already bound to this device?
    if (license.hwid === cleanHwid) {
      const nowIso = new Date().toISOString();
      db.prepare('UPDATE licenses SET last_heartbeat = ?, ip_address = ? WHERE id = ?')
        .run(nowIso, ipAddress, license.id);

      const payload = {
        valid: true,
        code: 'ALREADY_ACTIVATED',
        message: 'License already activated on this device.',
        license_key: license.license_key,
        expires_at: license.expires_at,
        timestamp: Date.now()
      };
      return { ...payload, signature: this.signPayload(payload) };
    }

    // Bound to a different device?
    if (license.hwid && license.hwid !== cleanHwid) {
      this.logAudit(cleanKey, 'ACTIVATION_HWID_CONFLICT', 'client', cleanHwid, ipAddress, { currentHwid: license.hwid });
      return {
        valid: false,
        code: 'HWID_MISMATCH',
        message: 'Hardware ID mismatch. This license is already bound to another machine. Contact support to reset.'
      };
    }

    // First time activation: bind HWID
    const nowIso = new Date().toISOString();
    db.prepare(`
      UPDATE licenses
      SET hwid = ?, activated_at = ?, last_heartbeat = ?, ip_address = ?
      WHERE id = ?
    `).run(cleanHwid, nowIso, nowIso, ipAddress, license.id);

    this.logAudit(cleanKey, 'LICENSE_ACTIVATED', 'client', cleanHwid, ipAddress);

    const payload = {
      valid: true,
      code: 'ACTIVATED',
      message: 'License successfully activated!',
      license_key: license.license_key,
      expires_at: license.expires_at,
      activated_at: nowIso,
      timestamp: Date.now()
    };

    return {
      ...payload,
      signature: this.signPayload(payload)
    };
  }

  /**
   * Periodic Heartbeat check
   */
  heartbeat({ licenseKey, hwid, ipAddress }) {
    return this.validateLicense({ licenseKey, hwid, ipAddress });
  }

  /**
   * Ban a license
   */
  banLicense({ licenseKey, reason, actor = 'admin' }) {
    const cleanKey = licenseKey.trim().toUpperCase();
    const license = this.getLicense(cleanKey);
    if (!license) {
      return { success: false, message: 'License not found.' };
    }

    db.prepare(`
      UPDATE licenses
      SET status = 'banned', ban_reason = ?
      WHERE id = ?
    `).run(reason || 'Banned by administrator', license.id);

    this.logAudit(cleanKey, 'LICENSE_BANNED', actor, license.hwid, null, { reason });

    return {
      success: true,
      message: `License ${cleanKey} has been BANNED.`,
      license: this.getLicense(cleanKey)
    };
  }

  /**
   * Unban a license
   */
  unbanLicense({ licenseKey, actor = 'admin' }) {
    const cleanKey = licenseKey.trim().toUpperCase();
    const license = this.getLicense(cleanKey);
    if (!license) {
      return { success: false, message: 'License not found.' };
    }

    db.prepare(`
      UPDATE licenses
      SET status = 'active', ban_reason = NULL
      WHERE id = ?
    `).run(license.id);

    this.logAudit(cleanKey, 'LICENSE_UNBANNED', actor, license.hwid, null);

    return {
      success: true,
      message: `License ${cleanKey} has been UNBANNED.`,
      license: this.getLicense(cleanKey)
    };
  }

  /**
   * Reset HWID binding
   */
  resetHwid({ licenseKey, actor = 'admin' }) {
    const cleanKey = licenseKey.trim().toUpperCase();
    const license = this.getLicense(cleanKey);
    if (!license) {
      return { success: false, message: 'License not found.' };
    }

    const previousHwid = license.hwid;
    db.prepare(`
      UPDATE licenses
      SET hwid = NULL, activated_at = NULL
      WHERE id = ?
    `).run(license.id);

    this.logAudit(cleanKey, 'HWID_RESET', actor, previousHwid, null);

    return {
      success: true,
      message: `HWID reset for license ${cleanKey}. Device can now re-activate.`,
      license: this.getLicense(cleanKey)
    };
  }

  /**
   * Delete a license completely
   */
  deleteLicense({ licenseKey, actor = 'admin' }) {
    const cleanKey = licenseKey.trim().toUpperCase();
    const license = this.getLicense(cleanKey);
    if (!license) {
      return { success: false, message: 'License not found.' };
    }

    db.prepare('DELETE FROM licenses WHERE id = ?').run(license.id);
    this.logAudit(cleanKey, 'LICENSE_DELETED', actor, license.hwid, null);

    return {
      success: true,
      message: `License ${cleanKey} has been permanently deleted.`
    };
  }

  /**
   * List licenses with pagination and filter
   */
  listLicenses({ status, search, page = 1, limit = 20 }) {
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    let whereClauses = [];
    let params = [];

    if (status && status !== 'all') {
      whereClauses.push('status = ?');
      params.push(status.toLowerCase());
    }

    if (search) {
      whereClauses.push('(license_key LIKE ? OR discord_user_id LIKE ? OR discord_username LIKE ? OR notes LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM licenses ${whereSql}`).get(...params);
    const total = countRow ? countRow.total : 0;

    const licenses = db.prepare(`
      SELECT * FROM licenses
      ${whereSql}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).all(...params, parsedLimit, offset);

    return {
      licenses,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit) || 1
      }
    };
  }
}

module.exports = new LicenseService();
