const storage = require('./db/storage');
const cloudSync = require('./db/cloudSync');

// In-memory read cache hydrated from persistent SQLite / PostgreSQL on startup.
// Every write immediately persists to the underlying database.
let dbData = {
  staff: {},
  tickets: {},
  sales: [],
  commission_percentages: {},
  giveaways: {},
  oauth_users: {},
  oauth_states: {},
  licenses: {},
  balances: {},
  transactions: [],
  gamestats: {},
  warnings: [],
  rule_acceptances: {},
  profiles: {},
  server_config: {},
  panels: {},
  legit_check_poll: null
};

function resetMemoryCache() {
  dbData = {
    staff: {},
    tickets: {},
    sales: [],
    commission_percentages: {},
    giveaways: {},
    oauth_users: {},
    oauth_states: {},
    licenses: {},
    balances: {},
    transactions: [],
    gamestats: {},
    warnings: [],
    rule_acceptances: {},
    profiles: {},
    server_config: {},
    panels: {},
    legit_check_poll: null
  };
}

// Database Initialization (loads all persisted data, runs additive migrations)
async function initDatabase() {
  resetMemoryCache();
  const info = await storage.initStorage(dbData);
  return info;
}

// Non-destructively merges a Discord cloud snapshot into local DB + memory
async function mergeCloudSnapshot(wrapper) {
  const snap = wrapper?.data || wrapper;
  if (!snap || typeof snap !== 'object') return;

  // Pause cloud-sync write trigger during bulk restore
  storage.setOnWrite(null);
  try {
    for (const [id, s] of Object.entries(snap.staff || {})) {
      const cur = dbData.staff[id] || {};
      const merged = {
        discord_id: id,
        username: s.username || cur.username || 'Unknown',
        tickets_opened: Math.max(cur.tickets_opened || 0, s.tickets_opened || 0),
        tickets_claimed: Math.max(cur.tickets_claimed || 0, s.tickets_claimed || 0),
        tickets_closed: Math.max(cur.tickets_closed || 0, s.tickets_closed || 0),
        tickets_handled: Math.max(cur.tickets_handled || 0, s.tickets_handled || 0),
        sales_count: Math.max(cur.sales_count || 0, s.sales_count || 0),
        total_earnings: Math.max(Number(cur.total_earnings || 0), Number(s.total_earnings || 0)),
        join_date: cur.join_date || s.join_date || null,
        last_active_at: s.last_active_at || cur.last_active_at || null
      };
      dbData.staff[id] = merged;
      storage.upsertStaff(merged);
    }

    for (const [tid, t] of Object.entries(snap.tickets || {})) {
      if (!dbData.tickets[tid]) {
        dbData.tickets[tid] = t;
        storage.upsertTicket(t);
      } else {
        // Prefer more advanced status (DELETED > CLOSED > OPEN)
        const rank = { OPEN: 1, CLOSED: 2, DELETED: 3 };
        if ((rank[t.status] || 0) >= (rank[dbData.tickets[tid].status] || 0)) {
          dbData.tickets[tid] = { ...dbData.tickets[tid], ...t };
          storage.upsertTicket(dbData.tickets[tid]);
        }
      }
    }

    const existingSaleIds = new Set(dbData.sales.map(s => s.sale_id));
    for (const sale of (snap.sales || [])) {
      if (!existingSaleIds.has(sale.sale_id)) {
        dbData.sales.push(sale);
        existingSaleIds.add(sale.sale_id);
        storage.insertSale(sale);
      }
    }

    for (const [role, pct] of Object.entries(snap.commission_percentages || {})) {
      if (dbData.commission_percentages[role] === undefined) {
        dbData.commission_percentages[role] = pct;
        storage.upsertCommission(role, pct);
      }
    }

    for (const [gid, g] of Object.entries(snap.giveaways || {})) {
      const cur = dbData.giveaways[gid];
      const mergedParticipants = [...new Set([...(cur?.participants || []), ...(g.participants || [])])];
      const merged = {
        ...(cur || {}),
        ...g,
        participants: mergedParticipants,
        presetWinners: (cur?.presetWinners?.length ? cur.presetWinners : g.presetWinners) || []
      };
      if (cur?.status === 'ENDED' || cur?.status === 'CANCELLED') {
        merged.status = cur.status;
        merged.winners = cur.winners?.length ? cur.winners : (g.winners || []);
      }
      dbData.giveaways[gid] = merged;
      storage.upsertGiveaway(merged);
      for (const uid of mergedParticipants) {
        storage.insertGiveawayParticipant(gid, uid);
      }
    }

    if (snap.legit_check_poll) {
      if (!dbData.legit_check_poll) {
        dbData.legit_check_poll = { messageId: null, channelId: '1546615108325736558', votes: {} };
      }
      if (snap.legit_check_poll.messageId && !dbData.legit_check_poll.messageId) {
        dbData.legit_check_poll.messageId = snap.legit_check_poll.messageId;
      }
      if (snap.legit_check_poll.channelId) {
        dbData.legit_check_poll.channelId = snap.legit_check_poll.channelId;
      }
      storage.upsertLegitCheckPoll(dbData.legit_check_poll.channelId, dbData.legit_check_poll.messageId);

      for (const [uid, vote] of Object.entries(snap.legit_check_poll.votes || {})) {
        if (!dbData.legit_check_poll.votes[uid]) {
          dbData.legit_check_poll.votes[uid] = vote;
          storage.upsertLegitCheckVote(uid, vote);
        }
      }
    }

    const mergeKeyedTable = (field, table, keyCol) => {
      for (const [k, v] of Object.entries(snap[field] || {})) {
        if (!dbData[field][k]) {
          dbData[field][k] = v;
          storage.upsertJsonRow(table, keyCol, k, v);
        }
      }
    };

    mergeKeyedTable('oauth_users', 'oauth_users', 'discord_id');
    mergeKeyedTable('licenses', 'licenses', 'key_str');
    mergeKeyedTable('balances', 'balances', 'user_id');
    mergeKeyedTable('gamestats', 'gamestats', 'user_id');
    mergeKeyedTable('rule_acceptances', 'rule_acceptances', 'user_id');
    mergeKeyedTable('profiles', 'profiles', 'user_id');
    mergeKeyedTable('panels', 'panels', 'panel_key');

    const existingTxIds = new Set(dbData.transactions.map(t => t.id));
    for (const tx of (snap.transactions || [])) {
      if (tx?.id && !existingTxIds.has(tx.id)) {
        dbData.transactions.push(tx);
        existingTxIds.add(tx.id);
        storage.upsertJsonRow('transactions', 'id', tx.id, tx);
      }
    }

    const existingWarnIds = new Set(dbData.warnings.map(w => w.id));
    for (const w of (snap.warnings || [])) {
      if (w?.id && !existingWarnIds.has(w.id)) {
        dbData.warnings.push(w);
        existingWarnIds.add(w.id);
        storage.upsertWarning(w);
      }
    }

    await storage.flush();
  } finally {
    storage.setOnWrite(cloudSync.scheduleCloudSync);
  }
}

