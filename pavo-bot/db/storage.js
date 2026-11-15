const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { Pool } = require('pg');

const CURRENT_SCHEMA_VERSION = 3;

const DEFAULT_DATA_DIR = path.join(__dirname, '..', 'data');

function resolveWritableDataDir() {
  if (process.env.DATA_DIR) {
    const preferred = path.resolve(process.env.DATA_DIR);
    try {
      if (!fs.existsSync(preferred)) fs.mkdirSync(preferred, { recursive: true });
      fs.accessSync(preferred, fs.constants.W_OK);
      return preferred;
    } catch (err) {
      console.warn(`⚠️ [DB] DATA_DIR (${preferred}) is not writable (${err.code || err.message}). Falling back to ${DEFAULT_DATA_DIR}`);
    }
  }
  return DEFAULT_DATA_DIR;
}

const DATA_DIR = resolveWritableDataDir();

const SQLITE_PATH = process.env.SQLITE_PATH
  ? path.resolve(process.env.SQLITE_PATH)
  : path.join(DATA_DIR, 'pavo_database.sqlite');

const BACKUP_DIR = path.join(DATA_DIR, 'backups');

const LEGACY_JSON_PATHS = [
  path.join(__dirname, '..', 'pavo_database.json'),
  path.join(DATA_DIR, 'pavo_database.json')
];

let mode = 'sqlite'; // 'sqlite' | 'postgres'
let sqlite = null;
let pgPool = null;
let writeQueue = Promise.resolve();
let onWriteCallback = null;

function setOnWrite(cb) {
  onWriteCallback = typeof cb === 'function' ? cb : null;
}

function notifyWrite() {
  if (onWriteCallback) {
    try {
      onWriteCallback();
    } catch (_) {}
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createSqliteBackup(reason = 'auto') {
  if (!fs.existsSync(SQLITE_PATH)) return null;
  ensureDir(BACKUP_DIR);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `pavo_database.${reason}.${ts}.sqlite`);
  try {
    if (sqlite) {
      // Flush WAL before copying
      sqlite.pragma('wal_checkpoint(TRUNCATE)');
    }
    fs.copyFileSync(SQLITE_PATH, backupFile);

    // Keep only the 10 most recent backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.sqlite'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    for (const old of files.slice(10)) {
      fs.unlinkSync(path.join(BACKUP_DIR, old.name));
    }
    console.log(`💾 [DB BACKUP] Created backup: ${backupFile}`);
    return backupFile;
  } catch (err) {
    console.error('⚠️ [DB BACKUP] Failed to create backup:', err.message);
    return null;
  }
}

// ============================================
// SQLite Schema & Migrations (Additive Only!)
// ============================================

