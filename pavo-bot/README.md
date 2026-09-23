# 🤖 Pavo Bot

A professional, high-performance Discord support ticket and sales logging system with commissions, staff statistics, and payment display. Designed specifically for **Pavo Tweak**.

---

## 📁 Project Structure

```
pavo-bot/
├── commands/
│   ├── earnings.js      # /earnings, /setpercentage commands
│   ├── giveaway.js      # /giveaway (create, end, cancel, reroll, list) commands & handlers
│   ├── oauth.js         # /oauth (stats, user) commands
│   ├── payment.js       # /payment command
│   ├── sales.js         # /sales (stats, user, leaderboard) commands
│   ├── staff.js         # /staff (list, info, promote, demote) commands
│   └── ticket.js        # /ticket command, button/modal handlers
├── .env                 # Environment variables for sensitive data
├── .env.example         # Template for environment variables
├── config.json          # Discord channel/role configurations
├── database.js          # JSON database connection & persistence operations
├── index.js             # Main bot loader, command router, and client setup
├── oauthServer.js       # Discord OAuth2 verification server & web UI
├── package.json         # Project metadata and dependencies
└── README.md            # Comprehensive documentation
```

---

## 🛠️ Step 1: Create the Discord Bot Application

To host the bot, you must register it on the Discord Developer Portal:

1. Visit the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** in the top right. Name it `Pavo Bot`.
3. In the left sidebar, click **Bot**.
4. Scroll down to **Privileged Gateway Intents** and enable the following:
   * **Presence Intent**
   * **Server Members Intent** (Crucial for `/staff list` to display staff directory)
   * **Message Content Intent** (Crucial for transcript generation)
5. Scroll up to the **Token** section and click **Reset Token**. Copy the token and save it securely.

---

## 🔗 Step 2: Add the Bot to Your Discord Server

To invite the bot to your guild:

1. In the left sidebar of the Developer Portal, click **OAuth2** -> **URL Generator**.
2. Under **Scopes**, select `bot` and `applications.commands`.
3. Under **Bot Permissions**, select:
   * **Manage Channels** (To create/delete private ticket channels)
   * **Manage Roles** (To promote/demote staff members)
   * **View Channels** (To read messages for transcripts)
   * **Send Messages** (To chat inside tickets)
   * **Embed Links** (To send rich embeds)
   * **Attach Files** (To send transcript files)
   * **Read Message History** (To generate transcripts)
4. Copy the generated **URL** at the bottom and open it in your browser.
5. Select your target guild and authorize the bot.
6. **IMPORTANT:** In your Server settings, drag the bot's custom integration role (named `Pavo Bot`) **above** all the staff roles you want it to manage (e.g. Senior Supporter, Support Trainer). If you don't do this, Discord will block the bot from assigning/removing those roles during promote/demote operations.

---

## ⚙️ Step 3: Configuration & Tokens

### 1. Bot Secrets (`.env`)
Create a copy of `.env.example` named `.env` and paste your Bot Token:
```env
DISCORD_TOKEN=your_bot_token_here
```

### 2. Server IDs and Settings (`config.json`)
Open `config.json` and configure your IDs:
- **`guildId`**: The ID of your Discord Server. Putting it here registers slash commands instantly for testing.
- **`ticketCategoryId`**: The category category ID where new ticket channels will be created.
- **`ticketLogChannelId`**: The channel ID where closed ticket summaries and purchase records are logged.
- **`transcriptChannelId`**: The channel ID where txt transcript files are stored (can be the same as your log channel).
- **`staffRoles`**: Replace placeholder IDs with the actual Snowflake IDs for:
  * **Senior Supporter**
  * **Support Trainer**
  * **COO**
  * **Developer**
  * **Management**
  * **Founder**
  * **Pavo**
- **`paymentInfo`**: Update links and wallet addresses for LTC, PayPal, and Server Boost instructions.
- **`defaultCommissionPercentages`**: Define default commission payout percentages for each role.

---

## 🚀 Step 4: Installation & Running

Ensure you have **Node.js v16.9.0+** installed on your system.

1. Open your terminal in the `pavo-bot` directory.
2. Install the necessary NPM dependencies:
   ```bash
   npm install
   ```
3. Run the bot:
   ```bash
   npm start
   ```

---

## 🎮 Available Slash Commands

| Command | Subcommands / Arguments | Description |
|---|---|---|
| `/ticket` | - | Opens a private support ticket for a user. |
| `/staff` | `list` | Show a professional list of all staff members and their roles. |
| | `info [user]` | Show statistics of a staff member (tickets, sales, earnings). |
| | `promote <user> <role>` | Promotes a staff member (Authorized management only). |
| | `demote <user> <role>` | Demotes a staff member (Authorized management only). |
| `/sales` | `stats` | Display total manual sales statistics & revenue. |
| | `user <user>` | Display sales generated by a specific staff member. |
| | `leaderboard` | Show the staff sales leaderboard. |
| `/payment` | - | Display official Pavo Tweak payment information. |
| `/earnings` | `[user]` | View commission earnings for yourself or a specific staff member. |
| `/setpercentage`| `<role> <percentage>` | Change commission percentages for roles (Management only). |
| `/giveaway` | `create <prize> <duration> [winners] [max_participants] [require_oauth]` | Create an official Pavo giveaway with live counters & timers. |
| | `end [giveaway_id]` | End an active giveaway early and pick random winner(s). |
| | `cancel [giveaway_id]` | Cancel an active giveaway without selecting winners. |
| | `reroll [giveaway_id] [winners]` | Select new winner(s) while excluding previous winners. |
| | `list` | View all currently active giveaways and their end times. |
| `/oauth` | `stats` | View verified user statistics (total, today, this week). |
| | `user <user>` | Look up a user's Discord OAuth2 verification status. |

---

## 🔐 Discord OAuth2 Verification System

The bot features a built-in official Discord OAuth2 verification system and responsive web portal:

1. In the [Discord Developer Portal](https://discord.com/developers/applications), select your application -> **OAuth2**.
2. Under **Redirects**, add:
   - `http://localhost:10000/oauth/callback` (Local Development)
   - `https://your-domain.onrender.com/oauth/callback` (Production)
3. Under **OAuth2 URL Generator**, scopes used: `identify` (strict minimum required).
4. Fill in `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` in `.env`.
5. Access the Pavo Verification Portal at `http://localhost:10000/` or `https://your-domain.onrender.com/`.

