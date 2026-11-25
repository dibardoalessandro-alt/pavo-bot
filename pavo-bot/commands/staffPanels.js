const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} = require('discord.js');
const db = require('../database');

// Staff role resolver (uses allStaffRoles so even vouch-only staff roles are recognized as staff here)
function getStaffRoleName(member, config) {
  if (!member || !member.roles || !member.roles.cache) return null;
  const rolesMap = config.allStaffRoles || config.staffRoles || {};
  for (const roleName of (config.staffHierarchy || Object.keys(rolesMap))) {
    const roleId = rolesMap[roleName];
    if (roleId && member.roles.cache.has(roleId)) {
      return roleName;
    }
  }
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) {
    return 'Admin';
  }
  return null;
}

function isAnyStaff(member, config) {
  return getStaffRoleName(member, config) !== null;
}

// Product options for Confirm Purchase
const PRODUCT_OPTIONS = [
  { value: 'pavo_hub_key', label: "Pavo's Hub Key", emoji: '🔑', description: "Pavo's Hub license key (asks duration in days)" },
  { value: 'orbs_pc', label: 'Orbs PC', emoji: '🖥️', description: 'Orbs for PC' },
  { value: 'custom_bot', label: 'Custom Discord Bot', emoji: '🤖', description: 'Custom Discord bot development & hosting' },
  { value: 'mm_service', label: 'MM Service', emoji: '🤝', description: 'Official Middleman service' },
  { value: 'other', label: 'Other Product', emoji: '📦', description: 'Specify the product in the next step' }
];

const PAYMENT_OPTIONS = [
  { value: 'money', label: 'Money ($ / €)', emoji: '💵', description: 'Cash / money payment (PayPal, LTC, etc.)' },
  { value: 'rpg', label: 'RPG', emoji: '🚀', description: 'Paid in RPG (specify how many)' },
  { value: 'anaconda', label: 'Anaconda', emoji: '🐍', description: 'Paid in Anaconda (specify how many)' },
  { value: 'other_pay', label: 'Other Method', emoji: '💳', description: 'Another payment method or item' }
];