function ensureSqliteColumn(table, column, definition) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function initSqliteSchema() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS staff (
      discord_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      tickets_opened INTEGER NOT NULL DEFAULT 0,
      tickets_claimed INTEGER NOT NULL DEFAULT 0,
      tickets_closed INTEGER NOT NULL DEFAULT 0,
      tickets_handled INTEGER NOT NULL DEFAULT 0,
      sales_count INTEGER NOT NULL DEFAULT 0,
      total_earnings REAL NOT NULL DEFAULT 0,
      join_date TEXT,
      last_active_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tickets (
      ticket_id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      creator_username TEXT NOT NULL,
      welcome_message_id TEXT,
      claimed_by TEXT,
      closed_by TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN',
      kind TEXT NOT NULL DEFAULT 'support',
      product TEXT,
      application_json TEXT,
      vouch_requested INTEGER NOT NULL DEFAULT 0,
      vouch_requested_by TEXT,
      vouch_requested_at TEXT,
      created_at TEXT NOT NULL,
      closed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sales (
      sale_id INTEGER PRIMARY KEY,
      customer_id TEXT,
      customer_username TEXT,
      staff_id TEXT NOT NULL,
      product TEXT,
      price REAL NOT NULL DEFAULT 0,
      payment_method TEXT,
      date TEXT NOT NULL,
      ticket_id TEXT,
      commission REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS commission_percentages (
      role_name TEXT PRIMARY KEY,
      percentage REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS giveaways (
      id TEXT PRIMARY KEY,
      guild_id TEXT,
      channel_id TEXT,
      message_id TEXT,
      creator_id TEXT,
      prize TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      ended_at TEXT,
      max_participants INTEGER NOT NULL DEFAULT 0,
      winner_count INTEGER NOT NULL DEFAULT 1,
      require_oauth INTEGER NOT NULL DEFAULT 1,
      participants_json TEXT NOT NULL DEFAULT '[]',
      winners_json TEXT NOT NULL DEFAULT '[]',
      preset_winners_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'ACTIVE'
    );

    CREATE TABLE IF NOT EXISTS giveaway_participants (
      giveaway_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      entered_at TEXT NOT NULL,
      PRIMARY KEY (giveaway_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS legit_check_poll (
      id TEXT PRIMARY KEY,
      message_id TEXT,
      channel_id TEXT
    );

    CREATE TABLE IF NOT EXISTS legit_check_votes (
      user_id TEXT PRIMARY KEY,
      vote TEXT NOT NULL,
      voted_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS oauth_users (
      discord_id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY,
      user_id TEXT,
      giveaway_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS licenses (
      key_str TEXT PRIMARY KEY,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS balances (
      user_id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gamestats (
      user_id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS warnings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rule_acceptances (
      user_id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS panels (
      panel_key TEXT PRIMARY KEY,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS server_config (
      config_key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );
  `);

  const applied = sqlite.prepare('SELECT MAX(version) AS v FROM schema_migrations').get()?.v || 0;
  if (applied > 0 && applied < CURRENT_SCHEMA_VERSION) {
    createSqliteBackup(`pre-v${CURRENT_SCHEMA_VERSION}`);
  }

  if (applied < 1) {
    sqlite.prepare('INSERT OR IGNORE INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)')
      .run(1, 'Initial relational schema', new Date().toISOString());
  }

  if (applied < 2) {
    ensureSqliteColumn('staff', 'tickets_opened', 'INTEGER NOT NULL DEFAULT 0');
    ensureSqliteColumn('staff', 'tickets_claimed', 'INTEGER NOT NULL DEFAULT 0');
    ensureSqliteColumn('staff', 'tickets_closed', 'INTEGER NOT NULL DEFAULT 0');
    ensureSqliteColumn('staff', 'last_active_at', 'TEXT');
    ensureSqliteColumn('giveaways', 'preset_winners_json', "TEXT NOT NULL DEFAULT '[]'");
    sqlite.prepare('INSERT OR IGNORE INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)')
      .run(2, 'Add granular staff stats and preset giveaway winners', new Date().toISOString());
  }

  if (applied < 3) {
    ensureSqliteColumn('tickets', 'vouch_requested', 'INTEGER NOT NULL DEFAULT 0');
    ensureSqliteColumn('tickets', 'vouch_requested_by', 'TEXT');
    ensureSqliteColumn('tickets', 'vouch_requested_at', 'TEXT');
    sqlite.prepare('INSERT OR IGNORE INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)')
      .run(3, 'Add ticket vouch status columns', new Date().toISOString());
  }
}

// ============================================
// PostgreSQL Schema & Migrations (Additive Only!)
// ============================================

async function initPostgresSchema() {
  const client = await pgPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS staff (
        discord_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        tickets_opened INTEGER NOT NULL DEFAULT 0,
        tickets_claimed INTEGER NOT NULL DEFAULT 0,
        tickets_closed INTEGER NOT NULL DEFAULT 0,
        tickets_handled INTEGER NOT NULL DEFAULT 0,
        sales_count INTEGER NOT NULL DEFAULT 0,
        total_earnings DOUBLE PRECISION NOT NULL DEFAULT 0,
        join_date TEXT,
        last_active_at TEXT
      );

      CREATE TABLE IF NOT EXISTS tickets (
        ticket_id TEXT PRIMARY KEY,
        creator_id TEXT NOT NULL,
        creator_username TEXT NOT NULL,
        welcome_message_id TEXT,
        claimed_by TEXT,
        closed_by TEXT,
        status TEXT NOT NULL DEFAULT 'OPEN',
        kind TEXT NOT NULL DEFAULT 'support',
        product TEXT,
        application_json TEXT,
        vouch_requested INTEGER NOT NULL DEFAULT 0,
        vouch_requested_by TEXT,
        vouch_requested_at TEXT,
        created_at TEXT NOT NULL,
        closed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sales (
        sale_id INTEGER PRIMARY KEY,
        customer_id TEXT,
        customer_username TEXT,
        staff_id TEXT NOT NULL,
        product TEXT,
        price DOUBLE PRECISION NOT NULL DEFAULT 0,
        payment_method TEXT,
        date TEXT NOT NULL,
        ticket_id TEXT,
        commission DOUBLE PRECISION NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS commission_percentages (
        role_name TEXT PRIMARY KEY,
        percentage DOUBLE PRECISION NOT NULL
      );

      CREATE TABLE IF NOT EXISTS giveaways (
        id TEXT PRIMARY KEY,
        guild_id TEXT,
        channel_id TEXT,
        message_id TEXT,
        creator_id TEXT,
        prize TEXT NOT NULL,
        duration_ms BIGINT NOT NULL,
        started_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        ended_at TEXT,
        max_participants INTEGER NOT NULL DEFAULT 0,
        winner_count INTEGER NOT NULL DEFAULT 1,
        require_oauth INTEGER NOT NULL DEFAULT 1,
        participants_json TEXT NOT NULL DEFAULT '[]',
        winners_json TEXT NOT NULL DEFAULT '[]',
        preset_winners_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'ACTIVE'
      );

      CREATE TABLE IF NOT EXISTS giveaway_participants (
        giveaway_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        entered_at TEXT NOT NULL,
        PRIMARY KEY (giveaway_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS legit_check_poll (
        id TEXT PRIMARY KEY,
        message_id TEXT,
        channel_id TEXT
      );

      CREATE TABLE IF NOT EXISTS legit_check_votes (
        user_id TEXT PRIMARY KEY,
        vote TEXT NOT NULL,
        voted_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS oauth_users (
        discord_id TEXT PRIMARY KEY,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS oauth_states (
        state TEXT PRIMARY KEY,
        user_id TEXT,
        giveaway_id TEXT,
        created_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS licenses (
        key_str TEXT PRIMARY KEY,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS balances (
        user_id TEXT PRIMARY KEY,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS gamestats (
        user_id TEXT PRIMARY KEY,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS warnings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rule_acceptances (
        user_id TEXT PRIMARY KEY,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS profiles (
        user_id TEXT PRIMARY KEY,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS panels (
        panel_key TEXT PRIMARY KEY,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS server_config (
        config_key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );
    `);

    await client.query(`
      ALTER TABLE staff ADD COLUMN IF NOT EXISTS tickets_opened INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE staff ADD COLUMN IF NOT EXISTS tickets_claimed INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE staff ADD COLUMN IF NOT EXISTS tickets_closed INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_active_at TEXT;
      ALTER TABLE giveaways ADD COLUMN IF NOT EXISTS preset_winners_json TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS vouch_requested INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS vouch_requested_by TEXT;
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS vouch_requested_at TEXT;
    `);

    await client.query(
      'INSERT INTO schema_migrations (version, description, applied_at) VALUES ($1, $2, $3) ON CONFLICT (version) DO NOTHING',
      [CURRENT_SCHEMA_VERSION, 'Relational schema v2', new Date().toISOString()]
    );
  } finally {
    client.release();
  }
}

// ============================================
// Unified Query Helpers
// ============================================

function safeParseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function enqueuePg(fn) {
  writeQueue = writeQueue.then(fn).catch(err => {
    console.error('❌ [POSTGRES WRITE ERROR]:', err.message);
  });
  return writeQueue;
}

async function flush() {
  if (mode === 'postgres') {
    await writeQueue;
  } else if (sqlite) {
    try {
      sqlite.pragma('wal_checkpoint(PASSIVE)');
    } catch (_) {}
  }
}

// ============================================
// Persistence Writers (SQLite sync / PG queued)
// ============================================

function upsertStaff(s) {
  if (mode === 'sqlite') {
    sqlite.prepare(`
      INSERT INTO staff (discord_id, username, tickets_opened, tickets_claimed, tickets_closed, tickets_handled, sales_count, total_earnings, join_date, last_active_at)
      VALUES (@discord_id, @username, @tickets_opened, @tickets_claimed, @tickets_closed, @tickets_handled, @sales_count, @total_earnings, @join_date, @last_active_at)
      ON CONFLICT(discord_id) DO UPDATE SET
        username = excluded.username,
        tickets_opened = excluded.tickets_opened,
        tickets_claimed = excluded.tickets_claimed,
        tickets_closed = excluded.tickets_closed,
        tickets_handled = excluded.tickets_handled,
        sales_count = excluded.sales_count,
        total_earnings = excluded.total_earnings,
        join_date = COALESCE(staff.join_date, excluded.join_date),
        last_active_at = excluded.last_active_at
    `).run({
      discord_id: s.discord_id,
      username: s.username || 'Unknown',
      tickets_opened: s.tickets_opened || 0,
      tickets_claimed: s.tickets_claimed || 0,
      tickets_closed: s.tickets_closed || 0,
      tickets_handled: s.tickets_handled || 0,
      sales_count: s.sales_count || 0,
      total_earnings: Number(s.total_earnings || 0),
      join_date: s.join_date || null,
      last_active_at: s.last_active_at || null
    });
  } else {
    const copy = { ...s };
    enqueuePg(() => pgPool.query(
      `INSERT INTO staff (discord_id, username, tickets_opened, tickets_claimed, tickets_closed, tickets_handled, sales_count, total_earnings, join_date, last_active_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT(discord_id) DO UPDATE SET
         username = EXCLUDED.username,
         tickets_opened = EXCLUDED.tickets_opened,
         tickets_claimed = EXCLUDED.tickets_claimed,
         tickets_closed = EXCLUDED.tickets_closed,
         tickets_handled = EXCLUDED.tickets_handled,
         sales_count = EXCLUDED.sales_count,
         total_earnings = EXCLUDED.total_earnings,
         join_date = COALESCE(staff.join_date, EXCLUDED.join_date),
         last_active_at = EXCLUDED.last_active_at`,
      [
        copy.discord_id,
        copy.username || 'Unknown',
        copy.tickets_opened || 0,
        copy.tickets_claimed || 0,
        copy.tickets_closed || 0,
        copy.tickets_handled || 0,
        copy.sales_count || 0,
        Number(copy.total_earnings || 0),
        copy.join_date || null,
        copy.last_active_at || null
      ]
    ));
  }
  notifyWrite();
}

function upsertTicket(t) {
  const row = {
    ticket_id: t.ticket_id,
    creator_id: t.creator_id || 'Unknown',
    creator_username: t.creator_username || 'Unknown',
    welcome_message_id: t.welcome_message_id || null,
    claimed_by: t.claimed_by || null,
    closed_by: t.closed_by || null,
    status: t.status || 'OPEN',
    kind: t.kind || 'support',
    product: t.product || null,
    application_json: t.application ? JSON.stringify(t.application) : null,
    vouch_requested: t.vouch_requested ? 1 : 0,
    vouch_requested_by: t.vouch_requested_by || null,
    vouch_requested_at: t.vouch_requested_at || null,
    created_at: t.created_at || new Date().toISOString(),
    closed_at: t.closed_at || null
  };

  if (mode === 'sqlite') {
    sqlite.prepare(`
      INSERT INTO tickets (ticket_id, creator_id, creator_username, welcome_message_id, claimed_by, closed_by, status, kind, product, application_json, vouch_requested, vouch_requested_by, vouch_requested_at, created_at, closed_at)
      VALUES (@ticket_id, @creator_id, @creator_username, @welcome_message_id, @claimed_by, @closed_by, @status, @kind, @product, @application_json, @vouch_requested, @vouch_requested_by, @vouch_requested_at, @created_at, @closed_at)
      ON CONFLICT(ticket_id) DO UPDATE SET
        creator_id = excluded.creator_id,
        creator_username = excluded.creator_username,
        welcome_message_id = excluded.welcome_message_id,
        claimed_by = excluded.claimed_by,
        closed_by = excluded.closed_by,
        status = excluded.status,
        kind = excluded.kind,
        product = excluded.product,
        application_json = excluded.application_json,
        vouch_requested = excluded.vouch_requested,
        vouch_requested_by = excluded.vouch_requested_by,
        vouch_requested_at = excluded.vouch_requested_at,
        created_at = excluded.created_at,
        closed_at = excluded.closed_at
    `).run(row);
  } else {
    enqueuePg(() => pgPool.query(
      `INSERT INTO tickets (ticket_id, creator_id, creator_username, welcome_message_id, claimed_by, closed_by, status, kind, product, application_json, vouch_requested, vouch_requested_by, vouch_requested_at, created_at, closed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT(ticket_id) DO UPDATE SET
         creator_id = EXCLUDED.creator_id,
         creator_username = EXCLUDED.creator_username,
         welcome_message_id = EXCLUDED.welcome_message_id,
         claimed_by = EXCLUDED.claimed_by,
         closed_by = EXCLUDED.closed_by,
         status = EXCLUDED.status,
         kind = EXCLUDED.kind,
         product = EXCLUDED.product,
         application_json = EXCLUDED.application_json,
         vouch_requested = EXCLUDED.vouch_requested,
         vouch_requested_by = EXCLUDED.vouch_requested_by,
         vouch_requested_at = EXCLUDED.vouch_requested_at,
         created_at = EXCLUDED.created_at,
         closed_at = EXCLUDED.closed_at`,
      [
        row.ticket_id, row.creator_id, row.creator_username, row.welcome_message_id,
        row.claimed_by, row.closed_by, row.status, row.kind, row.product,
        row.application_json, row.vouch_requested, row.vouch_requested_by,
        row.vouch_requested_at, row.created_at, row.closed_at
      ]
    ));
  }
  notifyWrite();
}

function insertSale(sale) {
  if (mode === 'sqlite') {
    sqlite.prepare(`
      INSERT OR REPLACE INTO sales (sale_id, customer_id, customer_username, staff_id, product, price, payment_method, date, ticket_id, commission)
      VALUES (@sale_id, @customer_id, @customer_username, @staff_id, @product, @price, @payment_method, @date, @ticket_id, @commission)
    `).run(sale);
  } else {
    const copy = { ...sale };
    enqueuePg(() => pgPool.query(
      `INSERT INTO sales (sale_id, customer_id, customer_username, staff_id, product, price, payment_method, date, ticket_id, commission)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT(sale_id) DO UPDATE SET
         customer_id = EXCLUDED.customer_id,
         customer_username = EXCLUDED.customer_username,
         staff_id = EXCLUDED.staff_id,
         product = EXCLUDED.product,
         price = EXCLUDED.price,
         payment_method = EXCLUDED.payment_method,
         date = EXCLUDED.date,
         ticket_id = EXCLUDED.ticket_id,
         commission = EXCLUDED.commission`,
      [
        copy.sale_id, copy.customer_id, copy.customer_username, copy.staff_id,
        copy.product, copy.price, copy.payment_method, copy.date, copy.ticket_id, copy.commission
      ]
    ));
  }
  notifyWrite();
}

function upsertCommission(roleName, percentage) {
  if (mode === 'sqlite') {
    sqlite.prepare(`
      INSERT INTO commission_percentages (role_name, percentage) VALUES (?, ?)
      ON CONFLICT(role_name) DO UPDATE SET percentage = excluded.percentage
    `).run(roleName, percentage);
  } else {
    enqueuePg(() => pgPool.query(
      `INSERT INTO commission_percentages (role_name, percentage) VALUES ($1, $2)
       ON CONFLICT(role_name) DO UPDATE SET percentage = EXCLUDED.percentage`,
      [roleName, percentage]
    ));
  }
  notifyWrite();
}

function upsertGiveaway(g) {
  const row = {
    id: g.id,
    guild_id: g.guildId || null,
    channel_id: g.channelId || null,
    message_id: g.messageId || null,
    creator_id: g.creatorId || null,
    prize: g.prize,
    duration_ms: Number(g.durationMs || 0),
    started_at: g.startedAt || new Date().toISOString(),
    ends_at: g.endsAt,
    ended_at: g.endedAt || null,
    max_participants: Number(g.maxParticipants || 0),
    winner_count: Number(g.winnerCount || 1),
    require_oauth: g.requireOAuth ? 1 : 0,
    participants_json: JSON.stringify(g.participants || []),
    winners_json: JSON.stringify(g.winners || []),
    preset_winners_json: JSON.stringify(g.presetWinners || []),
    status: g.status || 'ACTIVE'
  };

  if (mode === 'sqlite') {
    sqlite.prepare(`
      INSERT INTO giveaways (id, guild_id, channel_id, message_id, creator_id, prize, duration_ms, started_at, ends_at, ended_at, max_participants, winner_count, require_oauth, participants_json, winners_json, preset_winners_json, status)
      VALUES (@id, @guild_id, @channel_id, @message_id, @creator_id, @prize, @duration_ms, @started_at, @ends_at, @ended_at, @max_participants, @winner_count, @require_oauth, @participants_json, @winners_json, @preset_winners_json, @status)
      ON CONFLICT(id) DO UPDATE SET
        guild_id = excluded.guild_id,
        channel_id = excluded.channel_id,
        message_id = excluded.message_id,
        creator_id = excluded.creator_id,
        prize = excluded.prize,
        duration_ms = excluded.duration_ms,
        started_at = excluded.started_at,
        ends_at = excluded.ends_at,
        ended_at = excluded.ended_at,
        max_participants = excluded.max_participants,
        winner_count = excluded.winner_count,
        require_oauth = excluded.require_oauth,
        participants_json = excluded.participants_json,
        winners_json = excluded.winners_json,
        preset_winners_json = excluded.preset_winners_json,
        status = excluded.status
    `).run(row);
  } else {
    enqueuePg(() => pgPool.query(
      `INSERT INTO giveaways (id, guild_id, channel_id, message_id, creator_id, prize, duration_ms, started_at, ends_at, ended_at, max_participants, winner_count, require_oauth, participants_json, winners_json, preset_winners_json, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT(id) DO UPDATE SET
         guild_id = EXCLUDED.guild_id,
         channel_id = EXCLUDED.channel_id,
         message_id = EXCLUDED.message_id,
         creator_id = EXCLUDED.creator_id,
         prize = EXCLUDED.prize,
         duration_ms = EXCLUDED.duration_ms,
         started_at = EXCLUDED.started_at,
         ends_at = EXCLUDED.ends_at,
         ended_at = EXCLUDED.ended_at,
         max_participants = EXCLUDED.max_participants,
         winner_count = EXCLUDED.winner_count,
         require_oauth = EXCLUDED.require_oauth,
         participants_json = EXCLUDED.participants_json,
         winners_json = EXCLUDED.winners_json,
         preset_winners_json = EXCLUDED.preset_winners_json,
         status = EXCLUDED.status`,
      [
        row.id, row.guild_id, row.channel_id, row.message_id, row.creator_id,
        row.prize, row.duration_ms, row.started_at, row.ends_at, row.ended_at,
        row.max_participants, row.winner_count, row.require_oauth,
        row.participants_json, row.winners_json, row.preset_winners_json, row.status
      ]
    ));
  }
  notifyWrite();
}

function insertGiveawayParticipant(giveawayId, userId) {
  const now = new Date().toISOString();
  if (mode === 'sqlite') {
    sqlite.prepare(`
      INSERT OR IGNORE INTO giveaway_participants (giveaway_id, user_id, entered_at) VALUES (?, ?, ?)
    `).run(giveawayId, userId, now);
  } else {
    enqueuePg(() => pgPool.query(
      `INSERT INTO giveaway_participants (giveaway_id, user_id, entered_at) VALUES ($1, $2, $3)
       ON CONFLICT (giveaway_id, user_id) DO NOTHING`,
      [giveawayId, userId, now]
    ));
  }
  notifyWrite();
}

function upsertLegitCheckPoll(channelId, messageId) {
  if (mode === 'sqlite') {
    sqlite.prepare(`
      INSERT INTO legit_check_poll (id, channel_id, message_id) VALUES ('default', ?, ?)
      ON CONFLICT(id) DO UPDATE SET channel_id = excluded.channel_id, message_id = excluded.message_id
    `).run(channelId || null, messageId || null);
  } else {
    enqueuePg(() => pgPool.query(
      `INSERT INTO legit_check_poll (id, channel_id, message_id) VALUES ('default', $1, $2)
       ON CONFLICT(id) DO UPDATE SET channel_id = EXCLUDED.channel_id, message_id = EXCLUDED.message_id`,
      [channelId || null, messageId || null]
    ));
  }
  notifyWrite();
}

function upsertLegitCheckVote(userId, vote) {
  const now = new Date().toISOString();
  if (mode === 'sqlite') {
    sqlite.prepare(`
      INSERT INTO legit_check_votes (user_id, vote, voted_at) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET vote = excluded.vote, voted_at = excluded.voted_at
    `).run(userId, vote, now);
  } else {
    enqueuePg(() => pgPool.query(
      `INSERT INTO legit_check_votes (user_id, vote, voted_at) VALUES ($1, $2, $3)
       ON CONFLICT(user_id) DO UPDATE SET vote = EXCLUDED.vote, voted_at = EXCLUDED.voted_at`,
      [userId, vote, now]
    ));
  }
  notifyWrite();
}

function upsertJsonRow(table, keyCol, keyVal, dataObj) {
  const json = JSON.stringify(dataObj);
  if (mode === 'sqlite') {
    sqlite.prepare(`
      INSERT INTO ${table} (${keyCol}, data_json) VALUES (?, ?)
      ON CONFLICT(${keyCol}) DO UPDATE SET data_json = excluded.data_json
    `).run(keyVal, json);
  } else {
    enqueuePg(() => pgPool.query(
      `INSERT INTO ${table} (${keyCol}, data_json) VALUES ($1, $2)
       ON CONFLICT(${keyCol}) DO UPDATE SET data_json = EXCLUDED.data_json`,
      [keyVal, json]
    ));
  }
  notifyWrite();
}

function deleteRow(table, keyCol, keyVal) {
  if (mode === 'sqlite') {
    sqlite.prepare(`DELETE FROM ${table} WHERE ${keyCol} = ?`).run(keyVal);
  } else {
    enqueuePg(() => pgPool.query(`DELETE FROM ${table} WHERE ${keyCol} = $1`, [keyVal]));
  }
  notifyWrite();
}

function upsertOAuthState(s) {
  if (mode === 'sqlite') {
    sqlite.prepare(`
      INSERT INTO oauth_states (state, user_id, giveaway_id, created_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(state) DO UPDATE SET user_id = excluded.user_id, giveaway_id = excluded.giveaway_id, created_at = excluded.created_at
    `).run(s.state, s.userId || null, s.giveawayId || null, s.createdAt);
  } else {
    enqueuePg(() => pgPool.query(
      `INSERT INTO oauth_states (state, user_id, giveaway_id, created_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT(state) DO UPDATE SET user_id = EXCLUDED.user_id, giveaway_id = EXCLUDED.giveaway_id, created_at = EXCLUDED.created_at`,
      [s.state, s.userId || null, s.giveawayId || null, s.createdAt]
    ));
  }
  notifyWrite();
}

function upsertWarning(w) {
  const json = JSON.stringify(w);
  if (mode === 'sqlite') {
    sqlite.prepare(`
      INSERT INTO warnings (id, user_id, data_json) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET user_id = excluded.user_id, data_json = excluded.data_json
    `).run(w.id, w.userId, json);
  } else {
    enqueuePg(() => pgPool.query(
      `INSERT INTO warnings (id, user_id, data_json) VALUES ($1, $2, $3)
       ON CONFLICT(id) DO UPDATE SET user_id = EXCLUDED.user_id, data_json = EXCLUDED.data_json`,
      [w.id, w.userId, json]
    ));
  }
  notifyWrite();
}

function clearWarningsByUser(userId) {
  if (mode === 'sqlite') {
    sqlite.prepare('DELETE FROM warnings WHERE user_id = ?').run(userId);
  } else {
    enqueuePg(() => pgPool.query('DELETE FROM warnings WHERE user_id = $1', [userId]));
  }
  notifyWrite();
}

function upsertServerConfig(key, value) {
  const json = JSON.stringify(value);
  if (mode === 'sqlite') {
    sqlite.prepare(`
      INSERT INTO server_config (config_key, value_json) VALUES (?, ?)
      ON CONFLICT(config_key) DO UPDATE SET value_json = excluded.value_json
    `).run(key, json);
  } else {
    enqueuePg(() => pgPool.query(
      `INSERT INTO server_config (config_key, value_json) VALUES ($1, $2)
       ON CONFLICT(config_key) DO UPDATE SET value_json = EXCLUDED.value_json`,
      [key, json]
    ));
  }
  notifyWrite();
}

// ============================================
// Full Snapshot Loader (Startup Recovery)
// ============================================

async function queryAll(sql) {
  if (mode === 'sqlite') {
    return sqlite.prepare(sql).all();
  }
  const res = await pgPool.query(sql);
  return res.rows;
}

async function loadAllInto(dbData) {
  const staffRows = await queryAll('SELECT * FROM staff');
  for (const r of staffRows) {
    dbData.staff[r.discord_id] = {
      discord_id: r.discord_id,
      username: r.username,
      tickets_opened: r.tickets_opened || 0,
      tickets_claimed: r.tickets_claimed || 0,
      tickets_closed: r.tickets_closed || 0,
      tickets_handled: r.tickets_handled || 0,
      sales_count: r.sales_count || 0,
      total_earnings: Number(r.total_earnings || 0),
      join_date: r.join_date || null,
      last_active_at: r.last_active_at || null
    };
  }

  const ticketRows = await queryAll('SELECT * FROM tickets');
  for (const r of ticketRows) {
    dbData.tickets[r.ticket_id] = {
      ticket_id: r.ticket_id,
      creator_id: r.creator_id,
      creator_username: r.creator_username,
      welcome_message_id: r.welcome_message_id || null,
      claimed_by: r.claimed_by || null,
      status: r.status || 'OPEN',
      closed_by: r.closed_by || null,
      created_at: r.created_at,
      closed_at: r.closed_at || null,
      kind: r.kind || 'support',
      vouch_requested: Boolean(r.vouch_requested),
      vouch_requested_by: r.vouch_requested_by || null,
      vouch_requested_at: r.vouch_requested_at || null,
      ...(r.product ? { product: r.product } : {}),
      ...(r.application_json ? { application: safeParseJson(r.application_json, null) } : {})
    };
  }

  const saleRows = await queryAll('SELECT * FROM sales ORDER BY sale_id ASC');
  dbData.sales = saleRows.map(r => ({
    sale_id: r.sale_id,
    customer_id: r.customer_id,
    customer_username: r.customer_username,
    staff_id: r.staff_id,
    product: r.product,
    price: Number(r.price || 0),
    payment_method: r.payment_method,
    date: r.date,
    ticket_id: r.ticket_id,
    commission: Number(r.commission || 0)
  }));

  const commRows = await queryAll('SELECT * FROM commission_percentages');
  for (const r of commRows) {
    dbData.commission_percentages[r.role_name] = Number(r.percentage);
  }

  const gwPartRows = await queryAll('SELECT * FROM giveaway_participants');
  const partMap = {};
  for (const p of gwPartRows) {
    if (!partMap[p.giveaway_id]) partMap[p.giveaway_id] = [];
    partMap[p.giveaway_id].push(p.user_id);
  }

  const gwRows = await queryAll('SELECT * FROM giveaways');
  for (const r of gwRows) {
    const jsonParts = safeParseJson(r.participants_json, []);
    const mergedParts = [...new Set([...(partMap[r.id] || []), ...jsonParts])];
    dbData.giveaways[r.id] = {
      id: r.id,
      guildId: r.guild_id,
      channelId: r.channel_id,
      messageId: r.message_id || null,
      creatorId: r.creator_id,
      prize: r.prize,
      durationMs: Number(r.duration_ms),
      startedAt: r.started_at,
      endsAt: r.ends_at,
      endedAt: r.ended_at || undefined,
      maxParticipants: Number(r.max_participants || 0),
      winnerCount: Number(r.winner_count || 1),
      requireOAuth: Boolean(r.require_oauth),
      participants: mergedParts,
      winners: safeParseJson(r.winners_json, []),
      presetWinners: safeParseJson(r.preset_winners_json, []),
      status: r.status || 'ACTIVE'
    };
  }

  const pollRows = await queryAll('SELECT * FROM legit_check_poll');
  const voteRows = await queryAll('SELECT * FROM legit_check_votes');
  if (pollRows.length > 0 || voteRows.length > 0) {
    const poll = pollRows[0] || {};
    const votes = {};
    for (const v of voteRows) {
      votes[v.user_id] = v.vote;
    }
    dbData.legit_check_poll = {
      messageId: poll.message_id || null,
      channelId: poll.channel_id || '1546615108325736558',
      votes
    };
  }

  const oauthUsers = await queryAll('SELECT * FROM oauth_users');
  for (const r of oauthUsers) {
    const parsed = safeParseJson(r.data_json, null);
    if (parsed) dbData.oauth_users[r.discord_id] = parsed;
  }

  const oauthStates = await queryAll('SELECT * FROM oauth_states');
  for (const r of oauthStates) {
    dbData.oauth_states[r.state] = {
      state: r.state,
      userId: r.user_id,
      giveawayId: r.giveaway_id,
      createdAt: Number(r.created_at)
    };
  }

  const licenses = await queryAll('SELECT * FROM licenses');
  for (const r of licenses) {
    const parsed = safeParseJson(r.data_json, null);
    if (parsed) dbData.licenses[r.key_str] = parsed;
  }

  const balances = await queryAll('SELECT * FROM balances');
  for (const r of balances) {
    const parsed = safeParseJson(r.data_json, null);
    if (parsed) dbData.balances[r.user_id] = parsed;
  }

  const txs = await queryAll('SELECT * FROM transactions');
  dbData.transactions = txs.map(r => safeParseJson(r.data_json, null)).filter(Boolean);

  const gameStats = await queryAll('SELECT * FROM gamestats');
  for (const r of gameStats) {
    const parsed = safeParseJson(r.data_json, null);
    if (parsed) dbData.gamestats[r.user_id] = parsed;
  }

  const warnings = await queryAll('SELECT * FROM warnings');
  dbData.warnings = warnings.map(r => safeParseJson(r.data_json, null)).filter(Boolean);

  const rules = await queryAll('SELECT * FROM rule_acceptances');
  for (const r of rules) {
    const parsed = safeParseJson(r.data_json, null);
    if (parsed) dbData.rule_acceptances[r.user_id] = parsed;
  }

  const profiles = await queryAll('SELECT * FROM profiles');
  for (const r of profiles) {
    const parsed = safeParseJson(r.data_json, null);
    if (parsed) dbData.profiles[r.user_id] = parsed;
  }

  const panels = await queryAll('SELECT * FROM panels');
  for (const r of panels) {
    const parsed = safeParseJson(r.data_json, null);
    if (parsed) dbData.panels[r.panel_key] = parsed;
  }

  const serverCfg = await queryAll('SELECT * FROM server_config');
  for (const r of serverCfg) {
    dbData.server_config[r.config_key] = safeParseJson(r.value_json, null);
  }
}

// ============================================
// One-time Non-Destructive Import from Legacy JSON
// ============================================

async function importLegacyJsonIfNeeded(dbData) {
  const alreadyHasData =
    Object.keys(dbData.staff).length > 0 ||
    Object.keys(dbData.tickets).length > 0 ||
    Object.keys(dbData.giveaways).length > 0 ||
    Object.keys(dbData.balances).length > 0 ||
    Boolean(dbData.legit_check_poll?.messageId);

  if (alreadyHasData) return;

  for (const jsonFile of LEGACY_JSON_PATHS) {
    if (!fs.existsSync(jsonFile)) continue;
    try {
      const legacy = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      console.log(`📦 [DB MIGRATION] Importing legacy records from ${jsonFile} (preserving file)...`);

      for (const s of Object.values(legacy.staff || {})) {
        dbData.staff[s.discord_id] = {
          tickets_opened: 0,
          tickets_claimed: 0,
          tickets_closed: 0,
          ...s
        };
        upsertStaff(dbData.staff[s.discord_id]);
      }

      for (const t of Object.values(legacy.tickets || {})) {
        dbData.tickets[t.ticket_id] = t;
        upsertTicket(t);
      }

      for (const sale of (legacy.sales || [])) {
        dbData.sales.push(sale);
        insertSale(sale);
      }

      for (const [role, pct] of Object.entries(legacy.commission_percentages || {})) {
        dbData.commission_percentages[role] = pct;
        upsertCommission(role, pct);
      }

      for (const g of Object.values(legacy.giveaways || {})) {
        dbData.giveaways[g.id] = g;
        upsertGiveaway(g);
        for (const uid of (g.participants || [])) {
          insertGiveawayParticipant(g.id, uid);
        }
      }

      if (legacy.legit_check_poll) {
        dbData.legit_check_poll = legacy.legit_check_poll;
        upsertLegitCheckPoll(legacy.legit_check_poll.channelId, legacy.legit_check_poll.messageId);
        for (const [uid, vote] of Object.entries(legacy.legit_check_poll.votes || {})) {
          upsertLegitCheckVote(uid, vote);
        }
      }

      for (const [uid, u] of Object.entries(legacy.oauth_users || {})) {
        dbData.oauth_users[uid] = u;
        upsertJsonRow('oauth_users', 'discord_id', uid, u);
      }

      for (const [k, l] of Object.entries(legacy.licenses || {})) {
        dbData.licenses[k] = l;
        upsertJsonRow('licenses', 'key_str', k, l);
      }

      for (const [uid, b] of Object.entries(legacy.balances || {})) {
        dbData.balances[uid] = b;
        upsertJsonRow('balances', 'user_id', uid, b);
      }

      for (const tx of (legacy.transactions || [])) {
        dbData.transactions.push(tx);
        upsertJsonRow('transactions', 'id', tx.id || String(dbData.transactions.length), tx);
      }

      for (const [uid, gs] of Object.entries(legacy.gamestats || {})) {
        dbData.gamestats[uid] = gs;
        upsertJsonRow('gamestats', 'user_id', uid, gs);
      }

      for (const w of (legacy.warnings || [])) {
        dbData.warnings.push(w);
        upsertWarning(w);
      }

      for (const [uid, ra] of Object.entries(legacy.rule_acceptances || {})) {
        dbData.rule_acceptances[uid] = ra;
        upsertJsonRow('rule_acceptances', 'user_id', uid, ra);
      }

      for (const [uid, p] of Object.entries(legacy.profiles || {})) {
        dbData.profiles[uid] = p;
        upsertJsonRow('profiles', 'user_id', uid, p);
      }

      for (const [pk, pv] of Object.entries(legacy.panels || {})) {
        dbData.panels[pk] = pv;
        upsertJsonRow('panels', 'panel_key', pk, pv);
      }

      for (const [ck, cv] of Object.entries(legacy.server_config || {})) {
        dbData.server_config[ck] = cv;
        upsertServerConfig(ck, cv);
      }

      await flush();
      console.log(`✅ [DB MIGRATION] Legacy JSON data imported successfully.`);
      break;
    } catch (err) {
      console.error(`⚠️ [DB MIGRATION] Failed importing ${jsonFile}:`, err.message);
    }
  }
}

async function initStorage(dbData) {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && databaseUrl.trim() !== '') {
    mode = 'postgres';
    const isLocalPg = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
    pgPool = new Pool({
      connectionString: databaseUrl,
      ssl: isLocalPg ? false : { rejectUnauthorized: false }
    });
    await initPostgresSchema();
    console.log('🐘 [DB] Connected to persistent PostgreSQL database (DATABASE_URL).');
  } else {
    mode = 'sqlite';
    ensureDir(DATA_DIR);
    sqlite = new Database(SQLITE_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('synchronous = FULL');
    initSqliteSchema();
    console.log(`🗄️ [DB] Connected to persistent SQLite database at: ${SQLITE_PATH}`);
  }

  await loadAllInto(dbData);
  await importLegacyJsonIfNeeded(dbData);

  return {
    mode,
    sqlitePath: mode === 'sqlite' ? SQLITE_PATH : null
  };
}

function getStorageInfo() {
  return {
    mode,
    sqlitePath: mode === 'sqlite' ? SQLITE_PATH : null,
    dataDir: DATA_DIR
  };
}

module.exports = {
  initStorage,
  setOnWrite,
  flush,
  createSqliteBackup,
  getStorageInfo,
  upsertStaff,
  upsertTicket,
  insertSale,
  upsertCommission,
  upsertGiveaway,
  insertGiveawayParticipant,
  upsertLegitCheckPoll,
  upsertLegitCheckVote,
  upsertJsonRow,
  deleteRow,
  upsertOAuthState,
  upsertWarning,
  clearWarningsByUser,
  upsertServerConfig
};
