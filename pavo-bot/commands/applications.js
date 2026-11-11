/**
 * Pavo Team Applications
 *
 * - Persistent application panel (Content Creator / Beta Tester / Staff) in the applications channel.
 * - Private application tickets that reuse the existing ticket database + Close / Reopen / Delete flow
 *   from commands/ticket.js (buttons `ticket_close` / `ticket_delete` / `ticket_reopen`).
 * - Multi-part modal forms (Discord allows max 5 inputs per modal), state persisted in the JSON DB.
 * - Staff review (Accept / Deny) — nobody is ever accepted automatically.
 *
 * All custom IDs are static / channel-scoped, so every button keeps working after a bot restart.
 *
 * Custom IDs:
 *   app_open:<type>          panel button → create application ticket
 *   app_start                in-ticket button → open the next form part
 *   app_review:accept|deny   staff review buttons on the submitted application
 *   app_modal:<type>:<page>  modal submissions
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} = require('discord.js');
const db = require('../database');
const { positions, PARAGRAPH } = require('../applications.config');

const PANEL_KEY = 'applications';
const PANEL_TITLE = 'Pavo Team Applications';
const FOOTER_TEXT = 'Pavo · Team Applications';
const QUESTIONS_PER_PAGE = 5;
const TOPIC_MARKER_REGEX = /\[pavo-app:([a-z_]+):(\d{15,25})\]/;

// Prevents double-click race conditions creating two channels for the same user/position
const creationLocks = new Set();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ephemeral(content, extra = {}) {
  return { content, flags: MessageFlags.Ephemeral, ...extra };
}

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch (err) {
    console.error('[APPLICATIONS] Failed to reply to interaction:', err.message);
    return null;
  }
}

function brandColor(config) {
  return config.embedColor || '#4f46e5';
}

function sanitizeChannelName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90) || 'application';
}

function getPages(position) {
  const pages = [];
  for (let i = 0; i < position.questions.length; i += QUESTIONS_PER_PAGE) {
    pages.push(position.questions.slice(i, i + QUESTIONS_PER_PAGE));
  }
  return pages;
}

function resolveRoleId(nameOrId, config) {
  if (!nameOrId) return null;
  const mapped = (config.staffRoles || {})[nameOrId] || nameOrId;
  return /^\d{15,25}$/.test(String(mapped)) ? String(mapped) : null;
}

// Reviewer roles come from config.applications.reviewerRoles (role names from config.staffRoles, or raw IDs).
// Only roles that actually exist in the guild are returned, so a deleted role never breaks channel creation.
function getReviewerRoleIds(guild, config, type) {
  const configured = config.applications?.reviewerRoles?.[type];
  const names = Array.isArray(configured) && configured.length > 0 ? configured : Object.keys(config.staffRoles || {});

  let ids = names.map(n => resolveRoleId(n, config)).filter(Boolean);
  if (guild) ids = ids.filter(id => guild.roles.cache.has(id));

  if (ids.length === 0) {
    // Fallback: every configured staff role that exists in the guild
    ids = Object.values(config.staffRoles || {})
      .filter(id => /^\d+$/.test(String(id)) && (!guild || guild.roles.cache.has(id)));
    if (configured) console.warn(`[APPLICATIONS] No valid reviewer roles found for "${type}". Falling back to all staff roles.`);
  }
  return [...new Set(ids)];
}

function isReviewer(member, config, type) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  const ids = getReviewerRoleIds(member.guild, config, type);
  return ids.some(id => member.roles.cache.has(id));
}

function getStatusText(ticketInfo) {
  const app = ticketInfo?.application || {};
  const position = positions[app.type];
  const totalPages = position ? getPages(position).length : 1;

  switch (app.status) {
    case 'IN_PROGRESS':
      return `✏️ In progress (part ${Math.max(1, (app.next_page || 1) - 1)}/${totalPages} saved)`;
    case 'PENDING':
      return '🟡 Submitted — Pending review';
    case 'ACCEPTED':
      return `✅ Accepted${app.reviewed_by ? ` by <@${app.reviewed_by}>` : ''}`;
    case 'DENIED':
      return `❌ Not accepted${app.reviewed_by ? ` — reviewed by <@${app.reviewed_by}>` : ''}`;
    default:
      return '🟢 Open — Awaiting application';
  }
}

// Controls shown on the ticket's main message (also used by ticket.js when a ticket is reopened)
function buildControlsRow(ticketInfo) {
  const app = ticketInfo?.application || {};
  const position = positions[app.type];
  const row = new ActionRowBuilder();

  const canFill = !app.status || app.status === 'NOT_STARTED' || app.status === 'IN_PROGRESS';
  if (position && canFill) {
    const totalPages = getPages(position).length;
    const nextPage = app.next_page || 1;
    const label = app.status === 'IN_PROGRESS'
      ? `Continue Application (${nextPage}/${totalPages})`
      : 'Start Application';
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('app_start')
        .setLabel(label)
        .setEmoji('📝')
        .setStyle(ButtonStyle.Primary)
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Close Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket_delete')
      .setLabel('Delete Ticket')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger)
  );
  return row;
}

function isApplicationChannel(channel) {
  return !!(channel && typeof channel.topic === 'string' && TOPIC_MARKER_REGEX.test(channel.topic));
}

// Returns the DB record for an application ticket channel. If the JSON DB was reset
// (e.g. redeploy on an ephemeral filesystem) the record is rebuilt from the channel topic.
async function resolveApplicationTicket(channel) {
  if (!channel) return null;
  const existing = await db.getTicket(channel.id);
  if (existing && existing.kind === 'application' && existing.application?.type) return existing;

  const match = typeof channel.topic === 'string' ? channel.topic.match(TOPIC_MARKER_REGEX) : null;
  if (!match || !positions[match[1]]) return null;

  const [, type, applicantId] = match;
  const freshState = { type, status: 'NOT_STARTED', answers: {}, next_page: 1 };

  if (existing) {
    const rootPatch = (!existing.creator_id || existing.creator_id === 'Unknown') ? { creator_id: applicantId } : {};
    return db.updateTicketApplication(channel.id, freshState, rootPatch);
  }

  console.warn(`[APPLICATIONS] Rebuilt missing DB record for application channel #${channel.name}`);
  return db.createTicket(channel.id, applicantId, 'Unknown', null, { kind: 'application', application: freshState });
}

async function fetchMessageSafe(channel, messageId) {
  if (!channel || !messageId) return null;
  return channel.messages.fetch(messageId).catch(() => null);
}

// Keeps the ticket's main message (status field + buttons) in sync with the application state
async function refreshWelcomeMessage(channel, ticketInfo) {
  try {
    const msg = await fetchMessageSafe(channel, ticketInfo?.welcome_message_id);
    if (!msg || !msg.embeds[0]) return;
    const embed = EmbedBuilder.from(msg.embeds[0]).setFields(
      ...msg.embeds[0].fields.filter(f => f.name !== '⏳ Status'),
      { name: '⏳ Status', value: getStatusText(ticketInfo), inline: true }
    );
    const payload = { embeds: [embed] };
    if (ticketInfo.status !== 'CLOSED') payload.components = [buildControlsRow(ticketInfo)];
    await msg.edit(payload);
  } catch (err) {
    console.warn('[APPLICATIONS] Could not refresh ticket message:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

function isPositionOpen(key, config) {
  const openMap = config?.applications?.openPositions;
  if (openMap && typeof openMap[key] === 'boolean') {
    return openMap[key];
  }
  // By default, only beta_tester is open; content_creator and staff are locked/closed
  return key === 'beta_tester';
}

function buildPanelEmbed(config, guild) {
  const embed = new EmbedBuilder()
    .setTitle(PANEL_TITLE)
    .setColor(brandColor(config))
    .setDescription(
      'Pavo is expanding, and we are looking for dedicated members of the community to join our team.\n\n' +
      'Review the available positions and their current status below:\n\u200b'
    )
    .addFields(
      ...Object.values(positions).map(p => {
        const open = isPositionOpen(p.key, config);
        const statusText = open
          ? '🟢 **Status: Open / Accepting Applications**'
          : '🔴 **Status: Closed / Not Hiring At This Time**';
        return {
          name: `${p.emoji}  ${p.name}`,
          value: `${p.panelSummary}\n${statusText}\n\u200b`,
          inline: false
        };
      }),
      {
        name: '📋  Before You Apply',
        value:
          '• Read the requirements inside your ticket carefully\n' +
          '• Answer every question honestly and in detail\n' +
          '• One open application per position\n' +
          '• Every application is reviewed manually by our team'
      },
      {
        name: '\u200b',
        value: 'Click an active button below to open your **private application ticket**.'
      }
    )
    .setFooter({ text: FOOTER_TEXT, iconURL: guild?.iconURL() || undefined })
    .setTimestamp();

  const icon = guild?.iconURL({ size: 256 });
  if (icon) embed.setThumbnail(icon);
  return embed;
}

function buildPanelComponents(config) {
  return Object.values(positions).map(p => {
    const open = isPositionOpen(p.key, config);
    const button = new ButtonBuilder()
      .setCustomId(`app_open:${p.key}`)
      .setLabel(open ? `Apply for ${p.name}` : `${p.name} (Closed)`)
      .setEmoji(open ? p.emoji : '🔒')
      .setStyle(open ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(!open);

    return new ActionRowBuilder().addComponents(button);
  });
}

// Creates the panel once, then edits it in place on every restart (no duplicates).
async function sendOrUpdateApplicationPanel(client, config) {
  const channelId = config.applications?.panelChannelId;
  if (!channelId) {
    console.warn('[APPLICATIONS] applications.panelChannelId is not configured. Skipping panel.');
    return null;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    console.warn(`[APPLICATIONS] Applications channel ${channelId} not found or not a text channel.`);
    return null;
  }

  try {
    const payload = { embeds: [buildPanelEmbed(config, channel.guild)], components: buildPanelComponents(config) };

    let panelMsg = null;
    const stored = await db.getPanelMessage(PANEL_KEY);
    if (stored && stored.channelId === channel.id) {
      panelMsg = await fetchMessageSafe(channel, stored.messageId);
    }

    // Fallback scan (DB reset / first run). Also removes duplicate panels posted by the bot.
    const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
    if (recent) {
      const botPanels = recent.filter(m => m.author.id === client.user.id && m.embeds[0]?.title === PANEL_TITLE);
      if (!panelMsg && botPanels.size > 0) panelMsg = botPanels.last(); // oldest
      for (const dup of botPanels.values()) {
        if (panelMsg && dup.id !== panelMsg.id) await dup.delete().catch(() => {});
      }
    }

    if (panelMsg) {
      await panelMsg.edit(payload);
      console.log(`[APPLICATIONS] Application panel updated in #${channel.name}`);
    } else {
      panelMsg = await channel.send(payload);
      console.log(`[APPLICATIONS] Application panel posted in #${channel.name}`);
    }

    await db.setPanelMessage(PANEL_KEY, channel.id, panelMsg.id);
    return panelMsg;
  } catch (err) {
    console.error('[APPLICATIONS] Failed to send/update application panel:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Ticket creation
// ---------------------------------------------------------------------------

function buildWelcomeEmbed(position, user, config, guild, ticketInfo) {
  const totalPages = getPages(position).length;
  const questionList = position.questions.map((q, i) => `\`${i + 1}.\` ${q.label}${q.required === false ? ' *(optional)*' : ''}`).join('\n');
  const requirementList = position.requirements.map(r => `• ${r}`).join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`${position.emoji}  ${position.name} Application`)
    .setColor(brandColor(config))
    .setDescription(
      `Welcome <@${user.id}>, thank you for your interest in joining the Pavo team.\n\n` +
      `${position.intro}\n\n` +
      `**Requirements**\n${requirementList}\n\n` +
      `**Application Form**\n${questionList}\n\n` +
      `**How to Apply**\n` +
      `Press **Start Application** below. The form is split into **${totalPages} short part${totalPages > 1 ? 's' : ''}**. ` +
      `Once submitted, our team will review your application in this ticket. Please do not ping staff — every application is reviewed.`
    )
    .addFields(
      { name: '👤 Applicant', value: `<@${user.id}>`, inline: true },
      { name: '📋 Position', value: position.name, inline: true },
      { name: '⏳ Status', value: getStatusText(ticketInfo), inline: true }
    )
    .setFooter({ text: FOOTER_TEXT, iconURL: guild?.iconURL() || undefined })
    .setTimestamp();

  const icon = guild?.iconURL({ size: 256 });
  if (icon) embed.setThumbnail(icon);
  return embed;
}

async function resolveParentCategory(guild, config) {
  const targetId = config.applications?.categoryId || '1532385488554430575';
  const candidates = [targetId, config.ticketCategoryId].filter(id => id && /^\d+$/.test(id));
  for (const id of candidates) {
    const category = guild.channels.cache.get(id) || await guild.channels.fetch(id).catch(() => null);
    if (category && category.type === ChannelType.GuildCategory) return category.id;
  }
  return null;
}

async function findExistingApplicationChannel(guild, userId, type) {
  // 1) Database record
  const existing = await db.getUserOpenApplication(userId, type);
  if (existing) {
    const ch = guild.channels.cache.get(existing.ticket_id) || await guild.channels.fetch(existing.ticket_id).catch(() => null);
    if (ch) return ch;
    await db.deleteTicket(existing.ticket_id); // channel was removed manually → clean up DB
  }

  // 2) Channel topic marker (covers a reset database)
  const marker = `[pavo-app:${type}:${userId}]`;
  for (const ch of guild.channels.cache.values()) {
    if (ch.type === ChannelType.GuildText && typeof ch.topic === 'string' && ch.topic.includes(marker)) {
      const record = await db.getTicket(ch.id);
      if (!record) return ch;
    }
  }
  return null;
}

async function openApplicationTicket(interaction, config, type) {
  const position = positions[type];
  if (!position) return safeReply(interaction, ephemeral('❌ This position is no longer available.'));

  if (!isPositionOpen(type, config)) {
    return safeReply(interaction, ephemeral('🔒 Applications for this position are currently closed.'));
  }

  if (!interaction.guild) return safeReply(interaction, ephemeral('❌ Applications can only be opened inside the server.'));

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const lockKey = `${interaction.user.id}:${type}`;
  if (creationLocks.has(lockKey)) {
    return interaction.editReply({ content: '⏳ Your application ticket is already being created.' });
  }
  creationLocks.add(lockKey);

  const guild = interaction.guild;
  const user = interaction.user;
  let channel = null;

  try {
    const existingChannel = await findExistingApplicationChannel(guild, user.id, type);
    if (existingChannel) {
      return interaction.editReply({ content: `ℹ️ You already have an open **${position.name}** application: <#${existingChannel.id}>` });
    }

    const reviewerRoleIds = getReviewerRoleIds(guild, config, type);
    const memberPerms = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks
    ];

    const permissionOverwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: memberPerms },
      { id: interaction.client.user.id, allow: [...memberPerms, PermissionFlagsBits.ManageChannels] },
      ...reviewerRoleIds.map(id => ({ id, allow: memberPerms }))
    ];

    const channelOptions = {
      name: sanitizeChannelName(`${position.channelPrefix}-${user.username}`),
      type: ChannelType.GuildText,
      parent: await resolveParentCategory(guild, config),
      permissionOverwrites,
      topic: `Pavo Application | Position: ${position.name} | Applicant: ${user.username} (${user.id}) | [pavo-app:${type}:${user.id}]`
    };

    try {
      channel = await guild.channels.create(channelOptions);
    } catch (createErr) {
      // Category full / missing access → retry without a parent category
      if (!channelOptions.parent) throw createErr;
      console.warn('[APPLICATIONS] Channel creation in category failed, retrying without category:', createErr.message);
      channel = await guild.channels.create({ ...channelOptions, parent: null });
    }

    const initialState = { type, status: 'NOT_STARTED', answers: {}, next_page: 1 };
    const pseudoTicket = { application: initialState, status: 'OPEN' };

    const welcomeMsg = await channel.send({
      content: `<@${user.id}>`,
      embeds: [buildWelcomeEmbed(position, user, config, guild, pseudoTicket)],
      components: [buildControlsRow(pseudoTicket)],
      allowedMentions: { users: [user.id] }
    });

    await db.createTicket(channel.id, user.id, user.username, welcomeMsg.id, {
      kind: 'application',
      application: initialState
    });

    return interaction.editReply({ content: `✅ Your **${position.name}** application ticket has been created: <#${channel.id}>` });
  } catch (err) {
    console.error(`[APPLICATIONS] Failed to create ${type} application ticket:`, err);
    if (channel) await channel.delete('Application ticket setup failed').catch(() => {});
    return interaction.editReply({ content: '❌ Could not create your application ticket. Please try again later or contact a staff member.' }).catch(() => {});
  } finally {
    creationLocks.delete(lockKey);
  }
}

// ---------------------------------------------------------------------------
// Form (modals)
// ---------------------------------------------------------------------------

function buildModal(position, page, user, savedAnswers = {}) {
  const pages = getPages(position);
  const questions = pages[page - 1] || [];

  const modal = new ModalBuilder()
    .setCustomId(`app_modal:${position.key}:${page}`)
    .setTitle(`${position.name} Application (${page}/${pages.length})`.slice(0, 45));

  for (const q of questions) {
    const input = new TextInputBuilder()
      .setCustomId(q.key)
      .setLabel(q.label.slice(0, 45))
      .setStyle(q.style === PARAGRAPH ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(q.required !== false)
      .setMaxLength(q.maxLength || (q.style === PARAGRAPH ? 700 : 150));

    if (q.placeholder) input.setPlaceholder(q.placeholder.slice(0, 100));

    const prefill = savedAnswers[q.key] || (q.prefillUsername ? user.username : '');
    if (prefill) input.setValue(String(prefill).slice(0, q.maxLength || 700));

    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }
  return modal;
}

async function handleStartButton(interaction, config) {
  const ticket = await resolveApplicationTicket(interaction.channel);
  if (!ticket) return safeReply(interaction, ephemeral('❌ This application ticket could not be found.'));

  const app = ticket.application;
  const position = positions[app.type];
  if (!position) return safeReply(interaction, ephemeral('❌ This position is no longer available.'));

  if (interaction.user.id !== ticket.creator_id) {
    return safeReply(interaction, ephemeral('❌ Only the applicant can fill out this application.'));
  }
  if (ticket.status !== 'OPEN') {
    return safeReply(interaction, ephemeral('🔒 This ticket is closed.'));
  }
  if (app.status === 'PENDING' || app.status === 'ACCEPTED' || app.status === 'DENIED') {
    return safeReply(interaction, ephemeral('ℹ️ Your application has already been submitted.'));
  }

  const totalPages = getPages(position).length;
  const page = Math.min(Math.max(app.next_page || 1, 1), totalPages);
  return interaction.showModal(buildModal(position, page, interaction.user, app.answers || {}));
}

function buildSubmissionEmbed(position, ticket, user, config, guild) {
  const answers = ticket.application.answers || {};
  const embed = new EmbedBuilder()
    .setTitle(`${position.emoji}  ${position.name} Application — Submitted`)
    .setColor(brandColor(config))
    .setAuthor({ name: user.username, iconURL: user.displayAvatarURL({ size: 128 }) })
    .setDescription(`Submitted by <@${user.id}> · Awaiting review by the Pavo team.`)
    .addFields(
      ...position.questions.map((q, i) => ({
        name: `${i + 1}. ${q.label}`,
        value: (answers[q.key] && String(answers[q.key]).trim()) ? String(answers[q.key]).slice(0, 1024) : '—',
        inline: q.style !== PARAGRAPH && String(answers[q.key] || '').length <= 40
      })),
      { name: '📌 Review Status', value: '🟡 Pending review', inline: false }
    )
    .setFooter({ text: FOOTER_TEXT, iconURL: guild?.iconURL() || undefined })
    .setTimestamp();
  return embed;
}

function buildReviewRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('app_review:accept')
      .setLabel('Accept')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('app_review:deny')
      .setLabel('Deny')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
}

async function handleModal(interaction, config) {
  const [, type, pageStr] = interaction.customId.split(':');
  const page = parseInt(pageStr, 10);
  const position = positions[type];

  if (!position || !Number.isInteger(page)) {
    return safeReply(interaction, ephemeral('❌ This application form is no longer valid.'));
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const ticket = await resolveApplicationTicket(interaction.channel);
  if (!ticket || ticket.application.type !== type) {
    return interaction.editReply({ content: '❌ This application ticket could not be found.' });
  }
  if (interaction.user.id !== ticket.creator_id) {
    return interaction.editReply({ content: '❌ Only the applicant can fill out this application.' });
  }
  if (ticket.status !== 'OPEN') {
    return interaction.editReply({ content: '🔒 This ticket is closed.' });
  }
  if (['PENDING', 'ACCEPTED', 'DENIED'].includes(ticket.application.status)) {
    return interaction.editReply({ content: 'ℹ️ Your application has already been submitted.' });
  }

  const pages = getPages(position);
  const questions = pages[page - 1] || [];
  const answers = { ...(ticket.application.answers || {}) };
  for (const q of questions) {
    try {
      answers[q.key] = interaction.fields.getTextInputValue(q.key)?.trim() || '';
    } catch (_) {
      answers[q.key] = answers[q.key] || '';
    }
  }

  // More parts to go
  if (page < pages.length) {
    const updated = await db.updateTicketApplication(interaction.channel.id, {
      answers,
      status: 'IN_PROGRESS',
      next_page: page + 1
    });
    await refreshWelcomeMessage(interaction.channel, updated);

    const continueRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('app_start')
        .setLabel(`Continue to Part ${page + 1}/${pages.length}`)
        .setEmoji('📝')
        .setStyle(ButtonStyle.Primary)
    );
    return interaction.editReply({
      content: `✅ **Part ${page}/${pages.length} saved.** Continue with the next part to complete your application.`,
      components: [continueRow]
    });
  }

  // Final part → submit for review
  let updated = await db.updateTicketApplication(interaction.channel.id, {
    answers,
    status: 'PENDING',
    next_page: pages.length + 1,
    submitted_at: new Date().toISOString()
  });

  const submissionEmbed = buildSubmissionEmbed(position, updated, interaction.user, config, interaction.guild);

  const pingRoleId = resolveRoleId(config.applications?.pingRoles?.[type], config);
  const validPing = pingRoleId && interaction.guild.roles.cache.has(pingRoleId) ? pingRoleId : null;

  try {
    const summaryMsg = await interaction.channel.send({
      content: validPing ? `<@&${validPing}> — new **${position.name}** application to review.` : undefined,
      embeds: [submissionEmbed],
      components: [buildReviewRow(false)],
      allowedMentions: { roles: validPing ? [validPing] : [] }
    });
    updated = await db.updateTicketApplication(interaction.channel.id, { summary_message_id: summaryMsg.id });
  } catch (err) {
    console.error('[APPLICATIONS] Failed to post application summary:', err.message);
  }

  await refreshWelcomeMessage(interaction.channel, updated);

  // Optional copy to a dedicated application log channel
  const logChannelId = config.applications?.logChannelId;
  if (logChannelId && /^\d+$/.test(logChannelId)) {
    const logChannel = await interaction.client.channels.fetch(logChannelId).catch(() => null);
    if (logChannel?.isTextBased()) {
      const logEmbed = EmbedBuilder.from(submissionEmbed)
        .setDescription(`Submitted by <@${interaction.user.id}> in <#${interaction.channel.id}>`);
      await logChannel.send({ embeds: [logEmbed] }).catch(err => console.warn('[APPLICATIONS] Log send failed:', err.message));
    }
  }

  return interaction.editReply({
    content: '✅ **Application submitted.** Our team will review it and respond in this ticket. Thank you for applying.',
    components: []
  });
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

async function handleReview(interaction, config, decision) {
  const ticket = await resolveApplicationTicket(interaction.channel);
  if (!ticket) return safeReply(interaction, ephemeral('❌ This application ticket could not be found.'));

  const app = ticket.application;
  const position = positions[app.type];

  if (!isReviewer(interaction.member, config, app.type)) {
    return safeReply(interaction, ephemeral('❌ Only authorized staff can review applications.'));
  }
  if (app.status === 'ACCEPTED' || app.status === 'DENIED') {
    return safeReply(interaction, ephemeral('ℹ️ This application has already been reviewed.'));
  }

  await interaction.deferUpdate();

  const accepted = decision === 'accept';
  const updated = await db.updateTicketApplication(interaction.channel.id, {
    status: accepted ? 'ACCEPTED' : 'DENIED',
    reviewed_by: interaction.user.id,
    reviewed_at: new Date().toISOString()
  });

  // Update submission embed + disable review buttons
  try {
    const oldEmbed = interaction.message.embeds[0];
    if (oldEmbed) {
      const embed = EmbedBuilder.from(oldEmbed)
        .setColor(accepted ? '#22c55e' : '#ef4444')
        .setFields(
          ...oldEmbed.fields.filter(f => f.name !== '📌 Review Status'),
          {
            name: '📌 Review Status',
            value: `${accepted ? '✅ Accepted' : '❌ Not accepted'} by <@${interaction.user.id}>`,
            inline: false
          }
        );
      await interaction.message.edit({ embeds: [embed], components: [buildReviewRow(true)] });
    }
  } catch (err) {
    console.warn('[APPLICATIONS] Could not update submission embed:', err.message);
  }

  await refreshWelcomeMessage(interaction.channel, updated);

  const name = position ? position.name : 'this position';
  const applicant = updated.creator_id && updated.creator_id !== 'Unknown' ? `<@${updated.creator_id}>` : 'Applicant';
  const message = accepted
    ? `✅ ${applicant}, your **${name}** application has been **accepted**. A team member will follow up with the next steps here.`
    : `${applicant}, thank you for applying. After review, your **${name}** application was **not accepted** at this time. You are welcome to apply again in the future.`;

  await interaction.channel.send({
    content: message,
    allowedMentions: { users: updated.creator_id && updated.creator_id !== 'Unknown' ? [updated.creator_id] : [] }
  }).catch(err => console.warn('[APPLICATIONS] Could not post review result:', err.message));
}

// ---------------------------------------------------------------------------
// Router + slash command
// ---------------------------------------------------------------------------

async function handleButton(interaction, config) {
  const customId = interaction.customId;

  if (customId.startsWith('app_open:')) {
    return openApplicationTicket(interaction, config, customId.split(':')[1]);
  }
  if (customId === 'app_start') {
    return handleStartButton(interaction, config);
  }
  if (customId.startsWith('app_review:')) {
    return handleReview(interaction, config, customId.split(':')[1]);
  }
}

const data = new SlashCommandBuilder()
  .setName('applications-panel')
  .setDescription('Post or refresh the Pavo Team Applications panel')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction, config) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const msg = await sendOrUpdateApplicationPanel(interaction.client, config);
  if (msg) {
    return interaction.editReply({ content: `✅ Application panel posted / updated in <#${msg.channelId}>.` });
  }
  return interaction.editReply({ content: '❌ Could not post the application panel. Check `applications.panelChannelId` in config.json and the bot permissions in that channel.' });
}

module.exports = {
  data,
  execute,
  handleButton,
  handleModal,
  sendOrUpdateApplicationPanel,
  buildControlsRow,
  getStatusText,
  isApplicationChannel,
  resolveApplicationTicket
};

