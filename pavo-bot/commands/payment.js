const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('payment')
    .setDescription('Display official Pavo Tweak payment information'),

  async execute(interaction, config) {
    const guild = interaction.guild;
    const payment = config.paymentInfo || {};

    const paymentEmbed = new EmbedBuilder()
      .setTitle('💳 Pavo Tweak Payment Information')
      .setDescription('To purchase our premium optimizations and packages, please use the verified payment methods below.\n\n⚠️ **Important:** Payments are processed manually. After sending the payment, please open a support ticket (`/ticket`) and send your TXID or payment proof.')
      .setColor(config.embedColor || '#4f46e5')
      .addFields(
        { 
          name: '🅿️ PayPal (Friends & Family)', 
          value: payment.paypal ? `\`${payment.paypal}\`` : 'Not configured. Ask in ticket.', 
          inline: false 
        },
        { 
          name: '🪙 LTC (Litecoin Wallet Address)', 
          value: payment.ltc ? `\`${payment.ltc}\`` : 'Not configured. Ask in ticket.', 
          inline: false 
        },
        { 
          name: '🚀 Discord Server Boosts', 
          value: payment.boosts ? payment.boosts : 'Boost the server to unlock custom optimization plans!', 
          inline: false 
        }
      )
      .setFooter({ text: 'Pavo Tweak Payment Info' })
      .setTimestamp();

    if (guild) {
      paymentEmbed.setThumbnail(guild.iconURL({ dynamic: true }) || null);
    }

    await interaction.reply({ embeds: [paymentEmbed] });
  }
};
