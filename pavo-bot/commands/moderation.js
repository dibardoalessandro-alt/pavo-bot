const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../database');
const logger = require('../services/logger');

function isStaffMember(member, config) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const staffRoleNames = Object.keys(config.staffRoles || {});
  return member.roles.cache.some(r => staffRoleNames.includes(r.name) || (config.managementRoles || []).includes(r.name));
}

module.exports = {
  commands: [
    // 1. /warn
    {
      data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Ammonisci un utente per infrazione delle regole')
        .addUserOption(opt => opt.setName('utente').setDescription('Utente da ammonire').setRequired(true))
        .addStringOption(opt => opt.setName('motivo').setDescription('Motivo dell\'avvertimento').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
      async execute(interaction, config) {
        const target = interaction.options.getUser('utente');
        const reason = interaction.options.getString('motivo');

        const warning = await db.addWarning(target.id, interaction.user.id, reason);
        const totalWarns = (await db.getWarnings(target.id)).length;

        const embed = new EmbedBuilder()
          .setTitle('⚠️ Ammonizione Registrata')
          .setColor(0xE67E22)
          .addFields(
            { name: '👤 Utente', value: `<@${target.id}> (\`${target.id}\`)`, inline: true },
            { name: '👮 Moderatore', value: `<@${interaction.user.id}>`, inline: true },
            { name: '📝 Motivo', value: reason, inline: false },
            { name: '📊 Ammonizioni Totali', value: `\`${totalWarns}\``, inline: true }
          )
          .setTimestamp();

        logger.logStaff(
          interaction.client,
          config,
          '⚠️ Utente Ammonito',
          `L'utente <@${target.id}> ha ricevuto un avvertimento da <@${interaction.user.id}>.\n**Motivo:** ${reason}\n**Totale:** ${totalWarns}`
        );

        await interaction.reply({ embeds: [embed] });
      }
    },

    // 2. /warnings
    {
      data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('Visualizza lo storico delle ammonizioni di un utente')
        .addUserOption(opt => opt.setName('utente').setDescription('Utente da controllare').setRequired(true)),
      async execute(interaction) {
        const target = interaction.options.getUser('utente');
        const warns = await db.getWarnings(target.id);

        if (warns.length === 0) {
          return interaction.reply({ content: `✅ <@${target.id}> non ha nessuna ammonizione registrata.`, ephemeral: true });
        }

        const lines = warns.map((w, i) => `\`${i + 1}.\` **${w.reason}** — da <@${w.moderatorId}> (<t:${Math.floor(new Date(w.timestamp).getTime() / 1000)}:R>)`).join('\n');

        const embed = new EmbedBuilder()
          .setTitle(`⚠️ Ammonizioni di ${target.username} (${warns.length})`)
          .setDescription(lines)
          .setColor(0xE67E22)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }
    },

    // 3. /clear
    {
      data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Cancella un numero di messaggi nel canale')
        .addIntegerOption(opt => opt.setName('quantita').setDescription('Numero di messaggi (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
      async execute(interaction, config) {
        const amount = interaction.options.getInteger('quantita');
        try {
          const deleted = await interaction.channel.bulkDelete(amount, true);
          logger.logStaff(
            interaction.client,
            config,
            '🧹 Messaggi Puliti',
            `<@${interaction.user.id}> ha cancellato **${deleted.size}** messaggi in <#${interaction.channelId}>.`
          );
          await interaction.reply({ content: `🧹 Eliminati con successo **${deleted.size}** messaggi!`, ephemeral: true });
        } catch (err) {
          await interaction.reply({ content: '❌ Impossibile eliminare messaggi più vecchi di 14 giorni.', ephemeral: true });
        }
      }
    },

    // 4. /kick
    {
      data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Espelli un utente dal server')
        .addUserOption(opt => opt.setName('utente').setDescription('Utente da espellere').setRequired(true))
        .addStringOption(opt => opt.setName('motivo').setDescription('Motivo dell\'espulsione').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
      async execute(interaction, config) {
        const target = interaction.options.getUser('utente');
        const reason = interaction.options.getString('motivo') || 'Nessun motivo fornito';
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (!member) return interaction.reply({ content: '❌ Utente non presente nel server.', ephemeral: true });
        if (!member.kickable) return interaction.reply({ content: '❌ Ruolo utente troppo alto per essere espulso.', ephemeral: true });

        await member.kick(reason);
        logger.logStaff(
          interaction.client,
          config,
          '👢 Utente Espulso',
          `<@${target.id}> è stato espulso da <@${interaction.user.id}>.\n**Motivo:** ${reason}`
        );
        await interaction.reply({ content: `👢 **${target.tag}** è stato espulso dal server.\nMotivo: *${reason}*` });
      }
    },

    // 5. /ban
    {
      data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Banna un utente dal server')
        .addUserOption(opt => opt.setName('utente').setDescription('Utente da bannare').setRequired(true))
        .addStringOption(opt => opt.setName('motivo').setDescription('Motivo del ban').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
      async execute(interaction, config) {
        const target = interaction.options.getUser('utente');
        const reason = interaction.options.getString('motivo') || 'Nessun motivo fornito';
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (member && !member.bannable) return interaction.reply({ content: '❌ Impossibile bannare questo utente (ruolo superiore o uguale al bot).', ephemeral: true });

        await interaction.guild.members.ban(target.id, { reason });
        logger.logStaff(
          interaction.client,
          config,
          '🔨 Utente Bannato',
          `<@${target.id}> è stato bannato da <@${interaction.user.id}>.\n**Motivo:** ${reason}`
        );
        await interaction.reply({ content: `🔨 **${target.tag}** è stato bannato permanentemente.\nMotivo: *${reason}*` });
      }
    },

    // 6. /unban
    {
      data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Sbanna un utente tramite il suo Discord ID')
        .addStringOption(opt => opt.setName('userid').setDescription('ID Discord dell\'utente da sbannare').setRequired(true))
        .addStringOption(opt => opt.setName('motivo').setDescription('Motivo dello sban').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
      async execute(interaction, config) {
        const userId = interaction.options.getString('userid').trim();
        const reason = interaction.options.getString('motivo') || 'Sban richiesto da Staff';

        try {
          await interaction.guild.members.unban(userId, reason);
          logger.logStaff(
            interaction.client,
            config,
            '🔓 Utente Sbannato',
            `L'utente ID \`${userId}\` è stato sbannato da <@${interaction.user.id}>.\n**Motivo:** ${reason}`
          );
          await interaction.reply({ content: `🔓 Utente con ID \`${userId}\` sbannato con successo!` });
        } catch (err) {
          await interaction.reply({ content: `❌ Impossibile trovare il ban per l'ID specificato (\`${userId}\`).`, ephemeral: true });
        }
      }
    },

    // 7. /timeout
    {
      data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Metti in timeout (silenzia) un utente temporaneamente')
        .addUserOption(opt => opt.setName('utente').setDescription('Utente da silenziare').setRequired(true))
        .addIntegerOption(opt => opt.setName('minuti').setDescription('Durata del timeout in minuti (1-40320)').setRequired(true).setMinValue(1).setMaxValue(40320))
        .addStringOption(opt => opt.setName('motivo').setDescription('Motivo').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
      async execute(interaction, config) {
        const target = interaction.options.getUser('utente');
        const minutes = interaction.options.getInteger('minuti');
        const reason = interaction.options.getString('motivo') || 'Timeout applicato da Staff';
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (!member) return interaction.reply({ content: '❌ Utente non trovato.', ephemeral: true });
        if (!member.moderatable) return interaction.reply({ content: '❌ Impossibile mettere in timeout questo utente.', ephemeral: true });

        const durationMs = minutes * 60 * 1000;
        await member.timeout(durationMs, reason);

        logger.logStaff(
          interaction.client,
          config,
          '🔇 Timeout Applicato',
          `<@${target.id}> è stato silenziato per **${minutes} minuti** da <@${interaction.user.id}>.\n**Motivo:** ${reason}`
        );

        await interaction.reply({ content: `🔇 **${target.tag}** è stato messo in timeout per **${minutes} minuti**.\nMotivo: *${reason}*` });
      }
    },

    // 8. /untimeout
    {
      data: new SlashCommandBuilder()
        .setName('untimeout')
        .setDescription('Rimuovi il timeout da un utente')
        .addUserOption(opt => opt.setName('utente').setDescription('Utente da liberare').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
      async execute(interaction) {
        const target = interaction.options.getUser('utente');
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (!member) return interaction.reply({ content: '❌ Utente non trovato.', ephemeral: true });
        await member.timeout(null, 'Timeout rimosso da Staff');

        await interaction.reply({ content: `🔊 Timeout rimosso per **${target.tag}**.` });
      }
    },

    // 9. /lock & /unlock
    {
      data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Blocca la scrittura in questo canale per i membri')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
      async execute(interaction) {
        await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
          SendMessages: false
        });
        await interaction.reply({ content: '🔒 Canale **bloccato** ai messaggi per tutti i membri.' });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Sblocca la scrittura in questo canale')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
      async execute(interaction) {
        await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
          SendMessages: null
        });
        await interaction.reply({ content: '🔓 Canale **sbloccato** con successo!' });
      }
    },

    // 10. /slowmode
    {
      data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Imposta il rallentatore (slowmode) nel canale')
        .addIntegerOption(opt => opt.setName('secondi').setDescription('Secondi di attesa (0 per disattivare)').setRequired(true).setMinValue(0).setMaxValue(21600))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
      async execute(interaction) {
        const seconds = interaction.options.getInteger('secondi');
        await interaction.channel.setRateLimitPerUser(seconds);
        await interaction.reply({ content: seconds === 0 ? '⚡ Slowmode **disattivata** in questo canale.' : `⏳ Slowmode impostata a **${seconds} secondi** per messaggio.` });
      }
    },

    // 11. /userinfo & /serverinfo
    {
      data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Visualizza informazioni dettagliate su un utente')
        .addUserOption(opt => opt.setName('utente').setDescription('Utente').setRequired(false)),
      async execute(interaction) {
        const target = interaction.options.getUser('utente') || interaction.user;
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        const embed = new EmbedBuilder()
          .setTitle(`👤 Scheda Utente — ${target.tag}`)
          .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
          .setColor(0x5865F2)
          .addFields(
            { name: '🆔 ID Utente', value: `\`${target.id}\``, inline: true },
            { name: '🤖 Bot', value: target.bot ? 'Sì' : 'No', inline: true },
            { name: '📅 Creazione Account', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true }
          );

        if (member) {
          embed.addFields(
            { name: '📥 Ingresso nel Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
            { name: '🎭 Ruoli', value: member.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => `<@&${r.id}>`).join(' ') || 'Nessun ruolo', inline: false }
          );
        }

        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Mostra tutte le statistiche e dettagli del server'),
      async execute(interaction) {
        const { guild } = interaction;
        const owner = await guild.fetchOwner();

        const embed = new EmbedBuilder()
          .setTitle(`🏰 ${guild.name}`)
          .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
          .setColor(0x9B59B6)
          .addFields(
            { name: '👑 Proprietario', value: `<@${owner.id}> (\`${owner.id}\`)`, inline: true },
            { name: '👥 Membri Totali', value: `\`${guild.memberCount}\``, inline: true },
            { name: '💬 Canali Totali', value: `\`${guild.channels.cache.size}\``, inline: true },
            { name: '🎭 Ruoli', value: `\`${guild.roles.cache.size}\``, inline: true },
            { name: '✨ Livello Boost', value: `Livello \`${guild.premiumTier}\` (${guild.premiumSubscriptionCount || 0} boost)`, inline: true },
            { name: '📅 Data Creazione', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false }
          )
          .setFooter({ text: `ID Server: ${guild.id}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }
    }
  ]
};
