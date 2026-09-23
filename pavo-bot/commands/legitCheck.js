const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../database');

// Baseline initial counts
const BASE_YES = 400;
const BASE_NO = 2;

function buildLegitCheckEmbed() {
  return new EmbedBuilder()
    .setTitle('🛡️ PAVO TWEAK — LEGIT CHECK & COMMUNITY TRUST')
    .setColor(0x3B82F6)
    .setDescription(
      `We are constantly working on delivering top-tier performance tweaks and premium software to our community. Whether you're looking for extreme FPS boost, lower input delay, system optimization, or custom scripts — we aim to have something for everyone.\n\n` +
      `We don't just want you to make a purchase or boost — we want you to be **satisfied with your purchase**.\n\n` +
      `### 👥 OUR COMMUNITY\n` +
      `Our Discord community is an important part of our shop. We listen to customer feedback, improve our services based on your suggestions, and make sure everyone has a place where they can ask questions or get help.\n\n` +
      `**Have a question before getting PavoTweak?**\n` +
      `No problem! Open a ticket and our support team will be happy to help you 24/7.\n\n` +
      `### 🎯 OUR GOAL\n` +
      `Our goal is to build a shop that people can trust and come back to again and again.\n\n` +
      `We care about:\n` +
      `✅ **Quality**\n` +
      `✅ **Reliability**\n` +
      `✅ **Fast service**\n` +
      `✅ **Fair prices**\n` +
      `✅ **Customer satisfaction**\n\n` +
      `────────────────────────────────────────────\n\n` +
      `⚠️ **ATTENZIONE / REGOLA FEEDBACK:**\n` +
      `Se voti **NO**, devi obbligatoriamente aprire un ticket e fornire una **proof valida** (prova reale/video). Se voti **NO senza alcuna prova valida**, verrai **bannato permanentemente** dal server per diffamazione e falsità.\n\n` +
      `────────────────────────────────────────────\n\n` +
      `**So, the real question is...**\n\n` +
      `### Would you buy from us / Do you trust Pavo Tweak?\n\n` +
      `*Vote below and let us know what you think!*`
    )
    .setFooter({ text: 'Pavo Tweak Official • Community Trust & Legit Check' })
    .setTimestamp();
}

function buildLegitCheckButtons(yesCount, noCount) {
  const yesButton = new ButtonBuilder()
    .setCustomId('legit_vote_yes')
    .setLabel(`Yes (${yesCount})`)
    .setEmoji('✅')
    .setStyle(ButtonStyle.Success);

  const noButton = new ButtonBuilder()
    .setCustomId('legit_vote_no')
    .setLabel(`No (${noCount})`)
    .setEmoji('❌')
    .setStyle(ButtonStyle.Danger);

  return new ActionRowBuilder().addComponents(yesButton, noButton);
}

async function sendOrUpdateLegitCheck(client, config) {
  try {
    const guild = client.guilds.cache.get(config.guildId) || client.guilds.cache.first();
    if (!guild) return null;

    const channelId = config.legitCheckChannelId || '1532484367090323467';
    let targetChannel = null;
    try {
      targetChannel = await guild.channels.fetch(channelId).catch(() => null);
    } catch (_) {}

    if (!targetChannel) {
      console.warn(`[LEGIT-CHECK] Channel ${channelId} not found in guild.`);
      return null;
    }

    // Get current votes from database
    const pollData = await db.getLegitCheckData();
    const yesCount = BASE_YES + (pollData.yesVotes || 0);
    const noCount = BASE_NO + (pollData.noVotes || 0);

    const embed = buildLegitCheckEmbed();
    const row = buildLegitCheckButtons(yesCount, noCount);

    // Check if message already exists
    let existingMsg = null;
    if (pollData.messageId) {
      existingMsg = await targetChannel.messages.fetch(pollData.messageId).catch(() => null);
    }

    if (!existingMsg) {
      const messages = await targetChannel.messages.fetch({ limit: 15 }).catch(() => null);
      if (messages) {
        existingMsg = messages.find(m => m.author.id === client.user.id && m.embeds.some(e => e.title?.includes('LEGIT CHECK & COMMUNITY TRUST')));
      }
    }

    if (existingMsg) {
      await existingMsg.edit({ embeds: [embed], components: [row] });
      await db.setLegitCheckMessage(targetChannel.id, existingMsg.id);
      console.log('[LEGIT-CHECK] Updated existing legit check poll in channel:', targetChannel.name);
      return existingMsg;
    } else {
      const sentMsg = await targetChannel.send({ embeds: [embed], components: [row] });
      await sentMsg.pin().catch(() => {});
      await db.setLegitCheckMessage(targetChannel.id, sentMsg.id);
      console.log('[LEGIT-CHECK] Sent and pinned new legit check poll in channel:', targetChannel.name);
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

    const yesCount = BASE_YES + (result.yesVotes || 0);
    const noCount = BASE_NO + (result.noVotes || 0);

    // Update the message components with latest counts
    const updatedRow = buildLegitCheckButtons(yesCount, noCount);
    await interaction.message.edit({ components: [updatedRow] }).catch(() => {});

    if (isYes) {
      return interaction.reply({
        content: `✅ **Thank you for your vote!** We appreciate your trust in Pavo Tweak!`,
        flags: 64
      });
    } else {
      return interaction.reply({
        content:
          `⚠️ **Warning: You voted NO.**\n\n` +
          `*Please note:* Submitting false negative feedback or claiming that we scam without submitting verifiable proof to our staff team in a ticket will result in an **immediate permanent ban** from the Pavo Discord server.`,
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
    .setDescription('Send or refresh the Legit Check & Community Trust embed in the vouches channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, config) {
    await interaction.deferReply({ flags: 64 });
    try {
      const msg = await sendOrUpdateLegitCheck(interaction.client, config);
      if (msg) {
        return interaction.editReply({ content: `✅ Legit check embed posted / updated in <#${config.legitCheckChannelId || '1532484367090323467'}>!` });
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
