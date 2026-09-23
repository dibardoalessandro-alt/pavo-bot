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
  console.error("Could not load config in earnings.js:", e);
}

const roleChoices = config.staffRoles 
  ? Object.keys(config.staffRoles).map(name => ({ name: name, value: name }))
  : [];

module.exports = {
  // Command structures
  // Since we have `/earnings` and `/setpercentage` as separate commands,
  // we can export multiple command structures, but to make command registering easy in index.js,
  // we can bundle `/earnings` here and register both.
  // We will define an array of commands in index.js, and this module will export multiple command entries.
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('earnings')
        .setDescription('View commission earnings details')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The staff member whose earnings you want to view')
            .setRequired(false)
        ),
      async execute(interaction, config) {
        const guild = interaction.guild;
        if (!guild) {
          return interaction.reply({ content: '❌ This command can only be used inside a Discord server.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('user') || interaction.user;
        await interaction.deferReply();

        try {
          const targetMember = await guild.members.fetch(targetUser.id);
          
          // Helper to find staff role name
          let currentRole = null;
          for (const roleName of config.staffHierarchy) {
            const roleId = config.staffRoles[roleName];
            if (roleId && targetMember.roles.cache.has(roleId)) {
              currentRole = roleName;
              break;
            }
          }

          if (!currentRole) {
            return interaction.editReply({ content: `❌ <@${targetUser.id}> is not recognized as a staff member.` });
          }

          // Get stats from database
          let dbInfo = await db.getStaffInfo(targetUser.id);
          if (!dbInfo) {
            await db.ensureStaffExists(targetUser.id, targetUser.username);
            dbInfo = await db.getStaffInfo(targetUser.id);
          }

          // Get current commission percentage
          const currentPercentage = await db.getRoleCommissionPercentage(currentRole, config.defaultCommissionPercentages);

          const earningsEmbed = new EmbedBuilder()
            .setTitle(`💰 Commission Earnings: ${targetUser.username}`)
            .setColor(config.embedColor || '#4f46e5')
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }) || null)
            .addFields(
              { name: '👤 Staff Member', value: `<@${targetUser.id}>`, inline: true },
              { name: '🛡️ Role', value: `**${currentRole}**`, inline: true },
              { name: '📈 Current Rate', value: `\`${currentPercentage}%\` commission`, inline: true },
              { name: '📊 Total Sales Recorded', value: `\`${dbInfo.sales_count}\``, inline: true },
              { name: '💸 Cumulative Commission Earnings', value: `**$${dbInfo.total_earnings.toFixed(2)}**`, inline: true }
            )
            .setFooter({ text: 'Pavo Tweak Commissions Ledger' })
            .setTimestamp();

          await interaction.editReply({ embeds: [earningsEmbed] });
        } catch (err) {
          console.error('Error fetching earnings:', err);
          await interaction.editReply({ content: `❌ Error fetching commission details: ${err.message}` });
        }
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('setpercentage')
        .setDescription('Update the commission percentage for a staff role')
        .addStringOption(option =>
          option.setName('role')
            .setDescription('The staff role to update')
            .setRequired(true)
            .addChoices(...(roleChoices.length > 0 ? roleChoices : [{ name: 'Placeholder', value: 'Placeholder' }]))
        )
        .addNumberOption(option =>
          option.setName('percentage')
            .setDescription('The new percentage value (e.g. 12.5)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(100)
        ),
      async execute(interaction, config) {
        const guild = interaction.guild;
        if (!guild) {
          return interaction.reply({ content: '❌ This command can only be used inside a Discord server.', ephemeral: true });
        }

        const roleName = interaction.options.getString('role');
        const percentage = interaction.options.getNumber('percentage');

        // Check if command executor is authorized management
        const executorMember = interaction.member;
        
        let executorRoleName = null;
        for (const rName of config.staffHierarchy) {
          const rId = config.staffRoles[rName];
          if (rId && executorMember.roles.cache.has(rId)) {
            executorRoleName = rName;
            break;
          }
        }

        const isManagement = executorRoleName && config.managementRoles.includes(executorRoleName);

        if (!isManagement) {
          return interaction.reply({ content: '❌ Only authorized management staff can modify commission percentages.', ephemeral: true });
        }

        await interaction.deferReply();

        try {
          // Fetch old percentage
          const oldPercentage = await db.getRoleCommissionPercentage(roleName, config.defaultCommissionPercentages);

          // Save new percentage in DB
          await db.setRoleCommissionPercentage(roleName, percentage);

          const changeEmbed = new EmbedBuilder()
            .setTitle('📈 Commission Percentage Updated')
            .setDescription(`Commission rate for role **${roleName}** has been modified.`)
            .setColor('#22c55e')
            .addFields(
              { name: '🛡️ Role Name', value: roleName, inline: true },
              { name: '📉 Old Rate', value: `\`${oldPercentage}%\``, inline: true },
              { name: '📈 New Rate', value: `\`${percentage}%\``, inline: true },
              { name: '✍️ Authorized By', value: `<@${interaction.user.id}> (${executorRoleName})`, inline: false }
            )
            .setTimestamp();

          await interaction.editReply({ embeds: [changeEmbed] });

          // Log in ticket log channel
          const logChannelId = config.ticketLogChannelId;
          const logChannel = guild.channels.cache.get(logChannelId) || await guild.channels.fetch(logChannelId).catch(() => null);
          if (logChannel) {
            await logChannel.send({ embeds: [changeEmbed] });
          }

        } catch (err) {
          console.error('Error changing commission percentage:', err);
          await interaction.editReply({ content: `❌ Database update failed: ${err.message}` });
        }
      }
    }
  ]
};
