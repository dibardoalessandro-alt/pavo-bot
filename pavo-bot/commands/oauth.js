const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database');

// Helper to check if user has staff privileges
function isStaffMember(member, config) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }
  if (config.staffHierarchy && config.staffRoles) {
    for (const roleName of config.staffHierarchy) {
      const roleId = config.staffRoles[roleName];
      if (roleId && member.roles.cache.has(roleId)) {
        return true;
      }
    }
  }
  return false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('oauth')
    .setDescription('View Pavo Discord OAuth2 verification statistics and user status')
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('View OAuth verification metrics and total authorized users')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('user')
        .setDescription('Inspect OAuth verification status of a specific user')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The user to look up')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('joinall')
        .setDescription('Add all authorized OAuth users to the Discord server')
        .addStringOption(option =>
          option
            .setName('guild_id')
            .setDescription('Target Server / Guild ID (defaults to current server)')
            .setRequired(false)
        )
    ),

  async execute(interaction, config) {
    const member = interaction.member;
    if (!isStaffMember(member, config)) {
      return interaction.reply({
        content: '❌ **Access Denied**: Only authorized Pavo staff members can view OAuth2 data.',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();

    // ==========================================
    // 1. OAUTH STATS
    // ==========================================
    if (subcommand === 'stats') {
      const stats = await db.getOAuthStats();

      const embed = new EmbedBuilder()
        .setTitle('🔐 Pavo OAuth Statistics')
        .setColor(config.embedColor || '#4f46e5')
        .setDescription(
          `> 👥 **Authorized Users:** \`${stats.total}\`\n` +
          `> 📅 **Verified Today:** \`${stats.today}\`\n` +
          `> 📊 **Verified This Week:** \`${stats.thisWeek}\`\n\n` +
          `*Official Discord OAuth2 Verification System*`
        )
        .addFields(
          { name: '🛡️ Scope Level', value: '`identify` (Strict Minimum)', inline: true },
          { name: '⚡ Real-time Sync', value: 'Enabled', inline: true }
        )
        .setFooter({ text: `${config.embedFooterText || 'Pavo Tweak'} • OAuth Management` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ==========================================
    // 2. OAUTH USER LOOKUP
    // ==========================================
    if (subcommand === 'user') {
      const targetUser = interaction.options.getUser('user');
      const oauthData = await db.getOAuthUser(targetUser.id);

      const isVerified = oauthData && oauthData.status === 'ACTIVE';

      const embed = new EmbedBuilder()
        .setTitle(`🔐 OAuth Status — @${targetUser.username}`)
        .setColor(isVerified ? '#10b981' : '#ef4444')
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 User', value: `<@${targetUser.id}> (\`${targetUser.id}\`)`, inline: true },
          { name: '🛡️ Status', value: isVerified ? '✅ **Verified / Authorized**' : '❌ **Not Authorized**', inline: true },
          { 
            name: '📅 Authorized At', 
            value: isVerified && oauthData.authorizedAt 
              ? `<t:${Math.floor(new Date(oauthData.authorizedAt).getTime() / 1000)}:f>` 
              : '*N/A*', 
            inline: false 
          },
          { 
            name: '⏱️ Last Verified', 
            value: isVerified && oauthData.lastVerifiedAt 
              ? `<t:${Math.floor(new Date(oauthData.lastVerifiedAt).getTime() / 1000)}:R>` 
              : '*N/A*', 
            inline: true 
          }
        )
        .setFooter({ text: `${config.embedFooterText || 'Pavo Tweak'} • OAuth Audit` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ==========================================
    // 3. OAUTH JOIN ALL (PULL ALL USERS TO GUILD)
    // ==========================================
    if (subcommand === 'joinall') {
      const targetGuildId = interaction.options.getString('guild_id') || interaction.guildId || config.guildId;
      if (!targetGuildId) {
        return interaction.reply({ content: '❌ Invalid Server ID.', ephemeral: true });
      }

      await interaction.deferReply();

      const users = await db.getAllOAuthUsers();
      if (users.length === 0) {
        return interaction.editReply({ content: 'ℹ️ Nessun utente autorizzato trovato nel database.' });
      }

      let added = 0;
      let alreadyIn = 0;
      let failed = 0;

      for (const u of users) {
        try {
          const res = await fetch(`https://discord.com/api/v10/guilds/${targetGuildId}/members/${u.discordId}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              access_token: u.accessToken
            })
          });

          if (res.status === 201) {
            added++;
          } else if (res.status === 204) {
            alreadyIn++;
          } else {
            failed++;
          }
        } catch (err) {
          failed++;
        }
        // Safety delay to prevent Discord 429 rate-limiting
        await new Promise(r => setTimeout(r, 350));
      }

      const embed = new EmbedBuilder()
        .setTitle('📥 OAuth Member Sync — Completato')
        .setColor('#10b981')
        .setDescription(
          `Sincronizzazione membri completata per il server \`${targetGuildId}\`.\n\n` +
          `> 👥 **Totale Utenti Autorizzati:** \`${users.length}\`\n` +
          `> 📥 **Nuovi Membri Aggiunti:** \`${added}\`\n` +
          `> ⏩ **Già Presenti nel Server:** \`${alreadyIn}\`\n` +
          `> ⚠️ **Falliti / Token Scaduti:** \`${failed}\``
        )
        .setFooter({ text: `${config.embedFooterText || 'Pavo Tweak'} • Member Sync` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  }
};
