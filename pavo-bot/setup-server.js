require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  ChannelType, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');
let config = require('./config.json');

const fullServerSchema = {
  roles: [
    { name: '👑 Owner', color: '#FFD700', hoist: true, permissions: ['Administrator'] },
    { name: '🛡️ Co Owner', color: '#E74C3C', hoist: true, permissions: ['Administrator'] },
    { name: '👮 Head Moderator', color: '#E67E22', hoist: true, permissions: ['Administrator'] },
    { name: '👮 Moderator', color: '#3498DB', hoist: true, permissions: ['ManageMessages', 'KickMembers', 'BanMembers', 'MuteMembers', 'DeafenMembers', 'ModerateMembers'] },
    { name: '🔰 Trial Moderator', color: '#1ABC9C', hoist: true, permissions: ['ManageMessages', 'KickMembers', 'ModerateMembers'] },
    { name: '🛠️ Support', color: '#2ECC71', hoist: true, permissions: ['ManageMessages'] },
    { name: '🏆 Pro Player', color: '#F39C12', hoist: true, permissions: [] },
    { name: '🔥 Elite Player', color: '#D35400', hoist: true, permissions: [] },
    { name: '🎬 Clipper', color: '#9B59B6', hoist: true, permissions: [] },
    { name: '🎥 Content Creator', color: '#E91E63', hoist: true, permissions: [] },
    { name: '💰 Trader', color: '#27AE60', hoist: true, permissions: [] },
    { name: '⚔️ 1v1 Player', color: '#C0392B', hoist: true, permissions: [] },
    { name: '🎮 Xbox Player', color: '#107C10', hoist: false, permissions: [] },
    { name: '🎮 PlayStation Player', color: '#003791', hoist: false, permissions: [] },
    { name: '💞 VIP / Booster', color: '#FF73FA', hoist: true, permissions: [] },
    { name: '🎮 Blockspin Player', color: '#8E44AD', hoist: true, permissions: [] },
    { name: '👤 Member', color: '#2ECC71', hoist: false, permissions: [] },
    { name: '🔇 Muted', color: '#7F8C8D', hoist: false, permissions: [] }
  ],
  categories: [
    {
      name: '📌 ━━━ INFORMATION ━━━',
      channels: [
        { name: '📜│regole-rules', type: 'GUILD_TEXT', readOnly: true, isRules: true },
        { name: '📢│annunci-announcements', type: 'GUILD_TEXT', readOnly: true },
        { name: '👋│welcome', type: 'GUILD_TEXT', readOnly: true, isWelcome: true },
        { name: '🎁│giveaways', type: 'GUILD_TEXT', readOnly: false, isGiveaways: true }
      ]
    },
    {
      name: '💬 ━━━ COMMUNITY ━━━',
      channels: [
        { name: '💬│chat-generale', type: 'GUILD_TEXT' },
        { name: '🔞│media-18plus', type: 'GUILD_TEXT', nsfw: true },
        { name: '📷│immagini-clip', type: 'GUILD_TEXT' },
        { name: '🤖│comandi-bot', type: 'GUILD_TEXT' }
      ]
    },
    {
      name: '🎮 ━━━ BLOCKSPIN & GAMING ━━━',
      channels: [
        { name: '🏆│blockspin-1v1', type: 'GUILD_TEXT' },
        { name: '🔄│trading-scambi', type: 'GUILD_TEXT' },
        { name: '🎮│gaming-chat', type: 'GUILD_TEXT' },
        { name: '🎬│clips', type: 'GUILD_TEXT' },
        { name: '🏆│highlights', type: 'GUILD_TEXT' }
      ]
    },
    {
      name: '🎰 ━━━ GAMBLING ━━━',
      channels: [
        { name: '🎲│gambling', type: 'GUILD_TEXT' },
        { name: '🏆│game-results', type: 'GUILD_TEXT', readOnly: true, isGameResults: true },
        { name: '📊│game-stats', type: 'GUILD_TEXT' }
      ]
    },
    {
      name: '🎫 ━━━ SUPPORT ━━━',
      isTicketCategory: true,
      channels: [
        { name: '🎫│tickets', type: 'GUILD_TEXT', readOnly: true, isTicketsPanel: true }
      ]
    },
    {
      name: '🔊 ━━━ VOICE CHANNELS ━━━',
      channels: [
        { name: '🔊│Lobby 1', type: 'GUILD_VOICE' },
        { name: '🔊│Lobby 2', type: 'GUILD_VOICE' },
        { name: '🎮│Blockspin 1v1', type: 'GUILD_VOICE' },
        { name: '👥│Salotto Squad', type: 'GUILD_VOICE' }
      ]
    },
    {
      name: '🛡️ ━━━ STAFF ONLY ━━━',
      staffOnly: true,
      channels: [
        { name: '🔒│staff-chat', type: 'GUILD_TEXT', isStaffChat: true },
        { name: '🔒│staff-logs', type: 'GUILD_TEXT', isStaffLogs: true },
        { name: '🔒│bot-logs', type: 'GUILD_TEXT', isBotLogs: true },
        { name: '🔒│ticket-logs', type: 'GUILD_TEXT', isTicketLogs: true },
        { name: '🔒│Staff Room', type: 'GUILD_VOICE' }
      ]
    }
  ]
};

