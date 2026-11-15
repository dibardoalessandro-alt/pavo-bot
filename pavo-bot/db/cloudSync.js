const zlib = require('zlib');
const https = require('https');
const http = require('http');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');

const SNAPSHOT_MARKER = '🗄️ **[PAVO-PERSISTENT-DB-SNAPSHOT]**';
const ATTACHMENT_NAME = 'pavo_db_snapshot.json.gz';

let discordClient = null;
let botConfig = null;
let getSnapshotFn = null;
let cachedSnapshotMsg = null;
let syncTimer = null;
let syncInFlight = null;
let pendingSync = false;

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadBuffer(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} downloading snapshot`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function resolveBackupChannel(client, config) {
  const candidates = [
    process.env.DB_BACKUP_CHANNEL_ID,
    config?.botLogChannelId,
    config?.ticketLogChannelId,
    config?.transcriptChannelId
  ].filter(id => id && /^\d+$/.test(String(id)));

  for (const id of candidates) {
    const ch = client.channels.cache.get(id) || await client.channels.fetch(id).catch(() => null);
    if (ch && ch.isTextBased()) return ch;
  }
  return null;
}

async function findSnapshotMessage(channel, botUserId) {
  if (cachedSnapshotMsg) return cachedSnapshotMsg;

  // 1. Check pinned messages first
  const pinned = await channel.messages.fetchPinned().catch(() => null);
  if (pinned) {
    const match = pinned.find(m => m.author?.id === botUserId && m.content?.includes(SNAPSHOT_MARKER));
    if (match) {
      cachedSnapshotMsg = match;
      return match;
    }
  }

  // 2. Check recent messages
  const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  if (recent) {
    const match = recent.find(m => m.author?.id === botUserId && m.content?.includes(SNAPSHOT_MARKER));
    if (match) {
      cachedSnapshotMsg = match;
      return match;
    }
  }

  return null;
}

async function restoreFromCloud(client, config, applySnapshotFn, exportSnapshotFn) {
  discordClient = client;
  botConfig = config;
  getSnapshotFn = exportSnapshotFn;

  const channel = await resolveBackupChannel(client, config);
  if (!channel) {
    console.warn('⚠️ [CLOUD-SYNC] No backup log channel found for snapshot recovery.');
    return false;
  }

  try {
    const msg = await findSnapshotMessage(channel, client.user.id);
    if (!msg) {
      console.log('☁️ [CLOUD-SYNC] No existing cloud snapshot found yet. Creating initial snapshot...');
      await flushCloudSync();
      return false;
    }

    const attachment = msg.attachments.find(a => a.name === ATTACHMENT_NAME) || msg.attachments.first();
    if (!attachment || !attachment.url) {
      return false;
    }

    const rawBuf = await downloadBuffer(attachment.url);
    const jsonStr = zlib.gunzipSync(rawBuf).toString('utf8');
    const parsed = JSON.parse(jsonStr);

    await applySnapshotFn(parsed);
    console.log(`☁️ [CLOUD-SYNC] Successfully restored persistent snapshot from #${channel.name} (msg ${msg.id}).`);
    return true;
  } catch (err) {
    console.error('⚠️ [CLOUD-SYNC] Failed to restore snapshot from Discord channel:', err.message);
    return false;
  }
}

async function performSyncNow() {
  if (!discordClient || !botConfig || !getSnapshotFn) return;
  const channel = await resolveBackupChannel(discordClient, botConfig);
  if (!channel) return;

  try {
    const snapshot = getSnapshotFn();
    const payloadJson = JSON.stringify({
      version: 2,
      exportedAt: new Date().toISOString(),
      data: snapshot
    });
    const compressed = zlib.gzipSync(Buffer.from(payloadJson, 'utf8'));
    const attachment = new AttachmentBuilder(compressed, { name: ATTACHMENT_NAME });

    const staffCount = Object.keys(snapshot.staff || {}).length;
    const ticketCount = Object.keys(snapshot.tickets || {}).length;
    const gwCount = Object.keys(snapshot.giveaways || {}).length;
    const voteCount = Object.keys(snapshot.legit_check_poll?.votes || {}).length;
    const saleCount = (snapshot.sales || []).length;

    const embed = new EmbedBuilder()
      .setTitle('🗄️ Pavo Bot — Persistent Database Cloud Snapshot')
      .setColor('#22c55e')
      .setDescription(
        'Automatic encrypted/compressed database snapshot used to restore all records across Render deployments & restarts.\n' +
        '**Do not delete this message.**'
      )
      .addFields(
        { name: '🛡️ Staff', value: `\`${staffCount}\``, inline: true },
        { name: '🎟️ Tickets', value: `\`${ticketCount}\``, inline: true },
        { name: '🎉 Giveaways', value: `\`${gwCount}\``, inline: true },
        { name: '✅ Legit Votes', value: `\`${voteCount}\``, inline: true },
        { name: '💰 Sales', value: `\`${saleCount}\``, inline: true },
        { name: '🕒 Updated', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
      )
      .setTimestamp();

    let existing = await findSnapshotMessage(channel, discordClient.user.id);
    if (existing) {
      try {
        cachedSnapshotMsg = await existing.edit({
          content: SNAPSHOT_MARKER,
          embeds: [embed],
          files: [attachment]
        });
        return;
      } catch (_) {
        cachedSnapshotMsg = null;
      }
    }

    const sent = await channel.send({
      content: SNAPSHOT_MARKER,
      embeds: [embed],
      files: [attachment]
    });
    await sent.pin().catch(() => {});
    cachedSnapshotMsg = sent;
  } catch (err) {
    console.error('⚠️ [CLOUD-SYNC] Error syncing snapshot:', err.message);
  }
}

function scheduleCloudSync() {
  if (!discordClient) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    flushCloudSync();
  }, 2500);
}

async function flushCloudSync() {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  if (syncInFlight) {
    pendingSync = true;
    await syncInFlight;
    return;
  }
  syncInFlight = (async () => {
    do {
      pendingSync = false;
      await performSyncNow();
    } while (pendingSync);
  })();
  try {
    await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}

module.exports = {
  restoreFromCloud,
  scheduleCloudSync,
  flushCloudSync
};
