const express = require('express');
const router = express.Router();

const ALLOWED_RARITIES = new Set(['legendary', 'omega']);
const ITEM_TTL_MS = 6 * 60 * 1000; // Keep sightings for 6 minutes
const MAX_ITEMS_PER_ROOM = 300;

// In-memory store: Map<room, Map<key, item>>
const rooms = new Map();

function pruneRoom(roomMap) {
  const cutoff = Date.now() - ITEM_TTL_MS;
  for (const [k, v] of roomMap.entries()) {
    if (v.lastSeen < cutoff) {
      roomMap.delete(k);
    }
  }
}

router.post('/', (req, res) => {
  const { room = 'pavo_global', jobId, players = 0, items } = req.body || {};
  const cleanRoom = String(room || 'pavo_global').slice(0, 64);
  const cleanJobId = String(jobId || '').trim();

  if (!cleanJobId || !Array.isArray(items)) {
    return res.status(400).json({ success: false, error: 'Missing jobId or items array' });
  }

  let roomMap = rooms.get(cleanRoom);
  if (!roomMap) {
    roomMap = new Map();
    rooms.set(cleanRoom, roomMap);
  }

  pruneRoom(roomMap);
  const now = Date.now();
  let added = 0;

  for (const it of items.slice(0, 50)) {
    if (!it || typeof it !== 'object') continue;
    const rarity = String(it.rarity || '').toLowerCase();
    const name = String(it.name || '').trim().slice(0, 80);
    const owner = String(it.owner || 'Unknown').trim().slice(0, 64);
    const status = String(it.status || 'Equipped').trim().slice(0, 40);
    const placeId = Number(it.placeId) || undefined;

    if (!ALLOWED_RARITIES.has(rarity) || !name) continue;

    const key = `${cleanJobId}|${owner}|${name}`;
    roomMap.set(key, {
      name,
      rarity,
      owner,
      status,
      jobId: cleanJobId,
      ...(placeId ? { placeId } : {}),
      players: Number(players) || 0,
      lastSeen: now,
    });
    added++;
  }

  // Cap room size
  if (roomMap.size > MAX_ITEMS_PER_ROOM) {
    const sorted = [...roomMap.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    const toRemove = roomMap.size - MAX_ITEMS_PER_ROOM;
    for (let i = 0; i < toRemove; i++) {
      roomMap.delete(sorted[i][0]);
    }
  }

  res.json({ success: true, recorded: added, total: roomMap.size });
});

router.get('/', (req, res) => {
  const cleanRoom = String(req.query.room || 'pavo_global').slice(0, 64);
  const roomMap = rooms.get(cleanRoom);

  if (!roomMap) {
    return res.json({ success: true, items: [] });
  }

  pruneRoom(roomMap);
  const list = [...roomMap.values()].sort((a, b) => {
    if (a.rarity !== b.rarity) {
      return a.rarity === 'omega' ? -1 : 1;
    }
    return b.lastSeen - a.lastSeen;
  });

  res.json({ success: true, items: list });
});

router.post('/dead', (req, res) => {
  const { room = 'pavo_global', jobId } = req.body || {};
  const cleanRoom = String(room || 'pavo_global').slice(0, 64);
  const cleanJobId = String(jobId || '').trim();
  const roomMap = rooms.get(cleanRoom);
  if (!roomMap || !cleanJobId) {
    return res.json({ success: true, removed: 0 });
  }
  let removed = 0;
  for (const [k, v] of roomMap.entries()) {
    if (v.jobId === cleanJobId) {
      roomMap.delete(k);
      removed++;
    }
  }
  res.json({ success: true, removed });
});

module.exports = router;
