const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { runFullServerSetup } = require('../setup-server');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Inizializza e sincronizza tutti i canali, ruoli, regole e pannelli ticket di Pavo Bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.reply({ content: '⚙️ Avvio configurazione automatica completa di Pavo Bot...', ephemeral: true });
    try {
      await runFullServerSetup(interaction.guild);
      await interaction.followUp({ content: '🎉 Configurazione Pavo Bot completata con successo al 100%!', ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.followUp({ content: `❌ Errore durante il setup: ${err.message}`, ephemeral: true });
    }
  }
};
