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
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  AttachmentBuilder
} = require('discord.js');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { createChannelWithOverflow } = require('../utils/channelCategory');
const dmNotifier = require('../utils/dmNotifier');

// Helper to sanitize channel names to be valid Discord syntax
function sanitizeChannelName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Helper to determine if a member has a staff role
function getStaffRoleName(member, config) {
  for (const roleName of config.staffHierarchy) {
    const roleId = config.staffRoles[roleName];
    if (roleId && member.roles.cache.has(roleId)) {
      return roleName;
    }
  }
  return null;
}

// Helper to check if a user already has an active ticket channel
async function hasActiveTicket(guild, userId) {
  const existingTicket = await db.getUserOpenTicket(userId);
  if (existingTicket) {
    const channel = guild.channels.cache.get(existingTicket.ticket_id) || await guild.channels.fetch(existingTicket.ticket_id).catch(() => null);
    if (channel) {
      return true;
    } else {
      // Database was out of sync (channel deleted manually), clean it up in DB
      await db.closeTicket(existingTicket.ticket_id, guild.client.user.id, 'System (Cleanup)');
    }
  }
  return false;
}

// Shared ticket creator logic
// `options` (optional): { footerText, kind: 'support' | 'purchase', categoryId }
async function createTicketChannel(interaction, config, productName, channelSuffix, fields, options = {}) {
  const guild = interaction.guild;
  const user = interaction.user;

  if (await hasActiveTicket(guild, user.id)) {
    throw new Error('You already have an open ticket.');
  }

  const ticketName = sanitizeChannelName(`${user.username}-${channelSuffix}`);

  // Build Permission Overwrites
  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ],
    }
  ];

  // Add permissions for configured staff roles + vouch roles
  const staffAndVouchIds = new Set([
    ...Object.values(config.allStaffRoles || config.staffRoles || {}),
    config.vouchRoleId || '1532384602205851749',
    ...(Array.isArray(config.vouchOnlyRoleIds) ? config.vouchOnlyRoleIds : []),
    '1439210704291762258',
    '1538244553637634118'
  ]);
  for (const roleId of staffAndVouchIds) {
    if (roleId && String(roleId).match(/^\d+$/)) {
      permissionOverwrites.push({
        id: String(roleId),
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks
        ],
      });
    }
  }

  const candidateCategories = [options.categoryId, config.ticketCategoryId].filter(Boolean);

  // Create Channel (automatically handles overflow categories if the 50-channel category limit is reached)
  const channel = await createChannelWithOverflow(guild, candidateCategories, {
    name: ticketName,
    type: ChannelType.GuildText,
    permissionOverwrites: permissionOverwrites,
    topic: `Support Ticket | Creator: ${user.username} (${user.id}) | Product: ${productName}`
  });

  // Welcome Embed
  const welcomeEmbed = new EmbedBuilder()
    .setTitle(`🎟️ ${productName} Support Ticket`)
    .setDescription(`Welcome to your support ticket, <@${user.id}>!\n\nA member of our official staff team will assist you shortly. Please clarify your purchase request or details.`)
    .setColor(config.embedColor || '#4f46e5')
    .addFields(
      { name: '👤 Creator', value: `<@${user.id}> (${user.username})`, inline: true },
      { name: '📦 Product', value: productName, inline: true },
      { name: '⏳ Status', value: '🟢 Open / Unclaimed', inline: true }
    );

  // Add system specifications if Pavo Tweak was selected
  if (fields && fields.length > 0) {
    welcomeEmbed.addFields(...fields);
  }

  const footerText = options.footerText || (productName.includes('Orbs')
    ? 'Orbs Premium Support'
    : (config.embedFooterText || 'Pavo Tweak Support'));

  welcomeEmbed
    .setThumbnail(guild.iconURL({ dynamic: true }) || null)
    .setFooter({ text: footerText, iconURL: guild.iconURL() || null })
    .setTimestamp();

  // Buttons inside the active ticket
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_claim')
      .setLabel('Claim Ticket')
      .setEmoji('📥')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Close')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket_add_user')
      .setLabel('Add User')
      .setEmoji('➕')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket_remove_user')
      .setLabel('Remove User')
      .setEmoji('➖')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket_purchase')
      .setLabel('Purchase')
      .setEmoji('💰')
      .setStyle(ButtonStyle.Success)
  );

  // Second row: Vouch button (staff with vouch access only)
  const vouchRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_vouch')
      .setLabel('Vouch')
      .setEmoji('⭐')
      .setStyle(ButtonStyle.Secondary)
  );

  // Send greeting tagging the user and the first staff role
  const pingRoleId = Object.values(config.staffRoles).filter(id => id.match(/^\d+$/))[0];
  const welcomeMsg = await channel.send({
    content: `<@${user.id}>${pingRoleId ? ` | <@&${pingRoleId}>` : ''}`,
    embeds: [welcomeEmbed],
    components: [row, vouchRow]
  });

  // Track staff-opened tickets if creator is a staff member
  if (interaction.member && getStaffRoleName(interaction.member, config)) {
    await db.ensureStaffExists(user.id, user.username);
  }

  // Save to persistent DB with welcome message ID for reliable lookup
  await db.createTicket(channel.id, user.id, user.username, welcomeMsg.id, {
    kind: options.kind || 'support',
    product: productName
  });

  // Automatically notify the member via DM that their ticket has been opened
  await dmNotifier.notifyTicketOpened({
    client: interaction.client,
    guild,
    config,
    userId: user.id,
    channel,
    productName,
    kind: options.kind || 'support'
  });

  return channel;
}

// Purchase categories shown in the "Open Ticket to Buy" menu (editable in config.json → purchaseTickets.categories)
function getPurchaseCategories(config) {
  const list = Array.isArray(config.purchaseTickets?.categories) ? config.purchaseTickets.categories : [];
  const seen = new Set();
  return list.filter(c => {
    if (!c || !c.value || !c.label || seen.has(c.value)) return false; // no duplicate categories
    seen.add(c.value);
    return true;
  });
}

// Support & service ticket categories
const SUPPORT_TYPES = {
  key_license: { title: 'Key / License Support', suffix: 'license', label: 'Key / License', emoji: '🔑', description: 'License key activation, redemption and issues' },
  report_issue: { title: 'Member Report', suffix: 'report', label: 'Report', emoji: '🚨', description: 'Report a member or server incident' },
  other_support: { title: 'General / Other Support', suffix: 'support', label: 'Other', emoji: '💡', description: 'Other questions or assistance' },
  general_support: { title: 'General Support', suffix: 'general', label: 'General Support', emoji: '🛠️', description: 'General support and server questions' },
  mm_service: { title: 'MM Service', suffix: 'mm', label: 'MM Service', emoji: '🤝', description: 'Official Middleman (MM) service request' }
};

// Exact ticket menu order
const TICKET_MENU_ORDER = [
  'key_license',
  'report_issue',
  'other_support',
  'orbs_pc',
  'custom_bot',
  'pavo_hub_script',
  'general_support',
  'mm_service'
];

