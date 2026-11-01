const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const config = require('./config.json');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  try {
    const command = require(filePath);
    if (command.data && typeof command.data.toJSON === 'function') {
      commands.push(command.data.toJSON());
      console.log(`[Deploy] Caricato comando: /${command.data.name}`);
    } else if (command.commands && Array.isArray(command.commands)) {
      for (const sub of command.commands) {
        if (sub.data && typeof sub.data.toJSON === 'function') {
          commands.push(sub.data.toJSON());
          console.log(`[Deploy] Caricato sotto-comando: /${sub.data.name}`);
        }
      }
    }
  } catch (err) {
    console.warn(`[Deploy] Impossibile caricare comando da ${file}:`, err.message);
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function deploy() {
  try {
    console.log(`\n🔄 Registrazione di ${commands.length} comandi slash per Pavo Bot...`);
    const clientId = process.env.DISCORD_CLIENT_ID || '1543201517279117413';
    
    if (config.guildId && config.guildId !== 'YOUR_GUILD_ID' && config.guildId.match(/^\d+$/)) {
      console.log(`📡 Registrazione comandi nel server (Guild ID: ${config.guildId})...`);
      const data = await rest.put(
        Routes.applicationGuildCommands(clientId, config.guildId),
        { body: commands }
      );
      console.log(`✅ Registrati con successo ${data.length} comandi slash per il server!`);
    }

    console.log(`📡 Registrazione comandi globale...`);
    const globalData = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    console.log(`✅ Registrati con successo ${globalData.length} comandi slash globalmente!`);
  } catch (error) {
    console.error('❌ Errore durante la registrazione dei comandi slash:', error);
  }
}

deploy();
