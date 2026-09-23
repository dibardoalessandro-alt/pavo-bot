const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const boosterApi = require('../services/boosterApi');

// Helper to get or ensure "Pavo Booster" role exists in guild
async function getOrCreateBoosterRole(guild) {
  let role = guild.roles.cache.find(r => r.name === 'Pavo Booster');
  if (!role) {
    try {
      role = await guild.roles.create({
        name: 'Pavo Booster',
        color: 0x9333EA, // Vibrant Purple / Booster Indigo
        reason: 'Pavo Tweak 2-Boost Access Tier Role',
        hoist: true
      });
      console.log(`[BOOSTER] Created role 'Pavo Booster' with ID: ${role.id}`);
    } catch (err) {
      console.error('[BOOSTER] Error creating Pavo Booster role:', err);
    }
  }
  return role;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. /pavo-access (User command)
// ─────────────────────────────────────────────────────────────────────────────
const pavoAccessCmd = {
  data: new SlashCommandBuilder()
    .setName('pavo-access')
    .setDescription('Generate a single-use authentication code for PavoTweak Booster CLI'),

  async execute(interaction, config) {
    await interaction.deferReply({ flags: 64 }); // Ephemeral

    const userId = interaction.user.id;
    const member = interaction.member;

    try {
      // 1. Check if member has Pavo Booster role or active verification
      const boosterRole = member?.roles?.cache.find(r => r.name === 'Pavo Booster');
      const backendStatus = await boosterApi.getUserStatus(userId).catch(() => null);

      const isVerified = backendStatus?.data?.isVerified === true;
      const isRoleHolder = !!boosterRole;

      // Real booster check (if member has role or backend verified)
      if (!isVerified && !isRoleHolder) {
        const deniedEmbed = new EmbedBuilder()
          .setTitle('🛡️ PAVO TWEAK ACCESS: NOT ELIGIBLE')
          .setColor(0xEF4444)
          .setDescription(
            `### ❌ Access Denied\n` +
            `PavoTweak CLI is reserved exclusively for **Pavo Server Boosters**.\n\n` +
            `**Requirement:**\n` +
            `💎 **2 Server Boosts** to this Discord server.\n\n` +
            `*Your PavoTweak access is currently unavailable.*`
          )
          .addFields(
            { name: '🌟 How to get access?', value: '1. Boost this server **2 times**.\n2. Request an administrator/staff to verify your boost status.\n3. Run `/pavo-access` again to receive your access code.', inline: false },
            { name: '❓ Need Help?', value: 'Type `/pavo-help` for more information or open a support ticket.', inline: false }
          )
          .setFooter({ text: 'PavoTweak Booster Edition • Security Engine' })
          .setTimestamp();

        return interaction.editReply({ embeds: [deniedEmbed] });
      }

      // If member holds the role but backend wasn't registered yet, auto-sync verification
      if (isRoleHolder && !isVerified) {
        await boosterApi.verifyUser({
          discordUserId: userId,
          discordUsername: interaction.user.tag,
          boostCount: 2,
          verifiedBy: 'role_sync_auto',
          notes: 'Auto-synced from active Pavo Booster role'
        });
      }

      // Generate single-use temporary code (5 minutes TTL)
      const codeRes = await boosterApi.generateCode({ discordUserId: userId, ttlSeconds: 300 });
      const authCode = codeRes.data.code;
      const expiresEpoch = Math.floor((Date.now() + 300 * 1000) / 1000);

      const accessEmbed = new EmbedBuilder()
        .setTitle('⚡ PAVO TWEAK: BOOSTER ACCESS GRANTED')
        .setColor(0x10B981)
        .setDescription(
          `### 🚀 Your Single-Use Authentication Code\n` +
          `\`\`\`\n${authCode}\n\`\`\`\n` +
          `*(Click code above to copy)*\n\n` +
          `⏳ **Expires:** <t:${expiresEpoch}:R> *(5 minutes)*\n` +
          `🔒 **Type:** Single-Use Secure Token`
        )
        .addFields(
          {
            name: '💻 How to Launch PavoTweak CLI',
            value:
              `1. Open **PowerShell** or **Terminal** as Administrator.\n` +
              `2. Navigate to your \`pavo-cli\` folder and run:\n` +
              `   \`\`\`powershell\n.\\Launch-PavoTweak.bat\n\`\`\`\n` +
              `3. Paste your code \`${authCode}\` when prompted.`
          },
          {
            name: '🛡️ Security & Revocation Policy',
            value:
              `• Your session is tied to your active **2-Boost status**.\n` +
              `• If you stop boosting, access to PavoTweak will automatically be revoked immediately.`
          }
        )
        .setFooter({ text: 'PavoTweak Booster Edition • Single-Use Session' })
        .setTimestamp();

      return interaction.editReply({ embeds: [accessEmbed] });
    } catch (err) {
      console.error('[PAVO-ACCESS ERROR]', err);
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Error Generating Access Code')
        .setColor(0xEF4444)
        .setDescription(err.message || 'An unexpected error occurred while communicating with the Pavo server.')
        .setTimestamp();

      return interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. /pavo-status (User command)
// ─────────────────────────────────────────────────────────────────────────────
const pavoStatusCmd = {
  data: new SlashCommandBuilder()
    .setName('pavo-status')
    .setDescription('Check your PavoTweak booster eligibility and active session status'),

  async execute(interaction, config) {
    await interaction.deferReply({ flags: 64 });

    const userId = interaction.user.id;
    const member = interaction.member;

    try {
      const boosterRole = member?.roles?.cache.find(r => r.name === 'Pavo Booster');
      const backendStatus = await boosterApi.getUserStatus(userId).catch(() => null);
      const statusData = backendStatus?.data;

      const isVerified = statusData?.isVerified === true || !!boosterRole;
      const boostTime = member?.premiumSince ? `<t:${Math.floor(member.premiumSince.getTime() / 1000)}:R>` : 'Not boosting';

      const embed = new EmbedBuilder()
        .setTitle('💎 PavoTweak Booster Authorization Status')
        .setColor(isVerified ? 0x10B981 : 0xEF4444)
        .addFields(
          { name: '👤 User', value: `<@${userId}> (\`${interaction.user.tag}\`)`, inline: true },
          { name: '🛡️ Booster Status', value: isVerified ? '🟢 **VERIFIED (Active)**' : '🔴 **NOT ELIGIBLE**', inline: true },
          { name: '🏷️ Pavo Booster Role', value: boosterRole ? '✅ Assigned' : '❌ Not Assigned', inline: true },
          { name: '⏳ Guild Boost Date', value: boostTime, inline: true },
          { name: '💻 Active CLI Sessions', value: `${statusData?.activeSessions || 0} active`, inline: true },
          { name: '📅 Verified On', value: statusData?.verifiedAt ? `<t:${Math.floor(new Date(statusData.verifiedAt).getTime() / 1000)}:f>` : 'N/A', inline: true }
        )
        .setFooter({ text: 'PavoTweak Booster Edition' })
        .setTimestamp();

      if (!isVerified) {
        embed.setDescription('⚠️ You do not meet the **2-Boost requirement** or have not been verified yet. Boost the server and ask staff to run `/pavo-verify`!');
      } else {
        embed.setDescription('✨ You are fully authorized to use PavoTweak! Run `/pavo-access` to get your CLI access code.');
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[PAVO-STATUS ERROR]', err);
      return interaction.editReply({ content: `❌ Error fetching status: ${err.message}` });
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. /pavo-help (User command)
// ─────────────────────────────────────────────────────────────────────────────
const pavoHelpCmd = {
  data: new SlashCommandBuilder()
    .setName('pavo-help')
    .setDescription('Learn how to access PavoTweak Booster Edition and how the 2-boost system works'),

  async execute(interaction, config) {
    const embed = new EmbedBuilder()
      .setTitle('📖 PavoTweak Booster Access Guide')
      .setColor(0x6366F1)
      .setDescription(
        `**PavoTweak Booster Edition** is an exclusive, high-performance Windows optimization tool available only to members who boost our Discord server!\n\n` +
        `### 💎 Requirements\n` +
        `• **Contribute at least 2 Server Boosts** to this Discord server.\n` +
        `• Receive the **Pavo Booster** role.\n\n` +
        `### 🚀 How to Get Started\n` +
        `1. **Boost the server 2 times** using Discord Nitro.\n` +
        `2. Staff will verify your 2 boosts and grant you the **Pavo Booster** role.\n` +
        `3. Type \`/pavo-access\` in any channel to get your temporary CLI login code.\n` +
        `4. Launch the **PavoTweak CLI** on your PC and enter the code to unlock all tweaks!\n\n` +
        `### ⚙️ What Tweaks Are Included?\n` +
        `• ⚡ **FPS Optimization:** Game Mode, MMCSS, GPU Priority, Latency Reduction\n` +
        `• 🪟 **Windows Optimization:** Safe Telemetry Tuning, Visual Performance, Memory Cleanup\n` +
        `• 🏎️ **FiveM Optimization:** Cache Purge, High CPU Priority, Socket Tuning\n` +
        `• 🎯 **Fortnite Optimization:** DirectX Cache refresh, GameUserSettings safe config\n` +
        `• 🧹 **Deep Clean:** Temporary files, Prefetch, Crash Dumps, Delivery Optimization\n` +
        `• 🔄 **Complete Restore System:** Revert individual or all changes at any time!\n\n` +
        `### ⚠️ Automatic Revocation Policy\n` +
        `Access is tied directly to active boosting. If your boosts expire or you remove them, your CLI session is automatically terminated by the server.`
      )
      .setFooter({ text: 'PavoTweak Booster Edition • High Performance Suite' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: 64 });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. /pavo-verify (Admin command)
// ─────────────────────────────────────────────────────────────────────────────
const pavoVerifyCmd = {
  data: new SlashCommandBuilder()
    .setName('pavo-verify')
    .setDescription('Verify a member 2-boost status and grant Pavo Booster access')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt =>
      opt.setName('user').setDescription('The Discord member to verify').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('boosts').setDescription('Number of boosts verified (default 2)').setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('notes').setDescription('Optional administrative notes').setRequired(false)
    ),

  async execute(interaction, config) {
    await interaction.deferReply({ flags: 64 });

    const targetUser = interaction.options.getUser('user');
    const boostCount = interaction.options.getInteger('boosts') || 2;
    const notes = interaction.options.getString('notes') || '2 Server Boosts verified';
    const actor = `${interaction.user.tag} (${interaction.user.id})`;

    try {
      const guild = interaction.guild;
      const member = await guild.members.fetch(targetUser.id).catch(() => null);

      if (!member) {
        return interaction.editReply({ content: '❌ Target user is not currently in this Discord server.' });
      }

      // 1. Assign "Pavo Booster" role
      const boosterRole = await getOrCreateBoosterRole(guild);
      if (boosterRole && !member.roles.cache.has(boosterRole.id)) {
        await member.roles.add(boosterRole, `Verified for PavoTweak 2-boost access by ${interaction.user.tag}`);
      }

      // 2. Record in Backend Database
      const result = await boosterApi.verifyUser({
        discordUserId: targetUser.id,
        discordUsername: targetUser.tag,
        boostCount,
        verifiedBy: actor,
        notes
      });

      const embed = new EmbedBuilder()
        .setTitle('✅ Pavo Booster Verified Successfully')
        .setColor(0x10B981)
        .setDescription(`**<@${targetUser.id}>** has been verified and granted **PavoTweak Booster Access**!`)
        .addFields(
          { name: '👤 Verified Member', value: `<@${targetUser.id}> (\`${targetUser.tag}\`)`, inline: true },
          { name: '💎 Verified Boosts', value: `\`${boostCount} Boosts\``, inline: true },
          { name: '🏷️ Assigned Role', value: boosterRole ? `<@&${boosterRole.id}>` : '`Pavo Booster`', inline: true },
          { name: '👮 Verified By', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📝 Notes', value: notes, inline: true },
          { name: '⚡ Next Step for User', value: 'The user can now type `/pavo-access` to obtain their CLI access code.', inline: false }
        )
        .setFooter({ text: 'PavoTweak Security Audit Engine' })
        .setTimestamp();

      // Try sending a DM notification to the user
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('🎉 You have been verified for PavoTweak Booster Edition!')
          .setColor(0x10B981)
          .setDescription(
            `Hello <@${targetUser.id}>!\n\n` +
            `Your **2 Server Boosts** have been verified by staff in **${guild.name}**.\n\n` +
            `You can now access the **PavoTweak Windows Optimization CLI**!\n` +
            `Go to any channel in the server and type:\n` +
            `\`\`\`\n/pavo-access\n\`\`\`\n` +
            `Enjoy maximum gaming performance!`
          )
          .setFooter({ text: 'PavoTweak Booster Edition' })
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
      } catch (_) {}

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[PAVO-VERIFY ERROR]', err);
      return interaction.editReply({ content: `❌ Failed to verify user: ${err.message}` });
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. /pavo-revoke (Admin command)
// ─────────────────────────────────────────────────────────────────────────────
const pavoRevokeCmd = {
  data: new SlashCommandBuilder()
    .setName('pavo-revoke')
    .setDescription('Revoke PavoTweak booster access and invalidate all active sessions for a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt =>
      opt.setName('user').setDescription('The Discord member to revoke').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for revocation').setRequired(false)
    ),

  async execute(interaction, config) {
    await interaction.deferReply({ flags: 64 });

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Revoked by administrator';
    const actor = `${interaction.user.tag} (${interaction.user.id})`;

    try {
      const guild = interaction.guild;
      const member = await guild.members.fetch(targetUser.id).catch(() => null);

      // 1. Remove "Pavo Booster" role if assigned
      if (member) {
        const boosterRole = guild.roles.cache.find(r => r.name === 'Pavo Booster');
        if (boosterRole && member.roles.cache.has(boosterRole.id)) {
          await member.roles.remove(boosterRole, `Revoked by ${interaction.user.tag}: ${reason}`);
        }
      }

      // 2. Call backend revocation (instantly terminates sessions)
      const result = await boosterApi.revokeUser({
        discordUserId: targetUser.id,
        revokedBy: actor,
        reason
      });

      const embed = new EmbedBuilder()
        .setTitle('🚫 Pavo Booster Access Revoked')
        .setColor(0xEF4444)
        .setDescription(`Access for **<@${targetUser.id}>** has been completely revoked and all active CLI sessions were terminated.`)
        .addFields(
          { name: '👤 Target Member', value: `<@${targetUser.id}> (\`${targetUser.tag}\`)`, inline: true },
          { name: '🔌 Revoked Sessions', value: `\`${result.data?.revokedSessions || 0} session(s)\``, inline: true },
          { name: '👮 Revoked By', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📝 Reason', value: reason, inline: false }
        )
        .setFooter({ text: 'PavoTweak Security Audit Engine' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[PAVO-REVOKE ERROR]', err);
      return interaction.editReply({ content: `❌ Failed to revoke user: ${err.message}` });
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. /pavo-check (Admin command)
// ─────────────────────────────────────────────────────────────────────────────
const pavoCheckCmd = {
  data: new SlashCommandBuilder()
    .setName('pavo-check')
    .setDescription('Inspect a user Discord booster status, DB record, and active sessions')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt =>
      opt.setName('user').setDescription('The Discord member to inspect').setRequired(true)
    ),

  async execute(interaction, config) {
    await interaction.deferReply({ flags: 64 });

    const targetUser = interaction.options.getUser('user');

    try {
      const guild = interaction.guild;
      const member = await guild.members.fetch(targetUser.id).catch(() => null);
      const backendStatus = await boosterApi.getUserStatus(targetUser.id).catch(() => null);
      const data = backendStatus?.data;

      const boosterRole = member?.roles?.cache.find(r => r.name === 'Pavo Booster');
      const boostTime = member?.premiumSince ? `<t:${Math.floor(member.premiumSince.getTime() / 1000)}:f>` : 'None (Not Boosting)';

      const embed = new EmbedBuilder()
        .setTitle(`🔍 Booster Inspection: ${targetUser.tag}`)
        .setColor(data?.isVerified ? 0x10B981 : 0x6B7280)
        .addFields(
          { name: '🆔 Discord ID', value: `\`${targetUser.id}\``, inline: true },
          { name: '💎 Discord Boost Time', value: boostTime, inline: true },
          { name: '🏷️ Pavo Booster Role', value: boosterRole ? '✅ Assigned' : '❌ Not Assigned', inline: true },
          { name: '🛡️ DB Status', value: `\`${data?.status || 'unverified'}\``, inline: true },
          { name: '✅ Verified State', value: data?.isVerified ? '🟢 Active' : '🔴 Inactive', inline: true },
          { name: '💻 Active Sessions', value: `\`${data?.activeSessions || 0}\``, inline: true },
          { name: '📅 Verified Date', value: data?.verifiedAt ? `<t:${Math.floor(new Date(data.verifiedAt).getTime() / 1000)}:f>` : 'N/A', inline: true },
          { name: '👮 Verified By', value: data?.verifiedBy || 'N/A', inline: true },
          { name: '📝 Admin Notes', value: data?.notes || 'None', inline: false }
        )
        .setFooter({ text: 'PavoTweak Admin Diagnostics' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[PAVO-CHECK ERROR]', err);
      return interaction.editReply({ content: `❌ Error checking user: ${err.message}` });
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. /pavo-logs (Admin command)
// ─────────────────────────────────────────────────────────────────────────────
const pavoLogsCmd = {
  data: new SlashCommandBuilder()
    .setName('pavo-logs')
    .setDescription('View recent PavoTweak booster audit logs and access activity')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt =>
      opt.setName('user').setDescription('Filter by specific user').setRequired(false)
    ),

  async execute(interaction, config) {
    await interaction.deferReply({ flags: 64 });

    const filterUser = interaction.options.getUser('user');

    try {
      const logsRes = await boosterApi.getAuditLogs(filterUser ? filterUser.id : null, 10);
      const logs = logsRes.data || [];

      if (logs.length === 0) {
        return interaction.editReply({ content: '📜 No booster audit logs found.' });
      }

      const logLines = logs.map(l => {
        const time = `<t:${Math.floor(new Date(l.created_at).getTime() / 1000)}:R>`;
        return `• **\`${l.action}\`** by \`${l.actor}\` for <@${l.discord_user_id}> (${time})\n  └ *${l.details || 'No extra details'}*`;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle('📜 PavoTweak Booster Audit Logs')
        .setColor(0x3B82F6)
        .setDescription(logLines)
        .setFooter({ text: `Showing last ${logs.length} entries` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[PAVO-LOGS ERROR]', err);
      return interaction.editReply({ content: `❌ Error fetching logs: ${err.message}` });
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Setup / Sync Dedicated PavoTweak Command Channel
// ─────────────────────────────────────────────────────────────────────────────
async function setupPavoCommandChannel(client, config) {
  try {
    const guild = client.guilds.cache.get(config.guildId) || client.guilds.cache.first();
    if (!guild) return null;

    const promoChannelId = config.pavoPromoChannelId || '1546587816450859010';
    let promoChannel = null;
    try {
      promoChannel = await guild.channels.fetch(promoChannelId).catch(() => null);
    } catch (_) {}

    // 1. Search for existing command channel (by stored ID or exact name)
    let cmdChannel = null;
    if (config.pavoCommandChannelId) {
      cmdChannel = await guild.channels.fetch(config.pavoCommandChannelId).catch(() => null);
    }

    // If not found by ID, do a FULL fetch of all guild channels (cache may be incomplete at startup)
    if (!cmdChannel) {
      try {
        const allChannels = await guild.channels.fetch();
        cmdChannel = allChannels.find(c => c && c.name.includes('pavo-tweak'));
      } catch (_) {
        // Fallback to cache if fetch fails
        cmdChannel = guild.channels.cache.find(c => c.name.includes('pavo-tweak'));
      }
      // If found by name, persist the ID so we don't repeat this search
      if (cmdChannel) {
        config.pavoCommandChannelId = cmdChannel.id;
        try {
          const fs = require('fs');
          const path = require('path');
          fs.writeFileSync(path.join(__dirname, '../config.json'), JSON.stringify(config, null, 2));
          console.log(`[BOOSTER] Found existing command channel by name: ${cmdChannel.name} (${cmdChannel.id}) — saved to config.`);
        } catch (_) {}
      }
    }

    const boosterRole = await getOrCreateBoosterRole(guild);

    // Permission Overwrites:
    // @everyone: ViewChannel: true, SendMessages: false, AddReactions: false, UseApplicationCommands: true
    // Bot User: Full control over channel
    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.UseApplicationCommands
        ],
        deny: [
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.CreatePublicThreads,
          PermissionFlagsBits.CreatePrivateThreads,
          PermissionFlagsBits.AddReactions,
          PermissionFlagsBits.SendMessagesInThreads
        ]
      },
      {
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels
        ]
      }
    ];

    if (boosterRole) {
      permissionOverwrites.push({
        id: boosterRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.UseApplicationCommands
        ],
        deny: [
          PermissionFlagsBits.SendMessages
        ]
      });
    }

    // 2. If channel doesn't exist, DO NOT auto-create (prevents duplicates on Render redeploy)
    if (!cmdChannel) {
      console.warn('[BOOSTER] ⚠️ PavoTweak command channel not found! Please create it manually and set pavoCommandChannelId in config.json or environment.');
      console.warn('[BOOSTER] Looked for ID:', config.pavoCommandChannelId, '| Names: ⚡・pavo-tweak, pavo-tweak, pavo-cli');
      return null;
    }

    // Channel found — sync permissions, topic and position
    config.pavoCommandChannelId = cmdChannel.id;
    try {
      await cmdChannel.edit({
        topic: 'PavoTweak commands only • 2 Server Boosts required',
        permissionOverwrites
      });
      if (promoChannel && cmdChannel.position <= promoChannel.position) {
        await cmdChannel.setPosition(promoChannel.position + 1).catch(() => {});
      }
    } catch (syncErr) {
      console.warn('[BOOSTER] Channel sync warning:', syncErr.message);
    }

    // 3. Post permanent Welcome / Command Center embed if not present
    try {
      const messages = await cmdChannel.messages.fetch({ limit: 10 });
      const existingEmbed = messages.find(m => m.author.id === client.user.id && m.embeds.some(e => e.title?.includes('PAVO TWEAK COMMAND CENTER')));

      if (!existingEmbed) {
        const welcomeEmbed = new EmbedBuilder()
          .setTitle('⚡ PAVO TWEAK COMMAND CENTER')
          .setColor(0x6366F1)
          .setDescription(
            `Welcome to the official **PavoTweak Command Center**.\n` +
            `This channel is designed **exclusively** for interacting with the PavoTweak Bot.\n\n` +
            `### 💎 Requirement\n` +
            `🚀 **Contribute at least 2 Server Boosts** to unlock PavoTweak Booster Edition.\n\n` +
            `### 🎮 Available Slash Commands\n` +
            `• \`/pavo-access\` — Generate your temporary PavoTweak CLI login code *(5 min TTL)*\n` +
            `• \`/pavo-status\` — Check your current booster authorization and active sessions\n` +
            `• \`/pavo-help\` — View features, tweak modules & setup guide\n\n` +
            `────────────────────────────────────────────\n` +
            `⚠️ **Channel Rules:**\n` +
            `• This channel is for **Slash Commands only**.\n` +
            `• Normal chat messages, random text or spam are **automatically removed**.\n` +
            `• If you lose your booster eligibility, your CLI session is **automatically revoked** in real time.\n\n` +
            `*Keep this channel clean and use commands only.*`
          )
          .setFooter({ text: 'PavoTweak Booster Edition • Automated Security Hub' })
          .setTimestamp();

        const pinned = await cmdChannel.send({ embeds: [welcomeEmbed] });
        await pinned.pin().catch(() => {});
        console.log('[BOOSTER] Permanent Command Center embed posted.');
      }
    } catch (msgErr) {
      console.error('[BOOSTER] Error checking/posting permanent embed:', msgErr);
    }

    return cmdChannel;
  } catch (err) {
    console.error('[BOOSTER] Error in setupPavoCommandChannel:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Send / Update PavoTweak Promotional Message in Promo Channel (1546587816450859010)
// ─────────────────────────────────────────────────────────────────────────────
async function sendOrUpdatePromoEmbed(client, config) {
  try {
    const guild = client.guilds.cache.get(config.guildId) || client.guilds.cache.first();
    if (!guild) return null;

    const promoChannelId = config.pavoPromoChannelId || '1546587816450859010';
    let promoChannel = null;
    try {
      promoChannel = await guild.channels.fetch(promoChannelId).catch(() => null);
    } catch (_) {}

    if (!promoChannel) {
      console.warn(`[BOOSTER] Promotional channel ${promoChannelId} not found.`);
      return null;
    }

    const cmdChannelMention = config.pavoCommandChannelId ? `<#${config.pavoCommandChannelId}>` : '`#⚡・pavo-tweak`';

    const promoEmbed = new EmbedBuilder()
      .setTitle('💎 PAVOTWEAK ACCESS — 2 SERVER BOOSTS')
      .setColor(0x9333EA)
      .setDescription(
        `### 🚀 Unlock the Ultimate Windows Performance Suite\n` +
        `**PavoTweak Booster Edition** is available exclusively to members who boost our Discord server!\n\n` +
        `💰 **Price / Access Requirement:**\n` +
        `\`🚀 2 SERVER BOOSTS\` *(No monetary cost / €0)*\n\n` +
        `────────────────────────────────────────────\n\n` +
        `### ⚡ What's Included in PavoTweak?\n` +
        `• **⚡ FPS Optimization** — Windows Game Mode, MMCSS Scheduling, GPU Priority 8 & 0-Latency Profile\n` +
        `• **🪟 Windows Tuning** — Visual animation delay reduction, safe background telemetry reduction & RAM cache trim\n` +
        `• **🏎️ FiveM Gaming** — FiveM local cache purge & high CPU scheduler priority\n` +
        `• **🎯 Fortnite Performance** — DirectX Shader cache purge & micro-stutter fix\n` +
        `• **🧹 Deep Clean** — Cleans Temp, Prefetch, Crash Dumps & Delivery Optimization cache\n` +
        `• **🌐 Network & Latency** — TCP NoDelay (disable Nagle's algorithm), DNS cache flush & MTU tuning\n` +
        `• **🔄 Complete Restore System** — Automatic restore checkpoints to undo last or all changes anytime\n\n` +
        `────────────────────────────────────────────\n\n` +
        `### 🔑 How to Claim Your Access:\n` +
        `1. **Boost this server 2 times** using Discord Nitro.\n` +
        `2. Staff will verify your 2 boosts and grant you the **\`Pavo Booster\`** role.\n` +
        `3. Head to the ${cmdChannelMention} channel and type:\n` +
        `   \`\`\`\n/pavo-access\n\`\`\`\n` +
        `4. Launch the **PavoTweak CLI** on your PC and paste your single-use access code!\n\n` +
        `────────────────────────────────────────────\n\n` +
        `⚠️ **Booster Policy & Auto-Revocation:**\n` +
        `*PavoTweak access is tied directly to your active server boosts. If you remove or lose your server boosts, your PavoTweak authorization and active CLI sessions will automatically be revoked in real time.*`
      )
      .addFields({
        name: '🚀 Ready to get started?',
        value: '### 👉 **BOOST THE SERVER 2X TO GET PAVOTWEAK**'
      })
      .setFooter({ text: 'PavoTweak Booster Edition • High Performance Windows Suite' })
      .setTimestamp();

    // Check if bot already posted the promo embed in the channel
    const messages = await promoChannel.messages.fetch({ limit: 10 }).catch(() => null);
    const existingPromo = messages ? messages.find(m => m.author.id === client.user.id && m.embeds.some(e => e.title?.includes('PAVOTWEAK ACCESS'))) : null;

    if (existingPromo) {
      await existingPromo.edit({ embeds: [promoEmbed] });
      console.log('[BOOSTER] Updated existing promotional embed in promo channel.');
    } else {
      await promoChannel.send({ embeds: [promoEmbed] });
      console.log('[BOOSTER] Posted new promotional embed in promo channel.');
    }
  } catch (err) {
    console.error('[BOOSTER] Error sending/updating promo embed:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Command: /pavo-promo (Refresh/Send Promotional Embed)
// ─────────────────────────────────────────────────────────────────────────────
const pavoPromoCmd = {
  data: new SlashCommandBuilder()
    .setName('pavo-promo')
    .setDescription('Refresh or send the PavoTweak 2-Boost Promotional Embed into the promo channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, config) {
    await interaction.deferReply({ flags: 64 });

    try {
      await sendOrUpdatePromoEmbed(interaction.client, config);
      return interaction.editReply({
        content: `✅ Promotional embed successfully posted / updated in <#${config.pavoPromoChannelId || '1546587816450859010'}>!`
      });
    } catch (err) {
      console.error('[PAVO-PROMO ERROR]', err);
      return interaction.editReply({ content: `❌ Error sending promo embed: ${err.message}` });
    }
  }
};

module.exports = {
  commands: [
    pavoAccessCmd,
    pavoStatusCmd,
    pavoHelpCmd,
    pavoVerifyCmd,
    pavoRevokeCmd,
    pavoCheckCmd,
    pavoLogsCmd,
    pavoPromoCmd
  ],
  getOrCreateBoosterRole,
  setupPavoCommandChannel,
  sendOrUpdatePromoEmbed
};