// Resolve the target Discord category ID for each ticket type
function resolveTicketCategoryId(typeValue, config) {
  const cats = config.ticketCategories || {};
  switch (typeValue) {
    case 'orbs_pc':
    case 'custom_bot':
      return cats.orbsPcCategoryId || '1571585376815030272';
    case 'pavo_hub_script':
    case 'key_license':
      return cats.pavoHubCategoryId || '1571585519270498429';
    case 'report_issue':
    case 'general_support':
      return cats.supportCategoryId || '1571944513335857283';
    case 'mm_service':
      return process.env.MM_SERVICE_CATEGORY_ID || cats.mmServiceCategoryId || '1571597907537297499';
    case '1v1_issue':
    case 'other_support':
    default:
      return config.ticketCategoryId;
  }
}

// Build the ordered ticket menu options
function buildTicketMenuOptions(config) {
  const purchaseMap = new Map(getPurchaseCategories(config).map(c => [c.value, c]));
  const options = [];
  const added = new Set();

  for (const key of TICKET_MENU_ORDER) {
    if (purchaseMap.has(key)) {
      const c = purchaseMap.get(key);
      const opt = new StringSelectMenuOptionBuilder()
        .setLabel(String(c.label).slice(0, 100))
        .setValue(String(c.value).slice(0, 100));
      if (c.description) opt.setDescription(String(c.description).slice(0, 100));
      if (c.emoji) opt.setEmoji(c.emoji);
      options.push(opt);
      added.add(key);
    } else if (config.purchaseTickets?.showSupportCategories !== false && SUPPORT_TYPES[key]) {
      const t = SUPPORT_TYPES[key];
      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(t.label)
          .setValue(key)
          .setDescription(t.description)
          .setEmoji(t.emoji)
      );
      added.add(key);
    }
  }

  // Append any additional custom purchase categories configured in config.json
  for (const [val, c] of purchaseMap.entries()) {
    if (added.has(val)) continue;
    const opt = new StringSelectMenuOptionBuilder()
      .setLabel(String(c.label).slice(0, 100))
      .setValue(String(c.value).slice(0, 100));
    if (c.description) opt.setDescription(String(c.description).slice(0, 100));
    if (c.emoji) opt.setEmoji(c.emoji);
    options.push(opt);
    added.add(val);
  }

  return options;
}

// ---------------------------------------------------------------------------
// Banner ticket panel (Components V2): banner + one row per ticket type with its own button
// ---------------------------------------------------------------------------
const PANEL_ROWS = {
  key_license: { label: 'Key / License', question: 'Problems with your key or license?', fallback: '🔑', keywords: ['licenzafuturisticaconchiaveanima', 'key', 'license', 'lock'] },
  report_issue: { label: 'Report', question: 'Need to report a member or an incident?', fallback: '🚨', keywords: ['report', 'alert', 'warn', 'siren'] },
  other_support: { label: 'Other', question: 'Not sure which category fits your request?', fallback: '💡', keywords: ['other', 'dots', 'loading', 'question'] },
  orbs_pc: { label: 'Orbs PC', question: 'Want to purchase Orbs for PC?', fallback: '🖥️', keywords: ['orb', 'pc', 'computer'] },
  custom_bot: { label: 'Custom Discord Bot', question: 'Looking for a custom Discord bot?', fallback: '🤖', keywords: ['bot', 'robot', 'code'] },
  pavo_hub_script: { label: "Buy Pavo's Hub Script", question: "Want to buy Pavo's Hub Script?", fallback: '🟦', keywords: ['dashboardpavobestalneonanimato', 'hub', 'script', 'cart'] },
  general_support: { label: 'General Support', question: 'Have a question or need general assistance?', fallback: '🛠️', keywords: ['support', 'help', 'ticket', 'chat'] },
  mm_service: { label: 'MM Service', question: 'Need a trusted middleman for a trade?', fallback: '🤝', keywords: ['mm', 'handshake', 'trade', 'middle', 'money'] }
};

// Picks an animated emoji for a ticket type: config override first, then a matching animated server emoji, then unicode
function resolvePanelEmoji(client, config, value) {
  const spec = PANEL_ROWS[value];
  const override = config.ticketPanel?.emojis?.[value];
  if (override) {
    if (typeof override === 'string') {
      const m = override.match(/^<(a?):(\w+):(\d+)>$/);
      if (m) return { animated: m[1] === 'a', name: m[2], id: m[3] };
      return override;
    }
    return override;
  }
  const animated = client.emojis.cache.filter(e => e.animated && e.available !== false);
  for (const kw of spec.keywords) {
    const found = animated.find(e => e.name.toLowerCase().includes(kw));
    if (found) return { animated: true, name: found.name, id: found.id };
  }
  return spec.fallback;
}

