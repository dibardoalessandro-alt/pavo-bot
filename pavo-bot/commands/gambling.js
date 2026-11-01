const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle 
} = require('discord.js');
const db = require('../database');
const logger = require('../services/logger');

// Active games store in memory
const activeGames = new Map();

// Helper to log game results
async function finishGameLog(client, config, gameTitle, winnerId, loserId, bet, extraDesc = '') {
  const winnerText = winnerId ? `<@${winnerId}>` : 'Pareggio / Tie';
  logger.logGame(
    client,
    config,
    `🏆 ${gameTitle} Terminato`,
    `**Vincitore:** ${winnerText}\n**Puntata:** ${bet} Pavo Coins\n${extraDesc}`
  );
}

module.exports = {
  activeGames,

  commands: [
    // ============================================
    // 1. /guess <opponent> <rounds> <bet>
    // ============================================
    {
      data: new SlashCommandBuilder()
        .setName('guess')
        .setDescription('Sfida un avversario al gioco dell\'Indovina il Numero (1-50)')
        .addUserOption(opt =>
          opt.setName('avversario')
            .setDescription('L\'utente da sfidare')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('round')
            .setDescription('Numero di round per la partita (1-10)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10)
        )
        .addIntegerOption(opt =>
          opt.setName('puntata')
            .setDescription('Quantità di Pavo Coins scommessi da ciascun giocatore')
            .setRequired(true)
            .setMinValue(10)
        ),

      async execute(interaction, config) {
        const opponent = interaction.options.getUser('avversario');
        const rounds = interaction.options.getInteger('round');
        const bet = interaction.options.getInteger('puntata');
        const host = interaction.user;

        if (opponent.id === host.id) {
          return interaction.reply({ content: '❌ Non puoi sfidare te stesso.', ephemeral: true });
        }
        if (opponent.bot) {
          return interaction.reply({ content: '❌ Non puoi sfidare un bot.', ephemeral: true });
        }

        // Validate balances
        const hostBal = await db.getBalance(host.id);
        const oppBal = await db.getBalance(opponent.id);

        if (hostBal.coins < bet) {
          return interaction.reply({ content: `❌ Non hai abbastanza Pavo Coins! Saldo attuale: **${hostBal.coins} Pavo Coins** (richiesti: **${bet}**).`, ephemeral: true });
        }
        if (oppBal.coins < bet) {
          return interaction.reply({ content: `❌ L'avversario <@${opponent.id}> non ha abbastanza Pavo Coins! Saldo: **${oppBal.coins} Pavo Coins**.`, ephemeral: true });
        }

        const gameId = `guess_${Date.now()}_${host.id}`;

        const embed = new EmbedBuilder()
          .setTitle('🎯 SFIDA GUESS GAME: Indovina il Numero!')
          .setDescription(
            `**${host.username}** ha sfidato **${opponent.username}**!\n\n` +
            `🪙 **Puntata:** \`${bet} Pavo Coins\` a testa (Montepremi: \`${bet * 2} Coins\`)\n` +
            `🔢 **Round Totali:** \`${rounds}\`\n` +
            `🎯 **Regole:** Un numero segreto da **1 a 50** verrà generato ogni round. A turno i giocatori proveranno ad indovinarlo ricevendo indizi (*Più Alto / Più Basso*).`
          )
          .setColor(0xE67E22)
          .setFooter({ text: `${opponent.username}, accetti la sfida?` });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`guess_accept_${gameId}`)
            .setLabel('Accetta Sfida ✅')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`guess_decline_${gameId}`)
            .setLabel('Rifiuta ❌')
            .setStyle(ButtonStyle.Danger)
        );

        activeGames.set(gameId, {
          type: 'guess',
          hostId: host.id,
          opponentId: opponent.id,
          rounds,
          currentRound: 1,
          bet,
          scores: { [host.id]: 0, [opponent.id]: 0 },
          currentTurn: host.id,
          secretNumber: null,
          minGuess: 1,
          maxGuess: 50,
          status: 'PENDING',
          channelId: interaction.channelId
        });

        await interaction.reply({ content: `<@${opponent.id}> sei stato sfidato!`, embeds: [embed], components: [row] });
      }
    },

    // ============================================
    // 2. /dice <opponent> <rounds> <bet>
    // ============================================
    {
      data: new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Sfida un avversario a una partita a dadi (1-6)')
        .addUserOption(opt =>
          opt.setName('avversario')
            .setDescription('L\'utente da sfidare')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('round')
            .setDescription('Numero di round (1-10)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10)
        )
        .addIntegerOption(opt =>
          opt.setName('puntata')
            .setDescription('Quantità di Pavo Coins scommessi da ciascun giocatore')
            .setRequired(true)
            .setMinValue(10)
        ),

      async execute(interaction, config) {
        const opponent = interaction.options.getUser('avversario');
        const rounds = interaction.options.getInteger('round');
        const bet = interaction.options.getInteger('puntata');
        const host = interaction.user;

        if (opponent.id === host.id) {
          return interaction.reply({ content: '❌ Non puoi sfidare te stesso.', ephemeral: true });
        }
        if (opponent.bot) {
          return interaction.reply({ content: '❌ Non puoi sfidare un bot.', ephemeral: true });
        }

        const hostBal = await db.getBalance(host.id);
        const oppBal = await db.getBalance(opponent.id);

        if (hostBal.coins < bet) {
          return interaction.reply({ content: `❌ Non hai abbastanza monete! Saldo: **${hostBal.coins} Pavo Coins**.`, ephemeral: true });
        }
        if (oppBal.coins < bet) {
          return interaction.reply({ content: `❌ L'avversario <@${opponent.id}> non ha abbastanza monete (Saldo: **${oppBal.coins}**).`, ephemeral: true });
        }

        const gameId = `dice_${Date.now()}_${host.id}`;

        const embed = new EmbedBuilder()
          .setTitle('🎲 SFIDA AI DADI (DICE GAME)!')
          .setDescription(
            `**${host.username}** sfida **${opponent.username}** a dadi!\n\n` +
            `🪙 **Puntata:** \`${bet} Pavo Coins\` a testa (Montepremi: \`${bet * 2} Coins\`)\n` +
            `🎯 **Round:** \`${rounds}\`\n` +
            `🎲 A ogni turno ciascun giocatore tira un dado (1-6). Chi fa il numero più alto vince il round!`
          )
          .setColor(0x9B59B6)
          .setFooter({ text: `${opponent.username}, accetti la sfida?` });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`dice_accept_${gameId}`)
            .setLabel('Accetta ✅')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`dice_decline_${gameId}`)
            .setLabel('Rifiuta ❌')
            .setStyle(ButtonStyle.Danger)
        );

        activeGames.set(gameId, {
          type: 'dice',
          hostId: host.id,
          opponentId: opponent.id,
          rounds,
          currentRound: 1,
          bet,
          scores: { [host.id]: 0, [opponent.id]: 0 },
          currentTurn: host.id,
          currentRoundRolls: {},
          status: 'PENDING',
          channelId: interaction.channelId
        });

        await interaction.reply({ content: `<@${opponent.id}> sei stato sfidato a dadi!`, embeds: [embed], components: [row] });
      }
    },

    // ============================================
    // 3. /coinflip <amount> <side>
    // ============================================
    {
      data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Lancia una moneta e raddoppia la tua puntata!')
        .addIntegerOption(opt =>
          opt.setName('quantita')
            .setDescription('Quantità di Pavo Coins da scommettere')
            .setRequired(true)
            .setMinValue(5)
        )
        .addStringOption(opt =>
          opt.setName('lato')
            .setDescription('Scegli Testa o Croce')
            .setRequired(true)
            .addChoices(
              { name: 'Testa 🪙', value: 'heads' },
              { name: 'Croce 🪙', value: 'tails' }
            )
        ),

      async execute(interaction, config) {
        const bet = interaction.options.getInteger('quantita');
        const chosenSide = interaction.options.getString('lato');
        const user = interaction.user;

        const bal = await db.getBalance(user.id);
        if (bal.coins < bet) {
          return interaction.reply({ content: `❌ Saldo insufficiente! Hai **${bal.coins} Pavo Coins**, ne servono **${bet}**.`, ephemeral: true });
        }

        // Deduct bet
        await db.removeBalance(user.id, bet, 'Coinflip bet', 'BET_COINFLIP');

        const outcome = Math.random() < 0.5 ? 'heads' : 'tails';
        const isWin = outcome === chosenSide;
        const sideItalian = outcome === 'heads' ? 'Testa 🪙' : 'Croce 🪙';
        const chosenItalian = chosenSide === 'heads' ? 'Testa 🪙' : 'Croce 🪙';

        let payout = 0;
        if (isWin) {
          payout = bet * 2;
          await db.addBalance(user.id, payout, 'Coinflip win', 'WIN_COINFLIP');
          await db.recordGameResult({
            userId: user.id,
            gameType: 'coinflip',
            outcome: 'WIN',
            betAmount: bet,
            payout
          });
        } else {
          await db.recordGameResult({
            userId: user.id,
            gameType: 'coinflip',
            outcome: 'LOSS',
            betAmount: bet,
            payout: 0
          });
        }

        const newBal = await db.getBalance(user.id);

        const embed = new EmbedBuilder()
          .setTitle(isWin ? '🎉 VITTORIA AL COINFLIP!' : '💀 SCONFITTA AL COINFLIP')
          .setColor(isWin ? 0x00FF88 : 0xE74C3C)
          .setDescription(
            `Hai scelto: **${chosenItalian}**\n` +
            `La moneta ha mostrato: **${sideItalian}**\n\n` +
            (isWin 
              ? `🏆 Congratulazioni! Hai vinto **+${payout.toLocaleString('it-IT')} Pavo Coins**!` 
              : `Hai perso **${bet.toLocaleString('it-IT')} Pavo Coins**... ritenta!`)
          )
          .addFields(
            { name: '💰 Nuovo Saldo', value: `\`${newBal.coins.toLocaleString('it-IT')} Pavo Coins\``, inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }
    },

    // ============================================
    // 4. /slots <amount>
    // ============================================
    {
      data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Tenta la fortuna con la Slot Machine di Pavo!')
        .addIntegerOption(opt =>
          opt.setName('quantita')
            .setDescription('Quantità di Pavo Coins da puntare')
            .setRequired(true)
            .setMinValue(10)
        ),

      async execute(interaction, config) {
        const bet = interaction.options.getInteger('quantita');
        const user = interaction.user;

        const bal = await db.getBalance(user.id);
        if (bal.coins < bet) {
          return interaction.reply({ content: `❌ Saldo insufficiente. Hai solo **${bal.coins} Pavo Coins**.`, ephemeral: true });
        }

        await db.removeBalance(user.id, bet, 'Slots Bet', 'BET_SLOTS');

        const symbols = ['🍒', '🍋', '🍇', '🔔', '💎', '7️⃣'];
        const r1 = symbols[Math.floor(Math.random() * symbols.length)];
        const r2 = symbols[Math.floor(Math.random() * symbols.length)];
        const r3 = symbols[Math.floor(Math.random() * symbols.length)];

        let multiplier = 0;
        let winName = '';

        if (r1 === r2 && r2 === r3) {
          if (r1 === '7️⃣') { multiplier = 10; winName = '🔥 JACKPOT TRIPLO 7 (10x)!'; }
          else if (r1 === '💎') { multiplier = 7; winName = '💎 TRIPLO DIAMANTE (7x)!'; }
          else if (r1 === '🔔') { multiplier = 5; winName = '🔔 TRIPLA CAMPANA (5x)!'; }
          else { multiplier = 4; winName = '🍒 TRIPLA FRUTTA (4x)!'; }
        } else if (r1 === r2 || r2 === r3 || r1 === r3) {
          multiplier = 1.5;
          winName = '✨ DOPPIA COMBINAZIONE (1.5x)!';
        }

        const payout = Math.floor(bet * multiplier);
        const isWin = multiplier > 0;

        if (isWin) {
          await db.addBalance(user.id, payout, 'Slots Win', 'WIN_SLOTS');
          await db.recordGameResult({
            userId: user.id,
            gameType: 'slots',
            outcome: 'WIN',
            betAmount: bet,
            payout
          });
        } else {
          await db.recordGameResult({
            userId: user.id,
            gameType: 'slots',
            outcome: 'LOSS',
            betAmount: bet,
            payout: 0
          });
        }

        const newBal = await db.getBalance(user.id);

        const embed = new EmbedBuilder()
          .setTitle('🎰 SLOT MACHINE PAVO')
          .setColor(isWin ? 0xF1C40F : 0x7F8C8D)
          .setDescription(
            `╭━━━━━━━━━━━━━━━━╮\n` +
            `┃   ${r1}  ┆  ${r2}  ┆  ${r3}   ┃\n` +
            `╰━━━━━━━━━━━━━━━━╯\n\n` +
            (isWin 
              ? `🎉 **${winName}**\nHai vinto **+${payout.toLocaleString('it-IT')} Pavo Coins**!` 
              : `Nessuna combinazione vincente... Hai perso **${bet.toLocaleString('it-IT')} Coins**.`)
          )
          .addFields(
            { name: '💰 Nuovo Saldo', value: `\`${newBal.coins.toLocaleString('it-IT')} Pavo Coins\``, inline: true }
          )
          .setFooter({ text: 'Slot Machine Equa & Casuale' })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }
    },

    // ============================================
    // 5. /highlow <amount>
    // ============================================
    {
      data: new SlashCommandBuilder()
        .setName('highlow')
        .setDescription('Indovina se il prossimo numero segreto sarà Più Alto o Più Basso!')
        .addIntegerOption(opt =>
          opt.setName('quantita')
            .setDescription('Quantità di Pavo Coins da puntare')
            .setRequired(true)
            .setMinValue(10)
        )
        .addStringOption(opt =>
          opt.setName('previsione')
            .setDescription('Scegli Più Alto (High) o Più Basso (Low)')
            .setRequired(true)
            .addChoices(
              { name: '⬆️ Più Alto (High)', value: 'high' },
              { name: '⬇️ Più Basso (Low)', value: 'low' }
            )
        ),

      async execute(interaction, config) {
        const bet = interaction.options.getInteger('quantita');
        const choice = interaction.options.getString('previsione');
        const user = interaction.user;

        const bal = await db.getBalance(user.id);
        if (bal.coins < bet) {
          return interaction.reply({ content: `❌ Saldo insufficiente. Hai solo **${bal.coins} Pavo Coins**.`, ephemeral: true });
        }

        await db.removeBalance(user.id, bet, 'HighLow Bet', 'BET_HIGHLOW');

        const baseNumber = Math.floor(Math.random() * 80) + 10; // 10-90
        const nextNumber = Math.floor(Math.random() * 100) + 1; // 1-100

        const isHigher = nextNumber > baseNumber;
        const isLower = nextNumber < baseNumber;
        const isWin = (choice === 'high' && isHigher) || (choice === 'low' && isLower);

        let payout = 0;
        if (isWin) {
          payout = Math.floor(bet * 1.8);
          await db.addBalance(user.id, payout, 'HighLow Win', 'WIN_HIGHLOW');
          await db.recordGameResult({
            userId: user.id,
            gameType: 'highlow',
            outcome: 'WIN',
            betAmount: bet,
            payout
          });
        } else {
          await db.recordGameResult({
            userId: user.id,
            gameType: 'highlow',
            outcome: 'LOSS',
            betAmount: bet,
            payout: 0
          });
        }

        const newBal = await db.getBalance(user.id);

        const embed = new EmbedBuilder()
          .setTitle(isWin ? '🎯 INDOVINATO!' : '❌ SBAGLIATO!')
          .setColor(isWin ? 0x00FF88 : 0xE74C3C)
          .setDescription(
            `Numero iniziale: **${baseNumber}**\n` +
            `La tua scelta: **${choice === 'high' ? '⬆️ Più Alto' : '⬇️ Più Basso'}**\n` +
            `Numero estratto: **${nextNumber}**\n\n` +
            (isWin 
              ? `🏆 Bravo! Hai vinto **+${payout.toLocaleString('it-IT')} Pavo Coins**!` 
              : `Peccato! Hai perso **${bet.toLocaleString('it-IT')} Pavo Coins**.`)
          )
          .addFields(
            { name: '💰 Nuovo Saldo', value: `\`${newBal.coins.toLocaleString('it-IT')} Pavo Coins\``, inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }
    },

    // ============================================
    // 6. /blackjack <amount>
    // ============================================
    {
      data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Gioca a Blackjack contro il Banco per vincere Pavo Coins!')
        .addIntegerOption(opt =>
          opt.setName('quantita')
            .setDescription('Puntata di Pavo Coins')
            .setRequired(true)
            .setMinValue(10)
        ),

      async execute(interaction, config) {
        const bet = interaction.options.getInteger('quantita');
        const user = interaction.user;

        const bal = await db.getBalance(user.id);
        if (bal.coins < bet) {
          return interaction.reply({ content: `❌ Saldo insufficiente. Hai solo **${bal.coins} Pavo Coins**.`, ephemeral: true });
        }

        await db.removeBalance(user.id, bet, 'Blackjack Bet', 'BET_BLACKJACK');

        // Card helpers
        const suits = ['♠️', '♥️', '♦️', '♣️'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

        function drawCard() {
          const s = suits[Math.floor(Math.random() * suits.length)];
          const v = values[Math.floor(Math.random() * values.length)];
          let score = 0;
          if (['J', 'Q', 'K'].includes(v)) score = 10;
          else if (v === 'A') score = 11;
          else score = parseInt(v);
          return { display: `${v}${s}`, value: v, score };
        }

        function calculateHand(cards) {
          let total = 0;
          let aces = 0;
          for (const c of cards) {
            total += c.score;
            if (c.value === 'A') aces++;
          }
          while (total > 21 && aces > 0) {
            total -= 10;
            aces--;
          }
          return total;
        }

        const playerCards = [drawCard(), drawCard()];
        const dealerCards = [drawCard(), drawCard()];

        const playerScore = calculateHand(playerCards);
        const dealerScore = calculateHand(dealerCards);

        const gameId = `bj_${Date.now()}_${user.id}`;

        // Check instant blackjack
        if (playerScore === 21) {
          const payout = Math.floor(bet * 2.5);
          await db.addBalance(user.id, payout, 'Blackjack 21 Win', 'WIN_BLACKJACK');
          await db.recordGameResult({ userId: user.id, gameType: 'blackjack', outcome: 'WIN', betAmount: bet, payout });
          const updatedBal = await db.getBalance(user.id);

          const embed = new EmbedBuilder()
            .setTitle('🃏 BLACKJACK! 21 NATURALE!')
            .setColor(0x00FF88)
            .setDescription(
              `Le tue carte: **${playerCards.map(c => c.display).join(' ')}** (Totale: **21**)\n` +
              `Banco: **${dealerCards.map(c => c.display).join(' ')}** (Totale: **${dealerScore}**)\n\n` +
              `🎉 **VITTORIA NATURALE!** Hai vinto **+${payout.toLocaleString('it-IT')} Pavo Coins** (3:2 payout)!`
            )
            .addFields({ name: '💰 Nuovo Saldo', value: `\`${updatedBal.coins.toLocaleString('it-IT')} Pavo Coins\`` })
            .setTimestamp();

          return interaction.reply({ embeds: [embed] });
        }

        activeGames.set(gameId, {
          type: 'blackjack',
          userId: user.id,
          bet,
          playerCards,
          dealerCards,
          status: 'PLAYING'
        });

        const embed = new EmbedBuilder()
          .setTitle('🃏 TAVOLO DA BLACKJACK')
          .setColor(0x2C3E50)
          .setDescription(
            `🪙 **Puntata:** \`${bet} Pavo Coins\`\n\n` +
            `👤 **Le tue carte:** ${playerCards.map(c => c.display).join(' ')} — Totale: **${playerScore}**\n` +
            `🏦 **Carta Visibile Banco:** ${dealerCards[0].display} ❓ — Totale: **${dealerCards[0].score}**\n\n` +
            `*Cosa desideri fare?*`
          )
          .setFooter({ text: 'Scegli Carta (Hit), Stai (Stand) o Raddoppia (Double Down)' });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`bj_hit_${gameId}`)
            .setLabel('🃏 Carta (Hit)')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`bj_stand_${gameId}`)
            .setLabel('🛑 Stai (Stand)')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`bj_double_${gameId}`)
            .setLabel('✌️ Raddoppia')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
      }
    },

    // ============================================
    // 7. /gamestats [user]
    // ============================================
    {
      data: new SlashCommandBuilder()
        .setName('gamestats')
        .setDescription('Visualizza le tue statistiche dettagliate sui giochi e scommesse')
        .addUserOption(opt =>
          opt.setName('utente')
            .setDescription('Utente di cui visualizzare le statistiche')
            .setRequired(false)
        ),

      async execute(interaction) {
        const target = interaction.options.getUser('utente') || interaction.user;
        const stats = await db.getGameStats(target.id);
        const bal = await db.getBalance(target.id);

        const winRate = stats.totalGames > 0 ? ((stats.wins / stats.totalGames) * 100).toFixed(1) : '0.0';
        const netProfit = stats.coinsWon - stats.coinsLost;

        const embed = new EmbedBuilder()
          .setTitle(`📊 Statistiche Giochi - ${target.username}`)
          .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
          .setColor(0x3498DB)
          .addFields(
            { name: '🎮 Partite Totali', value: `\`${stats.totalGames}\``, inline: true },
            { name: '🏆 Vittorie', value: `\`${stats.wins}\` (${winRate}%)`, inline: true },
            { name: '💀 Sconfitte', value: `\`${stats.losses}\``, inline: true },
            { name: '🪙 Guadagno Netto', value: `${netProfit >= 0 ? '🟢 +' : '🔴 '}${netProfit.toLocaleString('it-IT')} Coins`, inline: true },
            { name: '💰 Saldo Attuale', value: `\`${bal.coins.toLocaleString('it-IT')} Coins\``, inline: true },
            { name: '🤝 Pareggi', value: `\`${stats.draws}\``, inline: true },
            { 
              name: '🎲 Vittorie per Gioco', 
              value: `🎯 Guess: **${stats.guessWins}** | 🎲 Dice: **${stats.diceWins}** | 🎰 Slots: **${stats.slotsWins}**\n🪙 Coinflip: **${stats.coinflipWins}** | 🃏 Blackjack: **${stats.blackjackWins}** | ⬆️ HighLow: **${stats.highlowWins}**`, 
              inline: false 
            }
          )
          .setFooter({ text: 'Statistiche salvate in modo permanente' })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }
    }
  ]
};
