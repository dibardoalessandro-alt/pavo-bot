const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../database');

// Baseline visual placeholder / example counts (configurable in config.json under legitCheck)
function getBaseCounts(config) {
  const cfg = config?.legitCheck || {};
  return {
    baseYes: typeof cfg.baseYes === 'number' ? cfg.baseYes : 420,
    baseNo: typeof cfg.baseNo === 'number' ? cfg.baseNo : 0
  };
}

function buildLegitCheckEmbed(config, guild) {
  const color = config?.embedColor || 0x3B82F6;

  const embed = new EmbedBuilder()
    .setTitle('🛡️ Pavo Hub Legit Check')
    .setColor(color)
    .setDescription(
      `Welcome to the official **Pavo Hub** legitimacy verification channel.\n` +
      `This channel is dedicated to customer transparency, verified purchase feedback, and overall community trust for Pavo Hub.\n\n` +
      `### 🛡️ Community Trust & Transparency\n` +
      `We prioritize customer satisfaction, product stability, and fast support. Every vouch, review, and feedback entry in this server represents genuine customer interaction.\n\n` +
      `**Visual Representation Guide (Examples):**\n` +
      `• **YES** → ✅ Verified Purchase / Trusted Service (e.g. **YES — 420**)\n` +
      `• **NO** → ❌ Dissatisfied / Unresolved Issue (e.g. **NO — 0**)\n\n` +
      `*Note: The numeric indicators above serve purely as visual examples and placeholders for community ratings.*\n\n` +
      `────────────────────────────────────────────\n\n` +
      `### Do you trust Pavo Hub / Would you recommend our services?\n` +
      `*Cast your vote below to help maintain an honest and transparent community.*`
    )
    .setFooter({ text: 'Pavo Hub Official • Community Trust & Legit Check', iconURL: guild?.iconURL() || undefined })
    .setTimestamp();

  if (guild?.iconURL()) {
    embed.setThumbnail(guild.iconURL({ dynamic: true }));
  }

  return embed;
}

function buildLegitCheckButtons(yesCount, noCount) {
  const yesButton = new ButtonBuilder()
    .setCustomId('legit_vote_yes')
    .setLabel(`YES — ${yesCount}`)
    .setEmoji('✅')
    .setStyle(ButtonStyle.Success);

  const noButton = new ButtonBuilder()
    .setCustomId('legit_vote_no')
    .setLabel(`NO — ${noCount}`)
    .setEmoji('❌')
    .setStyle(ButtonStyle.Danger);

  return new ActionRowBuilder().addComponents(yesButton, noButton);
}

async function sendOrUpdateLegitCheck(client, config) {
  try {
    const guild = client.guilds.cache.get(config.guildId) || client.guilds.cache.first();
    if (!guild) return null;

    const channelId = config.legitCheckChannelId || '1546615108325736558';
    let targetChannel = null;
    try {
      targetChannel = await guild.channels.fetch(channelId).catch(() => null);
    } catch (_) {}

    if (!targetChannel) {
      console.warn(`[LEGIT-CHECK] Channel ${channelId} not found in guild.`);
      return null;
    }

    // Get current votes from database + baseline placeholder numbers
    const { baseYes, baseNo } = getBaseCounts(config);
    const pollData = await db.getLegitCheckData();
    const yesCount = baseYes + (pollData.yesVotes || 0);
    const noCount = baseNo + (pollData.noVotes || 0);

    const embed = buildLegitCheckEmbed(config, guild);
    const row = buildLegitCheckButtons(yesCount, noCount);

    // Check if message already exists (by stored messageId or search)
    let existingMsg = null;
    if (pollData.messageId) {
      existingMsg = await targetChannel.messages.fetch(pollData.messageId).catch(() => null);
    }

    if (!existingMsg) {
      const messages = await targetChannel.messages.fetch({ limit: 25 }).catch(() => null);
      if (messages) {
        existingMsg = messages.find(m =>
          m.author.id === client.user.id &&
          m.embeds.some(e => e.title?.toLowerCase().includes('legit check'))
        );
      }
    }

    if (existingMsg) {
      await existingMsg.edit({ embeds: [embed], components: [row] });
      await db.setLegitCheckMessage(targetChannel.id, existingMsg.id);
      console.log('[LEGIT-CHECK] Updated Pavo Hub legit check in channel:', targetChannel.name);
      return existingMsg;
    } else {
      const sentMsg = await targetChannel.send({ embeds: [embed], components: [row] });
      await sentMsg.pin().catch(() => {});
      await db.setLegitCheckMessage(targetChannel.id, sentMsg.id);
      console.log('[LEGIT-CHECK] Sent and pinned new Pavo Hub legit check in channel:', targetChannel.name);
      return sentMsg;
    }
  } catch (err) {
    console.error('[LEGIT-CHECK] Error sending/updating legit check poll:', err);
    return null;
  }
}

async function handleButton(interaction, config) {
  const userId = interaction.user.id;
  const customId = interaction.customId;

  const isYes = customId === 'legit_vote_yes';
  const voteType = isYes ? 'yes' : 'no';

  try {
    const result = await db.castLegitCheckVote(userId, voteType);

    if (result.alreadyVotedThis) {
      return interaction.reply({
        content: `ℹ️ You have already voted **${voteType.toUpperCase()}**!`,
        flags: 64
      });
    }

    const { baseYes, baseNo } = getBaseCounts(config);
    const yesCount = baseYes + (result.yesVotes || 0);
    const noCount = baseNo + (result.noVotes || 0);

    // Update the message components with latest counts
    const updatedRow = buildLegitCheckButtons(yesCount, noCount);
    await interaction.message.edit({ components: [updatedRow] }).catch(() => {});

    if (isYes) {
      return interaction.reply({
        content: `✅ **Thank you for your vote!** We appreciate your trust in Pavo Hub!`,
        flags: 64
      });
    } else {
      return interaction.reply({
        content:
          `ℹ️ You voted **NO**.\n\n` +
          `If you encountered an issue or have concerns regarding Pavo Hub, please open a ticket so our staff can assist you promptly.`,
        flags: 64
      });
    }
  } catch (err) {
    console.error('[LEGIT-CHECK BUTTON ERROR]', err);
    return interaction.reply({
      content: `❌ An error occurred processing your vote: ${err.message}`,
      flags: 64
    });
  }
}

const pavoLegitCheckCmd = {
  data: new SlashCommandBuilder()
    .setName('pavo-legitcheck')
    .setDescription('Send or refresh the Pavo Hub Legit Check embed in the vouches channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, config) {
    await interaction.deferReply({ flags: 64 });
    try {
      const msg = await sendOrUpdateLegitCheck(interaction.client, config);
      if (msg) {
        return interaction.editReply({ content: `✅ Pavo Hub Legit Check embed posted / updated in <#${config.legitCheckChannelId || '1546615108325736558'}>!` });
      } else {
        return interaction.editReply({ content: `❌ Failed to find target channel.` });
      }
    } catch (err) {
      console.error('[PAVO-LEGITCHECK CMD ERROR]', err);
      return interaction.editReply({ content: `❌ Error: ${err.message}` });
    }
  }
};

module.exports = {
  data: pavoLegitCheckCmd.data,
  execute: pavoLegitCheckCmd.execute,
  sendOrUpdateLegitCheck,
  handleButton
};
