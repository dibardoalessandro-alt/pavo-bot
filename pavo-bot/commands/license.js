const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const licenseApi = require('../services/licenseApi');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('license')
    .setDescription('Manage Pavo Tweak licenses (create, ban, unban, query, reset)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // 1. /license create
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create a new Pavo Tweak license key')
        .addStringOption(opt =>
          opt
            .setName('duration')
            .setDescription('License duration')
            .setRequired(false)
            .addChoices(
              { name: 'Lifetime (Permanent)', value: '0' },
              { name: '1 Day (Trial)', value: '1' },
              { name: '7 Days (Weekly)', value: '7' },
              { name: '30 Days (Monthly)', value: '30' },
              { name: '90 Days (Quarterly)', value: '90' },
              { name: '365 Days (Yearly)', value: '365' }
            )
        )
        .addUserOption(opt =>
          opt
            .setName('user')
            .setDescription('Discord user associated with this license')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName('notes')
            .setDescription('Optional administrative notes (e.g. VIP Customer / Giveaway)')
            .setRequired(false)
        )
    )
    // 2. /license ban
    .addSubcommand(sub =>
      sub
        .setName('ban')
        .setDescription('Instantly ban a license key from Pavo Tweak')
        .addStringOption(opt =>
          opt
            .setName('key')
            .setDescription('The license key to ban (e.g. PAVO-XXXX-XXXX-XXXX)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('reason')
            .setDescription('Reason for the ban')
            .setRequired(false)
        )
    )
    // 3. /license unban
    .addSubcommand(sub =>
      sub
        .setName('unban')
        .setDescription('Unban a previously banned license key')
        .addStringOption(opt =>
          opt
            .setName('key')
            .setDescription('The license key to unban')
            .setRequired(true)
        )
    )
    // 4. /license info
    .addSubcommand(sub =>
      sub
        .setName('info')
        .setDescription('View detailed status and hardware binding of a license')
        .addStringOption(opt =>
          opt
            .setName('key')
            .setDescription('The license key to inspect')
            .setRequired(true)
        )
    )
    // 5. /license list
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List all registered licenses')
        .addStringOption(opt =>
          opt
            .setName('status')
            .setDescription('Filter by status')
            .setRequired(false)
            .addChoices(
              { name: 'All Licenses', value: 'all' },
              { name: 'Active Only', value: 'active' },
              { name: 'Banned Only', value: 'banned' },
              { name: 'Expired Only', value: 'expired' }
            )
        )
    )
    // 6. /license resethwid
    .addSubcommand(sub =>
      sub
        .setName('resethwid')
        .setDescription('Reset HWID device binding to allow activation on a new PC')
        .addStringOption(opt =>
          opt
            .setName('key')
            .setDescription('The license key to reset')
            .setRequired(true)
        )
    )
    // 7. /license delete
    .addSubcommand(sub =>
      sub
        .setName('delete')
        .setDescription('Permanently delete a license key from the database')
        .addStringOption(opt =>
          opt
            .setName('key')
            .setDescription('The license key to delete')
            .setRequired(true)
        )
    ),

  async execute(interaction, config) {
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();
    const actor = `${interaction.user.tag} (${interaction.user.id})`;

    try {
      // ─────────────────────────────────────────────
      // /license create
      // ─────────────────────────────────────────────
      if (subcommand === 'create') {
        const durationStr = interaction.options.getString('duration') || '0';
        const durationDays = parseInt(durationStr, 10);
        const targetUser = interaction.options.getUser('user');
        const notes = interaction.options.getString('notes');

        const res = await licenseApi.createLicense({
          durationDays: durationDays > 0 ? durationDays : null,
          discordUserId: targetUser ? targetUser.id : null,
          discordUsername: targetUser ? targetUser.tag : null,
          notes,
          createdBy: actor
        });

        const license = res.license;
        const durationDisplay = durationDays === 0 ? '♾️ Lifetime' : `⏳ ${durationDays} Days`;
        const expiresDisplay = license.expires_at ? new Date(license.expires_at).toUTCString() : 'Never (Lifetime)';

        const embed = new EmbedBuilder()
          .setTitle('✨ License Key Generated Successfully')
          .setColor(0x3B82F6)
          .setDescription(`**Key:** \`${license.license_key}\`\n*(Click key to copy)*`)
          .addFields(
            { name: '🔑 License Key', value: `\`\`\`${license.license_key}\`\`\``, inline: false },
            { name: '⏱️ Duration', value: durationDisplay, inline: true },
            { name: '📅 Expiration Date', value: expiresDisplay, inline: true },
            { name: '👤 Associated User', value: targetUser ? `<@${targetUser.id}> (${targetUser.tag})` : 'Unassigned', inline: true },
            { name: '📝 Notes', value: notes || 'None', inline: true },
            { name: '🛡️ Status', value: '🟢 `ACTIVE`', inline: true }
          )
          .setFooter({ text: 'Pavo Tweak License System • Generated by ' + interaction.user.username })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ─────────────────────────────────────────────
      // /license ban
      // ─────────────────────────────────────────────
      if (subcommand === 'ban') {
        const key = interaction.options.getString('key').trim().toUpperCase();
        const reason = interaction.options.getString('reason') || 'Administrative ban';

        const res = await licenseApi.banLicense(key, reason, actor);

        const embed = new EmbedBuilder()
          .setTitle('🚫 License Banned')
          .setColor(0xEF4444)
          .setDescription(`License key **\`${key}\`** has been marked as **BANNED**.\nConnected Pavo Tweak clients will detect this during their next heartbeat and instantly lock access.`)
          .addFields(
            { name: '🔑 License Key', value: `\`${key}\``, inline: true },
            { name: '⚠️ Reason', value: reason, inline: true },
            { name: '👮 Admin', value: `<@${interaction.user.id}>`, inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ─────────────────────────────────────────────
      // /license unban
      // ─────────────────────────────────────────────
      if (subcommand === 'unban') {
        const key = interaction.options.getString('key').trim().toUpperCase();
        const res = await licenseApi.unbanLicense(key, actor);

        const embed = new EmbedBuilder()
          .setTitle('✅ License Unbanned')
          .setColor(0x10B981)
          .setDescription(`License key **\`${key}\`** has been restored to **ACTIVE** status.`)
          .addFields(
            { name: '🔑 License Key', value: `\`${key}\``, inline: true },
            { name: '🛡️ Status', value: '🟢 `ACTIVE`', inline: true },
            { name: '👮 Admin', value: `<@${interaction.user.id}>`, inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ─────────────────────────────────────────────
      // /license info
      // ─────────────────────────────────────────────
      if (subcommand === 'info') {
        const key = interaction.options.getString('key').trim().toUpperCase();
        const res = await licenseApi.getLicense(key);
        const lic = res.license;

        let statusBadge = '🟢 `ACTIVE`';
        let color = 0x3B82F6;
        if (lic.status === 'banned') {
          statusBadge = '🔴 `BANNED`';
          color = 0xEF4444;
        } else if (lic.status === 'expired') {
          statusBadge = '🟡 `EXPIRED`';
          color = 0xF59E0B;
        } else if (lic.status === 'revoked') {
          statusBadge = '⚫ `REVOKED`';
          color = 0x6B7280;
        }

        const embed = new EmbedBuilder()
          .setTitle(`🔍 License Details: ${lic.license_key}`)
          .setColor(color)
          .addFields(
            { name: '🔑 Key', value: `\`${lic.license_key}\``, inline: false },
            { name: '🛡️ Status', value: statusBadge, inline: true },
            { name: '💻 Bound HWID', value: lic.hwid ? `\`${lic.hwid.substring(0, 24)}...\`` : '*Not yet activated*', inline: true },
            { name: '🌐 Last IP', value: lic.ip_address || '*None*', inline: true },
            { name: '👤 Discord User', value: lic.discord_user_id ? `<@${lic.discord_user_id}>` : '*None*', inline: true },
            { name: '📅 Created At', value: `<t:${Math.floor(new Date(lic.created_at).getTime() / 1000)}:f>`, inline: true },
            { name: '⏳ Expiration', value: lic.expires_at ? `<t:${Math.floor(new Date(lic.expires_at).getTime() / 1000)}:R>` : '♾️ Lifetime', inline: true },
            { name: '💓 Last Heartbeat', value: lic.last_heartbeat ? `<t:${Math.floor(new Date(lic.last_heartbeat).getTime() / 1000)}:R>` : '*Never*', inline: true },
            { name: '📝 Notes / Reason', value: lic.ban_reason ? `**Ban Reason:** ${lic.ban_reason}` : (lic.notes || '*None*'), inline: false }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ─────────────────────────────────────────────
      // /license list
      // ─────────────────────────────────────────────
      if (subcommand === 'list') {
        const filterStatus = interaction.options.getString('status') || 'all';
        const res = await licenseApi.listLicenses({ status: filterStatus, limit: 15 });

        if (!res.licenses || res.licenses.length === 0) {
          return interaction.editReply({ content: `ℹ️ No licenses found with status: \`${filterStatus}\`.` });
        }

        const lines = res.licenses.map(lic => {
          const sEmoji = lic.status === 'active' ? '🟢' : (lic.status === 'banned' ? '🔴' : '🟡');
          const userStr = lic.discord_user_id ? `<@${lic.discord_user_id}>` : 'Unbound';
          const hwidStr = lic.hwid ? '💻 Bound' : '⚪ Unused';
          return `${sEmoji} \`${lic.license_key}\` | ${hwidStr} | ${userStr}`;
        });

        const embed = new EmbedBuilder()
          .setTitle(`📋 Pavo Tweak License Database (${res.pagination.total} Total)`)
          .setColor(0x3B82F6)
          .setDescription(lines.join('\n'))
          .setFooter({ text: `Page 1 of ${res.pagination.totalPages} • Filter: ${filterStatus}` })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ─────────────────────────────────────────────
      // /license resethwid
      // ─────────────────────────────────────────────
      if (subcommand === 'resethwid') {
        const key = interaction.options.getString('key').trim().toUpperCase();
        const res = await licenseApi.resetHwid(key, actor);

        const embed = new EmbedBuilder()
          .setTitle('🔄 Hardware ID (HWID) Reset')
          .setColor(0x3B82F6)
          .setDescription(`The device binding for license key **\`${key}\`** has been cleared.\nThe user can now activate this key on their new PC.`)
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ─────────────────────────────────────────────
      // /license delete
      // ─────────────────────────────────────────────
      if (subcommand === 'delete') {
        const key = interaction.options.getString('key').trim().toUpperCase();
        const res = await licenseApi.deleteLicense(key, actor);

        const embed = new EmbedBuilder()
          .setTitle('🗑️ License Permanently Deleted')
          .setColor(0x6B7280)
          .setDescription(`License key **\`${key}\`** has been purged from the database.`)
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

    } catch (err) {
      console.error(`Error in /license ${subcommand}:`, err);
      return interaction.editReply({
        content: `❌ **License Operation Failed:** ${err.message}`
      });
    }
  }
};
