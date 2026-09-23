const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
require('dotenv').config();

const db = require('./database');
const config = require('./config.json');

// Import Commands
const ticketCmd = require('./commands/ticket');
const staffCmd = require('./commands/staff');
const salesCmd = require('./commands/sales');
const paymentCmd = require('./commands/payment');
const earningsCmd = require('./commands/earnings');
const giveawayCmd = require('./commands/giveaway');
const oauthCmd = require('./commands/oauth');
const licenseCmd = require('./commands/license');
const legitCheckCmd = require('./commands/legitCheck');
const pavoBoosterCmd = require('./commands/pavoBooster');
const boosterApi = require('./services/boosterApi');
const OAuthServer = require('./oauthServer');

// Clean and validate DISCORD_TOKEN from environment
const rawToken = process.env.DISCORD_TOKEN || '';
const botToken = rawToken.trim().replace(/^["']|["']$/g, '');

if (!botToken || botToken === 'YOUR_BOT_TOKEN_HERE') {
  console.error("======================================================================");
  console.error("❌ CRITICAL ERROR: DISCORD_TOKEN is missing or empty!");
  console.error("Please configure the DISCORD_TOKEN environment variable in Render Dashboard / .env");
  console.error("======================================================================");
  process.exit(1);
}

// Initialize Client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,      // Required to fetch members for staff directory
    GatewayIntentBits.GuildMessages,     // Required to fetch ticket messages
    GatewayIntentBits.MessageContent     // Required to read message content for transcripts
  ]
});

// Map Commands
const commandsMap = new Map();
const commandsJSON = [];

function registerCommand(cmd) {
  commandsMap.set(cmd.data.name, cmd);
  commandsJSON.push(cmd.data.toJSON());
}

// Register command modules
registerCommand(ticketCmd);
registerCommand(staffCmd);
registerCommand(salesCmd);
registerCommand(paymentCmd);
registerCommand(giveawayCmd);
registerCommand(oauthCmd);
registerCommand(licenseCmd);
registerCommand(legitCheckCmd);

if (pavoBoosterCmd.commands) {
  for (const cmd of pavoBoosterCmd.commands) {
    registerCommand(cmd);
  }
}

if (earningsCmd.commands) {
  for (const cmd of earningsCmd.commands) {
    registerCommand(cmd);
  }
}

// Bot Ready event
client.once('ready', async () => {
  console.log("=========================================");
  console.log(`🤖 Pavo Bot logged in as: ${client.user.tag}`);
  console.log("=========================================");

  // Initialize Database
  try {
    await db.initDatabase();
  } catch (dbErr) {
    console.error("CRITICAL: Failed to initialize SQLite database:", dbErr);
    process.exit(1);
  }

  // Register commands
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    if (config.guildId && config.guildId !== "YOUR_GUILD_ID" && config.guildId.match(/^\d+$/)) {
      console.log(`🔄 Refreshing commands for guild: ${config.guildId}...`);
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, config.guildId),
        { body: commandsJSON }
      );
      console.log('✅ Commands refreshed successfully for development guild.');
    } else {
      console.log('🔄 Guild ID not configured. Refreshing commands globally (may take up to an hour)...');
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commandsJSON }
      );
      console.log('✅ Commands refreshed globally.');
    }
  } catch (error) {
    console.error('❌ Failed to register slash commands:', error);
  }

  // Send support ticket panel if configured
  try {
    await ticketCmd.sendTicketPanel(client, config);
  } catch (panelErr) {
    console.error('❌ Failed to initialize support ticket panel:', panelErr);
  }

  // Initialize active giveaway timers and auto-ending
  try {
    await giveawayCmd.initGiveawayScheduler(client, config);
  } catch (giveawayErr) {
    console.error('❌ Failed to initialize giveaway scheduler:', giveawayErr);
  }

  // Ensure 'Pavo Booster' role exists in guild & start booster reconciliation
  try {
    const guild = client.guilds.cache.get(config.guildId) || client.guilds.cache.first();
    if (guild) {
      await pavoBoosterCmd.getOrCreateBoosterRole(guild);
      console.log(`💎 [BOOSTER] Verified 'Pavo Booster' role in guild: ${guild.name}`);
      await pavoBoosterCmd.setupPavoCommandChannel(client, config);
      await pavoBoosterCmd.sendOrUpdatePromoEmbed(client, config);
    }

    // Periodic booster reconciliation every 5 minutes (checks if members left guild)
    setInterval(async () => {
      try {
        const targetGuild = client.guilds.cache.get(config.guildId) || client.guilds.cache.first();
        if (!targetGuild) return;

        const boosterRole = targetGuild.roles.cache.find(r => r.name === 'Pavo Booster');
        if (!boosterRole) return;

        // Check if any active sessions belong to users who left the server
        const sessionsRes = await boosterApi.listSessions('active', 50).catch(() => null);
        const sessions = sessionsRes?.data || [];

        for (const s of sessions) {
          const m = await targetGuild.members.fetch(s.discord_user_id).catch(() => null);
          if (!m) {
            console.log(`[AUTO-REVOKE] Member ${s.discord_user_id} left guild. Revoking sessions...`);
            await boosterApi.revokeUser({
              discordUserId: s.discord_user_id,
              revokedBy: 'Periodic Guild Sync',
              reason: 'Member is no longer in Discord server'
            }).catch(() => {});
          }
        }
      } catch (scanErr) {
        console.error('[BOOSTER SCAN ERROR]', scanErr.message);
      }
    }, 5 * 60 * 1000);
  } catch (boosterInitErr) {
    console.error('❌ Failed to initialize booster role/scheduler:', boosterInitErr);
  }
});

