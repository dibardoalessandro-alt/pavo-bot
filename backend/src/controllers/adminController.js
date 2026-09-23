const licenseService = require('../services/licenseService');

class AdminController {
  /**
   * POST /api/admin/licenses/create
   */
  async create(req, res) {
    try {
      const {
        durationDays,
        discordUserId,
        discordUsername,
        notes,
        maxDevices,
        createdBy,
        customKey,
        count = 1
      } = req.body;

      const numLicenses = Math.min(Math.max(1, parseInt(count, 10) || 1), 50);
      const createdLicenses = [];

      for (let i = 0; i < numLicenses; i++) {
        const license = licenseService.createLicense({
          durationDays,
          discordUserId,
          discordUsername,
          notes,
          maxDevices,
          createdBy: createdBy || 'discord_bot',
          customKey: numLicenses === 1 ? customKey : null
        });
        createdLicenses.push(license);
      }

      return res.status(201).json({
        success: true,
        message: `Successfully generated ${createdLicenses.length} license(s).`,
        licenses: createdLicenses,
        license: createdLicenses[0] // convenient shorthand for single creation
      });
    } catch (err) {
      console.error('[ADMIN CREATE ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'ServerError',
        message: err.message || 'Failed to create license.'
      });
    }
  }

  /**
   * POST /api/admin/licenses/ban
   */
  async ban(req, res) {
    try {
      const { licenseKey, key, reason, actor } = req.body;
      const targetKey = licenseKey || key;

      if (!targetKey) {
        return res.status(400).json({
          success: false,
          message: 'License key is required.'
        });
      }

      const result = licenseService.banLicense({
        licenseKey: targetKey,
        reason,
        actor: actor || 'admin'
      });

      if (!result.success) {
        return res.status(404).json(result);
      }

      return res.status(200).json(result);
    } catch (err) {
      console.error('[ADMIN BAN ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'ServerError',
        message: err.message
      });
    }
  }

  /**
   * POST /api/admin/licenses/unban
   */
  async unban(req, res) {
    try {
      const { licenseKey, key, actor } = req.body;
      const targetKey = licenseKey || key;

      if (!targetKey) {
        return res.status(400).json({
          success: false,
          message: 'License key is required.'
        });
      }

      const result = licenseService.unbanLicense({
        licenseKey: targetKey,
        actor: actor || 'admin'
      });

      if (!result.success) {
        return res.status(404).json(result);
      }

      return res.status(200).json(result);
    } catch (err) {
      console.error('[ADMIN UNBAN ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'ServerError',
        message: err.message
      });
    }
  }

  /**
   * POST /api/admin/licenses/delete
   */
  async delete(req, res) {
    try {
      const { licenseKey, key, actor } = req.body;
      const targetKey = licenseKey || key;

      if (!targetKey) {
        return res.status(400).json({
          success: false,
          message: 'License key is required.'
        });
      }

      const result = licenseService.deleteLicense({
        licenseKey: targetKey,
        actor: actor || 'admin'
      });

      if (!result.success) {
        return res.status(404).json(result);
      }

      return res.status(200).json(result);
    } catch (err) {
      console.error('[ADMIN DELETE ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'ServerError',
        message: err.message
      });
    }
  }

  /**
   * POST /api/admin/licenses/reset-hwid
   */
  async resetHwid(req, res) {
    try {
      const { licenseKey, key, actor } = req.body;
      const targetKey = licenseKey || key;

      if (!targetKey) {
        return res.status(400).json({
          success: false,
          message: 'License key is required.'
        });
      }

      const result = licenseService.resetHwid({
        licenseKey: targetKey,
        actor: actor || 'admin'
      });

      if (!result.success) {
        return res.status(404).json(result);
      }

      return res.status(200).json(result);
    } catch (err) {
      console.error('[ADMIN RESET HWID ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'ServerError',
        message: err.message
      });
    }
  }

  /**
   * GET /api/admin/licenses
   */
  async list(req, res) {
    try {
      const { status, search, page, limit } = req.query;
      const result = licenseService.listLicenses({
        status,
        search,
        page,
        limit
      });

      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (err) {
      console.error('[ADMIN LIST ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'ServerError',
        message: err.message
      });
    }
  }

  /**
   * GET /api/admin/licenses/:license
   */
  async getOne(req, res) {
    try {
      const licenseKey = req.params.license;
      const license = licenseService.getLicense(licenseKey);

      if (!license) {
        return res.status(404).json({
          success: false,
          message: 'License not found.'
        });
      }

      return res.status(200).json({
        success: true,
        license
      });
    } catch (err) {
      console.error('[ADMIN GET ONE ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'ServerError',
        message: err.message
      });
    }
  }
}

const controller = new AdminController();
module.exports = {
  create: controller.create.bind(controller),
  ban: controller.ban.bind(controller),
  unban: controller.unban.bind(controller),
  delete: controller.delete.bind(controller),
  resetHwid: controller.resetHwid.bind(controller),
  list: controller.list.bind(controller),
  getOne: controller.getOne.bind(controller)
};
