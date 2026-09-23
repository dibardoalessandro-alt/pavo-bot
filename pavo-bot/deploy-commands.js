const { REST, Routes } = require('discord.js');
require('dotenv').config();
const config = require('./config.json');

const ticketCmd = require('./commands/ticket');
const staffCmd = require('./commands/staff');
const salesCmd = require('./commands/sales');
const paymentCmd = require('./commands/payment');
const giveawayCmd = require('./commands/giveaway');
const oauthCmd = require('./commands/oauth');
const licenseCmd = require('./commands/license');
const earningsCmd = require('./commands/earnings');

const commands = [
  ticketCmd.data.toJSON(),
  staffCmd.data.toJSON(),
  salesCmd.data.toJSON(),
  paymentCmd.data.toJSON(),
  giveawayCmd.data.toJSON(),
  oauthCmd.data.toJSON(),
  licenseCmd.data.toJSON()
];

if (earningsCmd.commands) {
  for (const cmd of earningsCmd.commands) {
    commands.push(cmd.data.toJSON());
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function deploy() {
  try {
    console.log(`🔄 Refreshing ${commands.length} application (/) commands...`);

    // Fetch client ID if not in env
    const clientId = process.env.DISCORD_CLIENT_ID || '1543201517279117413';
    
    if (config.guildId) {
      console.log(`📡 Deploying commands to Guild: ${config.guildId}...`);
      const data = await rest.put(
        Routes.applicationGuildCommands(clientId, config.guildId),
        { body: commands }
      );
      console.log(`✅ Successfully registered ${data.length} commands to Guild ${config.guildId}!`);
    }

    console.log(`📡 Deploying commands Globally...`);
    const globalData = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    console.log(`✅ Successfully registered ${globalData.length} global commands!`);

  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
}

deploy();
