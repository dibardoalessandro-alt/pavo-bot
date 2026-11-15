const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

// Deduplication cache to prevent duplicate DMs for the same event key
const sentEventKeys = new Map();
const DEDUPE_TTL_MS = 60 * 1000;

function isDuplicateEvent(dedupeKey) {
  if (!dedupeKey) return false;
  const now = Date.now();
  for (const [k, ts] of sentEventKeys.entries()) {
    if (now - ts > DEDUPE_TTL_MS) sentEventKeys.delete(k);
  }
  if (sentEventKeys.has(dedupeKey)) return true;
  sentEventKeys.set(dedupeKey, now);
  return false;
}

function getBrandFooter(config, guild) {
  return {
    text: config?.embedFooterText || 'Pavo Tweak · Official Discord',
    iconURL: guild?.iconURL?.() || undefined
  };
}

/**
 * Safely sends a DM to a Discord user without ever throwing or interrupting the caller.
 */
async function sendSafeDM(client, userId, payload, eventLabel = 'notification', dedupeKey = null) {
  if (!client || !userId || userId === 'Unknown' || !/^\d+$/.test(String(userId))) {
    return false;
  }

  if (dedupeKey && isDuplicateEvent(dedupeKey)) {
    return false;
  }

  try {
    const user = client.users.cache.get(String(userId)) || await client.users.fetch(String(userId));
    if (!user || user.bot) return false;

    await user.send(payload);
    return true;
  } catch (err) {
    console.warn(`[DM-NOTIFIER] Could not deliver ${eventLabel} DM to user ${userId}: ${err.message}`);
    return false;
  }
}

/**
 * 1. Ticket Opened DM
 */
async function notifyTicketOpened({ client, guild, config, userId, channel, productName, kind = 'support' }) {
  const isApp = kind === 'application';
  const embed = new EmbedBuilder()
    .setTitle(isApp ? 'Application Ticket Opened' : 'Support Ticket Opened')
    .setDescription(
      `Your ticket has been created in **${guild?.name || 'Pavo'}**.\n` +
      `A member of our team will review your request shortly.`
    )
    .setColor(config?.embedColor || '#4f46e5')
    .addFields(
      { name: 'Ticket Channel', value: `<#${channel.id}> (\`#${channel.name}\`)`, inline: true },
      { name: isApp ? 'Position' : 'Category / Product', value: productName || 'General Support', inline: true },
      { name: 'Status', value: 'Open', inline: true }
    )
    .setFooter(getBrandFooter(config, guild))
    .setTimestamp();

  if (guild?.iconURL?.()) {
    embed.setThumbnail(guild.iconURL({ size: 256 }));
  }

  return sendSafeDM(
    client,
    userId,
    { embeds: [embed] },
    'ticket_opened',
    `ticket_opened:${channel.id}:${userId}`
  );
}

/**
 * 2. Ticket Claimed DM
 */
async function notifyTicketClaimed({ client, guild, config, userId, channel, staffUser, productName }) {
  const embed = new EmbedBuilder()
    .setTitle('Ticket Claimed by Staff')
    .setDescription(
      `Your ticket in **${guild?.name || 'Pavo'}** has been claimed by a staff member and is now being handled.`
    )
    .setColor('#3b82f6')
    .addFields(
      { name: 'Ticket Channel', value: `<#${channel.id}> (\`#${channel.name}\`)`, inline: true },
      { name: 'Assigned Staff', value: `<@${staffUser.id}> (\`${staffUser.username}\`)`, inline: true },
      ...(productName ? [{ name: 'Category / Product', value: productName, inline: true }] : [])
    )
    .setFooter(getBrandFooter(config, guild))
    .setTimestamp();

  if (guild?.iconURL?.()) {
    embed.setThumbnail(guild.iconURL({ size: 256 }));
  }

  return sendSafeDM(
    client,
    userId,
    { embeds: [embed] },
    'ticket_claimed',
    `ticket_claimed:${channel.id}:${staffUser.id}`
  );
}

/**
 * 3. Ticket Closed DM (with Transcript attached)
 */
