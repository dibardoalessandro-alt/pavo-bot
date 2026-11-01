const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
  commands: [
    // 1. /balance
    {
      data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Visualizza il tuo saldo o quello di un altro utente in Pavo Coins')
        .addUserOption(opt =>
          opt.setName('utente')
            .setDescription('Utente di cui visualizzare il saldo')
            .setRequired(false)
        ),
      async execute(interaction) {
        const target = interaction.options.getUser('utente') || interaction.user;
        const bal = await db.getBalance(target.id);
        const stats = await db.getGameStats(target.id);

        const embed = new EmbedBuilder()
          .setTitle(`💰 Saldo Pavo Coins - ${target.username}`)
          .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
          .setColor(0xF1C40F)
          .addFields(
            { name: '🪙 Pavo Coins Disponibili', value: `\`${bal.coins.toLocaleString('it-IT')} Pavo Coins\``, inline: false },
            { name: '🏆 Partite Vinte', value: `\`${stats.wins}\` (su ${stats.totalGames})`, inline: true },
            { name: '📈 Guadagni da Giochi', value: `\`+${stats.coinsWon.toLocaleString('it-IT')}\``, inline: true }
          )
          .setFooter({ text: 'Pavo Virtual Economy · Usa /daily per riscattare monete ogni giorno' })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }
    },

    // 2. /daily
    {
      data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Riscatta la tua ricompensa giornaliera gratuita di 500 Pavo Coins!'),
      async execute(interaction) {
        const result = await db.claimDaily(interaction.user.id, 500);

        if (!result.success) {
          const totalSeconds = Math.ceil(result.cooldownRemainingMs / 1000);
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;

          return interaction.reply({
            content: `⏳ Hai già riscattato il tuo bonus giornaliero! Riprova tra **${hours}h ${minutes}m ${seconds}s**.`,
            ephemeral: true
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('🎁 Ricompensa Giornaliera Riscattata!')
          .setDescription(`Hai ricevuto con successo **+${result.reward} Pavo Coins**! 🪙`)
          .setColor(0x00FF88)
          .addFields(
            { name: '💰 Nuovo Saldo Totale', value: `\`${result.newBalance.toLocaleString('it-IT')} Pavo Coins\``, inline: true }
          )
          .setFooter({ text: 'Torna tra 24 ore per il prossimo regalo!' })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }
    },

    // 3. /pay
    {
      data: new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Invia Pavo Coins a un altro utente')
        .addUserOption(opt =>
          opt.setName('destinatario')
            .setDescription('L\'utente a cui inviare le monete')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('quantita')
            .setDescription('Importo di Pavo Coins da trasferire')
            .setRequired(true)
            .setMinValue(1)
        ),
      async execute(interaction) {
        const recipient = interaction.options.getUser('destinatario');
        const amount = interaction.options.getInteger('quantita');

        if (recipient.id === interaction.user.id) {
          return interaction.reply({ content: '❌ Non puoi inviare monete a te stesso.', ephemeral: true });
        }
        if (recipient.bot) {
          return interaction.reply({ content: '❌ Non puoi inviare monete a un bot.', ephemeral: true });
        }

        const res = await db.transferCoins(interaction.user.id, recipient.id, amount, 'Transazione utente');

        if (!res.success) {
          return interaction.reply({
            content: `❌ Saldo insufficiente. Hai solo **${res.currentBalance.toLocaleString('it-IT')} Pavo Coins**, ma hai provato a inviarne **${amount.toLocaleString('it-IT')}**.`,
            ephemeral: true
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('💸 Trasferimento Completato!')
          .setDescription(`Hai inviato con successo **${amount.toLocaleString('it-IT')} Pavo Coins** a <@${recipient.id}>!`)
          .setColor(0x2ECC71)
          .addFields(
            { name: '👤 Mittente', value: `<@${interaction.user.id}> (Saldo: \`${res.senderNewBalance.toLocaleString('it-IT')}\`)`, inline: true },
            { name: '📥 Ricevente', value: `<@${recipient.id}> (Saldo: \`${res.receiverNewBalance.toLocaleString('it-IT')}\`)`, inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }
    },

    // 4. /leaderboard
    {
      data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Visualizza la classifica dei migliori utenti')
        .addStringOption(opt =>
          opt.setName('tipo')
            .setDescription('Tipologia di classifica')
            .setRequired(false)
            .addChoices(
              { name: '💰 Più Ricchi (Coins)', value: 'coins' },
              { name: '🏆 Più Vittorie (Vittorie nei giochi)', value: 'wins' },
              { name: '🎮 Più Attivi (Totale partite giocate)', value: 'games' }
            )
        ),
      async execute(interaction) {
        const type = interaction.options.getString('tipo') || 'coins';

        if (type === 'coins') {
          const topUsers = await db.getEconomyLeaderboard(10);
          const lines = topUsers.map((u, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`${i + 1}.\``;
            return `${medal} <@${u.userId}> — **${u.coins.toLocaleString('it-IT')}** Pavo Coins`;
          }).join('\n') || 'Nessun utente registrato.';

          const embed = new EmbedBuilder()
            .setTitle('🏆 Classifica Economia - Più Ricchi')
            .setDescription(lines)
            .setColor(0xF1C40F)
            .setFooter({ text: 'Aggiornato in tempo reale' })
            .setTimestamp();

          return interaction.reply({ embeds: [embed] });
        } else {
          const topStats = await db.getGamesLeaderboard(type, 10);
          const lines = topStats.map((s, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`${i + 1}.\``;
            const detail = type === 'games' ? `**${s.totalGames}** partite giocate` : `**${s.wins}** vittorie (${s.totalGames} partite)`;
            return `${medal} <@${s.userId}> — ${detail}`;
          }).join('\n') || 'Nessun dato di gioco registrato.';

          const embed = new EmbedBuilder()
            .setTitle(`🏆 Classifica Giochi - ${type === 'games' ? 'Più Attivi' : 'Maggiori Vittorie'}`)
            .setDescription(lines)
            .setColor(0xE67E22)
            .setFooter({ text: 'Aggiornato in tempo reale' })
            .setTimestamp();

          return interaction.reply({ embeds: [embed] });
        }
      }
    }
  ]
};