async function initCloudSync(client, config) {
  await cloudSync.restoreFromCloud(client, config, mergeCloudSnapshot, () => dbData);
  storage.setOnWrite(cloudSync.scheduleCloudSync);
}

async function flushDatabase() {
  await storage.flush();
  await cloudSync.flushCloudSync();
}

// ============================================
// Giveaway Persistence
// ============================================

async function createGiveaway(data) {
  const now = new Date().toISOString();
  const record = {
    id: data.id,
    guildId: data.guildId,
    channelId: data.channelId,
    messageId: data.messageId || null,
    creatorId: data.creatorId,
    prize: data.prize,
    durationMs: data.durationMs,
    startedAt: now,
    endsAt: data.endsAt,
    maxParticipants: data.maxParticipants || 0,
    winnerCount: data.winnerCount || 1,
    requireOAuth: Boolean(data.requireOAuth),
    participants: [],
    winners: [],
    presetWinners: Array.isArray(data.presetWinners) ? data.presetWinners : [],
    status: 'ACTIVE'
  };
  dbData.giveaways[data.id] = record;
  storage.upsertGiveaway(record);
  await storage.flush();
  return record;
}

async function updateGiveawayMessage(id, messageId) {
  if (dbData.giveaways[id]) {
    dbData.giveaways[id].messageId = messageId;
    storage.upsertGiveaway(dbData.giveaways[id]);
    await storage.flush();
  }
}

async function setGiveawayPresetWinners(id, userIds = []) {
  if (dbData.giveaways[id]) {
    dbData.giveaways[id].presetWinners = Array.isArray(userIds) ? userIds : [];
    storage.upsertGiveaway(dbData.giveaways[id]);
    await storage.flush();
    return dbData.giveaways[id];
  }
  return null;
}

async function getGiveaway(id) {
  return dbData.giveaways[id] || null;
}

async function getActiveGiveaways() {
  return Object.values(dbData.giveaways).filter(g => g.status === 'ACTIVE');
}

async function getAllGiveaways() {
  return Object.values(dbData.giveaways);
}

async function addGiveawayParticipant(id, userId) {
  const giveaway = dbData.giveaways[id];
  if (!giveaway) return { success: false, reason: 'NOT_FOUND' };
  if (giveaway.status !== 'ACTIVE') return { success: false, reason: 'NOT_ACTIVE' };
  if (giveaway.participants.includes(userId)) return { success: false, reason: 'ALREADY_ENTERED' };
  if (giveaway.maxParticipants > 0 && giveaway.participants.length >= giveaway.maxParticipants) {
    return { success: false, reason: 'FULL' };
  }

  giveaway.participants.push(userId);
  storage.insertGiveawayParticipant(id, userId);
  storage.upsertGiveaway(giveaway);
  await storage.flush();
  return { success: true, count: giveaway.participants.length };
}

async function endGiveaway(id, winners = []) {
  const giveaway = dbData.giveaways[id];
  if (!giveaway) return null;
  giveaway.status = 'ENDED';
  giveaway.winners = winners;
  giveaway.endedAt = new Date().toISOString();
  storage.upsertGiveaway(giveaway);
  await storage.flush();
  return giveaway;
}