async function buildTicketPanelPayload(client, guild, config) {
  // Make sure freshly uploaded server emojis are in the cache
  try {
    if (guild?.emojis?.fetch) await guild.emojis.fetch();
  } catch (e) {
    console.warn('[TICKET PANEL] Could not refresh guild emojis:', e.message);
  }

  const bannerPath = path.join(__dirname, '..', 'assets', 'ticket-banner.gif');
  const hasBanner = fs.existsSync(bannerPath);

  const container = new ContainerBuilder().setAccentColor(parseInt(String(config.embedColor || '#4f46e5').replace('#', ''), 16));

  if (hasBanner) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://ticket-banner.gif'))
    );
  }

  const available = new Set(buildTicketMenuOptions(config).map(o => o.toJSON().value));
  const order = TICKET_MENU_ORDER.filter(v => available.has(v) && PANEL_ROWS[v]);

  order.forEach((value, idx) => {
    const spec = PANEL_ROWS[value];
    const panelEmoji = resolvePanelEmoji(client, config, value);
    console.log(`[TICKET PANEL] ${value} -> ${typeof panelEmoji === 'string' ? panelEmoji + ' (fallback, no animated emoji found)' : `${panelEmoji.name} (${panelEmoji.id})`}`);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**${spec.question}**\nPress **${spec.label}** to open the matching ticket flow.`)
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`ticket_cat:${value}`)
            .setLabel(spec.label)
            .setEmoji(panelEmoji)
            .setStyle(ButtonStyle.Secondary)
        )
    );
  });

  const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
  if (hasBanner) payload.files = [new AttachmentBuilder(bannerPath, { name: 'ticket-banner.gif' })];
  return payload;
}

// Lazy-loaded to avoid a circular require between ticket.js and applications.js
function getApplications() {
  return require('./applications');
}

// Helper to find the ticket's welcome message reliably (even with 100+ messages)
async function findWelcomeMessage(channel, ticketInfo) {
  try {
    if (ticketInfo && ticketInfo.welcome_message_id) {
      const msg = await channel.messages.fetch(ticketInfo.welcome_message_id).catch(() => null);
      if (msg) return msg;
    }
    // Fetch earliest messages in channel
    const firstMessages = await channel.messages.fetch({ after: channel.id, limit: 15 }).catch(() => null);
    if (firstMessages && firstMessages.size > 0) {
      const found = firstMessages.find(m => m.embeds.length > 0 && m.embeds[0].title && (m.embeds[0].title.includes('Ticket') || m.embeds[0].title.includes('Application')));
      if (found) return found;
    }
    // Fallback: search last 100 messages
    const recent = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    if (recent && recent.size > 0) {
      const found = recent.find(m => m.embeds.length > 0 && m.embeds[0].title && (m.embeds[0].title.includes('Ticket') || m.embeds[0].title.includes('Application')));
      if (found) return found;
    }
  } catch (err) {
    console.warn('Error fetching welcome message:', err.message);
  }
  return null;
}

// Helper to reliably identify a ticket channel and its original owner
async function resolveTicketAndOwner(channel, ticketInfo) {
  let ownerId = null;
  let ownerUsername = ticketInfo?.creator_username || null;
  let isTicket = Boolean(ticketInfo && ticketInfo.status !== 'DELETED');

  if (ticketInfo?.creator_id && /^\d+$/.test(String(ticketInfo.creator_id))) {
    ownerId = String(ticketInfo.creator_id);
  }

  // Fallback 1: inspect channel topic (e.g., "Support Ticket | Creator: user (123456789) | Product: ..." or "Pavo Application | ... Applicant: user (123456789)")
  if (!ownerId && channel?.topic) {
    const topicMatch = channel.topic.match(/(?:Creator|Applicant):\s*([^\n(|]+?)\s*\((\d{15,22})\)/i) ||
      channel.topic.match(/\[pavo-app:[^:]+:(\d{15,22})\]/) ||
      channel.topic.match(/\((\d{15,22})\)/);
    if (topicMatch) {
      if (topicMatch[2]) {
        ownerUsername = ownerUsername || topicMatch[1]?.trim() || 'Customer';
        ownerId = topicMatch[2];
      } else if (topicMatch[1]) {
        ownerId = topicMatch[1];
      }
      if (channel.topic.toLowerCase().includes('ticket') || channel.topic.toLowerCase().includes('application')) {
        isTicket = true;
      }
    }
  }

  // Fallback 2: inspect the ticket welcome message
  if (!ownerId || !isTicket) {
    const welcomeMsg = await findWelcomeMessage(channel, ticketInfo);
    if (welcomeMsg) {
      isTicket = true;
      if (!ownerId) {
        const mentionMatch = (welcomeMsg.content || '').match(/<@!?(\d{15,22})>/);
        if (mentionMatch) {
          ownerId = mentionMatch[1];
        } else if (welcomeMsg.embeds?.[0]) {
          const emb = welcomeMsg.embeds[0];
          const creatorField = (emb.fields || []).find(f => f.name && f.name.includes('Creator'));
          const fieldMatch = creatorField?.value?.match(/<@!?(\d{15,22})>|\((\d{15,22})\)/);
          const descMatch = (emb.description || '').match(/<@!?(\d{15,22})>/);
          ownerId = fieldMatch?.[1] || fieldMatch?.[2] || descMatch?.[1] || null;
        }
      }
    }
  }

  return { isTicket, ownerId, ownerUsername: ownerUsername || 'Customer' };
}

const vouchCommand = {
  data: new SlashCommandBuilder()
    .setName('vouch')
    .setDescription('Move a completed customer ticket to Awaiting Vouch and request a vouch'),

  async execute(interaction, config) {
    const authorizedRoleIds = [...new Set([
      config.vouchRoleId || '1532384602205851749',
      ...(Array.isArray(config.vouchRoleIds) ? config.vouchRoleIds : []),
      '1532384602205851749',
      '1439210704291762258',
      '1538244553637634118'
    ])];
    const member = interaction.member;

    if (!member || !member.roles || !authorizedRoleIds.some(id => member.roles.cache.has(id))) {
      return interaction.reply({
        content: '❌ Permission denied. You are not authorized to use `/vouch`.',
        ephemeral: true
      });
    }

    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) {
      return interaction.reply({
        content: '❌ This command can only be used inside a valid ticket channel.',
        ephemeral: true
      });
    }

    const ticketInfo = await db.getTicket(channel.id);
    const { isTicket, ownerId, ownerUsername } = await resolveTicketAndOwner(channel, ticketInfo);

    if (!isTicket) {
      return interaction.reply({
        content: '❌ This channel is not a valid Pavo Bot ticket.',
        ephemeral: true
      });
    }

    if (!ownerId || !/^\d+$/.test(String(ownerId))) {
      return interaction.reply({
        content: '❌ Could not identify the original ticket owner. The ticket was not moved.',
        ephemeral: true
      });
    }

    const awaitingVouchCategoryId = config.ticketCategories?.awaitingVouchCategoryId || '1571588433288106194';
    if (ticketInfo?.vouch_requested) {
      return interaction.reply({
        content: 'ℹ️ A vouch notification has already been sent for this ticket.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // Move ticket channel into the Awaiting Vouch category while preserving existing name & permissions
      if (channel.parentId !== awaitingVouchCategoryId) {
        await channel.setParent(awaitingVouchCategoryId, { lockPermissions: false });
      }

      // Persist vouch status in the database
      await db.markTicketAwaitingVouch(channel.id, interaction.user.id, ownerId, ownerUsername);

      const vouchUrl = config.vouchChannelUrl || 'https://discord.com/channels/1532173407158800464/1532484367090323467';

      const vouchEmbed = new EmbedBuilder()
        .setTitle('Thank You for Your Purchase!')
        .setDescription(
          `Hello <@${ownerId}>,\n\n` +
          `Your purchase has been completed successfully!\n\n` +
          `We would really appreciate it if you could leave us a vouch.\n\n` +
          `Please leave your vouch in our designated vouch channel:\n\n` +
          `${vouchUrl}\n\n` +
          `Your feedback helps our community grow and supports our team.\n\n` +
          `Thank you for choosing Pavo!`
        )
        .setColor(config.embedColor || '#4f46e5')
        .setFooter({
          text: 'Pavo Bot • Customer Support',
          iconURL: interaction.guild?.iconURL() || null
        })
        .setTimestamp();

      const linkRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Leave a Vouch')
          .setStyle(ButtonStyle.Link)
          .setURL(vouchUrl)
      );

      await channel.send({
        content: `<@${ownerId}>`,
        embeds: [vouchEmbed],
        components: [linkRow]
      });

      await interaction.editReply({
        content: `✅ Ticket moved to **Awaiting Vouch** and <@${ownerId}> has been notified.`
      });
    } catch (err) {
      console.error('Error executing /vouch:', err);
      await interaction.editReply({
        content: `❌ Failed to move ticket or send vouch notification: ${err.message}`
      });
    }
  }
};

module.exports = {
  vouchCommand,
  buildTicketPanelPayload,
  resolveTicketCategoryId,
  buildTicketMenuOptions,
  SUPPORT_TYPES,
  TICKET_MENU_ORDER,
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket management commands')
    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('Close the current ticket')
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Permanently delete this ticket')
    )
    .addSubcommand(sub =>
      sub.setName('reopen')
        .setDescription('Reopen the current closed ticket')
    )
    .addSubcommand(sub =>
      sub.setName('vouch')
        .setDescription('Move the current ticket to Awaiting Vouch and request a vouch')
    ),

  // Slash command handler (/ticket close, /ticket delete, /ticket reopen, /ticket vouch)
  async execute(interaction, config) {
    const member = interaction.member;
    const channel = interaction.channel;
    const subcommand = interaction.options.getSubcommand(false);

    if (subcommand === 'vouch') {
      return vouchCommand.execute(interaction, config);
    }

    const staffRoleName = getStaffRoleName(member, config);
    const isStaff = staffRoleName !== null;

    if (!isStaff) {
      return interaction.reply({
        content: '❌ Only staff members can manage tickets.',
        ephemeral: true
      });
    }

    if (subcommand === 'delete') {
      return this.handleDeleteTicketAction(interaction, config, channel, member);
    } else if (subcommand === 'close') {
      return this.handleCloseTicketAction(interaction, config, channel, member);
    } else if (subcommand === 'reopen') {
      return this.handleReopenTicketAction(interaction, config, channel, member);
    } else {
      return interaction.reply({
        content: 'ℹ️ Available commands: `/ticket close`, `/ticket delete`, `/ticket reopen`, `/ticket vouch`',
        ephemeral: true
      });
    }
  },

  // Setup the ticket panel in the support channel on bot startup (with duplicate prevention)
  async sendTicketPanel(client, config) {
    const channelId = config.purchaseTickets?.panelChannelId || '1532385731513815170';
    const channel = await client.channels.fetch(channelId).catch(() => null);

    if (!channel) {
      console.warn(`⚠️ Support channel ${channelId} not found. Cannot verify or send ticket panel.`);
      return;
    }

    try {
      // Remove any previous ticket panel (old embed panel or previous banner panel) so only ONE panel exists
      const messages = await channel.messages.fetch({ limit: 50 });
      const oldPanels = messages.filter(msg =>
        msg.author.id === client.user.id && (
          (msg.embeds.length > 0 && msg.embeds[0].title === 'Pavo Support') ||
          (msg.components || []).some(c => JSON.stringify(c.toJSON ? c.toJSON() : c).includes('ticket_cat:') || JSON.stringify(c.toJSON ? c.toJSON() : c).includes('ticket_open_btn'))
        )
      );
      for (const old of oldPanels.values()) {
        await old.delete().catch(() => {});
      }

      const panelPayload = await buildTicketPanelPayload(client, channel.guild, config);
      await channel.send(panelPayload);
      console.log('🆕 Created new banner ticket panel in channel: ' + channel.name);
    } catch (err) {
      console.error('Error during ticket panel initialization:', err);
    }
  },

  // Ensure every existing ticket channel (any category/type) has the Vouch button on its welcome message
  async ensureVouchButtonInExistingTickets(client, config) {
    try {
      const catIds = new Set([
        config.ticketCategoryId,
        config.ticketCategories?.orbsPcCategoryId,
        config.ticketCategories?.pavoHubCategoryId,
        config.ticketCategories?.supportCategoryId,
        config.ticketCategories?.mmServiceCategoryId,
        config.ticketCategories?.awaitingVouchCategoryId,
        config.applications?.categoryId,
        '1554856591239544913',
        '1571585376815030272',
        '1571585519270498429',
        '1571586158452932729',
        '1571944513335857283',
        '1571597907537297499',
        '1571588433288106194',
        '1571585726078783680',
        '1532385488554430575'
      ].filter(Boolean));

      let updatedCount = 0;
      for (const guild of client.guilds.cache.values()) {
        for (const channel of guild.channels.cache.values()) {
          if (channel.type !== ChannelType.GuildText) continue;

          const topic = String(channel.topic || '');
          const isTicketByTopic = topic.includes('Support Ticket | Creator:') || topic.includes('Pavo Application |');
          const inTicketCat = channel.parentId && catIds.has(channel.parentId);
          if (!isTicketByTopic && !inTicketCat) continue;

          const ticketInfo = await db.getTicket(channel.id);
          if (!isTicketByTopic && !ticketInfo) continue;

          const welcomeMsg = await findWelcomeMessage(channel, ticketInfo);
          if (!welcomeMsg || welcomeMsg.author?.id !== client.user.id) continue;

          const rows = (welcomeMsg.components || []).map(r => ActionRowBuilder.from(r));
          const hasVouchBtn = rows.some(r => r.components.some(c => c.data?.custom_id === 'ticket_vouch'));
          if (hasVouchBtn) continue;

          const vouchBtn = new ButtonBuilder()
            .setCustomId('ticket_vouch')
            .setLabel('Vouch')
            .setEmoji('⭐')
            .setStyle(ButtonStyle.Secondary);

          if (rows.length > 0 && rows[rows.length - 1].components.length < 5) {
            rows[rows.length - 1].addComponents(vouchBtn);
          } else if (rows.length < 5) {
            rows.push(new ActionRowBuilder().addComponents(vouchBtn));
          }

          await welcomeMsg.edit({ components: rows }).catch(() => {});
          updatedCount++;
        }
      }
      if (updatedCount > 0) {
        console.log(`⭐ [TICKETS] Added Vouch button to ${updatedCount} existing ticket channel(s).`);
      }
    } catch (err) {
      console.warn('[TICKETS] Could not backfill Vouch button on existing tickets:', err.message);
    }
  },

  // Handle product selections from dropdown menu
  async handleSelectProduct(interaction, config, productOverride = null) {
    const product = productOverride || interaction.values[0];
    const user = interaction.user;

    // Double check active ticket count limit
    if (await hasActiveTicket(interaction.guild, user.id)) {
      return interaction.reply({
        content: '❌ You already have an open ticket. Please use your existing ticket before opening another one.',
        ephemeral: true
      });
    }

    const purchaseCategory = getPurchaseCategories(config).find(c => c.value === product);

    if (purchaseCategory) {
      // Purchase categories (Orbs PC, Custom Discord Bot, Pavo's Hub Script, ...) → create ticket immediately
      const productName = purchaseCategory.productName || purchaseCategory.label;
      const categoryId = purchaseCategory.categoryId || resolveTicketCategoryId(product, config);
      await interaction.reply({ content: `⏳ Creating your **${productName}** ticket...`, ephemeral: true });
      try {
        const ticketChannel = await createTicketChannel(
          interaction,
          config,
          productName,
          purchaseCategory.channelSuffix || purchaseCategory.value,
          null,
          { footerText: purchaseCategory.footerText, kind: 'purchase', categoryId }
        );
        await interaction.editReply({ content: `✅ Ticket created successfully: <#${ticketChannel.id}>` });
      } catch (err) {
        console.error(`Error creating ${productName} ticket:`, err);
        await interaction.editReply({ content: `❌ Failed to create ticket: ${err.message}` });
      }
    } else if (SUPPORT_TYPES[product] || product === 'other_support') {
      const selected = SUPPORT_TYPES[product] || { title: 'Support Ticket', suffix: 'ticket' };
      const categoryId = resolveTicketCategoryId(product, config);
      await interaction.reply({ content: `⏳ Creating your **${selected.title}** ticket...`, ephemeral: true });

      try {
        const ticketChannel = await createTicketChannel(
          interaction,
          config,
          selected.title,
          selected.suffix,
          null,
          { kind: 'support', categoryId }
        );
        await interaction.editReply({ content: `✅ Ticket created successfully: <#${ticketChannel.id}>` });
      } catch (err) {
        console.error('Error creating ticket:', err);
        await interaction.editReply({ content: `❌ Failed to create ticket: ${err.message}` });
      }
    } else {
      // Removed / unknown category (e.g. an old menu that still shows Pavo Tweak or Orbs Mobile)
      await interaction.reply({
        content: '❌ This category is no longer available. Please press **Open Ticket to Buy** again to see the current options.',
        ephemeral: true
      });
    }
  },

  // Handle all button clicks (ticket channel buttons and OS selection buttons)
  async handleButton(interaction, config) {
    const member = interaction.member;
    const channel = interaction.channel;
    const customId = interaction.customId;

    const staffRoleName = getStaffRoleName(member, config);
    const isStaff = staffRoleName !== null;

    // BUTTON: category button on the banner panel -> open that ticket type directly
    if (customId.startsWith('ticket_cat:')) {
      return this.handleSelectProduct(interaction, config, customId.slice('ticket_cat:'.length));
    }

    // BUTTON: Open Ticket Clicked (legacy panel)
    else if (customId === 'ticket_open_btn') {
      // Verify active ticket limit
      if (await hasActiveTicket(interaction.guild, interaction.user.id)) {
        return interaction.reply({
          content: '❌ You already have an open ticket. Please use your existing ticket before opening another one.',
          ephemeral: true
        });
      }

      // Show dropdown menu in the exact configured order
      const options = buildTicketMenuOptions(config);

      if (options.length === 0) {
        return interaction.reply({ content: '❌ No ticket categories are configured right now.', ephemeral: true });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_select_product')
        .setPlaceholder('Select a product or ticket type...')
        .addOptions(options.slice(0, 25));

      const row = new ActionRowBuilder().addComponents(selectMenu);
      await interaction.reply({
        content: '🛒 **Product Selection**\nPlease choose what you are interested in from the menu below:',
        components: [row],
        ephemeral: true
      });
    }

    // BUTTON: OS Choices clicked (Pavo Tweak workflow)
    else if (customId.startsWith('ticket_os:')) {
      if (await hasActiveTicket(interaction.guild, interaction.user.id)) {
        return interaction.reply({
          content: '❌ You already have an open ticket. Please use your existing ticket before opening another one.',
          ephemeral: true
        });
      }
      const os = customId.split(':')[1];

      // Build specifications Modal
      const modal = new ModalBuilder()
        .setCustomId(`tweak_specs_modal:${os}`)
        .setTitle('Pavo Tweak Specifications');

      const gpuInput = new TextInputBuilder()
        .setCustomId('gpu_input')
        .setLabel('What GPU do you have?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. RTX 4070')
        .setRequired(true);

      const cpuInput = new TextInputBuilder()
        .setCustomId('cpu_input')
        .setLabel('What CPU do you have?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. Ryzen 7 7800X3D')
        .setRequired(true);

      const row1 = new ActionRowBuilder().addComponents(gpuInput);
      const row2 = new ActionRowBuilder().addComponents(cpuInput);
      modal.addComponents(row1, row2);

      // If OS is "Other", add a third text input field to let them type their OS
      if (os === 'Other') {
        const osInput = new TextInputBuilder()
          .setCustomId('os_input')
          .setLabel('What Operating System are you using?')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. Windows Server 2022')
          .setRequired(true);
        const row3 = new ActionRowBuilder().addComponents(osInput);
        modal.addComponents(row3);
      }

      await interaction.showModal(modal);
    }

    // BUTTON: Claim Ticket
    else if (customId === 'ticket_claim') {
      if (!isStaff) {
        return interaction.reply({ content: '❌ Only staff members can claim tickets.', ephemeral: true });
      }

      const prevTicket = await db.getTicket(channel.id);
      const alreadyClaimedBySame = prevTicket && prevTicket.claimed_by === interaction.user.id;

      await db.claimTicket(channel.id, interaction.user.id, interaction.user.username);
      const ticketInfo = await db.getTicket(channel.id);

      try {
        const welcomeMessage = await findWelcomeMessage(channel, ticketInfo);

        if (welcomeMessage) {
          const oldEmbed = welcomeMessage.embeds[0];
          if (oldEmbed) {
            const updatedEmbed = EmbedBuilder.from(oldEmbed)
              .setFields(
                ...oldEmbed.fields.filter(f => f.name !== '⏳ Status'),
                { name: '⏳ Status', value: `📥 Claimed by <@${interaction.user.id}>`, inline: true }
              );

            // Disable the claim button
            const originalRow = welcomeMessage.components[0];
            const newRow = ActionRowBuilder.from(originalRow);
            newRow.components[0].setDisabled(true);
            const extraRows = welcomeMessage.components.slice(1).map(r => ActionRowBuilder.from(r));

            await welcomeMessage.edit({ embeds: [updatedEmbed], components: [newRow, ...extraRows] }).catch(() => { });
          }
        }
      } catch (e) {
        console.error('Error updating claim status:', e);
      }

      await interaction.reply({ content: `📥 <@${interaction.user.id}> has claimed this ticket!` });

      // Automatically notify the ticket owner via DM (avoiding duplicates)
      if (!alreadyClaimedBySame && ticketInfo?.creator_id) {
        await dmNotifier.notifyTicketClaimed({
          client: interaction.client,
          guild: interaction.guild,
          config,
          userId: ticketInfo.creator_id,
          channel,
          staffUser: interaction.user,
          productName: ticketInfo.product
        });
      }
    }

    // BUTTON: Close Ticket (Read-only status)
    else if (customId === 'ticket_close') {
      await this.handleCloseTicketAction(interaction, config, channel, member);
    }

    // BUTTON: Add User to Ticket
    else if (customId === 'ticket_add_user') {
      const modal = new ModalBuilder()
        .setCustomId('ticket_add_user_modal')
        .setTitle('Add User to Ticket');

      const userInput = new TextInputBuilder()
        .setCustomId('target_user_id')
        .setLabel('User ID or Mention')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. 123456789012345678')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(userInput));
      await interaction.showModal(modal);
    }

    // BUTTON: Remove User from Ticket
    else if (customId === 'ticket_remove_user') {
      const modal = new ModalBuilder()
        .setCustomId('ticket_remove_user_modal')
        .setTitle('Remove User from Ticket');

      const userInput = new TextInputBuilder()
        .setCustomId('target_user_id')
        .setLabel('User ID or Mention')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. 123456789012345678')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(userInput));
      await interaction.showModal(modal);
    }

    // BUTTON: Vouch (moves ticket to Awaiting Vouch + sends vouch request)
    else if (customId === 'ticket_vouch') {
      await vouchCommand.execute(interaction, config);
    }

    // BUTTON: Reopen Ticket
    else if (customId === 'ticket_reopen') {
      await this.handleReopenTicketAction(interaction, config, channel, member);
    }

    // BUTTON: Delete Ticket (Permanent channel deletion)
    else if (customId === 'ticket_delete') {
      await this.handleDeleteTicketAction(interaction, config, channel, member);
    }

    // BUTTON: Purchase Completed Modal Summon
    else if (customId === 'ticket_purchase') {
      if (!isStaff) {
        return interaction.reply({ content: '❌ Only staff members can record verified purchases.', ephemeral: true });
      }

      // Show Purchase Completed Modal (pre-filling ticket owner ID if available)
      const currentTicket = await db.getTicket(channel.id);
      const modal = new ModalBuilder()
        .setCustomId('ticket_purchase_modal')
        .setTitle('Record Verified Purchase');

      const customerInput = new TextInputBuilder()
        .setCustomId('customer_input')
        .setLabel('Customer (Discord ID or Username)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 123456789012345678 or username')
        .setRequired(true);

      if (currentTicket?.creator_id && /^\d+$/.test(String(currentTicket.creator_id))) {
        customerInput.setValue(String(currentTicket.creator_id));
      }

      const productInput = new TextInputBuilder()
        .setCustomId('product_input')
        .setLabel('Product Name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., Pavo Tweak Lifetime')
        .setRequired(true);

      const priceInput = new TextInputBuilder()
        .setCustomId('price_input')
        .setLabel('Price in USD (Numeric, e.g. 50.00)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('50.00')
        .setRequired(true);

      const methodInput = new TextInputBuilder()
        .setCustomId('method_input')
        .setLabel('Payment Method')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('PayPal, LTC, or Boosts')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(customerInput),
        new ActionRowBuilder().addComponents(productInput),
        new ActionRowBuilder().addComponents(priceInput),
        new ActionRowBuilder().addComponents(methodInput)
      );

      await interaction.showModal(modal);
    }
  },

  // Action to Close a Ticket (Read-only status, logs transcript, and provides Reopen / Delete buttons)
  async handleCloseTicketAction(interaction, config, channel, member) {
    const staffRoleName = getStaffRoleName(member, config);
    if (!staffRoleName) {
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ content: '❌ Only staff members can close tickets.', ephemeral: true });
      }
      return interaction.reply({ content: '❌ Only staff members can close tickets.', ephemeral: true });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    try {
      // Reopen, Vouch & Delete buttons row (always present)
      const closedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_vouch')
          .setLabel('Vouch')
          .setEmoji('⭐')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ticket_reopen')
          .setLabel('Reopen Ticket')
          .setEmoji('🔓')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('ticket_delete')
          .setLabel('Delete Ticket')
          .setEmoji('🗑️')
          .setStyle(ButtonStyle.Danger)
      );

      const ticketCheck = await db.getTicket(channel.id);
      const wasAlreadyClosed = ticketCheck && ticketCheck.status === 'CLOSED';

      // If already closed, avoid duplicate logging or crashes; just provide the control buttons!
      if (wasAlreadyClosed) {
        const alreadyClosedEmbed = new EmbedBuilder()
          .setTitle('🔒 Ticket Already Closed')
          .setDescription(`This ticket has already been closed.\n\nYou can reopen or permanently delete it using the buttons below:`)
          .setColor('#eab308')
          .setTimestamp();

        return interaction.editReply({ embeds: [alreadyClosedEmbed], components: [closedRow] });
      }

      // Record closure in Database
      const ticketInfo = await db.closeTicket(channel.id, interaction.user.id, interaction.user.username);
      const creatorId = ticketInfo ? ticketInfo.creator_id : null;
      const creatorUser = ticketInfo ? ticketInfo.creator_username : 'Unknown';
      const claimedBy = ticketInfo ? ticketInfo.claimed_by : null;

      // Apply read-only permissions: deny customer from sending messages
      if (creatorId && creatorId !== 'Unknown') {
        await channel.permissionOverwrites.edit(creatorId, {
          SendMessages: false,
          AttachFiles: false
        }).catch(err => console.error('Failed to block customer chat permissions on close:', err));
      }

      // Generate transcript
      const transcriptBuffer = await this.generateTranscriptBuffer(channel);

      // Send log
      const logChannelId = config.ticketLogChannelId;
      const logChannel = interaction.guild.channels.cache.get(logChannelId) || await interaction.guild.channels.fetch(logChannelId).catch(() => null);

      const logEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Closed')
        .setDescription(`Ticket channel \`#${channel.name}\` has been closed.`)
        .setColor('#ef4444')
        .addFields(
          { name: '🎟️ Ticket Channel', value: `#${channel.name} (${channel.id})`, inline: false },
          { name: '👤 Creator', value: creatorId && creatorId !== 'Unknown' ? `<@${creatorId}> (${creatorUser})` : creatorUser, inline: true },
          { name: '📥 Claimed By', value: claimedBy ? `<@${claimedBy}>` : 'Unclaimed', inline: true },
          { name: '🔒 Closed By', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setTimestamp();

      if (logChannel) {
        await logChannel.send({
          embeds: [logEmbed],
          files: [{ attachment: transcriptBuffer, name: `transcript-${channel.name}.txt` }]
        }).catch(err => console.error('Failed to send transcript log:', err));
      }

      // Automatically send Ticket Closed DM + Transcript attachment to the ticket creator
      if (creatorId && creatorId !== 'Unknown') {
        await dmNotifier.notifyTicketClosed({
          client: interaction.client,
          guild: interaction.guild,
          config,
          userId: creatorId,
          channel,
          closedByUser: interaction.user,
          claimedById: claimedBy,
          productName: ticketInfo?.product || (ticketInfo?.kind === 'application' ? 'Team Application' : 'Support'),
          transcriptBuffer
        });
      }

      // Update welcome message embed and buttons if found
      try {
        const welcomeMessage = await findWelcomeMessage(channel, ticketInfo);
        if (welcomeMessage) {
          const oldEmbed = welcomeMessage.embeds[0];
          if (oldEmbed) {
            const updatedEmbed = EmbedBuilder.from(oldEmbed)
              .setFields(
                ...oldEmbed.fields.filter(f => f.name !== '⏳ Status'),
                { name: '⏳ Status', value: `🔒 Closed by <@${interaction.user.id}>`, inline: true }
              );
            await welcomeMessage.edit({ embeds: [updatedEmbed], components: [closedRow] }).catch(() => { });
          }
        }
      } catch (welcomeErr) {
        console.warn('Could not update welcome message on close:', welcomeErr.message);
      }

      // Always post the closure card directly in response at the bottom of the chat with buttons
      const closeEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Closed')
        .setDescription(`This ticket was closed by <@${interaction.user.id}>.\nCustomer write permissions have been revoked.\n\n**Management:** Use the buttons below to reopen or permanently delete this ticket:`)
        .setColor('#ef4444')
        .addFields(
          { name: '🎟️ Channel', value: `#${channel.name}`, inline: true },
          { name: '👤 Creator', value: creatorId && creatorId !== 'Unknown' ? `<@${creatorId}>` : creatorUser, inline: true },
          { name: '🔒 Closed by', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [closeEmbed], components: [closedRow] });
    } catch (error) {
      console.error('Error closing ticket:', error);
      await interaction.editReply({ content: `❌ Error closing ticket: ${error.message}` });
    }
  },

  // Action to Delete a Ticket (Permanent channel deletion)
  async handleDeleteTicketAction(interaction, config, channel, member) {
    const staffRoleName = getStaffRoleName(member, config);
    if (!staffRoleName) {
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ content: '❌ Only staff members can delete tickets.', ephemeral: true });
      }
      return interaction.reply({ content: '❌ Only staff members can delete tickets.', ephemeral: true });
    }

    const deleteReply = { content: '🗑️ This ticket channel will be permanently deleted in 2 seconds...' };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(deleteReply).catch(() => { });
    } else {
      await interaction.reply(deleteReply).catch(() => { });
    }

    try {
      await db.deleteTicket(channel.id);
    } catch (e) {
      console.error('Error marking ticket deleted in DB:', e);
    }

    setTimeout(() => {
      channel.delete().catch(err => console.error('Failed to delete channel:', err));
    }, 2000);
  },

  // Action to Reopen a Ticket
  async handleReopenTicketAction(interaction, config, channel, member) {
    const staffRoleName = getStaffRoleName(member, config);
    if (!staffRoleName) {
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ content: '❌ Only staff members can reopen tickets.', ephemeral: true });
      }
      return interaction.reply({ content: '❌ Only staff members can reopen tickets.', ephemeral: true });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    try {
      const ticketInfo = await db.getTicket(channel.id);
      const creatorId = ticketInfo ? ticketInfo.creator_id : null;
      const claimedBy = ticketInfo ? ticketInfo.claimed_by : null;

      // Restore customer chat permissions
      if (creatorId && creatorId !== 'Unknown') {
        await channel.permissionOverwrites.edit(creatorId, {
          SendMessages: true,
          AttachFiles: true
        }).catch(err => console.error('Failed to restore customer permissions on reopen:', err));
      }

      // Update Database status
      await db.reopenTicket(channel.id);

      // Restore original buttons
      const isApp = ticketInfo?.kind === 'application' || getApplications().isApplicationChannel(channel);
      const activeRow = isApp
        ? getApplications().buildControlsRow(ticketInfo)
        : new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_claim')
            .setLabel('Claim Ticket')
            .setEmoji('📥')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(claimedBy !== null),
          new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Close Ticket')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('ticket_purchase')
            .setLabel('Purchase Completed')
            .setEmoji('💰')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('ticket_vouch')
            .setLabel('Vouch')
            .setEmoji('⭐')
            .setStyle(ButtonStyle.Secondary)
        );

      // Update welcome message if found
      try {
        const welcomeMessage = await findWelcomeMessage(channel, ticketInfo);
        if (welcomeMessage) {
          const oldEmbed = welcomeMessage.embeds[0];
          if (oldEmbed) {
            const statusVal = isApp
              ? getApplications().getStatusText(ticketInfo)
              : (claimedBy ? `📥 Claimed by <@${claimedBy}>` : '🟢 Open / Unclaimed');
            const updatedEmbed = EmbedBuilder.from(oldEmbed)
              .setFields(
                ...oldEmbed.fields.filter(f => f.name !== '⏳ Status'),
                { name: '⏳ Status', value: statusVal, inline: true }
              );
            await welcomeMessage.edit({ embeds: [updatedEmbed], components: [activeRow] }).catch(() => { });
          }
        }
      } catch (welcomeErr) {
        console.warn('Could not update welcome message on reopen:', welcomeErr.message);
      }

      const reopenEmbed = new EmbedBuilder()
        .setTitle('🔓 Ticket Reopened')
        .setDescription(`This ticket was successfully reopened by <@${interaction.user.id}>.\nCustomer write permissions have been restored.`)
        .setColor('#22c55e')
        .setTimestamp();

      await interaction.editReply({ embeds: [reopenEmbed], components: [activeRow] });
    } catch (err) {
      console.error('Error reopening ticket:', err);
      await interaction.editReply({ content: `❌ Failed to reopen ticket: ${err.message}` });
    }
  },

  // Handle Modal submissions (GPU/CPU specs and Verified Purchases)
  async handleModal(interaction, config) {
    const customId = interaction.customId;

    // 1. SPECIFICATION MODALS (Pavo Tweak)
    if (customId.startsWith('tweak_specs_modal:')) {
      await interaction.deferReply({ ephemeral: true });

      try {
        let os = customId.split(':')[1];
        const gpu = interaction.fields.getTextInputValue('gpu_input');
        const cpu = interaction.fields.getTextInputValue('cpu_input');

        if (os === 'Other') {
          os = interaction.fields.getTextInputValue('os_input');
        }

        const fields = [
          { name: '🖥️ GPU', value: gpu, inline: true },
          { name: '⚙️ CPU', value: cpu, inline: true },
          { name: '💾 OS', value: os, inline: true }
        ];

        const ticketChannel = await createTicketChannel(interaction, config, 'Pavo Tweak', 'Tweak', fields);
        await interaction.editReply({ content: `✅ Pavo Tweak Ticket created successfully: <#${ticketChannel.id}>` });
      } catch (err) {
        console.error('Error creating Tweak specs ticket:', err);
        await interaction.editReply({ content: `❌ Failed to create ticket: ${err.message}` });
      }
    }

    // 2. ADD USER MODAL
    else if (customId === 'ticket_add_user_modal') {
      await interaction.deferReply();
      const rawUser = interaction.fields.getTextInputValue('target_user_id').replace(/[<@!>]/g, '').trim();
      const targetMember = await interaction.guild.members.fetch(rawUser).catch(() => null);

      if (!targetMember) {
        return interaction.editReply({ content: '❌ User not found in the server. Please enter a valid Discord ID.' });
      }

      await interaction.channel.permissionOverwrites.edit(targetMember.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true
      });

      await interaction.editReply({ content: `➕ <@${targetMember.id}> has been successfully added to this ticket!` });
    }

    // 3. REMOVE USER MODAL
    else if (customId === 'ticket_remove_user_modal') {
      await interaction.deferReply();
      const rawUser = interaction.fields.getTextInputValue('target_user_id').replace(/[<@!>]/g, '').trim();
      const targetMember = await interaction.guild.members.fetch(rawUser).catch(() => null);

      if (!targetMember) {
        return interaction.editReply({ content: '❌ User not found.' });
      }

      await interaction.channel.permissionOverwrites.delete(targetMember.id);
      await interaction.editReply({ content: `➖ <@${targetMember.id}> has been removed from this ticket.` });
    }

    // 4. VERIFIED PURCHASE RECORD MODAL
    else if (customId === 'ticket_purchase_modal') {
      await interaction.deferReply();

      try {
        const customerVal = interaction.fields.getTextInputValue('customer_input');
        const product = interaction.fields.getTextInputValue('product_input');
        const priceStr = interaction.fields.getTextInputValue('price_input');
        const paymentMethod = interaction.fields.getTextInputValue('method_input');

        const price = parseFloat(priceStr);
        if (isNaN(price) || price < 0) {
          return interaction.editReply({ content: '❌ Invalid price amount. Must be a positive numeric value.' });
        }

        const staffMember = interaction.member;
        const staffRole = getStaffRoleName(staffMember, config);

        if (!staffRole) {
          return interaction.editReply({ content: '❌ You must have a staff role to record sales.' });
        }

        const percentage = await db.getRoleCommissionPercentage(staffRole, config.defaultCommissionPercentages);
        const commission = parseFloat(((price * percentage) / 100).toFixed(2));

        let customerId = 'Unknown';
        let customerUsername = customerVal;

        const cleanedId = customerVal.replace(/[<@!>]/g, '').trim();
        if (cleanedId.match(/^\d+$/)) {
          try {
            const user = await interaction.client.users.fetch(cleanedId);
            if (user) {
              customerId = user.id;
              customerUsername = user.username;
            }
          } catch (_) { }
        } else {
          // Safe resolution by exact username match against ticket creator or guild members
          const ticketInfo = await db.getTicket(interaction.channelId);
          if (
            ticketInfo?.creator_id &&
            /^\d+$/.test(String(ticketInfo.creator_id)) &&
            String(ticketInfo.creator_username || '').toLowerCase() === cleanedId.toLowerCase()
          ) {
            customerId = String(ticketInfo.creator_id);
            customerUsername = ticketInfo.creator_username;
          } else if (interaction.guild) {
            const matchMember = interaction.guild.members.cache.find(
              m => !m.user.bot && m.user.username.toLowerCase() === cleanedId.toLowerCase()
            );
            if (matchMember) {
              customerId = matchMember.id;
              customerUsername = matchMember.user.username;
            }
          }
        }

        const saleRecord = await db.recordSale(
          customerId,
          customerUsername,
          interaction.user.id,
          interaction.user.username,
          product,
          price,
          paymentMethod,
          interaction.channelId,
          commission
        );

        // Automatically notify the customer via DM: Payment Received + Purchase Completed
        if (customerId && customerId !== 'Unknown') {
          await dmNotifier.notifyPaymentReceived({
            client: interaction.client,
            guild: interaction.guild,
            config,
            userId: customerId,
            transactionId: saleRecord?.sale_id,
            product,
            price,
            paymentMethod,
            staffUser: interaction.user
          });
          await dmNotifier.notifyPurchaseCompleted({
            client: interaction.client,
            guild: interaction.guild,
            config,
            userId: customerId,
            transactionId: saleRecord?.sale_id,
            product,
            price,
            paymentMethod,
            staffUser: interaction.user,
            channelId: interaction.channelId
          });
        }

        const saleEmbed = new EmbedBuilder()
          .setTitle('✅ Purchase Confirmed & Logged')
          .setDescription('The manual payment verification has been logged successfully.')
          .setColor('#22c55e')
          .addFields(
            { name: '👤 Customer', value: customerId !== 'Unknown' ? `<@${customerId}> (${customerUsername})` : customerUsername, inline: true },
            { name: '💰 Product & Price', value: `**${product}** - $${price.toFixed(2)}`, inline: true },
            { name: '💳 Method', value: paymentMethod, inline: true },
            { name: '📥 Staff Member', value: `<@${interaction.user.id}>`, inline: true },
            { name: '📈 Staff Commission', value: `$${commission.toFixed(2)} (${percentage}%)`, inline: true }
          )
          .setFooter({ text: 'Pavo Tweak Sales Ledger' })
          .setTimestamp();

        const saleVouchRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_vouch')
            .setLabel('Vouch')
            .setEmoji('⭐')
            .setStyle(ButtonStyle.Primary)
        );

        await interaction.editReply({ embeds: [saleEmbed], components: [saleVouchRow] });

        // Post in sales logs
        const logChannelId = config.ticketLogChannelId;
        const logChannel = interaction.guild.channels.cache.get(logChannelId) || await interaction.guild.channels.fetch(logChannelId).catch(() => null);
        if (logChannel) {
          const logSaleEmbed = EmbedBuilder.from(saleEmbed)
            .setTitle('💰 New Sale Recorded')
            .setDescription(`Sale recorded in ticket channel <#${interaction.channelId}>`);
          await logChannel.send({ embeds: [logSaleEmbed] });
        }
      } catch (err) {
        console.error('Error logging purchase:', err);
        await interaction.editReply({ content: `❌ Error logging purchase: ${err.message}` });
      }
    }
  },

  // Fetch ticket logs for transcript files
  async generateTranscriptBuffer(channel) {
    let transcriptText = `==================================================\n`;
    transcriptText += `PAVO TWEAK TICKET TRANSCRIPT\n`;
    transcriptText += `Channel Name: #${channel.name}\n`;
    transcriptText += `Channel ID: ${channel.id}\n`;
    transcriptText += `Generated At: ${new Date().toUTCString()}\n`;
    transcriptText += `==================================================\n\n`;

    try {
      let allMessages = [];
      let lastId = null;

      while (true) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const messages = await channel.messages.fetch(options);
        if (!messages || messages.size === 0) break;

        allMessages.push(...messages.values());
        lastId = messages.lastKey();

        if (messages.size < 100 || allMessages.length >= 500) break;
      }

      // Sort messages chronologically
      allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      for (const msg of allMessages) {
        const time = new Date(msg.createdTimestamp).toISOString().replace('T', ' ').substring(0, 19);
        const author = `${msg.author.tag} (${msg.author.id})`;
        let content = msg.content || "";

        if (msg.attachments.size > 0) {
          const attachmentsList = msg.attachments.map(a => a.url).join(', ');
          content += ` [Attachments: ${attachmentsList}]`;
        }

        if (msg.embeds.length > 0) {
          content += ` [Embed: ${msg.embeds.map(e => e.title || e.description || "").join(' | ')}]`;
        }

        transcriptText += `[${time}] ${author}: ${content}\n`;
      }
    } catch (e) {
      transcriptText += `\n[ERROR GENERATING TRANSCRIPT]: ${e.message}\n`;
    }

    return Buffer.from(transcriptText, 'utf-8');
  }
};
