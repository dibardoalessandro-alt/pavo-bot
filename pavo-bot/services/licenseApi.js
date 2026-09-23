const config = require('../config.json');

const API_BASE_URL = process.env.LICENSE_API_URL || 'http://localhost:5000';
const ADMIN_API_KEY = process.env.LICENSE_API_KEY || process.env.ADMIN_API_KEY || 'pavo_secret_admin_key_change_me_in_production_2026';

class LicenseApiClient {
  constructor() {
    this.baseUrl = API_BASE_URL.replace(/\/+$/, '');
    this.apiKey = ADMIN_API_KEY;
  }

  async request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Admin-Key': this.apiKey,
      'User-Agent': 'PavoDiscordBot/1.0'
    };

    const options = {
      method,
      headers
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const res = await fetch(url, options);
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || `API error ${res.status}: ${res.statusText}`);
      }

      return data;
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
        throw new Error(`Cannot connect to License Backend at ${this.baseUrl}. Is the backend online?`);
      }
      throw err;
    }
  }

  /**
   * Create a new license key
   */
  async createLicense({ durationDays = null, discordUserId = null, discordUsername = null, notes = null, createdBy = 'discord_bot' }) {
    return this.request('POST', '/api/admin/licenses/create', {
      durationDays,
      discordUserId,
      discordUsername,
      notes,
      createdBy
    });
  }

  /**
   * Ban a license key
   */
  async banLicense(licenseKey, reason = 'Banned by Discord admin', actor = 'discord_admin') {
    return this.request('POST', '/api/admin/licenses/ban', {
      licenseKey,
      reason,
      actor
    });
  }

  /**
   * Unban a license key
   */
  async unbanLicense(licenseKey, actor = 'discord_admin') {
    return this.request('POST', '/api/admin/licenses/unban', {
      licenseKey,
      actor
    });
  }

  /**
   * Get license information
   */
  async getLicense(licenseKey) {
    return this.request('GET', `/api/admin/licenses/${encodeURIComponent(licenseKey.trim().toUpperCase())}`);
  }

  /**
   * List licenses with optional status filter
   */
  async listLicenses({ status = 'all', page = 1, limit = 15 } = {}) {
    return this.request('GET', `/api/admin/licenses?status=${status}&page=${page}&limit=${limit}`);
  }

  /**
   * Reset HWID for a license
   */
  async resetHwid(licenseKey, actor = 'discord_admin') {
    return this.request('POST', '/api/admin/licenses/reset-hwid', {
      licenseKey,
      actor
    });
  }

  /**
   * Delete a license key permanently
   */
  async deleteLicense(licenseKey, actor = 'discord_admin') {
    return this.request('POST', '/api/admin/licenses/delete', {
      licenseKey,
      actor
    });
  }
}

module.exports = new LicenseApiClient();