async function cancelGiveaway(id) {
  const giveaway = dbData.giveaways[id];
  if (!giveaway) return null;
  giveaway.status = 'CANCELLED';
  giveaway.endedAt = new Date().toISOString();
  storage.upsertGiveaway(giveaway);
  await storage.flush();
  return giveaway;
}

async function rerollGiveaway(id, newWinners = []) {
  const giveaway = dbData.giveaways[id];
  if (!giveaway) return null;
  giveaway.winners = newWinners;
  storage.upsertGiveaway(giveaway);
  await storage.flush();
  return giveaway;
}

// ============================================
// OAuth2 Persistence & Stats
// ============================================

async function saveOAuthUser(user) {
  const now = new Date().toISOString();
  const existing = dbData.oauth_users[user.discordId];

  const record = {
    discordId: user.discordId,
    username: user.username,
    discriminator: user.discriminator || '0',
    avatar: user.avatar || null,
    accessToken: user.accessToken || (existing ? existing.accessToken : null),
    refreshToken: user.refreshToken || (existing ? existing.refreshToken : null),
    expiresAt: user.expiresAt || null,
    authorizedAt: existing ? existing.authorizedAt : now,
    lastVerifiedAt: now,
    status: 'ACTIVE'
  };
  dbData.oauth_users[user.discordId] = record;
  storage.upsertJsonRow('oauth_users', 'discord_id', user.discordId, record);
  return record;
}

async function getOAuthUser(discordId) {
  return dbData.oauth_users[discordId] || null;
}

async function getAllOAuthUsers() {
  return Object.values(dbData.oauth_users).filter(u => u.status === 'ACTIVE' && u.accessToken);
}

async function revokeOAuthUser(discordId) {
  if (dbData.oauth_users[discordId]) {
    dbData.oauth_users[discordId].status = 'REVOKED';
    dbData.oauth_users[discordId].accessToken = null;
    dbData.oauth_users[discordId].refreshToken = null;
    storage.upsertJsonRow('oauth_users', 'discord_id', discordId, dbData.oauth_users[discordId]);
    return true;
  }
  return false;
}

async function getOAuthStats() {
  const users = Object.values(dbData.oauth_users).filter(u => u.status === 'ACTIVE');
  const total = users.length;

  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

  let today = 0;
  let thisWeek = 0;

  users.forEach(u => {
    const authTime = new Date(u.authorizedAt).getTime();
    if (authTime >= oneDayAgo) today++;
    if (authTime >= oneWeekAgo) thisWeek++;
  });

  return { total, today, thisWeek };
}

async function createOAuthState(state, userId = null, giveawayId = null) {
  const record = {
    state,
    userId,
    giveawayId,
    createdAt: Date.now()
  };
  dbData.oauth_states[state] = record;
  storage.upsertOAuthState(record);

  const expiry = Date.now() - 30 * 60 * 1000;
  for (const s in dbData.oauth_states) {
    if (dbData.oauth_states[s].createdAt < expiry) {
      delete dbData.oauth_states[s];
      storage.deleteRow('oauth_states', 'state', s);
    }
  }

  return record;
}

async function consumeOAuthState(state) {
  if (!state || !dbData.oauth_states[state]) return null;
  const data = { ...dbData.oauth_states[state] };
  delete dbData.oauth_states[state];
  storage.deleteRow('oauth_states', 'state', state);
  return data;
}

// ============================================
// Staff & Ticket Persistence
// ============================================

async function ensureStaffExists(discordId, username) {
  const now = new Date().toISOString();
  if (!dbData.staff[discordId]) {
    const joinDate = now.split('T')[0];
    dbData.staff[discordId] = {
      discord_id: discordId,
      username: username || 'Unknown',
      tickets_opened: 0,
      tickets_claimed: 0,
      tickets_closed: 0,
      tickets_handled: 0,
      sales_count: 0,
      total_earnings: 0.0,
      join_date: joinDate,
      last_active_at: now
    };
    storage.upsertStaff(dbData.staff[discordId]);
  } else {
    let changed = false;
    if (username && dbData.staff[discordId].username !== username) {
      dbData.staff[discordId].username = username;
      changed = true;
    }
    if (typeof dbData.staff[discordId].tickets_opened !== 'number') {
      dbData.staff[discordId].tickets_opened = 0;
      changed = true;
    }
    if (typeof dbData.staff[discordId].tickets_claimed !== 'number') {
      dbData.staff[discordId].tickets_claimed = 0;
      changed = true;
    }
    if (typeof dbData.staff[discordId].tickets_closed !== 'number') {
      dbData.staff[discordId].tickets_closed = 0;
      changed = true;
    }
    if (changed) {
      storage.upsertStaff(dbData.staff[discordId]);
    }
  }
}

async function getStaffInfo(discordId) {
  return dbData.staff[discordId] || null;
}

async function getAllStaffStats() {
  return Object.values(dbData.staff).sort((a, b) => (b.tickets_handled || 0) - (a.tickets_handled || 0));
}

async function recordStaffTicketOpened(staffId, staffUsername) {
  await ensureStaffExists(staffId, staffUsername);
  dbData.staff[staffId].tickets_opened = (dbData.staff[staffId].tickets_opened || 0) + 1;
  dbData.staff[staffId].last_active_at = new Date().toISOString();
  storage.upsertStaff(dbData.staff[staffId]);
}

