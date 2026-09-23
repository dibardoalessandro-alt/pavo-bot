const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  PermissionFlagsBits 
} = require('discord.js');
const crypto = require('crypto');
const db = require('../database');

// Active timer handles in memory
const activeTimers = new Map();

// Helper to parse human-readable durations
function parseDuration(durationStr) {
  if (!durationStr) return null;
  const str = durationStr.trim().toLowerCase();
  
  // Format: 10m, 30m, 1h, 6h, 12h, 24h, 3d, 7d
  const regex = /^(\d+)\s*(s|sec|m|min|h|hr|d|day|w|week)s?$/;
  const match = str.match(regex);
  if (!match) {
    // If it's pure numbers, treat as minutes
    const num = parseInt(str, 10);
    if (!isNaN(num) && num > 0) return num * 60 * 1000;
    return null;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
    case 'sec':
      return value * 1000;
    case 'm':
    case 'min':
      return value * 60 * 1000;
    case 'h':
    case 'hr':
      return value * 60 * 60 * 1000;
    case 'd':
    case 'day':
      return value * 24 * 60 * 60 * 1000;
    case 'w':
    case 'week':
      return value * 7 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

// Staff check helper
function isStaffMember(member, config) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }
  if (config.staffHierarchy && config.staffRoles) {
    for (const roleName of config.staffHierarchy) {
      const roleId = config.staffRoles[roleName];
      if (roleId && member.roles.cache.has(roleId)) {
        return true;
      }
    }
  }
  return false;
}