const englishRules = 
`**WE HAVE 10 STRAIGHT RULES:**
1. U can insult and do whatever u want
2. U can send GIF and images 18+
3. No cheating
4. No raiding
5. Can’t abuse of ur role
6. If u are off for too much u have to warn someone
7. Don’t ask many times for admin
8. Can invite ur friends but u have to warn someone
9. Can’t scam in trading or 1v1
10. Do what the fuck u want we don’t really give a fuck but respect the 9 rules`;

const italianRules = 
`**ABBIAMO 10 REGOLE PRECISE:**
1. Puoi insultare e fare quello che vuoi
2. Puoi inviare GIF e immagini 18+
3. Non cheattare
4. Vietato fare incursioni
5. Non puoi abusare del tuo ruolo
6. Se ti assenti per troppo tempo devi avvisare qualcuno
7. Non chiedere spesso i privilegi di amministratore
8. Puoi invitare i tuoi amici, ma devi avvisare qualcuno (solo se gioca a blockspin)
9. Non è possibile truffare nel trading o negli 1v1
10. Fai il cazzo che ti pare non ce ne frega un cazzo ma rispetta le 9 regole`;

async function runFullServerSetup(guild) {
  console.log(`\n======================================================`);
  console.log(`🏰 AVVIO SETUP SERVER COMPLETO PAVO BOT`);
  console.log(`Server: "${guild.name}" (${guild.id})`);
  console.log(`======================================================\n`);

  const createdRoles = {};
  const channelMap = {};

  // 1. CREAZIONE RUOLI
  console.log('📌 [1/4] Creazione & Verifica Ruoli...');
  for (const rDef of fullServerSchema.roles) {
    let role = guild.roles.cache.find(r => r.name.toLowerCase() === rDef.name.toLowerCase());
    if (!role) {
      const perms = (rDef.permissions || []).map(p => PermissionFlagsBits[p]).filter(Boolean);
      role = await guild.roles.create({
        name: rDef.name,
        color: rDef.color,
        hoist: rDef.hoist || false,
        permissions: perms,
        reason: 'Pavo Bot Server Auto-Setup'
      });
      console.log(`  ➕ Creato ruolo: ${role.name}`);
    } else {
      console.log(`  ✔️ Ruolo esistente: ${role.name}`);
    }
    createdRoles[rDef.name] = role;
  }

  const staffRoles = [
    createdRoles['👑 Owner'],
    createdRoles['🛡️ Co Owner'],
    createdRoles['👮 Head Moderator'],
    createdRoles['👮 Moderator'],
    createdRoles['🛠️ Support']
  ].filter(Boolean);

  const memberRole = createdRoles['👤 Member'];

  // 2. CREAZIONE CATEGORIE E CANALI
  console.log('\n📌 [2/4] Creazione Categorie e Canali...');
  let rulesChannel = null;
  let ticketsPanelChannel = null;
  let ticketCategoryId = null;

  for (const catDef of fullServerSchema.categories) {
    let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === catDef.name);

    const permissionOverwrites = [];

    if (catDef.staffOnly) {
      permissionOverwrites.push({
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      });
      for (const sr of staffRoles) {
        permissionOverwrites.push({
          id: sr.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect]
        });
      }
    }

    if (!category) {
      category = await guild.channels.create({
        name: catDef.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: permissionOverwrites.length > 0 ? permissionOverwrites : undefined
      });
      console.log(`  📂 Creata categoria: ${category.name}`);
    } else {
      console.log(`  📁 Categoria esistente: ${category.name}`);
    }

    if (catDef.isTicketCategory) {
      ticketCategoryId = category.id;
    }

    for (const chDef of catDef.channels) {
      const isVoice = chDef.type === 'GUILD_VOICE';
      const cType = isVoice ? ChannelType.GuildVoice : ChannelType.GuildText;

      let channel = guild.channels.cache.find(c => c.name === chDef.name && c.parentId === category.id);

      const chOverwrites = [];

      if (chDef.readOnly) {
        chOverwrites.push({
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
        });
      }

      if (!channel) {
        channel = await guild.channels.create({
          name: chDef.name,
          type: cType,
          parent: category.id,
          nsfw: chDef.nsfw || false,
          permissionOverwrites: chOverwrites.length > 0 ? chOverwrites : undefined
        });
        console.log(`    💬 Creato canale: ${channel.name}`);
      } else {
        console.log(`    ✔️ Canale esistente: ${channel.name}`);
      }

      if (chDef.isRules) rulesChannel = channel;
      if (chDef.isTicketsPanel) ticketsPanelChannel = channel;
      if (chDef.isStaffLogs) channelMap.staffLogChannelId = channel.id;
      if (chDef.isBotLogs) channelMap.botLogChannelId = channel.id;
      if (chDef.isTicketLogs) channelMap.ticketLogChannelId = channel.id;
      if (chDef.isGameResults) channelMap.gameResultsChannelId = channel.id;
      if (chDef.isWelcome) channelMap.welcomeChannelId = channel.id;
    }
  }

  // 3. INVIO REGOLAMENTO CON BOTTONE
  if (rulesChannel) {
    console.log(`\n📌 [3/4] Pubblicazione Regolamento Bilingue in #${rulesChannel.name}...`);
    const existing = await rulesChannel.messages.fetch({ limit: 10 }).catch(() => null);
    if (existing && existing.size > 0) {
      await rulesChannel.bulkDelete(existing).catch(() => {});
    }

    const embedBanner = new EmbedBuilder()
      .setTitle('🌟 PAVO SERVER RULES / REGOLAMENTO 🌟')
      .setDescription('Benvenuto! Leggi attentamente le regole e clicca sul pulsante sottostante per accedere a tutti i canali del server.\nPlease read the rules below and click the button to verify.')
      .setColor(0xF1C40F);

    const embedEN = new EmbedBuilder()
      .setTitle('📜 SERVER RULES 🇺🇸')
      .setDescription(englishRules)
      .setColor(0x3498DB);

    const embedIT = new EmbedBuilder()
      .setTitle('📜 REGOLAMENTO DEL SERVER 🇮🇹')
      .setDescription(italianRules)
      .setColor(0x2ECC71)
      .setFooter({ text: 'Clicca su "Accetta Regole / Accept Rules" per sbloccare il server!' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_accept_rules')
        .setLabel('Accetta Regole / Accept Rules')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅')
    );

    await rulesChannel.send({ embeds: [embedBanner, embedEN, embedIT], components: [row] });
    console.log('  ✅ Regolamento pubblicato con successo!');
  }

  // 4. INVIO PANNELLO TICKET NEL CANALE TICKETS
  if (ticketsPanelChannel) {
    console.log(`\n📌 [4/4] Invio Pannello Supporto Ticket in #${ticketsPanelChannel.name}...`);
    const existingTickets = await ticketsPanelChannel.messages.fetch({ limit: 10 }).catch(() => null);
    if (existingTickets && existingTickets.size > 0) {
      await ticketsPanelChannel.bulkDelete(existingTickets).catch(() => {});
    }

    const ticketPanelEmbed = new EmbedBuilder()
      .setTitle('🎫 PAVO SUPPORT — APRI UN TICKET')
      .setDescription(
        '**Hai bisogno di aiuto o vuoi richiedere assistenza/servizi?**\n\n' +
        'Seleziona il tipo di richiesta dal menu a tendina qui sotto:\n' +
        '• 🛠️ **General Support** — Domande generali\n' +
        '• 🎮 **BlockSpin Support** — Assistenza su BlockSpin / Visuals\n' +
        '• 💰 **Trading Issue** — Problemi di scambio e trading\n' +
        '• ⚔️ **1v1 Issue** — Contestazioni match 1v1\n' +
        '• 🔑 **Key / License** — Riscatto e problemi codici licenza\n' +
        '• 🚨 **Report** — Segnalazioni comportamenti scorretti\n' +
        '• ⚡ **Pavo Tweak** — Ottimizzazione PC / FPS Tweak\n' +
        '• 💡 **Other** — Altro tipo di assistenza\n\n' +
        'Un membro ufficiale dello staff risponderà al più presto nel tuo canale privato dedicato.'
      )
      .setColor(0x5865F2)
      .setFooter({ text: 'Pavo Tweak & BlockSpin Support' })
      .setTimestamp();

    const ticketSelectMenu = new StringSelectMenuBuilder()
      .setCustomId('ticket_select_product')
      .setPlaceholder('Seleziona la categoria del tuo ticket...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('General Support').setValue('general_support').setDescription('Supporto generale').setEmoji('🛠️'),
        new StringSelectMenuOptionBuilder().setLabel('BlockSpin Support').setValue('blockspin_support').setDescription('Supporto BlockSpin').setEmoji('🎮'),
        new StringSelectMenuOptionBuilder().setLabel('Trading Issue').setValue('trading_issue').setDescription('Problemi trading').setEmoji('💰'),
        new StringSelectMenuOptionBuilder().setLabel('1v1 Issue').setValue('1v1_issue').setDescription('Problemi match 1v1').setEmoji('⚔️'),
        new StringSelectMenuOptionBuilder().setLabel('Key / License').setValue('key_license').setDescription('Licenze e codici').setEmoji('🔑'),
        new StringSelectMenuOptionBuilder().setLabel('Report').setValue('report_issue').setDescription('Segnalazione').setEmoji('🚨'),
        new StringSelectMenuOptionBuilder().setLabel('Pavo Tweak').setValue('pavo_tweak').setDescription('PC Optimizer').setEmoji('⚡'),
        new StringSelectMenuOptionBuilder().setLabel('Other').setValue('other_support').setDescription('Altro supporto').setEmoji('💡')
      );

    const tRow = new ActionRowBuilder().addComponents(ticketSelectMenu);

    await ticketsPanelChannel.send({ embeds: [ticketPanelEmbed], components: [tRow] });
    console.log('  ✅ Pannello Ticket pubblicato con successo!');
  }

  // 5. AGGIORNAMENTO CONFIG.JSON
  config.guildId = guild.id;
  if (ticketCategoryId) config.ticketCategoryId = ticketCategoryId;
  if (channelMap.staffLogChannelId) config.staffLogChannelId = channelMap.staffLogChannelId;
  if (channelMap.botLogChannelId) config.botLogChannelId = channelMap.botLogChannelId;
  if (channelMap.ticketLogChannelId) config.ticketLogChannelId = channelMap.ticketLogChannelId;
  if (channelMap.gameResultsChannelId) config.gameResultsChannelId = channelMap.gameResultsChannelId;
  if (channelMap.welcomeChannelId) config.welcomeChannelId = channelMap.welcomeChannelId;
  if (memberRole) config.memberRoleId = memberRole.id;

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  console.log('\n💾 Config.json aggiornato con successo!');

  console.log('\n======================================================');
  console.log('🎉 SETUP DEL SERVER PAVO BOT COMPLETATO AL 100%!');
  console.log('======================================================\n');
}

if (require.main === module) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once('ready', async () => {
    const targetGuildId = process.argv[2] || config.guildId;
    let guild = null;
    if (targetGuildId) guild = await client.guilds.fetch(targetGuildId).catch(() => null);
    if (!guild) guild = client.guilds.cache.first();

    if (!guild) {
      console.error('❌ Server non trovato!');
      process.exit(1);
    }

    await runFullServerSetup(guild);
    process.exit(0);
  });

  client.login(process.env.DISCORD_TOKEN);
}

module.exports = { runFullServerSetup };
