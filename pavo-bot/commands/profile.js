const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Mostra la tua scheda profilo giocatore completa o quella di un altro utente')
    .addUserOption(opt =>
      opt.setName('utente')
        .setDescription('Utente di cui visualizzare il profilo')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('utente') || interaction.user;
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    const userProfile = await db.getUserProfile(targetUser.id);
    const stats = userProfile.stats;
    const profile = userProfile.profile;

    const winRate = stats.totalGames > 0 ? ((stats.wins / stats.totalGames) * 100).toFixed(1) : '0.0';

    // XP Progress Bar
    const currentXp = profile.xp;
    const currentLevel = profile.level;
    const nextLevelXp = Math.pow(currentLevel, 2) * 100;
    const prevLevelXp = Math.pow(currentLevel - 1, 2) * 100;
    const progressInLevel = Math.max(0, currentXp - prevLevelXp);
    const neededInLevel = Math.max(1, nextLevelXp - prevLevelXp);
    const percent = Math.min(100, Math.floor((progressInLevel / neededInLevel) * 100));

    const totalBars = 10;
    const filledBars = Math.floor((percent / 100) * totalBars);
    const barStr = '▰'.repeat(filledBars) + '▱'.repeat(totalBars - filledBars);

    const rolesList = member 
      ? member.roles.cache
          .filter(r => r.id !== interaction.guild.id)
          .map(r => `<@&${r.id}>`)
          .slice(0, 8)
          .join(' ') || 'Nessun Ruolo'
      : 'N/A';

    const embed = new EmbedBuilder()
      .setTitle(`🎮 PROFILO GIOCATORE — ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .setColor(0x5865F2)
      .setDescription(
        `⭐ **Livello ${currentLevel}** — \`${currentXp} XP\`\n` +
        `\`${barStr}\` **${percent}%** (Prossimo livello: \`${nextLevelXp} XP\`)\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .addFields(
        { 
          name: '💰 Economia', 
          value: `🪙 Saldo: **${userProfile.balance.toLocaleString('it-IT')} Pavo Coins**\n📈 Guadagni Giochi: **${stats.coinsWon.toLocaleString('it-IT')}**`, 
          inline: true 
        },
        { 
          name: '🏆 Statistiche Giochi', 
          value: `🎮 Partite: **${stats.totalGames}**\n🏆 Vittorie: **${stats.wins}** (${winRate}%)\n💀 Sconfitte: **${stats.losses}**`, 
          inline: true 
        },
        { 
          name: '🎲 Vittorie Speciali', 
          value: `🎯 Guess: **${stats.guessWins}** | 🎲 Dice: **${stats.diceWins}**\n🎰 Slots: **${stats.slotsWins}** | 🃏 Blackjack: **${stats.blackjackWins}**`, 
          inline: false 
        },
        { 
          name: '🛡️ Stato Account', 
          value: `📜 Regole Accettate: ${userProfile.rulesAccepted ? '✅ Sì' : '❌ No'}\n⚠️ Ammonizioni: **${userProfile.warningsCount}**\n📅 Membro Dal: ${member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'N/A'}`, 
          inline: false 
        },
        { 
          name: '🎭 Ruoli Posseduti', 
          value: rolesList, 
          inline: false 
        }
      )
      .setFooter({ text: 'Pavo Tweak & BlockSpin Community' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
