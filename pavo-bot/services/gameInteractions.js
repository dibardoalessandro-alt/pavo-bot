const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle 
} = require('discord.js');
const db = require('../database');
const logger = require('./logger');
const { activeGames } = require('../commands/gambling');

// Card calculations for Blackjack
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

function drawCard() {
  const suits = ['♠️', '♥️', '♦️', '♣️'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const s = suits[Math.floor(Math.random() * suits.length)];
  const v = values[Math.floor(Math.random() * values.length)];
  let score = 0;
  if (['J', 'Q', 'K'].includes(v)) score = 10;
  else if (v === 'A') score = 11;
  else score = parseInt(v);
  return { display: `${v}${s}`, value: v, score };
}

async function handleGameInteraction(interaction, config) {
  const customId = interaction.customId;

  // ============================================
  // GUESS GAME BUTTONS & MODALS
  // ============================================
  if (customId.startsWith('guess_accept_')) {
    const gameId = customId.replace('guess_accept_', '');
    const game = activeGames.get(gameId);

    if (!game) {
      return interaction.reply({ content: '❌ Partita non più valida o terminata.', ephemeral: true });
    }
    if (interaction.user.id !== game.opponentId) {
      return interaction.reply({ content: '❌ Solo l\'avversario invitato può accettare la sfida!', ephemeral: true });
    }

    // Deduct bet from both players
    const hostDed = await db.removeBalance(game.hostId, game.bet, 'Guess Game Bet Reservation', 'BET_GUESS');
    const oppDed = await db.removeBalance(game.opponentId, game.bet, 'Guess Game Bet Reservation', 'BET_GUESS');

    if (!hostDed.success || !oppDed.success) {
      if (hostDed.success) await db.addBalance(game.hostId, game.bet, 'Refund bet');
      if (oppDed.success) await db.addBalance(game.opponentId, game.bet, 'Refund bet');
      activeGames.delete(gameId);
      return interaction.reply({ content: '❌ Uno dei giocatori non ha più abbastanza monete per iniziare.', ephemeral: true });
    }

    game.status = 'ACTIVE';
    game.secretNumber = Math.floor(Math.random() * 50) + 1; // 1-50 server-side secret
    game.minGuess = 1;
    game.maxGuess = 50;
    game.currentTurn = game.hostId;

    const embed = new EmbedBuilder()
      .setTitle(`🎯 GUESS GAME — Round 1/${game.rounds}`)
      .setDescription(
        `Sfida accettata! 🚀\n\n` +
        `🪙 **Montepremi in palio:** \`${game.bet * 2} Pavo Coins\`\n` +
        `🎯 **Numero Segreto Generato:** (Compreso tra 1 e 50)\n\n` +
        `👉 È il turno di <@${game.currentTurn}>! Clicca sul pulsante qui sotto per inserire la tua stima.`
      )
      .setColor(0x3498DB)
      .setFooter({ text: 'Il numero non viene mai rivelato fino alla vittoria del round!' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`guess_btn_input_${gameId}`)
        .setLabel('🎯 Inserisci Numero')
        .setStyle(ButtonStyle.Primary)
    );

    return interaction.update({ embeds: [embed], components: [row] });
  }

  if (customId.startsWith('guess_decline_')) {
    const gameId = customId.replace('guess_decline_', '');
    const game = activeGames.get(gameId);
    if (!game) return interaction.reply({ content: 'Partita scaduta.', ephemeral: true });

    if (interaction.user.id !== game.opponentId && interaction.user.id !== game.hostId) {
      return interaction.reply({ content: 'Non hai i permessi per rifiutare.', ephemeral: true });
    }

    activeGames.delete(gameId);
    return interaction.update({ content: `❌ Sfida rifiutata da <@${interaction.user.id}>.`, embeds: [], components: [] });
  }

  if (customId.startsWith('guess_btn_input_')) {
    const gameId = customId.replace('guess_btn_input_', '');
    const game = activeGames.get(gameId);

    if (!game) return interaction.reply({ content: '❌ Partita non attiva.', ephemeral: true });
    if (interaction.user.id !== game.currentTurn) {
      return interaction.reply({ content: `⏳ Non è il tuo turno! Attendi che <@${game.currentTurn}> effettui la sua mossa.`, ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`guess_modal_${gameId}`)
      .setTitle(`Round ${game.currentRound}: Indovina il Numero`);

    const input = new TextInputBuilder()
      .setCustomId('guess_number_input')
      .setLabel('Inserisci un numero tra 1 e 50')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Es: 25')
      .setMinLength(1)
      .setMaxLength(2)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  // ============================================
  // DICE GAME BUTTONS
  // ============================================
  if (customId.startsWith('dice_accept_')) {
    const gameId = customId.replace('dice_accept_', '');
    const game = activeGames.get(gameId);

    if (!game) return interaction.reply({ content: 'Partita scaduta.', ephemeral: true });
    if (interaction.user.id !== game.opponentId) {
      return interaction.reply({ content: 'Solo l\'avversario può accettare.', ephemeral: true });
    }

    const hostDed = await db.removeBalance(game.hostId, game.bet, 'Dice Game Bet', 'BET_DICE');
    const oppDed = await db.removeBalance(game.opponentId, game.bet, 'Dice Game Bet', 'BET_DICE');

    if (!hostDed.success || !oppDed.success) {
      if (hostDed.success) await db.addBalance(game.hostId, game.bet, 'Refund');
      if (oppDed.success) await db.addBalance(game.opponentId, game.bet, 'Refund');
      activeGames.delete(gameId);
      return interaction.reply({ content: '❌ Fondi insufficienti per iniziare.', ephemeral: true });
    }

    game.status = 'ACTIVE';
    game.currentRound = 1;
    game.currentTurn = game.hostId;
    game.currentRoundRolls = {};

    const embed = new EmbedBuilder()
      .setTitle(`🎲 DICE GAME — Round 1/${game.rounds}`)
      .setDescription(
        `Sfida ai dadi avviata!\n\n` +
        `🪙 **Montepremi:** \`${game.bet * 2} Pavo Coins\`\n\n` +
        `👉 Turno di <@${game.currentTurn}>! Clicca su **TIRA IL DADO**.`
      )
      .setColor(0x9B59B6);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`dice_roll_${gameId}`)
        .setLabel('🎲 TIRA IL DADO')
        .setStyle(ButtonStyle.Primary)
    );

    return interaction.update({ embeds: [embed], components: [row] });
  }

  if (customId.startsWith('dice_decline_')) {
    const gameId = customId.replace('dice_decline_', '');
    activeGames.delete(gameId);
    return interaction.update({ content: `❌ Sfida ai dadi rifiutata.`, embeds: [], components: [] });
  }

  if (customId.startsWith('dice_roll_')) {
    const gameId = customId.replace('dice_roll_', '');
    const game = activeGames.get(gameId);

    if (!game || game.status !== 'ACTIVE') return interaction.reply({ content: 'Partita non valida.', ephemeral: true });
    if (interaction.user.id !== game.currentTurn) {
      return interaction.reply({ content: `⏳ Non è il tuo turno! Tocca a <@${game.currentTurn}>.`, ephemeral: true });
    }

    const roll = Math.floor(Math.random() * 6) + 1;
    game.currentRoundRolls[interaction.user.id] = roll;

    // Check if second player has to roll or if round ends
    if (game.currentTurn === game.hostId) {
      game.currentTurn = game.opponentId;
      const embed = new EmbedBuilder()
        .setTitle(`🎲 DICE GAME — Round ${game.currentRound}/${game.rounds}`)
        .setDescription(
          `🎲 <@${game.hostId}> ha tirato **${roll}**!\n\n` +
          `👉 Tocca ora a <@${game.opponentId}> tirare il dado!`
        )
        .setColor(0x9B59B6);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`dice_roll_${gameId}`)
          .setLabel('🎲 TIRA IL DADO')
          .setStyle(ButtonStyle.Success)
      );

      return interaction.update({ embeds: [embed], components: [row] });
    } else {
      // Both rolled! Settle round
      const hostRoll = game.currentRoundRolls[game.hostId];
      const oppRoll = roll;

      let roundWinner = null;
      if (hostRoll > oppRoll) {
        game.scores[game.hostId] += 1;
        roundWinner = game.hostId;
      } else if (oppRoll > hostRoll) {
        game.scores[game.opponentId] += 1;
        roundWinner = game.opponentId;
      }

      const isGameOver = game.currentRound >= game.rounds;

      if (!isGameOver) {
        game.currentRound += 1;
        game.currentTurn = game.hostId;
        game.currentRoundRolls = {};

        const embed = new EmbedBuilder()
          .setTitle(`🎲 Risultato Round ${game.currentRound - 1}/${game.rounds}`)
          .setDescription(
            `🎲 <@${game.hostId}>: **${hostRoll}**\n` +
            `🎲 <@${game.opponentId}>: **${oppRoll}**\n\n` +
            (roundWinner ? `🏆 Vincitore Round: <@${roundWinner}>!\n\n` : `🤝 Pareggio per questo round!\n\n`) +
            `📊 **Punteggio Attuale:**\n<@${game.hostId}>: **${game.scores[game.hostId]}** | <@${game.opponentId}>: **${game.scores[game.opponentId]}**\n\n` +
            `👉 Inizia il Round ${game.currentRound}! Tocca a <@${game.hostId}> tirare.`
          )
          .setColor(0x9B59B6);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`dice_roll_${gameId}`)
            .setLabel('🎲 TIRA IL DADO')
            .setStyle(ButtonStyle.Primary)
        );

        return interaction.update({ embeds: [embed], components: [row] });
      } else {
        // Game Over! Settle final score
        const hostScore = game.scores[game.hostId];
        const oppScore = game.scores[game.opponentId];
        const prize = game.bet * 2;

        let finalWinner = null;
        if (hostScore > oppScore) finalWinner = game.hostId;
        else if (oppScore > hostScore) finalWinner = game.opponentId;

        if (finalWinner) {
          const loserId = finalWinner === game.hostId ? game.opponentId : game.hostId;
          await db.addBalance(finalWinner, prize, 'Dice Game Victory', 'WIN_DICE');
          await db.recordGameResult({ userId: finalWinner, gameType: 'dice', outcome: 'WIN', betAmount: game.bet, payout: prize, opponentId: loserId });
          await db.recordGameResult({ userId: loserId, gameType: 'dice', outcome: 'LOSS', betAmount: game.bet, payout: 0, opponentId: finalWinner });
        } else {
          // Tie: refund both
          await db.addBalance(game.hostId, game.bet, 'Dice Game Tie Refund');
          await db.addBalance(game.opponentId, game.bet, 'Dice Game Tie Refund');
          await db.recordGameResult({ userId: game.hostId, gameType: 'dice', outcome: 'DRAW', betAmount: game.bet });
          await db.recordGameResult({ userId: game.opponentId, gameType: 'dice', outcome: 'DRAW', betAmount: game.bet });
        }

        const embed = new EmbedBuilder()
          .setTitle('🏆 PARTITA AI DADI TERMINATA!')
          .setColor(finalWinner ? 0x00FF88 : 0xF1C40F)
          .setDescription(
            `🎲 <@${game.hostId}> ha tirato **${hostRoll}**\n` +
            `🎲 <@${game.opponentId}> ha tirato **${oppRoll}**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📊 **PUNTEGGIO FINALE:**\n` +
            `<@${game.hostId}>: **${hostScore}** round vinti\n` +
            `<@${game.opponentId}>: **${oppScore}** round vinti\n\n` +
            (finalWinner 
              ? `👑 **VINCITORE ASSOLUTO: <@${finalWinner}>**!\nPremio incassato: **+${prize.toLocaleString('it-IT')} Pavo Coins** 🪙` 
              : `🤝 **PAREGGIO!** Entrambi i giocatori hanno ricevuto il rimborso di **${game.bet} Pavo Coins**.`)
          )
          .setFooter({ text: 'Partita completata con successo' })
          .setTimestamp();

        activeGames.delete(gameId);
        return interaction.update({ embeds: [embed], components: [] });
      }
    }
  }

  // ============================================
  // BLACKJACK BUTTONS
  // ============================================
  if (customId.startsWith('bj_hit_') || customId.startsWith('bj_stand_') || customId.startsWith('bj_double_')) {
    const gameId = customId.split('_').slice(2).join('_');
    const action = customId.startsWith('bj_hit_') ? 'hit' : customId.startsWith('bj_stand_') ? 'stand' : 'double';
    const game = activeGames.get(gameId);

    if (!game || game.status !== 'PLAYING') return interaction.reply({ content: 'Partita di Blackjack conclusa.', ephemeral: true });
    if (interaction.user.id !== game.userId) return interaction.reply({ content: 'Non è il tuo tavolo!', ephemeral: true });

    if (action === 'double') {
      const userBal = await db.getBalance(game.userId);
      if (userBal.coins < game.bet) {
        return interaction.reply({ content: '❌ Saldo insufficiente per raddoppiare la puntata!', ephemeral: true });
      }
      await db.removeBalance(game.userId, game.bet, 'Blackjack Double', 'BET_BLACKJACK');
      game.bet *= 2;
      game.playerCards.push(drawCard());

      const scoreAfterDouble = calculateHand(game.playerCards);
      if (scoreAfterDouble > 21) {
        // Bust immediately
        await db.recordGameResult({ userId: game.userId, gameType: 'blackjack', outcome: 'LOSS', betAmount: game.bet, payout: 0 });
        const newBal = await db.getBalance(game.userId);
        const embed = new EmbedBuilder()
          .setTitle('💀 SBALLATO DOPO IL RADDOPPIO!')
          .setColor(0xE74C3C)
          .setDescription(
            `Le tue carte: **${game.playerCards.map(c => c.display).join(' ')}** (Totale: **${scoreAfterDouble}**)\n` +
            `Hai superato 21 e perso **${game.bet.toLocaleString('it-IT')} Pavo Coins**.`
          )
          .addFields({ name: '💰 Nuovo Saldo', value: `\`${newBal.coins.toLocaleString('it-IT')} Pavo Coins\`` });
        activeGames.delete(gameId);
        return interaction.update({ embeds: [embed], components: [] });
      }
      // If not bust, stand automatically
      return resolveDealerBlackjack(interaction, game, gameId);
    }

    if (action === 'hit') {
      game.playerCards.push(drawCard());
      const pScore = calculateHand(game.playerCards);

      if (pScore > 21) {
        // Bust
        await db.recordGameResult({ userId: game.userId, gameType: 'blackjack', outcome: 'LOSS', betAmount: game.bet, payout: 0 });
        const newBal = await db.getBalance(game.userId);
        const embed = new EmbedBuilder()
          .setTitle('💀 HAI SBALLATO! (BUST)')
          .setColor(0xE74C3C)
          .setDescription(
            `Le tue carte: **${game.playerCards.map(c => c.display).join(' ')}** (Totale: **${pScore}**)\n` +
            `Hai superato 21 e perso **${game.bet.toLocaleString('it-IT')} Pavo Coins**.`
          )
          .addFields({ name: '💰 Nuovo Saldo', value: `\`${newBal.coins.toLocaleString('it-IT')} Pavo Coins\`` });
        activeGames.delete(gameId);
        return interaction.update({ embeds: [embed], components: [] });
      }

      const embed = new EmbedBuilder()
        .setTitle('🃏 TAVOLO DA BLACKJACK')
        .setColor(0x2C3E50)
        .setDescription(
          `🪙 **Puntata:** \`${game.bet} Pavo Coins\`\n\n` +
          `👤 **Le tue carte:** ${game.playerCards.map(c => c.display).join(' ')} — Totale: **${pScore}**\n` +
          `🏦 **Carta Visibile Banco:** ${game.dealerCards[0].display} ❓\n\n` +
          `*Cosa desideri fare?*`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bj_hit_${gameId}`).setLabel('🃏 Carta (Hit)').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`bj_stand_${gameId}`).setLabel('🛑 Stai (Stand)').setStyle(ButtonStyle.Success)
      );

      return interaction.update({ embeds: [embed], components: [row] });
    }

    if (action === 'stand') {
      return resolveDealerBlackjack(interaction, game, gameId);
    }
  }
}

async function resolveDealerBlackjack(interaction, game, gameId) {
  // Dealer draws until score >= 17
  let dScore = calculateHand(game.dealerCards);
  while (dScore < 17) {
    game.dealerCards.push(drawCard());
    dScore = calculateHand(game.dealerCards);
  }

  const pScore = calculateHand(game.playerCards);
  const prize = game.bet * 2;

  let outcome = '';
  let color = 0x5865F2;
  let title = '';

  if (dScore > 21 || pScore > dScore) {
    // Player wins
    outcome = 'WIN';
    title = '🎉 VITTORIA CONTRO IL BANCO!';
    color = 0x00FF88;
    await db.addBalance(game.userId, prize, 'Blackjack Win', 'WIN_BLACKJACK');
    await db.recordGameResult({ userId: game.userId, gameType: 'blackjack', outcome: 'WIN', betAmount: game.bet, payout: prize });
  } else if (dScore === pScore) {
    // Push / Tie
    outcome = 'DRAW';
    title = '🤝 PAREGGIO (PUSH)!';
    color = 0xF1C40F;
    await db.addBalance(game.userId, game.bet, 'Blackjack Push Refund');
    await db.recordGameResult({ userId: game.userId, gameType: 'blackjack', outcome: 'DRAW', betAmount: game.bet });
  } else {
    // Dealer wins
    outcome = 'LOSS';
    title = '💀 IL BANCO VINCE';
    color = 0xE74C3C;
    await db.recordGameResult({ userId: game.userId, gameType: 'blackjack', outcome: 'LOSS', betAmount: game.bet, payout: 0 });
  }

  const updatedBal = await db.getBalance(game.userId);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(
      `👤 **Le tue carte:** ${game.playerCards.map(c => c.display).join(' ')} (Totale: **${pScore}**)\n` +
      `🏦 **Carte del Banco:** ${game.dealerCards.map(c => c.display).join(' ')} (Totale: **${dScore}**)\n\n` +
      (outcome === 'WIN' ? `🏆 Congratulazioni! Hai vinto **+${prize.toLocaleString('it-IT')} Pavo Coins**!` :
       outcome === 'DRAW' ? `Pari con il banco! La tua puntata di **${game.bet} Pavo Coins** è stata rimborsata.` :
       `Il banco batte la tua mano. Hai perso **${game.bet.toLocaleString('it-IT')} Coins**.`)
    )
    .addFields({ name: '💰 Nuovo Saldo', value: `\`${updatedBal.coins.toLocaleString('it-IT')} Pavo Coins\`` })
    .setTimestamp();

  activeGames.delete(gameId);
  return interaction.update({ embeds: [embed], components: [] });
}

