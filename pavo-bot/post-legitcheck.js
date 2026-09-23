require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const legitCheck = require('./commands/legitCheck');

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  try {
    const channelId = '1532484367090323467';
    config.legitCheckChannelId = channelId;

    const sent = await legitCheck.sendOrUpdateLegitCheck(client, config);
    if (sent) {
      console.log(`✅ Legit check successfully posted/updated in channel ${channelId} (Message ID: ${sent.id})!`);
    } else {
      console.error('❌ Failed to post legit check.');
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