// Dedicated PavoTweak Command Channel Auto-Cleanup Listener
client.on('messageCreate', async message => {
  try {
    if (!message.guild || message.author.bot) return;

    const cmdChannelId = config.pavoCommandChannelId;
    if (cmdChannelId && message.channel.id === cmdChannelId) {
      // Delete any non-slash chat messages / spam
      await message.delete().catch(() => {});

      // Send self-destructing warning
      const warnMsg = await message.channel.send({
        content: `⚠️ <@${message.author.id}>, questo canale è riservato **esclusivamente ai comandi slash** (es. \`/pavo-access\`, \`/pavo-status\`). La chat normale non è consentita.`
      }).catch(() => null);

      if (warnMsg) {
        setTimeout(() => {
          warnMsg.delete().catch(() => {});
        }, 4000);
      }
    }
  } catch (cleanErr) {
    console.error('[AUTO-CLEANUP ERROR]', cleanErr.message);
  }
});

// Real-time Event: Member updates (e.g. stopped boosting)
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    // Check if user stopped boosting
    const wasBoosting = !!oldMember.premiumSince;
    const isBoosting = !!newMember.premiumSince;

    if (wasBoosting && !isBoosting) {
      console.log(`⚡ [EVENT] ${newMember.user.tag} (${newMember.id}) stopped boosting the server!`);
      const boosterRole = newMember.guild.roles.cache.find(r => r.name === 'Pavo Booster');
      if (boosterRole && newMember.roles.cache.has(boosterRole.id)) {
        await newMember.roles.remove(boosterRole, 'Stopped boosting server');
      }

      await boosterApi.revokeUser({
        discordUserId: newMember.id,
        revokedBy: 'Discord Event Listener',
        reason: 'Event trigger: member stopped boosting server'
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[GUILD_MEMBER_UPDATE ERROR]', err);
  }
});

// Real-time Event: Member left the server
client.on('guildMemberRemove', async member => {
  try {
    console.log(`⚡ [EVENT] Member left server: ${member.user.tag} (${member.id})`);
    await boosterApi.revokeUser({
      discordUserId: member.id,
      revokedBy: 'Server Leave Event',
      reason: 'Member left Discord server'
    }).catch(() => {});
  } catch (err) {
    console.error('[GUILD_MEMBER_REMOVE ERROR]', err);
  }
});