// ==========================================
// 1. SEND / ENSURE STAFF INFO PANEL (Channel 1575291641411932300)
// ==========================================
async function sendOrUpdateStaffInfoPanel(client, config) {
  const channelId = config.staffInfoPanelChannelId || '1575291641411932300';
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    console.warn(`⚠️ [STAFF PANELS] Staff info channel ${channelId} not found.`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('📊 Pavo Staff — Check Info')
    .setDescription(
      `Welcome to the Staff Statistics Panel!\n\n` +
      `Click the **Check Info** button below to privately view your full staff statistics:\n` +
      `• 💬 **Messages Sent** across the server\n` +
      `• ✋ **Tickets Claimed** & 🔒 **Tickets Closed**\n` +
      `• 🎟️ **Total Tickets Handled**\n` +
      `• 💰 **Confirmed Sales** (Money, RPG, Anaconda & recent history)`
    )
    .setColor(config.embedColor || '#4f46e5')
    .setThumbnail(channel.guild?.iconURL({ dynamic: true }) || null)
    .setFooter({ text: `${config.embedFooterText || 'Pavo Tweak'} • Staff Info Panel` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('staffpanel_check_info')
      .setLabel('Check Info')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Primary)
  );

  try {
    const messages = await channel.messages.fetch({ limit: 30 });
    const existing = messages.find(
      m => m.author.id === client.user.id &&
        (m.components || []).some(r => JSON.stringify(r.toJSON()).includes('staffpanel_check_info'))
    );

    if (existing) {
      await existing.edit({ embeds: [embed], components: [row] }).catch(() => {});
      console.log(`✅ [STAFF PANELS] Updated Check Info panel in #${channel.name}`);
      return;
    }

    await channel.send({ embeds: [embed], components: [row] });
    console.log(`🆕 [STAFF PANELS] Created Check Info panel in #${channel.name}`);
  } catch (err) {
    console.error('❌ [STAFF PANELS] Failed to setup Check Info panel:', err);
  }
}

// ==========================================
// 2. SEND / ENSURE CONFIRM PURCHASE PANEL (Channel 1575292386085441556)
// ==========================================
async function sendOrUpdateConfirmPurchasePanel(client, config) {
  const channelId = config.confirmPurchasePanelChannelId || '1575292386085441556';
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    console.warn(`⚠️ [STAFF PANELS] Confirm Purchase channel ${channelId} not found.`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('💰 Pavo Staff — Confirm Purchase')
    .setDescription(
      `Use this panel to log every completed customer purchase.\n\n` +
      `Click **Confirm Purchase** below and select:\n` +
      `1️⃣ **What you sold** *(for Pavo's Hub Key you will enter how many days)*\n` +
      `2️⃣ **How the customer paid** *(Money, RPG, Anaconda, or Other)*\n` +
      `3️⃣ **Amount / Quantity** and customer name or ID\n\n` +
      `Every confirmed sale is permanently saved to the database and automatically added to your **Check Info** profile.`
    )
    .setColor('#22c55e')
    .setThumbnail(channel.guild?.iconURL({ dynamic: true }) || null)
    .setFooter({ text: `${config.embedFooterText || 'Pavo Tweak'} • Sales Registry` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('staffpanel_confirm_purchase')
      .setLabel('Confirm Purchase')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
  );

  try {
    const messages = await channel.messages.fetch({ limit: 30 });
    const existing = messages.find(
      m => m.author.id === client.user.id &&
        (m.components || []).some(r => JSON.stringify(r.toJSON()).includes('staffpanel_confirm_purchase'))
    );

    if (existing) {
      await existing.edit({ embeds: [embed], components: [row] }).catch(() => {});
      console.log(`✅ [STAFF PANELS] Updated Confirm Purchase panel in #${channel.name}`);
      return;
    }

    await channel.send({ embeds: [embed], components: [row] });
    console.log(`🆕 [STAFF PANELS] Created Confirm Purchase panel in #${channel.name}`);
  } catch (err) {
    console.error('❌ [STAFF PANELS] Failed to setup Confirm Purchase panel:', err);
  }
}

// ==========================================
// 3. BUTTON HANDLER (staffpanel_*)
// ==========================================
async function handleButton(interaction, config) {
  const customId = interaction.customId;
  const member = interaction.member;

  if (!isAnyStaff(member, config)) {
    return interaction.reply({
      content: '❌ Only staff members can use this panel.',
      ephemeral: true
    });
  }

  // CHECK INFO BUTTON
  if (customId === 'staffpanel_check_info') {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.user;
    const roleName = getStaffRoleName(member, config) || 'Staff';

    await db.ensureStaffExists(user.id, user.username);
    const dbInfo = await db.getStaffInfo(user.id);
    const allSales = await getAllUserSales(user.id);

    // Summarize payment totals across Money, RPG, Anaconda
    let totalMoney = 0;
    let totalRpg = 0;
    let totalAnaconda = 0;
    for (const s of allSales) {
      const pm = String(s.payment_method || '');
      const upper = pm.toUpperCase();
      if (upper.startsWith('RPG')) {
        const m = pm.match(/(\d+(?:[.,]\d+)?)/);
        totalRpg += m ? parseFloat(m[1].replace(',', '.')) : Number(s.price || 0);
      } else if (upper.startsWith('ANACONDA')) {
        const m = pm.match(/(\d+(?:[.,]\d+)?)/);
        totalAnaconda += m ? parseFloat(m[1].replace(',', '.')) : Number(s.price || 0);
      } else {
        totalMoney += Number(s.price || 0);
      }
    }

    const lastActiveText = dbInfo?.last_active_at
      ? `<t:${Math.floor(new Date(dbInfo.last_active_at).getTime() / 1000)}:R>`
      : 'N/A';

    const recentLines = allSales.slice(0, 5).map(s => {
      const ts = Math.floor(new Date(s.date).getTime() / 1000);
      return `• **${s.product}** — \`${s.payment_method}\` (<t:${ts}:R>)`;
    }).join('\n');

    const infoEmbed = new EmbedBuilder()
      .setTitle(`📊 Staff Info — ${user.username}`)
      .setColor(config.embedColor || '#4f46e5')
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '🛡️ Staff Role', value: `**${roleName}**`, inline: true },
        { name: '📅 Joined Staff', value: dbInfo?.join_date || 'N/A', inline: true },
        { name: '🕒 Last Active', value: lastActiveText, inline: true },
        { name: '💬 Messages Sent', value: `\`${dbInfo?.messages_sent || 0}\``, inline: true },
        { name: '✋ Tickets Claimed', value: `\`${dbInfo?.tickets_claimed || 0}\``, inline: true },
        { name: '🔒 Tickets Closed', value: `\`${dbInfo?.tickets_closed || 0}\``, inline: true },
        { name: '🎟️ Tickets Handled', value: `\`${dbInfo?.tickets_handled || 0}\``, inline: true },
        { name: '💰 Total Sales', value: `\`${Math.max(dbInfo?.sales_count || 0, allSales.length)}\``, inline: true },
        { name: '💵 Total Money', value: `**$${totalMoney.toFixed(2)}**`, inline: true },
        { name: '🚀 Total RPG', value: `\`${totalRpg}\``, inline: true },
        { name: '🐍 Total Anaconda', value: `\`${totalAnaconda}\``, inline: true }
      )
      .setFooter({ text: 'Pavo Staff Registry • Persistent DB' })
      .setTimestamp();

    if (recentLines) {
      infoEmbed.addFields({ name: '🧾 Recent Sales (Last 5)', value: recentLines, inline: false });
    }

    return interaction.editReply({ embeds: [infoEmbed] });
  }

  // CONFIRM PURCHASE BUTTON -> Step 1: Select Product
  if (customId === 'staffpanel_confirm_purchase') {
    const productSelect = new StringSelectMenuBuilder()
      .setCustomId('staffpanel_select_product')
      .setPlaceholder('1️⃣ Select what you sold...')
      .addOptions(
        PRODUCT_OPTIONS.map(p =>
          new StringSelectMenuOptionBuilder()
            .setLabel(p.label)
            .setValue(p.value)
            .setDescription(p.description)
            .setEmoji(p.emoji)
        )
      );

    return interaction.reply({
      content: '🛒 **Confirm Purchase (Step 1/3)**\nSelect the product you sold:',
      components: [new ActionRowBuilder().addComponents(productSelect)],
      ephemeral: true
    });
  }
}

// ==========================================
// 4. SELECT MENU HANDLER (staffpanel_select_*)
// ==========================================
async function handleSelectMenu(interaction, config) {
  const customId = interaction.customId;
  if (!isAnyStaff(interaction.member, config)) {
    return interaction.reply({ content: '❌ Only staff members can log sales.', ephemeral: true });
  }

  // Step 1 -> Step 2: Product chosen, now choose payment method
  if (customId === 'staffpanel_select_product') {
    const productKey = interaction.values[0];
    const prodObj = PRODUCT_OPTIONS.find(p => p.value === productKey);

    const paymentSelect = new StringSelectMenuBuilder()
      .setCustomId(`staffpanel_select_payment:${productKey}`)
      .setPlaceholder('2️⃣ Select how the customer paid...')
      .addOptions(
        PAYMENT_OPTIONS.map(pm =>
          new StringSelectMenuOptionBuilder()
            .setLabel(pm.label)
            .setValue(pm.value)
            .setDescription(pm.description)
            .setEmoji(pm.emoji)
        )
      );

    return interaction.update({
      content: `🛒 **Confirm Purchase (Step 2/3)**\nSelected product: **${prodObj?.label || productKey}**\nNow select **how the customer paid**:`,
      components: [new ActionRowBuilder().addComponents(paymentSelect)]
    });
  }

  // Step 2 -> Step 3: Payment method chosen, open tailored Modal
  if (customId.startsWith('staffpanel_select_payment:')) {
    const productKey = customId.split(':')[1];
    const paymentKey = interaction.values[0];

    const modal = new ModalBuilder()
      .setCustomId(`staffpanel_purchase_modal:${productKey}:${paymentKey}`)
      .setTitle('Confirm Purchase — Details');

    const rows = [];

    // If "other" product, ask product name
    if (productKey === 'other') {
      rows.push(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('custom_product')
            .setLabel('What did you sell?')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. Pavo Tweak, Boosts, etc.')
            .setRequired(true)
        )
      );
    }

    // If Pavo's Hub Key, ask duration in days
    if (productKey === 'pavo_hub_key') {
      rows.push(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('key_days')
            .setLabel("How many days is the Pavo's Hub Key?")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. 7 days, 30 days, Lifetime')
            .setRequired(true)
        )
      );
    }

    // Payment amount / quantity field tailored to chosen method
    let amountLabel = 'Amount / Quantity';
    let amountPlaceholder = 'e.g. 10';
    if (paymentKey === 'money') {
      amountLabel = 'How much money did they pay? (e.g. 15.00)';
      amountPlaceholder = 'e.g. 15.00';
    } else if (paymentKey === 'rpg') {
      amountLabel = 'How many RPGs did they pay?';
      amountPlaceholder = 'e.g. 3';
    } else if (paymentKey === 'anaconda') {
      amountLabel = 'How many Anacondas did they pay?';
      amountPlaceholder = 'e.g. 2';
    } else {
      amountLabel = 'Payment method & quantity';
      amountPlaceholder = 'e.g. 5 Boosts';
    }

    rows.push(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('payment_amount')
          .setLabel(amountLabel)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(amountPlaceholder)
          .setRequired(true)
      )
    );

    // Optional customer field
    rows.push(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('customer_info')
          .setLabel('Customer (Username or Discord ID - optional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. username or 123456789012345678')
          .setRequired(false)
      )
    );

    modal.addComponents(...rows.slice(0, 5));
    return interaction.showModal(modal);
  }
}

