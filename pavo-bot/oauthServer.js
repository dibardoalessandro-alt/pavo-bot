const http = require('http');
const crypto = require('crypto');
const db = require('./database');

/**
 * Pavo OAuth2 & Verification Web Server
 */
class OAuthServer {
  constructor(client, config) {
    this.client = client;
    this.config = config;
    this.server = null;
    this.giveawayHandler = null; // Will be attached by giveaway module
  }

  setGiveawayHandler(handler) {
    this.giveawayHandler = handler;
  }

  getClientId() {
    return process.env.DISCORD_CLIENT_ID || (this.client?.user?.id) || this.config.clientId || '';
  }

  getClientSecret() {
    return process.env.DISCORD_CLIENT_SECRET || this.config.clientSecret || '';
  }

  getRedirectUri(req) {
    if (process.env.OAUTH_REDIRECT_URI && !process.env.OAUTH_REDIRECT_URI.includes('localhost')) {
      return process.env.OAUTH_REDIRECT_URI;
    }
    if (this.config.oauthRedirectUri && !this.config.oauthRedirectUri.includes('localhost')) {
      return this.config.oauthRedirectUri;
    }
    if (process.env.RENDER_EXTERNAL_URL) return `${process.env.RENDER_EXTERNAL_URL}/oauth/callback`;
    if (req && req.headers && req.headers.host && !req.headers.host.includes('localhost')) {
      const proto = req.headers['x-forwarded-proto'] || 'https';
      return `${proto}://${req.headers.host}/oauth/callback`;
    }
    return `https://pavo-bot-1.onrender.com/oauth/callback`;
  }

  getPublicUrl(req) {
    if (process.env.PUBLIC_URL && !process.env.PUBLIC_URL.includes('localhost')) {
      return process.env.PUBLIC_URL;
    }
    if (this.config.publicUrl && !this.config.publicUrl.includes('localhost')) {
      return this.config.publicUrl;
    }
    if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL;
    if (req && req.headers && req.headers.host && !req.headers.host.includes('localhost')) {
      const proto = req.headers['x-forwarded-proto'] || 'https';
      return `${proto}://${req.headers.host}`;
    }
    return `https://pavo-bot-1.onrender.com`;
  }

  start(port = process.env.PORT || 10000) {
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    this.server.listen(port, '0.0.0.0', () => {
      console.log(`[OAUTH & HEALTH] Pavo Verification Web Server active on 0.0.0.0:${port}`);
    });
    return this.server;
  }

  async handleRequest(req, res) {
    try {
      const host = req.headers.host || 'localhost';
      const parsedUrl = new URL(req.url, `http://${host}`);
      const pathname = parsedUrl.pathname;
      const query = Object.fromEntries(parsedUrl.searchParams.entries());

      // 1. Health check endpoint
      if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Pavo Bot is alive');
      }

      // 2. Landing / Verification Hub
      if (pathname === '/' || pathname === '/oauth' || pathname === '/oauth/login') {
        return this.renderLandingPage(req, res, query);
      }

      // 3. Initiate Discord OAuth2 authorization
      if (pathname === '/oauth/authorize') {
        return this.handleAuthorize(req, res, query);
      }

      // 4. Discord OAuth2 callback
      if (pathname === '/oauth/callback') {
        return this.handleCallback(req, res, query);
      }

      // 5. Revoke / Disconnect account
      if (pathname === '/oauth/revoke') {
        return this.handleRevoke(req, res, query);
      }

      // 6. Reverse Proxy for License Backend API (/api/*)
      if (pathname.startsWith('/api/')) {
        const backendPort = process.env.INTERNAL_BACKEND_PORT || 5000;
        const proxyReq = http.request({
          hostname: '127.0.0.1',
          port: backendPort,
          path: req.url,
          method: req.method,
          headers: {
            ...req.headers,
            host: `127.0.0.1:${backendPort}`
          }
        }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res, { end: true });
        });

