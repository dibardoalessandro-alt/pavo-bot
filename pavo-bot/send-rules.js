require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

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

client.once('ready', async () => {
  console.log(`Bot online come ${client.user.tag}`);

  try {
    // Cerca il canale per nome o tramite ID da riga di comando
    const channelIdArg = process.argv[2];
    let channel = null;

    if (channelIdArg) {
      channel = await client.channels.fetch(channelIdArg).catch(() => null);
    }

    if (!channel) {
      // Cerca tra i canali testuali del server un canale chiamato regole, rules, o welcome
      const guilds = await client.guilds.fetch();
      for (const [_, guildRef] of guilds) {
        const guild = await guildRef.fetch();
        const channels = await guild.channels.fetch();
        channel = channels.find(c => 
          c && c.isTextBased() && (
            c.name.toLowerCase().includes('regol') || 
            c.name.toLowerCase().includes('rule')
          )
        );
        if (channel) break;
      }
    }

    if (!channel) {
      console.error('❌ Canale "regole" / "rules" non trovato automaticamente. Esegui lo script specificando l\'ID del canale: node send-rules.js <CHANNEL_ID>');
      process.exit(1);
    }

    console.log(`Trovato canale: #${channel.name} (${channel.id}) nel server "${channel.guild?.name}"`);

    // Costruisce l'embed con le regole in EN e IT
    const embedEN = new EmbedBuilder()
      .setTitle('📜 SERVER RULES 🇺🇸')
      .setDescription(englishRules)
      .setColor(0x3498DB)
      .setTimestamp();

    const embedIT = new EmbedBuilder()
      .setTitle('📜 REGOLAMENTO DEL SERVER 🇮🇹')
      .setDescription(italianRules)
      .setColor(0x2ECC71)
      .setFooter({ text: 'Rispetta le regole per evitare sanzioni / Follow the rules' })
      .setTimestamp();

    await channel.send({
      embeds: [embedEN, embedIT]
    });

    console.log(`✅ Regole inviate con successo nel canale #${channel.name}!`);
    process.exit(0);
  } catch (error) {
    console.error('Errore durante l\'invio delle regole:', error);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
