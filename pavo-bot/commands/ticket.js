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
async function createTicketChannel(interaction, config, productName, channelSuffix, fields) {
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

  const footerText = productName.includes('Orbs')
    ? 'Orbs Premium Support'
    : (config.embedFooterText || 'Pavo Tweak Support');

  welcomeEmbed
    .setThumbnail(guild.iconURL({ dynamic: true }) || null)
    .setFooter({ text: footerText, iconURL: guild.iconURL() || null })
    .setTimestamp();

  // Buttons
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_claim')
      .setLabel('Claim Ticket')
      .setEmoji('📥')
      .setStyle(ButtonStyle.Primary),
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

  // Send greeting tagging the user and the first staff role
  const pingRoleId = Object.values(config.staffRoles).filter(id => id.match(/^\d+$/))[0];
  const welcomeMsg = await channel.send({
    content: `<@${user.id}>${pingRoleId ? ` | <@&${pingRoleId}>` : ''}`,
    embeds: [welcomeEmbed],
    components: [row]
  });

  // Save to persistent DB with welcome message ID for reliable lookup
  await db.createTicket(channel.id, user.id, user.username, welcomeMsg.id);

  return channel;
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
        .setDescription('Chiudi il ticket corrente / Close the current ticket')
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Elimina definitivamente questo ticket / Delete ticket permanently')
    )
    .addSubcommand(sub =>
      sub.setName('reopen')
        .setDescription('Riapri il ticket corrente / Reopen current closed ticket')
    ),

  // Slash command handler (/ticket close, /ticket delete, /ticket reopen)
  async execute(interaction, config) {
    const member = interaction.member;
    const channel = interaction.channel;
    const staffRoleName = getStaffRoleName(member, config);
    const isStaff = staffRoleName !== null;

    if (!isStaff) {
      return interaction.reply({
        content: '❌ Solo i membri dello staff possono gestire i ticket.',
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
        content: 'ℹ️ Comandi disponibili: `/ticket close`, `/ticket delete`, `/ticket reopen`',
        ephemeral: true
      });
    }
  },

  // Setup the ticket panel in the support channel on bot startup (with duplicate prevention)
  async sendTicketPanel(client, config) {
    const channelId = '1532385731513815170';
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

    if (product === 'pavo_tweak') {
      // 1. Pavo Tweak -> Ask for operating system using buttons
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_os:Windows 11')
          .setLabel('Windows 11')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ticket_os:Windows 10')
          .setLabel('Windows 10')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ticket_os:Kali Linux')
          .setLabel('Kali Linux')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ticket_os:Other')
          .setLabel('Other')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        content: '⚡ **Pavo Tweak Setup**\nPlease select your Operating System below to proceed:',
        components: [row],
        ephemeral: true
      });
    } 
    else if (product === 'orbs_pc') {
      // 2. Orbs — PC -> Create ticket immediately
      await interaction.reply({ content: '⏳ Creating your Orbs — PC ticket...', ephemeral: true });
      try {
        const ticketChannel = await createTicketChannel(interaction, config, 'Orbs — PC', 'Orbs-PC');
        await interaction.editReply({ content: `✅ Ticket created successfully: <#${ticketChannel.id}>` });
      } catch (err) {
        console.error('Error creating Orbs PC ticket:', err);
        await interaction.editReply({ content: `❌ Failed to create ticket: ${err.message}` });
      }
    } 
    else if (product === 'orbs_mobile') {
      // 3. Orbs — Mobile -> Create ticket immediately
      await interaction.reply({ content: '⏳ Creating your Orbs — Mobile ticket...', ephemeral: true });
      try {
        const ticketChannel = await createTicketChannel(interaction, config, 'Orbs — Mobile', 'Orbs-Mobile');
        await interaction.editReply({ content: `✅ Ticket created successfully: <#${ticketChannel.id}>` });
      } catch (err) {
        console.error('Error creating Orbs Mobile ticket:', err);
        await interaction.editReply({ content: `❌ Failed to create ticket: ${err.message}` });
      }
    }
    else if (product === 'custom_bot') {
      // Custom Discord Bot -> Create ticket immediately
      await interaction.reply({ content: '⏳ Creating your Custom Discord Bot ticket...', ephemeral: true });
      try {
        const ticketChannel = await createTicketChannel(interaction, config, 'Custom Discord Bot', 'Custom-Bot');
        await interaction.editReply({ content: `✅ Ticket created successfully: <#${ticketChannel.id}>` });
      } catch (err) {
        console.error('Error creating Custom Discord Bot ticket:', err);
        await interaction.editReply({ content: `❌ Failed to create ticket: ${err.message}` });
      }
    }
    else if (product === 'other_support') {
      // 4. Other / General Support -> Create ticket immediately
      await interaction.reply({ content: '⏳ Creating your Support ticket...', ephemeral: true });
      try {
        const ticketChannel = await createTicketChannel(interaction, config, 'Other / General Support', 'support');
        await interaction.editReply({ content: `✅ Ticket created successfully: <#${ticketChannel.id}>` });
      } catch (err) {
        console.error('Error creating Support ticket:', err);
        await interaction.editReply({ content: `❌ Failed to create ticket: ${err.message}` });
      }
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

      // Show dropdown menu for product selections
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_select_product')
        .setPlaceholder('Select a product...')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('Pavo Tweak')
            .setValue('pavo_tweak')
            .setDescription('Category: PC Optimization / FPS Tweak')
            .setEmoji('⚡'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Orbs — PC')
            .setValue('orbs_pc')
            .setDescription('Category: Discord Tool')
            .setEmoji('🖥️'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Orbs — Mobile')
            .setValue('orbs_mobile')
            .setDescription('Category: Discord Tool')
            .setEmoji('📱'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Custom Discord Bot')
            .setValue('custom_bot')
            .setDescription('Category: Custom Bot Development & Hosting')
            .setEmoji('🤖'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Other / Support')
            .setValue('other_support')
            .setDescription('Ask general questions or open a ticket for other products.')
            .setEmoji('❓')
        );

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
        return interaction.followUp({ content: '❌ Solo i membri dello staff possono chiudere i ticket.', ephemeral: true });
      }
      return interaction.reply({ content: '❌ Solo i membri dello staff possono chiudere i ticket.', ephemeral: true });
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
          .setTitle('🔒 Ticket Già Chiuso / Ticket Already Closed')
          .setDescription(`Questo ticket è già stato chiuso in precedenza.\n\nPuoi **riaprirlo** o **eliminarlo definitivamente** usando i pulsanti qui sotto:`)
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
        .setTitle('🔒 Ticket Chiuso / Ticket Closed')
        .setDescription(`Il ticket è stato chiuso da <@${interaction.user.id}>.\nI permessi di scrittura per il cliente sono stati disattivati.\n\n**Gestione:** Usa i pulsanti sottostanti per riaprire o eliminare definitivamente questo ticket:`)
        .setColor('#ef4444')
        .addFields(
          { name: '🎟️ Canale', value: `#${channel.name}`, inline: true },
          { name: '👤 Creatore', value: creatorId && creatorId !== 'Unknown' ? `<@${creatorId}>` : creatorUser, inline: true },
          { name: '🔒 Chiuso da', value: `<@${interaction.user.id}>`, inline: true }
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
        return interaction.followUp({ content: '❌ Solo i membri dello staff possono eliminare i ticket.', ephemeral: true });
      }
      return interaction.reply({ content: '❌ Solo i membri dello staff possono eliminare i ticket.', ephemeral: true });
    }

    const deleteReply = { content: '🗑️ Il canale ticket verrà eliminato definitivamente tra 2 secondi...' };
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
        return interaction.followUp({ content: '❌ Solo i membri dello staff possono riaprire i ticket.', ephemeral: true });
      }
      return interaction.reply({ content: '❌ Solo i membri dello staff possono riaprire i ticket.', ephemeral: true });
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
      const activeRow = new ActionRowBuilder().addComponents(
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
            const updatedEmbed = EmbedBuilder.from(oldEmbed)
              .setFields(
                ...oldEmbed.fields.filter(f => f.name !== '⏳ Status'),
                { name: '⏳ Status', value: claimedBy ? `📥 Claimed by <@${claimedBy}>` : '🟢 Open / Unclaimed', inline: true }
              );
            await welcomeMessage.edit({ embeds: [updatedEmbed], components: [activeRow] }).catch(() => {});
          }
        }
      } catch (welcomeErr) {
        console.warn('Could not update welcome message on reopen:', welcomeErr.message);
      }

      const reopenEmbed = new EmbedBuilder()
        .setTitle('🔓 Ticket Riaperto / Ticket Reopened')
        .setDescription(`Il ticket è stato riaperto con successo da <@${interaction.user.id}>.\nI permessi di scrittura per il cliente sono stati ripristinati.`)
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

    // 2. VERIFIED PURCHASE RECORD MODAL
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
