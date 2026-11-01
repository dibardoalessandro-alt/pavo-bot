const { EmbedBuilder } = require('discord.js');

async function sendLog(client, config, channelKey, title, description, color = 0x5865F2, fields = []) {
  try {
    const channelId = config[channelKey] || config.logChannels?.[channelKey];
    if (!channelId) return;

    const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp();

    if (fields && fields.length > 0) {
      embed.addFields(fields);
    }

    await channel.send({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    console.error(`[LOGGER ERROR] Failed to send log to ${channelKey}:`, err.message);
  }
}

module.exports = {
  logStaff: (client, config, title, desc, fields) => sendLog(client, config, 'staffLogChannelId', title, desc, 0xE74C3C, fields),
  logBot: (client, config, title, desc, fields) => sendLog(client, config, 'botLogChannelId', title, desc, 0x3498DB, fields),
  logTicket: (client, config, title, desc, fields) => sendLog(client, config, 'ticketLogChannelId', title, desc, 0xF1C40F, fields),
  logGame: (client, config, title, desc, fields) => sendLog(client, config, 'gameResultsChannelId', title, desc, 0x2ECC71, fields)
};