// Interaction Event Listener
client.on('interactionCreate', async interaction => {
  // 1. Chat input (slash commands)
  if (interaction.isChatInputCommand()) {
    const command = commandsMap.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, config);
    } catch (err) {
      console.error(`Error executing command ${interaction.commandName}:`, err);
      const errMsg = { content: `❌ An error occurred executing this command: ${err.message}`, ephemeral: true };
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(errMsg).catch(() => {});
      } else {
        await interaction.reply(errMsg).catch(() => {});
      }
    }
  }

  // 2. Buttons
  else if (interaction.isButton()) {
    if (interaction.customId.startsWith('ticket_')) {
      try {
        await ticketCmd.handleButton(interaction, config);
      } catch (err) {
        console.error(`Error handling ticket button interaction:`, err);
        const errMsg = { content: `❌ Error handling action: ${err.message}`, ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errMsg).catch(() => {});
        } else {
          await interaction.reply(errMsg).catch(() => {});
        }
      }
    } else if (interaction.customId.startsWith('giveaway_')) {
      try {
        await giveawayCmd.handleButton(interaction, config);
      } catch (err) {
        console.error(`Error handling giveaway button interaction:`, err);
        const errMsg = { content: `❌ Error entering giveaway: ${err.message}`, ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errMsg).catch(() => {});
        } else {
          await interaction.reply(errMsg).catch(() => {});
        }
      }
    } else if (interaction.customId.startsWith('legit_vote_')) {
      try {
        await legitCheckCmd.handleButton(interaction, config);
      } catch (err) {
        console.error(`Error handling legit check vote interaction:`, err);
        const errMsg = { content: `❌ Error handling vote: ${err.message}`, ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errMsg).catch(() => {});
        } else {
          await interaction.reply(errMsg).catch(() => {});
        }
      }
    }
  }

  // 3. Modals
  else if (interaction.isModalSubmit()) {
    if (interaction.customId === 'ticket_purchase_modal' || interaction.customId.startsWith('tweak_specs_modal')) {
      try {
        await ticketCmd.handleModal(interaction, config);
      } catch (err) {
        console.error(`Error handling modal submit:`, err);
        const errMsg = { content: `❌ Error logging action: ${err.message}`, ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errMsg).catch(() => {});
        } else {
          await interaction.reply(errMsg).catch(() => {});
        }
      }
    }
  }

  // 4. String Select Menus
  else if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'ticket_select_product') {
      try {
        await ticketCmd.handleSelectProduct(interaction, config);
      } catch (err) {
        console.error(`Error handling string select interaction:`, err);
        const errMsg = { content: `❌ Error handling selection: ${err.message}`, ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errMsg).catch(() => {});
        } else {
          await interaction.reply(errMsg).catch(() => {});
        }
      }
    }
  }
});

// ============================================
// Production Error Handling & Resilience
// ============================================

// Discord.js client-level errors (network drops, API errors, etc.)
// These do NOT crash the bot — discord.js reconnects automatically.
client.on('error', error => {
  console.error('[CLIENT ERROR] Discord client encountered an error:', error.message);
});

client.on('warn', warning => {
  console.warn('[CLIENT WARN]', warning);
});

client.on('disconnect', () => {
  console.warn('[CLIENT] Bot disconnected from Discord gateway. Reconnecting...');
});

client.on('reconnecting', () => {
  console.log('[CLIENT] Reconnecting to Discord gateway...');
});

// Process-level error handling (prevents crash on unhandled errors)
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION] Promise:', promise, 'Reason:', reason);
});

process.on('uncaughtException', error => {
  console.error('[UNCAUGHT EXCEPTION]', error);
  // Don't exit — let the bot try to keep running unless it's truly fatal
});

// Graceful shutdown for cloud environments (Render sends SIGTERM on redeploy)
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] Received SIGTERM signal. Shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] Received SIGINT signal. Shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

// ============================================
// OAuth2 Verification & HTTP Health Check Server
// ============================================
const PORT = process.env.PORT || 10000;
const oauthServer = new OAuthServer(client, config);
oauthServer.setGiveawayHandler(giveawayCmd);
oauthServer.start(PORT);

// ============================================
// Auto Keep-Alive / Anti-Sleep Ping
// Prevents Render free instances from going to sleep
// ============================================
const https = require('https');

function keepAlivePing() {
  const targetUrls = [
    process.env.PUBLIC_URL || config.publicUrl || 'https://pavo-bot-1.onrender.com',
    process.env.LICENSE_API_URL || 'https://pavo-tweak-suite.onrender.com'
  ];

  targetUrls.forEach(baseUrl => {
    try {
      const fullUrl = `${baseUrl.replace(/\/$/, '')}/health`;
      const clientModule = fullUrl.startsWith('https') ? https : http;
      clientModule.get(fullUrl, (res) => {
        res.resume(); // Discard response data
      }).on('error', (err) => {
        // Silent catch for network blips
      });
    } catch (_) {}
  });
}

// Ping every 9 minutes (Render free tier spins down after 15 minutes of inactivity)
setInterval(keepAlivePing, 9 * 60 * 1000);
setTimeout(keepAlivePing, 45 * 1000);

// ============================================
// Start Client
// ============================================
console.log('[STARTUP] Pavo Bot is starting...');
console.log(`[STARTUP] Node.js ${process.version} | discord.js v${require('discord.js').version}`);
console.log(`[STARTUP] Environment: ${process.env.NODE_ENV || 'development'}`);

client.login(botToken).catch(err => {
  console.error("CRITICAL: Failed to login to Discord client:", err.message);
  console.error("Please ensure the DISCORD_TOKEN environment variable contains a valid Bot Token!");
  process.exit(1);
});
