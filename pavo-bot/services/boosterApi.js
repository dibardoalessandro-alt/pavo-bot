const API_BASE_URL = process.env.LICENSE_API_URL || 'http://localhost:5000';
const ADMIN_API_KEY = process.env.LICENSE_API_KEY || process.env.ADMIN_API_KEY || 'pavo_secret_admin_key_change_me_in_production_2026';

class BoosterApiClient {
  constructor() {
    this.baseUrl = API_BASE_URL.replace(/\/+$/, '');
    this.apiKey = ADMIN_API_KEY;
  }

  async request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Admin-Key': this.apiKey,
      'User-Agent': 'PavoDiscordBot-Booster/1.0'
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
        const errorMsg = data?.message || `API error ${res.status}: ${res.statusText}`;
        const err = new Error(errorMsg);
        err.statusCode = res.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
        throw new Error(`Cannot connect to Pavo Backend at ${this.baseUrl}. Is the backend online?`);
      }
      throw err;
    }
  }

  /**
   * Verify 2-boost user
   */
  async verifyUser({ discordUserId, discordUsername, boostCount = 2, verifiedBy = 'discord_admin', notes = null }) {
    return this.request('POST', '/api/booster/admin/verify', {
      discordUserId,
      discordUsername,
      boostCount,
      verifiedBy,
      notes
    });
  }

  /**
   * Revoke user booster access
   */
  async revokeUser({ discordUserId, revokedBy = 'discord_bot', reason = 'Stopped boosting server' }) {
    return this.request('POST', '/api/booster/admin/revoke', {
      discordUserId,
      revokedBy,
      reason
    });
  }

  /**
   * Generate temporary single-use code for verified booster
   */
  async generateCode({ discordUserId, ttlSeconds = 300 }) {
    return this.request('POST', '/api/booster/code/generate', {
      discordUserId,
      ttlSeconds
    });
  }

  /**
   * Get user status
   */
  async getUserStatus(discordUserId) {
    return this.request('GET', `/api/booster/admin/status/${encodeURIComponent(discordUserId)}`);
  }

  /**
   * List sessions
   */
  async listSessions(status = 'all', limit = 20) {
    return this.request('GET', `/api/booster/admin/sessions?status=${status}&limit=${limit}`);
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(userId = null, limit = 15) {
    const query = userId ? `?userId=${encodeURIComponent(userId)}&limit=${limit}` : `?limit=${limit}`;
    return this.request('GET', `/api/booster/admin/audit-logs${query}`);
  }
}

module.exports = new BoosterApiClient();