// ==========================================
// 5. MODAL SUBMIT HANDLER (staffpanel_purchase_modal:*)
// ==========================================
async function handleModal(interaction, config) {
  const customId = interaction.customId;
  if (!customId.startsWith('staffpanel_purchase_modal:')) return;

  if (!isAnyStaff(interaction.member, config)) {
    return interaction.reply({ content: '❌ Only staff members can log sales.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const [, productKey, paymentKey] = customId.split(':');
    const prodObj = PRODUCT_OPTIONS.find(p => p.value === productKey);

    let productName = prodObj ? prodObj.label : productKey;
    if (productKey === 'other') {
      productName = interaction.fields.getTextInputValue('custom_product').trim();
    }
    if (productKey === 'pavo_hub_key') {
      const rawDays = interaction.fields.getTextInputValue('key_days').trim();
      const daysLabel = /^\d+$/.test(rawDays) ? `${rawDays} days` : rawDays;
      productName = `Pavo's Hub Key (${daysLabel})`;
    }

    const rawAmount = interaction.fields.getTextInputValue('payment_amount').trim();
    const numericMatch = rawAmount.replace(',', '.').match(/\d+(?:\.\d+)?/);
    const numericVal = numericMatch ? parseFloat(numericMatch[0]) : 0;

    let paymentDisplay = rawAmount;
    let recordedPrice = 0;

    if (paymentKey === 'money') {
      if (!numericMatch || isNaN(numericVal) || numericVal < 0) {
        return interaction.editReply({ content: '❌ Please enter a valid money amount (e.g. `15` or `15.50`).' });
      }
      recordedPrice = numericVal;
      paymentDisplay = `Money ($${numericVal.toFixed(2)})`;
    } else if (paymentKey === 'rpg') {
      if (!numericMatch || isNaN(numericVal) || numericVal <= 0) {
        return interaction.editReply({ content: '❌ Please enter a valid number of **RPGs** (e.g. `2`).' });
      }
      recordedPrice = 0;
      paymentDisplay = `RPG x${numericVal}`;
    } else if (paymentKey === 'anaconda') {
      if (!numericMatch || isNaN(numericVal) || numericVal <= 0) {
        return interaction.editReply({ content: '❌ Please enter a valid number of **Anacondas** (e.g. `2`).' });
      }
      recordedPrice = 0;
      paymentDisplay = `Anaconda x${numericVal}`;
    } else {
      recordedPrice = 0;
      paymentDisplay = rawAmount;
    }

    let customerId = 'Unknown';
    let customerUsername = 'N/A';
    const rawCustomer = (interaction.fields.getTextInputValue('customer_info') || '').trim();
    if (rawCustomer) {
      const cleanedId = rawCustomer.replace(/[<@!>]/g, '').trim();
      if (/^\d{15,22}$/.test(cleanedId)) {
        const fetchedUser = await interaction.client.users.fetch(cleanedId).catch(() => null);
        customerId = cleanedId;
        customerUsername = fetchedUser ? fetchedUser.username : cleanedId;
      } else {
        customerUsername = rawCustomer;
      }
    }

    const staffRole = getStaffRoleName(interaction.member, config) || 'Senior Supporter';
    const percentage = await db.getRoleCommissionPercentage(staffRole, config.defaultCommissionPercentages || {});
    const commission = recordedPrice > 0 ? parseFloat(((recordedPrice * percentage) / 100).toFixed(2)) : 0;

    const sale = await db.recordSale(
      customerId,
      customerUsername,
      interaction.user.id,
      interaction.user.username,
      productName,
      recordedPrice,
      paymentDisplay,
      interaction.channelId,
      commission
    );

    const confirmEmbed = new EmbedBuilder()
      .setTitle('✅ Purchase Confirmed')
      .setColor('#22c55e')
      .addFields(
        { name: '🛡️ Staff', value: `<@${interaction.user.id}> (${interaction.user.username})`, inline: true },
        { name: '📦 Product', value: `**${productName}**`, inline: true },
        { name: '💳 Payment', value: `**${paymentDisplay}**`, inline: true },
        { name: '👤 Customer', value: customerId !== 'Unknown' ? `<@${customerId}> (${customerUsername})` : customerUsername, inline: true },
        { name: '🆔 Sale ID', value: `\`#${sale.sale_id}\``, inline: true }
      )
      .setFooter({ text: 'Pavo Sales Registry • Persistent DB' })
      .setTimestamp();

    // Post public receipt in the Confirm Purchase channel (and staff log channel if different)
    const confirmChannelId = config.confirmPurchasePanelChannelId || '1575292386085441556';
    const confirmChannel = interaction.guild?.channels.cache.get(confirmChannelId) ||
      await interaction.client.channels.fetch(confirmChannelId).catch(() => null);
    if (confirmChannel && confirmChannel.isTextBased()) {
      await confirmChannel.send({ embeds: [confirmEmbed] }).catch(() => {});
    }

    const logChannelId = config.staffLogChannelId || config.ticketLogChannelId;
    if (logChannelId && logChannelId !== confirmChannelId) {
      const logChannel = interaction.guild?.channels.cache.get(logChannelId) ||
        await interaction.client.channels.fetch(logChannelId).catch(() => null);
      if (logChannel && logChannel.isTextBased()) {
        await logChannel.send({ embeds: [confirmEmbed] }).catch(() => {});
      }
    }

    return interaction.editReply({
      content: `✅ Sale **#${sale.sale_id}** logged successfully! (**${productName}** — **${paymentDisplay}**)`,
      embeds: [confirmEmbed]
    });
  } catch (err) {
    console.error('❌ [STAFF PANELS] Error recording purchase:', err);
    return interaction.editReply({ content: `❌ Failed to save purchase: ${err.message}` });
  }
}

// Helper to get full sales list for a staff member (not limited to 10)
async function getAllUserSales(staffId) {
  if (typeof db.getAllSalesByUser === 'function') {
    return db.getAllSalesByUser(staffId);
  }
  const res = await db.getSalesByUser(staffId);
  return res.recent || [];
}

module.exports = {
  sendOrUpdateStaffInfoPanel,
  sendOrUpdateConfirmPurchasePanel,
  handleButton,
  handleSelectMenu,
  handleModal,
  isAnyStaff
};
