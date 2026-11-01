const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database');
const logger = require('../services/logger');

function isStaffMember(member, config) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const staffRoleNames = Object.keys(config.staffRoles || {});
  return member.roles.cache.some(r => staffRoleNames.includes(r.name) || (config.managementRoles || []).includes(r.name));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('key')
    .setDescription('Sistema completo di gestione e riscatto licenze / chiavi')
    // Subcommand: create
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Crea una o più chiavi di licenza')
        .addStringOption(opt =>
          opt.setName('product')
            .setDescription('Nome del prodotto (es. BlockSpin, PavoTweak, VIP)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('duration')
            .setDescription('Durata della chiave')
            .setRequired(true)
            .addChoices(
              { name: 'Lifetime (Permanente)', value: 'lifetime' },
              { name: '30 Giorni (30d)', value: '30d' },
              { name: '7 Giorni (7d)', value: '7d' }
            )
        )
        .addIntegerOption(opt =>
          opt.setName('quantity')
            .setDescription('Numero di chiavi da generare (1-25)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(25)
        )
        .addStringOption(opt =>
          opt.setName('notes')
            .setDescription('Note interne sulla licenza')
            .setRequired(false)
        )
    )
    // Subcommand: list
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Mostra l\'elenco delle chiavi generate')
        .addStringOption(opt =>
          opt.setName('status')
            .setDescription('Filtra per stato')
            .setRequired(false)
            .addChoices(
              { name: 'Tutte', value: 'ALL' },
              { name: 'Attive (ACTIVE)', value: 'ACTIVE' },
              { name: 'Riscattate (REDEEMED)', value: 'REDEEMED' },
              { name: 'Revocate (REVOKED)', value: 'REVOKED' },
              { name: 'Scadute (EXPIRED)', value: 'EXPIRED' }
            )
        )
        .addStringOption(opt =>
          opt.setName('product')
            .setDescription('Filtra per nome prodotto')
            .setRequired(false)
        )
    )
    // Subcommand: info
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Visualizza i dettagli completi di una chiave')
        .addStringOption(opt =>
          opt.setName('key')
            .setDescription('La chiave di licenza (es. PAVO-XXXX-XXXX-XXXX)')
            .setRequired(true)
        )
    )
    // Subcommand: revoke
    .addSubcommand(sub =>
      sub.setName('revoke')
        .setDescription('Revoca una chiave di licenza attiva')
        .addStringOption(opt =>
          opt.setName('key')
            .setDescription('La chiave da revocare')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('reason')
            .setDescription('Motivo della revoca')
            .setRequired(false)
        )
    )
    // Subcommand: delete
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Elimina definitivamente una chiave dal database')
        .addStringOption(opt =>
          opt.setName('key')
            .setDescription('La chiave da eliminare')
            .setRequired(true)
        )
    )
    // Subcommand: redeem
    .addSubcommand(sub =>
      sub.setName('redeem')
        .setDescription('Riscatta una chiave di licenza per il tuo account')
        .addStringOption(opt =>
          opt.setName('key')
            .setDescription('Inserisci la chiave da riscattare')
            .setRequired(true)
        )
    )
    // Subcommand: check
    .addSubcommand(sub =>
      sub.setName('check')
        .setDescription('Controlla se una chiave è valida senza riscattarla')
        .addStringOption(opt =>
          opt.setName('key')
            .setDescription('La chiave da verificare')
            .setRequired(true)
        )
    ),

  async execute(interaction, config) {
    const subcommand = interaction.options.getSubcommand();
    const isStaff = isStaffMember(interaction.member, config);

    // ============================================
    // 1. /key redeem
    // ============================================
    if (subcommand === 'redeem') {
      const keyInput = interaction.options.getString('key').trim().toUpperCase();
      const result = await db.redeemKey(keyInput, interaction.user.id, interaction.user.tag);

      if (!result.success) {
        let msg = '❌ Chiave non valida o inesistente.';
        if (result.reason === 'REVOKED') msg = '🚫 Questa chiave è stata **REVOCATA** dallo staff.';
        if (result.reason === 'ALREADY_REDEEMED') msg = `⚠️ Questa chiave è già stata **RISCATTATA** da <@${result.redeemedBy}> in data ${new Date(result.redeemedAt).toLocaleString()}.`;
        if (result.reason === 'EXPIRED') msg = '⌛ Questa chiave è **SCADUTA**.';
        return interaction.reply({ content: msg, ephemeral: true });
      }

      const lic = result.license;
      const embed = new EmbedBuilder()
        .setTitle('🎉 Licenza Riscattata con Successo!')
        .setColor(0x00FF88)
        .addFields(
          { name: '🔑 Chiave', value: `\`${lic.key}\``, inline: false },
          { name: '📦 Prodotto', value: `**${lic.product}**`, inline: true },
          { name: '⏳ Durata', value: `${lic.duration.toUpperCase()}`, inline: true },
          { name: '📅 Scadenza', value: lic.expiresAt ? `<t:${Math.floor(new Date(lic.expiresAt).getTime() / 1000)}:F>` : 'Permanente / Lifetime', inline: false }
        )
        .setFooter({ text: 'Grazie per aver scelto Pavo Tweak Suite!' })
        .setTimestamp();

      // Log to staff & bot logs
      logger.logStaff(
        interaction.client,
        config,
        '🔑 Licenza Riscattata',
        `L'utente <@${interaction.user.id}> ha riscattato una licenza.`,
        [
          { name: 'Utente', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
          { name: 'Chiave', value: `\`${lic.key}\``, inline: true },
          { name: 'Prodotto', value: lic.product, inline: true }
        ]
      );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ============================================
    // 2. /key check
    // ============================================
    if (subcommand === 'check') {
      const keyInput = interaction.options.getString('key').trim().toUpperCase();
      const lic = await db.getKey(keyInput);

      if (!lic) {
        return interaction.reply({ content: '❌ Nessuna chiave trovata corrispondente al codice inserito.', ephemeral: true });
      }

      const statusColors = {
        ACTIVE: 0x00FF88,
        REDEEMED: 0xF1C40F,
        EXPIRED: 0x95A5A6,
        REVOKED: 0xE74C3C
      };

      const embed = new EmbedBuilder()
        .setTitle(`🔍 Verifica Chiave: ${lic.key}`)
        .setColor(statusColors[lic.status] || 0x5865F2)
        .addFields(
          { name: '📦 Prodotto', value: lic.product, inline: true },
          { name: '🚦 Stato', value: `**${lic.status}**`, inline: true },
          { name: '⏳ Durata', value: lic.duration, inline: true },
          { name: '📅 Creata il', value: `<t:${Math.floor(new Date(lic.createdAt).getTime() / 1000)}:R>`, inline: true }
        );

      if (lic.expiresAt) {
        embed.addFields({ name: '⌛ Scadenza', value: `<t:${Math.floor(new Date(lic.expiresAt).getTime() / 1000)}:R>`, inline: true });
      }

      if (lic.status === 'REDEEMED' && isStaff) {
        embed.addFields(
          { name: '👤 Riscattata da', value: `<@${lic.redeemedBy}> (${lic.redeemerTag})`, inline: true },
          { name: '🕒 Data Riscatto', value: `<t:${Math.floor(new Date(lic.redeemedAt).getTime() / 1000)}:F>`, inline: true }
        );
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // --- STAFF-ONLY COMMANDS BELOW ---
    if (!isStaff) {
      return interaction.reply({ content: '🔒 Solo lo Staff autorizzato può eseguire questo comando.', ephemeral: true });
    }

    // ============================================
    // 3. /key create
    // ============================================
    if (subcommand === 'create') {
      const product = interaction.options.getString('product');
      const duration = interaction.options.getString('duration');
      const quantity = interaction.options.getInteger('quantity') || 1;
      const notes = interaction.options.getString('notes') || '';

      const keys = await db.createMultipleKeys(
        product,
        duration,
        quantity,
        interaction.user.id,
        interaction.user.tag,
        notes
      );

      const keysListFormatted = keys.map(k => `\`${k.key}\``).join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`🔑 ${quantity === 1 ? 'Chiave Creata' : `${quantity} Chiavi Generate con Successo`}`)
        .setColor(0x00FFAA)
        .addFields(
          { name: '📦 Prodotto', value: `**${product}**`, inline: true },
          { name: '⏳ Durata', value: `**${duration.toUpperCase()}**`, inline: true },
          { name: '👤 Creatore', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📋 Chiavi Generate', value: keysListFormatted.length > 1024 ? `${keysListFormatted.substring(0, 1000)}...` : keysListFormatted, inline: false }
        )
        .setFooter({ text: 'Conserva le chiavi e distribuiscile in modo sicuro' })
        .setTimestamp();

      logger.logStaff(
        interaction.client,
        config,
        '🔑 Generazione Chiavi Licenza',
        `Lo staff <@${interaction.user.id}> ha generato **${quantity}** chiavi per **${product}** (${duration}).`
      );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ============================================
    // 4. /key list
    // ============================================
    if (subcommand === 'list') {
      const statusFilter = interaction.options.getString('status');
      const productFilter = interaction.options.getString('product');

      const filter = {};
      if (statusFilter && statusFilter !== 'ALL') filter.status = statusFilter;
      if (productFilter) filter.product = productFilter;

      const keys = await db.getAllKeys(filter);

      if (keys.length === 0) {
        return interaction.reply({ content: 'ℹ️ Nessuna chiave trovata con i filtri specificati.', ephemeral: true });
      }

      const totalActive = keys.filter(k => k.status === 'ACTIVE').length;
      const totalRedeemed = keys.filter(k => k.status === 'REDEEMED').length;

      const previewKeys = keys.slice(0, 15).map((k, i) => {
        const statusEmoji = k.status === 'ACTIVE' ? '🟢' : k.status === 'REDEEMED' ? '🟡' : k.status === 'REVOKED' ? '🔴' : '⚪';
        return `\`${i + 1}.\` ${statusEmoji} \`${k.key}\` — **${k.product}** (${k.duration}) | ${k.status}${k.redeemerTag ? ` (<@${k.redeemedBy}>)` : ''}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setTitle('📋 Registro Licenze & Chiavi Pavo')
        .setDescription(`**Totale Trovate:** ${keys.length} | 🟢 Attive: ${totalActive} | 🟡 Riscattate: ${totalRedeemed}\n\n${previewKeys}`)
        .setColor(0x5865F2)
        .setFooter({ text: keys.length > 15 ? `Mostrate prime 15 di ${keys.length} chiavi totali` : 'Registro completo' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ============================================
    // 5. /key info
    // ============================================
    if (subcommand === 'info') {
      const keyInput = interaction.options.getString('key').trim().toUpperCase();
      const lic = await db.getKey(keyInput);

      if (!lic) {
        return interaction.reply({ content: '❌ Chiave non trovata nel database.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle(`🔑 Dettagli Licenza: ${lic.key}`)
        .setColor(0x5865F2)
        .addFields(
          { name: '📦 Prodotto', value: lic.product, inline: true },
          { name: '🚦 Stato', value: `\`${lic.status}\``, inline: true },
          { name: '⏳ Durata', value: lic.duration, inline: true },
          { name: '👤 Creatore', value: `<@${lic.createdBy}> (${lic.creatorTag || 'N/A'})`, inline: true },
          { name: '📅 Creata il', value: `<t:${Math.floor(new Date(lic.createdAt).getTime() / 1000)}:F>`, inline: true },
          { name: '⌛ Scadenza', value: lic.expiresAt ? `<t:${Math.floor(new Date(lic.expiresAt).getTime() / 1000)}:F>` : 'Permanente', inline: true }
        );

      if (lic.redeemedBy) {
        embed.addFields(
          { name: '👤 Riscattata Da', value: `<@${lic.redeemedBy}> (${lic.redeemerTag || 'N/A'})`, inline: true },
          { name: '🕒 Riscatto Effettuato', value: `<t:${Math.floor(new Date(lic.redeemedAt).getTime() / 1000)}:F>`, inline: true }
        );
      }

      if (lic.revokedBy) {
        embed.addFields(
          { name: '🚫 Revocata Da', value: lic.revokedBy, inline: true },
          { name: '📝 Motivo Revoca', value: lic.revocationReason || 'Nessuno', inline: true }
        );
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ============================================
    // 6. /key revoke
    // ============================================
    if (subcommand === 'revoke') {
      const keyInput = interaction.options.getString('key').trim().toUpperCase();
      const reason = interaction.options.getString('reason') || 'Revocata da Staff';

      const res = await db.revokeKey(keyInput, interaction.user.tag, reason);
      if (!res.success) {
        return interaction.reply({ content: '❌ Impossibile trovare la chiave specificata.', ephemeral: true });
      }

      logger.logStaff(
        interaction.client,
        config,
        '🚫 Licenza Revocata',
        `La chiave \`${keyInput}\` è stata revocata da <@${interaction.user.id}>.\n**Motivo:** ${reason}`
      );

      return interaction.reply({ content: `✅ Chiave \`${keyInput}\` revocata con successo.\nMotivo: *${reason}*`, ephemeral: true });
    }

    // ============================================
    // 7. /key delete
    // ============================================
    if (subcommand === 'delete') {
      const keyInput = interaction.options.getString('key').trim().toUpperCase();
      const deleted = await db.deleteKey(keyInput);

      if (!deleted) {
        return interaction.reply({ content: '❌ Chiave non trovata.', ephemeral: true });
      }

      logger.logStaff(
        interaction.client,
        config,
        '🗑️ Licenza Eliminata',
        `La chiave \`${keyInput}\` è stata eliminata definitivamente dal database da <@${interaction.user.id}>.`
      );

      return interaction.reply({ content: `🗑️ Chiave \`${keyInput}\` eliminata definitivamente dal database.`, ephemeral: true });
    }
  }
};
