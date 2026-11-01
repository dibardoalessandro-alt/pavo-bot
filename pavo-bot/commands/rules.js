const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Invia il regolamento del server in lingua Inglese e Italiana')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
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
5. Non puoi abusare del tuo ruolo.
6. Se ti assenti per troppo tempo devi avvisare qualcuno
7. Non chiedere spesso i privilegi di amministratore
8. Puoi invitare i tuoi amici, ma devi avvisare qualcuno (solo se gioca a blockspin)
9. Non è possibile truffare nel trading o negli 1v1
10. Fai il cazzo che ti pare non ce ne frega un cazzo ma rispetta le 9 regole`;

    const embedEN = new EmbedBuilder()
      .setTitle('📜 SERVER RULES 🇺🇸')
      .setDescription(englishRules)
      .setColor(0x3498DB);

    const embedIT = new EmbedBuilder()
      .setTitle('📜 REGOLAMENTO DEL SERVER 🇮🇹')
      .setDescription(italianRules)
      .setColor(0x2ECC71)
      .setFooter({ text: 'Rispetta le regole / Follow the rules' })
      .setTimestamp();

    await interaction.reply({ embeds: [embedEN, embedIT] });
  }
};
