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
  StringSelectMenuOptionBuilder
} = require('discord.js');
const db = require('../database');

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
// `options` (optional): { footerText, kind: 'support' | 'purchase' }
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

  // Add permissions for configured staff roles
  for (const [roleName, roleId] of Object.entries(config.staffRoles)) {
    if (roleId && roleId.match(/^\d+$/)) {
      permissionOverwrites.push({
        id: roleId,
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

  // Get ticket category
  let parentCategory = null;
  if (config.ticketCategoryId && config.ticketCategoryId.match(/^\d+$/)) {
    parentCategory = config.ticketCategoryId;
  }

  // Create Channel
  const channel = await guild.channels.create({
    name: ticketName,
    type: ChannelType.GuildText,
    parent: parentCategory,
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

  // Send greeting tagging the user and the first staff role
  const pingRoleId = Object.values(config.staffRoles).filter(id => id.match(/^\d+$/))[0];
  const welcomeMsg = await channel.send({
    content: `<@${user.id}>${pingRoleId ? ` | <@&${pingRoleId}>` : ''}`,
    embeds: [welcomeEmbed],
    components: [row]
  });

  // Save to persistent DB with welcome message ID for reliable lookup
  await db.createTicket(channel.id, user.id, user.username, welcomeMsg.id, {
    kind: options.kind || 'support',
    product: productName
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

// Existing support categories (kept as-is)
const SUPPORT_TYPES = {
  general_support: { title: 'General Support', suffix: 'general', label: 'General Support', emoji: '🛠️', description: 'General support and server questions' },
  blockspin_support: { title: 'BlockSpin Support', suffix: 'blockspin', label: 'BlockSpin Support', emoji: '🎮', description: 'Dedicated support for BlockSpin & Visuals' },
  trading_issue: { title: 'Trading Issue', suffix: 'trading', label: 'Trading Issue', emoji: '💰', description: 'Trading disputes and balance inquiries' },
  '1v1_issue': { title: '1v1 Match Issue', suffix: '1v1', label: '1v1 Issue', emoji: '⚔️', description: 'Match disputes and 1v1 issues' },
  key_license: { title: 'Key / License Support', suffix: 'license', label: 'Key / License', emoji: '🔑', description: 'License key activation, redemption and issues' },
  report_issue: { title: 'Member Report', suffix: 'report', label: 'Report', emoji: '🚨', description: 'Report a member or server incident' },
  other_support: { title: 'General / Other Support', suffix: 'support', label: 'Other', emoji: '💡', description: 'Other questions or assistance' }
};

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
      const found = firstMessages.find(m => m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes('Ticket'));
      if (found) return found;
    }
    // Fallback: search last 100 messages
    const recent = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    if (recent && recent.size > 0) {
      const found = recent.find(m => m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes('Ticket'));
      if (found) return found;
    }
  } catch (err) {
    console.warn('Error fetching welcome message:', err.message);
  }
  return null;
}

module.exports = {
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
    ),

  // Slash command handler (/ticket close, /ticket delete, /ticket reopen)
  async execute(interaction, config) {
    const member = interaction.member;
    const channel = interaction.channel;
    const staffRoleName = getStaffRoleName(member, config);
    const isStaff = staffRoleName !== null;

    if (!isStaff) {
      return interaction.reply({
        content: '❌ Only staff members can manage tickets.',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand(false);

    if (subcommand === 'delete') {
      return this.handleDeleteTicketAction(interaction, config, channel, member);
    } else if (subcommand === 'close') {
      return this.handleCloseTicketAction(interaction, config, channel, member);
    } else if (subcommand === 'reopen') {
      return this.handleReopenTicketAction(interaction, config, channel, member);
    } else {
      return interaction.reply({
        content: 'ℹ️ Available commands: `/ticket close`, `/ticket delete`, `/ticket reopen`',
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
      // Scan last 50 messages to see if panel already exists
      const messages = await channel.messages.fetch({ limit: 50 });
      const panelExists = messages.some(msg => 
        msg.author.id === client.user.id && 
        msg.embeds.length > 0 && 
        msg.embeds[0].title === 'Pavo Support'
      );

      if (panelExists) {
        console.log('✅ Support ticket panel already exists. Skipping panel creation.');
        return;
      }

      // Send the professional panel embed
      const panelEmbed = new EmbedBuilder()
        .setTitle('Pavo Support')
        .setDescription('Need help or want to purchase one of our products?\nOpen a ticket below and select what you\'re interested in.')
        .setColor(config.embedColor || '#4f46e5')
        .setFooter({ text: 'Pavo Tweak · Premium Support' })
        .setTimestamp();

      if (channel.guild) {
        panelEmbed.setThumbnail(channel.guild.iconURL({ dynamic: true }) || null);
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_open_btn')
          .setLabel('Open Ticket to Buy')
          .setEmoji('🎫')
          .setStyle(ButtonStyle.Success)
      );

      await channel.send({ embeds: [panelEmbed], components: [row] });
      console.log('🆕 Created new support ticket panel in channel: ' + channel.name);
    } catch (err) {
      console.error('Error during ticket panel initialization:', err);
    }
  },

  // Handle product selections from dropdown menu
  async handleSelectProduct(interaction, config) {
    const product = interaction.values[0];
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
      await interaction.reply({ content: `⏳ Creating your **${productName}** ticket...`, ephemeral: true });
      try {
        const ticketChannel = await createTicketChannel(
          interaction,
          config,
          productName,
          purchaseCategory.channelSuffix || purchaseCategory.value,
          null,
          { footerText: purchaseCategory.footerText, kind: 'purchase' }
        );
        await interaction.editReply({ content: `✅ Ticket created successfully: <#${ticketChannel.id}>` });
      } catch (err) {
        console.error(`Error creating ${productName} ticket:`, err);
        await interaction.editReply({ content: `❌ Failed to create ticket: ${err.message}` });
      }
    } else if (SUPPORT_TYPES[product] || product === 'other_support') {
      const selected = SUPPORT_TYPES[product] || { title: 'Support Ticket', suffix: 'ticket' };
      await interaction.reply({ content: `⏳ Creating your **${selected.title}** ticket...`, ephemeral: true });

      try {
        const ticketChannel = await createTicketChannel(interaction, config, selected.title, selected.suffix);
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

    // BUTTON: Open Ticket Clicked (from Support Panel)
    if (customId === 'ticket_open_btn') {
      // Verify active ticket limit
      if (await hasActiveTicket(interaction.guild, interaction.user.id)) {
        return interaction.reply({
          content: '❌ You already have an open ticket. Please use your existing ticket before opening another one.',
          ephemeral: true
        });
      }

      // Show dropdown menu: purchase categories first (from config), then the existing support categories
      const options = getPurchaseCategories(config).map(c => {
        const opt = new StringSelectMenuOptionBuilder()
          .setLabel(String(c.label).slice(0, 100))
          .setValue(String(c.value).slice(0, 100));
        if (c.description) opt.setDescription(String(c.description).slice(0, 100));
        if (c.emoji) opt.setEmoji(c.emoji);
        return opt;
      });

      if (config.purchaseTickets?.showSupportCategories !== false) {
        for (const [value, t] of Object.entries(SUPPORT_TYPES)) {
          options.push(
            new StringSelectMenuOptionBuilder()
              .setLabel(t.label)
              .setValue(value)
              .setDescription(t.description)
              .setEmoji(t.emoji)
          );
        }
      }

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

      await db.claimTicket(channel.id, interaction.user.id, interaction.user.username);

      try {
        const ticketInfo = await db.getTicket(channel.id);
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

            await welcomeMessage.edit({ embeds: [updatedEmbed], components: [newRow] }).catch(() => {});
          }
        }
      } catch (e) {
        console.error('Error updating claim status:', e);
      }

      await interaction.reply({ content: `📥 <@${interaction.user.id}> has claimed this ticket!` });
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

      // Show Purchase Completed Modal
      const modal = new ModalBuilder()
        .setCustomId('ticket_purchase_modal')
        .setTitle('Record Verified Purchase');

      const customerInput = new TextInputBuilder()
        .setCustomId('customer_input')
        .setLabel('Customer (Discord ID or Username)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 123456789012345678 or username')
        .setRequired(true);

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
      // Reopen & Delete buttons row (always present)
      const closedRow = new ActionRowBuilder().addComponents(
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
            await welcomeMessage.edit({ embeds: [updatedEmbed], components: [closedRow] }).catch(() => {});
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
      await interaction.followUp(deleteReply).catch(() => {});
    } else {
      await interaction.reply(deleteReply).catch(() => {});
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
              .setStyle(ButtonStyle.Success)
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
            await welcomeMessage.edit({ embeds: [updatedEmbed], components: [activeRow] }).catch(() => {});
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

        const cleanedId = customerVal.replace(/[<@!>]/g, '');
        if (cleanedId.match(/^\d+$/)) {
          try {
            const user = await interaction.client.users.fetch(cleanedId);
            if (user) {
              customerId = user.id;
              customerUsername = user.username;
            }
          } catch (_) {}
        }

        await db.recordSale(
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

        await interaction.editReply({ embeds: [saleEmbed] });

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