async function createTicket(ticketId, creatorId, creatorUsername, welcomeMessageId = null, meta = {}) {
  const now = new Date().toISOString();
  const ticket = {
    ticket_id: ticketId,
    creator_id: creatorId,
    creator_username: creatorUsername,
    welcome_message_id: welcomeMessageId,
    claimed_by: null,
    status: 'OPEN',
    closed_by: null,
    created_at: now,
    closed_at: null,
    kind: meta.kind || 'support',
    ...(meta.product ? { product: meta.product } : {}),
    ...(meta.application ? { application: meta.application } : {})
  };
  dbData.tickets[ticketId] = ticket;
  storage.upsertTicket(ticket);

  if (dbData.staff[creatorId]) {
    dbData.staff[creatorId].tickets_opened = (dbData.staff[creatorId].tickets_opened || 0) + 1;
    dbData.staff[creatorId].last_active_at = now;
    storage.upsertStaff(dbData.staff[creatorId]);
  }

  return ticket;
}

async function claimTicket(ticketId, staffId, staffUsername) {
  const now = new Date().toISOString();
  await ensureStaffExists(staffId, staffUsername);
  if (dbData.tickets[ticketId]) {
    const prevClaimant = dbData.tickets[ticketId].claimed_by;
    dbData.tickets[ticketId].claimed_by = staffId;
    storage.upsertTicket(dbData.tickets[ticketId]);

    if (prevClaimant !== staffId) {
      dbData.staff[staffId].tickets_claimed = (dbData.staff[staffId].tickets_claimed || 0) + 1;
    }
    dbData.staff[staffId].last_active_at = now;
    storage.upsertStaff(dbData.staff[staffId]);
  }
}

async function closeTicket(ticketId, staffId, staffUsername) {
  const now = new Date().toISOString();
  await ensureStaffExists(staffId, staffUsername);

  const wasAlreadyClosed = dbData.tickets[ticketId] && dbData.tickets[ticketId].status === 'CLOSED';

  if (dbData.tickets[ticketId]) {
    dbData.tickets[ticketId].status = 'CLOSED';
    dbData.tickets[ticketId].closed_by = staffId;
    dbData.tickets[ticketId].closed_at = now;
  } else {
    dbData.tickets[ticketId] = {
      ticket_id: ticketId,
      creator_id: 'Unknown',
      creator_username: 'Unknown',
      welcome_message_id: null,
      claimed_by: null,
      status: 'CLOSED',
      closed_by: staffId,
      created_at: now,
      closed_at: now,
      kind: 'support'
    };
  }
  storage.upsertTicket(dbData.tickets[ticketId]);

  if (!wasAlreadyClosed) {
    const ticket = dbData.tickets[ticketId];
    const handlerId = ticket.claimed_by ? ticket.claimed_by : staffId;

    await ensureStaffExists(staffId, staffUsername);
    dbData.staff[staffId].tickets_closed = (dbData.staff[staffId].tickets_closed || 0) + 1;
    dbData.staff[staffId].last_active_at = now;
    storage.upsertStaff(dbData.staff[staffId]);

    if (!dbData.staff[handlerId]) {
      await ensureStaffExists(handlerId, 'Unknown Staff');
    }
    dbData.staff[handlerId].tickets_handled = (dbData.staff[handlerId].tickets_handled || 0) + 1;
    dbData.staff[handlerId].last_active_at = now;
    storage.upsertStaff(dbData.staff[handlerId]);
  }

  return { ...dbData.tickets[ticketId], wasAlreadyClosed };
}

async function recordSale(customerId, customerUsername, staffId, staffUsername, product, price, paymentMethod, ticketId, commission) {
  await ensureStaffExists(staffId, staffUsername);
  const now = new Date().toISOString();

  const sale = {
    sale_id: dbData.sales.length + 1,
    customer_id: customerId,
    customer_username: customerUsername,
    staff_id: staffId,
    product: product,
    price: price,
    payment_method: paymentMethod,
    date: now,
    ticket_id: ticketId,
    commission: commission
  };

  dbData.sales.push(sale);
  storage.insertSale(sale);

  dbData.staff[staffId].sales_count = (dbData.staff[staffId].sales_count || 0) + 1;
  dbData.staff[staffId].total_earnings = Number(dbData.staff[staffId].total_earnings || 0) + commission;
  dbData.staff[staffId].last_active_at = now;
  storage.upsertStaff(dbData.staff[staffId]);
}

async function getRoleCommissionPercentage(roleName, configDefaults) {
  if (dbData.commission_percentages[roleName] !== undefined) {
    return dbData.commission_percentages[roleName];
  }
  return configDefaults[roleName] || 10.0;
}

async function setRoleCommissionPercentage(roleName, percentage) {
  dbData.commission_percentages[roleName] = percentage;
  storage.upsertCommission(roleName, percentage);
}

async function getSalesStats() {
  const total_sales = dbData.sales.length;
  const total_revenue = dbData.sales.reduce((acc, s) => acc + (s.price || 0), 0);
  const total_commissions = dbData.sales.reduce((acc, s) => acc + (s.commission || 0), 0);

  return { total_sales, total_revenue, total_commissions };
}

