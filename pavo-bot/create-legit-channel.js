require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
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
    const guildId = config.guildId || '1532173407158800464';
    const targetRefChannelId = '1532484367090323467'; // vouch channel
    
    const guild = await client.guilds.fetch(guildId);
    if (!guild) {
      console.error(`❌ Guild ${guildId} not found`);
      process.exit(1);
    }

    const refChannel = await guild.channels.fetch(targetRefChannelId).catch(() => null);
    const parentCategory = refChannel ? refChannel.parentId : null;
    const refPosition = refChannel ? refChannel.rawPosition : null;

    console.log(`📍 Reference channel: ${refChannel ? refChannel.name : 'Unknown'} (Category: ${parentCategory}, Pos: ${refPosition})`);

    // Create or find dedicated legit check channel
    let channel = guild.channels.cache.find(c => c.name.includes('legit-check') || c.name.includes('legitcheck'));
    if (!channel) {
      console.log('🔨 Creating new channel #🛡️・legit-check...');
      channel = await guild.channels.create({
        name: '🛡️・legit-check',
        type: ChannelType.GuildText,
        parent: parentCategory,
        position: refPosition !== null ? refPosition + 1 : undefined,
        topic: '🛡️ Pavo Tweak Official Community Trust & Legitimacy Poll'
      });
      console.log(`✅ Created channel #${channel.name} (${channel.id})`);
    } else {
      console.log(`ℹ️ Using existing channel #${channel.name} (${channel.id})`);
    }

    // Position it directly below reference channel
    if (refPosition !== null && channel.parentId === parentCategory) {
      try {
        await channel.setPosition(refPosition + 1);
        console.log(`📌 Positioned #${channel.name} directly below #${refChannel.name}`);
      } catch (e) {
        console.warn('⚠️ Could not set position:', e.message);
      }
    }

    // Update config
    config.legitCheckChannelId = channel.id;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

    // Post / Update the legit check poll inside this new channel
    const sent = await legitCheck.sendOrUpdateLegitCheck(client, config);
    if (sent) {
      console.log(`🎉 Legit check poll posted and pinned in #${channel.name} (${channel.id})!`);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating legit check channel:', err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
