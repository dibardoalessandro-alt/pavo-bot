const licenseService = require('../services/licenseService');

class LicenseController {
  /**
   * Helper to extract client IP from headers/socket
   */
  getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return req.socket ? req.socket.remoteAddress : null;
  }

  /**
   * POST /api/license/validate
   * Validates a license key and checks if banned, expired, or HWID mismatched
   */
  async validate(req, res) {
    try {
      const { licenseKey, key, hwid } = req.body || {};
      const targetKey = licenseKey || key;
      const ipAddress = this.getClientIp(req);

      if (!targetKey) {
        return res.status(400).json({
          valid: false,
          code: 'MISSING_KEY',
          message: 'License key is required.'
        });
      }

      const result = licenseService.validateLicense({
        licenseKey: targetKey,
        hwid,
        ipAddress
      });

      if (!result.valid) {
        // Return 403 for banned/expired/hwid mismatch, 404 for not found, 400 for bad request
        const statusCode = result.code === 'NOT_FOUND' ? 404 : 403;
        return res.status(statusCode).json(result);
      }

      return res.status(200).json(result);
    } catch (err) {
      console.error('[API VALIDATE ERROR]', err);
      return res.status(500).json({
        valid: false,
        code: 'SERVER_ERROR',
        message: 'Internal server error during license validation.'
      });
    }
  }

  /**
   * POST /api/license/activate
   * Binds HWID and activates a license
   */
  async activate(req, res) {
    try {
      const { licenseKey, key, hwid } = req.body || {};
      const targetKey = licenseKey || key;
      const ipAddress = this.getClientIp(req);

      if (!targetKey || !hwid) {
        return res.status(400).json({
          valid: false,
          code: 'MISSING_PARAMETERS',
          message: 'Both license key and HWID are required for activation.'
        });
      }

      const result = licenseService.activateLicense({
        licenseKey: targetKey,
        hwid,
        ipAddress
      });

      if (!result.valid) {
        const statusCode = result.code === 'NOT_FOUND' ? 404 : 403;
        return res.status(statusCode).json(result);
      }

      return res.status(200).json(result);
    } catch (err) {
      console.error('[API ACTIVATE ERROR]', err);
      return res.status(500).json({
        valid: false,
        code: 'SERVER_ERROR',
        message: 'Internal server error during activation.'
      });
    }
  }

  /**
   * POST /api/license/heartbeat
   * Client periodic ping to keep session alive and detect bans
   */
  async heartbeat(req, res) {
    try {
      const { licenseKey, key, hwid } = req.body || {};
      const targetKey = licenseKey || key;
      const ipAddress = this.getClientIp(req);

      if (!targetKey) {
        return res.status(400).json({
          valid: false,
          code: 'MISSING_KEY',
          message: 'License key is required.'
        });
      }

      const result = licenseService.heartbeat({
        licenseKey: targetKey,
        hwid,
        ipAddress
      });

      if (!result.valid) {
        const statusCode = result.code === 'NOT_FOUND' ? 404 : 403;
        return res.status(statusCode).json(result);
      }

      return res.status(200).json(result);
    } catch (err) {
      console.error('[API HEARTBEAT ERROR]', err);
      return res.status(500).json({
        valid: false,
        code: 'SERVER_ERROR',
        message: 'Internal server error during heartbeat.'
      });
    }
  }
}

const controller = new LicenseController();
// Bind methods to instance
module.exports = {
  validate: controller.validate.bind(controller),
  activate: controller.activate.bind(controller),
  heartbeat: controller.heartbeat.bind(controller)
};
