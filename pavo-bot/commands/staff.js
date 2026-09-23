const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database');
const fs = require('fs');
const path = require('path');

// Read config to populate choices dynamically
const configPath = path.join(__dirname, '../config.json');
let config = {};
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.error("Could not load config in staff.js for command builder choices:", e);
}

const roleChoices = config.staffRoles 
  ? Object.keys(config.staffRoles).map(name => ({ name: name, value: name }))
  : [];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff')
    .setDescription('Manage or view staff information')
    .addSubcommand(subcommand =>
      subcommand.setName('list')
        .setDescription('Show a list of all staff members and their roles')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('info')
        .setDescription('Show information about a specific staff member')
        .addUserOption(option => 
          option.setName('user')
            .setDescription('The staff member to query')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('promote')
        .setDescription('Promote a staff member to a new role')
        .addUserOption(option => 
          option.setName('user')
            .setDescription('The user to promote')
            .setRequired(true)
        )
        .addStringOption(option => 
          option.setName('role')
            .setDescription('The target role to assign')
            .setRequired(true)
            .addChoices(...(roleChoices.length > 0 ? roleChoices : [{ name: 'Placeholder', value: 'Placeholder' }]))
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('demote')
        .setDescription('Demote a staff member to a new role')
        .addUserOption(option => 
          option.setName('user')
            .setDescription('The user to demote')
            .setRequired(true)
        )
        .addStringOption(option => 
          option.setName('role')
            .setDescription('The target role to assign')
            .setRequired(true)
            .addChoices(...(roleChoices.length > 0 ? roleChoices : [{ name: 'Placeholder', value: 'Placeholder' }]))
        )
    ),

  async execute(interaction, config) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({ content: '❌ This command can only be used inside a Discord server.', ephemeral: true });
    }

    // Helper to find member's highest staff role name
    const getStaffRoleName = (member) => {
      for (const roleName of config.staffHierarchy) {
        const roleId = config.staffRoles[roleName];
        if (roleId && member.roles.cache.has(roleId)) {
          return roleName;
        }
      }
      return null;
    };

    // Helper to check if member is management
    const isManagement = (member) => {
      const staffRole = getStaffRoleName(member);
      if (!staffRole) return false;
      return config.managementRoles.includes(staffRole);
    };

    // ==========================================
    // 1. STAFF LIST
    // ==========================================
    if (subcommand === 'list') {
      await interaction.deferReply();

      try {
        // Fetch all members of the guild (needs GuildMembers intent)
        const members = await guild.members.fetch();
        
        // Group staff by their highest staff role
        const staffByRole = {};
        for (const roleName of config.staffHierarchy) {
          staffByRole[roleName] = [];
        }

        let totalStaffCount = 0;
        members.forEach(member => {
          const roleName = getStaffRoleName(member);
          if (roleName) {
            staffByRole[roleName].push(member);
            totalStaffCount++;
          }
        });

        const listEmbed = new EmbedBuilder()
          .setTitle('🛡️ Pavo Tweak Staff Directory')
          .setDescription(`Listing all active support and management staff members in **Pavo Tweak** (${totalStaffCount} total).`)
          .setColor(config.embedColor || '#4f46e5')
          .setThumbnail(guild.iconURL({ dynamic: true }) || null)
          .setTimestamp();

        let hasStaff = false;
        for (const roleName of config.staffHierarchy) {
          const staffList = staffByRole[roleName];
          if (staffList.length > 0) {
            hasStaff = true;
            const membersString = staffList.map(m => `• <@${m.id}> (${m.user.username})`).join('\n');
            listEmbed.addFields({ name: `👥 ${roleName}`, value: membersString, inline: false });
          }
        }

        if (!hasStaff) {
          listEmbed.setDescription('⚠️ No staff members found. Please configure the role IDs in `config.json`.');
        }

        await interaction.editReply({ embeds: [listEmbed] });
      } catch (err) {
        console.error('Error fetching staff list:', err);
        await interaction.editReply({ content: `❌ Error fetching staff members: ${err.message}` });
      }
    }

    // ==========================================
    // 2. STAFF INFO
    // ==========================================
    else if (subcommand === 'info') {
      const user = interaction.options.getUser('user') || interaction.user;
      
      try {
        const targetMember = await guild.members.fetch(user.id);
        const currentRole = getStaffRoleName(targetMember);

        if (!currentRole) {
          return interaction.reply({ content: `❌ <@${user.id}> is not recognized as a staff member.`, ephemeral: true });
        }

        await interaction.deferReply();

        // Get DB details
        let dbInfo = await db.getStaffInfo(user.id);
        if (!dbInfo) {
          // Sync with database if they are staff but not logged yet
          await db.ensureStaffExists(user.id, user.username);
          dbInfo = await db.getStaffInfo(user.id);
        }

        const infoEmbed = new EmbedBuilder()
          .setTitle(`👤 Staff Profile: ${user.username}`)
          .setColor(config.embedColor || '#4f46e5')
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: 'Discord Account', value: `<@${user.id}>\nUsername: \`${user.username}\`\nID: \`${user.id}\``, inline: false },
            { name: '🛡️ Staff Role', value: `**${currentRole}**`, inline: true },
            { name: '📅 Date Joined Staff', value: dbInfo.join_date || 'Unknown', inline: true },
            { name: '🎟️ Tickets Handled', value: `\`${dbInfo.tickets_handled}\``, inline: true },
            { name: '💰 Sales Logged', value: `\`${dbInfo.sales_count}\``, inline: true },
            { name: '📈 Total Earnings', value: `**$${dbInfo.total_earnings.toFixed(2)}**`, inline: true }
          )
          .setFooter({ text: 'Pavo Tweak Staff Registry' })
          .setTimestamp();

        await interaction.editReply({ embeds: [infoEmbed] });
      } catch (err) {
        console.error('Error fetching staff info:', err);
        await interaction.reply({ content: `❌ Error fetching staff profile: ${err.message}`, ephemeral: true });
      }
    }

    // ==========================================
    // 3. STAFF PROMOTE & DEMOTE
    // ==========================================
    else if (subcommand === 'promote' || subcommand === 'demote') {
      const targetUser = interaction.options.getUser('user');
      const targetRoleName = interaction.options.getString('role');

      // Check if command executor is authorized management
      const executorMember = interaction.member;
      const executorRoleName = getStaffRoleName(executorMember);

      if (!isManagement(executorMember)) {
        return interaction.reply({ content: '❌ Only authorized management staff can use promote/demote commands.', ephemeral: true });
      }

      await interaction.deferReply();

      try {
        const targetMember = await guild.members.fetch(targetUser.id);
        const targetCurrentRole = getStaffRoleName(targetMember);

        // Fetch hierarchy ranks (smaller index = higher rank)
        const executorRank = config.staffHierarchy.indexOf(executorRoleName);
        const targetCurrentRank = targetCurrentRole ? config.staffHierarchy.indexOf(targetCurrentRole) : Infinity;
        const proposedRank = config.staffHierarchy.indexOf(targetRoleName);

        // Verification checks
        if (targetUser.id === interaction.user.id) {
          return interaction.editReply({ content: '❌ You cannot promote or demote yourself.' });
        }

        // Executor must be higher rank than target's current rank
        if (executorRank >= targetCurrentRank) {
          return interaction.editReply({ content: `❌ You cannot modify roles for <@${targetUser.id}> because they have a rank (${targetCurrentRole || 'None'}) equal or superior to yours (${executorRoleName}).` });
        }

        // Executor must be higher rank than target's proposed rank
        if (executorRank >= proposedRank) {
          return interaction.editReply({ content: `❌ You cannot assign the role **${targetRoleName}** because it is equal or superior to your own rank (**${executorRoleName}**).` });
        }

        if (subcommand === 'promote') {
          // If promoting, the target's current rank (if any) must be strictly lower than the proposed rank
          if (targetCurrentRank !== Infinity && targetCurrentRank <= proposedRank) {
            return interaction.editReply({ content: `❌ Promotion failed: The proposed role **${targetRoleName}** is lower than or equal to their current role **${targetCurrentRole}**. Use \`/staff demote\` instead.` });
          }
        } else {
          // If demoting, the target's current rank must be strictly higher than the proposed rank
          if (targetCurrentRank === Infinity || targetCurrentRank >= proposedRank) {
            return interaction.editReply({ content: `❌ Demotion failed: The proposed role **${targetRoleName}** is higher than or equal to their current role **${targetCurrentRole || 'None'}**. Use \`/staff promote\` instead.` });
          }
        }

        // Physical Role Changes on Discord
        const targetRoleId = config.staffRoles[targetRoleName];
        if (!targetRoleId || !targetRoleId.match(/^\d+$/)) {
          return interaction.editReply({ content: `❌ Role ID for **${targetRoleName}** is not configured or invalid in ` + '`config.json`.' });
        }

        // Remove all current staff roles from target
        for (const [name, id] of Object.entries(config.staffRoles)) {
          if (id && id.match(/^\d+$/) && targetMember.roles.cache.has(id)) {
            await targetMember.roles.remove(id);
          }
        }

        // Add new role
        await targetMember.roles.add(targetRoleId);

        // Update database
        await db.ensureStaffExists(targetUser.id, targetUser.username);
        
        const actionEmbed = new EmbedBuilder()
          .setTitle(subcommand === 'promote' ? '📈 Staff Member Promoted' : '📉 Staff Member Demoted')
          .setDescription(`Successfully updated staff role for <@${targetUser.id}>.`)
          .setColor(subcommand === 'promote' ? '#22c55e' : '#ef4444')
          .addFields(
            { name: '👤 Staff Member', value: `<@${targetUser.id}> (${targetUser.username})`, inline: true },
            { name: '🛡️ Old Role', value: targetCurrentRole || 'None / New Staff', inline: true },
            { name: '🏆 New Role', value: `**${targetRoleName}**`, inline: true },
            { name: '✍️ Authorized By', value: `<@${interaction.user.id}> (${executorRoleName})`, inline: false }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [actionEmbed] });

        // Log this action to the staff log
        const logChannelId = config.ticketLogChannelId;
        const logChannel = guild.channels.cache.get(logChannelId) || await guild.channels.fetch(logChannelId).catch(() => null);
        if (logChannel) {
          await logChannel.send({ embeds: [actionEmbed] });
        }

      } catch (err) {
        console.error(`Error during ${subcommand}:`, err);
        await interaction.editReply({ content: `❌ Role update failed: ${err.message}. Make sure the bot's role is positioned ABOVE the staff roles in the Server settings!` });
      }
    }
  }
};