// Modal submit handler for Guess Game
async function handleGuessModalSubmit(interaction) {
  const gameId = interaction.customId.replace('guess_modal_', '');
  const game = activeGames.get(gameId);

  if (!game || game.status !== 'ACTIVE') {
    return interaction.reply({ content: '❌ Partita non attiva o scaduta.', ephemeral: true });
  }

  const guessVal = parseInt(interaction.fields.getTextInputValue('guess_number_input').trim());
  if (isNaN(guessVal) || guessVal < 1 || guessVal > 50) {
    return interaction.reply({ content: '❌ Devi inserire un numero valido compreso tra 1 e 50!', ephemeral: true });
  }

  const secret = game.secretNumber;
  const isCorrect = guessVal === secret;

  if (isCorrect) {
    // Round won!
    game.scores[interaction.user.id] += 1;
    const isGameOver = game.currentRound >= game.rounds;

    if (!isGameOver) {
      game.currentRound += 1;
      game.secretNumber = Math.floor(Math.random() * 50) + 1; // New secret for next round
      game.minGuess = 1;
      game.maxGuess = 50;
      game.currentTurn = game.hostId; // Reset turn to host

      const embed = new EmbedBuilder()
        .setTitle(`🎯 NUMERO INDOVINATO! — Fine Round ${game.currentRound - 1}`)
        .setColor(0x00FF88)
        .setDescription(
          `🎉 <@${interaction.user.id}> ha indovinato il numero segreto: **${secret}**!\n\n` +
          `📊 **Punteggio:**\n` +
          `<@${game.hostId}>: **${game.scores[game.hostId]}** | <@${game.opponentId}>: **${game.scores[game.opponentId]}**\n\n` +
          `👉 Si passa al **Round ${game.currentRound}/${game.rounds}**! Tocca a <@${game.hostId}>.`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`guess_btn_input_${gameId}`).setLabel('🎯 Inserisci Numero').setStyle(ButtonStyle.Primary)
      );

      return interaction.update({ embeds: [embed], components: [row] });
    } else {
      // Game finished!
      const hostScore = game.scores[game.hostId];
      const oppScore = game.scores[game.opponentId];
      const prize = game.bet * 2;

      let winnerId = null;
      if (hostScore > oppScore) winnerId = game.hostId;
      else if (oppScore > hostScore) winnerId = game.opponentId;

      if (winnerId) {
        const loserId = winnerId === game.hostId ? game.opponentId : game.hostId;
        await db.addBalance(winnerId, prize, 'Guess Game Win', 'WIN_GUESS');
        await db.recordGameResult({ userId: winnerId, gameType: 'guess', outcome: 'WIN', betAmount: game.bet, payout: prize, opponentId: loserId });
        await db.recordGameResult({ userId: loserId, gameType: 'guess', outcome: 'LOSS', betAmount: game.bet, payout: 0, opponentId: winnerId });
      } else {
        // Tie
        await db.addBalance(game.hostId, game.bet, 'Guess Game Tie Refund');
        await db.addBalance(game.opponentId, game.bet, 'Guess Game Tie Refund');
        await db.recordGameResult({ userId: game.hostId, gameType: 'guess', outcome: 'DRAW', betAmount: game.bet });
        await db.recordGameResult({ userId: game.opponentId, gameType: 'guess', outcome: 'DRAW', betAmount: game.bet });
      }

      const embed = new EmbedBuilder()
        .setTitle('🏆 GUESS GAME CONCLUSO!')
        .setColor(winnerId ? 0x00FF88 : 0xF1C40F)
        .setDescription(
          `🎉 <@${interaction.user.id}> ha indovinato l'ultimo numero: **${secret}**!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📊 **PUNTEGGI FINALI:**\n` +
          `<@${game.hostId}>: **${hostScore}** round\n` +
          `<@${game.opponentId}>: **${oppScore}** round\n\n` +
          (winnerId 
            ? `👑 **VINCITORE: <@${winnerId}>**!\nPremio incassato: **+${prize.toLocaleString('it-IT')} Pavo Coins** 🪙` 
            : `🤝 **PAREGGIO!** Entrambi i giocatori hanno ricevuto il rimborso di **${game.bet} Coins**.`)
        )
        .setTimestamp();

      activeGames.delete(gameId);
      return interaction.update({ embeds: [embed], components: [] });
    }
  } else {
    // Incorrect guess: give hint and switch turn
    const hint = guessVal < secret ? `⬆️ Il numero segreto è **PIÙ ALTO** di ${guessVal}` : `⬇️ Il numero segreto è **PIÙ BASSO** di ${guessVal}`;
    const nextTurn = interaction.user.id === game.hostId ? game.opponentId : game.hostId;
    game.currentTurn = nextTurn;

    const embed = new EmbedBuilder()
      .setTitle(`🎯 GUESS GAME — Round ${game.currentRound}/${game.rounds}`)
      .setDescription(
        `<@${interaction.user.id}> ha provato con: **${guessVal}**\n` +
        `💡 **Indizio:** ${hint}\n\n` +
        `👉 Tocca ora a <@${nextTurn}>! Clicca sul pulsante per inserire la tua risposta.`
      )
      .setColor(0xE67E22);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`guess_btn_input_${gameId}`).setLabel('🎯 Inserisci Numero').setStyle(ButtonStyle.Primary)
    );

    return interaction.update({ embeds: [embed], components: [row] });
  }
}

module.exports = {
  handleGameInteraction,
  handleGuessModalSubmit
};