async function getSalesByUser(staffId) {
  return dbData.sales
    .filter(s => s.staff_id === staffId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function getSalesLeaderboard() {
  const staffMap = {};
  for (const sale of dbData.sales) {
    if (!staffMap[sale.staff_id]) {
      const staffInfo = dbData.staff[sale.staff_id];
      staffMap[sale.staff_id] = {
        discord_id: sale.staff_id,
        username: staffInfo ? staffInfo.username : 'Unknown Staff',
        sales_count: 0,
        total_revenue: 0,
        total_earnings: 0
      };
    }
    staffMap[sale.staff_id].sales_count += 1;
    staffMap[sale.staff_id].total_revenue += (sale.price || 0);
    staffMap[sale.staff_id].total_earnings += (sale.commission || 0);
  }

  return Object.values(staffMap).sort((a, b) => b.total_revenue - a.total_revenue);
}

async function getUserOpenTicket(creatorId) {
  for (const ticket of Object.values(dbData.tickets)) {
    if (ticket.creator_id === creatorId && ticket.status === 'OPEN' && ticket.kind !== 'application') {
      return ticket;
    }
  }
  return null;
}

async function getUserOpenApplication(creatorId, applicationType) {
  for (const ticket of Object.values(dbData.tickets)) {
    if (
      ticket.creator_id === creatorId &&
      ticket.status === 'OPEN' &&
      ticket.kind === 'application' &&
      ticket.application?.type === applicationType
    ) {
      return ticket;
    }
  }
  return null;
}

async function updateTicketApplication(ticketId, patch = {}, ticketPatch = {}) {
  const ticket = dbData.tickets[ticketId];
  if (!ticket) return null;

  ticket.application = {
    ...(ticket.application || {}),
    ...patch
  };
  Object.assign(ticket, ticketPatch);
  storage.upsertTicket(ticket);
  return ticket;
}

async function getPanelMessage(panelKey) {
  return (dbData.panels && dbData.panels[panelKey]) || null;
}

async function setPanelMessage(panelKey, channelId, messageId, extra = {}) {
  if (!dbData.panels) dbData.panels = {};
  dbData.panels[panelKey] = {
    channelId,
    messageId,
    ...extra,
    updatedAt: new Date().toISOString()
  };
  storage.upsertJsonRow('panels', 'panel_key', panelKey, dbData.panels[panelKey]);
}

async function getTicket(ticketId) {
  return dbData.tickets[ticketId] || null;
}

async function reopenTicket(ticketId) {
  if (dbData.tickets[ticketId]) {
    dbData.tickets[ticketId].status = 'OPEN';
    dbData.tickets[ticketId].closed_by = null;
    dbData.tickets[ticketId].closed_at = null;
    storage.upsertTicket(dbData.tickets[ticketId]);
  }
}

async function deleteTicket(ticketId) {
  if (dbData.tickets[ticketId]) {
    dbData.tickets[ticketId].status = 'DELETED';
    storage.upsertTicket(dbData.tickets[ticketId]);
  }
}

// ============================================
// Legit Check / Vouches Poll Persistence
// ============================================

async function getLegitCheckData() {
  if (!dbData.legit_check_poll) {
    dbData.legit_check_poll = {
      messageId: null,
      channelId: '1546615108325736558',
      votes: {}
    };
    storage.upsertLegitCheckPoll(dbData.legit_check_poll.channelId, null);
  }

  const votes = dbData.legit_check_poll.votes || {};
  let yesVotes = 0;
  let noVotes = 0;

  for (const v of Object.values(votes)) {
    if (v === 'yes') yesVotes++;
    if (v === 'no') noVotes++;
  }

  return {
    messageId: dbData.legit_check_poll.messageId,
    channelId: dbData.legit_check_poll.channelId,
    votes,
    yesVotes,
    noVotes
  };
}

async function setLegitCheckMessage(channelId, messageId) {
  if (!dbData.legit_check_poll) {
    dbData.legit_check_poll = { messageId: null, channelId, votes: {} };
  }
  dbData.legit_check_poll.channelId = channelId;
  dbData.legit_check_poll.messageId = messageId;
  storage.upsertLegitCheckPoll(channelId, messageId);
}

async function castLegitCheckVote(userId, voteType) {
  if (!dbData.legit_check_poll) {
    dbData.legit_check_poll = { messageId: null, channelId: '1546615108325736558', votes: {} };
    storage.upsertLegitCheckPoll(dbData.legit_check_poll.channelId, null);
  }
  if (!dbData.legit_check_poll.votes) {
    dbData.legit_check_poll.votes = {};
  }

  const currentVote = dbData.legit_check_poll.votes[userId];
  const alreadyVotedThis = currentVote === voteType;

  dbData.legit_check_poll.votes[userId] = voteType;
  storage.upsertLegitCheckVote(userId, voteType);

  let yesVotes = 0;
  let noVotes = 0;
  for (const v of Object.values(dbData.legit_check_poll.votes)) {
    if (v === 'yes') yesVotes++;
    if (v === 'no') noVotes++;
  }

  return {
    alreadyVotedThis,
    voteType,
    yesVotes,
    noVotes
  };
}

// ============================================
// KEY / LICENSE SYSTEM PERSISTENCE
// ============================================

function generateKeyString(prefix = 'PAVO') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const block = () => Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  return `${prefix}-${block()}-${block()}-${block()}`;
}

async function createKey(data) {
  const now = new Date();
  const keyStr = data.key || generateKeyString(data.prefix || 'PAVO');

  let expiresAt = null;
  let durationDays = null;

  if (data.duration === 'lifetime') {
    expiresAt = null;
    durationDays = null;
  } else if (data.duration === '30d') {
    durationDays = 30;
    expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  } else if (data.duration === '7d') {
    durationDays = 7;
    expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (data.durationDays) {
    durationDays = Number(data.durationDays);
    expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  }

  const licenseRecord = {
    key: keyStr,
    product: data.product || 'BlockSpin',
    duration: data.duration || 'lifetime',
    durationDays: durationDays,
    createdAt: now.toISOString(),
    expiresAt: expiresAt,
    createdBy: data.createdBy || 'System',
    creatorTag: data.creatorTag || 'Staff',
    redeemedBy: null,
    redeemerTag: null,
    redeemedAt: null,
    revokedBy: null,
    revocationReason: null,
    status: 'ACTIVE',
    notes: data.notes || ''
  };

  dbData.licenses[keyStr] = licenseRecord;
  storage.upsertJsonRow('licenses', 'key_str', keyStr, licenseRecord);
  return licenseRecord;
}

async function createMultipleKeys(product, duration, quantity, createdBy, creatorTag, notes) {
  const keys = [];
  for (let i = 0; i < quantity; i++) {
    const key = await createKey({ product, duration, createdBy, creatorTag, notes });
    keys.push(key);
  }
  return keys;
}

async function getKey(key) {
  if (!key) return null;
  const k = key.trim().toUpperCase();
  const record = dbData.licenses[k];
  if (!record) return null;

  if (record.status === 'ACTIVE' && record.expiresAt) {
    if (new Date(record.expiresAt) < new Date()) {
      record.status = 'EXPIRED';
      storage.upsertJsonRow('licenses', 'key_str', k, record);
    }
  }

  return record;
}

async function getAllKeys(filter = {}) {
  let list = Object.values(dbData.licenses || {});

  if (filter.status) {
    list = list.filter(k => k.status.toUpperCase() === filter.status.toUpperCase());
  }
  if (filter.product) {
    list = list.filter(k => k.product.toLowerCase().includes(filter.product.toLowerCase()));
  }
  if (filter.userId) {
    list = list.filter(k => k.redeemedBy === filter.userId || k.createdBy === filter.userId);
  }

  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function redeemKey(keyStr, userId, userTag) {
  const record = await getKey(keyStr);
  if (!record) return { success: false, reason: 'NOT_FOUND' };
  if (record.status === 'REVOKED') return { success: false, reason: 'REVOKED' };
  if (record.status === 'REDEEMED') return { success: false, reason: 'ALREADY_REDEEMED', redeemedBy: record.redeemedBy, redeemedAt: record.redeemedAt };
  if (record.status === 'EXPIRED') return { success: false, reason: 'EXPIRED' };

  const now = new Date();
  record.status = 'REDEEMED';
  record.redeemedBy = userId;
  record.redeemerTag = userTag;
  record.redeemedAt = now.toISOString();

  if (record.durationDays && !record.expiresAt) {
    record.expiresAt = new Date(now.getTime() + record.durationDays * 24 * 60 * 60 * 1000).toISOString();
  }

  storage.upsertJsonRow('licenses', 'key_str', record.key, record);
  return { success: true, license: record };
}

async function revokeKey(keyStr, revokedBy, reason = 'Revoked by Staff') {
  const record = await getKey(keyStr);
  if (!record) return { success: false, reason: 'NOT_FOUND' };

  record.status = 'REVOKED';
  record.revokedBy = revokedBy;
  record.revocationReason = reason;
  record.revokedAt = new Date().toISOString();
  storage.upsertJsonRow('licenses', 'key_str', record.key, record);
  return { success: true, license: record };
}

async function deleteKey(keyStr) {
  const k = keyStr.trim().toUpperCase();
  if (dbData.licenses[k]) {
    delete dbData.licenses[k];
    storage.deleteRow('licenses', 'key_str', k);
    return true;
  }
  return false;
}

// ============================================
// VIRTUAL CURRENCY (PAVO COINS) & ECONOMY
// ============================================

async function getBalance(userId) {
  if (!dbData.balances[userId]) {
    dbData.balances[userId] = {
      userId,
      coins: 500,
      bank: 0,
      lastDaily: null,
      createdAt: new Date().toISOString()
    };
    storage.upsertJsonRow('balances', 'user_id', userId, dbData.balances[userId]);
  }
  return dbData.balances[userId];
}

async function addBalance(userId, amount, reason = 'Reward', txType = 'EARN') {
  const userBal = await getBalance(userId);
  const qty = Math.max(0, Math.floor(Number(amount) || 0));
  userBal.coins += qty;
  userBal.updatedAt = new Date().toISOString();
  storage.upsertJsonRow('balances', 'user_id', userId, userBal);

  const tx = {
    id: `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId,
    type: txType,
    amount: qty,
    balanceAfter: userBal.coins,
    reason,
    timestamp: new Date().toISOString()
  };
  dbData.transactions.push(tx);
  storage.upsertJsonRow('transactions', 'id', tx.id, tx);

  return userBal.coins;
}

async function removeBalance(userId, amount, reason = 'Bet/Payment', txType = 'SPEND') {
  const userBal = await getBalance(userId);
  const qty = Math.max(0, Math.floor(Number(amount) || 0));

  if (userBal.coins < qty) {
    return { success: false, currentBalance: userBal.coins, required: qty };
  }

  userBal.coins -= qty;
  userBal.updatedAt = new Date().toISOString();
  storage.upsertJsonRow('balances', 'user_id', userId, userBal);

  const tx = {
    id: `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId,
    type: txType,
    amount: -qty,
    balanceAfter: userBal.coins,
    reason,
    timestamp: new Date().toISOString()
  };
  dbData.transactions.push(tx);
  storage.upsertJsonRow('transactions', 'id', tx.id, tx);

  return { success: true, newBalance: userBal.coins };
}

async function transferCoins(fromUserId, toUserId, amount, reason = 'User Transfer') {
  const qty = Math.max(1, Math.floor(Number(amount) || 0));
  const senderBal = await getBalance(fromUserId);

  if (senderBal.coins < qty) {
    return { success: false, reason: 'INSUFFICIENT_FUNDS', currentBalance: senderBal.coins };
  }

  const senderRemove = await removeBalance(fromUserId, qty, `Transfer to ${toUserId}: ${reason}`, 'TRANSFER_OUT');
  if (!senderRemove.success) return senderRemove;

  const receiverCoins = await addBalance(toUserId, qty, `Transfer from ${fromUserId}: ${reason}`, 'TRANSFER_IN');

  return {
    success: true,
    amount: qty,
    senderNewBalance: senderRemove.newBalance,
    receiverNewBalance: receiverCoins
  };
}

async function claimDaily(userId, rewardAmount = 500) {
  const userBal = await getBalance(userId);
  const now = Date.now();
  const cooldownMs = 24 * 60 * 60 * 1000;

  if (userBal.lastDaily) {
    const lastClaim = new Date(userBal.lastDaily).getTime();
    if (now - lastClaim < cooldownMs) {
      const remainingMs = cooldownMs - (now - lastClaim);
      return { success: false, cooldownRemainingMs: remainingMs };
    }
  }

  userBal.coins += rewardAmount;
  userBal.lastDaily = new Date(now).toISOString();
  userBal.updatedAt = new Date(now).toISOString();
  storage.upsertJsonRow('balances', 'user_id', userId, userBal);

  const tx = {
    id: `TX-DAILY-${now}`,
    userId,
    type: 'DAILY_REWARD',
    amount: rewardAmount,
    balanceAfter: userBal.coins,
    reason: 'Daily Coins Claim',
    timestamp: new Date(now).toISOString()
  };
  dbData.transactions.push(tx);
  storage.upsertJsonRow('transactions', 'id', tx.id, tx);

  return { success: true, reward: rewardAmount, newBalance: userBal.coins };
}

async function getEconomyLeaderboard(limit = 10) {
  const users = Object.values(dbData.balances || {});
  return users
    .sort((a, b) => b.coins - a.coins)
    .slice(0, limit);
}

// ============================================
// GAMBLING STATISTICS & RECORDING
// ============================================

async function getGameStats(userId) {
  if (!dbData.gamestats[userId]) {
    dbData.gamestats[userId] = {
      userId,
      totalGames: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      coinsWon: 0,
      coinsLost: 0,
      guessWins: 0,
      diceWins: 0,
      slotsWins: 0,
      coinflipWins: 0,
      blackjackWins: 0,
      highlowWins: 0,
      lastPlayed: null
    };
    storage.upsertJsonRow('gamestats', 'user_id', userId, dbData.gamestats[userId]);
  }
  return dbData.gamestats[userId];
}

async function recordGameResult(data) {
  const { userId, gameType, outcome, betAmount = 0, payout = 0 } = data;
  const stats = await getGameStats(userId);

  stats.totalGames += 1;
  stats.lastPlayed = new Date().toISOString();

  if (outcome === 'WIN') {
    stats.wins += 1;
    const profit = Math.max(0, payout - betAmount);
    stats.coinsWon += profit;

    if (gameType === 'guess') stats.guessWins += 1;
    if (gameType === 'dice') stats.diceWins += 1;
    if (gameType === 'slots') stats.slotsWins += 1;
    if (gameType === 'coinflip') stats.coinflipWins += 1;
    if (gameType === 'blackjack') stats.blackjackWins += 1;
    if (gameType === 'highlow') stats.highlowWins += 1;
  } else if (outcome === 'LOSS') {
    stats.losses += 1;
    stats.coinsLost += betAmount;
  } else if (outcome === 'DRAW' || outcome === 'TIE') {
    stats.draws += 1;
  }

  storage.upsertJsonRow('gamestats', 'user_id', userId, stats);
  return stats;
}

async function getGamesLeaderboard(type = 'wins', limit = 10) {
  const allStats = Object.values(dbData.gamestats || {});
  if (type === 'coins') {
    return allStats.sort((a, b) => (b.coinsWon - b.coinsLost) - (a.coinsWon - a.coinsLost)).slice(0, limit);
  } else if (type === 'games') {
    return allStats.sort((a, b) => b.totalGames - a.totalGames).slice(0, limit);
  } else {
    return allStats.sort((a, b) => b.wins - a.wins).slice(0, limit);
  }
}

// ============================================
// WARNINGS & MODERATION PERSISTENCE
// ============================================

async function addWarning(userId, moderatorId, reason = 'No reason provided') {
  const warning = {
    id: `WARN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId,
    moderatorId,
    reason,
    timestamp: new Date().toISOString()
  };

  dbData.warnings.push(warning);
  storage.upsertWarning(warning);
  return warning;
}

async function getWarnings(userId) {
  return (dbData.warnings || []).filter(w => w.userId === userId);
}

async function clearWarnings(userId) {
  const countBefore = (dbData.warnings || []).length;
  dbData.warnings = (dbData.warnings || []).filter(w => w.userId !== userId);
  storage.clearWarningsByUser(userId);
  return countBefore - dbData.warnings.length;
}

// ============================================
// RULE ACCEPTANCE & PROFILE PROGRESSION
// ============================================

async function recordRuleAcceptance(userId, userTag) {
  if (dbData.rule_acceptances[userId]) {
    return { alreadyAccepted: true, acceptedAt: dbData.rule_acceptances[userId].acceptedAt };
  }

  const rec = {
    userId,
    userTag,
    acceptedAt: new Date().toISOString()
  };
  dbData.rule_acceptances[userId] = rec;
  storage.upsertJsonRow('rule_acceptances', 'user_id', userId, rec);
  return { alreadyAccepted: false, acceptedAt: rec.acceptedAt };
}

async function hasAcceptedRules(userId) {
  return Boolean(dbData.rule_acceptances && dbData.rule_acceptances[userId]);
}

async function addXp(userId, amount = 10) {
  if (!dbData.profiles[userId]) {
    dbData.profiles[userId] = {
      userId,
      xp: 0,
      level: 1,
      lastActive: new Date().toISOString()
    };
  }

  const p = dbData.profiles[userId];
  p.xp += amount;

  const newLevel = Math.floor(Math.sqrt(p.xp / 100)) + 1;
  const leveledUp = newLevel > p.level;
  p.level = newLevel;
  p.lastActive = new Date().toISOString();

  storage.upsertJsonRow('profiles', 'user_id', userId, p);
  return { xp: p.xp, level: p.level, leveledUp };
}

async function getUserProfile(userId) {
  const bal = await getBalance(userId);
  const stats = await getGameStats(userId);
  const warnings = await getWarnings(userId);
  const accepted = await hasAcceptedRules(userId);

  if (!dbData.profiles[userId]) {
    dbData.profiles[userId] = {
      userId,
      xp: 50,
      level: 1,
      lastActive: new Date().toISOString()
    };
    storage.upsertJsonRow('profiles', 'user_id', userId, dbData.profiles[userId]);
  }

  return {
    userId,
    balance: bal.coins,
    stats,
    warningsCount: warnings.length,
    rulesAccepted: accepted,
    profile: dbData.profiles[userId]
  };
}

module.exports = {
  initDatabase,
  initCloudSync,
  flushDatabase,
  createBackup: storage.createSqliteBackup,
  getStorageInfo: storage.getStorageInfo,
  ensureStaffExists,
  getStaffInfo,
  getAllStaffStats,
  recordStaffTicketOpened,
  createTicket,
  claimTicket,
  closeTicket,
  recordSale,
  getRoleCommissionPercentage,
  setRoleCommissionPercentage,
  getSalesStats,
  getSalesByUser,
  getSalesLeaderboard,
  getUserOpenTicket,
  getUserOpenApplication,
  updateTicketApplication,
  getPanelMessage,
  setPanelMessage,
  getTicket,
  reopenTicket,
  deleteTicket,
  createGiveaway,
  updateGiveawayMessage,
  setGiveawayPresetWinners,
  getGiveaway,
  getActiveGiveaways,
  getAllGiveaways,
  addGiveawayParticipant,
  endGiveaway,
  cancelGiveaway,
  rerollGiveaway,
  saveOAuthUser,
  getOAuthUser,
  getAllOAuthUsers,
  revokeOAuthUser,
  getOAuthStats,
  createOAuthState,
  consumeOAuthState,
  getLegitCheckData,
  setLegitCheckMessage,
  castLegitCheckVote,
  createKey,
  createMultipleKeys,
  getKey,
  getAllKeys,
  redeemKey,
  revokeKey,
  deleteKey,
  getBalance,
  addBalance,
  removeBalance,
  transferCoins,
  claimDaily,
  getEconomyLeaderboard,
  getGameStats,
  recordGameResult,
  getGamesLeaderboard,
  addWarning,
  getWarnings,
  clearWarnings,
  recordRuleAcceptance,
  hasAcceptedRules,
  addXp,
  getUserProfile
};