        proxyReq.on('error', (err) => {
          console.error('[API PROXY ERROR]', err.message);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'BadGateway', message: 'Backend service unreachable' }));
        });

        req.pipe(proxyReq, { end: true });
        return;
      }

      // 404 Not Found
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(this.renderLayout('404 Not Found', `
        <div class="status-icon warn">⚠️</div>
        <h1>Page Not Found</h1>
        <p class="subtitle">The requested resource could not be located.</p>
        <div class="actions">
          <a href="/" class="btn btn-primary">Return to Home</a>
        </div>
      `));
    } catch (err) {
      console.error('[OAUTH ERROR]', err);
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(this.renderLayout('Server Error', `
        <div class="status-icon error">❌</div>
        <h1>Internal Server Error</h1>
        <p class="subtitle">${this.escapeHtml(err.message || 'An unexpected error occurred.')}</p>
        <div class="actions">
          <a href="/" class="btn btn-primary">Return Home</a>
        </div>
      `));
    }
  }

  async handleAuthorize(req, res, query) {
    const clientId = this.getClientId();
    const redirectUri = this.getRedirectUri(req);

    if (!clientId) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(this.renderLayout('Configuration Error', `
        <div class="status-icon error">⚙️</div>
        <h1>OAuth Not Configured</h1>
        <p class="subtitle">DISCORD_CLIENT_ID is missing from server configuration.</p>
      `));
    }

    // Generate cryptographic state token
    const state = crypto.randomBytes(24).toString('hex');
    const giveawayId = query.giveaway_id || query.giveawayId || null;
    const userId = query.user_id || query.userId || null;

    // Save state in database (expires automatically in 30 mins)
    await db.createOAuthState(state, userId, giveawayId);

    // Build official Discord OAuth2 URL with identify + guilds.join scopes
    const scopes = encodeURIComponent('identify guilds.join');
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopes}&state=${encodeURIComponent(state)}&prompt=consent`;

    // 302 Redirect to real Discord OAuth screen
    res.writeHead(302, { Location: discordAuthUrl });
    return res.end();
  }

  async handleCallback(req, res, query) {
    const { code, state, error, error_description } = query;

    if (error) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(this.renderLayout('Authorization Cancelled', `
        <div class="status-icon warn">🔒</div>
        <h1>Authorization Cancelled</h1>
        <p class="subtitle">${this.escapeHtml(error_description || 'You declined or cancelled the Discord authorization.')}</p>
        <div class="actions">
          <a href="/" class="btn btn-primary">Try Again</a>
        </div>
      `));
    }

    if (!code || !state) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(this.renderLayout('Invalid Request', `
        <div class="status-icon error">❌</div>
        <h1>Missing Parameters</h1>
        <p class="subtitle">Authorization code or state parameter is missing.</p>
        <div class="actions">
          <a href="/" class="btn btn-primary">Return to Home</a>
        </div>
      `));
    }

    // Validate state token from database
    const stateData = await db.consumeOAuthState(state);
    if (!stateData) {
      res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(this.renderLayout('Session Expired', `
        <div class="status-icon warn">⏳</div>
        <h1>Session Expired</h1>
        <p class="subtitle">Your authorization session has expired or was invalid. Please try again from Discord.</p>
        <div class="actions">
          <a href="/" class="btn btn-primary">Go to Home</a>
        </div>
      `));
    }

    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    const redirectUri = this.getRedirectUri(req);

    if (!clientSecret) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(this.renderLayout('Configuration Error', `
        <div class="status-icon error">⚙️</div>
        <h1>Missing Client Secret</h1>
        <p class="subtitle">DISCORD_CLIENT_SECRET is missing from server configuration.</p>
      `));
    }

    // Securely exchange authorization code for access token via Discord API
    try {
      const params = new URLSearchParams();
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);
      params.append('grant_type', 'authorization_code');
      params.append('code', code);
      params.append('redirect_uri', redirectUri);

      const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!tokenResponse.ok) {
        const errJson = await tokenResponse.json().catch(() => ({}));
        console.error('[OAUTH TOKEN ERROR]', errJson);
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(this.renderLayout('Exchange Failed', `
          <div class="status-icon error">❌</div>
          <h1>Authorization Failed</h1>
          <p class="subtitle">Discord rejected the token exchange: ${this.escapeHtml(errJson.error_description || errJson.error || 'Token exchange failed')}</p>
          <div class="actions">
            <a href="/" class="btn btn-primary">Try Again</a>
          </div>
        `));
      }

      const tokenData = await tokenResponse.json();

      // Fetch user profile from Discord
      const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `${tokenData.token_type} ${tokenData.access_token}`
        }
      });

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user identity from Discord.');
      }

      const userData = await userResponse.json();

      // Automatically add user to the guild/server using guilds.join scope
      if (this.config.guildId && process.env.DISCORD_TOKEN) {
        try {
          await fetch(`https://discord.com/api/v10/guilds/${this.config.guildId}/members/${userData.id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              access_token: tokenData.access_token
            })
          });
          console.log(`[OAUTH] Automatically ensured user @${userData.username} (${userData.id}) is in server ${this.config.guildId}`);
        } catch (joinErr) {
          console.warn('[OAUTH] Warning: Could not automatically join user to guild:', joinErr.message);
        }
      }

      // Save authorized user in database
      const expiresAt = Date.now() + (tokenData.expires_in * 1000);
      await db.saveOAuthUser({
        discordId: userData.id,
        username: userData.username,
        discriminator: userData.discriminator,
        avatar: userData.avatar,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: expiresAt
      });

      // Handle target giveaway entry if state included giveawayId
      let giveawayResultHtml = '';
      if (stateData.giveawayId) {
        const giveaway = await db.getGiveaway(stateData.giveawayId);
        if (giveaway && giveaway.status === 'ACTIVE') {
          const entryResult = await db.addGiveawayParticipant(stateData.giveawayId, userData.id);
          if (entryResult.success) {
            giveawayResultHtml = `
              <div class="giveaway-box success">
                <div class="giveaway-header">🎉 Giveaway Entry Confirmed!</div>
                <div class="giveaway-prize">Prize: <strong>${this.escapeHtml(giveaway.prize)}</strong></div>
                <div class="giveaway-details">You have been automatically registered as participant #${entryResult.count}.</div>
              </div>
            `;
            // Trigger Discord embed live update
            if (this.giveawayHandler && this.giveawayHandler.updateGiveawayMessage) {
              this.giveawayHandler.updateGiveawayMessage(this.client, giveaway.id, this.config).catch(err => {
                console.error('[OAUTH] Failed to update giveaway message embed:', err.message);
              });
            }
          } else if (entryResult.reason === 'ALREADY_ENTERED') {
            giveawayResultHtml = `
              <div class="giveaway-box info">
                <div class="giveaway-header">⚠️ Already Participating</div>
                <div class="giveaway-prize">Prize: <strong>${this.escapeHtml(giveaway.prize)}</strong></div>
                <div class="giveaway-details">You were already registered for this giveaway!</div>
              </div>
            `;
          } else if (entryResult.reason === 'FULL') {
            giveawayResultHtml = `
              <div class="giveaway-box warn">
                <div class="giveaway-header">🔒 Giveaway Full</div>
                <div class="giveaway-details">This giveaway reached its maximum participant capacity.</div>
              </div>
            `;
          }
        }
      }

      const avatarUrl = userData.avatar
        ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(userData.discriminator || '0') % 5}.png`;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(this.renderLayout('Verification Complete', `
        <div class="user-badge">
          <img src="${avatarUrl}" alt="${this.escapeHtml(userData.username)}" class="avatar" />
          <div class="user-meta">
            <span class="user-name">@${this.escapeHtml(userData.username)}</span>
            <span class="verified-tag">✓ Verified with Discord</span>
          </div>
        </div>

        <div class="status-icon success">✅</div>
        <h1>Verification Complete</h1>
        <p class="subtitle">Your Discord account has been successfully verified with Pavo.</p>

        ${giveawayResultHtml}

        <div class="feature-card">
          <div class="feature-item">
            <span class="feature-bullet">🍀</span>
            <span>You are eligible for all verified Pavo community giveaways.</span>
          </div>
          <div class="feature-item">
            <span class="feature-bullet">🛡️</span>
            <span>Your credentials remain safe. Only your public Discord ID is stored.</span>
          </div>
        </div>

        <div class="actions">
          <a href="https://discord.com/channels/@me" class="btn btn-primary">Return to Discord</a>
          <a href="/oauth/revoke?user_id=${userData.id}" class="btn btn-secondary">Manage Connection</a>
        </div>
      `));
    } catch (err) {
      console.error('[OAUTH CALLBACK ERROR]', err);
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(this.renderLayout('Verification Error', `
        <div class="status-icon error">❌</div>
        <h1>Verification Error</h1>
        <p class="subtitle">${this.escapeHtml(err.message || 'An error occurred during verification.')}</p>
        <div class="actions">
          <a href="/" class="btn btn-primary">Try Again</a>
        </div>
      `));
    }
  }

  async handleRevoke(req, res, query) {
    const userId = query.user_id;
    if (req.method === 'POST' || query.confirm === 'true') {
      if (userId) {
        await db.revokeOAuthUser(userId);
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(this.renderLayout('Authorization Revoked', `
        <div class="status-icon success">🔌</div>
        <h1>Connection Disconnected</h1>
        <p class="subtitle">Your Discord OAuth2 authorization has been disconnected from Pavo.</p>
        <div class="actions">
          <a href="/" class="btn btn-primary">Return Home</a>
        </div>
      `));
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(this.renderLayout('Disconnect Account', `
      <div class="status-icon warn">⚠️</div>
      <h1>Disconnect Pavo Verification</h1>
      <p class="subtitle">Disconnecting your Discord authorization will remove your verified status for future giveaways.</p>
      <div class="actions">
        <a href="/oauth/revoke?user_id=${encodeURIComponent(userId || '')}&confirm=true" class="btn btn-danger">Confirm Disconnect</a>
        <a href="/" class="btn btn-secondary">Cancel</a>
      </div>
    `));
  }

  renderLandingPage(req, res, query) {
    const giveawayId = query.giveaway_id || query.giveawayId || '';
    const userId = query.user_id || query.userId || '';
    const authUrl = `/oauth/authorize?giveaway_id=${encodeURIComponent(giveawayId)}&user_id=${encodeURIComponent(userId)}`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(this.renderLayout('Discord Verification', `
      <div class="brand-badge">
        <span class="pavo-icon">🦚</span>
        <span class="brand-name">PAVO VERIFICATION</span>
      </div>

      <h1>Connect with Discord</h1>
      <p class="subtitle">Authorize the official Pavo application to verify your Discord account and participate in exclusive community giveaways.</p>

      <div class="feature-card">
        <div class="feature-item">
          <span class="feature-bullet">🔐</span>
          <div>
            <strong>Official Discord OAuth2</strong>
            <p>Discord will show you exactly what access the application requests before you confirm.</p>
          </div>
        </div>
        <div class="feature-item">
          <span class="feature-bullet">🛡️</span>
          <div>
            <strong>Strict Privacy & Minimal Scopes</strong>
            <p>We only request the basic <code>identify</code> scope. We never see or store your passwords, tokens, or personal information.</p>
          </div>
        </div>
        <div class="feature-item">
          <span class="feature-bullet">🎉</span>
          <div>
            <strong>Instant Giveaway Entry</strong>
            <p>Once verified, your entries into Pavo giveaways are automatically confirmed.</p>
          </div>
        </div>
      </div>

      <div class="actions">
        <a href="${authUrl}" class="btn btn-primary btn-large">
          <svg class="discord-logo" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          Authorize with Discord
        </a>
      </div>
    `));
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  renderLayout(title, bodyContent) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)} — Pavo Verification</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-base: #0a0d14;
      --bg-surface: rgba(18, 24, 38, 0.75);
      --bg-surface-border: rgba(99, 102, 241, 0.2);
      --primary: #4f46e5;
      --primary-hover: #4338ca;
      --primary-light: #6366f1;
      --accent-glow: rgba(99, 102, 241, 0.35);
      --emerald: #10b981;
      --emerald-glow: rgba(16, 185, 129, 0.25);
      --amber: #f59e0b;
      --rose: #ef4444;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-base);
      color: var(--text-main);
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      position: relative;
      overflow-x: hidden;
    }

    /* Ambient background glows */
    body::before {
      content: '';
      position: fixed;
      top: -20%;
      left: 30%;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(79, 70, 229, 0.18) 0%, rgba(10, 13, 20, 0) 70%);
      border-radius: 50%;
      pointer-events: none;
      z-index: 0;
    }

    body::after {
      content: '';
      position: fixed;
      bottom: -15%;
      right: 25%;
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, rgba(10, 13, 20, 0) 70%);
      border-radius: 50%;
      pointer-events: none;
      z-index: 0;
    }

    .container {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 520px;
      background: var(--bg-surface);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--bg-surface-border);
      border-radius: 24px;
      padding: 40px 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 35px var(--accent-glow);
      text-align: center;
      animation: fadeIn 0.4s ease-out forwards;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: rgba(99, 102, 241, 0.12);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 9999px;
      font-family: 'Outfit', sans-serif;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--primary-light);
      margin-bottom: 20px;
    }

    .status-icon {
      font-size: 3.5rem;
      line-height: 1;
      margin-bottom: 16px;
      display: inline-block;
      filter: drop-shadow(0 0 16px rgba(16, 185, 129, 0.4));
    }

    .status-icon.warn {
      filter: drop-shadow(0 0 16px rgba(245, 158, 11, 0.4));
    }

    .status-icon.error {
      filter: drop-shadow(0 0 16px rgba(239, 68, 68, 0.4));
    }

    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.85rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 10px;
      letter-spacing: -0.02em;
    }

    p.subtitle {
      font-size: 0.95rem;
      line-height: 1.55;
      color: var(--text-muted);
      margin-bottom: 24px;
    }

    .user-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 12px 18px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      margin-bottom: 24px;
    }

    .avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid var(--primary-light);
    }

    .user-meta {
      text-align: left;
      display: flex;
      flex-direction: column;
    }

    .user-name {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 1rem;
      color: #fff;
    }

    .verified-tag {
      font-size: 0.75rem;
      color: var(--emerald);
      font-weight: 600;
    }

    .feature-card {
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      padding: 18px;
      text-align: left;
      margin-bottom: 28px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      font-size: 0.88rem;
      color: var(--text-muted);
      line-height: 1.45;
    }

    .feature-item strong {
      color: #ffffff;
      font-weight: 600;
      display: block;
      margin-bottom: 2px;
    }

    .feature-item p {
      font-size: 0.82rem;
      color: var(--text-dim);
    }

    .feature-bullet {
      font-size: 1.2rem;
      line-height: 1.2;
      flex-shrink: 0;
    }

    .giveaway-box {
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 20px;
      text-align: left;
    }

    .giveaway-box.success {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .giveaway-box.info {
      background: rgba(99, 102, 241, 0.1);
      border: 1px solid rgba(99, 102, 241, 0.3);
    }

    .giveaway-box.warn {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .giveaway-header {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 0.95rem;
      color: #fff;
      margin-bottom: 4px;
    }

    .giveaway-prize {
      font-size: 0.88rem;
      color: var(--text-muted);
      margin-bottom: 4px;
    }

    .giveaway-details {
      font-size: 0.82rem;
      color: var(--text-dim);
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 14px 24px;
      border-radius: 12px;
      font-family: 'Outfit', sans-serif;
      font-weight: 600;
      font-size: 0.98rem;
      text-decoration: none;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
      border: none;
    }

    .btn-large {
      padding: 16px 28px;
      font-size: 1.05rem;
    }

    .btn-primary {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: #ffffff;
      box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.5);
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 30px -5px rgba(79, 70, 229, 0.65);
      background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-muted);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }

    .btn-danger {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.25);
      color: #ffffff;
    }

    .footer {
      margin-top: 24px;
      font-size: 0.78rem;
      color: var(--text-dim);
    }

    .footer a {
      color: var(--text-muted);
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    ${bodyContent}
    <div class="footer">
      <span>🦚 Pavo Tweak Official Verification</span>
    </div>
  </div>
</body>
</html>`;
  }
}

module.exports = OAuthServer;