// Pick N random distinct winners
function selectWinners(participants, count) {
  if (!participants || participants.length === 0) return [];
  const pool = [...participants];
  // Shuffle array using Fisher-Yates
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

// Generate Giveaway Embed
function buildGiveawayEmbed(giveaway, config) {
  const endTimestamp = Math.floor(new Date(giveaway.endsAt).getTime() / 1000);
  const participantCount = giveaway.participants ? giveaway.participants.length : 0;
  const maxPartText = giveaway.maxParticipants > 0 ? `${giveaway.maxParticipants}` : '∞';

  const embed = new EmbedBuilder()
    .setTitle('🎉 PAVO GIVEAWAY')
    .setColor(config.embedColor || '#4f46e5')
    .setDescription(
      `> 🎁 **Prize**\n` +
      `> **${giveaway.prize}**\n\n` +
      `> ⏱️ **Ends** <t:${endTimestamp}:R> (<t:${endTimestamp}:f>)\n\n` +
      `> 🏆 **Winners**\n` +
      `> **${giveaway.winnerCount}**\n\n` +
      `> 👥 **Participants**\n` +
      `> **${participantCount} / ${maxPartText}**\n\n` +
      `> ${giveaway.requireOAuth ? '🔐 **Verified Entry Required**' : '🔓 **Open Entry**'}\n\n` +
      `Good luck everyone! 🍀`
    )
    .setFooter({ 
      text: `${config.embedFooterText || 'Pavo Tweak · Premium Giveaways'} • ID: ${giveaway.id}` 
    })
    .setTimestamp(new Date(giveaway.startedAt || Date.now()));

  return embed;
}

// Generate Ended Embed
function buildEndedEmbed(giveaway, config) {
  const participantCount = giveaway.participants ? giveaway.participants.length : 0;
  const winnersFormatted = giveaway.winners && giveaway.winners.length > 0
    ? giveaway.winners.map(wId => `🎉 <@${wId}>`).join(', ')
    : 'No participants entered';

  const embed = new EmbedBuilder()
    .setTitle('🎉 GIVEAWAY ENDED')
    .setColor('#10b981') // Green for completed
    .setDescription(
      `> 🎁 **Prize**\n` +
      `> **${giveaway.prize}**\n\n` +
      `> 👥 **Participants**\n` +
      `> **${participantCount}**\n\n` +
      `> 🏆 **${giveaway.winners && giveaway.winners.length > 1 ? 'Winners' : 'Winner'}**\n` +
      `> ${winnersFormatted}\n\n` +
      `Congratulations! 🎊\n\n` +
      `Please contact Pavo Staff to claim your prize.`
    )
    .setFooter({ 
      text: `${config.embedFooterText || 'Pavo Tweak · Premium Giveaways'} • ID: ${giveaway.id}` 
    })
    .setTimestamp(new Date(giveaway.endedAt || Date.now()));

  return embed;
}

// Generate Cancelled Embed
function buildCancelledEmbed(giveaway, config) {
  const embed = new EmbedBuilder()
    .setTitle('🛑 GIVEAWAY CANCELLED')
    .setColor('#ef4444') // Red for cancelled
    .setDescription(
      `> 🎁 **Prize**\n` +
      `> **${giveaway.prize}**\n\n` +
      `> 👥 **Final Participants**\n` +
      `> **${giveaway.participants ? giveaway.participants.length : 0}**\n\n` +
      `This giveaway was cancelled by staff.`
    )
    .setFooter({ 
      text: `${config.embedFooterText || 'Pavo Tweak · Premium Giveaways'} • ID: ${giveaway.id}` 
    })
    .setTimestamp(new Date(giveaway.endedAt || Date.now()));

  return embed;
}

// Build Giveaway Action Buttons
function buildGiveawayButtons(giveawayId, disabled = false) {
  const enterBtn = new ButtonBuilder()
    .setCustomId(`giveaway_enter_${giveawayId}`)
    .setLabel('🎉 Enter Giveaway')
    .setStyle(ButtonStyle.Success)
    .setDisabled(disabled);

  return new ActionRowBuilder().addComponents(enterBtn);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create and manage Pavo giveaways')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new official Pavo giveaway')
        .addStringOption(option =>
          option
            .setName('prize')
            .setDescription('The prize being given away (e.g. Pavo Tweak Lifetime)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('duration')
            .setDescription('Duration of giveaway (e.g. 10m, 30m, 1h, 6h, 12h, 24h, 3d, 7d)')
            .setRequired(true)
            .addChoices(
              { name: '⏱️ 10 minutes', value: '10m' },
              { name: '⏱️ 30 minutes', value: '30m' },
              { name: '⏱️ 1 hour', value: '1h' },
              { name: '⏱️ 6 hours', value: '6h' },
              { name: '⏱️ 12 hours', value: '12h' },
              { name: '⏱️ 24 hours', value: '24h' },
              { name: '⏱️ 3 days', value: '3d' },
              { name: '⏱️ 7 days', value: '7d' }
            )
        )
        .addIntegerOption(option =>
          option
            .setName('winners')
            .setDescription('Number of winners to pick (default: 1)')
            .setMinValue(1)
            .setMaxValue(50)
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('max_participants')
            .setDescription('Maximum number of participants allowed (0 for unlimited)')
            .setMinValue(0)
            .setMaxValue(10000)
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option
            .setName('require_oauth')
            .setDescription('Whether Discord OAuth2 account verification is required (default: True)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('end')
        .setDescription('End an active giveaway early and pick winners')
        .addStringOption(option =>
          option
            .setName('giveaway_id')
            .setDescription('ID of the giveaway to end')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('cancel')
        .setDescription('Cancel an active giveaway without picking winners')
        .addStringOption(option =>
          option
            .setName('giveaway_id')
            .setDescription('ID of the giveaway to cancel')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reroll')
        .setDescription('Reroll winner(s) for a finished giveaway')
        .addStringOption(option =>
          option
            .setName('giveaway_id')
            .setDescription('ID of the giveaway to reroll')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('winners')
            .setDescription('Number of new winners to select (default: 1)')
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all currently active giveaways')
    ),

  async execute(interaction, config) {
    const member = interaction.member;
    if (!isStaffMember(member, config)) {
      return interaction.reply({
        content: '❌ **Access Denied**: Only authorized Pavo staff members can create and manage giveaways.',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();

    // ==========================================
    // 1. CREATE GIVEAWAY
    // ==========================================
    if (subcommand === 'create') {
      const prize = interaction.options.getString('prize');
      const durationInput = interaction.options.getString('duration');
      const winnerCount = interaction.options.getInteger('winners') || 1;
      const maxParticipants = interaction.options.getInteger('max_participants') || 0;
      const requireOAuth = interaction.options.getBoolean('require_oauth') !== false; // default true

      const durationMs = parseDuration(durationInput);
      if (!durationMs || durationMs < 10000) {
        return interaction.reply({
          content: '❌ **Invalid Duration**: Please select a valid duration (minimum 10 seconds, e.g. `10m`, `1h`, `24h`).',
          ephemeral: true
        });
      }

      const giveawayId = crypto.randomBytes(4).toString('hex');
      const endsAt = new Date(Date.now() + durationMs).toISOString();

      await interaction.deferReply();

      // Create giveaway entry in database
      const giveaway = await db.createGiveaway({
        id: giveawayId,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        creatorId: interaction.user.id,
        prize: prize,
        durationMs: durationMs,
        endsAt: endsAt,
        maxParticipants: maxParticipants,
        winnerCount: winnerCount,
        requireOAuth: requireOAuth
      });

      // Build and post embed
      const embed = buildGiveawayEmbed(giveaway, config);
      const row = buildGiveawayButtons(giveawayId, false);

      const message = await interaction.editReply({
        embeds: [embed],
        components: [row]
      });

      // Save message ID to DB
      await db.updateGiveawayMessage(giveawayId, message.id);
      giveaway.messageId = message.id;

      // Schedule auto-ending timer
      scheduleGiveawayEnd(interaction.client, giveaway, config);

      return;
    }

    // ==========================================
    // 2. END GIVEAWAY
    // ==========================================
    if (subcommand === 'end') {
      const targetId = interaction.options.getString('giveaway_id');
      let giveaway = null;

      if (targetId) {
        giveaway = await db.getGiveaway(targetId);
      } else {
        // Find latest active giveaway in this channel or guild
        const active = await db.getActiveGiveaways();
        giveaway = active.find(g => g.channelId === interaction.channelId) || active[0];
      }

      if (!giveaway || giveaway.status !== 'ACTIVE') {
        return interaction.reply({
          content: '❌ No active giveaway found matching that ID.',
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });
      await triggerGiveawayEnd(interaction.client, giveaway.id, config, interaction.user);
      return interaction.editReply({
        content: `✅ Giveaway **#${giveaway.id}** (${giveaway.prize}) has been ended.`
      });
    }

    // ==========================================
    // 3. CANCEL GIVEAWAY
    // ==========================================
    if (subcommand === 'cancel') {
      const targetId = interaction.options.getString('giveaway_id');
      let giveaway = null;

      if (targetId) {
        giveaway = await db.getGiveaway(targetId);
      } else {
        const active = await db.getActiveGiveaways();
        giveaway = active.find(g => g.channelId === interaction.channelId) || active[0];
      }

      if (!giveaway || giveaway.status !== 'ACTIVE') {
        return interaction.reply({
          content: '❌ No active giveaway found matching that ID.',
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      // Clear timer
      if (activeTimers.has(giveaway.id)) {
        clearTimeout(activeTimers.get(giveaway.id));
        activeTimers.delete(giveaway.id);
      }

      // Update database status
      const updated = await db.cancelGiveaway(giveaway.id);

      // Update message embed
      try {
        const channel = await interaction.client.channels.fetch(giveaway.channelId).catch(() => null);
        if (channel && giveaway.messageId) {
          const msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
          if (msg) {
            await msg.edit({
              embeds: [buildCancelledEmbed(updated, config)],
              components: [buildGiveawayButtons(giveaway.id, true)]
            });
          }
        }
      } catch (err) {
        console.error(`Error updating cancelled giveaway message #${giveaway.id}:`, err);
      }

      return interaction.editReply({
        content: `🛑 Giveaway **#${giveaway.id}** (${giveaway.prize}) was cancelled without selecting winners.`
      });
    }

    // ==========================================
    // 4. REROLL GIVEAWAY
    // ==========================================
    if (subcommand === 'reroll') {
      const targetId = interaction.options.getString('giveaway_id');
      const count = interaction.options.getInteger('winners') || 1;
      let giveaway = null;

      if (targetId) {
        giveaway = await db.getGiveaway(targetId);
      } else {
        // Find latest ended giveaway
        const all = await db.getAllGiveaways();
        const ended = all.filter(g => g.status === 'ENDED');
        giveaway = ended.find(g => g.channelId === interaction.channelId) || ended[ended.length - 1];
      }

      if (!giveaway || giveaway.status !== 'ENDED') {
        return interaction.reply({
          content: '❌ No ended giveaway found to reroll. Specify a valid ended giveaway ID.',
          ephemeral: true
        });
      }

      if (!giveaway.participants || giveaway.participants.length === 0) {
        return interaction.reply({
          content: '❌ Cannot reroll: This giveaway had 0 participants.',
          ephemeral: true
        });
      }

      await interaction.deferReply();

      // Exclude existing winners if possible
      const eligible = giveaway.participants.filter(p => !giveaway.winners.includes(p));
      const pool = eligible.length > 0 ? eligible : giveaway.participants;
      const newWinners = selectWinners(pool, count);

      if (newWinners.length === 0) {
        return interaction.editReply({
          content: '❌ No eligible participants found to select a new winner.'
        });
      }

      // Update database
      const allWinners = [...giveaway.winners, ...newWinners];
      await db.rerollGiveaway(giveaway.id, allWinners);

      // Announce new winner in channel
      const winnersMention = newWinners.map(w => `<@${w}>`).join(', ');
      await interaction.channel.send({
        content: 
          `🎲 **GIVEAWAY REROLL** 🎲\n\n` +
          `Congratulations ${winnersMention}! You have won **${giveaway.prize}** (Reroll)!\n` +
          `🦚 Please contact Pavo Staff to claim your prize!`
      });

      return interaction.editReply({
        content: `✅ Rerolled **${newWinners.length}** new winner(s) for giveaway **#${giveaway.id}**: ${winnersMention}`
      });
    }

    // ==========================================
    // 5. LIST GIVEAWAYS
    // ==========================================
    if (subcommand === 'list') {
      const active = await db.getActiveGiveaways();
      if (active.length === 0) {
        return interaction.reply({
          content: 'ℹ️ There are currently no active giveaways.',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('🎉 Active Pavo Giveaways')
        .setColor(config.embedColor || '#4f46e5')
        .setDescription(
          active.map(g => {
            const endTs = Math.floor(new Date(g.endsAt).getTime() / 1000);
            return `• **#${g.id}** — **${g.prize}**\n` +
                   `  Channel: <#${g.channelId}> | Winners: **${g.winnerCount}** | Participants: **${g.participants.length}**\n` +
                   `  Ends: <t:${endTs}:R> | Verified Only: **${g.requireOAuth ? 'Yes 🔐' : 'No 🔓'}**`;
          }).join('\n\n')
        )
        .setFooter({ text: `${config.embedFooterText || 'Pavo Tweak'} • Total Active: ${active.length}` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },

  // ==========================================
  // BUTTON INTERACTION HANDLER
  // ==========================================
  async handleButton(interaction, config) {
    if (!interaction.customId.startsWith('giveaway_enter_')) return;

    const giveawayId = interaction.customId.replace('giveaway_enter_', '');
    let giveaway = await db.getGiveaway(giveawayId);

    // Self-healing: if bot restarted or redeployed and giveaway not in DB, reconstruct from Discord message embed
    if (!giveaway && interaction.message && interaction.message.embeds && interaction.message.embeds.length > 0) {
      const embed = interaction.message.embeds[0];
      if (embed.title && embed.title.includes('PAVO GIVEAWAY')) {
        const prizeMatch = embed.description ? embed.description.match(/> 🎁 \*\*Prize\*\*\n> \*\*(.*?)\*\*/) : null;
        const prize = prizeMatch ? prizeMatch[1] : 'Giveaway Prize';
        const requireOAuth = embed.description ? embed.description.includes('Verified Entry Required') : true;

        const endTsMatch = embed.description ? embed.description.match(/<t:(\d+):[Rf]>/) : null;
        const endsAt = endTsMatch
          ? new Date(parseInt(endTsMatch[1], 10) * 1000).toISOString()
          : new Date(Date.now() + 86400000).toISOString();
        const durationMs = Math.max(10000, new Date(endsAt).getTime() - Date.now());

        giveaway = await db.createGiveaway({
          id: giveawayId,
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          messageId: interaction.message.id,
          creatorId: interaction.client.user.id,
          prize: prize,
          durationMs: durationMs,
          endsAt: endsAt,
          maxParticipants: 0,
          winnerCount: 1,
          requireOAuth: requireOAuth
        });
        scheduleGiveawayEnd(interaction.client, giveaway, config);
      }
    }

    // 1. Is giveaway active?
    if (!giveaway || giveaway.status !== 'ACTIVE') {
      return interaction.reply({
        content: '❌ **Giveaway Ended**: This giveaway is no longer active.',
        ephemeral: true
      });
    }

    // 2. Has max participants limit been reached?
    if (giveaway.maxParticipants > 0 && giveaway.participants.length >= giveaway.maxParticipants) {
      return interaction.reply({
        content: 
          `🔒 **Giveaway Full**\n\n` +
          `This giveaway has reached its maximum number of participants (${giveaway.maxParticipants}).`,
        ephemeral: true
      });
    }

    // 3. Is user already participating?
    if (giveaway.participants.includes(interaction.user.id)) {
      return interaction.reply({
        content: 
          `⚠️ **Already Entered**\n\n` +
          `You are already participating in this giveaway!`,
        ephemeral: true
      });
    }

    // 4. Does this giveaway require OAuth2 verification?
    if (giveaway.requireOAuth) {
      const oauthUser = await db.getOAuthUser(interaction.user.id);

      // If user is NOT authorized
      if (!oauthUser || oauthUser.status !== 'ACTIVE') {
        const publicUrl = (process.env.PUBLIC_URL && !process.env.PUBLIC_URL.includes('localhost'))
          ? process.env.PUBLIC_URL
          : (process.env.RENDER_EXTERNAL_URL || (config.publicUrl && !config.publicUrl.includes('localhost') ? config.publicUrl : 'https://pavo-bot-1.onrender.com'));
        const authUrl = `${publicUrl}/oauth/authorize?giveaway_id=${encodeURIComponent(giveawayId)}&user_id=${encodeURIComponent(interaction.user.id)}`;

        const authRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('🔐 Authorize with Discord')
            .setStyle(ButtonStyle.Link)
            .setURL(authUrl)
        );

        return interaction.reply({
          content: 
            `🔐 **Verification Required**\n\n` +
            `To participate in this giveaway, you need to authorize the official Pavo application.\n\n` +
            `Click the button below to continue with Discord's official authorization screen.`,
          components: [authRow],
          ephemeral: true
        });
      }
    }

    // 5. User is eligible (authorized or OAuth not required) -> Register entry
    const entryResult = await db.addGiveawayParticipant(giveawayId, interaction.user.id);
    if (!entryResult.success) {
      if (entryResult.reason === 'ALREADY_ENTERED') {
        return interaction.reply({
          content: `⚠️ **Already Entered**: You are already participating in this giveaway.`,
          ephemeral: true
        });
      }
      if (entryResult.reason === 'FULL') {
        return interaction.reply({
          content: `🔒 **Giveaway Full**: This giveaway has reached its maximum number of participants.`,
          ephemeral: true
        });
      }
      return interaction.reply({
        content: `❌ Could not enter giveaway: ${entryResult.reason}`,
        ephemeral: true
      });
    }

    // Update the giveaway message embed in the channel live
    await updateGiveawayMessage(interaction.client, giveawayId, config);

    // Ephemeral success confirmation
    return interaction.reply({
      content: 
        `✅ **You're already verified!**\n\n` +
        `🎉 You have been entered into the giveaway.\n\n` +
        `Good luck! 🍀`,
      ephemeral: true
    });
  }
};

// ==========================================
// BACKGROUND TIMERS & LIFECYCLE
// ==========================================

async function updateGiveawayMessage(client, giveawayId, config) {
  try {
    const giveaway = await db.getGiveaway(giveawayId);
    if (!giveaway || !giveaway.messageId) return;

    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel) return;

    const msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
    if (!msg) return;

    if (giveaway.status === 'ACTIVE') {
      const isFull = giveaway.maxParticipants > 0 && giveaway.participants.length >= giveaway.maxParticipants;
      await msg.edit({
        embeds: [buildGiveawayEmbed(giveaway, config)],
        components: [buildGiveawayButtons(giveaway.id, isFull)]
      });
    }
  } catch (err) {
    console.error(`Failed to update live giveaway message #${giveawayId}:`, err.message);
  }
}

async function triggerGiveawayEnd(client, giveawayId, config, endedByUser = null) {
  const giveaway = await db.getGiveaway(giveawayId);
  if (!giveaway || giveaway.status !== 'ACTIVE') return;

  // Clear running timer if present
  if (activeTimers.has(giveawayId)) {
    clearTimeout(activeTimers.get(giveawayId));
    activeTimers.delete(giveawayId);
  }

  // Select winners
  const winners = selectWinners(giveaway.participants, giveaway.winnerCount);

  // Update DB
  const endedGiveaway = await db.endGiveaway(giveawayId, winners);

  // Update original message
  let originalMsg = null;
  try {
    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (channel) {
      if (giveaway.messageId) {
        originalMsg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
        if (originalMsg) {
          await originalMsg.edit({
            embeds: [buildEndedEmbed(endedGiveaway, config)],
            components: [buildGiveawayButtons(giveaway.id, true)]
          });
        }
      }

      // Send winner announcement message in channel
      if (winners.length > 0) {
        const winnerMentions = winners.map(w => `<@${w}>`).join(', ');
        await channel.send({
          content: 
            `🎉🎉 **CONGRATULATIONS!** 🎉🎉\n\n` +
            `${winnerMentions} ${winners.length > 1 ? 'have' : 'has'} won **${giveaway.prize}**!\n\n` +
            `🦚 Thank you to everyone who participated!\n\n` +
            `See you in the next Pavo Giveaway! 🍀`
        });
      } else {
        await channel.send({
          content: 
            `🎉 **Giveaway Ended**\n\n` +
            `Unfortunately, no one participated in the giveaway for **${giveaway.prize}**.\n\n` +
            `See you in the next Pavo Giveaway! 🍀`
        });
      }
    }
  } catch (err) {
    console.error(`Error updating ended giveaway message #${giveawayId}:`, err);
  }

  // Send log to log channel
  await logGiveawayResult(client, endedGiveaway, config, endedByUser);
}

function scheduleGiveawayEnd(client, giveaway, config) {
  if (activeTimers.has(giveaway.id)) {
    clearTimeout(activeTimers.get(giveaway.id));
    activeTimers.delete(giveaway.id);
  }

  const now = Date.now();
  const endTimestamp = new Date(giveaway.endsAt).getTime();
  const remainingMs = endTimestamp - now;

  if (remainingMs <= 0) {
    // Already past time, end immediately
    triggerGiveawayEnd(client, giveaway.id, config);
  } else {
    // Schedule timeout
    const timer = setTimeout(() => {
      triggerGiveawayEnd(client, giveaway.id, config);
    }, remainingMs);
    activeTimers.set(giveaway.id, timer);
  }
}

// Log Giveaway Result to Staff Log Channel
async function logGiveawayResult(client, giveaway, config, endedByUser = null) {
  try {
    const logChannelId = config.giveawayLogChannelId || config.ticketLogChannelId;
    if (!logChannelId) return;

    const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
    if (!logChannel) return;

    const winnersText = giveaway.winners && giveaway.winners.length > 0
      ? giveaway.winners.map(w => `<@${w}> (\`${w}\`)`).join(', ')
      : 'None (0 participants)';

    const startTs = Math.floor(new Date(giveaway.startedAt).getTime() / 1000);
    const endTs = Math.floor(new Date(giveaway.endedAt || Date.now()).getTime() / 1000);

    const logEmbed = new EmbedBuilder()
      .setTitle('📊 Giveaway Concluded — Log Record')
      .setColor('#4f46e5')
      .addFields(
        { name: '🆔 Giveaway ID', value: `\`${giveaway.id}\``, inline: true },
        { name: '🎁 Prize', value: `**${giveaway.prize}**`, inline: true },
        { name: '👑 Creator', value: `<@${giveaway.creatorId}>`, inline: true },
        { name: '👥 Total Participants', value: `**${giveaway.participants ? giveaway.participants.length : 0}**`, inline: true },
        { name: '🏆 Winners', value: winnersText, inline: false },
        { name: '⏱️ Duration', value: `<t:${startTs}:f> ➔ <t:${endTs}:f>`, inline: false },
        { name: '🔐 OAuth Required', value: giveaway.requireOAuth ? 'Yes' : 'No', inline: true },
        { name: '🛑 Ended By', value: endedByUser ? `<@${endedByUser.id}>` : 'Automated Timer', inline: true }
      )
      .setFooter({ text: `${config.embedFooterText || 'Pavo Tweak'} • Giveaway Audit` })
      .setTimestamp();

    await logChannel.send({ embeds: [logEmbed] });
  } catch (err) {
    console.error('Failed to log giveaway result:', err);
  }
}

// Initialize active giveaways on bot startup
async function initGiveawayScheduler(client, config) {
  try {
    const active = await db.getActiveGiveaways();
    console.log(`[GIVEAWAY] Restoring ${active.length} active giveaway(s)...`);
    for (const giveaway of active) {
      scheduleGiveawayEnd(client, giveaway, config);
    }
  } catch (err) {
    console.error('Error initializing giveaway scheduler:', err);
  }
}

module.exports.initGiveawayScheduler = initGiveawayScheduler;
module.exports.updateGiveawayMessage = updateGiveawayMessage;
module.exports.triggerGiveawayEnd = triggerGiveawayEnd;
