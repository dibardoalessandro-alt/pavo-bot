# 🤖 Pavo Bot — Complete Suite

Il bot Discord definitivo per la community di **Pavo Tweak** e **BlockSpin**, equipaggiato con:
1. **🔑 Key / License System** (Generazione, Riscatto, Revoca, Verifica, Scadenza)
2. **💰 Economia Virtuale & Pavo Coins** (Saldi persistenti, Daily, Pagamenti, Classifiche)
3. **🎰 Gambling & Giochi Virtuali** (Guess Game 1-50, Dice 1-6, Coinflip, Slots con moltiplicatori, High/Low, Blackjack interattivo)
4. **🎫 Support Ticket System** (7 categorie, permessi privati, add/remove user, claim, chiusura, transcript)
5. **👋 Welcome & Rules Acceptance System** (Regolamento bilingue EN/IT con bottone di verifica ruolo `Member`)
6. **🛡️ Staff & Moderation System** (Warn, Warnings, Clear, Kick, Ban, Unban, Timeout, Untimeout, Lock, Unlock, Slowmode, Userinfo, Serverinfo)
7. **🎮 BlockSpin 1v1 & Trading Area** (Canali dedicati e ruoli esport/gaming)
8. **🎁 Giveaway System** (Timer persistenti in DB, autoroll, reroll)
9. **🏆 Profile System** (Scheda giocatore con XP, livelli, statistiche vittorie, monete e ruoli)
10. **💾 Database Persistence** (Salvataggio atomico permanente in JSON / SQLite)

---

## 📁 Comandi Slash Disponibili

### 🔑 1. Licenze & Chiavi (`/key`)
- `/key create <product> <duration> [quantity] [notes]` — Crea chiavi uniche (formato `PAVO-XXXX-XXXX-XXXX`)
- `/key list [status] [product]` — Elenco e stato delle chiavi generate
- `/key info <key>` — Dettagli completi, creatore e riscatto
- `/key revoke <key> [reason]` — Revoca una chiave
- `/key delete <key>` — Elimina una chiave dal database
- `/key redeem <key>` — Riscatta la chiave per il proprio account Discord
- `/key check <key>` — Controlla la validità senza riscattarla

### 💰 2. Economia Pavo Coins
- `/balance [utente]` — Controlla il saldo di Pavo Coins
- `/daily` — Riscatta 500 monete gratis ogni 24 ore
- `/pay <destinatario> <quantita>` — Invia monete ad altri utenti
- `/leaderboard [tipo]` — Classifica per monete, vittorie o partite

### 🎰 3. Giochi & Scommesse
- `/guess <avversario> <round> <puntata>` — Sfida 1v1 all'Indovina il Numero (1-50 segreto, con indizi Alto/Basso e modali a turno)
- `/dice <avversario> <round> <puntata>` — Sfida 1v1 ai Dadi (1-6 a turni con pulsante)
- `/coinflip <quantita> <lato>` — Testa o Croce istantaneo
- `/slots <quantita>` — Slot machine con jackpot 777 e combinazioni
- `/highlow <quantita> <previsione>` — Prevedi se il numero sarà Più Alto o Più Basso
- `/blackjack <quantita>` — Blackjack interattivo con Hit, Stand e Double Down
- `/gamestats [utente]` — Statistiche complete e winrate

### 🛡️ 4. Moderazione & Staff
- `/warn <utente> <motivo>` — Ammonisce un utente
- `/warnings <utente>` — Storico ammonizioni
- `/clear <quantita>` — Cancella fino a 100 messaggi
- `/kick <utente> [motivo]` — Espelle un utente
- `/ban <utente> [motivo]` — Banna permanentemente
- `/unban <userid> [motivo]` — Sbanna tramite ID Discord
- `/timeout <utente> <minuti> [motivo]` — Mette in timeout
- `/untimeout <utente>` — Rimuove il timeout
- `/lock` / `/unlock` — Blocca/sblocca la scrittura nel canale
- `/slowmode <secondi>` — Imposta il rallentatore
- `/userinfo` / `/serverinfo` — Informazioni dettagliate

### 🎫 5. Supporto Ticket
- `/ticket close` — Chiude il ticket impostando i permessi di sola lettura
- `/ticket delete` — Elimina definitivamente il canale
- `/ticket reopen` — Riapre un ticket chiuso
- Pulsanti interni: **Claim**, **Close**, **Add User**, **Remove User**, **Purchase Completed**

### 🎮 6. Profilo & Utility
- `/profile [utente]` — Scheda profilo giocatore con XP, livelli, monete e ruoli
- `/setup` — Crea in automatico tutte le categorie, canali, ruoli, regole e pannelli ticket

---

## 🚀 Avvio Rapido

1. Per eseguire il setup del server (ruoli, canali, pannelli):  
   👉 Doppio click su **`setup-server.bat`**

2. Per avviare il bot:  
   👉 Doppio click su **`start.bat`**
