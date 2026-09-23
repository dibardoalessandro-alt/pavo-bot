const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

// Ensure database directory exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`[DATABASE] Connecting to SQLite at: ${config.dbPath}`);
const db = new DatabaseSync(config.dbPath);

// Enable WAL mode and foreign keys for high performance & concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize Tables & Schema
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', -- 'active', 'banned', 'expired', 'revoked'
      hwid TEXT DEFAULT NULL,
      ip_address TEXT DEFAULT NULL,
      discord_user_id TEXT DEFAULT NULL,
      discord_username TEXT DEFAULT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT DEFAULT NULL,
      activated_at TEXT DEFAULT NULL,
      last_heartbeat TEXT DEFAULT NULL,
      ban_reason TEXT DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      max_devices INTEGER DEFAULT 1,
      created_by TEXT DEFAULT 'admin'
    );

    CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
    CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
    CREATE INDEX IF NOT EXISTS idx_licenses_discord ON licenses(discord_user_id);
    CREATE INDEX IF NOT EXISTS idx_licenses_hwid ON licenses(hwid);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT,
      action TEXT NOT NULL,
      actor TEXT DEFAULT 'system',
      hwid TEXT,
      ip_address TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_license ON audit_logs(license_key);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

    -- =========================================================================
    -- Booster Access System Tables
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS booster_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_user_id TEXT UNIQUE NOT NULL,
      discord_username TEXT DEFAULT NULL,
      is_verified INTEGER NOT NULL DEFAULT 1,
      boost_count INTEGER NOT NULL DEFAULT 2,
      status TEXT NOT NULL DEFAULT 'active', -- 'active', 'revoked', 'suspended'
      verified_at TEXT NOT NULL,
      verified_by TEXT DEFAULT 'admin',
      revoked_at TEXT DEFAULT NULL,
      revoked_by TEXT DEFAULT NULL,
      revoked_reason TEXT DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_booster_user ON booster_users(discord_user_id);
    CREATE INDEX IF NOT EXISTS idx_booster_status ON booster_users(status);

    CREATE TABLE IF NOT EXISTS booster_auth_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discord_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      used_at TEXT DEFAULT NULL,
      ip_address TEXT DEFAULT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_booster_code ON booster_auth_codes(code);
    CREATE INDEX IF NOT EXISTS idx_booster_code_user ON booster_auth_codes(discord_user_id);
    CREATE INDEX IF NOT EXISTS idx_booster_code_used ON booster_auth_codes(used);

    CREATE TABLE IF NOT EXISTS booster_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      session_token TEXT UNIQUE NOT NULL,
      discord_user_id TEXT NOT NULL,
      discord_username TEXT DEFAULT NULL,
      hwid TEXT DEFAULT NULL,
      ip_address TEXT DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'active', -- 'active', 'revoked', 'expired'
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_heartbeat TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_booster_session_id ON booster_sessions(session_id);
    CREATE INDEX IF NOT EXISTS idx_booster_session_token ON booster_sessions(session_token);
    CREATE INDEX IF NOT EXISTS idx_booster_session_user ON booster_sessions(discord_user_id);
    CREATE INDEX IF NOT EXISTS idx_booster_session_status ON booster_sessions(status);

    CREATE TABLE IF NOT EXISTS booster_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_user_id TEXT,
      action TEXT NOT NULL,
      actor TEXT DEFAULT 'system',
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_booster_audit_user ON booster_audit_logs(discord_user_id);
    CREATE INDEX IF NOT EXISTS idx_booster_audit_action ON booster_audit_logs(action);
  `);
  console.log('[DATABASE] Schema initialized successfully.');
}

initSchema();

module.exports = db;