async function notifyTicketClosed({ client, guild, config, userId, channel, closedByUser, claimedById, productName, transcriptBuffer }) {
  const embed = new EmbedBuilder()
    .setTitle('Ticket Closed — Transcript Attached')
    .setDescription(
      `Your ticket in **${guild?.name || 'Pavo'}** has been closed.\n` +
      `A full copy of your ticket conversation transcript is attached to this message for your records.`
    )
    .setColor('#ef4444')
    .addFields(
      { name: 'Ticket Channel', value: `\`#${channel.name}\` (\`${channel.id}\`)`, inline: true },
      { name: 'Closed By', value: `<@${closedByUser.id}> (\`${closedByUser.username}\`)`, inline: true },
      { name: 'Handled By', value: claimedById ? `<@${claimedById}>` : `<@${closedByUser.id}>`, inline: true },
      ...(productName ? [{ name: 'Category / Product', value: productName, inline: true }] : [])
    )
    .setFooter(getBrandFooter(config, guild))
    .setTimestamp();

  if (guild?.iconURL?.()) {
    embed.setThumbnail(guild.iconURL({ size: 256 }));
  }

  const files = [];
  if (transcriptBuffer) {
    files.push(
      new AttachmentBuilder(transcriptBuffer, {
        name: `transcript-${channel.name}.txt`
      })
    );
  }

  return sendSafeDM(
    client,
    userId,
    { embeds: [embed], files },
    'ticket_closed',
    `ticket_closed:${channel.id}:${Date.now().toString().slice(0, -4)}`
  );
}

/**
 * 4. Payment Received DM
 */
async function notifyPaymentReceived({ client, guild, config, userId, transactionId, product, price, paymentMethod, staffUser }) {
  const txRef = transactionId ? `#SALE-${transactionId}` : `TX-${Date.now()}`;
  const embed = new EmbedBuilder()
    .setTitle('Payment Received')
    .setDescription(
      `We have received and verified your payment in **${guild?.name || 'Pavo'}**.`
    )
    .setColor('#3b82f6')
    .addFields(
      { name: 'Transaction ID', value: `\`${txRef}\``, inline: true },
      { name: 'Amount Received', value: `**$${Number(price).toFixed(2)} USD**`, inline: true },
      { name: 'Payment Method', value: paymentMethod || 'Verified Method', inline: true },
      { name: 'Product', value: product || 'Pavo Product', inline: true },
      { name: 'Verified By', value: `<@${staffUser.id}> (\`${staffUser.username}\`)`, inline: true }
    )
    .setFooter(getBrandFooter(config, guild))
    .setTimestamp();

  if (guild?.iconURL?.()) {
    embed.setThumbnail(guild.iconURL({ size: 256 }));
  }

  return sendSafeDM(
    client,
    userId,
    { embeds: [embed] },
    'payment_received',
    `payment_received:${txRef}:${userId}`
  );
}

/**
 * 5. Purchase Completed DM
 */
async function notifyPurchaseCompleted({ client, guild, config, userId, transactionId, product, price, paymentMethod, staffUser, channelId }) {
  const txRef = transactionId ? `#SALE-${transactionId}` : `TX-${Date.now()}`;
  const embed = new EmbedBuilder()
    .setTitle('Purchase Completed')
    .setDescription(
      `Thank you for your purchase with **${guild?.name || 'Pavo'}**.\n` +
      `Your order has been completed and logged in our official registry.`
    )
    .setColor('#22c55e')
    .addFields(
      { name: 'Transaction ID', value: `\`${txRef}\``, inline: true },
      { name: 'Product', value: `**${product}**`, inline: true },
      { name: 'Total Paid', value: `**$${Number(price).toFixed(2)} USD**`, inline: true },
      { name: 'Payment Method', value: paymentMethod || 'Verified Method', inline: true },
      { name: 'Staff Handler', value: `<@${staffUser.id}> (\`${staffUser.username}\`)`, inline: true },
      ...(channelId ? [{ name: 'Ticket Reference', value: `<#${channelId}>`, inline: true }] : [])
    )
    .setFooter(getBrandFooter(config, guild))
    .setTimestamp();

  if (guild?.iconURL?.()) {
    embed.setThumbnail(guild.iconURL({ size: 256 }));
  }

  return sendSafeDM(
    client,
    userId,
    { embeds: [embed] },
    'purchase_completed',
    `purchase_completed:${txRef}:${userId}`
  );
}

module.exports = {
  sendSafeDM,
  notifyTicketOpened,
  notifyTicketClaimed,
  notifyTicketClosed,
  notifyPaymentReceived,
  notifyPurchaseCompleted
};
