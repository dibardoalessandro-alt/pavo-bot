require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  try {
    const guildId = config.guildId || '1532173407158800464';
    const targetRefChannelId = '1532484367090323467';
    
    const guild = await client.guilds.fetch(guildId);
    if (!guild) {
      console.error(`❌ Guild ${guildId} not found`);
      process.exit(1);
    }
    console.log(`🏰 Connected to guild: ${guild.name}`);

    // Fetch reference channel
    const refChannel = await guild.channels.fetch(targetRefChannelId).catch(() => null);
    const parentCategory = refChannel ? refChannel.parentId : null;
    const refPosition = refChannel ? refChannel.rawPosition : null;

    console.log(`📍 Reference channel: ${refChannel ? refChannel.name : 'Unknown'} (Category: ${parentCategory}, Pos: ${refPosition})`);

    // Check if channel already exists
    let channel = null;
    if (config.pavoCommandChannelId && config.pavoCommandChannelId.match(/^\d+$/)) {
      channel = await guild.channels.fetch(config.pavoCommandChannelId).catch(() => null);
    }

    if (!channel) {
      // Find by name or create
      const existing = guild.channels.cache.find(c => c.name === 'pavo-access' || c.name === 'pavotweak-access');
      if (existing) {
        channel = existing;
        console.log(`ℹ️ Found existing channel: #${channel.name} (${channel.id})`);
      } else {
        console.log('🔨 Creating new channel #pavotweak-access...');
        channel = await guild.channels.create({
          name: '🚀・pavotweak-access',
          type: ChannelType.GuildText,
          parent: parentCategory,
          position: refPosition !== null ? refPosition + 1 : undefined,
          topic: '💎 Exclusive PavoTweak Access Channel | Requires 2 Server Boosts | Clean Command Channel'
        });
        console.log(`✅ Created channel #${channel.name} (${channel.id})`);
      }
    }

    // Move channel immediately below ref channel if needed
    if (refPosition !== null && channel.parentId === parentCategory) {
      try {
        await channel.setPosition(refPosition + 1);
        console.log(`📌 Positioned #${channel.name} directly below reference channel.`);
      } catch (posErr) {
        console.warn('⚠️ Could not set position:', posErr.message);
      }
    }

    // Save channel ID to config.json
    config.pavoCommandChannelId = channel.id;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log(`💾 Updated config.json with pavoCommandChannelId: ${channel.id}`);

    // Create the Rich Promotional & Command Embed (NO € PRICE, 2 BOOSTS REQUIREMENT)
    const promoEmbed = new EmbedBuilder()
      .setColor('#6366f1') // Indigo / Cyber Neon
      .setTitle('💎 PAVOTWEAK WINDOWS PERFORMANCE SUITE')
      .setDescription(
        `**Unlock the most powerful, professional Windows & Gaming optimization suite.**\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `### 🚀 ACCESS REQUIREMENT: 2 SERVER BOOSTS\n` +
        `PavoTweak is an **exclusive tier tool** unlocked entirely through Discord Server Boosts.\n` +
        `**No monetary payment required.** Simply boost this server **2 times** to obtain full access!\n\n` +
        `### ⚡ WHAT YOU GET WITH PAVOTWEAK:\n` +
        `• **FPS Booster:** MMCSS GPU prioritization & low-latency scheduling\n` +
        `• **Windows Optimization:** Telemetry strip, RAM Working Set cleanup, Prefetch tune\n` +
        `• **FiveM & Fortnite Optimizer:** Shader cache cleaner, config tuner, direct input tweaks\n` +
        `• **Network Latency Reducer:** TCP NoDelay, DNS flush, packet pacing tune\n` +
        `• **Full Backup & Restore Engine:** 1-click restore for 100% peace of mind\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `### 🔑 HOW TO GET STARTED:\n` +
        `1️⃣ **Boost this Discord Server 2 Times** 🚀\n` +
        `2️⃣ Once boosted, use the slash command below:\n` +
        `   \`\`\`/pavo-access\`\`\`\n` +
        `3️⃣ The bot will issue your unique **5-minute single-use auth code**.\n` +
        `4️⃣ Paste the code into the **PavoTweak CLI** and enjoy instant performance!\n\n` +
        `⚠️ *Note: If server boosts drop below 2, PavoTweak CLI access will be automatically revoked.*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .addFields(
        { name: '🤖 Allowed Commands', value: '`/pavo-access` — Generate CLI auth code\n`/pavo-status` — Check boost eligibility\n`/pavo-help` — View perks & guide', inline: false },
        { name: '🧹 Channel Rule', value: 'This is a **clean command channel**. Non-command messages and chat will be automatically removed by the bot.', inline: false }
      )
      .setFooter({ text: '🚀 BOOST THE SERVER 2X TO GET PAVOTWEAK · Pavo Tweak Suite', iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    // Send the promo embed to the channel
    const msg = await channel.send({ embeds: [promoEmbed] });
    console.log(`📢 Sent promotional embed (Message ID: ${msg.id}) in #${channel.name}`);

    console.log('🎉 Setup completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during channel setup:', err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
