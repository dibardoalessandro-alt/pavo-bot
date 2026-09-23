require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  const guild = client.guilds.cache.first();
  if (!guild) { console.log('No guilds found'); process.exit(0); }
  
  console.log(`\nGuild: ${guild.name} (${guild.id})\n`);
  
  const channels = await guild.channels.fetch();
  const textChannels = channels.filter(c => c && c.type === 0);
  
  console.log(`Found ${textChannels.size} text channels:\n`);
  textChannels.forEach(c => {
    const nameMatch = c.name.includes('pavo') || c.name.includes('tweak') || c.name.includes('cli');
    const marker = nameMatch ? ' <<<< MATCH' : '';
    console.log(`  ID: ${c.id} | Name: "${c.name}" | Parent: ${c.parentId || 'none'}${marker}`);
  });
  
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
